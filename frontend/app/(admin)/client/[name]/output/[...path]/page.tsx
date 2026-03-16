"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getOutput, saveOutputVersion, getPdfUrl } from "@/lib/api";
import MarkdownViewer from "@/components/MarkdownViewer";
import ChatPanel from "@/components/ChatPanel";

export default function OutputViewerPage() {
  const { name, path: pathParts } = useParams<{ name: string; path: string[] }>();
  const filePath    = Array.isArray(pathParts) ? pathParts.join("/") : pathParts;
  const decodedPath = decodeURIComponent(filePath);
  const filename    = decodedPath.split("/").pop() || decodedPath;

  const [content,    setContent]    = useState("");
  const [original,   setOriginal]   = useState("");
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [savedMsg,   setSavedMsg]   = useState("");
  const [editing,    setEditing]    = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => { loadOutput(); }, [decodedPath]);

  async function loadOutput() {
    setLoading(true);
    try {
      const data = await getOutput(decodedPath);
      setContent(data.content);
      setOriginal(data.content);
    } catch (e: any) {
      setContent(`[Error loading file: ${e.message}]`);
    }
    setLoading(false);
  }

  async function handleSave() {
    if (content === original) return;
    setSaving(true);
    try {
      const result = await saveOutputVersion(decodedPath, content);
      setSavedMsg(`Saved as v${result.version}`);
      setOriginal(content);
      setEditing(false);
      setTimeout(() => setSavedMsg(""), 3000);
    } catch (e: any) {
      alert(e.message);
    }
    setSaving(false);
  }

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const pdfUrl = getPdfUrl(decodedPath);
      const res    = await fetch(pdfUrl);
      if (!res.ok) throw new Error(`PDF generation failed: ${res.status}`);
      const blob   = await res.blob();
      const url    = URL.createObjectURL(blob);
      const a      = document.createElement("a");
      a.href       = url;
      a.download   = filename.replace(/\.(txt|md)$/, ".pdf");
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message);
    }
    setDownloading(false);
  }

  const isDirty = content !== original;

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[#1e1e1e] shrink-0">
        <Link
          href={`/client/${name}`}
          className="text-[#555] hover:text-[#999] transition-colors shrink-0"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>

        <p className="text-sm font-mono text-[#666] truncate flex-1">{filename}</p>

        <div className="flex items-center gap-2 shrink-0">
          {savedMsg && (
            <span className="text-xs text-green-400 font-mono">{savedMsg}</span>
          )}

          {/* Edit / Save controls */}
          {editing ? (
            <>
              <button
                onClick={() => { setContent(original); setEditing(false); }}
                className="text-xs px-3 py-1.5 border border-[#2a2a2a] text-[#666] hover:text-[#999] rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-semibold rounded transition-colors"
              >
                {saving ? "Saving..." : "Save Version"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-xs px-3 py-1.5 border border-[#2a2a2a] hover:border-[#3a3a3a] text-[#666] hover:text-[#ccc] rounded transition-colors"
            >
              Edit
            </button>
          )}

          {/* PDF Download */}
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] hover:border-amber-500/40 text-[#888] hover:text-amber-400 rounded transition-colors disabled:opacity-40"
          >
            {downloading ? (
              <span className="w-3 h-3 border border-amber-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            )}
            PDF
          </button>
        </div>
      </div>

      {/* ── Main content area ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : editing ? (
        // Edit mode — full width textarea
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 bg-[#0a0a0a] p-6 font-mono text-sm text-[#ccc] focus:outline-none resize-none leading-relaxed"
          spellCheck={false}
          autoFocus
        />
      ) : (
        // View mode — document left, chat right
        <div className="flex-1 overflow-hidden flex min-h-0">

          {/* Document panel */}
          <div className="flex-1 overflow-y-auto border-r border-[#1a1a1a]">
            <div className="max-w-3xl mx-auto px-8 py-8">
              <MarkdownViewer content={content} />
            </div>
          </div>

          {/* Chat panel — fixed width sidebar */}
          <div className="w-[380px] shrink-0 flex flex-col min-h-0 bg-[#080808]">
            <ChatPanel context={content} />
          </div>

        </div>
      )}
    </div>
  );
}
