# turgo

turgo is an agent-first classifieds marketplace for Baltic buyers and sellers.
It supports agent-assisted, quick, and manual listing flows.

## Research question

turgo tests the NauroLabs question **"Do we still need apps?"** It asks whether
an agent can handle the buy-and-sell lifecycle while a conventional interface
remains available for search, messaging, and explicit user control.

## What it does

- Creates and manages marketplace listings.
- Supports multilingual search and real-time buyer/seller messaging.
- Orchestrates listing and marketplace tasks through agent services.
- Provides image processing, notifications, and subscription-tier foundations.

## Stack

- Next.js 16, React 19, and TypeScript
- Prisma and PostgreSQL
- Redis, Azure AI Search, tRPC, and WebSockets
- Azure Blob Storage and Azure Container Apps

## Run locally

```powershell
npm ci
Copy-Item .env.example .env
npm run db:generate
npm run dev
```

Supporting services and required environment variables are documented in
[DEPLOYMENT.md](DEPLOYMENT.md) and [.env.example](.env.example).

Search uses the Azure AI Search `listings` index and requires
`AZURE_SEARCH_API_KEY` in production. `/api/health` checks authenticated index
reads under `services.azureSearch`; a homepage response alone does not establish
search health. Releases deploy the image digest produced by CI, not `:latest`.
Search and suggestions reconcile public PostgreSQL listings with the index on
each read, using a cross-replica advisory lock and bounded diffed uploads/deletes.
Responses are hydrated from current public database records, with database
fallback on incomplete sync. Run the reviewed operator
`node .\scripts\bootstrap-search.mjs --sync` to backfill and verify ID/content
parity; see [DEPLOYMENT.md](DEPLOYMENT.md) for credentials, limits and freshness.

Before submitting a change:

```powershell
npm run validate
npm test
npm run build
```

## Status

**Active prototype.** The repository contains the marketplace UI, API,
messaging, search, and agent-service foundations. It is an experiment, not a
production marketplace.

## License

MIT
