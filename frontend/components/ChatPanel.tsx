"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "@/lib/types";

interface Props {
  context: string;
}

export default function ChatPanel({ context }: Props) {
  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [input,     setInput]     = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef  = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const msg = input.trim();
    if (!msg || streaming) return;

    setInput("");
    const userMsg: ChatMessage = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);

    const assistantMsg: ChatMessage = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/backend/chat", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: msg,
          context,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        throw new Error(`Chat API error: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const text = JSON.parse(data);
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role:    "assistant",
                content: updated[updated.length - 1].content + text,
              };
              return updated;
            });
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role:    "assistant",
            content: `[Error: ${err.message}]`,
          };
          return updated;
        });
      }
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    if (streaming) abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e1e1e] shrink-0">
        <span className="text-xs text-[#555] uppercase tracking-widest">
          Chat with document
        </span>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-[#444] hover:text-[#888] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {messages.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-[#444] text-sm">Ask anything about this document.</p>
            <p className="text-[#333] text-xs mt-1">
              Suggestions: "Summarize the key points", "What's the brand positioning?",
              "Write a tweet based on this"
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[9px] text-amber-400 font-mono font-bold">AP</span>
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#1c1c1c] border border-[#2a2a2a] text-[#ccc]"
                  : "bg-[#111] text-[#bbb]"
              }`}
            >
              {msg.content}
              {streaming && i === messages.length - 1 && msg.role === "assistant" && msg.content === "" && (
                <span className="text-[#444] text-xs">Thinking...</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-5 pb-5 pt-3 border-t border-[#1e1e1e]">
        <div className="flex gap-2.5 items-end bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2.5 focus-within:border-amber-500/50 transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask about this document..."
            disabled={streaming}
            className="flex-1 bg-transparent text-sm text-white placeholder-[#444] focus:outline-none resize-none leading-relaxed max-h-28 overflow-y-auto disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            className="shrink-0 w-8 h-8 bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed rounded flex items-center justify-center transition-colors"
          >
            {streaming ? (
              <span className="w-3 h-3 border border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-black">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[10px] text-[#333] mt-1.5 text-center">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
