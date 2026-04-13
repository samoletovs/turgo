# turgo — Claude Code Instructions

## Project Overview

Turgo is an agent-first marketplace built with Next.js, TypeScript, and Prisma.

## Architecture

- `src/` — web app routes, server modules, and shared logic
- `prisma/` — database schema and migrations
- `tests/` — Vitest and server test suites
- `infrastructure/` and `infra/` — deployment and cloud resources

## Key Rules

- Keep auth, billing, and AI flows secure-by-default.
- Preserve strict typing and runtime validation in server paths.
- Avoid schema changes without migration and test updates.

## Validation

- `npm run lint`
- `npm run build`
- `npm run test`
