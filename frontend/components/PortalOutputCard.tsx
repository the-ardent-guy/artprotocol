"use client";

import { useState } from "react";
import { OutputFile } from "@/lib/types";
import { getPdfUrl, getOutput } from "@/lib/api";
import MarkdownViewer from "./MarkdownViewer";
import clsx from "clsx";

interface Props {
  output:     OutputFile;
  clientName: string;
  apiKey:     string;
}

const CREW_COLORS: Record<string, string> = {
  branding: "text-purple-400 border-purple-500/20 bg-purple-500/5",
  social:   "text-sky-400    border-sky-500/20    bg-sky-500/5",
  ads:      "text-green-400  border-green-500/20  bg-green-500/5",
  proposal: "text-amber-400  border-amber-500/20  bg-amber-500/5",
  research: "text-orange-400 border-orange-500/20 bg-orange-500/5",
  output:   "text-[#666]     border-[#2a2a2a]     bg-[#111]",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function PortalOutputCard({ output, clientName, apiKey }: Props) {
  const [expanded,    setExpanded]    = useState(false);
  const [content,     setContent]     = useState("");
  const [loadingView, setLoadingView] = useState(false);
  const crewColor = CREW_COLORS[output.crew] || CREW_COLORS.output;

  async function handleView() {
    if (!expanded && !content) {
      setLoadingView(true);
      try {
        const data = await getOutput(output.path, apiKey);
        setContent(data.content);
      } catch (e: any) {
        setContent(`[Error: ${e.message}]`);
      }
      setLoadingView(false);
    }
    setExpanded((prev) => !prev);
  }

  function downloadPdf() {
    const pdfUrl = getPdfUrl(output.path);
    fetch(pdfUrl, { headers: { "x-api-key": apiKey } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = output.name.replace(/\.(txt|md)$/, ".pdf");
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className={clsx("text-[10px] px-2 py-0.5 rounded border font-mono uppercase tracking-wider", crewColor)}>
          {output.crew}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#ccc] font-mono truncate">{output.name}</p>
          <p className="text-xs text-[#555] mt-0.5">
            {formatDate(output.modified)} · {formatSize(output.size)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleView}
            disabled={loadingView}
            className="text-xs px-3 py-1.5 border border-[#2a2a2a] hover:border-amber-500/40 text-[#888] hover:text-amber-400 rounded transition-colors"
          >
            {loadingView ? "Loading..." : expanded ? "Hide" : "View"}
          </button>
          <button
            onClick={downloadPdf}
            className="text-xs px-3 py-1.5 border border-[#2a2a2a] hover:border-[#3a3a3a] text-[#888] hover:text-[#ccc] rounded transition-colors"
          >
            PDF
          </button>
        </div>
      </div>

      {expanded && content && (
        <div className="border-t border-[#1a1a1a] px-6 py-5 max-h-[70vh] overflow-y-auto">
          <div className="prose">
            <MarkdownViewer content={content} />
          </div>
        </div>
      )}
    </div>
  );
}
