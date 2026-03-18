"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getToken, getStoredUser, clearAuth, apiFetch, APUser } from "@/lib/userAuth";

const NAV = [
  { href: "/app",         label: "Studio" },
  { href: "/app/credits", label: "Credits" },
];

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<APUser | null>(getStoredUser());

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    apiFetch<APUser>("/me")
      .then((u) => { setUser(u); localStorage.setItem("ap_user", JSON.stringify(u)); })
      .catch(() => { clearAuth(); router.replace("/login"); });
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f7f4ef" }}>
        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#d4a043", borderTopColor: "transparent" }} />
      </div>
    );
  }

  function handleSignOut() {
    clearAuth();
    router.replace("/");
  }

  const isLowCredits = user.credits < 120;

  const firstName = (user.name || user.email || "").split(" ")[0];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f7f4ef" }}>

      {/* Top nav */}
      <header className="flex items-center justify-between px-6 shrink-0" style={{ background: "#fff", borderBottom: "1px solid #ece6dc", height: 57 }}>
        <div className="flex items-center gap-6">
          <Link href="/app" className="flex items-center gap-2.5">
            <img src='/ap-logo.png' alt='Art Protocol' style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
            <span className="text-xs tracking-[0.2em] uppercase hidden sm:block" style={{ color: "#1c1812", fontWeight: 600 }}>
              Art Protocol
            </span>
          </Link>
          <nav className="flex items-center">
            {NAV.map((item) => {
              const exactActive = item.href === "/app" ? pathname === "/app" || pathname.startsWith("/app/project") : pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    padding: "0 0.75rem",
                    height: 57,
                    display: "flex",
                    alignItems: "center",
                    fontSize: 13,
                    fontWeight: exactActive ? 600 : 400,
                    color: exactActive ? "#1c1812" : "#a89880",
                    textDecoration: "none",
                    borderBottom: exactActive ? "2px solid #d4a043" : "2px solid transparent",
                    transition: "color 0.15s, border-color 0.15s",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Credits pill */}
          <Link
            href="/app/credits"
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              fontSize: 12, fontWeight: 700,
              padding: "0.35rem 0.85rem", borderRadius: 20,
              textDecoration: "none",
              background: isLowCredits ? "#f15b50" : "#d4a043",
              color: "#fff",
              boxShadow: isLowCredits ? "0 2px 8px rgba(241,91,80,0.35)" : "0 2px 8px rgba(212,160,67,0.3)",
              transition: "opacity 0.15s",
            }}
          >
            <span style={{ fontSize: 10 }}>◆</span>
            {Math.floor(user.credits)} cr
          </Link>

          {/* User first name */}
          <span className="text-xs hidden md:block" style={{ color: "#b0a090", fontWeight: 500 }}>
            {firstName}
          </span>

          <button
            onClick={handleSignOut}
            style={{ fontSize: 12, color: "#b0a090", background: "none", border: "none", cursor: "pointer", fontWeight: 500, transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#1c1812")}
            onMouseLeave={e => (e.currentTarget.style.color = "#b0a090")}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
