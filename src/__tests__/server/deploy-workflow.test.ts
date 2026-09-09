import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(resolve('.github/workflows/deploy.yml'), 'utf8');

describe('Container Apps image deployment', () => {
  it('deploys the digest produced by this build rather than a mutable tag', () => {
    expect(workflow).toContain('image-digest: ${{ steps.build.outputs.digest }}');
    expect(workflow).toMatch(/name: Build & push\s+id: build/);
    expect(workflow).toContain('type=sha,prefix=,format=long');
    expect(workflow).toContain(
      '--image "${{ env.ACR_LOGIN_SERVER }}/turgo@${{ needs.build.outputs.image-digest }}"',
    );
    expect(workflow).not.toContain('/turgo:latest');
    expect(workflow).not.toContain('type=raw,value=latest');
  });

  it('updates only the named app container without replacing the live configuration', () => {
    const imageUpdate = workflow.match(
      /^\s+az containerapp update \\\r?\n[\s\S]*?--output none/m,
    )?.[0];

    expect(imageUpdate).toBeDefined();
    expect(imageUpdate).toContain('--container-name "${{ env.CONTAINER_APP_NAME }}"');
    expect(imageUpdate).not.toMatch(
      /--(?:yaml|replace-env-vars|remove-env-vars|remove-all-env-vars|min-replicas|max-replicas|registry-server|cpu|memory)\b/,
    );
    expect(workflow).not.toMatch(/az deployment (?:group|sub) create/);
    expect(workflow).not.toContain('--accept-data-loss');
    expect(workflow).not.toContain('prisma db seed');
  });

  it('activates exactly the two search bindings with the new immutable image in one update', () => {
    const commands = workflow.match(/^\s+az containerapp update \\\r?\n[\s\S]*?--output none/gm);
    expect(commands).toHaveLength(1);
    const command = commands?.[0] ?? '';
    expect(command).toContain('--container-name "${{ env.CONTAINER_APP_NAME }}"');
    expect(command).toContain('/turgo@${{ needs.build.outputs.image-digest }}');
    const bindings = command
      .match(/--set-env-vars([\s\S]*?)--output/)?.[1]
      .replaceAll('\\', '')
      .match(/"[^"]*"|\S+/g);
    expect(bindings).toEqual([
      '"AZURE_SEARCH_API_KEY=secretref:azure-search-api-key"',
      '"AZURE_SEARCH_ENDPOINT=https://search-turgo.search.windows.net"',
    ]);
    expect(workflow).not.toMatch(/az containerapp secret set/);
  });

  it('requires dependency health rather than treating the homepage as deployment proof', () => {
    expect(workflow).toContain('"https://turgo.naurolabs.com/api/health"');
    expect(workflow).toContain('--fail --silent --show-error');
    expect(workflow).toContain('--connect-timeout 10 --max-time 20');
    expect(workflow).toContain('.services.azureSearch.status == "ok"');
  });
});
