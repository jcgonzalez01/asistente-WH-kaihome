"use client";

import { useEffect, useState } from "react";
import QRScreen from "./QRScreen";
import DashboardHeader from "./DashboardHeader";
import ConversationList from "./ConversationList";
import ConversationPanel from "./ConversationPanel";

interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  last_message_preview: string | null;
}

interface StatusResponse {
  status: "disconnected" | "qr" | "connecting" | "connected";
  qrPng?: string;
  phone?: string | null;
}

export default function ConnectionGate() {
  const [status, setStatus] = useState<"loading" | "disconnected" | "connected">(
    "loading"
  );
  const [phone, setPhone] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    if (status !== "connected") return;
    loadConversations();
    const timer = setInterval(loadConversations, 2000);
    return () => clearInterval(timer);
  }, [status]);

  async function checkStatus() {
    try {
      const res = await fetch("/api/connection/status");
      const d = await res.json() as StatusResponse;
      if (d.status === "connected" && d.phone) {
        setPhone(d.phone);
        setStatus("connected");
      } else {
        setStatus("disconnected");
      }
    } catch {
      setStatus("disconnected");
    }
  }

  async function loadConversations() {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json() as Conversation[];
      setConversations(data);
    } catch {}
  }

  function handleConnected(connectedPhone: string) {
    setPhone(connectedPhone);
    setStatus("connected");
  }

  function handleDisconnect() {
    setPhone(null);
    setSelectedId(null);
    setConversations([]);
    setStatus("disconnected");
  }

  function handleModeChange(id: number, mode: "AI" | "HUMAN") {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, mode } : c))
    );
  }

  function handleDelete() {
    setSelectedId(null);
    loadConversations();
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "disconnected") {
    return <QRScreen onConnected={handleConnected} />;
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex flex-col h-screen">
      <DashboardHeader phone={phone} onDisconnect={handleDisconnect} />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 flex flex-col border-r border-slate-200 bg-white">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Conversaciones
            </p>
          </div>
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>

        {/* Panel principal */}
        <main className="flex-1 overflow-hidden">
          {selected ? (
            <ConversationPanel
              conversation={selected}
              onModeChange={(mode) => handleModeChange(selected.id, mode)}
              onDelete={handleDelete}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              <p className="text-sm">Seleccioná una conversación</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
