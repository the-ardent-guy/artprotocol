"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, getToken } from "@/lib/userAuth";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Project     { id: string; name: string; brief: string; }
interface RawDNA      { brand_name?: string; what_is_it?: string; category?: string; audience?: string; usp?: string; stage?: string; active_channels?: string[]; }
interface DNA         { raw_fields: RawDNA | null; enriched_fields: Record<string, any> | null; }
interface Deliverable { filename: string; path: string; crew: string; created: string; locked: boolean; }
type RunStatus        = "idle" | "running" | "done" | "error";

interface ServiceRun {
  status:       RunStatus;
  lines:        string[];
  deliverable?: Deliverable;
  error?:       string;
}

interface DeltaQuestion {
  key:          string;
  label:        string;
  placeholder:  string;
  required?:    boolean;
}

interface ServiceConfig {
  id:              string;
  name:            string;
  icon:            string;
  color:           string;
  bg:              string;
  eta:             string;
  cost:            number;
  description:     string;
  dualEntry?:      boolean;
  openLabel?:      string;
  openPlaceholder?:string;
  deltaQuestions?: DeltaQuestion[];
  acceptsFiles?:      boolean;
  fileLabel?:         string;
  acceptsImages?:     boolean;
  acceptsPrimaryData?: boolean;
}

// ── Service definitions ───────────────────────────────────────────────────────
const SERVICES: ServiceConfig[] = [
  {
    id: "research", name: "Research", icon: "◎", color: "#4f8ef0", bg: "#eef4ff",
    eta: "3-5 min", cost: 120,
    description: "Market landscape, competitor intel, trend mapping & opportunity analysis.",
    dualEntry: true,
    openLabel: "What do you want to research?",
    openPlaceholder: "e.g. D2C pet supplements market, AI productivity tools in India, creator economy 2025...",
    deltaQuestions: [
      { key: "focus", label: "Specific angle or competitors to focus on?", placeholder: "Optional - press Enter to skip" },
    ],
    acceptsImages: true,
    acceptsPrimaryData: true,
  },
  {
    id: "branding", name: "Identity", icon: "◈", color: "#e8a020", bg: "#fff8ee",
    eta: "10-15 min", cost: 350,
    description: "Brand strategy, visual identity system, positioning & tone of voice.",
    deltaQuestions: [
      { key: "personality", label: "Desired brand personality", placeholder: "e.g. bold & minimal, warm & premium, playful but credible" },
    ],
    acceptsFiles: true,
    fileLabel: "Drop existing brand guidelines (PDF - optional)",
    acceptsImages: true,
    acceptsPrimaryData: true,
  },
  {
    id: "social", name: "Social Media", icon: "◉", color: "#9b5de5", bg: "#f6f0ff",
    eta: "10-15 min", cost: 350,
    description: "Content strategy, platform playbooks, 30-day calendar & captions.",
    dualEntry: true,
    openLabel: "Audit a brand or creator",
    openPlaceholder: "e.g. @nikerunning on Instagram, a fintech brand on LinkedIn, a creator's YouTube presence...",
    deltaQuestions: [
      { key: "platforms", label: "Priority platforms", placeholder: "e.g. Instagram, LinkedIn, X - blank to use DNA" },
      { key: "tone",      label: "Tone of voice",       placeholder: "e.g. bold, playful, professional" },
    ],
    acceptsImages: true,
  },
  {
    id: "ads", name: "Growth", icon: "◆", color: "#f15b50", bg: "#fff1f0",
    eta: "8-12 min", cost: 400,
    description: "Ad strategy, high-converting copy, campaign architecture & audience targeting.",
    dualEntry: true,
    openLabel: "Analyse a category or competitor's ads",
    openPlaceholder: "e.g. Meta ads in D2C fashion, Google Ads for Indian EdTech, competitor ad teardown...",
    deltaQuestions: [
      { key: "product",   label: "Specific product or offer to promote", placeholder: "Optional - blank to use Brand DNA" },
      { key: "budget",    label: "Monthly ad budget",                    placeholder: "e.g. ₹50,000 / $2,000" },
      { key: "platforms", label: "Ad platforms",                         placeholder: "e.g. Meta, Google, YouTube" },
    ],
    acceptsImages: true,
  },
  {
    id: "proposal", name: "Decks", icon: "◇", color: "#2daa6e", bg: "#edfaf4",
    eta: "5-8 min", cost: 180,
    description: "Client proposals, investor decks & pitch narratives with pricing.",
    deltaQuestions: [
      { key: "client_name", label: "Client name", placeholder: "Who is this deck for?", required: true },
      { key: "challenge",   label: "Their main challenge or goal", placeholder: "What problem are they trying to solve?" },
      { key: "services",    label: "Services being proposed", placeholder: "e.g. Brand Identity + Social Media" },
    ],
  },
];

const COMING_SOON = [
  { id: "shopify", name: "Shopify Audit",  icon: "◍", color: "#95bf47", description: "Store review, CRO & conversion recommendations" },
  { id: "email",   name: "Email Flows",    icon: "◌", color: "#e8a020", description: "Welcome sequences, nurture & retention flows" },
  { id: "seo",     name: "SEO Blueprint",  icon: "◐", color: "#4f8ef0", description: "Keyword mapping, content clusters, on-page strategy" },
];

const ORDER: string[] = ["research", "branding", "social", "ads", "proposal"];

function getSvc(id: string) { return SERVICES.find(s => s.id === id) ?? SERVICES[0]; }

// ── Image thumbnail ───────────────────────────────────────────────────────────
function ImgThumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
      <img src={src} alt="" style={{ width: 72, height: 72, borderRadius: 8, objectFit: "cover", border: "1.5px solid #e8e0d5", display: "block" }} />
      <button
        onClick={onRemove}
        style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#1c1812", border: "none", color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, lineHeight: 1 }}
      >✕</button>
    </div>
  );
}

// ── Intake Modal ──────────────────────────────────────────────────────────────
function IntakeModal({ service, dna, project, onClose, onLaunch }: {
  service:  ServiceConfig;
  dna:      DNA | null;
  project:  Project | null;
  onClose:  () => void;
  onLaunch: (brief: Record<string, string>) => void;
}) {
  const [entryMode,    setEntryMode]    = useState<"brand" | "open">("brand");
  const [openQuery,    setOpenQuery]    = useState("");
  const [answers,      setAnswers]      = useState<Record<string, string>>({});
  const [droppedFile,  setDroppedFile]  = useState<File | null>(null);
  const [isDragging,   setIsDragging]   = useState(false);
  const [images,       setImages]       = useState<{ file: File; preview: string; b64: string }[]>([]);
  const [imgDragging,  setImgDragging]  = useState(false);
  const [analyzingImg, setAnalyzingImg] = useState(false);
  const [primaryData,  setPrimaryData]  = useState("");
  const [pdExpanded,   setPdExpanded]   = useState(false);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const imgInputRef   = useRef<HTMLInputElement>(null);

  const dnaFields = dna?.raw_fields ?? {};
  const requiredQ = service.deltaQuestions?.find(q => q.required);
  const canLaunch = analyzingImg ? false : entryMode === "open"
    ? openQuery.trim().length > 0
    : !requiredQ || !!answers[requiredQ.key]?.trim();

  // Read file as base64
  function readB64(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload  = () => res((fr.result as string).split(",")[1]);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }

  async function addImages(files: FileList | null) {
    if (!files) return;
    const allowed = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, 4 - images.length);
    if (!allowed.length) return;
    const loaded = await Promise.all(allowed.map(async f => ({
      file:    f,
      preview: URL.createObjectURL(f),
      b64:     await readB64(f),
    })));
    setImages(p => [...p, ...loaded].slice(0, 4));
  }

  function removeImage(idx: number) {
    setImages(p => { URL.revokeObjectURL(p[idx].preview); return p.filter((_, i) => i !== idx); });
  }

  // Analyse images via backend → get structured product_visual_context
  async function analyseImages(): Promise<string> {
    if (!images.length) return "";
    setAnalyzingImg(true);
    try {
      const token = getToken();
      const res = await fetch("/api/backend/me/analyse-images", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          images:  images.map(i => ({ b64: i.b64, mime: i.file.type })),
          context: `${dnaFields.brand_name || project?.name || ""} - ${dnaFields.what_is_it || ""}`,
        }),
      });
      if (!res.ok) return "";
      const data = await res.json();
      return data.visual_context ?? "";
    } catch { return ""; }
    finally { setAnalyzingImg(false); }
  }

  async function handleLaunch() {
    if (!canLaunch) return;
    const visualCtx = images.length ? await analyseImages() : "";

    if (entryMode === "open") {
      onLaunch({
        brand_name:           openQuery.trim(),
        what_it_is:           openQuery.trim(),
        query:                openQuery.trim(),
        notes:                openQuery.trim(),
        _open_mode:           "true",
        ...(visualCtx ? { product_visual_context: visualCtx } : {}),
      });
      return;
    }
    onLaunch({
      brand_name:            dnaFields.brand_name  || project?.name  || "",
      what_it_is:            dnaFields.what_is_it  || project?.brief || "",
      category:              dnaFields.category    || "",
      target_audience:       dnaFields.audience    || "",
      usp:                   dnaFields.usp         || "",
      notes:                 project?.brief        || "",
      query:                 dnaFields.brand_name  || project?.name  || "",
      ...(droppedFile ? { _attached_file: droppedFile.name } : {}),
      ...(visualCtx ? { product_visual_context: visualCtx } : {}),
      ...(primaryData.trim() ? { primary_data: primaryData.trim() } : {}),
      ...answers,
    });
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setDroppedFile(f);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(28,24,18,0.72)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.28)" }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #ece6dc", background: service.bg, display: "flex", alignItems: "center", gap: "0.75rem", borderRadius: "20px 20px 0 0", flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: service.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, color: "#fff", flexShrink: 0, boxShadow: `0 4px 12px ${service.color}45` }}>
            {service.icon}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#1c1812" }}>{service.name}</p>
            <p style={{ fontSize: 11, color: service.color }}>~{service.eta} · {service.cost} credits</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: "#b0a090", cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: "1.5rem" }}>

          {/* Dual-entry toggle */}
          {service.dualEntry && (
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", background: "#f7f4ef", borderRadius: 10, padding: "0.3rem" }}>
              {(["brand", "open"] as const).map(mode => {
                const isSelected = entryMode === mode;
                return (
                  <button key={mode} onClick={() => setEntryMode(mode)}
                    style={{ flex: 1, padding: "0.6rem", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", background: isSelected ? "#fff" : "transparent", color: isSelected ? service.color : "#b0a090", boxShadow: isSelected ? "0 1px 6px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}
                  >
                    {mode === "brand" ? "🏷 Brand mode" : "🔍 Open research"}
                  </button>
                );
              })}
            </div>
          )}

          {/* OPEN MODE */}
          {entryMode === "open" && service.dualEntry && (
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#b0a090", display: "block", marginBottom: "0.5rem" }}>{service.openLabel}</label>
              <textarea autoFocus value={openQuery} onChange={e => setOpenQuery(e.target.value)} placeholder={service.openPlaceholder} rows={3}
                style={{ width: "100%", border: `2px solid ${service.color}40`, borderRadius: 10, padding: "0.85rem 1rem", fontSize: 13, color: "#1c1812", lineHeight: 1.65, resize: "none", outline: "none", fontFamily: "Inter, system-ui, sans-serif", boxSizing: "border-box", transition: "border-color 0.15s" }}
                onFocus={e => (e.currentTarget.style.borderColor = service.color)}
                onBlur={e  => (e.currentTarget.style.borderColor = `${service.color}40`)}
              />
              <p style={{ fontSize: 11, color: "#c8bfb2", marginTop: "0.35rem" }}>No brand DNA required - runs as a standalone job.</p>
            </div>
          )}

          {/* BRAND MODE */}
          {entryMode === "brand" && (
            <>
              {(dnaFields.brand_name || project?.name) && (
                <div style={{ background: "#f7f4ef", borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span style={{ fontSize: 16 }}>🏷</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#1c1812" }}>{dnaFields.brand_name || project?.name}</p>
                    {dnaFields.what_is_it && <p style={{ fontSize: 11, color: "#a89880", lineHeight: 1.5, marginTop: 2 }}>{dnaFields.what_is_it.slice(0, 80)}{dnaFields.what_is_it.length > 80 ? "…" : ""}</p>}
                  </div>
                  <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, color: "#2daa6e", background: "#edfaf4", borderRadius: 4, padding: "0.15rem 0.45rem" }}>DNA ✓</span>
                </div>
              )}
              {service.deltaQuestions && service.deltaQuestions.map(q => (
                <div key={q.key} style={{ marginBottom: "1rem" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#b0a090", display: "block", marginBottom: "0.4rem" }}>
                    {q.label}{q.required ? " *" : " (optional)"}
                  </label>
                  <input type="text" value={answers[q.key] ?? ""} onChange={e => setAnswers(p => ({ ...p, [q.key]: e.target.value }))} placeholder={q.placeholder}
                    style={{ width: "100%", border: "1.5px solid #ece6dc", borderRadius: 9, padding: "0.7rem 0.9rem", fontSize: 13, color: "#1c1812", outline: "none", fontFamily: "Inter, system-ui, sans-serif", boxSizing: "border-box", transition: "border-color 0.15s" }}
                    onFocus={e => (e.currentTarget.style.borderColor = service.color)}
                    onBlur={e  => (e.currentTarget.style.borderColor = "#ece6dc")}
                  />
                </div>
              ))}
              {service.acceptsFiles && (
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: `2px dashed ${isDragging ? service.color : droppedFile ? "#2daa6e" : "#ddd8d0"}`, borderRadius: 10, padding: "1rem", textAlign: "center", cursor: "pointer", background: isDragging ? service.bg : droppedFile ? "#edfaf4" : "#faf8f5", transition: "all 0.15s", marginBottom: "1rem" }}
                >
                  <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) setDroppedFile(e.target.files[0]); }} />
                  {droppedFile
                    ? <p style={{ fontSize: 12, fontWeight: 600, color: "#2daa6e" }}>📄 {droppedFile.name}</p>
                    : <><p style={{ fontSize: 12, color: "#b0a090", marginBottom: "0.2rem" }}>↑ {service.fileLabel || "Drop a PDF"}</p><p style={{ fontSize: 10, color: "#c8bfb2" }}>PDF only</p></>
                  }
                </div>
              )}
            </>
          )}

          {/* ── Product images (brand mode OR open mode if acceptsImages) ── */}
          {service.acceptsImages && (entryMode === "brand" || service.dualEntry) && (
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#b0a090", display: "block", marginBottom: "0.4rem" }}>
                Product images <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional · up to 4)</span>
              </label>
              <p style={{ fontSize: 11, color: "#c8bfb2", marginBottom: "0.65rem", lineHeight: 1.5 }}>
                Drop product photos, packaging, or inspiration. AI analyses them to understand your product better before running.
              </p>

              {/* Thumbnails row */}
              {images.length > 0 && (
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.65rem" }}>
                  {images.map((img, idx) => <ImgThumb key={idx} src={img.preview} onRemove={() => removeImage(idx)} />)}
                </div>
              )}

              {/* Drop zone */}
              {images.length < 4 && (
                <div
                  onDragOver={e => { e.preventDefault(); setImgDragging(true); }}
                  onDragLeave={() => setImgDragging(false)}
                  onDrop={e => { e.preventDefault(); setImgDragging(false); addImages(e.dataTransfer.files); }}
                  onClick={() => imgInputRef.current?.click()}
                  style={{ border: `2px dashed ${imgDragging ? service.color : "#ddd8d0"}`, borderRadius: 10, padding: "0.85rem", textAlign: "center", cursor: "pointer", background: imgDragging ? service.bg : "#faf8f5", transition: "all 0.15s" }}
                >
                  <input ref={imgInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => addImages(e.target.files)} />
                  <p style={{ fontSize: 12, color: "#b0a090" }}>📷 Drop images or click to browse</p>
                  <p style={{ fontSize: 10, color: "#c8bfb2", marginTop: "0.2rem" }}>JPG, PNG, WEBP · {4 - images.length} slot{4 - images.length !== 1 ? "s" : ""} remaining</p>
                </div>
              )}
            </div>
          )}

          {/* Primary research data upload */}
          {service.acceptsPrimaryData && (
            <div style={{ marginBottom: "1.25rem" }}>
              <button
                onClick={() => setPdExpanded(p => !p)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: pdExpanded ? "#fff8ee" : "#faf8f5", border: `1.5px solid ${pdExpanded ? "#e8a020" : "#e8e0d5"}`, borderRadius: 10, padding: "0.75rem 1rem", cursor: "pointer", marginBottom: pdExpanded ? "0.75rem" : 0, transition: "all 0.15s" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span style={{ fontSize: 15 }}>🔬</span>
                  <div style={{ textAlign: "left" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#1c1812", fontFamily: "Inter, sans-serif" }}>Add Primary Research Data</p>
                    <p style={{ fontSize: 11, color: "#a89880", fontFamily: "Inter, sans-serif" }}>Surveys, interviews, observations — nearly 2× better outputs</p>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: "#c8bfb2" }}>{pdExpanded ? "▲" : "▼"}</span>
              </button>
              {pdExpanded && (
                <div>
                  <div style={{ background: "#fff8ee", border: "1px solid #e8a02030", borderRadius: 8, padding: "0.65rem 0.9rem", marginBottom: "0.6rem" }}>
                    <p style={{ fontSize: 11, color: "#a07010", fontFamily: "Inter, sans-serif", lineHeight: 1.6 }}>
                      <strong>Primary data gives the AI what no desk research can find.</strong> Paste survey results, interview notes, customer quotes, focus group findings, NPS data, or any first-hand observations. The agents will integrate this as the highest-quality signal and build the strategy around your actual customers — not assumptions.
                    </p>
                  </div>
                  <textarea
                    value={primaryData}
                    onChange={e => setPrimaryData(e.target.value)}
                    placeholder={"Paste your primary research here...\n\ne.g.\n- Survey: 78% of respondents said price was not the main barrier\n- Interview with 6 customers: all mentioned 'trust' as the #1 purchase driver\n- NPS: 67 (promoters mention 'ease of use')\n- Common objection: 'I don't know if it will work for me'"}
                    rows={7}
                    style={{ width: "100%", background: "#fff", border: "1.5px solid #e8e0d5", borderRadius: 10, padding: "0.85rem 1rem", fontSize: 12, color: "#1c1812", lineHeight: 1.7, resize: "vertical", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box", transition: "border-color 0.15s" }}
                    onFocus={e => (e.currentTarget.style.borderColor = "#e8a020")}
                    onBlur={e => (e.currentTarget.style.borderColor = "#e8e0d5")}
                  />
                  {primaryData.trim() && (
                    <p style={{ fontSize: 10, color: "#2daa6e", marginTop: "0.35rem", fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
                      ✓ {primaryData.trim().split(/\s+/).length} words of primary data will be injected into every agent
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Launch button */}
          <button
            onClick={handleLaunch}
            disabled={!canLaunch}
            style={{ width: "100%", padding: "0.85rem", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700, background: canLaunch ? service.color : "#e8e0d5", color: canLaunch ? "#fff" : "#b0a090", cursor: canLaunch ? "pointer" : "not-allowed", transition: "all 0.15s", boxShadow: canLaunch ? `0 4px 16px ${service.color}45` : "none" }}
          >
            {analyzingImg
              ? "🔍 Analysing your images..."
              : images.length > 0
              ? `Run ${service.name} with ${images.length} image${images.length > 1 ? "s" : ""} →`
              : entryMode === "open"
              ? `Research "${openQuery.slice(0, 28)}${openQuery.length > 28 ? "…" : ""}" →`
              : `Run ${service.name} →`
            }
          </button>
          {images.length > 0 && !analyzingImg && (
            <p style={{ fontSize: 11, color: "#c8bfb2", textAlign: "center", marginTop: "0.4rem" }}>
              Images will be analysed by AI before the run starts
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Full-Stack Modal ──────────────────────────────────────────────────────────
function FullStackModal({ onClose, onLaunch, running }: {
  onClose: () => void;
  onLaunch: () => void;
  running: boolean;
}) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(28,24,18,0.72)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 420, padding: "2rem", boxShadow: "0 24px 80px rgba(0,0,0,0.28)", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "#1c1812", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#f7f4ef", margin: "0 auto 1.25rem", boxShadow: "0 6px 20px rgba(28,24,18,0.25)" }}>⚡</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1c1812", marginBottom: "0.5rem", fontFamily: "Playfair Display, serif" }}>Full Stack Run</h2>
        <p style={{ fontSize: 13, color: "#a89880", lineHeight: 1.7, marginBottom: "1.5rem" }}>
          Runs all 5 services in sequence using your Brand DNA.<br />
          <strong style={{ color: "#1c1812" }}>Research → Identity → Social → Growth → Decks</strong>
        </p>
        <div style={{ background: "#f7f4ef", borderRadius: 10, padding: "0.85rem 1rem", marginBottom: "1.5rem", textAlign: "left" }}>
          {SERVICES.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.3rem 0" }}>
              <span style={{ color: s.color, fontSize: 14, flexShrink: 0 }}>{s.icon}</span>
              <span style={{ fontSize: 12, color: "#4a3f35", flex: 1 }}>{s.name}</span>
              <span style={{ fontSize: 10, color: s.color, background: s.bg, borderRadius: 4, padding: "0.1rem 0.45rem", fontWeight: 600 }}>{s.cost} Credits</span>
              {i < SERVICES.length - 1 && <span style={{ fontSize: 10, color: "#c8bfb2" }}>~{s.eta}</span>}
            </div>
          ))}
          <div style={{ borderTop: "1px solid #ece6dc", marginTop: "0.5rem", paddingTop: "0.5rem", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#786b58" }}>Total</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#1c1812" }}>{SERVICES.reduce((a, s) => a + s.cost, 0)} credits · ~35-50 min</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "0.75rem", borderRadius: 10, border: "1.5px solid #ece6dc", background: "#fff", color: "#786b58", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={onLaunch} disabled={running} style={{ flex: 2, padding: "0.75rem", borderRadius: 10, border: "none", background: "#1c1812", color: "#fff", fontSize: 13, fontWeight: 700, cursor: running ? "not-allowed" : "pointer", boxShadow: "0 4px 16px rgba(28,24,18,0.25)" }}>
            {running ? "Launching..." : "Launch Full Stack →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ServicesPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [project,  setProject]  = useState<Project | null>(null);
  const [dna,      setDNA]      = useState<DNA | null>(null);
  const [runs,     setRuns]     = useState<Record<string, ServiceRun>>({});
  const [openSvc,  setOpenSvc]  = useState<ServiceConfig | null>(null);
  const [showFS,   setShowFS]   = useState(false);
  const [fsRunning,setFSRunning]= useState(false);
  const [loading,  setLoading]  = useState(true);
  const esRefs = useRef<Record<string, EventSource>>({});

  useEffect(() => {
    (async () => {
      try {
        const [proj, dels, dnaData] = await Promise.all([
          apiFetch<Project>(`/me/projects/${id}`),
          apiFetch<Deliverable[]>(`/me/projects/${id}/deliverables`),
          apiFetch<DNA>(`/me/projects/${id}/dna`).catch(() => ({ raw_fields: null, enriched_fields: null })),
        ]);
        setProject(proj);
        setDNA(dnaData);

        // Seed runs with existing deliverables
        const seedRuns: Record<string, ServiceRun> = {};
        dels.forEach(d => {
          seedRuns[d.crew] = { status: "done", lines: [], deliverable: d };
        });
        setRuns(seedRuns);
      } catch { /* silent */ }
      setLoading(false);
    })();

    return () => {
      Object.values(esRefs.current).forEach(es => es.close());
    };
  }, [id]);

  function setRunState(svcId: string, patch: Partial<ServiceRun>) {
    setRuns(p => ({ ...p, [svcId]: { ...(p[svcId] ?? { status: "idle", lines: [] }), ...patch } }));
  }

  async function launchService(svcId: string, brief: Record<string, string>) {
    setOpenSvc(null);
    setRunState(svcId, { status: "running", lines: [], error: undefined });

    try {
      const job = await apiFetch<{ job_id: string }>("/me/run-crew", {
        method: "POST",
        body: JSON.stringify({ project_id: id, crew_name: svcId, brief }),
      });

      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const es   = new EventSource(`${base}/me/stream/${job.job_id}?api_key=${getToken()}`);
      esRefs.current[svcId] = es;

      es.onmessage = evt => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === "line") {
            setRuns(p => {
              const prev = p[svcId] ?? { status: "running" as const, lines: [] };
              return { ...p, [svcId]: { ...prev, lines: [...prev.lines, data.text] } };
            });
          } else if (data.type === "done") {
            es.close();
            delete esRefs.current[svcId];
            apiFetch<Deliverable[]>(`/me/projects/${id}/deliverables`).then(dels => {
              const d = dels.find(d => d.crew === svcId);
              setRunState(svcId, { status: "done", deliverable: d });
            }).catch(() => setRunState(svcId, { status: "done" }));
          } else if (data.type === "error") {
            es.close();
            delete esRefs.current[svcId];
            setRunState(svcId, { status: "error", error: data.text ?? "Something went wrong." });
          }
        } catch { /* ignore */ }
      };
      es.onerror = () => {
        es.close();
        delete esRefs.current[svcId];
        setRunState(svcId, { status: "error", error: "Stream disconnected." });
      };
    } catch (e: any) {
      setRunState(svcId, { status: "error", error: e.message });
    }
  }

  async function launchFullStack() {
    setShowFS(false);
    setFSRunning(true);
    // Fire in sequence - each one waits for the prior to finish
    for (const svcId of ORDER) {
      const svc = getSvc(svcId);
      const dnaFields = dna?.raw_fields ?? {};
      const brief: Record<string, string> = {
        brand_name:      dnaFields.brand_name  || project?.name  || "",
        what_it_is:      dnaFields.what_is_it  || project?.brief || "",
        category:        dnaFields.category    || "",
        target_audience: dnaFields.audience    || "",
        usp:             dnaFields.usp         || "",
        notes:           project?.brief        || "",
        query:           dnaFields.brand_name  || project?.name  || "",
      };
      await new Promise<void>(resolve => {
        setRunState(svcId, { status: "running", lines: [], error: undefined });
        apiFetch<{ job_id: string }>("/me/run-crew", {
          method: "POST",
          body: JSON.stringify({ project_id: id, crew_name: svcId, brief }),
        }).then(job => {
          const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          const es   = new EventSource(`${base}/me/stream/${job.job_id}?api_key=${getToken()}`);
          esRefs.current[svcId] = es;
          es.onmessage = evt => {
            try {
              const data = JSON.parse(evt.data);
              if (data.type === "line") {
                setRuns(p => {
                  const prev = p[svcId] ?? { status: "running" as const, lines: [] };
                  return { ...p, [svcId]: { ...prev, lines: [...prev.lines, data.text] } };
                });
              } else if (data.type === "done") {
                es.close(); delete esRefs.current[svcId];
                apiFetch<Deliverable[]>(`/me/projects/${id}/deliverables`).then(dels => {
                  const d = dels.find(d => d.crew === svcId);
                  setRunState(svcId, { status: "done", deliverable: d });
                }).catch(() => setRunState(svcId, { status: "done" }));
                resolve();
              } else if (data.type === "error") {
                es.close(); delete esRefs.current[svcId];
                setRunState(svcId, { status: "error", error: data.text ?? "Error" });
                resolve(); // continue next service even if one fails
              }
            } catch { /* ignore */ }
          };
          es.onerror = () => { es.close(); delete esRefs.current[svcId]; setRunState(svcId, { status: "error", error: "Stream error" }); resolve(); };
        }).catch(e => { setRunState(svcId, { status: "error", error: e.message }); resolve(); });
      });
    }
    setFSRunning(false);
  }

  const anyRunning = Object.values(runs).some(r => r.status === "running") || fsRunning;
  const doneCount  = Object.values(runs).filter(r => r.status === "done").length;

  if (loading) {
    return (
      <div style={{ minHeight: "calc(100vh - 57px)", background: "#f7f4ef", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#c8bfb2", animation: `svc-bounce 0.9s ease ${i*0.2}s infinite` }} />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "calc(100vh - 57px)", background: "#f7f4ef" }}>

      {/* Sub-header */}
      <div style={{ padding: "0.65rem 1.5rem", borderBottom: "1px solid #ece6dc", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/app" style={{ fontSize: 11, fontWeight: 600, color: "#b0a090", textDecoration: "none" }}>← Studio</Link>
          <span style={{ color: "#ddd8d0" }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1c1812", fontFamily: "Playfair Display, serif" }}>{project?.name ?? "-"}</span>
          <span style={{ color: "#ddd8d0" }}>/</span>
          <span style={{ fontSize: 12, color: "#b0a090" }}>Services</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {doneCount > 0 && (
            <Link href={`/app/project/${id}?view=1`} style={{ fontSize: 11, fontWeight: 600, color: "#786b58", textDecoration: "none", border: "1px solid #e8e0d5", borderRadius: 6, padding: "0.3rem 0.65rem" }}>
              View outputs ({doneCount})
            </Link>
          )}
          <Link href="/app/credits" style={{ fontSize: 11, fontWeight: 600, color: "#b0a090", textDecoration: "none" }}>Credits</Link>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "2.5rem 1.5rem" }}>

        {/* Page title + DNA pill */}
        <div style={{ marginBottom: "2rem", display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: "0.3em", color: "#c9943a", textTransform: "uppercase", marginBottom: "0.4rem", fontWeight: 600 }}>Services</p>
            <h1 style={{ fontSize: 24, fontWeight: 300, color: "#1c1812", fontFamily: "Playfair Display, serif" }}>{project?.name}</h1>
            {dna?.raw_fields?.brand_name && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", marginTop: "0.5rem", background: "#edfaf4", borderRadius: 6, padding: "0.2rem 0.6rem" }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#2daa6e" }}>✓ Brand DNA loaded</span>
              </div>
            )}
          </div>

          {/* Full stack CTA */}
          <button
            onClick={() => setShowFS(true)}
            disabled={anyRunning}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.75rem 1.5rem", background: anyRunning ? "#e8e0d5" : "#1c1812",
              border: "none", borderRadius: 10, color: anyRunning ? "#b0a090" : "#fff",
              fontSize: 13, fontWeight: 700, cursor: anyRunning ? "not-allowed" : "pointer",
              boxShadow: anyRunning ? "none" : "0 4px 16px rgba(28,24,18,0.2)",
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: 15 }}>⚡</span>
            {fsRunning ? "Running full stack..." : "Run Full Stack"}
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ flex: 1, height: 1, background: "#ece6dc" }} />
          <span style={{ fontSize: 10, letterSpacing: "0.2em", color: "#c8bfb2", textTransform: "uppercase", fontWeight: 600 }}>Or run individually</span>
          <div style={{ flex: 1, height: 1, background: "#ece6dc" }} />
        </div>

        {/* Service cards grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem", marginBottom: "2.5rem" }}>
          {SERVICES.map(svc => {
            const run = runs[svc.id];
            return (
              <div key={svc.id} style={{ background: "#fff", borderRadius: 16, border: `1.5px solid ${run?.status === "running" ? svc.color + "50" : run?.status === "done" ? "#2daa6e30" : run?.status === "error" ? "#f15b5030" : "#ece6dc"}`, padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem", transition: "all 0.2s", boxShadow: run?.status === "running" ? `0 4px 24px ${svc.color}18` : "none" }}>

                {/* Top row */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: run?.status === "done" ? "#edfaf4" : svc.bg, border: `1.5px solid ${run?.status === "done" ? "#2daa6e35" : svc.color + "30"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, color: run?.status === "done" ? "#2daa6e" : svc.color }}>
                    {run?.status === "done" ? "✓" : svc.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#1c1812" }}>{svc.name}</p>
                    <p style={{ fontSize: 10, color: "#b0a090" }}>~{svc.eta} · {svc.cost} Credits</p>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", flexShrink: 0, padding: "0.2rem 0.5rem", borderRadius: 4, color: run?.status === "done" ? "#2daa6e" : run?.status === "running" ? svc.color : run?.status === "error" ? "#f15b50" : "#b0a090", background: run?.status === "done" ? "#edfaf4" : run?.status === "running" ? svc.color + "18" : run?.status === "error" ? "#fff1f0" : "#f7f4ef" }}>
                    {!run || run.status === "idle" ? "IDLE" : run.status === "running" ? "LIVE" : run.status === "done" ? "DONE" : "ERR"}
                  </span>
                </div>

                <p style={{ fontSize: 12, color: "#a89880", lineHeight: 1.65 }}>{svc.description}</p>

                {/* Dual entry pill */}
                {svc.dualEntry && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: svc.color, background: svc.bg, borderRadius: 4, padding: "0.12rem 0.5rem" }}>Dual entry</span>
                    <span style={{ fontSize: 10, color: "#c8bfb2" }}>Brand or open research</span>
                  </div>
                )}

                {/* Running progress */}
                {run?.status === "running" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: svc.bg, borderRadius: 8, padding: "0.5rem 0.75rem" }}>
                    <div style={{ width: 14, height: 14, border: `2px solid ${svc.color}40`, borderTopColor: svc.color, borderRadius: "50%", animation: "svc-spin 0.7s linear infinite", flexShrink: 0 }} />
                    <p style={{ fontSize: 11, color: svc.color, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {run.lines.filter(l => l.includes("[STATUS]")).slice(-1)[0]?.replace(/.*\[STATUS\]\s*/, "") || "Agents at work..."}
                    </p>
                  </div>
                )}

                {/* Error */}
                {run?.status === "error" && (
                  <p style={{ fontSize: 11, color: "#f15b50", background: "#fff1f0", borderRadius: 8, padding: "0.4rem 0.7rem" }}>{run.error}</p>
                )}

                {/* Done - output link */}
                {run?.status === "done" && run.deliverable && (
                  <Link href={`/app/project/${id}?view=1&output=${encodeURIComponent(run.deliverable.path)}`} style={{ fontSize: 11, fontWeight: 600, color: "#2daa6e", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{run.deliverable.filename}</span>
                    <span style={{ flexShrink: 0 }}>→</span>
                  </Link>
                )}

                {/* Run button */}
                <button
                  onClick={() => !anyRunning && setOpenSvc(svc)}
                  disabled={anyRunning}
                  style={{
                    padding: "0.55rem", width: "100%", borderRadius: 8, fontSize: 12, fontWeight: 700, marginTop: "auto",
                    background: anyRunning ? "#f0ece5" : run?.status === "done" ? "#f7f4ef" : svc.color,
                    border: run?.status === "done" ? "1px solid #ece6dc" : "none",
                    color: anyRunning ? "#b0a090" : run?.status === "done" ? "#786b58" : "#fff",
                    cursor: anyRunning ? "not-allowed" : "pointer",
                    transition: "all 0.15s",
                    boxShadow: !anyRunning && run?.status !== "done" ? `0 3px 12px ${svc.color}35` : "none",
                  }}
                >
                  {run?.status === "running" ? "Running..." : run?.status === "done" ? "↺ Re-run" : `Run ${svc.name} →`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Coming soon */}
        <div>
          <p style={{ fontSize: 10, letterSpacing: "0.25em", color: "#c8bfb2", textTransform: "uppercase", fontWeight: 600, marginBottom: "1rem" }}>Coming soon</p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {COMING_SOON.map(s => (
              <div key={s.id} style={{ background: "#fff", border: "1px solid #ece6dc", borderRadius: 12, padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "0.6rem", opacity: 0.65 }}>
                <span style={{ fontSize: 16, color: s.color }}>{s.icon}</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#1c1812" }}>{s.name}</p>
                  <p style={{ fontSize: 10, color: "#b0a090" }}>{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Intake modal */}
      {openSvc && (
        <IntakeModal
          service={openSvc}
          dna={dna}
          project={project}
          onClose={() => setOpenSvc(null)}
          onLaunch={brief => launchService(openSvc.id, brief)}
        />
      )}

      {/* Full-stack modal */}
      {showFS && (
        <FullStackModal
          onClose={() => setShowFS(false)}
          onLaunch={launchFullStack}
          running={fsRunning}
        />
      )}

      <style>{`
        @keyframes svc-spin   { to { transform: rotate(360deg) } }
        @keyframes svc-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
      `}</style>
    </div>
  );
}
