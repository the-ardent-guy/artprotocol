"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, APUser } from "@/lib/userAuth";

interface Project {
  id:           string;
  name:         string;
  output_count: number;
  last_run:     string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function WorkspacePage() {
  const router   = useRouter();
  const [projects,    setProjects]    = useState<Project[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showCreate,  setShowCreate]  = useState(false);
  const [newName,     setNewName]     = useState("");
  const [newBrief,    setNewBrief]    = useState("");
  const [creating,    setCreating]    = useState(false);
  const [error,       setError]       = useState("");

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const data = await apiFetch<Project[]>("/me/projects");
      setProjects(data);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const p = await apiFetch<{ id: string }>("/me/projects", {
        method: "POST",
        body:   JSON.stringify({ name: newName.trim(), brief: newBrief }),
      });
      setShowCreate(false);
      setNewName("");
      setNewBrief("");
      router.push(`/app/project/${p.id}`);
    } catch (e: any) { setError(e.message); }
    setCreating(false);
  }

  return (
    <div className="px-6 md:px-10 py-10 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-end justify-between mb-12">
        <div>
          <p className="text-[10px] tracking-[0.3em] text-[#c9943a] uppercase mb-2">Studio</p>
          <h1 className="text-2xl font-light text-white">Your projects</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#e8b04a] text-black text-xs font-semibold tracking-wide transition-colors rounded-sm"
        >
          <span className="text-base leading-none">+</span>
          New project
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-xs mb-6">{error}</p>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="bg-[#080808] border border-[#1a1a1a] rounded-sm w-full max-w-md p-7">
            <h2 className="text-base font-light text-white mb-1">New project</h2>
            <p className="text-xs text-[#444] mb-6">What are you building?</p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-[#555] uppercase tracking-[0.15em]">
                  Project name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder="e.g. NIID, my SaaS startup"
                  className="w-full bg-black border border-[#1a1a1a] focus:border-[#c9943a] rounded-sm px-4 py-3 text-sm text-white placeholder-[#333] focus:outline-none transition-colors"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-[#555] uppercase tracking-[0.15em]">
                  What is it? <span className="text-[#333] normal-case">(optional)</span>
                </label>
                <textarea
                  value={newBrief}
                  onChange={(e) => setNewBrief(e.target.value)}
                  rows={3}
                  placeholder="One paragraph about what you're building and who it's for..."
                  className="w-full bg-black border border-[#1a1a1a] focus:border-[#c9943a] rounded-sm px-4 py-3 text-sm text-white placeholder-[#333] focus:outline-none transition-colors resize-none"
                />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 border border-[#1a1a1a] hover:border-[#2a2a2a] text-[#555] text-sm py-2.5 rounded-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-[#c9943a] hover:bg-[#e8b04a] disabled:opacity-50 text-black font-semibold text-sm py-2.5 rounded-sm transition-colors"
                >
                  {creating ? "Creating..." : "Create project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Projects */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-36 bg-[#080808] border border-[#111] rounded-sm animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="py-24 text-center border border-[#0d0d0d] rounded-sm">
          <p
            className="text-3xl font-light text-[#1a1a1a] mb-4"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Nothing built yet.
          </p>
          <p className="text-[#444] text-sm mb-8">Start your first project.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-6 py-3 bg-[#c9943a] hover:bg-[#e8b04a] text-black text-sm font-semibold rounded-sm transition-colors"
          >
            New project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/app/project/${p.id}`}>
              <div className="group bg-[#080808] border border-[#111] hover:border-[#1a1a1a] rounded-sm p-6 transition-all cursor-pointer h-full flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <h3 className="text-white font-medium text-sm group-hover:text-[#c9943a] transition-colors">
                    {p.name}
                  </h3>
                  <span className="text-[10px] text-[#2a2a2a] font-mono">
                    {p.output_count} {p.output_count === 1 ? "deliverable" : "deliverables"}
                  </span>
                </div>
                <p className="text-[#333] text-xs">
                  {p.last_run ? `Last deployed ${formatDate(p.last_run)}` : "No deployments yet"}
                </p>
                <span className="text-[#2a2a2a] group-hover:text-[#c9943a] text-xs font-mono transition-colors mt-auto">
                  Open →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
