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

const SERVICE_MAP: Record<string, string> = {
  "Understand my market": "research",
  "Build the brand identity": "branding",
  "Grow my audience": "social",
  "Set up ads": "ads",
  "Create a pitch deck": "proposal",
};

const STAGE_MAP: Record<string, string> = {
  "Just an idea": "idea",
  "Pre-launch": "pre-launch",
  "Planning": "idea",
  "Just started": "pre-launch",
  "A few episodes in": "early-traction",
  "Launched": "early-traction",
  "Growing": "early-traction",
  "Established": "early-traction",
  "Scaling": "scaling",
  "Going full-time": "scaling",
  "Validating": "pre-launch",
  "Building MVP": "pre-launch",
  "Ready to launch": "pre-launch",
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
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const uspRef = useRef<HTMLTextAreaElement>(null);

  const [step, setStep] = useState(0);
  const [animDir, setAnimDir] = useState<"forward" | "back">("forward");

  // Answer state
  const [projectType, setProjectType] = useState("");
  const [projectName, setProjectName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState<string[]>([]);
  const [usp, setUsp] = useState("");
  const [stage, setStage] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [geography, setGeography] = useState("");
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
      if (step === 1) nameInputRef.current?.focus();
      else if (step === 3) descRef.current?.focus();
      else if (step === 5) uspRef.current?.focus();
    }, 360);
    return () => clearTimeout(t);
  }, [step]);

  // Progress bar animation for screen 9
  useEffect(() => {
    if (step !== 10) return;
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

  function toggleAudience(a: string) {
    setAudience((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  function toggleChannel(ch: string) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  }

  async function runOnboarding(finalService: string) {
    setAnimDir("forward");
    setStep(10);
    setLoading(true);
    setError("");
    setDnaProgress(0);

    const mappedStage = STAGE_MAP[stage] || "idea";
    const mappedService = SERVICE_MAP[finalService] || "research";

    try {
      // a. Create project
      const project = await apiFetch<{ id: string }>("/me/projects", {
        method: "POST",
        body: JSON.stringify({ name: projectName.trim(), brief: description.trim() }),
      });
      const projectId = project.id;

      // b. Save Brand DNA
      await apiFetch(`/me/projects/${projectId}/dna`, {
        method: "POST",
        body: JSON.stringify({
          raw_fields: {
            brand_name: projectName.trim(),
            project_type: projectType,
            what_is_it: description.trim(),
            category,
            audience: audience.join(", "),
            usp: usp.trim(),
            stage: mappedStage,
            active_channels: channels,
            geography,
            priority_service: mappedService,
          },
        }),
      });

      // c. Enrich
      await apiFetch(`/me/projects/${projectId}/dna/enrich`, {
        method: "POST",
      });

      setDnaProgress(100);
      setTimeout(() => {
        router.push(`/app/project/${projectId}/services`);
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

  const categoryOptions: Record<string, string[]> = {
    brand: [
      "Physical Product",
      "Digital Product",
      "SaaS / App",
      "Service Business",
      "D2C",
      "Marketplace",
      "Agency / Studio",
    ],
    content: [
      "Podcast",
      "Talk Show",
      "YouTube Channel",
      "Newsletter",
      "Video Series",
      "Documentary",
      "Live Show",
    ],
    idea: [
      "Consumer Product",
      "Tech / App",
      "Service",
      "Content / Media",
      "Community",
      "Other",
    ],
  };

  const stageOptions: Record<string, string[]> = {
    brand: ["Just an idea", "Pre-launch", "Launched", "Growing", "Scaling"],
    content: ["Planning", "Just started", "A few episodes in", "Established", "Going full-time"],
    idea: ["Just an idea", "Validating", "Building MVP", "Ready to launch"],
  };

  const pt = projectType || "brand";

  const nameHeadline: Record<string, string> = {
    brand: "What's your brand name?",
    content: "What's the name of your show or channel?",
    idea: "Give it a working title",
  };

  const namePlaceholder: Record<string, string> = {
    brand: "e.g. Aura, Bloom, Northseed...",
    content: "e.g. The Founders Pod, Dark Truths, Deep Dive with Raj...",
    idea: "e.g. 'Untitled wellness app', 'the productivity tool thing'...",
  };

  const categoryHeadline: Record<string, string> = {
    brand: "What kind of brand is it?",
    content: "What kind of content is it?",
    idea: "What space is the idea in?",
  };

  const descHeadline: Record<string, string> = {
    brand: "Describe your brand in 1–2 sentences",
    content: "What's the show about?",
    idea: "Describe the idea",
  };

  const descPlaceholder: Record<string, string> = {
    brand: "e.g. A clean skincare brand for Gen Z women who want results, not rituals...",
    content: "e.g. A weekly interview show exploring how Indian founders built their first ₹1 crore...",
    idea: "e.g. An app that helps remote teams run better standups with async video...",
  };

  const uspHeadline: Record<string, string> = {
    brand: "What makes it genuinely different?",
    content: "What makes this show worth following?",
    idea: "What is the core insight behind this idea?",
  };

  const uspPlaceholder: Record<string, string> = {
    brand: "e.g. No fillers, just 3 active ingredients — and it actually works...",
    content: "e.g. We only talk to founders who failed and rebuilt — no success theater...",
    idea: "e.g. Every existing tool treats it as a feature. We are building it as the core product...",
  };

  const channelsHeadline: Record<string, string> = {
    brand: "Which channels matter most?",
    content: "Where does your content live?",
    idea: "Where do you want to reach people?",
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
        {step > 0 && step < 10 && (
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

        {/* ── Screen 0: What are you building? ── */}
        {step === 0 && (
          <div key="s0" style={screenStyle}>
            <p style={labelStyle}>Art Protocol Studio</p>
            <h1 style={questionStyle}>What are you building?</h1>
            <p
              style={{
                fontSize: 13,
                color: "#a89880",
                marginBottom: "2rem",
                marginTop: "-0.5rem",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              This shapes everything — your Brand DNA, the questions, the outputs.
            </p>
            <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {[
                {
                  type: "brand",
                  icon: "🏷️",
                  title: "A Brand",
                  desc: "You have a product, service, or business — physical, digital, or D2C.",
                },
                {
                  type: "content",
                  icon: "🎙️",
                  title: "A Show or Channel",
                  desc: "Podcast, talk show, YouTube channel, newsletter, or media brand.",
                },
                {
                  type: "idea",
                  icon: "💡",
                  title: "An Idea",
                  desc: "You're validating a concept — no name, no product yet.",
                },
              ].map((opt) => {
                const isSelected = projectType === opt.type;
                return (
                  <div
                    key={opt.type}
                    onClick={() => {
                      setProjectType(opt.type);
                      setTimeout(advance, 90);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "1rem",
                      background: isSelected ? "#faf8f4" : "#fff",
                      border: `2px solid ${isSelected ? "#1c1812" : "#ece6dc"}`,
                      borderRadius: 14,
                      padding: "1.25rem 1.5rem",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLDivElement).style.borderColor = "#d4a043";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLDivElement).style.borderColor = "#ece6dc";
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: "#f5f0e8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        flexShrink: 0,
                      }}
                    >
                      {opt.icon}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "#1c1812",
                          fontFamily: "Inter, system-ui, sans-serif",
                        }}
                      >
                        {opt.title}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#a89880",
                          marginTop: "0.2rem",
                          fontFamily: "Inter, system-ui, sans-serif",
                        }}
                      >
                        {opt.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
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

        {/* ── Screen 1: Name ── */}
        {step === 1 && (
          <div key="s1" style={screenStyle}>
            <p style={labelStyle}>Step 1 of 9</p>
            <h2 style={questionStyle}>{nameHeadline[pt]}</h2>
            {pt === "idea" && (
              <p
                style={{
                  fontSize: 13,
                  color: "#a89880",
                  marginBottom: "1.25rem",
                  marginTop: "-0.75rem",
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
              >
                Can be a placeholder — you can rename it later.
              </p>
            )}
            <div style={{ width: "100%", maxWidth: 480 }}>
              <input
                ref={nameInputRef}
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && projectName.trim()) advance();
                }}
                placeholder={namePlaceholder[pt]}
                style={{ ...textInputStyle, fontSize: 17 }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#d4a043")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#ece6dc")}
              />
              <ContinueBtn
                onClick={advance}
                disabled={!projectName.trim()}
                label="Continue →"
              />
            </div>
          </div>
        )}

        {/* ── Screen 2: Category ── */}
        {step === 2 && (
          <div key="s2" style={screenStyle}>
            <p style={labelStyle}>Step 2 of 9</p>
            <h2 style={questionStyle}>{categoryHeadline[pt]}</h2>
            <div style={chipsWrap}>
              {(categoryOptions[pt] || []).map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={category === opt}
                  onClick={() => chipSelectAndAdvance(setCategory, opt)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Screen 3: Description ── */}
        {step === 3 && (
          <div key="s3" style={screenStyle}>
            <p style={labelStyle}>Step 3 of 9</p>
            <h2 style={questionStyle}>{descHeadline[pt]}</h2>
            <div style={{ width: "100%", maxWidth: 480 }}>
              <textarea
                ref={descRef}
                value={description}
                onChange={(e) => {
                  if (e.target.value.length <= 300) setDescription(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && description.trim()) {
                    e.preventDefault();
                    advance();
                  }
                }}
                placeholder={descPlaceholder[pt]}
                rows={3}
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
                {description.length}/300
              </div>
              <ContinueBtn onClick={advance} disabled={!description.trim()} />
            </div>
          </div>
        )}

        {/* ── Screen 4: Audience ── */}
        {step === 4 && (
          <div key="s4" style={screenStyle}>
            <p style={labelStyle}>Step 4 of 9</p>
            <h2 style={questionStyle}>Who is this for?</h2>
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
              {[
                "Founders & Entrepreneurs",
                "Students",
                "Working Professionals",
                "Gen Z",
                "Millennials",
                "Parents",
                "Creators & Influencers",
                "B2B Teams",
                "Global Audience",
                "Niche Community",
              ].map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={audience.includes(opt)}
                  onClick={() => toggleAudience(opt)}
                />
              ))}
            </div>
            {audience.length > 0 && <ContinueBtn onClick={advance} />}
          </div>
        )}

        {/* ── Screen 5: USP ── */}
        {step === 5 && (
          <div key="s5" style={screenStyle}>
            <p style={labelStyle}>Step 5 of 9</p>
            <h2 style={questionStyle}>{uspHeadline[pt]}</h2>
            <div style={{ width: "100%", maxWidth: 480 }}>
              <textarea
                ref={uspRef}
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
                placeholder={uspPlaceholder[pt]}
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

        {/* ── Screen 6: Stage ── */}
        {step === 6 && (
          <div key="s6" style={screenStyle}>
            <p style={labelStyle}>Step 6 of 9</p>
            <h2 style={questionStyle}>Where are you right now?</h2>
            <div style={chipsWrap}>
              {(stageOptions[pt] || []).map((opt) => (
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

        {/* ── Screen 7: Channels ── */}
        {step === 7 && (
          <div key="s7" style={screenStyle}>
            <p style={labelStyle}>Step 7 of 9</p>
            <h2 style={questionStyle}>{channelsHeadline[pt]}</h2>
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
              {[
                "Instagram",
                "YouTube",
                "Reels / Short Video",
                "Spotify / Podcasts",
                "LinkedIn",
                "Meta Ads",
                "Google Search",
                "X (Twitter)",
                "Email / Newsletter",
                "WhatsApp",
                "D2C / Website",
              ].map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={channels.includes(opt)}
                  onClick={() => toggleChannel(opt)}
                />
              ))}
            </div>
            {channels.length > 0 && <ContinueBtn onClick={advance} />}
          </div>
        )}

        {/* ── Screen 8: Geography ── */}
        {step === 8 && (
          <div key="s8" style={screenStyle}>
            <p style={labelStyle}>Step 8 of 9</p>
            <h2 style={questionStyle}>Where is your primary market?</h2>
            <p
              style={{
                fontSize: 13,
                color: "#a89880",
                marginBottom: "1.25rem",
                marginTop: "-0.75rem",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              Shapes competitor research, pricing benchmarks & platform strategy.
            </p>
            <div style={chipsWrap}>
              {[
                "India",
                "South / Southeast Asia",
                "Middle East",
                "US / Canada",
                "UK / Europe",
                "Australia / NZ",
                "Global",
              ].map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={geography === opt}
                  onClick={() => chipSelectAndAdvance(setGeography, opt)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Screen 9: Priority outcome ── */}
        {step === 9 && (
          <div key="s9p" style={screenStyle}>
            <p style={labelStyle}>Step 9 of 9</p>
            <h2 style={questionStyle}>What do you need most right now?</h2>
            <p
              style={{
                fontSize: 13,
                color: "#a89880",
                marginBottom: "1.5rem",
                marginTop: "-0.75rem",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              We'll recommend where to start.
            </p>
            <div style={chipsWrap}>
              {[
                "Understand my market",
                "Build the brand identity",
                "Grow my audience",
                "Set up ads",
                "Create a pitch deck",
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

        {/* ── Screen 10: Building Brand DNA ── */}
        {step === 10 && (
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
