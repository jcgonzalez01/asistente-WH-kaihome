import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import pino from "pino";
import path from "node:path";
import qrcodeTerminal from "qrcode-terminal";
import { setConnectionState } from "../db";
import { handleMessages } from "./handler";

const AUTH_DIR = path.resolve(process.cwd(), "auth");
const logger = pino({ level: "silent" });

export interface BotHandle {
  sock: ReturnType<typeof makeWASocket>;
  shutdown: () => Promise<void>;
}

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export async function start(): Promise<BotHandle> {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  let version: [number, number, number] | undefined;
  try {
    const fetched = await fetchLatestBaileysVersion();
    version = fetched.version;
    console.log("[bot] Versión de WhatsApp Web:", version.join("."));
  } catch (err) {
    console.warn("[bot] No se pudo obtener última versión de Baileys:", err);
  }

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: Browsers.macOS("Desktop"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("[bot] QR recibido — también visible en localhost:3000");
      qrcodeTerminal.generate(qr, { small: true });
      setConnectionState({ status: "qr", qr_string: qr, phone: null });
      return;
    }

    if (connection === "connecting") {
      const current = (await import("../db")).getConnectionState();
      if (current.status === "disconnected") {
        setConnectionState({ status: "connecting" });
      }
      return;
    }

    if (connection === "open") {
      const rawId = sock.user?.id ?? "";
      const phone = rawId.split(":")[0];
      setConnectionState({ status: "connected", qr_string: null, phone });
      console.log(`[bot] Conectado como ${phone}`);
      return;
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as { output?: { statusCode?: number } })
        ?.output?.statusCode;

      console.log(`[bot] Conexión cerrada. Código: ${code}`);

      if (code === DisconnectReason.loggedOut) {
        console.log("[bot] Sesión cerrada (logout). Limpiando estado.");
        setConnectionState({
          status: "disconnected",
          qr_string: null,
          phone: null,
        });
        return;
      }

      scheduleReconnect(code, handle);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    console.log(`[bot] messages.upsert type=${type} count=${messages.length}`);
    for (const m of messages) {
      console.log(`[bot] msg: fromMe=${m.key.fromMe} jid=${m.key.remoteJid} keys=${Object.keys(m.message ?? {}).join(",")}`);
    }
    if (type !== "notify") return;
    await handleMessages(messages, sock);
  });

  const handle: BotHandle = {
    sock,
    shutdown: async () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      try {
        await sock.logout();
      } catch {}
      try {
        sock.end(undefined);
      } catch {}
    },
  };

  return handle;
}

function scheduleReconnect(
  code: number | undefined,
  currentHandle: BotHandle
) {
  if (reconnectTimer) return;

  const delay = code === 440 ? 15000 : 5000;
  console.log(`[bot] Reconectando en ${delay / 1000}s...`);

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    try {
      currentHandle.sock.end(undefined);
    } catch {}
    await start();
  }, delay);
}
