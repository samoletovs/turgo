# Turgo — Agent-First Classifieds — Copilot Instructions

## Project

Turgo is an agent-first classifieds platform for the Baltic market. Users don't fill forms — AI agents handle selling, buying, pricing, and negotiation autonomously.

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui (Radix primitives)
- **Database**: PostgreSQL 16 + Prisma 7 + pgvector (embeddings)
- **API**: tRPC v11 (type-safe RPC)
- **Auth**: NextAuth.js v5 (credentials + Google + GitHub)
- **Payments**: Stripe (subscriptions + one-time boosts)
- **Search**: Meilisearch (full-text + faceted filters)
- **Real-time**: Socket.io (messaging, live updates)
- **Queue**: BullMQ + Redis (agent orchestration)
- **i18n**: next-intl (EN, LV, RU, LT, ET)
- **AI (Dev)**: GitHub Models API (free)
- **AI (Prod)**: Azure OpenAI GPT-4o (paid tier), Transformers.js CLIP (free tier)
- **Testing**: Vitest + Playwright
- **Dev env**: Docker Compose (PostgreSQL+pgvector, Redis, Meilisearch, Mailpit)

## Design principle

**Lightweight. Fast. Modern. Simple.** Every change must be validated against these four pillars.

**Agent-first**: the primary UX is conversational — users talk to agents, not fill forms. Manual mode exists only as legacy fallback.

## Build and test

```bash
npm ci
npm run dev           # Start dev server
npm run build         # Production build
npm test              # Unit tests (vitest)
npm run test:e2e      # E2E tests (playwright)
npm run lint          # Lint
npm run db:push       # Push Prisma schema
npm run db:migrate    # Run migrations
npm run db:seed       # Seed categories + test data
docker compose up -d  # Start local services
```

> This project builds with **npm** (`package-lock.json`). CI and the Dockerfile both
> run `npm ci`. Do not use pnpm or yarn — a second lockfile drifts from the one that
> ships and reintroduces advisories that `package-lock.json` has already patched.

## Conventions

- TypeScript strict mode — no `any`, no unsafe casts
- English for all code, comments, docs, variable names
- Zod validation on all tRPC inputs
- tRPC routers in `src/server/trpc/routers/`
- Business logic in `src/server/services/`
- Shared types in `src/types/`
- Components: functional with hooks, use shadcn/ui primitives
- Forms: React Hook Form + Zod
- State: Zustand (client), TanStack Query (server)
- All monetary values in EUR cents (integer), display with formatter
- Mobile-first responsive (Tailwind breakpoints)
- Accessibility: keyboard nav, aria labels, 4.5:1 contrast

## AI strategy

- Dev/test: GitHub Models API (free with Copilot subscription)
- Free tier: CLIP client-side + MiniLM embeddings + GitHub Models (rate-limited)
- Paid tier: Azure OpenAI GPT-4o, Azure AI Vision
- AI service router: `src/server/services/ai.ts` delegates to dev/free/premium based on env + tier

## Three user paths

- Agent path (80%): conversational — user talks, agent handles everything
- Quick/hybrid (15%): upload photo → AI fills form → user reviews → posts
- Manual/legacy (5%): traditional form — small "or create manually" link

## Git

- GitHub account: `samoletovs`
- Descriptive commit messages
- Push to `main`
