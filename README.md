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

## Installable app and browser push

The manifest and service worker are served at `/manifest.json` and `/sw.js`.
Installation and push require HTTPS (localhost works for development). Push is
opt-in: signed-in users toggle **Settings → Notifications → Push Notifications**
for each browser. Permission is never requested on page load. Signing out
unsubscribes that browser; signing in again requires opting in again.

Generate VAPID keys with `npx web-push generate-vapid-keys` and configure
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` on the
server. Keep the private key secret and retain the same key pair across releases.
Registration accepts the standard Chrome/Firefox/Edge/Safari push providers.
Expired endpoints (404/410) are removed; transient delivery failures are retried
on subsequent notifications.

For an existing database, apply
`prisma/migrations/20261118170000_unique_push_endpoint/migration.sql` before
deploying this version:

```powershell
npx prisma db execute --file prisma/migrations/20261118170000_unique_push_endpoint/migration.sql
```

It keeps the latest subscription for each endpoint and
adds the unique index required for account-safe registration. This is an
incremental SQL migration, not a baseline for the rest of the schema; do not use
`prisma migrate deploy` to adopt it on an unbaselined database. New local databases
can use `npm run db:push`.

Run `npx playwright test tests/pwa.spec.ts` with the dev server running to check
asset responses, layout registration, and the worker's notification-click
handler. Click tests stub window-opening APIs because synthetic events lack OS
user activation. Live delivery additionally requires configured VAPID keys and
a real browser push subscription.

## Status

**Active prototype.** The repository contains the marketplace UI, API,
messaging, search, and agent-service foundations. It is an experiment, not a
production marketplace.

## License

MIT
