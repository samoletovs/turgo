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

<!-- CANONICAL — maintained in samoletovs/nauroLabs-github at config/copilot-pr-guard.md.
     Rolled out by scripts/install-pr-guard.ps1. Edit it there, not in the copy. -->

## Before you open a pull request

Measured across 131 merged PRs in this lab: **15% were self-declared `[WIP]` or
no-ops**. Each one still cost a full 10–30 minute agent run, and agent runs are
the single largest line in the lab's CI bill — around 63% of the monthly
allowance. A PR that says it isn't finished is the most expensive possible way to
report that you couldn't finish.

So: do not open a pull request unless all three of these are true.

**1. You changed behaviour.**
A change that only adds comments, reformats code, or restates the issue is not a
fix. If you discover the work is already done, **say so in a comment on the issue
and stop** — do not open a PR titled `No-op: already implemented`. The comment is
the useful artifact; the PR is noise that a human then has to close.

**2. You finished.**
Never open a PR titled `[WIP]`, `[Draft]`, or `Partial`. If something blocks you,
comment on the issue with: what you were trying to do, what you tried, the exact
error or ambiguity that stopped you, and what decision you need from a human.
That comment is worth more than a half-finished branch and costs a fraction as
much to act on.

**3. You verified it, and you say how.**
The PR description must state what you ran and what it printed. "Should work" and
"this should fix the issue" are not verification.

- If the repo has tests, add one that **fails without your change**. A test that
  passes either way certifies the implementation, not the requirement.
- If the change is not testable, say plainly what you checked by hand.
- If you could not verify it, say that too, in the description, rather than
  leaving it implied.

**Write the description properly.** It is the only part of your work that reaches
a human on a phone screen, and the merge gate refuses PRs whose body is empty or
boilerplate. Say what was broken, what you changed, and how you know it works.
