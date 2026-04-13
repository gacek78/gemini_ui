"use client";
 
import React, { useState, useEffect, useRef } from "react";
import { Plus, MessageSquare, Settings, ChevronLeft, ChevronRight, Trash2, Edit2, Pin, PinOff, Sparkles, LogOut, Sliders, Globe } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  selectedId: string | null;
  onSelectConversation: (id: string | null) => void;
  onOpenSettings: () => void;
  refreshTrigger: number;
  temperature: number;
  onTemperatureChange: (val: number) => void;
  useGrounding: boolean;
  onGroundingChange: (val: boolean) => void;
}

interface Conversation {
  id: string;
  title: string;
  isPinned: boolean;
  [key: string]: unknown;
}

export default function Sidebar({
  selectedId,
  onSelectConversation,
  onOpenSettings,
  refreshTrigger,
  temperature,
  onTemperatureChange,
  useGrounding,
  onGroundingChange,
}: SidebarProps) {
  const { data: session } = useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingTitle, setDeletingTitle] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    fetchConversations();
  }, [refreshTrigger]);

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch {
      console.error("Failed to fetch conversations");
    }
  };

  const deleteEmptyConversations = async (keepId: string) => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) return;
      const all: Conversation[] = await res.json();
      const empties = all.filter(
        (c) => c.id !== keepId && c.title === "Nowa rozmowa" && !c.isPinned
      );
      await Promise.all(
        empties.map((c) =>
          fetch(`/api/conversations/${c.id}/messages`)
            .then((r) => r.json())
            .then((msgs) => {
              if (msgs.length === 0) {
                return fetch(`/api/conversations/${c.id}`, { method: "DELETE" });
              }
            })
        )
      );
    } catch (e) {
      console.error("Failed to delete empty conversations", e);
    }
  };

  const handleNewChat = async () => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Nowa rozmowa" }),
      });
      if (res.ok) {
        const newConv = await res.json();
        await deleteEmptyConversations(newConv.id);
        await fetchConversations();
        onSelectConversation(newConv.id);
      }
    } catch {
      alert("Błąd tworzenia czatu");
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setDeletingId(id);
    setDeletingTitle(title);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/conversations/${deletingId}`, { method: "DELETE" });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== deletingId));
        if (selectedId === deletingId) onSelectConversation(null);
        setDeletingId(null);
      }
    } catch {
      console.error("Failed to delete conversation");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTogglePin = async (e: React.MouseEvent, id: string, currentPinned: boolean) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !currentPinned }),
      });
      if (res.ok) fetchConversations();
    } catch {
      console.error("Failed to toggle pin");
    }
  };

  const handleStartEdit = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setEditingId(id);
    setEditTitle(title);
  };

  const handleSaveEdit = async (e: React.FormEvent | React.FocusEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      const res = await fetch(`/api/conversations/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === editingId ? { ...c, title: editTitle } : c))
        );
        setEditingId(null);
      }
    } catch {
      console.error("Failed to save title");
    }
  };

  const pinned = conversations.filter((c) => c.isPinned);
  const others = conversations.filter((c) => !c.isPinned);

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r border-zinc-200 bg-zinc-50 transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-950",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header / New Chat */}
      <div className="p-4">
        <button
          onClick={handleNewChat}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl bg-white p-3 text-sm font-medium shadow-sm ring-1 ring-zinc-200 transition-all hover:bg-zinc-50 active:scale-95 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800",
            isCollapsed && "justify-center p-2"
          )}
        >
          <Plus className="h-5 w-5 text-blue-600" />
          {!isCollapsed && <span>Nowa rozmowa</span>}
        </button>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 scrollbar-thin">
        {!isCollapsed && conversations.length === 0 && (
          <div className="mt-10 px-4 text-center">
            <div className="mb-3 flex justify-center">
              <Sparkles className="h-8 w-8 text-zinc-300 dark:text-zinc-700 animate-pulse" />
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Brak rozmów. Rozpocznij nowy wątek, aby go tutaj zobaczyć.
            </p>
          </div>
        )}

        {pinned.map((conv) => (
          <div
            key={conv.id}
            onMouseEnter={() => setHoveredId(conv.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSelectConversation(conv.id)}
            className={cn(
              "group relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
              selectedId === conv.id
                ? "bg-zinc-200/50 dark:bg-zinc-800/50 text-blue-600 dark:text-blue-400"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/30 dark:hover:bg-zinc-800/30"
            )}
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center">
              <Pin className="h-3.5 w-3.5 fill-current text-blue-500" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 truncate">
                {editingId === conv.id ? (
                  <form onSubmit={handleSaveEdit} className="w-full">
                    <input
                      autoFocus
                      className="w-full bg-transparent p-0 outline-none"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={handleSaveEdit}
                    />
                  </form>
                ) : (
                  <span>{conv.title}</span>
                )}
              </div>
            )}
            {!isCollapsed && (hoveredId === conv.id || selectedId === conv.id) && (
              <div className="flex gap-1.5">
                <button onClick={(e) => handleTogglePin(e, conv.id, conv.isPinned)} className="rounded p-0.5 hover:bg-zinc-300/50 dark:hover:bg-zinc-700/50" title="Odepnij"><PinOff className="h-3.5 w-3.5" /></button>
                <button onClick={(e) => handleStartEdit(e, conv.id, conv.title)} className="rounded p-0.5 hover:bg-zinc-300/50 dark:hover:bg-zinc-700/50" title="Zmień nazwę"><Edit2 className="h-3.5 w-3.5" /></button>
                <button onClick={(e) => handleDeleteClick(e, conv.id, conv.title)} className="rounded p-0.5 hover:bg-zinc-300/50 text-zinc-500 hover:text-red-500 dark:hover:bg-zinc-700/50" title="Usuń"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            )}
          </div>
        ))}

        {pinned.length > 0 && others.length > 0 && (
          <div className="mx-3 my-2 border-b border-zinc-200 dark:border-zinc-800" />
        )}

        {others.map((conv) => (
          <div
            key={conv.id}
            onMouseEnter={() => setHoveredId(conv.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSelectConversation(conv.id)}
            className={cn(
              "group relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
              selectedId === conv.id
                ? "bg-zinc-200/50 dark:bg-zinc-800/50 text-blue-600 dark:text-blue-400"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/30 dark:hover:bg-zinc-800/30"
            )}
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center">
              <MessageSquare className="h-4 w-4 opacity-50" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 truncate">
                {editingId === conv.id ? (
                  <form onSubmit={handleSaveEdit} className="w-full">
                    <input
                      autoFocus
                      className="w-full bg-transparent p-0 outline-none"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={handleSaveEdit}
                    />
                  </form>
                ) : (
                  <span>{conv.title}</span>
                )}
              </div>
            )}
            {!isCollapsed && (hoveredId === conv.id || selectedId === conv.id) && (
              <div className="flex gap-1.5">
                <button onClick={(e) => handleTogglePin(e, conv.id, conv.isPinned)} className="rounded p-0.5 hover:bg-zinc-300/50 dark:hover:bg-zinc-700/50" title="Przypiń"><Pin className="h-3.5 w-3.5" /></button>
                <button onClick={(e) => handleStartEdit(e, conv.id, conv.title)} className="rounded p-0.5 hover:bg-zinc-300/50 dark:hover:bg-zinc-700/50" title="Zmień nazwę"><Edit2 className="h-3.5 w-3.5" /></button>
                <button onClick={(e) => handleDeleteClick(e, conv.id, conv.title)} className="rounded p-0.5 hover:bg-zinc-300/50 text-zinc-500 hover:text-red-500 dark:hover:bg-zinc-700/50" title="Usuń"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Temperatura + Grounding w sidebarze */}
      {!isCollapsed && (
        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
          {/* Suwak temperatury */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <Sliders className="h-3.5 w-3.5" />
                Temperatura
              </label>
              <span className="font-mono text-xs font-semibold text-blue-500">{temperature.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 dark:bg-zinc-700 accent-blue-500"
            />
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>Precyzyjny</span>
              <span>Kreatywny</span>
            </div>
          </div>

          {/* Przełącznik Grounding */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <Globe className="h-3.5 w-3.5" />
              Google Search
            </label>
            <button
              type="button"
              onClick={() => onGroundingChange(!useGrounding)}
              title={useGrounding ? "Wyłącz wyszukiwarkę Google" : "Włącz wyszukiwarkę Google"}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                useGrounding ? "bg-blue-500" : "bg-zinc-300 dark:bg-zinc-600"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200",
                  useGrounding ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="px-4 py-2">
        <button
          onClick={() => {
            if (confirm("Czy na pewno chcesz się wylogować?")) signOut();
          }}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-500 transition-all hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10",
            isCollapsed && "justify-center"
          )}
          title="Wyloguj się"
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span className="flex-1 text-left truncate">Wyloguj ({session?.user?.name || "Gość"})</span>}
        </button>
      </div>

      {/* Footer / Settings */}
      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800 space-y-3 pb-20 md:pb-8">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "flex w-full items-center justify-center rounded-lg p-2 text-zinc-400 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800",
            isCollapsed && "bg-zinc-100 dark:bg-zinc-800 text-blue-500"
          )}
          title={isCollapsed ? "Rozwiń pasek boczny" : "Zwiń pasek boczny"}
        >
          {isCollapsed ? <ChevronRight className="h-6 w-6" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
        <button
          onClick={onOpenSettings}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 transition-all hover:bg-zinc-200/50 dark:text-zinc-400 dark:hover:bg-zinc-800/50",
            isCollapsed && "justify-center"
          )}
        >
          <Settings className="h-5 w-5" />
          {!isCollapsed && <span>Ustawienia</span>}
        </button>
      </div>

      <DeleteConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDeleteConfirm}
        title={deletingTitle}
        loading={isDeleting}
      />
    </aside>
  );
}
