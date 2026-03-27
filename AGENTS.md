# Turgo — Copilot Coding Agent Instructions

> Read by GitHub Copilot coding agent when auto-implementing issues.

## Project

Turgo — agent-first classifieds platform. Next.js 16 + React 19 + TypeScript + Prisma + tRPC + PostgreSQL + Redis + Meilisearch.

## Build & verify

```bash
pnpm install
pnpm build        # MUST pass
pnpm test         # MUST pass
pnpm lint         # MUST pass
```

Always run all three before creating a PR.

## Project structure

```
src/
├── app/[locale]/     # Next.js App Router pages
├── components/       # React components (ui/, listings/, agents/, messaging/, etc.)
├── server/
│   ├── trpc/routers/ # tRPC API routers
│   ├── services/     # Business logic (agent-*, ai-*, stripe, search, etc.)
│   └── db/           # Prisma client
├── lib/              # Utilities, constants, validators (Zod)
├── hooks/            # Custom React hooks
├── stores/           # Zustand stores
├── types/            # Shared TypeScript types
├── messages/         # i18n JSON files (en, lv, ru, lt, et)
└── prisma/           # Schema + migrations + seed
```

## Key conventions

- TypeScript strict — no `any`
- All tRPC inputs validated with Zod
- AI service: `services/ai.ts` routes to dev/free/premium provider
- Agent services follow state machine pattern in `services/agent-orchestrator.ts`
- Use shadcn/ui components from `components/ui/`
- i18n: all user-facing text via `next-intl` — never hardcode strings
- Payments: Stripe subscriptions gated by tier (Free/Pro/Business)
- Images: Sharp for processing, Azure Blob for storage
- All monetary values in EUR cents (integer)
- Mobile-first responsive design

## When implementing an issue

1. Read issue description and labels
2. Check existing patterns in the most similar file
3. Minimal, focused changes — don't refactor unrelated code
4. Run `pnpm build && pnpm test && pnpm lint` before committing
5. Create PR targeting `main`
