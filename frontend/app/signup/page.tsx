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

  const alreadyExists = error.toLowerCase().includes("already exists");

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
          Create your account
        </h1>
        <p style={{ fontSize: 13, color: "#b0a090", marginBottom: "1.75rem", marginTop: 0 }}>
          100 free credits. No card required.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {[
            { label: "Your name", type: "text",     val: name,     set: setName,     ph: "Full name",         auto: "name" },
            { label: "Email",     type: "email",    val: email,    set: setEmail,    ph: "you@company.com",   auto: "email" },
            { label: "Password",  type: "password", val: password, set: setPassword, ph: "Min. 6 characters", auto: "new-password" },
          ].map(({ label, type, val, set, ph, auto }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <label style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                color: "#b0a090",
              }}>
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
          ))}

          {error && (
            <div style={{
              background: "#fff5f5",
              border: "1px solid rgba(241,80,80,0.3)",
              borderRadius: 8,
              padding: "0.75rem 1rem",
              fontSize: 12,
              color: "#c0392b",
            }}>
              {alreadyExists ? (
                <>
                  This email already has an account.{" "}
                  <Link href="/app/login" style={{ color: "#d4a043", textDecoration: "none", fontWeight: 600 }}>
                    Log in instead →
                  </Link>
                </>
              ) : error}
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
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p style={{
          fontSize: 13,
          color: "#b0a090",
          textAlign: "center",
          marginTop: "1.5rem",
          marginBottom: 0,
        }}>
          Already have an account?{" "}
          <Link href="/app/login" style={{ color: "#b0a090", textDecoration: "none", fontWeight: 600 }}>
            Log in →
          </Link>
        </p>
      </div>
    </div>
  );
}
