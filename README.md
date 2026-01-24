# Cursor Forum Search

AI-powered search assistant for the Cursor community forum, built with Next.js and powered by [Nia](https://trynia.ai).

## Features

- Semantic search across indexed forum content
- Pattern matching for specific terms and error messages
- Direct access to full thread content
- Multi-model support (Claude, Kimi, Grok, Qwen)

## Quick Start

1. Clone the repo
2. Copy `.env.example` to `.env` and fill in:
   - `NIA_API_KEY` - Get from [trynia.ai](https://trynia.ai)
   - `AI_GATEWAY_API_KEY` - Your AI provider key
   - `NIA_CURSOR_FORUM_SOURCES` - Indexed Cursor forum UUID
3. Install & run:
   ```bash
   bun install
   bun run dev
   ```

## Data Source

This assistant searches the indexed Cursor community forum at forum.cursor.com. The forum content is indexed using [Nia](https://trynia.ai) for semantic retrieval.

## Tech Stack

- Next.js 15 (App Router, Edge Runtime)
- Vercel AI SDK
- Tailwind CSS v4
- shadcn/ui

## Docs

[docs.trynia.ai](https://docs.trynia.ai)
