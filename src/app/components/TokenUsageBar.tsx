"use client";

import React from "react";
import { getContextWindow } from "@/lib/gemini";

interface TokenUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  model: string;
}

interface TokenUsageBarProps {
  usage: TokenUsage | null;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toString();
}

export default function TokenUsageBar({ usage }: TokenUsageBarProps) {
  if (!usage) return null;

  const contextWindow = getContextWindow(usage.model);
  const percent = Math.min((usage.totalTokenCount / contextWindow) * 100, 100);

  // Kolor paska zależy od zużycia
  const barColor =
    percent >= 90
      ? "bg-red-500"
      : percent >= 70
      ? "bg-amber-400"
      : percent >= 40
      ? "bg-blue-400"
      : "bg-emerald-400";

  const textColor =
    percent >= 90
      ? "text-red-500 dark:text-red-400"
      : percent >= 70
      ? "text-amber-500 dark:text-amber-400"
      : "text-zinc-400 dark:text-zinc-500";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-1">
      <div className="flex items-center justify-between mb-0.5">
        <span className={`text-[11px] tabular-nums ${textColor}`}>
          {formatTokens(usage.totalTokenCount)}
          <span className="text-zinc-300 dark:text-zinc-600"> / {formatTokens(contextWindow)}</span>
          <span className="ml-1 text-zinc-400 dark:text-zinc-600">tokenów</span>
        </span>
        <span className={`text-[11px] tabular-nums font-medium ${textColor}`}>
          {percent.toFixed(1)}%
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {percent >= 90 && (
        <p className="mt-0.5 text-[10px] text-red-500 dark:text-red-400">
          ⚠ Okno kontekstowe prawie pełne — zacznij nową rozmowę
        </p>
      )}
    </div>
  );
}
