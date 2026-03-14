"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getOutputs } from "@/lib/api";
import { OutputFile } from "@/lib/types";
import PortalOutputCard from "@/components/PortalOutputCard";

export default function PortalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [outputs,  setOutputs]  = useState<OutputFile[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && session?.user?.role === "admin") {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session?.user?.clientName) {
      loadOutputs(session.user.clientName);
    }
  }, [session]);

  async function loadOutputs(clientName: string) {
    setLoading(true);
    try {
      const data = await getOutputs(clientName, apiKey);
      setOutputs(data);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const clientName = session.user.clientName || "";
  const displayName = clientName.replace(/_/g, " ");

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-[#1e1e1e] px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white tracking-wide">
            Art Protocol
          </div>
          <div className="text-xs text-[#555] mt-0.5">Client Portal</div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#666] font-mono">{displayName}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-[#555] hover:text-[#999] transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white">{displayName}</h1>
          <p className="text-sm text-[#555] mt-0.5">
            {outputs.length} deliverable{outputs.length !== 1 ? "s" : ""}
          </p>
        </div>

        {error && (
          <div className="mb-6 text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-[#111] border border-[#1e1e1e] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : outputs.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-[#555] text-sm">No deliverables yet.</p>
            <p className="text-[#444] text-xs mt-1">
              Your outputs will appear here once ready.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {outputs.map((output) => (
              <PortalOutputCard
                key={output.path}
                output={output}
                clientName={clientName}
                apiKey={apiKey}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
