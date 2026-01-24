# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

An AI assistant that searches and navigates the indexed Cursor community forum (forum.cursor.com), powered by [Nia](https://trynia.ai). The agent helps users find feature discussions, troubleshooting threads, tips, and community knowledge.

## Commands

```bash
bun install       # Install dependencies
bun run dev       # Start development server
bun run build     # Production build
bun run lint      # Run ESLint
bun run type-check # TypeScript checking
```

## Architecture

### Tech Stack
- **Framework**: Next.js 15 with App Router (edge runtime)
- **AI**: Vercel AI SDK with streaming support
- **Styling**: Tailwind CSS v4 with shadcn/ui
- **Package Manager**: pnpm (via bun)

### Key Files
- `app/api/chat/route.ts` - Chat endpoint with Cursor forum system prompt
- `lib/nia-tools.ts` - Nia tools for forum search (searchForum, browseForum, etc.)
- `lib/constants.ts` - Model configuration
- `components/chat.tsx` - Main chat interface

### Nia Tools
- **searchForum**: Semantic search across forum content
- **browseForum**: Navigate forum structure
- **readForumPost**: Read full post/thread content
- **grepForum**: Pattern matching search
- **webSearch**: External web search (use sparingly)
- **getSourceContent**: Fetch full content from results

### Environment Variables
```
NIA_API_KEY              # Nia API key
AI_GATEWAY_API_KEY       # AI provider gateway key
NIA_CURSOR_FORUM_SOURCES # Indexed Cursor forum UUID
```
