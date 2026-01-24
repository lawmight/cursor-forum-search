import { tool } from "ai";
import { z } from "zod";

const NIA_API_BASE = "https://apigcp.trynia.ai/v2";

// Logging helpers
const log = {
  tool: (name: string, input: unknown) => {
    console.log(`\n🔧 [NIA TOOL] ${name}`);
    console.log(`   Input:`, JSON.stringify(input, null, 2).split('\n').join('\n   '));
  },
  success: (name: string, summary: string) => {
    console.log(`✅ [NIA SUCCESS] ${name}: ${summary}`);
  },
  error: (name: string, error: string) => {
    console.error(`❌ [NIA ERROR] ${name}: ${error}`);
  },
  response: (data: unknown) => {
    const preview = JSON.stringify(data, null, 2);
    const lines = preview.split('\n');
    const truncated = lines.length > 20
      ? lines.slice(0, 20).join('\n') + '\n   ... (truncated)'
      : preview;
    console.log(`   Response:`, truncated.split('\n').join('\n   '));
  }
};

async function niaFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const apiKey = process.env.NIA_API_KEY;
  if (!apiKey) {
    throw new Error("NIA_API_KEY environment variable is not set");
  }

  return fetch(`${NIA_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

function parseCsvEnv(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Get Cursor forum sources (indexed forum content)
 */
export function getCursorForumSources(): string[] {
  return parseCsvEnv(process.env.NIA_CURSOR_FORUM_SOURCES);
}

/**
 * Get default forum source for browsing/listing/reading
 */
function getDefaultForumSource(): string {
  const sources = getCursorForumSources();
  if (sources.length === 0) {
    throw new Error("NIA_CURSOR_FORUM_SOURCES not configured");
  }
  return sources[0]!;
}


/**
 * Semantic search over Cursor forum content
 */
export const searchForum = tool({
  description: `Search the Cursor community forum using semantic search.

Searches across indexed forum content including:
- Feature requests and discussions
- Bug reports and troubleshooting
- Tips, workflows, and best practices
- Questions about Cursor features
- Community announcements

Use this to find discussions about specific topics, features, or problems.`,
  inputSchema: z.object({
    query: z
      .string()
      .describe("The search query - a question, topic, feature, or problem to search for"),
  }),
  execute: async ({ query }) => {
    const sources = getCursorForumSources();

    if (sources.length === 0) {
      throw new Error("No Cursor forum sources configured. Check your .env");
    }

    log.tool("searchForum", {
      query,
      sourceCount: sources.length
    });

    const body: Record<string, unknown> = {
      messages: [{ role: "user", content: query }],
      search_mode: "sources",
      include_sources: true,
      data_sources: sources,
    };

    const response = await niaFetch("/search/query", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      log.error("searchForum", error);
      throw new Error(`Nia API error: ${error}`);
    }

    const data = await response.json();
    const sourcesCount = data.sources?.length || 0;
    log.success("searchForum", `Found ${sourcesCount} sources`);
    log.response(data);
    return data;
  },
});

/**
 * Get the tree structure of the indexed Cursor forum
 */
export const browseForum = tool({
  description:
    "Get the structure of the indexed Cursor forum content. Use this to explore available topics and categories.",
  inputSchema: z.object({
    sourceId: z
      .string()
      .optional()
      .describe("Optional: specific source ID (defaults to first configured source)"),
  }),
  execute: async ({ sourceId }) => {
    const resolvedSourceId = sourceId || getDefaultForumSource();
    log.tool("browseForum", { sourceId: resolvedSourceId });
    const response = await niaFetch(`/data-sources/${encodeURIComponent(resolvedSourceId)}/tree`);

    if (!response.ok) {
      const error = await response.text();
      log.error("browseForum", error);
      throw new Error(`Nia API error: ${error}`);
    }

    const data = await response.json();
    const result = {
      tree: data.tree_string,
      pageCount: data.page_count,
      baseUrl: data.base_url,
      sourceId: resolvedSourceId,
    };
    log.success("browseForum", `Found ${result.pageCount} pages`);
    log.response(result);
    return result;
  },
});

/**
 * Read the full content of a forum post/thread
 */
export const readForumPost = tool({
  description:
    "Read the full content of a specific forum post or thread. Use after searchForum or browseForum to get complete context.",
  inputSchema: z.object({
    path: z
      .string()
      .describe("Virtual path to read. Get paths from browseForum or search results."),
    sourceId: z
      .string()
      .optional()
      .describe("Optional: specific source ID (defaults to first configured source)"),
  }),
  execute: async ({ path, sourceId }) => {
    const resolvedSourceId = sourceId || getDefaultForumSource();
    log.tool("readForumPost", { path, sourceId: resolvedSourceId });
    const params = new URLSearchParams({ path });
    const response = await niaFetch(
      `/data-sources/${encodeURIComponent(resolvedSourceId)}/read?${params.toString()}`
    );

    if (!response.ok) {
      const error = await response.text();
      log.error("readForumPost", error);
      throw new Error(`Nia API error: ${error}`);
    }

    const data = await response.json();
    const result = {
      path: data.path,
      url: data.url,
      content: data.content,
      metadata: data.metadata,
      sourceId: resolvedSourceId,
    };
    const contentLength = result.content?.length || 0;
    log.success("readForumPost", `Read ${contentLength} chars from ${path}`);
    return result;
  },
});

/**
 * Search forum using pattern matching
 */
export const grepForum = tool({
  description:
    "Search the Cursor forum using pattern matching. Use for exact terms, error messages, usernames, or specific text patterns.",
  inputSchema: z.object({
    pattern: z
      .string()
      .describe("Regex pattern to search for (e.g., 'keybinding', 'error message', '@username')"),
    path: z
      .string()
      .default("/")
      .describe("Limit search to this virtual path prefix"),
    sourceId: z
      .string()
      .optional()
      .describe("Optional: specific source ID (defaults to first configured source)"),
    contextLines: z
      .number()
      .min(0)
      .max(10)
      .optional()
      .describe("Lines before AND after each match (default: 3)"),
    linesAfter: z
      .number()
      .min(0)
      .max(20)
      .optional()
      .describe("Lines after each match (like grep -A). Overrides contextLines for after."),
    linesBefore: z
      .number()
      .min(0)
      .max(20)
      .optional()
      .describe("Lines before each match (like grep -B). Overrides contextLines for before."),
    caseSensitive: z
      .boolean()
      .default(false)
      .describe("Case-sensitive matching (default is case-insensitive)"),
    wholeWord: z
      .boolean()
      .default(false)
      .describe("Match whole words only"),
    fixedString: z
      .boolean()
      .default(false)
      .describe("Treat pattern as literal string, not regex"),
    maxMatchesPerFile: z
      .number()
      .min(1)
      .max(100)
      .default(10)
      .describe("Maximum matches to return per file"),
    maxTotalMatches: z
      .number()
      .min(1)
      .max(1000)
      .default(100)
      .describe("Maximum total matches to return"),
    outputMode: z
      .enum(["content", "files_with_matches", "count"])
      .default("content")
      .describe("Output format: content (matched lines), files_with_matches (file paths only), count (match counts)"),
    highlight: z
      .boolean()
      .default(false)
      .describe("Add >>markers<< around matched text in results"),
    exhaustive: z
      .boolean()
      .default(true)
      .describe("Search ALL chunks for complete results (true = like real grep, false = faster BM25 pre-filter)"),
  }),
  execute: async ({
    pattern,
    path,
    sourceId,
    contextLines,
    linesAfter,
    linesBefore,
    caseSensitive,
    wholeWord,
    fixedString,
    maxMatchesPerFile,
    maxTotalMatches,
    outputMode,
    highlight,
    exhaustive,
  }) => {
    const resolvedSourceId = sourceId || getDefaultForumSource();
    log.tool("grepForum", { pattern, path, sourceId: resolvedSourceId, outputMode, exhaustive });

    // Build request body, only including defined values
    const requestBody: Record<string, unknown> = {
      pattern,
      context_lines: contextLines ?? 3,
    };

    if (path) requestBody.path = path;
    if (linesAfter !== undefined) requestBody.A = linesAfter;
    if (linesBefore !== undefined) requestBody.B = linesBefore;
    if (caseSensitive !== undefined) requestBody.case_sensitive = caseSensitive;
    if (wholeWord !== undefined) requestBody.whole_word = wholeWord;
    if (fixedString !== undefined) requestBody.fixed_string = fixedString;
    if (maxMatchesPerFile !== undefined) requestBody.max_matches_per_file = maxMatchesPerFile;
    if (maxTotalMatches !== undefined) requestBody.max_total_matches = maxTotalMatches;
    if (outputMode) requestBody.output_mode = outputMode;
    if (highlight !== undefined) requestBody.highlight = highlight;
    if (exhaustive !== undefined) requestBody.exhaustive = exhaustive;

    const response = await niaFetch(`/data-sources/${encodeURIComponent(resolvedSourceId)}/grep`, {
      method: "POST",
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      log.error("grepForum", error);
      throw new Error(`Nia API error: ${error}`);
    }

    const data = await response.json();
    const result = {
      matches: data.matches,
      files: data.files,
      counts: data.counts,
      pattern: data.pattern,
      pathFilter: data.path_filter,
      totalMatches: data.total_matches,
      filesSearched: data.files_searched,
      filesWithMatches: data.files_with_matches,
      truncated: data.truncated,
      options: data.options,
      sourceId: resolvedSourceId,
    };
    log.success("grepForum", `Found ${result.totalMatches} matches in ${result.filesWithMatches || result.filesSearched} files`);
    log.response(result);
    return result;
  },
});

/**
 * Web search for additional context
 */
export const webSearch = tool({
  description:
    "Search the web for additional context not available in the indexed forum. Use sparingly - prefer searchForum first.",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
    numResults: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Number of results to return"),
    category: z
      .enum(["github", "company", "research", "news", "tweet", "pdf", "blog"])
      .optional()
      .describe("Filter by content category"),
    daysBack: z
      .number()
      .optional()
      .describe("Limit results to the last N days (recency filter)"),
    findSimilarTo: z
      .string()
      .optional()
      .describe("URL to find similar content to"),
  }),
  execute: async ({ query, numResults, category, daysBack, findSimilarTo }) => {
    log.tool("webSearch", { query, numResults, category, daysBack, findSimilarTo });
    const response = await niaFetch("/search/web", {
      method: "POST",
      body: JSON.stringify({
        query,
        num_results: numResults,
        ...(category && { category }),
        ...(daysBack !== undefined && { days_back: daysBack }),
        ...(findSimilarTo && { find_similar_to: findSimilarTo }),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      log.error("webSearch", error);
      throw new Error(`Nia API error: ${error}`);
    }

    const data = await response.json();
    const resultsCount = (data.github_repos?.length || 0) + (data.documentation?.length || 0) + (data.other_content?.length || 0);
    log.success("webSearch", `Found ${resultsCount} web results`);
    log.response(data);
    return data;
  },
});

/**
 * Get full content by path (from search results)
 */
export const getSourceContent = tool({
  description:
    "Retrieve the full content of a specific page from the forum. Use this when you have a path from searchForum results.",
  inputSchema: z.object({
    path: z
      .string()
      .describe("The virtual path (from search results or browseForum)"),
    sourceId: z
      .string()
      .optional()
      .describe("Optional: specific source ID (defaults to first configured source)"),
  }),
  execute: async ({ path, sourceId }) => {
    const resolvedSourceId = sourceId || getDefaultForumSource();
    log.tool("getSourceContent", { path, sourceId: resolvedSourceId });

    const params = new URLSearchParams({ path });
    const response = await niaFetch(
      `/data-sources/${encodeURIComponent(resolvedSourceId)}/read?${params.toString()}`
    );

    if (!response.ok) {
      const error = await response.text();
      log.error("getSourceContent", error);
      throw new Error(`Nia API error: ${error}`);
    }

    const data = await response.json();
    const contentLength = data.content?.length || 0;
    log.success("getSourceContent", `Retrieved ${contentLength} chars from ${path}`);
    return {
      success: data.success,
      path: data.path,
      url: data.url,
      content: data.content,
      metadata: data.metadata,
    };
  },
});

// Export all tools as a single object for easy use
export const niaCursorTools = {
  searchForum,
  browseForum,
  readForumPost,
  grepForum,
  webSearch,
  getSourceContent,
};
