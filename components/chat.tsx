"use client";

import { useChat } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { ModelSelector } from "@/components/model-selector";
import {
  ArrowUpIcon,
  SearchIcon,
  FileTextIcon,
  GlobeIcon,
  CopyIcon,
  CheckIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  FolderTreeIcon,
  PaperclipIcon,
  XIcon,
  ImageIcon,
  Loader2Icon,
  MessageSquareIcon,
} from "lucide-react";
import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import type { UIMessage } from "@ai-sdk/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";
import { DEFAULT_MODEL, type SupportedModel } from "@/lib/constants";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";

function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("rate limit") ||
    message.includes("503") ||
    message.includes("429") ||
    message.includes("fetch failed")
  );
}

function AgentProgress({ 
  currentStep, 
  maxSteps, 
  currentTool, 
  onStop 
}: { 
  currentStep: number; 
  maxSteps: number; 
  currentTool: string | null;
  onStop: () => void;
}) {
  if (currentStep === 0) return null;
  
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground px-4 py-3 bg-card border border-border rounded-lg">
      <Loader2Icon className="h-4 w-4 animate-spin text-chart-1" />
      <span>Step {currentStep}/{maxSteps}</span>
      {currentTool && (
        <span className="text-muted-foreground/70">· {currentTool}</span>
      )}
      <button
        onClick={onStop}
        className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Stop
      </button>
    </div>
  );
}

const toolIcons: Record<string, React.ReactNode> = {
  searchForum: <SearchIcon className="h-3.5 w-3.5" />,
  browseForum: <FolderTreeIcon className="h-3.5 w-3.5" />,
  readForumPost: <FileTextIcon className="h-3.5 w-3.5" />,
  grepForum: <SearchIcon className="h-3.5 w-3.5" />,
  getSourceContent: <FileTextIcon className="h-3.5 w-3.5" />,
  webSearch: <GlobeIcon className="h-3.5 w-3.5" />,
};

const toolDisplayNames: Record<string, string> = {
  searchForum: "Searching forum",
  browseForum: "Browsing forum",
  readForumPost: "Reading post",
  grepForum: "Pattern search",
  getSourceContent: "Loading content",
  webSearch: "Web search",
};

function ToolInvocation({ toolType, toolName, state, input }: { 
  toolType: string;
  toolName?: string;
  state?: string;
  input?: unknown;
}) {
  const resolvedToolName = toolName || toolType.replace("tool-", "");
  const displayName = toolDisplayNames[resolvedToolName] || resolvedToolName;
  const defaultIcon = <SearchIcon className="h-3.5 w-3.5" />;
  const icon: React.ReactNode = resolvedToolName in toolIcons ? toolIcons[resolvedToolName] : defaultIcon;
  
  const inputObj = input as Record<string, unknown> | undefined;
  const rawContext = inputObj?.query || inputObj?.path || inputObj?.pattern;
  const inputContext = rawContext ? String(rawContext) : null;

  const isComplete = state === "output-available";

  return (
    <div className={cn(
      "flex items-center gap-2 text-sm py-2 px-3 rounded-md my-2",
      isComplete ? "bg-card border border-border" : "bg-card/50 border border-border/50"
    )}>
      <span className={cn(
        "shrink-0",
        isComplete ? "text-chart-1" : "text-muted-foreground animate-pulse"
      )}>
        {icon}
      </span>
      <span className={cn(
        "font-medium",
        isComplete ? "text-foreground" : "text-muted-foreground"
      )}>
        {displayName}
      </span>
      {inputContext && (
        <span className="text-muted-foreground/60 truncate max-w-[250px] text-sm">
          {inputContext}
        </span>
      )}
      {isComplete && (
        <CheckIcon className="h-3.5 w-3.5 text-green-500 ml-auto shrink-0" />
      )}
    </div>
  );
}

function MessageActions({ message, feedback, onFeedback }: { 
  message: UIMessage;
  feedback: "like" | "dislike" | null;
  onFeedback: (type: "like" | "dislike") => void;
}) {
  const [copied, setCopied] = useState(false);

  const getTextContent = () => {
    return message.parts
      .filter((part) => part.type === "text")
      .map((part) => (part as { type: "text"; text: string }).text)
      .join("\n");
  };

  const handleCopy = async () => {
    const text = getTextContent();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
      <button
        onClick={handleCopy}
        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="Copy"
      >
        {copied ? <CheckIcon className="h-4 w-4 text-green-500" /> : <CopyIcon className="h-4 w-4" />}
      </button>
      <button
        onClick={() => onFeedback("like")}
        className={cn(
          "p-1.5 rounded transition-colors",
          feedback === "like" 
            ? "text-green-500 bg-green-500/10" 
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
        title="Helpful"
      >
        <ThumbsUpIcon className="h-4 w-4" />
      </button>
      <button
        onClick={() => onFeedback("dislike")}
        className={cn(
          "p-1.5 rounded transition-colors",
          feedback === "dislike" 
            ? "text-red-500 bg-red-500/10" 
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
        title="Not helpful"
      >
        <ThumbsDownIcon className="h-4 w-4" />
      </button>
      <span className="ml-auto text-xs text-muted-foreground/60">
        via <a href="https://trynia.ai" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors">Nia</a>
      </span>
    </div>
  );
}

export function Chat() {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<SupportedModel>(DEFAULT_MODEL);
  const [feedbacks, setFeedbacks] = useState<Record<string, "like" | "dislike" | null>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  
  const [currentStep, setCurrentStep] = useState(0);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const MAX_AGENT_STEPS = 20;

  const { messages, error, sendMessage, regenerate, setMessages, stop, status } = useChat({
    experimental_throttle: 50,
    
    onError: (error) => {
      console.error("Chat error:", error);
      
      if (retryCount < MAX_RETRIES && isRetryableError(error)) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => {
          setRetryCount((prev) => prev + 1);
          regenerate();
        }, delay);
      }
    },
    
    onFinish: ({ message }) => {
      setRetryCount(0);
      setCurrentStep(0);
      setCurrentTool(null);

      console.log("Message completed:", {
        id: message?.id,
        partsCount: message?.parts?.length ?? 0,
      });
    },
  });

  useEffect(() => {
    if (status === "streaming" && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "assistant" && lastMessage.parts) {
        const toolParts = lastMessage.parts.filter((p) => 
          p.type.startsWith("tool-")
        );
        setCurrentStep(toolParts.length);
        
        const lastToolPart = toolParts[toolParts.length - 1] as { 
          type: string; 
          toolName?: string;
          state?: string;
        } | undefined;
        
        if (lastToolPart && lastToolPart.state !== "output-available") {
          const toolName = lastToolPart.toolName || lastToolPart.type.replace("tool-", "");
          setCurrentTool(toolDisplayNames[toolName] || toolName);
        } else {
          setCurrentTool(null);
        }
      }
    }
  }, [messages, status]);

  const handleFeedback = (messageId: string, type: "like" | "dislike") => {
    setFeedbacks((prev) => ({
      ...prev,
      [messageId]: prev[messageId] === type ? null : type,
    }));
  };

  const hasMessages = messages.length > 0;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleNewChat = () => {
    stop();
    setMessages([]);
    setInput("");
  };

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !files?.length) return;

    sendMessage(
      {
        text: input,
        files,
      },
      { body: { model: selectedModel } }
    );
    
    setInput("");
    setFiles(undefined);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(e.target.files);
    }
  };
  
  const removeFiles = () => {
    setFiles(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const suggestionQueries = [
    { label: "Feature requests", query: "What are the most requested features for Cursor?" },
    { label: "Setup guides", query: "How do I configure Cursor for Python development?" },
    { label: "Keyboard shortcuts", query: "What keyboard shortcuts are most useful in Cursor?" },
  ];

  return (
    <div className="relative flex flex-col h-[100dvh] overflow-hidden bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Image
              src="/cursor.png"
              alt="Cursor"
              width={28}
              height={28}
              className="rounded-md"
              priority
            />
            <span className="font-semibold text-foreground">Forum Search</span>
          </button>
          <div className="flex items-center gap-2">
            {hasMessages && (
              <button
                onClick={handleNewChat}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
              >
                <MessageSquareIcon className="h-4 w-4" />
                <span className="hidden sm:inline">New</span>
              </button>
            )}
            <a
              href="https://forum.cursor.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
            >
              Forum →
            </a>
          </div>
        </div>
      </header>

      {/* Empty State */}
      {!hasMessages && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 animate-fade-in">
          <div className="w-full max-w-2xl space-y-8">
            {/* Hero */}
            <div className="text-center space-y-4">
              <a
                href="https://trynia.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Powered by Nia
              </a>
              <h1 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
                Search Cursor Forum
              </h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                Find answers from feature discussions, troubleshooting threads, and community knowledge.
              </p>
            </div>

            {/* Search Input */}
            <form onSubmit={handleSubmit}>
              <div className="relative bg-card border border-border rounded-xl transition-colors focus-within:border-muted-foreground/50">
                {files && files.length > 0 && (
                  <div className="px-4 pt-3 flex flex-wrap gap-2">
                    {Array.from(files).map((file, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-2 px-2 py-1 bg-accent rounded text-sm"
                      >
                        {file.type.startsWith('image/') ? (
                          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <FileTextIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        <button
                          type="button"
                          onClick={removeFiles}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  name="prompt"
                  placeholder="Ask anything about Cursor..."
                  onChange={(e) => setInput(e.target.value)}
                  value={input}
                  autoFocus
                  rows={1}
                  className={cn(
                    "w-full resize-none bg-transparent px-4 pb-14 text-base placeholder:text-muted-foreground/50 focus:outline-none min-h-[56px] max-h-[200px]",
                    files && files.length > 0 ? "pt-2" : "pt-4"
                  )}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,text/*,.pdf,.txt,.md,.csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach files"
                    >
                      <PaperclipIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    type="submit"
                    size="icon"
                    className={cn(
                      "h-8 w-8 rounded-md transition-all",
                      (input.trim() || files?.length)
                        ? "bg-foreground text-background hover:bg-foreground/90" 
                        : "bg-accent text-muted-foreground cursor-not-allowed"
                    )}
                    disabled={!input.trim() && !files?.length}
                  >
                    <ArrowUpIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </form>

            {/* Suggestions */}
            <div className="flex flex-wrap justify-center gap-2">
              {suggestionQueries.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setInput(suggestion.query)}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground bg-card border border-border rounded-lg hover:border-muted-foreground/30 transition-colors"
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {hasMessages && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "animate-fade-in",
                  m.role === "user" && "flex justify-end"
                )}
              >
                {m.role === "user" ? (
                  <div className="bg-foreground text-background rounded-2xl rounded-br-md px-4 py-3 max-w-[85%] text-[15px]">
                    {m.parts?.map((part, i) => {
                      if (part.type === "text") {
                        return <span key={`${m.id}-${i}`}>{part.text}</span>;
                      }
                      if (part.type === "file") {
                        const filePart = part as { type: "file"; url: string; mediaType?: string };
                        if (filePart.mediaType?.startsWith("image/")) {
                          return (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={`${m.id}-${i}`}
                              src={filePart.url}
                              alt="Attached"
                              className="max-w-[200px] rounded mt-2"
                            />
                          );
                        }
                        return (
                          <div key={`${m.id}-${i}`} className="flex items-center gap-2 text-sm mt-2 opacity-70">
                            <FileTextIcon className="h-4 w-4" />
                            <span>File attached</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {m.parts?.map((part, i) => {
                      switch (part.type) {
                        case "reasoning":
                          return (
                            <Reasoning 
                              key={`${m.id}-${i}`}
                              isStreaming={part.state === "streaming"}
                            >
                              <ReasoningTrigger />
                              <ReasoningContent>{part.text}</ReasoningContent>
                            </Reasoning>
                          );
                        case "text":
                          return (
                            <div key={`${m.id}-${i}`} className="prose prose-invert prose-sm max-w-none">
                              <Streamdown isAnimating={status === "streaming" && m.id === messages[messages.length - 1]?.id}>
                                {part.text}
                              </Streamdown>
                            </div>
                          );
                        default:
                          if (part.type.startsWith("tool-")) {
                            const toolPart = part as { type: string; toolName?: string; state?: string; input?: unknown };
                            return (
                              <ToolInvocation 
                                key={`${m.id}-${i}`} 
                                toolType={toolPart.type}
                                toolName={toolPart.toolName}
                                state={toolPart.state}
                                input={toolPart.input}
                              />
                            );
                          }
                          return null;
                      }
                    })}
                    {status !== "streaming" && (
                      <MessageActions 
                        message={m} 
                        feedback={feedbacks[m.id] || null}
                        onFeedback={(type) => handleFeedback(m.id, type)}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="max-w-4xl mx-auto w-full px-4 pb-4 animate-slide-down">
          <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                {error.message || "Something went wrong."}
                {retryCount > 0 && retryCount < MAX_RETRIES && (
                  <span className="text-xs ml-2 opacity-70">
                    Retrying... ({retryCount}/{MAX_RETRIES})
                  </span>
                )}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRetryCount(0);
                    setMessages([]);
                  }}
                >
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRetryCount(0);
                    regenerate();
                  }}
                >
                  Retry
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Input (when messages exist) */}
      {hasMessages && (
        <div className="shrink-0 border-t border-border bg-background">
          <div className="max-w-4xl mx-auto px-4 py-4 space-y-3">
            {status === "streaming" && currentStep > 0 && (
              <AgentProgress
                currentStep={currentStep}
                maxSteps={MAX_AGENT_STEPS}
                currentTool={currentTool}
                onStop={stop}
              />
            )}
            
            {retryCount > 0 && status === "streaming" && (
              <div className="flex items-center gap-2 text-sm text-amber-500 px-3 py-2 bg-amber-500/10 rounded-lg">
                <Loader2Icon className="h-4 w-4 animate-spin" />
                <span>Retry {retryCount}/{MAX_RETRIES}...</span>
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="relative bg-card border border-border rounded-xl transition-colors focus-within:border-muted-foreground/50">
                {files && files.length > 0 && (
                  <div className="px-4 pt-3 flex flex-wrap gap-2">
                    {Array.from(files).map((file, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-2 px-2 py-1 bg-accent rounded text-sm"
                      >
                        {file.type.startsWith('image/') ? (
                          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <FileTextIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        <button
                          type="button"
                          onClick={removeFiles}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  name="prompt"
                  placeholder="Ask a follow-up..."
                  onChange={(e) => setInput(e.target.value)}
                  value={input}
                  rows={1}
                  className={cn(
                    "w-full resize-none bg-transparent px-4 pb-12 text-base placeholder:text-muted-foreground/50 focus:outline-none min-h-[52px] max-h-[200px]",
                    files && files.length > 0 ? "pt-2" : "pt-3"
                  )}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach files"
                    >
                      <PaperclipIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    type="submit"
                    size="icon"
                    className={cn(
                      "h-8 w-8 rounded-md transition-all",
                      (input.trim() || files?.length)
                        ? "bg-foreground text-background hover:bg-foreground/90" 
                        : "bg-accent text-muted-foreground cursor-not-allowed"
                    )}
                    disabled={!input.trim() && !files?.length}
                  >
                    <ArrowUpIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer (empty state) */}
      {!hasMessages && (
        <footer className="shrink-0 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Powered by{" "}
            <a
              href="https://trynia.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
            >
              Nia
            </a>
            {" · "}
            <a
              href="https://forum.cursor.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
            >
              Cursor Forum
            </a>
          </p>
        </footer>
      )}
    </div>
  );
}
