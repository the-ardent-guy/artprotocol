"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getToken, getStoredUser, clearAuth, apiFetch, APUser } from "@/lib/userAuth";

export default function UserAppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<APUser | null>(null);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    apiFetch<APUser>("/me")
      .then(u => { setUser(u); localStorage.setItem("ap_user", JSON.stringify(u)); })
      .catch(() => { clearAuth(); router.replace("/login"); });
  }, []);

  if (!user) return (
    <div style={{ minHeight: "100vh", background: "#f7f4ef", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 22, height: 22, border: "2.5px solid #e8e0d5", borderTopColor: "#4f8ef0", borderRadius: "50%", animation: "spin 0.7s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  function handleSignOut() { clearAuth(); router.replace("/"); }

  const isStudio  = pathname === "/app" || pathname.startsWith("/app/project");
  const isCredits = pathname === "/app/credits";
  const isLow     = user.credits < 150;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f4ef", display: "flex", flexDirection: "column" }}>
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 1.75rem", height: 57,
        borderBottom: "1px solid #ece6dc",
        background: "#fff",
        position: "sticky", top: 0, zIndex: 50, flexShrink: 0,
        boxShadow: "0 1px 12px rgba(28,24,18,0.04)",
      }}>
        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <Link href="/app" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #e8a020, #c07010)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 10px rgba(232,160,32,0.3)", flexShrink: 0,
            }}>
              <span style={{ color: "#fff", fontSize: 10, fontWeight: 800 }}>AP</span>
            </div>
            <span style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "#c8bfb2", fontWeight: 600 }}>
              Art Protocol
            </span>
          </Link>

          <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {[
              { href: "/app",         label: "Studio",  active: isStudio },
              { href: "/app/credits", label: "Credits", active: isCredits },
            ].map(({ href, label, active }) => (
              <Link key={href} href={href} style={{
                padding: "0.35rem 0.75rem", fontSize: 12, borderRadius: 6,
                textDecoration: "none", fontWeight: active ? 700 : 500,
                color: active ? "#1c1812" : "#b0a090",
                background: active ? "#f0ece5" : "transparent",
                transition: "all 0.15s", letterSpacing: "0.02em",
              }}>
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href="/app/credits" style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "0.35rem 0.85rem", borderRadius: 6,
            border: `1.5px solid ${isLow ? "#e8a02050" : "#ece6dc"}`,
            fontSize: 12, fontWeight: 600, textDecoration: "none",
            color: isLow ? "#e8a020" : "#786b58",
            background: isLow ? "#fff8ee" : "#fff",
            transition: "all 0.15s",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: isLow ? "#e8a020" : "#c8bfb2", boxShadow: isLow ? "0 0 8px rgba(232,160,32,0.5)" : "none" }}/>
            {Math.floor(user.credits).toLocaleString()} Credits
          </Link>

          <span style={{ fontSize: 11, color: "#b0a090", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
            {user.name || user.email}
          </span>

          <button onClick={handleSignOut} style={{
            fontSize: 11, fontWeight: 600, color: "#c8bfb2", background: "none", border: "none",
            cursor: "pointer", letterSpacing: "0.05em", transition: "color 0.15s",
          }}
            onMouseEnter={e => (e.currentTarget.style.color = "#786b58")}
            onMouseLeave={e => (e.currentTarget.style.color = "#c8bfb2")}
          >
            Sign out
          </button>
        </div>
      </header>

      <main style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        {children}
      </main>
    </div>
  );
}
