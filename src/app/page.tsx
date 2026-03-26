"use client";

import React, { useState } from "react";
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

  React.useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-black font-sans">
      {/* Sidebar - History & Config */}
       <Sidebar
        selectedId={selectedConversationId}
        onSelectConversation={setSelectedConversationId}
        onOpenSettings={() => setIsSettingsOpen(true)}
        refreshTrigger={refreshTrigger}
        temperature={temperature}
      />

      {/* Main Chat Area */}
      <main className="flex-1 h-screen overflow-hidden">
        <ChatWindow 
          conversationId={selectedConversationId} 
          onMessageSent={handleRefresh}
        />
      </main>

      {/* Settings Modal */}
       <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaveSuccess={fetchSettings}
      />
    </div>
  );
}
