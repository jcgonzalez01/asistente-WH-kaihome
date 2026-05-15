import "./env-loader";
import path from "node:path";
import fs from "node:fs";
import {
  getConnectionState,
  getPendingOutbox,
  markOutboxSent,
  setConnectionState,
} from "../src/lib/db";
import { start } from "../src/lib/baileys/client";
import type { BotHandle } from "../src/lib/baileys/client";

const RESTART_FLAG = path.resolve(process.cwd(), "data/.restart");
const AUTH_DIR = path.resolve(process.cwd(), "auth");

let handle: BotHandle | null = null;

async function boot() {
  console.log("[bot] Iniciando...");
  setConnectionState({ status: "disconnected", qr_string: null, phone: null });
  handle = await start();

  setInterval(async () => {
    if (fs.existsSync(RESTART_FLAG)) {
      console.log("[bot] Flag de reinicio detectado. Reiniciando...");
      fs.unlinkSync(RESTART_FLAG);

      if (handle) {
        try {
          await handle.shutdown();
        } catch {}
        handle = null;
      }

      try {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      } catch {}

      handle = await start();
      return;
    }

    await drainOutbox();
  }, 1000);
}

async function drainOutbox() {
  if (!handle) return;

  const state = getConnectionState();
  if (state.status !== "connected") return;

  const items = getPendingOutbox(20);
  for (const item of items) {
    try {
      const jid = `${item.phone}@s.whatsapp.net`;
      await handle.sock.sendMessage(jid, { text: item.content });
      markOutboxSent(item.id);
      console.log(`[bot] → Outbox enviado a ${item.phone}`);
    } catch (err) {
      console.error(`[bot] Error enviando outbox id=${item.id}:`, err);
    }
  }
}

boot().catch((err) => {
  console.error("[bot] Error fatal:", err);
  process.exit(1);
});
