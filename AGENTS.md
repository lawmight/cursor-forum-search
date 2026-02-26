# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is an AI-powered Cursor Forum & Docs search assistant built with Next.js 15 (App Router, edge runtime). It has no database or Docker dependencies — just a single Next.js app that calls external APIs (Nia and OpenRouter).

### Commands

See `CLAUDE.md` for the full command list. Key commands:

- `pnpm install` — install dependencies
- `pnpm run dev` — start dev server on port 3000
- `pnpm run lint` — ESLint
- `pnpm run type-check` — TypeScript checking (`tsc --noEmit`)
- `pnpm run build` — production build

### Environment variables

The app requires a `.env` file (copy from `.env.example`). Four secrets are needed for full end-to-end functionality:

- `NIA_API_KEY` — Nia search API authentication
- `OPENROUTER_API_KEY` — OpenRouter LLM inference
- `NIA_CURSOR_FORUM_SOURCES` — UUID for indexed Cursor forum data
- `NIA_CURSOR_DOCS_UUID` — UUID for indexed Cursor docs data

Without these keys, the UI loads and functions but chat submissions return "Missing Authentication header" errors. This is expected behavior when keys are absent.

### Gotchas

- Both `pnpm-lock.yaml` and `bun.lock` exist. Use `pnpm` (matches `packageManager` field in `package.json`).
- The chat API route uses edge runtime (`export const runtime = "edge"`), so Node.js-only APIs are not available in that route.
