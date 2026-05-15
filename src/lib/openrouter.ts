import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./system-prompt";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://openrouter.ai/api/v1",
});

const MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function generateReply(
  history: { role: "user" | "assistant" | "human"; content: string }[]
): Promise<string> {
  const messages: ChatMessage[] = history.map((m) => ({
    role: m.role === "human" ? "assistant" : m.role,
    content: m.content,
  }));

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}
