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
- Redis, Meilisearch, tRPC, and WebSockets
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
