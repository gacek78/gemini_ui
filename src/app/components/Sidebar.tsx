"use client";
 
import React, { useState, useEffect, useRef } from "react";
import { Plus, MessageSquare, Settings, ChevronLeft, ChevronRight, Trash2, Edit2, Pin, PinOff, Check, X, Sun, Moon, Loader2, Sparkles, LogOut, Sliders } from "lucide-react";
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
}

export default function Sidebar({ 
    selectedId, 
    onSelectConversation, 
    onOpenSettings, 
    refreshTrigger,
    temperature
}: SidebarProps) {
  const { data: session } = useSession();
  const [conversations, setConversations] = useState<any[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingTitle, setDeletingTitle] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    } catch (error) {
      console.error("Failed to fetch conversations");
    }
  };

  // Usuń puste konwersacje (bez wiadomości) poza aktualnie wybraną
  const deleteEmptyConversations = async (keepId: string) => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) return;
      const all = await res.json();
      const empties = all.filter(
        (c: any) => c.id !== keepId && c.title === "Nowa rozmowa" && !c.isPinned
      );
      await Promise.all(
        empties.map((c: any) =>
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
        // Usuń puste konwersacje przed odświeżeniem listy
        await deleteEmptyConversations(newConv.id);
        await fetchConversations();
        onSelectConversation(newConv.id);
      }
    } catch (error) {
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
      const res = await fetch(`/api/conversations/${deletingId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== deletingId));
        if (selectedId === deletingId) onSelectConversation(null);
        setDeletingId(null);
      }
    } catch (error) {
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
      if (res.ok) {
        fetchConversations();
      }
    } catch (error) {
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
        setConversations(prev => prev.map(c => c.id === editingId ? { ...c, title: editTitle } : c));
        setEditingId(null);
      }
    } catch (error) {
      console.error("Failed to save title");
    }
  };

  const pinned = conversations.filter(c => c.isPinned);
  const others = conversations.filter(c => !c.isPinned);

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

        {/* Pinned Section */}
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
              <div className="flex gap-1.5 transition-all">
                <button
                  onClick={(e) => handleTogglePin(e, conv.id, conv.isPinned)}
                  className="rounded p-0.5 hover:bg-zinc-300/50 dark:hover:bg-zinc-700/50"
                  title="Odepnij"
                >
                  <PinOff className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => handleStartEdit(e, conv.id, conv.title)}
                  className="rounded p-0.5 hover:bg-zinc-300/50 dark:hover:bg-zinc-700/50"
                  title="Zmień nazwę"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(e, conv.id, conv.title)}
                  className="rounded p-0.5 hover:bg-zinc-300/50 text-zinc-500 hover:text-red-500 dark:hover:bg-zinc-700/50"
                  title="Usuń"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Divider if both sections exist */}
        {pinned.length > 0 && others.length > 0 && (
            <div className="mx-3 my-2 border-b border-zinc-200 dark:border-zinc-800" />
        )}

        {/* Regular Section */}
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
              <div className="flex gap-1.5 transition-all">
                <button
                  onClick={(e) => handleTogglePin(e, conv.id, conv.isPinned)}
                  className="rounded p-0.5 hover:bg-zinc-300/50 dark:hover:bg-zinc-700/50"
                  title="Przypiń"
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => handleStartEdit(e, conv.id, conv.title)}
                  className="rounded p-0.5 hover:bg-zinc-300/50 dark:hover:bg-zinc-700/50"
                  title="Zmień nazwę"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(e, conv.id, conv.title)}
                  className="rounded p-0.5 hover:bg-zinc-300/50 text-zinc-500 hover:text-red-500 dark:hover:bg-zinc-700/50"
                  title="Usuń"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Logout */}
      <div className="px-4 py-2">
        <button
          onClick={() => {
            if (confirm("Czy na pewno chcesz się wylogować?")) {
              signOut();
            }
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
            "flex w-full items-center justify-center rounded-lg p-2 text-zinc-400 transition-all",
            "hover:bg-zinc-100 dark:hover:bg-zinc-800",
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

        <div
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-100/50 dark:bg-zinc-800/20 shadow-inner",
            isCollapsed && "justify-center"
          )}
          title={`Temperatura odpowiedzi: ${temperature}`}
        >
          <Sliders className="h-5 w-5 text-blue-500" />
          {!isCollapsed && (
              <div className="flex flex-1 items-center justify-between">
                  <span className="font-medium">Temperatura</span>
                  <span className="font-mono text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                      {temperature.toFixed(1)}
                  </span>
              </div>
          )}
        </div>
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
