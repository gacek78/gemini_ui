"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Paperclip, X, Image as ImageIcon } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MessageInputProps {
  onSend: (message: string, image?: { data: string; mimeType: string }) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [image, setImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if ((content.trim() || image) && !disabled) {
      onSend(content.trim(), image ? { data: image.data, mimeType: image.mimeType } : undefined);
      setContent("");
      setImage(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = (event.target?.result as string).split(",")[1];
        setImage({
          data: base64Data,
          mimeType: file.type,
          preview: event.target?.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [content]);

  return (
    <div className="relative flex w-full max-w-4xl flex-col items-center gap-2 p-4 pt-0">
      {/* Image Preview */}
      {image && (
        <div className="relative flex w-full max-w-4xl px-2 py-2">
            <div className="group relative h-20 w-20 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                <img src={image.preview} alt="Podgląd" className="h-full w-full object-cover" />
                <button 
                    onClick={() => setImage(null)}
                    className="absolute right-1 top-1 rounded-full bg-black/50 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                    <X className="h-3 w-3" />
                </button>
            </div>
        </div>
      )}

      <div className="relative flex w-full items-end gap-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg transition-all focus-within:border-blue-500/50 focus-within:ring-4 focus-within:ring-blue-500/10 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
        <textarea
          ref={textareaRef}
          rows={1}
          disabled={disabled}
          placeholder="Zadaj pytanie Gemini..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="max-h-[200px] w-full resize-none border-none bg-transparent px-3 py-2 text-sm outline-none dark:text-zinc-100"
        />
        <button
          onClick={handleSend}
          disabled={disabled || (!content.trim() && !image)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
            (content.trim() || image) && !disabled
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
        <Sparkles className="h-3 w-3" />
        <span>Gemini może się mylić. Sprawdź ważne informacje.</span>
      </div>
    </div>
  );
}
