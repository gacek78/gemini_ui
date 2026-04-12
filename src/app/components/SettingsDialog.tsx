"use client";

import React, { useState, useEffect } from "react";
import { Settings, X, Save, Key, Info, Sparkles, Sun, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Max output tokens per model
const MODEL_MAX_TOKENS: Record<string, number> = {
  "gemini-3.1-pro-preview":       65536,
  "gemini-3-flash-preview":        65536,
  "gemini-3.1-flash-lite-preview": 65536,
  "gemini-2.5-flash":              65536,
  "gemini-2.5-pro":                65536,
  "gemini-2.5-flash-lite":         32768,
  "gemini-2.0-flash":              8192,
};

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess?: () => void;
}

export default function SettingsDialog({ isOpen, onClose, onSaveSuccess }: SettingsDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxOutputTokens, setMaxOutputTokens] = useState(8192);
  const [modelName, setModelName] = useState("gemini-3-flash-preview");
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("system");
  const [systemInstruction, setSystemInstruction] = useState("");
  const [useGrounding, setUseGrounding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");

  const maxTokensForModel = MODEL_MAX_TOKENS[modelName] ?? 65536;

  useEffect(() => {
    if (isOpen) {
      const savedTheme = localStorage.getItem("theme") as any;
      setThemeMode(savedTheme || "system");
      fetch("/api/settings")
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) {
            setTemperature(data.temperature ?? 0.7);
            setMaxOutputTokens(data.maxOutputTokens ?? 8192);
            setModelName(data.modelName ?? "gemini-3-flash-preview");
            setSystemInstruction(data.systemInstruction || "");
            setUseGrounding(data.useGrounding || false);
          }
        });
    }
  }, [isOpen]);

  useEffect(() => {
    const cap = MODEL_MAX_TOKENS[modelName] ?? 65536;
    if (maxOutputTokens > cap) setMaxOutputTokens(cap);
  }, [modelName]);

  const applyTheme = (mode: "light" | "dark" | "system") => {
    const html = document.documentElement;
    if (mode === "system") {
      localStorage.removeItem("theme");
      html.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
    } else {
      localStorage.setItem("theme", mode);
      html.classList.toggle("dark", mode === "dark");
    }
    setThemeMode(mode);
  };

  const handleTestKey = async () => {
    if (!apiKey) return;
    setTestStatus("testing");
    try {
      const res = await fetch("/api/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      setTestStatus(res.ok ? "ok" : "fail");
    } catch {
      setTestStatus("fail");
    }
    setTimeout(() => setTestStatus("idle"), 4000);
  };

  const handleSave = async () => {
    setLoading(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, temperature, maxOutputTokens, modelName, systemInstruction, useGrounding }),
      });
      if (res.ok) {
        setStatus("success");
        if (onSaveSuccess) onSaveSuccess();
        setTimeout(() => { onClose(); setStatus("idle"); }, 1500);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const tokenPercent = Math.min((maxOutputTokens / maxTokensForModel) * 100, 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Ustawienia</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-6 overflow-y-auto max-h-[80vh]">

          {/* API Key */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              <Key className="h-4 w-4" /> Klucz API Gemini
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Wprowadż swój klucz API..."
                className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTestStatus("idle"); }}
              />
              <button
                onClick={handleTestKey}
                disabled={!apiKey || testStatus === "testing"}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all border",
                  testStatus === "ok" ? "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" :
                  testStatus === "fail" ? "border-red-400 bg-red-50 text-red-600 dark:bg-red-900/20" :
                  "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                )}
              >
                {testStatus === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> :
                 testStatus === "ok" ? <CheckCircle2 className="h-4 w-4" /> :
                 testStatus === "fail" ? <XCircle className="h-4 w-4" /> :
                 <Key className="h-4 w-4" />}
                {testStatus === "ok" ? "OK" : testStatus === "fail" ? "Błąd" : "Testuj"}
              </button>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Używamy Twojego własnego klucza (BYOK). Klucz jest szyfrowany (AES-256) przed zapisem.
            </p>
          </div>

          {/* Model Gemini */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                <Sparkles className="h-4 w-4" /> Model Gemini
              </label>
              <select
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
              >
                <optgroup label="✨ Gemini 3 (nowe)">
                  <option value="gemini-3-flash-preview">Gemini 3 Flash ⚡ (polecany)</option>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro 🧠 (najinteligentniejszy)</option>
                  <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash-Lite 💨 (najtańszy)</option>
                </optgroup>
                <optgroup label="⚠️ Gemini 2.5 (wygasa czerwiec 2026)">
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                  <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                </optgroup>
              </select>
            </div>

            {/* Motyw wizualny */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                <Sun className="h-4 w-4" /> Motyw wizualny
              </label>
              <select
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                value={themeMode}
                onChange={(e) => applyTheme(e.target.value as any)}
              >
                <option value="system">Automatyczny (System)</option>
                <option value="light">Tryb jasny</option>
                <option value="dark">Tryb ciemny</option>
              </select>
            </div>
          </div>

          {/* Max Tokens suwak */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Max Tokens odpowiedzi
              </label>
              <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">{maxOutputTokens.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="256"
              max={maxTokensForModel}
              step="256"
              value={maxOutputTokens}
              onChange={(e) => setMaxOutputTokens(parseInt(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 dark:bg-zinc-700 accent-blue-500"
            />
            <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  tokenPercent >= 80 ? "bg-amber-400" : "bg-blue-400"
                )}
                style={{ width: `${tokenPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>256</span>
              <span>{maxOutputTokens.toLocaleString()} / {maxTokensForModel.toLocaleString()} max</span>
              <span>{maxTokensForModel.toLocaleString()}</span>
            </div>
          </div>

          {/* Instrukcja systemowa */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              <Info className="h-4 w-4" /> Instrukcja Systemowa (Persona)
            </label>
            <textarea
              placeholder="NP: Jesteś pomocnym asystentem AI..."
              rows={4}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 h-24"
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-800/50 px-6 py-4 flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200/50 dark:text-zinc-400 dark:hover:bg-zinc-800">
            Anuluj
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50",
              status === "success" && "bg-green-600 hover:bg-green-600",
              status === "error" && "bg-red-600 hover:bg-red-600"
            )}
          >
            {loading ? "Zapisywanie..." : status === "success" ? "Zapisano!" : status === "error" ? "Błąd!" : (<><Save className="h-4 w-4" /> Zapisz</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
