"use client";

interface Props {
  phone: string | null;
  onDisconnect: () => void;
}

export default function DashboardHeader({ phone, onDisconnect }: Props) {
  async function handleDisconnect() {
    await fetch("/api/connection/disconnect", { method: "POST" });
    onDisconnect();
  }

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="font-semibold text-slate-800">Agente WhatsApp</span>
        {phone && (
          <span className="text-sm text-slate-500">+{phone}</span>
        )}
      </div>
      <button
        onClick={handleDisconnect}
        className="text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
      >
        Desconectar
      </button>
    </header>
  );
}
