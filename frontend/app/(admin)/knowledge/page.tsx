"use client";

import { useState, useEffect, useRef } from "react";
import { getKnowledge, uploadKnowledge, deleteKnowledge } from "@/lib/api";
import { KnowledgeFile } from "@/lib/types";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

const ALL_TAGS = ["strategy", "research", "reference", "templates", "brand", "social", "ads"];

export default function KnowledgePage() {
  const [files,        setFiles]        = useState<KnowledgeFile[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filterTag,    setFilterTag]    = useState("");
  const [uploading,    setUploading]    = useState(false);
  const [uploadTags,   setUploadTags]   = useState("");
  const [error,        setError]        = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";

  useEffect(() => { loadFiles(); }, []);

  async function loadFiles() {
    setLoading(true);
    try {
      setFiles(await getKnowledge(apiKey));
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      await uploadKnowledge(file, uploadTags, apiKey);
      setUploadTags("");
      await loadFiles();
    } catch (err: any) {
      setError(err.message);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete(filename: string) {
    if (!confirm(`Delete ${filename}?`)) return;
    try {
      await deleteKnowledge(filename, apiKey);
      await loadFiles();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const filtered = filterTag
    ? files.filter((f) => f.tags.includes(filterTag))
    : files;

  const allTags = Array.from(new Set(files.flatMap((f) => f.tags)));

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">Knowledge Base</h1>
        <p className="text-sm text-[#555] mt-0.5">
          Reference files for all crews
        </p>
      </div>

      {error && (
        <div className="mb-6 text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded px-4 py-3">
          {error}
        </div>
      )}

      {/* Upload */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5 mb-6">
        <h2 className="text-sm font-medium text-[#999] mb-4">Upload file</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={uploadTags}
            onChange={(e) => setUploadTags(e.target.value)}
            placeholder="Tags (comma-separated): strategy, brand, reference"
            className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2.5 text-sm text-white placeholder-[#444] focus:border-amber-500 focus:outline-none transition-colors"
          />
          <label className={`flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded cursor-pointer transition-colors ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}>
            {uploading ? "Uploading..." : "Choose File"}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
              accept=".txt,.md,.pdf,.doc,.docx,.csv,.json"
            />
          </label>
        </div>
        <p className="text-xs text-[#444] mt-2">
          Supported: .txt, .md, .pdf, .doc, .docx, .csv, .json
        </p>
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setFilterTag("")}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              filterTag === ""
                ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                : "border-[#2a2a2a] text-[#666] hover:border-[#3a3a3a]"
            }`}
          >
            All ({files.length})
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? "" : tag)}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                filterTag === tag
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                  : "border-[#2a2a2a] text-[#666] hover:border-[#3a3a3a]"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* File list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-[#111] border border-[#1e1e1e] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[#555] text-sm">No files yet.</p>
          <p className="text-[#444] text-xs mt-1">
            Upload reference documents, brand guides, or research reports.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((file) => (
            <div
              key={file.name}
              className="flex items-center gap-4 bg-[#111] border border-[#1e1e1e] hover:border-[#2a2a2a] rounded-lg px-4 py-3 transition-colors"
            >
              {/* Icon */}
              <div className="w-8 h-8 bg-[#161616] border border-[#2a2a2a] rounded flex items-center justify-center shrink-0">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#555]">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#ccc] font-mono truncate">{file.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-[#555]">{formatSize(file.size)}</span>
                  {file.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-[#1c1c1c] text-[#666] border border-[#252525]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleDelete(file.name)}
                className="text-[#444] hover:text-red-400 transition-colors p-1.5 rounded hover:bg-red-950/20"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
