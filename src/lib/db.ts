import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "messages.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    mode TEXT CHECK(mode IN ('AI','HUMAN')) NOT NULL DEFAULT 'AI',
    last_message_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    role TEXT CHECK(role IN ('user','assistant','human')) NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conv
    ON messages(conversation_id, created_at);

  CREATE TABLE IF NOT EXISTS connection_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    status TEXT CHECK(status IN ('disconnected','qr','connecting','connected'))
      NOT NULL DEFAULT 'disconnected',
    qr_string TEXT,
    phone TEXT,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  INSERT OR IGNORE INTO connection_state (id, status) VALUES (1, 'disconnected');

  CREATE TABLE IF NOT EXISTS outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    content TEXT NOT NULL,
    sent INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_outbox_pending
    ON outbox(sent, created_at);
`);

export interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  created_at: number;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

export interface ConnectionState {
  id: 1;
  status: "disconnected" | "qr" | "connecting" | "connected";
  qr_string: string | null;
  phone: string | null;
  updated_at: number;
}

export interface OutboxItem {
  id: number;
  conversation_id: number;
  phone: string;
  content: string;
  sent: number;
  created_at: number;
}

const stmts = {
  upsertConversation: db.prepare<[string, string | null]>(`
    INSERT INTO conversations (phone, name)
    VALUES (?, ?)
    ON CONFLICT(phone) DO UPDATE SET
      name = COALESCE(excluded.name, conversations.name)
    RETURNING *
  `),
  getConversationByPhone: db.prepare<[string]>(
    "SELECT * FROM conversations WHERE phone = ?"
  ),
  getConversationById: db.prepare<[number]>(
    "SELECT * FROM conversations WHERE id = ?"
  ),
  insertMessage: db.prepare<[number, string, string]>(
    "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)"
  ),
  updateLastMessageAt: db.prepare<[number]>(
    "UPDATE conversations SET last_message_at = unixepoch() WHERE id = ?"
  ),
  getMessages: db.prepare<[number, number]>(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?"
  ),
  getRecentHistoryDesc: db.prepare<[number, number]>(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?"
  ),
  setMode: db.prepare<[string, number]>(
    "UPDATE conversations SET mode = ? WHERE id = ?"
  ),
  listConversations: db.prepare(`
    SELECT c.*,
      (SELECT content FROM messages m
       WHERE m.conversation_id = c.id
       ORDER BY m.created_at DESC LIMIT 1) AS last_message_preview
    FROM conversations c
    ORDER BY c.last_message_at DESC NULLS LAST
  `),
  getConnectionState: db.prepare("SELECT * FROM connection_state WHERE id = 1"),
  setConnectionStatus: db.prepare<[string, number]>(
    "UPDATE connection_state SET status = ?, updated_at = unixepoch() WHERE id = 1"
  ),
  setConnectionFull: db.prepare<[string, string | null, string | null]>(
    "UPDATE connection_state SET status = ?, qr_string = ?, phone = ?, updated_at = unixepoch() WHERE id = 1"
  ),
  enqueueOutbox: db.prepare<[number, string, string]>(
    "INSERT INTO outbox (conversation_id, phone, content) VALUES (?, ?, ?)"
  ),
  getPendingOutbox: db.prepare<[number]>(
    "SELECT * FROM outbox WHERE sent = 0 ORDER BY created_at ASC LIMIT ?"
  ),
  markOutboxSent: db.prepare<[number]>(
    "UPDATE outbox SET sent = 1 WHERE id = ?"
  ),
};

const insertMessageTx = db.transaction(
  (conversationId: number, role: string, content: string) => {
    const result = stmts.insertMessage.run(conversationId, role, content);
    stmts.updateLastMessageAt.run(conversationId);
    return result;
  }
);

const deleteConversationTx = db.transaction((id: number) => {
  db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
  db.prepare("DELETE FROM outbox WHERE conversation_id = ? AND sent = 0").run(id);
  db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
});

export function getOrCreateConversation(
  phone: string,
  name?: string | null
): Conversation {
  return stmts.upsertConversation.get(
    phone,
    name ?? null
  ) as Conversation;
}

export function getConversationById(id: number): Conversation | null {
  return (stmts.getConversationById.get(id) as Conversation) ?? null;
}

export function insertMessage(
  conversationId: number,
  role: "user" | "assistant" | "human",
  content: string
) {
  return insertMessageTx(conversationId, role, content);
}

export function getMessages(conversationId: number, limit = 50): Message[] {
  return stmts.getMessages.all(conversationId, limit) as Message[];
}

export function getRecentHistory(
  conversationId: number,
  limit = 20
): Message[] {
  const rows = stmts.getRecentHistoryDesc.all(
    conversationId,
    limit
  ) as Message[];
  return rows.reverse();
}

export function setMode(conversationId: number, mode: "AI" | "HUMAN") {
  stmts.setMode.run(mode, conversationId);
}

export function listConversations(): (Conversation & {
  last_message_preview: string | null;
})[] {
  return stmts.listConversations.all() as (Conversation & {
    last_message_preview: string | null;
  })[];
}

export function getConnectionState(): ConnectionState {
  return stmts.getConnectionState.get() as ConnectionState;
}

export function setConnectionState(params: {
  status: ConnectionState["status"];
  qr_string?: string | null;
  phone?: string | null;
}) {
  const current = getConnectionState();

  const newQr =
    "qr_string" in params ? params.qr_string ?? null : current.qr_string;
  const newPhone =
    "phone" in params ? params.phone ?? null : current.phone;

  stmts.setConnectionFull.run(params.status, newQr, newPhone);
}

export function enqueueOutbox(
  conversationId: number,
  phone: string,
  content: string
) {
  stmts.enqueueOutbox.run(conversationId, phone, content);
}

export function getPendingOutbox(limit = 20): OutboxItem[] {
  return stmts.getPendingOutbox.all(limit) as OutboxItem[];
}

export function markOutboxSent(id: number) {
  stmts.markOutboxSent.run(id);
}

export function deleteConversation(id: number) {
  deleteConversationTx(id);
}

export default db;
