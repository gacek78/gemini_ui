"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import SettingsDialog from "./components/SettingsDialog";

export default function Home() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [temperature, setTemperature] = useState(0.7);
  const [maxOutputTokens, setMaxOutputTokens] = useState(2048);
  const [useGrounding, setUseGrounding] = useState(false);

  const handleRefresh = useCallback(() => setRefreshTrigger((prev) => prev + 1), []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data && !data.error) {
        setTemperature(data.temperature ?? 0.7);
        setMaxOutputTokens(data.maxOutputTokens ?? 2048);
        setUseGrounding(data.useGrounding ?? false);
      }
    } catch {}
  }, []);

  const saveSetting = async (patch: Record<string, unknown>) => {
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {}
  };

  const handleTemperatureChange = (val: number) => {
    setTemperature(val);
    saveSetting({ temperature: val });
  };

  const handleGroundingChange = (val: boolean) => {
    setUseGrounding(val);
    saveSetting({ useGrounding: val });
  };

  const createNewConversation = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSelectedConversationId(data.id);
        handleRefresh();
      }
    } catch (e) {
      console.error("Failed to create conversation", e);
    }
  }, [handleRefresh]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await fetchSettings();
      if (mounted) {
        await createNewConversation();
      }
    };
    init();
    return () => { mounted = false; };
  }, [fetchSettings, createNewConversation]);

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-black font-sans">
      <Sidebar
        selectedId={selectedConversationId}
        onSelectConversation={setSelectedConversationId}
        onOpenSettings={() => setIsSettingsOpen(true)}
        refreshTrigger={refreshTrigger}
        temperature={temperature}
        onTemperatureChange={handleTemperatureChange}
        useGrounding={useGrounding}
        onGroundingChange={handleGroundingChange}
      />

      <main className="flex-1 h-screen overflow-hidden">
        <ChatWindow
          conversationId={selectedConversationId}
          onMessageSent={handleRefresh}
          maxOutputTokens={maxOutputTokens}
        />
      </main>

      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaveSuccess={fetchSettings}
      />
    </div>
  );
}
