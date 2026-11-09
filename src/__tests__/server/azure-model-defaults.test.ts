import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(file: string) {
  return readFileSync(resolve(process.cwd(), file), 'utf8');
}

describe('Azure model provisioning defaults', () => {
  it('uses Luna for both example Azure deployments without changing GitHub Models', () => {
    const example = source('.env.example');
    expect(example).toContain('AZURE_OPENAI_DEPLOYMENT_NAME="gpt-6-luna"');
    expect(example).toContain('AZURE_OPENAI_VISION_DEPLOYMENT="gpt-6-luna"');
    expect(example).toContain('GITHUB_MODELS_MODEL="gpt-4o-mini"');
    expect(example).toContain('AZURE_OPENAI_EMBEDDING_DEPLOYMENT="text-embedding-3-small"');
  });

  it('provisions the observed Luna version on the separate legacy Bicep account', () => {
    const bicep = source('infrastructure/main.bicep');
    expect(bicep).toContain("name: 'oai-${projectName}'");
    expect(bicep).toMatch(/name: 'gpt-6-luna', version: '2026-09-22'/);
    expect(bicep).toMatch(
      /resource gpt6Luna[\s\S]*?sku: \{ name: 'GlobalStandard', capacity: 30 \}/,
    );
    expect(bicep).toContain('dependsOn: [gpt6Luna]');
    expect(bicep).not.toMatch(/gpt-4o|gpt-4\.1/i);
  });

  it('provisions and selects Luna for both chat and vision in the legacy Bash setup', () => {
    const setup = source('infra/azure-setup.sh');
    expect(setup).toContain('--deployment-name gpt-6-luna');
    expect(setup).toContain('--model-name gpt-6-luna');
    expect(setup).toContain('--model-version "2026-09-22"');
    expect(setup).toMatch(/--model-name gpt-6-luna[\s\S]*?--sku-name GlobalStandard/);
    expect(setup).toContain('AZURE_OPENAI_DEPLOYMENT_NAME=gpt-6-luna');
    expect(setup).toContain('AZURE_OPENAI_VISION_DEPLOYMENT=gpt-6-luna');
    expect(setup).not.toMatch(/gpt-4o|gpt-4\.1/i);
  });

  it('provisions Luna and replaces an existing vision setting in the PowerShell setup', () => {
    const setup = source('infra/setup-openai.ps1');
    expect(setup).toMatch(/\$CHAT_MODEL\s*=\s*"gpt-6-luna"/);
    expect(setup).toMatch(/\$CHAT_DEPLOYMENT\s*=\s*"gpt-6-luna"/);
    expect(setup).toMatch(/\$CHAT_MODEL_VERSION\s*=\s*"2026-09-22"/);
    expect(setup).toMatch(/--model-name \$CHAT_MODEL[\s\S]*?--sku-name "GlobalStandard"/);
    expect(setup).toContain('-replace \'AZURE_OPENAI_VISION_DEPLOYMENT="[^"]*"\'');
    expect(setup).not.toMatch(/gpt-4o|gpt-4\.1/i);
  });
});
