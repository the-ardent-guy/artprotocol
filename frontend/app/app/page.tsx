"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/userAuth";

interface Project {
  id: string;
  name: string;
  output_count: number;
  last_run: string | null;
}

const STAGE_MAP: Record<string, string> = {
  "Just an idea": "idea",
  "Pre-launch": "pre-launch",
  "Early traction": "early-traction",
  "Scaling": "scaling",
};

const SERVICE_MAP: Record<string, string> = {
  "Understand my market": "research",
  "Define the brand": "branding",
  "Start getting customers": "ads",
  "Build investor interest": "proposal",
};

// ─── Chip ────────────────────────────────────────────────────────────────────
function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "0.6rem 1.2rem",
        background: selected ? "#1c1812" : "#fff",
        border: `2px solid ${selected ? "#1c1812" : "#ece6dc"}`,
        borderRadius: 10,
        fontSize: 13,
        fontWeight: selected ? 700 : 500,
        color: selected ? "#fff" : "#786b58",
        cursor: "pointer",
        transition: "all 0.12s",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.borderColor = "#c8bfb2";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.borderColor = "#ece6dc";
      }}
    >
      {label}
    </button>
  );
}

// ─── Continue button ──────────────────────────────────────────────────────────
function ContinueBtn({
  onClick,
  disabled,
  label = "Continue →",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        marginTop: "1.75rem",
        padding: "0.7rem 2rem",
        background: disabled ? "#e8e0d5" : "#1c1812",
        color: disabled ? "#b0a090" : "#fff",
        border: "none",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "Inter, system-ui, sans-serif",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const brandInputRef = useRef<HTMLInputElement>(null);
  const uspInputRef = useRef<HTMLTextAreaElement>(null);
  const refBrandInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [animDir, setAnimDir] = useState<"forward" | "back">("forward");

  // Answer state
  const [brandName, setBrandName] = useState("");
  const [category, setCategory] = useState("");
  const [audience, setAudience] = useState("");
  const [usp, setUsp] = useState("");
  const [stage, setStage] = useState("");
  const [priceBand, setPriceBand] = useState("");
  const [refBrand, setRefBrand] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [priorityService, setPriorityService] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [dnaProgress, setDnaProgress] = useState(0);

  useEffect(() => {
    apiFetch<Project[]>("/me/projects").then(setProjects).catch(() => {});
  }, []);

  // Auto-focus text inputs after slide animation
  useEffect(() => {
    const t = setTimeout(() => {
      if (step === 0) brandInputRef.current?.focus();
      else if (step === 3) uspInputRef.current?.focus();
      else if (step === 6) refBrandInputRef.current?.focus();
    }, 360);
    return () => clearTimeout(t);
  }, [step]);

  // Progress bar animation for screen 9
  useEffect(() => {
    if (step !== 9) return;
    setDnaProgress(0);
    const start = Date.now();
    const duration = 3000;
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(95, (elapsed / duration) * 95);
      setDnaProgress(pct);
      if (elapsed < duration) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  function advance() {
    setAnimDir("forward");
    setStep((s) => s + 1);
    setError("");
  }

  function retreat() {
    setAnimDir("back");
    setStep((s) => s - 1);
    setError("");
  }

  function chipSelectAndAdvance(setter: (v: string) => void, value: string) {
    setter(value);
    setTimeout(advance, 90);
  }

  function toggleChannel(ch: string) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  }

  async function runOnboarding(finalService: string) {
    setAnimDir("forward");
    setStep(9);
    setLoading(true);
    setError("");
    setDnaProgress(0);

    const mappedStage = STAGE_MAP[stage] || "idea";
    const mappedService = SERVICE_MAP[finalService] || "research";

    try {
      // a. Create project
      const project = await apiFetch<{ id: string }>("/me/projects", {
        method: "POST",
        body: JSON.stringify({ name: brandName.trim(), brief: usp.trim() }),
      });
      const projectId = project.id;

      // b. Save Brand DNA
      await apiFetch(`/me/projects/${projectId}/dna`, {
        method: "POST",
        body: JSON.stringify({
          brand_name: brandName.trim(),
          category,
          audience,
          usp: usp.trim(),
          stage: mappedStage,
          price_band: priceBand,
          reference_brand: refBrand.trim(),
          active_channels: channels,
          priority_service: mappedService,
        }),
      });

      // c. Enrich
      await apiFetch(`/me/projects/${projectId}/dna/enrich`, {
        method: "POST",
      });

      setDnaProgress(100);
      setTimeout(() => {
        router.push(
          `/app/project/${projectId}?from=onboarding&dept=${mappedService}`
        );
      }, 500);
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  // ─── Shared styles ────────────────────────────────────────────────────────
  const TOTAL_STEPS = 9;

  const screenStyle: React.CSSProperties = {
    animation: `${animDir === "forward" ? "slideIn" : "slideInLeft"} 0.35s cubic-bezier(0.22, 0.61, 0.36, 1) both`,
    width: "100%",
    maxWidth: 600,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: "0.3em",
    color: "#c8bfb2",
    textTransform: "uppercase",
    marginBottom: "1.25rem",
    fontWeight: 600,
    fontFamily: "Inter, system-ui, sans-serif",
  };

  const questionStyle: React.CSSProperties = {
    fontSize: "clamp(1.4rem, 3vw, 2rem)",
    fontWeight: 700,
    color: "#1c1812",
    marginBottom: "1.5rem",
    lineHeight: 1.25,
    fontFamily: "Inter, system-ui, sans-serif",
  };

  const chipsWrap: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.75rem",
    justifyContent: "center",
  };

  const textInputStyle: React.CSSProperties = {
    width: "100%",
    background: "#fff",
    border: "2px solid #ece6dc",
    borderRadius: 14,
    padding: "0.85rem 1.25rem",
    fontSize: 15,
    color: "#1c1812",
    outline: "none",
    fontFamily: "Inter, system-ui, sans-serif",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "calc(100vh - 57px)",
        display: "flex",
        flexDirection: "column",
        background: "#f7f4ef",
      }}
    >
      {/* Main area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem 1.5rem",
          overflow: "hidden",
        }}
      >
        {/* Progress bar — screens 1–8 */}
        {step > 0 && step < 9 && (
          <div
            style={{
              width: "100%",
              maxWidth: 600,
              marginBottom: "2rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <button
              onClick={retreat}
              style={{
                background: "none",
                border: "none",
                color: "#b0a090",
                cursor: "pointer",
                fontSize: 13,
                padding: "0.25rem 0.5rem",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              ← Back
            </button>
            <p
              style={{
                fontSize: 11,
                letterSpacing: "0.2em",
                color: "#c8bfb2",
                textTransform: "uppercase",
                fontWeight: 600,
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              Step {step} of {TOTAL_STEPS}
            </p>
            <div style={{ width: 60 }} />
          </div>
        )}

        {/* ── Screen 0: Brand name ── */}
        {step === 0 && (
          <div key="s0" style={screenStyle}>
            <p style={labelStyle}>Art Protocol Studio</p>
            <h1 style={questionStyle}>What's your brand name?</h1>
            <p
              style={{
                fontSize: 13,
                color: "#a89880",
                marginBottom: "1.75rem",
                marginTop: "-0.5rem",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              We'll build your Brand DNA around this.
            </p>

            <div style={{ width: "100%", maxWidth: 480 }}>
              <input
                ref={brandInputRef}
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && brandName.trim()) advance();
                }}
                placeholder="e.g. Aura, Kira, Northseed..."
                style={{ ...textInputStyle, fontSize: 17 }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#d4a043")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#ece6dc")}
              />
              <ContinueBtn
                onClick={advance}
                disabled={!brandName.trim()}
                label="Start Building →"
              />
            </div>

            {/* Recent projects */}
            {projects.length > 0 && (
              <div
                style={{
                  marginTop: "3rem",
                  width: "100%",
                  maxWidth: 480,
                  textAlign: "left",
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    color: "#c8bfb2",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    marginBottom: "0.75rem",
                    fontWeight: 600,
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                >
                  Or continue an existing project:
                </p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {projects.slice(0, 8).map((p) => (
                    <Link
                      key={p.id}
                      href={`/app/project/${p.id}`}
                      style={{
                        padding: "0.4rem 0.9rem",
                        background: "#fff",
                        border: "1.5px solid #ece6dc",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#786b58",
                        textDecoration: "none",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#d4a043";
                        e.currentTarget.style.color = "#1c1812";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#ece6dc";
                        e.currentTarget.style.color = "#786b58";
                      }}
                    >
                      {p.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Screen 1: Q1 — What do you sell? ── */}
        {step === 1 && (
          <div key="s1" style={screenStyle}>
            <p style={labelStyle}>Question 1 of 8</p>
            <h2 style={questionStyle}>What do you sell?</h2>
            <div style={chipsWrap}>
              {["Physical product", "Digital product", "Service", "Marketplace"].map(
                (opt) => (
                  <Chip
                    key={opt}
                    label={opt}
                    selected={category === opt}
                    onClick={() => chipSelectAndAdvance(setCategory, opt)}
                  />
                )
              )}
            </div>
          </div>
        )}

        {/* ── Screen 2: Q2 — Who is it for? ── */}
        {step === 2 && (
          <div key="s2" style={screenStyle}>
            <p style={labelStyle}>Question 2 of 8</p>
            <h2 style={questionStyle}>Who is it for?</h2>
            <div style={chipsWrap}>
              {["Gen Z (18-25)", "Millennials (26-38)", "Working professionals", "B2B"].map(
                (opt) => (
                  <Chip
                    key={opt}
                    label={opt}
                    selected={audience === opt}
                    onClick={() => chipSelectAndAdvance(setAudience, opt)}
                  />
                )
              )}
            </div>
          </div>
        )}

        {/* ── Screen 3: Q3 — USP ── */}
        {step === 3 && (
          <div key="s3" style={screenStyle}>
            <p style={labelStyle}>Question 3 of 8</p>
            <h2 style={questionStyle}>What makes it genuinely different?</h2>
            <p
              style={{
                fontSize: 13,
                color: "#a89880",
                marginBottom: "1.25rem",
                marginTop: "-0.75rem",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              Be specific. This becomes your USP across every output.
            </p>
            <div style={{ width: "100%", maxWidth: 480 }}>
              <textarea
                ref={uspInputRef}
                value={usp}
                onChange={(e) => {
                  if (e.target.value.length <= 200) setUsp(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && usp.trim()) {
                    e.preventDefault();
                    advance();
                  }
                }}
                placeholder="Be specific. This becomes your USP across every output."
                rows={4}
                style={{
                  width: "100%",
                  background: "#fff",
                  border: "2px solid #ece6dc",
                  borderRadius: 14,
                  padding: "1rem 1.25rem",
                  fontSize: 14,
                  color: "#1c1812",
                  lineHeight: 1.7,
                  resize: "none",
                  outline: "none",
                  fontFamily: "Inter, system-ui, sans-serif",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#d4a043")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#ece6dc")}
              />
              <div
                style={{
                  textAlign: "right",
                  fontSize: 11,
                  color: "#c8bfb2",
                  marginTop: "0.35rem",
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
              >
                {usp.length}/200
              </div>
              <ContinueBtn onClick={advance} disabled={!usp.trim()} />
            </div>
          </div>
        )}

        {/* ── Screen 4: Q4 — Journey stage ── */}
        {step === 4 && (
          <div key="s4" style={screenStyle}>
            <p style={labelStyle}>Question 4 of 8</p>
            <h2 style={questionStyle}>Where are you in the journey?</h2>
            <div style={chipsWrap}>
              {["Just an idea", "Pre-launch", "Early traction", "Scaling"].map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={stage === opt}
                  onClick={() => chipSelectAndAdvance(setStage, opt)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Screen 5: Q5 — Price point ── */}
        {step === 5 && (
          <div key="s5" style={screenStyle}>
            <p style={labelStyle}>Question 5 of 8</p>
            <h2 style={questionStyle}>What is the price point?</h2>
            <div style={chipsWrap}>
              {["Under Rs 500", "Rs 500-2,000", "Rs 2,000-10,000", "Rs 10,000+"].map(
                (opt) => (
                  <Chip
                    key={opt}
                    label={opt}
                    selected={priceBand === opt}
                    onClick={() => chipSelectAndAdvance(setPriceBand, opt)}
                  />
                )
              )}
            </div>
          </div>
        )}

        {/* ── Screen 6: Q6 — Reference brand (optional) ── */}
        {step === 6 && (
          <div key="s6" style={screenStyle}>
            <p style={labelStyle}>Question 6 of 8</p>
            <h2 style={questionStyle}>Name one brand whose work you respect</h2>
            <p
              style={{
                fontSize: 13,
                color: "#a89880",
                marginBottom: "1.25rem",
                marginTop: "-0.75rem",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              Optional — helps calibrate tone and aesthetic.
            </p>
            <div style={{ width: "100%", maxWidth: 480 }}>
              <input
                ref={refBrandInputRef}
                type="text"
                value={refBrand}
                onChange={(e) => setRefBrand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") advance();
                }}
                placeholder="e.g. Apple, Zara, Notion, Aesop..."
                style={textInputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#d4a043")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#ece6dc")}
              />
              <ContinueBtn onClick={advance} />
            </div>
          </div>
        )}

        {/* ── Screen 7: Q7 — Channels (multi-select) ── */}
        {step === 7 && (
          <div key="s7" style={screenStyle}>
            <p style={labelStyle}>Question 7 of 8</p>
            <h2 style={questionStyle}>Which channels matter most?</h2>
            <p
              style={{
                fontSize: 13,
                color: "#a89880",
                marginBottom: "1.25rem",
                marginTop: "-0.75rem",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              Select all that apply.
            </p>
            <div style={chipsWrap}>
              {["Instagram", "Reels", "Google Search", "Meta Ads", "LinkedIn", "Email", "D2C"].map(
                (opt) => (
                  <Chip
                    key={opt}
                    label={opt}
                    selected={channels.includes(opt)}
                    onClick={() => toggleChannel(opt)}
                  />
                )
              )}
            </div>
            {channels.length > 0 && <ContinueBtn onClick={advance} />}
          </div>
        )}

        {/* ── Screen 8: Q8 — Priority outcome ── */}
        {step === 8 && (
          <div key="s8" style={screenStyle}>
            <p style={labelStyle}>Question 8 of 8</p>
            <h2 style={questionStyle}>What outcome do you need most urgently?</h2>
            <div style={chipsWrap}>
              {[
                "Understand my market",
                "Define the brand",
                "Start getting customers",
                "Build investor interest",
              ].map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={priorityService === opt}
                  onClick={() => {
                    setPriorityService(opt);
                    setTimeout(() => runOnboarding(opt), 90);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Screen 9: Building Brand DNA ── */}
        {step === 9 && (
          <div
            key="s9"
            style={{
              ...screenStyle,
              animation: "slideIn 0.35s cubic-bezier(0.22, 0.61, 0.36, 1) both",
            }}
          >
            <p style={labelStyle}>Art Protocol Studio</p>
            <h2
              style={{
                ...questionStyle,
                fontSize: "clamp(1.3rem, 2.5vw, 1.75rem)",
              }}
            >
              Building your Brand DNA...
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "#a89880",
                marginBottom: "2.5rem",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              Analysing your answers and generating brand strategy.
            </p>

            {/* Progress bar */}
            <div
              style={{
                width: "100%",
                maxWidth: 400,
                background: "#ece6dc",
                borderRadius: 100,
                height: 6,
                overflow: "hidden",
                marginBottom: "0.75rem",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: "linear-gradient(90deg, #d4a043, #1c1812)",
                  borderRadius: 100,
                  width: `${dnaProgress}%`,
                  transition: "width 0.12s linear",
                }}
              />
            </div>
            <p
              style={{
                fontSize: 12,
                color: "#c8bfb2",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              {Math.round(dnaProgress)}%
            </p>

            {/* Error state */}
            {error && (
              <div
                style={{
                  marginTop: "2rem",
                  padding: "1rem 1.5rem",
                  background: "#fff5f5",
                  border: "1.5px solid #f5c0c0",
                  borderRadius: 12,
                  maxWidth: 400,
                  width: "100%",
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    color: "#c04040",
                    marginBottom: "0.85rem",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                >
                  {error}
                </p>
                <button
                  onClick={() => runOnboarding(priorityService)}
                  style={{
                    padding: "0.5rem 1.25rem",
                    background: "#1c1812",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(52px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideOut {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(-52px); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-52px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
