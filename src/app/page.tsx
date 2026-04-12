"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import SettingsDialog from "./components/SettingsDialog";

export default function Home() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [temperature, setTemperature] = useState(0.7);

  const handleRefresh = () => setRefreshTrigger((prev) => prev + 1);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data && !data.error) {
        setTemperature(data.temperature || 0.7);
      }
    } catch (e) {}
  };

  // Utwórz nową konwersację automatycznie przy starcie
  const createNewConversation = async () => {
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
  };

  useEffect(() => {
    fetchSettings();
    createNewConversation();
  }, []);

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-black font-sans">
      <Sidebar
        selectedId={selectedConversationId}
        onSelectConversation={setSelectedConversationId}
        onOpenSettings={() => setIsSettingsOpen(true)}
        refreshTrigger={refreshTrigger}
        temperature={temperature}
      />

      <main className="flex-1 h-screen overflow-hidden">
        <ChatWindow
          conversationId={selectedConversationId}
          onMessageSent={handleRefresh}
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
