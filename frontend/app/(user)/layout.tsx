"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getToken, getStoredUser, clearAuth, apiFetch, APUser } from "@/lib/userAuth";
import clsx from "clsx";

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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-5 h-5 border border-[#c9943a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  function handleSignOut() {
    clearAuth();
    router.replace("/");
  }

  const isLowCredits = user.credits < 120;

  return (
    <div className="min-h-screen bg-black flex flex-col">

      {/* Top nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#111] shrink-0">
        <div className="flex items-center gap-6">
          <Link href="/app" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
              <span className="text-black text-[10px] font-bold">AP</span>
            </div>
            <span className="text-xs tracking-[0.2em] uppercase text-white/50 hidden sm:block">
              Art Protocol
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/") && item.href !== "/app";
              const exactActive = item.href === "/app" ? pathname === "/app" || pathname.startsWith("/app/project") : pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "px-3 py-1.5 text-xs rounded-sm transition-colors",
                    exactActive ? "text-white bg-[#111]" : "text-[#555] hover:text-[#999]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {/* Credits */}
          <Link
            href="/app/credits"
            className={clsx(
              "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border transition-colors",
              isLowCredits
                ? "border-[#c9943a]/40 text-[#c9943a] hover:bg-[#c9943a]/5"
                : "border-[#1a1a1a] text-[#555] hover:text-[#999] hover:border-[#2a2a2a]"
            )}
          >
            <span className={clsx("w-1.5 h-1.5 rounded-full", isLowCredits ? "bg-[#c9943a]" : "bg-[#333]")} />
            {Math.floor(user.credits)} cr
          </Link>

          {/* User name */}
          <span className="text-xs text-[#333] hidden md:block">
            {user.name || user.email}
          </span>

          <button
            onClick={handleSignOut}
            className="text-xs text-[#333] hover:text-[#777] transition-colors"
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
