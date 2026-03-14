"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getOutput, saveOutputVersion } from "@/lib/api";
import MarkdownViewer from "@/components/MarkdownViewer";
import ChatPanel from "@/components/ChatPanel";

export default function OutputViewerPage() {
  const { name, path: pathParts } = useParams<{ name: string; path: string[] }>();
  const router  = useRouter();
  const apiKey  = process.env.NEXT_PUBLIC_API_KEY || "";

  const filePath = Array.isArray(pathParts) ? pathParts.join("/") : pathParts;
  const decodedPath = decodeURIComponent(filePath);

  const [content,  setContent]  = useState("");
  const [original, setOriginal] = useState("");
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [editing,  setEditing]  = useState(false);
  const [panel,    setPanel]    = useState<"view" | "chat">("view");

  useEffect(() => {
    loadOutput();
  }, [decodedPath]);

  async function loadOutput() {
    setLoading(true);
    try {
      const data = await getOutput(decodedPath, apiKey);
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
      const result = await saveOutputVersion(decodedPath, content, apiKey);
      setSavedMsg(`Saved as v${result.version}`);
      setOriginal(content);
      setEditing(false);
      setTimeout(() => setSavedMsg(""), 3000);
    } catch (e: any) {
      alert(e.message);
    }
    setSaving(false);
  }

  const filename = decodedPath.split("/").pop() || decodedPath;
  const isDirty  = content !== original;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#1e1e1e] shrink-0">
        <Link
          href={`/client/${name}`}
          className="text-[#555] hover:text-[#999] transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <p className="text-sm font-mono text-[#888] truncate flex-1">{filename}</p>

        <div className="flex items-center gap-2">
          {savedMsg && (
            <span className="text-xs text-green-400 font-mono">{savedMsg}</span>
          )}
          {editing ? (
            <>
              <button
                onClick={() => { setContent(original); setEditing(false); }}
                className="text-xs text-[#555] hover:text-[#999] px-2 py-1.5 border border-[#2a2a2a] rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded transition-colors"
              >
                {saving ? "Saving..." : "Save Version"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-xs px-3 py-1.5 border border-[#2a2a2a] hover:border-[#3a3a3a] text-[#888] hover:text-[#ccc] rounded transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Toggle view/chat */}
      <div className="flex border-b border-[#1e1e1e] shrink-0">
        {(["view", "chat"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPanel(p)}
            className={`px-5 py-2.5 text-xs uppercase tracking-wider font-medium border-b-2 -mb-px transition-colors ${
              panel === p
                ? "text-amber-400 border-amber-500"
                : "text-[#555] border-transparent hover:text-[#999]"
            }`}
          >
            {p === "view" ? "Document" : "Chat"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : panel === "view" ? (
          editing ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 bg-[#0a0a0a] p-6 font-mono text-sm text-[#ccc] focus:outline-none resize-none leading-relaxed"
              spellCheck={false}
            />
          ) : (
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              <div className="prose max-w-3xl">
                <MarkdownViewer content={content} />
              </div>
            </div>
          )
        ) : (
          <ChatPanel
            context={content}
            apiKey={apiKey}
          />
        )}
      </div>
    </div>
  );
}
