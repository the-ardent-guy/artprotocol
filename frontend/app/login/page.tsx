"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router     = useRouter();
  const { data: session, status } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      if (session?.user?.role === "admin") router.replace("/dashboard");
      else router.replace("/portal");
    }
  }, [session, status, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid credentials. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] px-4">
      {/* Logo / wordmark */}
      <div className="mb-10 text-center">
        <div className="flex justify-center mb-3">
          <img src='/ap-logo.png' alt='Art Protocol' style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
        </div>
        <div className="text-2xl font-semibold tracking-[0.2em] text-white uppercase mb-1">
          Art Protocol
        </div>
        <div className="text-xs tracking-[0.3em] text-[#555] uppercase">
          Operations System
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-[#111] border border-[#222] rounded-lg p-8 space-y-5"
      >
        <div className="space-y-1">
          <label className="text-xs text-[#666] uppercase tracking-widest">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2.5 text-sm text-white placeholder-[#444] focus:border-amber-500 focus:outline-none transition-colors"
            placeholder="username"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-[#666] uppercase tracking-widest">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2.5 text-sm text-white placeholder-[#444] focus:border-amber-500 focus:outline-none transition-colors"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-red-400 text-xs bg-red-950/40 border border-red-900/50 rounded px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm py-2.5 rounded transition-colors"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-xs text-[#333]">
        New user?{" "}
        <Link href="/signup" className="text-[#c9943a] hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
