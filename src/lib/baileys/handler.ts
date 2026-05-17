import type { proto, WASocket } from "@whiskeysockets/baileys";
import {
  getOrCreateConversation,
  getConversationById,
  insertMessage,
  getRecentHistory,
  setMode,
  listConversations,
} from "../db";
import { generateReply } from "../openrouter";

export async function handleMessages(
  messages: proto.IWebMessageInfo[],
  sock: WASocket
) {
  for (const msg of messages) {
    try {
      await processMessage(msg, sock);
    } catch (err) {
      console.error("[bot] Error procesando mensaje:", err);
    }
  }
}

async function processMessage(
  msg: proto.IWebMessageInfo,
  sock: WASocket
) {
  const remoteJid = msg.key.remoteJid ?? "";
  if (remoteJid.endsWith("@g.us")) return;
  const is1on1 = remoteJid.endsWith("@s.whatsapp.net") || remoteJid.endsWith("@lid");
  if (!is1on1) return;

  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text;

  if (!text) return;

  // Comandos del dueño enviados desde su propio número
  if (msg.key.fromMe) {
    await handleOwnerCommand(text.trim(), sock, remoteJid);
    return;
  }

  const phone = remoteJid.endsWith("@s.whatsapp.net")
    ? remoteJid.replace("@s.whatsapp.net", "")
    : remoteJid.replace("@lid", "");
  const pushName = (msg as { pushName?: string }).pushName ?? null;

  console.log(`[bot] ← Mensaje de ${phone} (${pushName ?? "sin nombre"}): "${text}"`);

  const convo = getOrCreateConversation(phone, pushName);
  insertMessage(convo.id, "user", text);

  const fresh = getConversationById(convo.id);
  if (!fresh || fresh.mode !== "AI") {
    console.log(`[bot] Chat ${phone} en modo HUMAN — no se responde.`);
    return;
  }

  const history = getRecentHistory(convo.id, 20);
  console.log(`[bot] Llamando LLM con ${history.length} mensajes...`);

  const t0 = Date.now();
  const reply = await generateReply(history);
  console.log(`[bot] LLM respondió en ${Date.now() - t0}ms`);

  if (!reply) return;

  // Detectar etiqueta de cita confirmada y notificar al técnico
  const citaMatch = reply.match(/\[CITA_CONFIRMADA:\s*(.+?)\]/s);
  const cleanReply = reply.replace(/\[CITA_CONFIRMADA:[^\]]*\]/g, "").trim();

  insertMessage(convo.id, "assistant", cleanReply);
  await sock.sendMessage(remoteJid, { text: cleanReply });
  console.log(`[bot] → Enviado a ${phone}`);

  if (citaMatch) {
    await notifyTechnician(citaMatch[1].trim(), phone, pushName, sock);
  }
}

async function notifyTechnician(
  citaInfo: string,
  clientPhone: string,
  _clientName: string | null,
  sock: WASocket
) {
  const TECH_JID = "18098031717@s.whatsapp.net";

  // Parsear nombre, dirección y horario de la etiqueta
  const get = (field: string) => {
    const m = citaInfo.match(new RegExp(`${field}=([^|\\]]+)`, "i"));
    return m ? m[1].trim() : "No especificado";
  };

  const nombre   = get("nombre");
  const direccion = get("direccion");
  const horario  = get("horario");

  const msg =
    `🔔 *Nueva cita confirmada*\n\n` +
    `👤 Cliente: ${nombre}\n` +
    `📱 WhatsApp: +${clientPhone}\n` +
    `📍 Dirección: ${direccion}\n` +
    `🕐 Horario: ${horario}\n\n` +
    `_Confirmado por el bot de Kaizen Home RD_`;

  try {
    await sock.sendMessage(TECH_JID, { text: msg });
    console.log(`[bot] 🔔 Notificación de cita enviada al técnico (${TECH_JID})`);
  } catch (err) {
    console.error("[bot] Error enviando notificación al técnico:", err);
  }
}

async function handleOwnerCommand(text: string, sock: WASocket, senderJid: string) {
  const lower = text.toLowerCase();

  // !lista — muestra todas las conversaciones
  if (lower === "!lista") {
    const convos = listConversations();
    if (convos.length === 0) {
      await sock.sendMessage(senderJid, { text: "📋 Sin conversaciones aún." });
      return;
    }
    const lines = convos.map((c) => {
      const nombre = c.name ?? c.phone;
      const modo = c.mode === "AI" ? "🤖 IA" : "👤 Humano";
      return `${modo} | ${nombre} (${c.phone})`;
    });
    await sock.sendMessage(senderJid, {
      text: `📋 Conversaciones activas:\n\n${lines.join("\n")}`,
    });
    console.log("[bot] Comando !lista ejecutado");
    return;
  }

  // !humano NUMERO o !ia NUMERO
  const matchHumano = text.match(/^!humano\s+(\S+)/i);
  const matchIA = text.match(/^!ia\s+(\S+)/i);
  const match = matchHumano ?? matchIA;

  if (match) {
    const targetPhone = match[1].replace(/\D/g, ""); // solo dígitos
    const newMode = matchHumano ? "HUMAN" : "AI";
    const label = newMode === "HUMAN" ? "👤 Humano" : "🤖 IA";

    // Busca la conversación por phone (puede ser parcial o completo)
    const convos = listConversations();
    const found = convos.find(
      (c) => c.phone === targetPhone || c.phone.endsWith(targetPhone) || targetPhone.endsWith(c.phone)
    );

    if (!found) {
      await sock.sendMessage(senderJid, {
        text: `❌ No encontré conversación con el número ${targetPhone}.\nUsá !lista para ver los números disponibles.`,
      });
      return;
    }

    setMode(found.id, newMode);
    const nombre = found.name ?? found.phone;
    await sock.sendMessage(senderJid, {
      text: `✅ Chat de ${nombre} cambiado a modo ${label}`,
    });
    console.log(`[bot] Comando: ${nombre} → modo ${newMode}`);
    return;
  }

  // !ayuda
  if (lower === "!ayuda" || lower === "!help") {
    await sock.sendMessage(senderJid, {
      text: `🤖 *Comandos disponibles:*\n\n!lista — ver todas las conversaciones\n!humano NUMERO — poner chat en modo Humano\n!ia NUMERO — poner chat en modo IA\n!ayuda — ver esta ayuda`,
    });
    return;
  }
}
