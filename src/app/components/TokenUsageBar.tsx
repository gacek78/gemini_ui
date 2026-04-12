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
  maxOutputTokens?: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toString();
}

export default function TokenUsageBar({ usage, maxOutputTokens }: TokenUsageBarProps) {
  if (!usage) return null;

  const contextWindow = getContextWindow(usage.model);
  const contextPercent = Math.min((usage.totalTokenCount / contextWindow) * 100, 100);

  // Procent wykorzystania max output tokens (jeśli podane)
  const outputPercent = maxOutputTokens
    ? Math.min((usage.candidatesTokenCount / maxOutputTokens) * 100, 100)
    : null;

  const contextColor =
    contextPercent >= 90 ? "bg-red-500" :
    contextPercent >= 70 ? "bg-amber-400" :
    contextPercent >= 40 ? "bg-blue-400" : "bg-emerald-400";

  const outputColor =
    outputPercent !== null && outputPercent >= 90 ? "bg-red-500" :
    outputPercent !== null && outputPercent >= 70 ? "bg-amber-400" : "bg-violet-400";

  const textColor =
    contextPercent >= 90 ? "text-red-500 dark:text-red-400" :
    contextPercent >= 70 ? "text-amber-500 dark:text-amber-400" :
    "text-zinc-400 dark:text-zinc-500";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-1 space-y-1.5">
      {/* Pasek kontekstu */}
      <div>
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-[11px] tabular-nums ${textColor}`}>
            Kontekst: {formatTokens(usage.totalTokenCount)}
            <span className="text-zinc-300 dark:text-zinc-600"> / {formatTokens(contextWindow)}</span>
          </span>
          <span className={`text-[11px] tabular-nums font-medium ${textColor}`}>{contextPercent.toFixed(1)}%</span>
        </div>
        <div className="h-1 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${contextColor}`} style={{ width: `${contextPercent}%` }} />
        </div>
      </div>

      {/* Pasek output tokens */}
      {outputPercent !== null && (
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
              Odpowiedź: {formatTokens(usage.candidatesTokenCount)}
              <span className="text-zinc-300 dark:text-zinc-600"> / {formatTokens(maxOutputTokens!)}</span>
            </span>
            <span className="text-[11px] tabular-nums text-zinc-400">{outputPercent.toFixed(1)}%</span>
          </div>
          <div className="h-1 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${outputColor}`} style={{ width: `${outputPercent}%` }} />
          </div>
        </div>
      )}

      {contextPercent >= 90 && (
        <p className="text-[10px] text-red-500 dark:text-red-400">⚠ Okno kontekstowe prawie pełne — zacznij nową rozmowę</p>
      )}
    </div>
  );
}
