interface Message {
  id: number;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

interface Props {
  message: Message;
}

function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isHuman = message.role === "human";

  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"} mb-3`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${
          isUser
            ? "bg-white border border-slate-200 text-slate-800"
            : isAssistant
            ? "bg-emerald-500 text-white"
            : "bg-amber-400 text-amber-900"
        }`}
      >
        {(isAssistant || isHuman) && (
          <p className="text-xs font-semibold mb-1 opacity-75">
            {isAssistant ? "Bot" : "Humano"}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className={`text-xs mt-1 text-right ${
            isUser ? "text-slate-400" : "opacity-60"
          }`}
        >
          {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}
