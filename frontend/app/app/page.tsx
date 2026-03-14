"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/userAuth";

interface Project { id: string; name: string; output_count: number; last_run: string | null; }

const DEPTS = [
  { id: "research",  name: "Intelligence", icon: "◎", color: "#4f8ef0", desc: "Market research & analysis" },
  { id: "branding",  name: "Identity",     icon: "◈", color: "#e8a020", desc: "Brand strategy & visual identity" },
  { id: "social",    name: "Presence",     icon: "◉", color: "#9b5de5", desc: "Social media & content" },
  { id: "ads",       name: "Growth",       icon: "◆", color: "#f15b50", desc: "Ads & campaign strategy" },
  { id: "proposal",  name: "Proposal",     icon: "◇", color: "#2daa6e", desc: "Pitch decks & proposals" },
];

function autoName(brief: string): string {
  return brief.trim().split(/\s+/).slice(0, 5).join(" ").slice(0, 40) || "New Project";
}

export default function StudioPage() {
  const router   = useRouter();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [brief,    setBrief]    = useState("");
  const [selDept,  setSelDept]  = useState("research");
  const [creating, setCreating] = useState(false);
  const [error,    setError]    = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [focused,  setFocused]  = useState(false);

  useEffect(() => {
    apiFetch<Project[]>("/me/projects").then(setProjects).catch(() => {});
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!brief.trim() || creating) return;
    setCreating(true); setError("");
    try {
      const p = await apiFetch<{ id: string }>("/me/projects", {
        method: "POST",
        body: JSON.stringify({ name: autoName(brief), brief: brief.trim() }),
      });
      router.push(`/app/project/${p.id}?dept=${selDept}&start=1`);
    } catch (e: any) { setError(e.message); setCreating(false); }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  }

  const dept = DEPTS.find(d => d.id === selDept)!;

  return (
    <div style={{ minHeight: "calc(100vh - 57px)", display: "flex", flexDirection: "column", background: "#f7f4ef" }}>

      {/* Ambient top glow */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "50vh", pointerEvents: "none",
        background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(79,142,240,0.07) 0%, transparent 70%)" }}/>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem", position: "relative" }}>

        {/* Heading */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <p style={{ fontSize: 11, letterSpacing: "0.35em", color: "#c8bfb2", textTransform: "uppercase", marginBottom: "0.75rem", fontWeight: 600 }}>
            Art Protocol Studio
          </p>
          <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 700, color: "#1c1812", lineHeight: 1.2 }}>
            What are you building?
          </h1>
          <p style={{ fontSize: 14, color: "#a89880", marginTop: "0.6rem" }}>
            Describe your brand, business, or idea. Your AI agency takes it from there.
          </p>
        </div>

        {/* Input card */}
        <div style={{
          width: "100%", maxWidth: 660,
          background: "#fff",
          border: `2px solid ${focused ? dept.color + "60" : "#ece6dc"}`,
          borderRadius: 18,
          boxShadow: focused
            ? `0 0 0 6px ${dept.color}10, 0 20px 60px rgba(0,0,0,0.08)`
            : "0 8px 40px rgba(0,0,0,0.07)",
          transition: "border-color 0.2s, box-shadow 0.2s",
          overflow: "hidden",
        }}>
          <form onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              value={brief}
              onChange={e => setBrief(e.target.value)}
              onKeyDown={handleKey}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Describe what you're building — your brand, business, campaign, or idea. Be specific about who it's for and what makes it different."
              rows={4}
              style={{
                width: "100%", background: "transparent",
                border: "none", outline: "none",
                padding: "1.35rem 1.35rem 0.75rem",
                fontSize: 15, color: "#1c1812",
                lineHeight: 1.75, resize: "none",
                fontFamily: "Inter, sans-serif",
                boxSizing: "border-box",
              }}
            />

            {/* Dept pills + run button */}
            <div style={{ padding: "0.75rem 1rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", borderTop: "1px solid #f0ece5" }}>
              <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                {DEPTS.map(d => (
                  <button key={d.id} type="button" onClick={() => setSelDept(d.id)} title={d.desc}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.3rem",
                      padding: "0.3rem 0.7rem", borderRadius: 20,
                      fontSize: 11, fontWeight: selDept === d.id ? 700 : 500,
                      border: `1.5px solid ${selDept === d.id ? d.color : "#e8e0d5"}`,
                      background: selDept === d.id ? d.color + "15" : "#faf8f5",
                      color: selDept === d.id ? d.color : "#b0a090",
                      cursor: "pointer", transition: "all 0.12s",
                    }}>
                    <span>{d.icon}</span><span>{d.name}</span>
                  </button>
                ))}
              </div>

              <button type="submit" disabled={!brief.trim() || creating}
                style={{
                  display: "flex", alignItems: "center", gap: "0.45rem",
                  padding: "0.6rem 1.35rem",
                  background: brief.trim() ? dept.color : "#e8e0d5",
                  color: brief.trim() ? "#fff" : "#b0a090",
                  border: "none", borderRadius: 10,
                  fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
                  cursor: brief.trim() && !creating ? "pointer" : "not-allowed",
                  transition: "all 0.15s", flexShrink: 0,
                  boxShadow: brief.trim() ? `0 4px 18px ${dept.color}40` : "none",
                }}>
                {creating ? (
                  <><span style={{ width: 12, height: 12, border: "2px solid #fff6", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }}/> Starting...</>
                ) : (
                  <>{dept.icon} Run {dept.name} <span style={{ fontSize: 14 }}>→</span></>
                )}
              </button>
            </div>
          </form>
        </div>

        {error && <p style={{ color: "#e85050", fontSize: 12, marginTop: "1rem", maxWidth: 660, textAlign: "center" }}>{error}</p>}

        <p style={{ fontSize: 11, color: "#c8bfb2", marginTop: "1rem", textAlign: "center" }}>
          Shift+Enter for new line · Enter to run
        </p>

        {/* Dept cards */}
        <div style={{ marginTop: "2.5rem", width: "100%", maxWidth: 660, display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
          {DEPTS.map(d => (
            <div key={d.id} onClick={() => setSelDept(d.id)}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                padding: "0.5rem 0.9rem", borderRadius: 10,
                background: selDept === d.id ? d.color + "12" : "#fff",
                border: `1.5px solid ${selDept === d.id ? d.color + "40" : "#ece6dc"}`,
                cursor: "pointer", transition: "all 0.15s",
              }}>
              <span style={{ fontSize: 16, color: d.color }}>{d.icon}</span>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: selDept === d.id ? d.color : "#1c1812", marginBottom: 1 }}>{d.name}</p>
                <p style={{ fontSize: 10, color: "#b0a090" }}>{d.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Recent projects */}
        {projects.length > 0 && (
          <div style={{ marginTop: "2.5rem", width: "100%", maxWidth: 660 }}>
            <p style={{ fontSize: 10, color: "#c8bfb2", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "0.75rem", fontWeight: 600 }}>Recent</p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {projects.slice(0, 8).map(p => (
                <Link key={p.id} href={`/app/project/${p.id}`} style={{
                  padding: "0.4rem 0.9rem", background: "#fff",
                  border: "1.5px solid #ece6dc", borderRadius: 20,
                  fontSize: 12, fontWeight: 500, color: "#786b58", textDecoration: "none",
                  transition: "all 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#4f8ef0"; e.currentTarget.style.color = "#1c1812"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#ece6dc"; e.currentTarget.style.color = "#786b58"; }}
                >{p.name}</Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
