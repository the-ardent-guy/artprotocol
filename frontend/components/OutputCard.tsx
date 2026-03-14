"use client";

import Link from "next/link";
import { OutputFile } from "@/lib/types";
import { getPdfUrl } from "@/lib/api";
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

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    hour:  "2-digit",
    minute: "2-digit",
  });
}

export default function OutputCard({ output, clientName, apiKey }: Props) {
  const crewColor = CREW_COLORS[output.crew] || CREW_COLORS.output;
  const pdfUrl    = getPdfUrl(output.path);

  return (
    <div className="group bg-[#111] border border-[#1e1e1e] rounded-lg p-4 hover:border-[#2a2a2a] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Crew badge */}
          <span
            className={clsx(
              "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border mb-2",
              crewColor
            )}
          >
            {output.crew}
          </span>
          {/* Filename */}
          <p className="text-sm text-[#ccc] truncate font-mono">
            {output.name}
          </p>
          {/* Meta */}
          <p className="text-xs text-[#555] mt-0.5">
            {formatDate(output.modified)} · {formatSize(output.size)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* View + Chat */}
          <Link
            href={`/client/${clientName}/output/${encodeURIComponent(output.path)}`}
            className="text-xs px-2.5 py-1.5 border border-[#2a2a2a] hover:border-amber-500/40 text-[#888] hover:text-amber-400 rounded transition-colors font-mono"
          >
            View
          </Link>
          {/* Download PDF */}
          <a
            href={`${pdfUrl}`}
            download
            onClick={(e) => {
              // Inject API key header via fetch + blob URL for download
              e.preventDefault();
              fetch(pdfUrl, { headers: { "x-api-key": apiKey } })
                .then((r) => r.blob())
                .then((blob) => {
                  const url = URL.createObjectURL(blob);
                  const a   = document.createElement("a");
                  a.href     = url;
                  a.download = output.name.replace(/\.(txt|md)$/, ".pdf");
                  a.click();
                  URL.revokeObjectURL(url);
                });
            }}
            className="text-xs px-2.5 py-1.5 border border-[#2a2a2a] hover:border-[#3a3a3a] text-[#888] hover:text-[#ccc] rounded transition-colors font-mono"
          >
            PDF
          </a>
        </div>
      </div>
    </div>
  );
}
