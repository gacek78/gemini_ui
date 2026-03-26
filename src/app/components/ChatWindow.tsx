"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Bot, Loader2, Square, Copy, Check, ChevronDown } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import MessageInput from "./MessageInput";
import CodeBlock from "./CodeBlock";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id?: string;
  role: "user" | "model" | "system";
  content: string;
  metadata?: any;
}

interface ChatWindowProps {
  conversationId: string | null;
  onMessageSent: () => void;
}

export default function ChatWindow({ conversationId, onMessageSent }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages([]);
    if (conversationId) {
      fetchMessages();
    }
  }, [conversationId]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        const offset = 100; // tolerance
        const bottom = scrollHeight - scrollTop - clientHeight < offset;
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
      if (res.ok) {
        setMessages(await res.json());
      }
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

  const handleSendMessage = async (content: string, image?: { data: string; mimeType: string }) => {
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
        body: JSON.stringify({
          conversationId,
          messages: [...messages, userMessage],
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const reader = res.body?.getReader();
      let assistantContent = "";
      const assistantMessage: Message = { role: "model", content: "" };
      setMessages((prev) => [...prev, assistantMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const text = new TextDecoder().decode(value);
          
          if (text.startsWith("__METADATA__:")) {
            try {
               const metaStr = text.replace("__METADATA__:", "").split('\n')[0].trim();
               const metadata = JSON.parse(metaStr);
               assistantMessage.metadata = metadata;
               setMessages((prev: any) => {
                 const newMessages = [...prev];
                 newMessages[newMessages.length - 1].metadata = metadata;
                 return newMessages;
               });
               continue;
            } catch (e) {
               console.error("Metadata parse error", e);
            }
          }

          assistantContent += text;
          
          setMessages((prev: any) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
                ...newMessages[newMessages.length - 1],
                role: "model",
                content: assistantContent
            };
            return newMessages;
          });
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Generation stopped by user");
      } else {
        console.error("Chat Error:", error);
        setMessages((prev) => [
          ...prev,
          { role: "model", content: `**Error:** ${error.message}` },
        ]);
      }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
        onMessageSent(); // Odśwież pasek boczny (dla zmiany tytułu)
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
            <img 
              src={`data:${parsed.image.mimeType};base64,${parsed.image.data}`} 
              alt="Przesłany obraz" 
              className="max-h-64 rounded-xl object-contain shadow-sm"
            />
            <MarkdownContent content={parsed.text} />
          </div>
        );
      }
      if (parsed.metadata) {
          contentToRender = parsed.text;
          metadata = parsed.metadata;
      }
    } catch {
      // Not JSON
    }

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
            <CodeBlock
              language={match[1]}
              value={String(children).replace(/\n$/, "")}
              {...props}
            />
          ) : (
            <code className={cn("rounded bg-zinc-100 px-1 py-0.5 font-mono text-sm dark:bg-zinc-800", className)} {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );

  const renderSources = (metadata: any) => {
    if (!metadata?.groundingChunks) return null;
    return (
      <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Źródła:</h4>
        <div className="flex flex-wrap gap-2">
          {metadata.groundingChunks.map((chunk: any, idx: number) => (
            chunk.web && (
                <a 
                  key={idx}
                  href={chunk.web.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-[11px] text-blue-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-blue-400 dark:hover:bg-zinc-700"
                >
                  <span className="max-w-[150px] truncate">{chunk.web.title}</span>
                </a>
            )
          ))}
        </div>
      </div>
    );
  };

  if (!conversationId) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-10 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 dark:bg-zinc-800/50">
          <Bot className="h-10 w-10 text-blue-500" />
        </div>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Witaj w Gemini UI</h2>
        <p className="mt-2 max-w-sm text-zinc-500 dark:text-zinc-400">
          Wybierz rozmowę z bocznego paska lub stwórz nową, aby zacząć.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-black">
      {/* Messages area */}
      <div 
        ref={scrollRef} 
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-8 md:px-10"
      >
        <div className="mx-auto max-w-4xl space-y-8">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-4 group relative",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-zinc-600 transition-all",
                  msg.role === "user"
                    ? "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                    : "border-blue-100 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-400"
                )}
              >
                {msg.role === "user" ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
              </div>
              <div
                className={cn(
                  "prose prose-sm max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed dark:prose-invert relative",
                  msg.role === "user"
                    ? "bg-zinc-100 dark:bg-zinc-800"
                    : "bg-transparent border border-transparent dark:border-transparent"
                )}
              >
                {renderMessageContent(msg)}
                {msg.role === "model" && msg.content === "" && (
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                )}
                
                {/* Copy Button for Message */}
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
      </div>

      {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-32 right-8 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-xl transition-all hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <ChevronDown className="h-5 w-5 text-zinc-500" />
          </button>
      )}

      {/* Input area */}
      <div className="relative flex flex-col items-center justify-center p-4">
        {isLoading && (
            <button
                onClick={handleStopGeneration}
                className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
                <Square className="h-4 w-4 fill-current" />
                Zatrzymaj generowanie
            </button>
        )}
        <MessageInput onSend={handleSendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
