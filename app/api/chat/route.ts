import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { DEFAULT_MODEL } from "@/lib/constants";
import { gateway } from "@/lib/gateway";
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

const CURSOR_FORUM_SYSTEM_PROMPT = `You are **Cursor Forum Assistant**, an AI that helps users search and navigate the indexed Cursor community forum (forum.cursor.com).

## Your Data Source
You have access to the indexed Cursor forum, which includes:
- Feature requests and discussions
- Bug reports and troubleshooting threads
- Tips, tricks, and workflow discussions
- Questions about Cursor IDE features
- Community best practices and guides
- Announcements and changelogs

## CRITICAL: Always Use Tools First
You MUST use tools to ground every response in actual forum content. Do NOT answer from memory/training data alone. If you can't find support in the forum sources, say so and suggest alternative search queries.

## Your Tools
- **searchForum**: Semantic search across all indexed forum posts and discussions.
- **grepForum**: Regex/pattern search for exact terms, usernames, or specific text.
- **browseForum**: Navigate the forum structure and categories.
- **readForumPost**: Read the full content of a specific post or thread.
- **getSourceContent**: Fetch full content from search results.
- **webSearch**: Search the web for additional context (use sparingly - prefer forum sources).

## How to Respond
1. **Understand the question** - What is the user looking for? A feature? Bug fix? Workflow tip?
2. **Search the forum** - Start with semantic search to find relevant discussions.
3. **Use pattern search** - For specific terms, error messages, or usernames.
4. **Read full threads** - Get complete context from relevant posts.
5. **Cite your sources** - Reference post titles, authors, and dates.

## Writing Style
- Be helpful and friendly - this is a community resource.
- Cite specific forum posts with titles and authors.
- Summarize discussions clearly, noting different perspectives.
- If multiple solutions exist, present them with pros/cons.
- Link context: mention related discussions when relevant.
- If information is outdated or uncertain, note it clearly.

## Important
- ALWAYS search the forum before responding.
- ALWAYS cite specific posts and sources.
- Present community wisdom, not just your own knowledge.
- Respect that forum discussions represent real users' experiences.
- If you cannot find information, suggest what search terms might help.`;

export async function POST(req: Request) {
  const { messages, model }: { messages: UIMessage[]; model?: string } = await req.json();
  
  const selectedModel = model || DEFAULT_MODEL;
  const startTime = Date.now();

  // Enable extended thinking for Anthropic Claude models
  const isAnthropic = selectedModel.startsWith("anthropic/");
  const providerOptions = isAnthropic
    ? {
        anthropic: {
          thinking: {
            type: "enabled" as const,
            budgetTokens: 10000,
          },
        },
      }
    : undefined;

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
    model: gateway(selectedModel),
    system: CURSOR_FORUM_SYSTEM_PROMPT,
    messages: convertToModelMessages(filteredMessages),
    tools: niaCursorTools,
    stopWhen: stepCountIs(20),
    providerOptions,
    maxOutputTokens: isAnthropic ? 16000 : undefined,
    
    // Telemetry for observability (experimental)
    experimental_telemetry: {
      isEnabled: true,
      functionId: "cursor-forum-chat",
      metadata: {
        model: selectedModel,
      },
      recordInputs: true,
      recordOutputs: true,
    },
    
    // Token usage and completion tracking
    onFinish: async ({ usage, finishReason, response, steps }) => {
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
        model: selectedModel,
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
        model: selectedModel,
        duration: `${Date.now() - startTime}ms`,
        error: e,
      });
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
