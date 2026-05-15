"use client";

import { useEffect, useState } from "react";

interface Props {
  onConnected: (phone: string) => void;
}

interface StatusResponse {
  status: "disconnected" | "qr" | "connecting" | "connected";
  qrPng?: string;
  phone?: string | null;
  updatedAt: number;
}

export default function QRScreen({ onConnected }: Props) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [firstSeen, setFirstSeen] = useState<number>(Date.now());

  useEffect(() => {
    setFirstSeen(Date.now());
    poll();
    const timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  }, []);

  async function poll() {
    try {
      const res = await fetch("/api/connection/status");
      if (!res.ok) return;
      const d = await res.json() as StatusResponse;
      setData(d);
      if (d.status === "connected" && d.phone) {
        onConnected(d.phone);
      }
    } catch {}
  }

  const elapsed = Date.now() - firstSeen;
  const showError =
    (!data || data.status === "disconnected") &&
    !data?.qrPng &&
    elapsed > 10000;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full mx-4 text-center">
        <h1 className="text-xl font-bold text-slate-800 mb-2">
          Conectar WhatsApp
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Escanea el QR con WhatsApp → Dispositivos vinculados → Vincular dispositivo
        </p>

        {data?.qrPng ? (
          <>
            <img
              src={data.qrPng}
              alt="QR de WhatsApp"
              className="mx-auto rounded-lg border border-slate-200"
              style={{ width: 280, height: 280 }}
            />
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm text-slate-500">Esperando escaneo...</span>
            </div>
          </>
        ) : data?.status === "connecting" ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-blue-600">Conectando...</p>
          </div>
        ) : showError ? (
          <div className="py-8 text-slate-500 text-sm">
            <p className="text-red-500 font-medium mb-2">
              El proceso bot no responde
            </p>
            <p>Ejecutá en otra terminal:</p>
            <code className="block mt-2 bg-slate-100 rounded p-2 text-xs">
              npm run start:bot
            </code>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="w-8 h-8 border-4 border-slate-300 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Iniciando bot...</p>
          </div>
        )}
      </div>
    </div>
  );
}
