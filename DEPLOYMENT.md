# Deployment — Azure Container Apps

Turgo runs as the `turgo` container in Container App `turgo`, resource group
`rg-turgo`. The app also runs `redis-sidecar`; search is **Azure AI Search**, not
Meilisearch. PostgreSQL and Blob Storage are separate dependencies.

## Preserve the existing application

Routine releases update **the image and two search bindings of the named `turgo`
container in one command**. Keep the existing Redis sidecar, all other environment
variables and secret references, registry configuration, ingress, and scaling
settings. `minReplicas` remains **0**.

Do not apply `infra/azure-setup.sh` or the Bicep template over the live app as a
search repair. These legacy templates do not describe the current sidecar and
registry configuration. Reconcile infrastructure separately before using them.
Likewise, the legacy `deploy.ps1`, `deploy.sh`, and quick-deploy helpers are not
the supported release path: some use mutable `:latest` references and do not
select the app container explicitly.

## Search configuration

Set these **runtime** values on the Container App, not in the image or source:

| Setting                 | Requirement                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `AZURE_SEARCH_ENDPOINT` | `https://search-turgo.search.windows.net` (also the code default)                        |
| `AZURE_SEARCH_API_KEY`  | `secretref:azure-search-api-key`; the referenced Container App secret must already exist |

**Deployment prerequisite:** an operator must securely create the Container App
secret `azure-search-api-key` before running CI. Its value is never stored in the
workflow or image. Complete the approved schema bootstrap/backfill from the
source checkout first, with the database URL and admin key inherited through the
process environment; do not bind the key into the old runtime.

The deployment's single named-container update uses `--set-env-vars` to add the
two entries above while deploying the immutable image. This activates the new
reconciliation code and its credentials together. It does **not** use
`--replace-env-vars`, create secrets, or modify unrelated environment values.

The index name is `listings`, defined in `src/server/services/search.ts`.
`getListingsIndexDefinition()` supplies its schema, `sg` suggester, and `boostTitle` scoring
profile. The public search page, search API and suggestions reconcile against
PostgreSQL before using Azure results.

### Permissions

- The health document-count probe needs only **read** access; a query key is
  sufficient for that probe, not for request-time reconciliation.
- Document uploads/deletes need **write** access. Schema creation/update needs
  **index-management** access.
- The current code uses one `AzureKeyCredential` for all three operations.
  Therefore the full application currently requires an **admin API key**.
  A query key alone may make health green while listing indexing still fails.
- Managed identity is not implemented in this search client. A future RBAC
  migration should separate Search Index Data Reader, Search Index Data
  Contributor, and Search Service Contributor permissions by responsibility.

Never print keys, copy them into workflow YAML, or put them into public diagnostic
responses. Changing an app secret without activating it in the running
revision is not proof that search has recovered.

### Operator bootstrap

From the source checkout with Node 24 and installed npm dependencies:

```powershell
# Read-only: print the canonical schema; no key or network call needed.
node .\scripts\bootstrap-search.mjs --schema

# Mutating: only after operator approval, with endpoint and admin key already
# present in the process environment. Do not place the key in command arguments.
node .\scripts\bootstrap-search.mjs --create

# Backfill/reconcile and verify every public ID and its projected content.
# DATABASE_URL must also be inherited from the process environment.
node .\scripts\bootstrap-search.mjs --sync
```

`--create` uses `SearchIndexClient.createIndex()`, not create-or-update. It will
fail rather than overwrite an existing index. Creation is limited to ten
seconds, followed by the three-second authenticated read check. Failure returns
exit code 1 with sanitized diagnostics; success returns 0 and explicitly states
that no listings were backfilled. If creation times out, inspect the index state
before retrying: cancellation cannot prove that Azure did not finish the write.

The script is not automatically run by CI, app startup, or health checks. Run it
from the source checkout, not inside the standalone production image.

`--sync` uses the same `synchronizeSearch()` implementation as requests. It
requires an existing schema, public-listing SELECT privileges, and permission to
use PostgreSQL transaction advisory locks; it needs no table writes/migrations.
It logs aggregate `documents`, `uploaded`, and `deleted` counts only after ID and
content verification. It is idempotent: a second run against unchanged data
does not upload or delete documents. On failure it returns 1 without raw
database/SDK diagnostics. A failed/partial write is repaired on the next run/read;
do not infer success from counts returned before verification.

### Request-driven freshness and safety

[`search-sync.ts`](src/server/services/search-sync.ts) selects only public
`status = ACTIVE` listings and an explicit search-field allowlist, joins category,
location, first image and attributes, then applies the shared canonical
projection. Category/location text includes available localized names. No
contact fields, user fields, or street address are selected for the index.

Every public `/search` request, tRPC search and suggestion request:

1. Tries transaction advisory lock `(81743, 1)` on PostgreSQL. Only one replica
   reconciles at a time; a busy lock causes database fallback, not waiting on
   another replica's incomplete work. Transaction completion/rollback releases it.
2. Reads the authoritative public snapshot and the complete bounded index.
   Compares IDs and SHA-256 fingerprints of the canonical fields.
3. Deletes stale/deleted/inactive IDs first and **replaces** changed documents.
   Full uploads clear removed optional values rather than retaining old values
   through merge semantics. Every item's success flag/key is checked.
4. Reads back the index and compares every ID/content fingerprint, then re-reads
   the database snapshot. A concurrent database change, partial write or delayed
   index visibility fails verification.
5. Queries Azure only after successful reconciliation. The final database
   transaction filters/hydrates IDs against current public records and returns
   database content, never indexed text. It also compares the candidate coverage
   with authoritative filtered counts; missing results fall back to the database,
   even when Azure returned some hits. Both paths use the same output shape,
   filters (including category/location IDs), deterministic sort and pagination.

Suggestions use that same reconciled/hydrated search path and always return
`{ listings, categories }`, with category labels from PostgreSQL. Azure matching
cannot widen the existing database substring/filter semantics; when its token
matching omits a database match, the reader uses database fallback.

**Freshness is request-driven, not a background SLA.** A completed listing change
is observed on the next search/suggestion read. When idle, the index can lag until
the next read or operator `--sync`. During a failure or overlapping write, the
response remains database-authoritative; a later read retries reconciliation.
No tables, workers, schedules or additional capacity are introduced.

Bounds: at most **500** public/indexed documents and **8 MiB** per snapshot;
uploads are at most **100 documents / 4 MiB** per batch; deletes at most 100.
Reconciliation has an **8-second** abort deadline (transaction timeout 9 seconds,
pool wait 1 second, SQL statement timeout 2 seconds). The subsequent Azure query
has a 3-second deadline; final database hydration uses a 5-second transaction.
Exceeding these bounds causes explicit operator failure / request fallback,
never an unbounded backfill. Reassess the design before inventory exceeds them.

Requests never create/update the schema. The Docker image starts Next's
standalone server, not the custom `server.ts`; use the operator command to
create the schema, not a custom-server startup or legacy indexing helpers.

An absent `listings` index must keep `/api/health` degraded, even when the Azure
service itself is reachable. Creating an empty index makes the read probe pass
but does not establish that marketplace search is populated or kept current.

## Quality gates

`package-lock.json` is authoritative. Use npm, not pnpm or yarn:

```powershell
npm ci
npm run db:generate
npm run lint
npm run typecheck
npm test
npm run build
```

Use installed dependencies for local validation unless a dependency is missing or
the lockfile has changed. CI performs a clean `npm ci`.

## Immutable release workflow

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs lint,
type-checking, and unit tests. Pull requests additionally build Next.js without
deployment. Main pushes and manual dispatches deploy only when the repository
variable `DEPLOY_ENABLED` is `true`.

1. Authenticate to Azure with OIDC using repository secrets `AZURE_CLIENT_ID`,
   `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID`.
2. Build and push to `acragentsfzmqgv.azurecr.io/turgo`, tagged with the full
   commit SHA. The registry needs push/pull authorization; no ACR admin password
   is used by this workflow.
3. Pass the **digest emitted by that build** to the deployment job.
4. Update the named app container to
   `acragentsfzmqgv.azurecr.io/turgo@sha256:<digest>` and bind the two search
   settings in that same update. Do not resolve `:latest` later: another build
   could have replaced it.
5. Require `/api/health` to return healthy dependencies, including
   `services.azureSearch.status == "ok"`. Bounded retries allow scale-from-zero.

Record the source commit, pushed digest, and resulting revision together. A
revision creation date alone does not prove the age of an image formerly
referenced by a mutable tag. For rollback, use a previously verified digest and
the same named-container-only update, preserving all other settings.

Routine releases no longer run `prisma db push --accept-data-loss` or seed the
database. Database migrations and seed operations require a separate reviewed
operation, not an incidental side effect of a search/image repair.

## Verification and troubleshooting

`GET /api/health` returns HTTP **200** only when every dependency is healthy;
otherwise it returns **503** with `status: "degraded"`. Its service keys are
`database`, `redis`, `azureSearch`, and `bullmq`. Responses are not cached.

The Azure probe makes an authenticated document-count request to the same
endpoint/index/client as marketplace search. An empty index is healthy. Missing
credentials, rejected authorization, a missing index, throttling, network
failures, and a request exceeding **three seconds** are unhealthy. The probe
aborts timed-out requests and returns only a fixed public error message, not
SDK diagnostics or credentials.

- **Homepage 200 but health 503:** the UI/database fallback can conceal a broken
  search service. Inspect the failed service in `/api/health`, not just `/`.
- **`azureSearch` error:** privately verify the runtime endpoint, key, index
  existence and permissions. Check whether the running revision picked up the
  intended secret/configuration.
- **`redis` / `bullmq` error:** verify the existing sidecar and `REDIS_URL`; do
  not provision a replacement Redis service as part of this repair.
- **Search returns no listings despite healthy status:** health proves an
  authenticated read, not index freshness or write authorization. Verify
  expected indexed content through an actual marketplace search and a
  controlled indexing check.

After release, verify both dependency health and representative search behavior.
Page count parity alone cannot prove that Azure indexing succeeded because
database fallback preserves inventory. Run the operator `--sync` and require
verified ID/content parity as well as public search behavior.
Do not increase minimum replicas or change capacity merely to hide an error.
