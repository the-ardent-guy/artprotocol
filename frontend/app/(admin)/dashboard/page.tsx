"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getClients, createClient } from "@/lib/api";
import { Client } from "@/lib/types";
import ClientCard from "@/components/ClientCard";

export default function DashboardPage() {
  const [clients,     setClients]     = useState<Client[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showCreate,  setShowCreate]  = useState(false);
  const [newName,     setNewName]     = useState("");
  const [newBrief,    setNewBrief]    = useState("");
  const [creating,    setCreating]    = useState(false);
  const [error,       setError]       = useState("");

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    try {
      const data = await getClients();
      setClients(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      await createClient(newName.trim(), newBrief);
      setNewName("");
      setNewBrief("");
      setShowCreate(false);
      await loadClients();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Clients
          </h1>
          <p className="text-sm text-[#555] mt-0.5">
            {clients.length} {clients.length === 1 ? "client" : "clients"}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold px-4 py-2 rounded transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Client
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded px-4 py-3">
          {error}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-white mb-5">
              New Client
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-[#666] uppercase tracking-widest">
                  Client Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder="e.g. NIID, Boit Club"
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2.5 text-sm text-white placeholder-[#444] focus:border-amber-500 focus:outline-none transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#666] uppercase tracking-widest">
                  Initial Brief (optional)
                </label>
                <textarea
                  value={newBrief}
                  onChange={(e) => setNewBrief(e.target.value)}
                  rows={4}
                  placeholder="Brief description of the client and their business..."
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2.5 text-sm text-white placeholder-[#444] focus:border-amber-500 focus:outline-none transition-colors resize-none"
                />
              </div>
              {error && (
                <p className="text-red-400 text-xs">{error}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 border border-[#2a2a2a] hover:border-[#3a3a3a] text-[#888] text-sm py-2.5 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold text-sm py-2.5 rounded transition-colors"
                >
                  {creating ? "Creating..." : "Create Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 bg-[#111] border border-[#1e1e1e] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">⬡</div>
          <p className="text-[#555] text-sm">No clients yet.</p>
          <p className="text-[#444] text-xs mt-1">Click "New Client" to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <ClientCard key={client.name} client={client} />
          ))}
        </div>
      )}
    </div>
  );
}
