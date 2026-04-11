"use client";

import React, { useState, useEffect } from "react";
import { Settings, X, Save, Key, Sliders, Info, Sparkles, Sun, Moon, Laptop } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess?: () => void;
}

export default function SettingsDialog({ isOpen, onClose, onSaveSuccess }: SettingsDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxOutputTokens, setMaxOutputTokens] = useState(2048);
  const [modelName, setModelName] = useState("gemini-2.5-flash");
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("system");
  const [systemInstruction, setSystemInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    if (isOpen) {
      // Załaduj motyw z localStorage
      const savedTheme = localStorage.getItem("theme") as any;
      if (savedTheme) setThemeMode(savedTheme);
      else setThemeMode("system");

      fetch("/api/settings")
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) {
            setTemperature(data.temperature || 0.7);
            setMaxOutputTokens(data.maxOutputTokens || 2048);
            setModelName(data.modelName || "gemini-2.5-flash");
            setSystemInstruction(data.systemInstruction || "");
          }
        });
    }
  }, [isOpen]);

  const applyTheme = (mode: "light" | "dark" | "system") => {
    const html = document.documentElement;
    if (mode === "system") {
      localStorage.removeItem("theme");
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        html.classList.add("dark");
      } else {
        html.classList.remove("dark");
      }
    } else {
      localStorage.setItem("theme", mode);
      if (mode === "dark") {
        html.classList.add("dark");
      } else {
        html.classList.remove("dark");
      }
    }
    setThemeMode(mode);
  };

  const handleSave = async () => {
    setLoading(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          temperature,
          maxOutputTokens,
          modelName,
          systemInstruction,
        }),
      });

      if (res.ok) {
        setStatus("success");
        if (onSaveSuccess) onSaveSuccess();
        setTimeout(() => {
          onClose();
          setStatus("idle");
        }, 1500);
      } else {
        setStatus("error");
      }
    } catch (error) {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-300 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Ustawienia</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-6 overflow-y-auto max-h-[80vh]">
          {/* API Key Section */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              <Key className="h-4 w-4" />
              Klucz API Gemini
            </label>
            <input
              type="password"
              placeholder="Wprowadź swój klucz API..."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Używamy Twojego własnego klucza (BYOK). Klucz jest szyfrowany (AES-256) przed zapisem.
            </p>
          </div>

          {/* Model Params Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                <Sliders className="h-4 w-4 mr-1" />
                Temperatura: <span className="font-mono text-blue-600 dark:text-blue-400">{temperature.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 dark:bg-zinc-700"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Max Tokens: <span className="font-mono text-blue-600 dark:text-blue-400">{maxOutputTokens}</span>
              </label>
              <input
                type="number"
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                value={maxOutputTokens}
                onChange={(e) => setMaxOutputTokens(parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Model Selection Section */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                <Sparkles className="h-4 w-4" />
                Model Gemini
              </label>
              <select
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none transition-all focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash ⚡ (polecany)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro 🧠 (najinteligentniejszy)</option>
                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite 💨 (najtańszy)</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash (stary)</option>
              </select>
            </div>

            {/* Theme Selection Section */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                <Sun className="h-4 w-4" />
                Motyw wizualny
              </label>
              <select
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none transition-all focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                value={themeMode}
                onChange={(e) => applyTheme(e.target.value as any)}
              >
                <option value="system">Automatyczny (System)</option>
                <option value="light">Tryb jasny</option>
                <option value="dark">Tryb ciemny</option>
              </select>
            </div>
          </div>

          {/* System Prompt Section */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              <Info className="h-4 w-4" />
              Instrukcja Systemowa (Persona)
            </label>
            <textarea
              placeholder="NP: Jesteś pomocnym asystentem AI..."
              rows={4}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none transition-all focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 h-24"
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-800/50 px-6 py-4 flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200/50 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
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
            {loading ? "Zapisywanie..." : status === "success" ? "Zapisano!" : status === "error" ? "Błąd!" : (
              <>
                <Save className="h-4 w-4" /> Zapisz
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
