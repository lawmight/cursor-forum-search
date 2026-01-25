# Cursor Assistant

AI-powered search assistant for both the official Cursor documentation and community forum, built with Next.js and powered by [Nia](https://trynia.ai).

## Features

- Search across official Cursor documentation
- Search across indexed community forum content
- Pattern matching for specific terms, settings, and shortcuts
- Direct access to full docs pages and forum threads
- Multi-model support (Claude, Kimi, Grok, Qwen)

## Quick Start

1. Clone the repo
2. Copy `.env.example` to `.env` and fill in:
   - `NIA_API_KEY` - Get from [trynia.ai](https://trynia.ai)
   - `AI_GATEWAY_API_KEY` - Your AI provider key
   - `NIA_CURSOR_FORUM_SOURCES` - Subscribe to the Cursor forum source at [app.trynia.ai/explore](https://app.trynia.ai/explore), then copy the source UUID
   - `NIA_CURSOR_DOCS_UUID` - Subscribe to the Cursor docs source at [app.trynia.ai/explore](https://app.trynia.ai/explore), then copy the source UUID
3. Install & run:
   ```bash
   bun install
   bun run dev
   ```

## Data Sources

- **Official Docs**: docs.cursor.com - Feature documentation, guides, settings, shortcuts
- **Community Forum**: forum.cursor.com - Discussions, bug reports, tips, feature requests

Both sources are indexed using [Nia](https://trynia.ai).

## Docs

[docs.trynia.ai](https://docs.trynia.ai)
