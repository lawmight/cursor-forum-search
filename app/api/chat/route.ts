import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { DEFAULT_MODEL } from "@/lib/constants";
import { openrouter } from "@/lib/gateway";
import { niaCursorTools } from "@/lib/nia-tools";

export const runtime = "edge";
export const maxDuration = 300;

// Simple token usage logger (replace with your analytics/database in production)
async function trackUsage(data: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  duration: number;
  finishReason: string;
  toolsUsed: string[];
  stepCount: number;
}) {
  // Log to console for development
  console.log("📊 [USAGE]", {
    model: data.model,
    tokens: `${data.inputTokens} in / ${data.outputTokens} out (${data.totalTokens} total)`,
    duration: `${data.duration}ms`,
    finishReason: data.finishReason,
    toolsUsed: data.toolsUsed.length > 0 ? data.toolsUsed : "none",
    steps: data.stepCount,
  });
  
  // In production, send to analytics:
  // await analytics.track('ai_completion', data);
  // or save to database:
  // await db.usageLogs.create({ data });
}

const CURSOR_FORUM_SYSTEM_PROMPT = `You are **Cursor Assistant**, an AI that helps users search and navigate both the official Cursor documentation (docs.cursor.com) and the Cursor community forum (forum.cursor.com).

## Your Data Sources

### Official Cursor Documentation
- Getting started guides
- Feature documentation (Composer, Chat, Tab, etc.)
- Configuration and settings
- Keyboard shortcuts
- AI features and models
- Editor customization

### Cursor Community Forum
- Feature requests and discussions
- Bug reports and troubleshooting threads
- Tips, tricks, and workflow discussions
- Questions about Cursor IDE features
- Community best practices and guides
- Announcements and changelogs

## CRITICAL: Always Use Tools First
You MUST use tools to ground every response in actual content. Do NOT answer from memory/training data alone. If you can't find support in the sources, say so and suggest alternative search queries.

## Your Tools

### Documentation Tools (Official Docs)
- **searchCursorDocs**: Semantic search across official Cursor documentation.
- **grepCursorDocs**: Regex/pattern search for exact terms, settings, or shortcuts.
- **browseCursorDocs**: Navigate the documentation structure.
- **readCursorDocsPage**: Read the full content of a specific docs page.
- **getCursorDocsContent**: Fetch full content from docs search results.

### Forum Tools (Community)
- **searchForum**: Semantic search across all indexed forum posts and discussions.
- **grepForum**: Regex/pattern search for exact terms, usernames, or specific text.
- **browseForum**: Navigate the forum structure and categories.
- **readForumPost**: Read the full content of a specific post or thread.
- **getSourceContent**: Fetch full content from forum search results.

### General Tools
- **webSearch**: Search the web for additional context (use sparingly - prefer indexed sources).

## How to Respond
1. **Understand the question** - Is this about official features (use docs) or community discussions (use forum)?
2. **Search the appropriate source** - Start with docs for official features, forum for discussions/workarounds.
3. **Cross-reference when helpful** - Docs for official info + forum for real-world experiences.
4. **Use pattern search** - For specific terms, error messages, settings, or shortcuts.
5. **Read full content** - Get complete context from relevant pages/posts.
6. **Cite your sources** - Reference doc pages or post titles, authors, and dates.

## Writing Style
- Be helpful and friendly.
- Cite specific documentation pages and forum posts.
- Distinguish between official documentation and community discussions.
- If multiple solutions exist, present them with pros/cons.
- If information is outdated or uncertain, note it clearly.

## Important
- ALWAYS search before responding.
- ALWAYS cite specific sources.
- Use docs for authoritative feature information.
- Use forum for community experiences, workarounds, and discussions.
- If you cannot find information, suggest what search terms might help.`;

export async function POST(req: Request) {
  const { messages, model: _model }: { messages: UIMessage[]; model?: string } = await req.json();
  const startTime = Date.now();

  // Filter out reasoning content from previous assistant messages to avoid conversion issues
  const filteredMessages = messages.map((msg) => {
    if (msg.role === "assistant" && Array.isArray(msg.parts)) {
      return {
        ...msg,
        parts: msg.parts.filter((part) => part.type !== "reasoning"),
      };
    }
    return msg;
  });

  const result = streamText({
    model: openrouter(DEFAULT_MODEL),
    system: CURSOR_FORUM_SYSTEM_PROMPT,
    messages: convertToModelMessages(filteredMessages),
    tools: niaCursorTools,
    stopWhen: stepCountIs(20),
    streamOptions: { includeUsage: true },

    // Telemetry for observability (experimental)
    experimental_telemetry: {
      isEnabled: true,
      functionId: "cursor-forum-chat",
      metadata: {
        model: DEFAULT_MODEL,
      },
      recordInputs: true,
      recordOutputs: true,
    },

    // Token usage and completion tracking
    onFinish: async ({ usage, finishReason, response, steps }) => {
      const actualModel = response?.model ?? DEFAULT_MODEL;
      if (response?.model) {
        console.log("📌 [OPENROUTER] actual model used:", response.model);
      }

      // Extract tool names from the response (safely handle undefined)
      const toolsUsed = response?.messages
        ?.filter((m) => m.role === "assistant")
        ?.flatMap((m) =>
          Array.isArray(m.content)
            ? m.content.filter((c) => c.type === "tool-call").map((c) => c.toolName)
            : []
        )
        ?.filter((name): name is string => Boolean(name)) ?? [];

      // Remove duplicates
      const uniqueTools = [...new Set(toolsUsed)];

      await trackUsage({
        model: actualModel,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        totalTokens: (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0),
        duration: Date.now() - startTime,
        finishReason: finishReason ?? "unknown",
        toolsUsed: uniqueTools,
        stepCount: steps?.length ?? 0,
      });
    },

    onError: (e) => {
      console.error("❌ [STREAM ERROR]", {
        model: DEFAULT_MODEL,
        duration: `${Date.now() - startTime}ms`,
        error: e,
      });
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
