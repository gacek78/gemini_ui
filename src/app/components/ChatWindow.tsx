"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Bot, Loader2, Square, Copy, Check, ChevronDown, Download } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import MessageInput from "./MessageInput";
import CodeBlock from "./CodeBlock";
import TokenUsageBar from "./TokenUsageBar";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id?: string;
  role: "user" | "model" | "system";
  content: string;
  metadata?: any;
}

interface TokenUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  model: string;
}

interface ChatWindowProps {
  conversationId: string | null;
  onMessageSent: () => void;
  maxOutputTokens: number;
}

export default function ChatWindow({ conversationId, onMessageSent, maxOutputTokens }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages([]);
    setTokenUsage(null);
    if (conversationId) fetchMessages();
  }, [conversationId]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const bottom = scrollHeight - scrollTop - clientHeight < 100;
      isAtBottom.current = bottom;
      setShowScrollButton(!bottom);
    }
  };

  useEffect(() => {
    if (isAtBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const copyMessage = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (res.ok) setMessages(await res.json());
    } catch (error) {
      console.error("Failed to fetch messages");
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  // Eksport rozmowy do pliku .md
  const handleExport = () => {
    if (!messages.length) return;
    const lines = messages.map((msg) => {
      const role = msg.role === "user" ? "## Ty" : "## Gemini";
      let content = msg.content;
      try {
        const p = JSON.parse(content);
        if (p.text) content = p.text;
      } catch {}
      return `${role}\n\n${content}`;
    });
    const md = lines.join("\n\n---\n\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rozmowa-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
  };

  const handleSendMessage = async (
    content: string,
    image?: { data: string; mimeType: string }
  ) => {
    if (!conversationId) return;

    const userMessage: any = { role: "user", content };
    if (image) {
      userMessage.image = image;
      userMessage.dbContent = JSON.stringify({ text: content, image });
    } else {
      userMessage.dbContent = content;
    }

    setMessages((prev: any) => [...prev, userMessage]);
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, messages: [...messages, userMessage] }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const reader = res.body?.getReader();
      let assistantContent = "";
      setMessages((prev) => [...prev, { role: "model", content: "" }]);

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            let text = new TextDecoder().decode(value);

            const metaRegex = /__METADATA__:(.+?)\n/g;
            let metaMatch;
            while ((metaMatch = metaRegex.exec(text)) !== null) {
              try {
                const metadata = JSON.parse(metaMatch[1]);
                setMessages((prev: any) => {
                  const n = [...prev];
                  n[n.length - 1].metadata = metadata;
                  return n;
                });
              } catch (e) {}
            }
            text = text.replace(/__METADATA__:.+?\n/g, "");

            const tokenRegex = /__TOKENS__:(.+?)\n/g;
            let tokenMatch;
            while ((tokenMatch = tokenRegex.exec(text)) !== null) {
              try { setTokenUsage(JSON.parse(tokenMatch[1])); } catch (e) {}
            }
            text = text.replace(/__TOKENS__:.+?\n/g, "");

            if (text.startsWith('{"error":')) {
              try {
                const errorData = JSON.parse(text);
                throw new Error(errorData.error || "Server error");
              } catch (e: any) {
                if (e.message !== "Server error") { /* not json */ } else throw e;
              }
            }

            if (text) {
              assistantContent += text;
              setMessages((prev: any) => {
                const n = [...prev];
                n[n.length - 1] = { ...n[n.length - 1], role: "model", content: assistantContent };
                return n;
              });
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Chat Error:", error);
        setMessages((prev) => [...prev, { role: "model", content: `**Error:** ${error.message}` }]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      onMessageSent();
    }
  };

  const renderMessageContent = (msg: Message) => {
    let contentToRender = msg.content;
    let metadata = msg.metadata;
    try {
      const parsed = JSON.parse(msg.content);
      if (parsed.image) {
        return (
          <div className="space-y-4">
            <img src={`data:${parsed.image.mimeType};base64,${parsed.image.data}`} alt="Przesłany obraz" className="max-h-64 rounded-xl object-contain shadow-sm" />
            <MarkdownContent content={parsed.text} />
          </div>
        );
      }
      if (parsed.metadata) { contentToRender = parsed.text; metadata = parsed.metadata; }
    } catch {}
    return (
      <div className="space-y-4">
        <MarkdownContent content={contentToRender} />
        {metadata && renderSources(metadata)}
      </div>
    );
  };

  const MarkdownContent = ({ content }: { content: string }) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || "");
          return !inline && match ? (
            <CodeBlock language={match[1]} value={String(children).replace(/\n$/, "")} {...props} />
          ) : (
            <code className={cn("rounded bg-zinc-100 px-1 py-0.5 font-mono text-sm dark:bg-zinc-800", className)} {...props}>{children}</code>
          );
        },
      }}
    >{content}</ReactMarkdown>
  );

  const renderSources = (metadata: any) => {
    if (!metadata?.groundingChunks) return null;
    return (
      <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Źródła:</h4>
        <div className="flex flex-wrap gap-2">
          {metadata.groundingChunks.map((chunk: any, idx: number) =>
            chunk.web ? (
              <a key={idx} href={chunk.web.uri} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-[11px] text-blue-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-blue-400 dark:hover:bg-zinc-700">
                <span className="max-w-[150px] truncate">{chunk.web.title}</span>
              </a>
            ) : null
          )}
        </div>
      </div>
    );
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-black">
      {/* Pasek narzędzi czatu */}
      {!isEmpty && (
        <div className="flex items-center justify-end px-4 py-2 border-b border-zinc-100 dark:border-zinc-800">
          <button
            onClick={handleExport}
            title="Eksportuj rozmowę do .md"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-all"
          >
            <Download className="h-3.5 w-3.5" />
            Eksportuj .md
          </button>
        </div>
      )}

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-8 md:px-10">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-zinc-800/60">
              <Bot className="h-8 w-8 text-blue-500" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">W czym mogę Ci pomóc?</h2>
            <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">Napisz wiadomość, aby rozpocząć rozmowę.</p>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-8">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-4 group relative", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-zinc-600 transition-all",
                  msg.role === "user"
                    ? "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                    : "border-blue-100 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-400"
                )}>
                  {msg.role === "user" ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                </div>
                <div className={cn(
                  "prose prose-sm max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed dark:prose-invert relative",
                  msg.role === "user" ? "bg-zinc-100 dark:bg-zinc-800" : "bg-transparent"
                )}>
                  {renderMessageContent(msg)}
                  {msg.role === "model" && msg.content === "" && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
                  <button
                    onClick={() => copyMessage(msg.content, i)}
                    className={cn(
                      "absolute -right-10 top-2 p-2 text-zinc-400 opacity-0 transition-opacity hover:text-zinc-600 group-hover:opacity-100 dark:text-zinc-600 dark:hover:text-zinc-400",
                      msg.role === "user" && "-left-10 right-auto"
                    )}
                    title="Kopiuj wiadomość"
                  >
                    {copiedId === i ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-32 right-8 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-xl hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          <ChevronDown className="h-5 w-5 text-zinc-500" />
        </button>
      )}

      <div className="relative flex flex-col items-center justify-center p-4">
        {isLoading && (
          <button
            onClick={handleStopGeneration}
            className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Square className="h-4 w-4 fill-current" /> Zatrzymaj generowanie
          </button>
        )}
        <TokenUsageBar usage={tokenUsage} maxOutputTokens={maxOutputTokens} />
        <MessageInput onSend={handleSendMessage} disabled={isLoading || !conversationId} />
      </div>
    </div>
  );
}
