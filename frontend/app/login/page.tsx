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
      <div style={{
        minHeight: "100vh",
        background: "#f7f4ef",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{
          width: 24,
          height: 24,
          border: "2.5px solid #e8e0d5",
          borderTopColor: "#d4a043",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f7f4ef",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem 1rem",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "#ffffff",
        borderRadius: 18,
        padding: "2.5rem",
        boxShadow: "0 8px 40px rgba(0,0,0,0.07)",
        border: "1.5px solid #ece6dc",
      }}>
        {/* Logo + tagline */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div style={{
            fontSize: 20,
            fontFamily: "Playfair Display, Georgia, serif",
            fontWeight: 700,
            color: "#1c1812",
            marginBottom: "0.3rem",
          }}>
            Art Protocol
          </div>
          <div style={{ fontSize: 12, color: "#b0a090" }}>Your AI brand agency.</div>
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#1c1812",
          fontFamily: "Playfair Display, Georgia, serif",
          marginBottom: "0.35rem",
          marginTop: 0,
        }}>
          Welcome back
        </h1>
        <p style={{ fontSize: 13, color: "#b0a090", marginBottom: "1.75rem", marginTop: 0 }}>
          Sign in to your Art Protocol account.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <label style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#b0a090",
            }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="username"
              style={{
                background: "#faf8f5",
                border: "1.5px solid #e8e0d5",
                borderRadius: 10,
                padding: "0.75rem 1rem",
                fontSize: 14,
                color: "#1c1812",
                outline: "none",
                fontFamily: "Inter, system-ui, sans-serif",
                transition: "border-color 0.15s",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "#d4a043")}
              onBlur={e  => (e.currentTarget.style.borderColor = "#e8e0d5")}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <label style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#b0a090",
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
                background: "#faf8f5",
                border: "1.5px solid #e8e0d5",
                borderRadius: 10,
                padding: "0.75rem 1rem",
                fontSize: 14,
                color: "#1c1812",
                outline: "none",
                fontFamily: "Inter, system-ui, sans-serif",
                transition: "border-color 0.15s",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "#d4a043")}
              onBlur={e  => (e.currentTarget.style.borderColor = "#e8e0d5")}
            />
          </div>

          {error && (
            <div style={{
              background: "#fff5f5",
              border: "1px solid rgba(241,80,80,0.3)",
              borderRadius: 8,
              padding: "0.75rem 1rem",
              fontSize: 12,
              color: "#c0392b",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "0.25rem",
              width: "100%",
              background: "#1c1812",
              color: "#ffffff",
              borderRadius: 10,
              padding: "0.85rem",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.04em",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "opacity 0.15s",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            {loading ? "Signing in..." : "Sign in →"}
          </button>
        </form>

        <p style={{
          fontSize: 13,
          color: "#b0a090",
          textAlign: "center",
          marginTop: "1.5rem",
          marginBottom: 0,
        }}>
          New here?{" "}
          <Link href="/app/signup" style={{ color: "#b0a090", textDecoration: "none", fontWeight: 600 }}>
            Create an account →
          </Link>
        </p>
      </div>
    </div>
  );
}
