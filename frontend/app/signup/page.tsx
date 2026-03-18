"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/backend/auth/signup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: name.trim(), email, password }),
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = "Signup failed";
        try { msg = JSON.parse(text).detail || msg; } catch { msg = text.slice(0, 120) || msg; }
        if (msg.toLowerCase().includes("internal")) msg = "Server error — make sure the backend is running.";
        throw new Error(msg);
      }
      const data = JSON.parse(text);
      localStorage.setItem("ap_token", data.token);
      localStorage.setItem("ap_user",  JSON.stringify(data.user));
      router.replace("/app");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0e0c09", display: "flex", flexDirection: "column" }}>

      {/* Background glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(212,160,67,0.07) 0%, transparent 60%)",
      }}/>

      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1.25rem 2.5rem",
        borderBottom: "1px solid #2e2619",
        position: "relative", zIndex: 1,
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.75rem", textDecoration: "none" }}>
          <img src='/ap-logo.png' alt='Art Protocol' style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
          <span style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(240,232,213,0.6)", fontWeight: 500 }}>
            Art Protocol
          </span>
        </Link>
        <Link href="/login" style={{ fontSize: 12, color: "#554d3a", textDecoration: "none", letterSpacing: "0.05em" }}>
          Already have an account →
        </Link>
      </nav>

      {/* Main */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "3rem 1.5rem", position: "relative", zIndex: 1,
      }}>

        <div style={{ width: "100%", maxWidth: 400, position: "relative" }}>
          <div style={{ marginBottom: "2.5rem" }}>
            <h1 style={{
              fontSize: 28, fontFamily: "Playfair Display, serif",
              fontWeight: 400, color: "#f0e8d5", marginBottom: "0.5rem", lineHeight: 1.2,
            }}>
              Create your account
            </h1>
            <p style={{ color: "#554d3a", fontSize: 13 }}>
              100 free credits included. No card required.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {[
              { label: "Your name", type: "text",     val: name,     set: setName,     ph: "Full name",          auto: "name" },
              { label: "Email",     type: "email",    val: email,    set: setEmail,    ph: "you@company.com",    auto: "email" },
              { label: "Password",  type: "password", val: password, set: setPassword, ph: "Min. 6 characters",  auto: "new-password" },
            ].map(({ label, type, val, set, ph, auto }) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: 10, color: "#554d3a", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 500 }}>
                  {label}
                </label>
                <input
                  type={type}
                  value={val}
                  onChange={e => set(e.target.value)}
                  required
                  autoComplete={auto}
                  placeholder={ph}
                  style={{
                    background: "#161209",
                    border: "1px solid #2e2619",
                    borderRadius: 3,
                    padding: "0.85rem 1rem",
                    fontSize: 13,
                    color: "#f0e8d5",
                    outline: "none",
                    transition: "border-color 0.15s",
                    fontFamily: "Inter, sans-serif",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#d4a043")}
                  onBlur={e  => (e.currentTarget.style.borderColor = "#2e2619")}
                />
              </div>
            ))}

            {error && (
              <div style={{
                background: "rgba(224,96,96,0.1)",
                border: "1px solid rgba(224,96,96,0.25)",
                borderRadius: 3, padding: "0.65rem 0.9rem",
                fontSize: 12, color: "#e08080",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "0.5rem",
                padding: "0.9rem",
                borderRadius: 3,
                background: loading ? "#a07830" : "#d4a043",
                color: "#0e0c09",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 0 24px rgba(212,160,67,0.25)",
                transition: "background 0.15s, box-shadow 0.15s",
              }}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p style={{ color: "#3a3020", fontSize: 11, textAlign: "center", marginTop: "2rem", lineHeight: 1.7 }}>
            By signing up you agree to our terms.<br/>
            Your work is private and belongs to you.
          </p>
        </div>
      </div>
    </div>
  );
}
