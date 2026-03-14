"use client";

import { useEffect, useRef } from "react";

interface Props {
  lines:     string[];
  isRunning: boolean;
  className?: string;
}

function colorize(line: string): string {
  if (line.includes("[ERROR]") || line.includes("[FAILED]"))
    return "text-red-400";
  if (line.includes("[DONE]") || line.includes("[COMPLETE]") || line.includes("[SAVED]") || line.includes("COMPLETE"))
    return "text-green-400";
  if (line.includes("[WARNING]") || line.includes("[WARN]"))
    return "text-yellow-400";
  if (line.startsWith(">>") || line.includes("Starting") || line.includes("Agent:"))
    return "text-amber-400";
  if (line.startsWith("=") || line.startsWith("-"))
    return "text-[#444]";
  if (line.includes("Task:") || line.includes("tool_use") || line.includes("Working Agent"))
    return "text-sky-400";
  if (line.startsWith("["))
    return "text-[#777]";
  return "text-[#aaa]";
}

export default function Terminal({ lines, isRunning, className = "" }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);

  useEffect(() => {
    if (autoScroll.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines]);

  function handleScroll() {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    autoScroll.current = scrollTop + clientHeight >= scrollHeight - 50;
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`relative bg-[#080808] border border-[#1e1e1e] rounded-lg font-mono text-xs leading-relaxed overflow-y-auto h-96 ${className}`}
    >
      {/* Title bar */}
      <div className="sticky top-0 flex items-center gap-1.5 px-3 py-2 bg-[#0d0d0d] border-b border-[#1e1e1e] z-10">
        <div className="w-2.5 h-2.5 rounded-full bg-red-600/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-600/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-600/60" />
        <span className="ml-2 text-[#333] text-[10px]">terminal</span>
        {isRunning && (
          <span className="ml-auto text-[10px] text-amber-500 animate-pulse-amber">
            ● running
          </span>
        )}
      </div>

      {/* Lines */}
      <div className="p-4 space-y-0.5">
        {lines.length === 0 && (
          <span className="text-[#333]">Waiting for output...</span>
        )}
        {lines.map((line, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap break-all leading-5 ${colorize(line)}`}
          >
            {line || "\u00A0"}
          </div>
        ))}
        {isRunning && (
          <div className="text-amber-500 cursor-blink text-[11px]">&nbsp;</div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
