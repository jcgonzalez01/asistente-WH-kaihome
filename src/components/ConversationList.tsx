"use client";

interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  last_message_preview: string | null;
}

interface Props {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function relativeTime(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: Props) {
  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-slate-400 text-sm">
        Sin conversaciones aún. Esperando mensajes entrantes.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
            selectedId === c.id ? "bg-slate-100" : ""
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-medium text-slate-800 text-sm truncate">
              {c.name ?? c.phone}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                c.mode === "AI"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {c.mode === "AI" ? "IA" : "HUMAN"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500 truncate">
              {c.last_message_preview ?? "Sin mensajes"}
            </p>
            {c.last_message_at && (
              <span className="text-xs text-slate-400 flex-shrink-0">
                {relativeTime(c.last_message_at)}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
