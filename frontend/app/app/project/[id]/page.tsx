"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, getToken } from "@/lib/userAuth";

interface Project    { id: string; name: string; brief: string; }
interface Deliverable { filename: string; path: string; crew: string; created: string; locked: boolean; }

type Msg =
  | { kind: "user";      text: string }
  | { kind: "thinking" }
  | { kind: "stream";    lines: string[]; done: boolean; dept: string }
  | { kind: "result";    deliverable: Deliverable }
  | { kind: "assistant"; text: string }
  | { kind: "error";     text: string };

interface IntakeState {
  dept: string;
  questions: Array<{ key: string; question: string; required?: boolean }>;
  answers: Record<string, string>;
  idx: number;
}

const DEPTS = [
  { id: "research",  name: "Research",    icon: "◎", color: "#4f8ef0", bg: "#eef4ff", eta: "3–5 min",   cost: 120 },
  { id: "branding",  name: "Identity",    icon: "◈", color: "#e8a020", bg: "#fff8ee", eta: "10–15 min", cost: 350 },
  { id: "social",    name: "Social Media", icon: "◉", color: "#9b5de5", bg: "#f6f0ff", eta: "10–15 min", cost: 350 },
  { id: "ads",       name: "Growth",      icon: "◆", color: "#f15b50", bg: "#fff1f0", eta: "8–12 min",  cost: 400 },
  { id: "proposal",  name: "Decks",       icon: "◇", color: "#2daa6e", bg: "#edfaf4", eta: "5–8 min",   cost: 180 },
];

const DEPT_QUESTIONS: Record<string, Array<{ key: string; question: string; required?: boolean }>> = {
  research: [
    { key: "brand_name",  question: "What's the brand or topic you want researched?",         required: true },
    { key: "what_it_is",  question: "Describe it in one sentence — what is it exactly?",      required: true },
    { key: "category",    question: "What category or industry does it belong to?" },
    { key: "customer",    question: "Who is the target customer?" },
    { key: "problem",     question: "What problem does it solve?" },
    { key: "competitors", question: "Name up to 3 competitors (comma separated)." },
    { key: "stage",       question: "What stage — new launch, existing brand, or repositioning?" },
  ],
  branding: [
    { key: "brand_name",      question: "What's the brand name?",                                        required: true },
    { key: "what_it_is",      question: "What does the brand do or sell?",                               required: true },
    { key: "target_audience", question: "Who is the target audience?" },
    { key: "category",        question: "What category or industry?" },
    { key: "personality",     question: "Describe the brand personality. (e.g. bold, minimal, premium)" },
  ],
  social: [
    { key: "brand_name",      question: "What's the brand name?",                                   required: true },
    { key: "platforms",       question: "Which platforms? (e.g. Instagram, LinkedIn, X)" },
    { key: "target_audience", question: "Who is the audience?" },
    { key: "tone",            question: "What tone of voice? (e.g. bold, playful, professional)" },
  ],
  ads: [
    { key: "brand_name", question: "What's the brand name?",                             required: true },
    { key: "product",    question: "What are you advertising specifically?",              required: true },
    { key: "category",   question: "What category?" },
    { key: "budget",     question: "What's the monthly ad budget?" },
    { key: "platforms",  question: "Which platforms? (e.g. Meta, Google, YouTube)" },
  ],
  proposal: [
    { key: "brand_name", question: "What's the client's name?",         required: true },
    { key: "what_it_is", question: "What does the client do?" },
    { key: "challenge",  question: "What's their main challenge?" },
    { key: "goal",       question: "What's their goal?" },
    { key: "services",   question: "Which services are they asking for?" },
  ],
};

function buildBrief(dept: string, answers: Record<string, string>): Record<string, string> {
  switch (dept) {
    case "research": return {
      brand_name: answers.brand_name || "", what_it_is: answers.what_it_is || "",
      category: answers.category || "", target_audience: answers.customer || "",
      notes: answers.problem || "", competitors: answers.competitors || "",
      stage: answers.stage || "new", query: answers.brand_name || "",
    };
    case "branding": return {
      brand_name: answers.brand_name || "", what_it_is: answers.what_it_is || "",
      target_audience: answers.target_audience || "", category: answers.category || "",
      personality: answers.personality || "",
    };
    case "social": return {
      brand_name: answers.brand_name || "", platforms: answers.platforms || "",
      target_audience: answers.target_audience || "", tone: answers.tone || "",
    };
    case "ads": return {
      brand_name: answers.brand_name || "", product: answers.product || "",
      category: answers.category || "", budget: answers.budget || "",
      platforms: answers.platforms || "",
    };
    case "proposal": return {
      brand_name: answers.brand_name || "", what_it_is: answers.what_it_is || "",
      challenge: answers.challenge || "", goal: answers.goal || "",
      services: answers.services || "",
    };
    default: return answers;
  }
}

function deptInfo(id: string) { return DEPTS.find(d => d.id === id) ?? DEPTS[0]; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }

interface Commentary { done: string[]; now: string; }

function buildCommentary(lines: string[], dept: string): Commentary {
  // --- Primary signal: [STATUS] lines ---
  // Extract all [STATUS] messages from the last 20 lines
  const recent20 = lines.slice(-20);
  const allStatusLines = lines.filter(l => l.includes("[STATUS]"));
  const recentStatusLines = recent20.filter(l => l.includes("[STATUS]"));

  const extractStatus = (line: string): string =>
    line.substring(line.indexOf("[STATUS]") + 8).trim();

  if (allStatusLines.length > 0) {
    // Done = all STATUS lines except the last 3
    const doneStatusLines = allStatusLines.slice(0, Math.max(0, allStatusLines.length - 3));
    const done = doneStatusLines
      .map(extractStatus)
      .filter(Boolean)
      .slice(-6);

    // Now = most recent STATUS line
    const nowLine = recentStatusLines.length > 0
      ? recentStatusLines[recentStatusLines.length - 1]
      : allStatusLines[allStatusLines.length - 1];
    const now = extractStatus(nowLine);

    return { done, now: now || "Agents at work..." };
  }

  // --- Fallback: keyword matching (no STATUS lines yet) ---
  const text = lines.join(" ").toLowerCase();
  const done: string[] = [];

  function mark(triggers: string[], label: string) {
    if (triggers.some(t => text.includes(t)) && !done.includes(label)) done.push(label);
  }

  if (dept === "research") {
    mark(["l1", "layer 1", "query understanding", "decompos"],       "Mapped out what to research");
    mark(["l2", "layer 2", "retrieval", "google_search", "searching"],"Searched the web for sources");
    mark(["l3", "layer 3", "extract", "reading", "credibility"],      "Read & extracted key findings");
    mark(["l4", "adversarial", "stress", "contradict"],               "Cross-checked for contradictions");
    mark(["l5", "synthesis", "draft report"],                         "Synthesised the research");
    mark(["reflection", "self-review", "gap"],                        "Self-reviewed for gaps");
    mark(["[saved]", "complete"],                                      "Research complete");

    const nowMap: [string[], string][] = [
      [["l1", "query understanding"],              "Mapping out what to research..."],
      [["l2", "searching", "google"],              "Searching the web for sources..."],
      [["l3", "extract", "reading"],               "Reading sources and extracting findings..."],
      [["l4", "adversarial"],                      "Cross-checking for contradictions..."],
      [["l5", "synthesis", "draft"],               "Writing the final report..."],
      [["reflection"],                             "Self-reviewing for gaps..."],
      [["[saved]"],                                "Wrapping up..."],
    ];
    const recent = lines.slice(-15).join(" ").toLowerCase();
    for (const [triggers, label] of nowMap.slice().reverse()) {
      if (triggers.some(t => recent.includes(t))) return { done, now: label };
    }
    return { done, now: done.length ? "Agents at work..." : "Starting research pipeline..." };
  }

  if (dept === "branding") {
    mark(["cultural", "market research", "serper"],       "Researched market landscape");
    mark(["compet", "competitor"],                         "Analysed competitors");
    mark(["archetype", "brand strat", "strategy agent"],  "Defined brand strategy");
    mark(["visual", "colour", "typography"],               "Designed visual system");
    mark(["gtm", "go-to-market", "positioning"],          "Built launch strategy");
    mark(["compil", "document compil"],                    "Compiled brand document");
    mark(["[saved]"],                                      "Brand document complete");

    const recent = lines.slice(-10).join(" ").toLowerCase();
    if (recent.includes("visual") || recent.includes("colour"))     return { done, now: "Designing visual identity..." };
    if (recent.includes("archetype") || recent.includes("strat"))   return { done, now: "Defining brand strategy..." };
    if (recent.includes("compet"))                                   return { done, now: "Running competitor analysis..." };
    if (recent.includes("gtm") || recent.includes("position"))      return { done, now: "Crafting go-to-market strategy..." };
    if (recent.includes("compil"))                                   return { done, now: "Compiling brand document..." };
    return { done, now: done.length ? "Building your brand identity..." : "Starting brand strategy crew..." };
  }

  if (dept === "social") {
    mark(["brand voice", "social anal"],             "Analysed brand voice");
    mark(["platform", "instagram", "linkedin"],      "Researched platform dynamics");
    mark(["content pillar", "content strat"],        "Built content strategy");
    mark(["calendar"],                               "Created content calendar");
    mark(["caption", "copy", "copywriter"],          "Wrote post copy");
    mark(["qa", "quality"],                          "Quality reviewed");
    mark(["[saved]"],                                "Social media plan complete");

    const recent = lines.slice(-10).join(" ").toLowerCase();
    if (recent.includes("calendar"))                 return { done, now: "Building the content calendar..." };
    if (recent.includes("caption") || recent.includes("copy")) return { done, now: "Writing post copy & captions..." };
    if (recent.includes("platform"))                 return { done, now: "Analysing platform audiences..." };
    if (recent.includes("qa"))                       return { done, now: "Quality-checking content..." };
    return { done, now: done.length ? "Crafting your social presence..." : "Starting social media crew..." };
  }

  if (dept === "ads") {
    mark(["audience", "targeting"],                  "Built audience profiles");
    mark(["competitor ad", "ad intel"],              "Gathered competitor ad intelligence");
    mark(["ad strat", "strategist"],                 "Set ad strategy");
    mark(["copywriter", "headline", "ad copy"],      "Wrote ad copy");
    mark(["creative", "creative director"],          "Directed creative concepts");
    mark(["campaign arch", "campaign struct"],       "Architected campaign structure");
    mark(["[saved]"],                                "Campaign plan complete");

    const recent = lines.slice(-10).join(" ").toLowerCase();
    if (recent.includes("audience"))   return { done, now: "Profiling your target audience..." };
    if (recent.includes("copy") || recent.includes("headline")) return { done, now: "Writing high-converting ad copy..." };
    if (recent.includes("creative"))   return { done, now: "Developing creative concepts..." };
    if (recent.includes("campaign"))   return { done, now: "Structuring campaign architecture..." };
    return { done, now: done.length ? "Building growth campaigns..." : "Starting ads crew..." };
  }

  if (dept === "proposal") {
    mark(["proposal writer", "draft"],               "Drafted proposal narrative");
    mark(["pricing", "package"],                     "Built pricing & packages");
    mark(["critic", "review"],                       "Reviewed and refined");
    mark(["[saved]"],                                "Decks complete");

    const recent = lines.slice(-10).join(" ").toLowerCase();
    if (recent.includes("pricing"))   return { done, now: "Building pricing structure..." };
    if (recent.includes("critic"))    return { done, now: "Reviewing and refining..." };
    if (recent.includes("draft"))     return { done, now: "Drafting the deck..." };
    return { done, now: done.length ? "Writing your deck..." : "Starting decks crew..." };
  }

  return { done: [], now: "Agents working..." };
}

/* ── Inline markdown ── */
function InlineMd({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={m.index}>{m[1]}</strong>);
    else if (m[2]) parts.push(<em key={m.index}>{m[2]}</em>);
    else if (m[3]) parts.push(<code key={m.index} style={{ background: "#f0ece5", borderRadius: 3, padding: "0.1em 0.35em", fontSize: "0.88em", fontFamily: "monospace" }}>{m[3]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/* ── Chat markdown renderer (for AP messages) ── */
function ChatMd({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let bulletBuf: string[] = [];
  let numBuf: string[] = [];

  function flushBullets() {
    if (!bulletBuf.length) return;
    nodes.push(
      <ul key={`b${nodes.length}`} style={{ margin: "0.3rem 0 0.3rem 0.25rem", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
        {bulletBuf.map((l, i) => (
          <li key={i} style={{ display: "flex", gap: "0.55rem" }}>
            <span style={{ color: "#b0a090", flexShrink: 0 }}>•</span>
            <span style={{ fontSize: 13, lineHeight: 1.7, color: "inherit" }}><InlineMd text={l} /></span>
          </li>
        ))}
      </ul>
    );
    bulletBuf = [];
  }

  function flushNums() {
    if (!numBuf.length) return;
    nodes.push(
      <ol key={`n${nodes.length}`} style={{ margin: "0.3rem 0 0.3rem 0.25rem", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.2rem", counterReset: "li" }}>
        {numBuf.map((l, i) => (
          <li key={i} style={{ display: "flex", gap: "0.6rem" }}>
            <span style={{ color: "#b0a090", fontWeight: 700, fontSize: 12, flexShrink: 0, minWidth: 16 }}>{i + 1}.</span>
            <span style={{ fontSize: 13, lineHeight: 1.7, color: "inherit" }}><InlineMd text={l} /></span>
          </li>
        ))}
      </ol>
    );
    numBuf = [];
  }

  for (const line of lines) {
    const t = line.trim();
    if (!t) { flushBullets(); flushNums(); nodes.push(<div key={`sp${nodes.length}`} style={{ height: "0.3rem" }} />); continue; }
    if (t.startsWith("### ")) { flushBullets(); flushNums(); nodes.push(<p key={`h3${nodes.length}`} style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", opacity: 0.6, margin: "0.4rem 0 0.1rem" }}>{t.slice(4)}</p>); continue; }
    if (t.startsWith("## "))  { flushBullets(); flushNums(); nodes.push(<p key={`h2${nodes.length}`} style={{ fontSize: 14, fontWeight: 700, margin: "0.35rem 0 0.1rem" }}><InlineMd text={t.slice(3)} /></p>); continue; }
    if (t.startsWith("# "))   { flushBullets(); flushNums(); nodes.push(<p key={`h1${nodes.length}`} style={{ fontSize: 15, fontWeight: 800, margin: "0.35rem 0 0.1rem" }}><InlineMd text={t.slice(2)} /></p>); continue; }
    if (t.match(/^[-*] /)) { flushNums(); bulletBuf.push(t.slice(2)); continue; }
    if (t.match(/^\d+\. /)) { flushBullets(); numBuf.push(t.replace(/^\d+\.\s/, "")); continue; }
    flushBullets(); flushNums();
    nodes.push(<p key={`p${nodes.length}`} style={{ fontSize: 13, lineHeight: 1.75, margin: "0.05rem 0", color: "inherit" }}><InlineMd text={t} /></p>);
  }
  flushBullets(); flushNums();
  return <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>{nodes}</div>;
}

/* ── Metric bar for deliverable viewer ── */
function MetricBar({ label, value, color }: { label: string; value: string; color: string }) {
  const pct = parseFloat(value.replace(/[^0-9.]/g, ""));
  const hasBar = !isNaN(pct) && pct <= 100;
  return (
    <div style={{ marginBottom: "0.65rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
        <span style={{ fontSize: 12, color: "#4a3f35" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
      </div>
      {hasBar && (
        <div style={{ height: 6, background: "#f0ece5", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg, ${color}cc, ${color})`, borderRadius: 3 }} />
        </div>
      )}
    </div>
  );
}

/* ── Confidence / tag badge ── */
function TagBadge({ tag }: { tag: string }) {
  const map: Record<string, [string, string]> = {
    HIGH: ["#2daa6e", "#edfaf4"], MEDIUM: ["#e8a020", "#fff8ee"], LOW: ["#f15b50", "#fff1f0"],
    ESTABLISHED: ["#4f8ef0", "#eef4ff"], EMERGING: ["#9b5de5", "#f6f0ff"],
    CONTESTED: ["#e8a020", "#fff8ee"], SPECULATIVE: ["#b0a090", "#f0ece5"],
  };
  const [fg, bg] = map[tag] ?? ["#b0a090", "#f0ece5"];
  return <span style={{ display: "inline-block", padding: "0.1em 0.45em", borderRadius: 4, fontSize: 9, fontWeight: 800, letterSpacing: "0.07em", color: fg, background: bg, margin: "0 0.2em", verticalAlign: "middle" }}>{tag}</span>;
}

/* ── Document renderer ── */
function DocRenderer({ content, color, bg }: { content: string; color: string; bg: string }) {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  const tagRe = /\[(HIGH|MEDIUM|LOW|ESTABLISHED|CONTESTED|EMERGING|SPECULATIVE)\]/g;

  while (i < lines.length) {
    const raw = lines[i];
    const t   = raw.trim();

    if (!t) { nodes.push(<div key={i} style={{ height: "0.6rem" }} />); i++; continue; }

    // DATA SNAPSHOT block — collect until blank line
    if (t === "### DATA SNAPSHOT" || t === "## DATA SNAPSHOT") {
      i++;
      const metrics: { label: string; value: string }[] = [];
      while (i < lines.length && lines[i].trim()) {
        const ml = lines[i].trim();
        const mMatch = ml.match(/^[-*]?\s*(.+?):\s*(.+)$/);
        if (mMatch) metrics.push({ label: mMatch[1].trim(), value: mMatch[2].trim() });
        i++;
      }
      if (metrics.length) nodes.push(
        <div key={i} style={{ background: bg, border: `1.5px solid ${color}25`, borderRadius: 14, padding: "1.1rem 1.25rem", margin: "0.75rem 0 1rem" }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color, marginBottom: "0.85rem" }}>Key Metrics</p>
          {metrics.map((m, mi) => <MetricBar key={mi} label={m.label} value={m.value} color={color} />)}
        </div>
      );
      continue;
    }

    // Headings
    if (t.startsWith("# "))   { nodes.push(<h1 key={i} style={{ fontFamily: "Playfair Display, serif", fontSize: 26, fontWeight: 700, color: "#1c1812", margin: "2rem 0 0.6rem", borderBottom: `2px solid ${color}25`, paddingBottom: "0.5rem" }}><InlineMd text={t.slice(2)} /></h1>); i++; continue; }
    if (t.startsWith("## "))  { nodes.push(<h2 key={i} style={{ fontFamily: "Playfair Display, serif", fontSize: 19, fontWeight: 700, color: "#1c1812", margin: "1.75rem 0 0.4rem" }}><InlineMd text={t.slice(3)} /></h2>); i++; continue; }
    if (t.startsWith("### ")) { nodes.push(<h3 key={i} style={{ fontSize: 11, fontWeight: 800, color, margin: "1.4rem 0 0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.slice(4)}</h3>); i++; continue; }

    // HR
    if (t === "---") { nodes.push(<hr key={i} style={{ border: "none", borderTop: "1px solid #ece6dc", margin: "1.25rem 0" }} />); i++; continue; }

    // Markdown table
    if (t.startsWith("|") && t.endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        if (!lines[i].trim().match(/^\|[-|: ]+\|$/)) tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length > 1) {
        const rows = tableLines.map(l => l.split("|").slice(1, -1).map(c => c.trim()));
        const [headers, ...body] = rows;
        nodes.push(
          <div key={i} style={{ overflowX: "auto", margin: "1rem 0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: bg }}>
                  {headers.map((h, hi) => <th key={hi} style={{ padding: "0.65rem 0.9rem", textAlign: "left", fontWeight: 700, color, borderBottom: `2px solid ${color}30`, whiteSpace: "nowrap" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#faf8f5" }}>
                    {row.map((cell, ci) => <td key={ci} style={{ padding: "0.55rem 0.9rem", color: "#4a3f35", borderBottom: "1px solid #ece6dc", lineHeight: 1.6 }}><InlineMd text={cell} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Bullet list
    if (t.match(/^[-*] /)) {
      const bullets: string[] = [];
      while (i < lines.length && lines[i].trim().match(/^[-*] /)) { bullets.push(lines[i].trim().slice(2)); i++; }
      nodes.push(
        <ul key={i} style={{ margin: "0.4rem 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {bullets.map((b, bi) => (
            <li key={bi} style={{ display: "flex", gap: "0.65rem", paddingLeft: "0.25rem" }}>
              <span style={{ color, flexShrink: 0, marginTop: 3, fontSize: 12 }}>•</span>
              <span style={{ fontSize: 13, color: "#4a3f35", lineHeight: 1.8 }}><InlineMd text={b} /></span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (t.match(/^\d+\. /)) {
      const nums: string[] = [];
      while (i < lines.length && lines[i].trim().match(/^\d+\. /)) { nums.push(lines[i].trim().replace(/^\d+\.\s/, "")); i++; }
      nodes.push(
        <ol key={i} style={{ margin: "0.4rem 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {nums.map((n, ni) => (
            <li key={ni} style={{ display: "flex", gap: "0.7rem", paddingLeft: "0.25rem" }}>
              <span style={{ color, fontWeight: 700, fontSize: 12, flexShrink: 0, minWidth: 20, marginTop: 3 }}>{ni + 1}.</span>
              <span style={{ fontSize: 13, color: "#4a3f35", lineHeight: 1.8 }}><InlineMd text={n} /></span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Line with confidence/status tags
    if (tagRe.test(t)) {
      tagRe.lastIndex = 0;
      const parts: React.ReactNode[] = [];
      let last = 0; let m: RegExpExecArray | null;
      while ((m = tagRe.exec(t)) !== null) {
        if (m.index > last) parts.push(<InlineMd key={last} text={t.slice(last, m.index)} />);
        parts.push(<TagBadge key={m.index} tag={m[1]} />);
        last = m.index + m[0].length;
      }
      if (last < t.length) parts.push(<InlineMd key={last} text={t.slice(last)} />);
      nodes.push(<p key={i} style={{ fontSize: 13, color: "#4a3f35", lineHeight: 1.85, marginBottom: "0.2rem" }}>{parts}</p>);
      i++; continue;
    }

    // Normal paragraph
    nodes.push(<p key={i} style={{ fontSize: 13, color: "#4a3f35", lineHeight: 1.85, marginBottom: "0.2rem" }}><InlineMd text={t} /></p>);
    i++;
  }

  return <div>{nodes}</div>;
}

/* ── Deliverable viewer ── */
function DeliverableViewer({ d, projectId, onClose }: { d: Deliverable; projectId: string; onClose: () => void }) {
  const [content, setContent] = useState("");
  const [locked,  setLocked]  = useState(false);
  const [chatIn,  setChatIn]  = useState("");
  const [msgs,    setMsgs]    = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dep = deptInfo(d.crew);

  useEffect(() => {
    apiFetch<{ content: string; locked: boolean }>(`/me/deliverable/${d.path}`)
      .then(r => { setContent(r.content); setLocked(r.locked); }).catch(() => {});
  }, [d.path]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs]);

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatIn.trim() || loading) return;
    const msg = chatIn.trim(); setChatIn("");
    setMsgs(p => [...p, { role: "user", text: msg }]);
    setLoading(true);
    try {
      const res = await apiFetch<{ reply: string }>(`/me/projects/${projectId}/chat`, {
        method: "POST", body: JSON.stringify({ message: msg, context: content.slice(0, 4000) }),
      });
      setMsgs(p => [...p, { role: "assistant", text: res.reply }]);
    } catch (e: any) {
      setMsgs(p => [...p, { role: "assistant", text: `Error: ${e.message}` }]);
    }
    setLoading(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(28,24,18,0.6)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "#fff", flex: 1, margin: "2rem", borderRadius: 20, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #ece6dc", display: "flex", alignItems: "center", justifyContent: "space-between", background: dep.bg, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: dep.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff" }}>{dep.icon}</div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1c1812" }}>{d.filename}</p>
              <p style={{ fontSize: 11, color: dep.color }}>{dep.name} · {fmtDate(d.created)}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {!locked && <a href={`/api/backend/me/deliverable/${d.path}/pdf`} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 600, color: "#786b58", border: "1px solid #e8e0d5", padding: "0.35rem 0.85rem", borderRadius: 6, textDecoration: "none" }}>↓ PDF</a>}
            <button onClick={onClose} style={{ background: "#f0ece5", border: "none", borderRadius: 6, color: "#786b58", fontSize: 14, cursor: "pointer", padding: "0.35rem 0.75rem", fontWeight: 600 }}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem" }}>
            {locked && (
              <div style={{ background: "#fff8ee", border: "1px solid #e8a02030", borderRadius: 10, padding: "0.85rem 1.1rem", marginBottom: "1.5rem" }}>
                <p style={{ fontSize: 12, color: "#786b58" }}>Showing 20% preview — <Link href="/app/credits" style={{ color: "#e8a020", fontWeight: 600, textDecoration: "none" }}>add credits to unlock</Link></p>
              </div>
            )}
            <div style={{ maxWidth: 720 }}>
              <DocRenderer content={content} color={dep.color} bg={dep.bg} />
            </div>
          </div>
          <div style={{ width: 300, borderLeft: "1px solid #ece6dc", display: "flex", flexDirection: "column", background: "#faf8f5" }}>
            <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid #ece6dc" }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#b0a090", textTransform: "uppercase" }}>Ask AP</p>
            </div>
            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {msgs.length === 0 && <p style={{ fontSize: 12, color: "#c8bfb2", textAlign: "center", paddingTop: "2rem", lineHeight: 1.6 }}>Ask anything about this output.</p>}
              {msgs.map((m, i) => (
                <div key={i} style={{ textAlign: m.role === "user" ? "right" : "left" }}>
                  <span style={{ display: "inline-block", padding: "0.55rem 0.85rem", borderRadius: 10, maxWidth: "90%", fontSize: 12, lineHeight: 1.65, background: m.role === "user" ? dep.color : "#fff", color: m.role === "user" ? "#fff" : "#4a3f35", border: m.role === "assistant" ? "1px solid #ece6dc" : "none" }}>
                    {m.text}
                  </span>
                </div>
              ))}
              {loading && <div style={{ display: "flex", gap: 4 }}>{[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: dep.color, animation: `bounce 0.8s ease ${i * 0.15}s infinite` }} />)}</div>}
            </div>
            <form onSubmit={sendChat} style={{ padding: "0.75rem", borderTop: "1px solid #ece6dc", display: "flex", gap: "0.5rem" }}>
              <input value={chatIn} onChange={e => setChatIn(e.target.value)} placeholder="Ask a question..." disabled={locked}
                style={{ flex: 1, background: "#fff", border: "1.5px solid #e8e0d5", borderRadius: 8, padding: "0.6rem 0.75rem", fontSize: 12, color: "#1c1812", outline: "none", fontFamily: "Inter, sans-serif" }}
                onFocus={e => (e.currentTarget.style.borderColor = dep.color)}
                onBlur={e  => (e.currentTarget.style.borderColor = "#e8e0d5")} />
              <button type="submit" disabled={loading || locked || !chatIn.trim()} style={{ padding: "0.6rem 0.85rem", background: dep.color, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 700 }}>→</button>
            </form>
          </div>
        </div>
      </div>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}`}</style>
    </div>
  );
}

/* ── Main page ── */
export default function ProjectChatPage() {
  const { id }       = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const [project,   setProject]   = useState<Project | null>(null);
  const [messages,  setMessages]  = useState<Msg[]>([]);
  const [input,     setInput]     = useState("");
  const [selDept,   setSelDept]   = useState(searchParams.get("dept") ?? "research");
  const [deploying, setDeploying] = useState(false);
  const [viewer,    setViewer]    = useState<Deliverable | null>(null);
  const [intake,    setIntake]    = useState<IntakeState | null>(null);
  const [hasDNA,    setHasDNA]    = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [proj, dels, dna] = await Promise.all([
          apiFetch<Project>(`/me/projects/${id}`),
          apiFetch<Deliverable[]>(`/me/projects/${id}/deliverables`),
          apiFetch<{ raw_fields: any; enriched_fields: any }>(`/me/projects/${id}/dna`).catch(() => ({ raw_fields: null, enriched_fields: null })),
        ]);
        setProject(proj);
        const dnaExists = !!(dna?.raw_fields);
        setHasDNA(dnaExists);

        const hist: Msg[] = [];
        if (proj.brief) hist.push({ kind: "user", text: proj.brief });
        dels.forEach(d => hist.push({ kind: "result", deliverable: d }));
        if (hist.length) setMessages(hist);

        const fromOnboarding = searchParams.get("from") === "onboarding";
        const dept = searchParams.get("dept") ?? "research";

        if (dels.length === 0) {
          setSelDept(dept);
          // Always skip intake — brief or DNA is enough
          setTimeout(() => startDeployFromDNA(dept, proj), 600);
        }
      } catch (e: any) { setMessages([{ kind: "error", text: e.message }]); }
    })();
  }, [id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function addMsg(m: Msg) { setMessages(p => [...p, m]); }

  function updateLastStream(fn: (s: Extract<Msg, { kind: "stream" }>) => Extract<Msg, { kind: "stream" }>) {
    setMessages(p => {
      const c = [...p];
      for (let i = c.length - 1; i >= 0; i--) {
        if (c[i].kind === "stream") { c[i] = fn(c[i] as Extract<Msg, { kind: "stream" }>); break; }
      }
      return c;
    });
  }

  function startIntake(deptId: string) {
    const d = deptInfo(deptId);
    const questions = DEPT_QUESTIONS[deptId] ?? [];
    setIntake({ dept: deptId, questions, answers: {}, idx: 0 });
    addMsg({
      kind: "assistant",
      text: `**${d.icon} ${d.name}** — I'll need a few details before we start.\n\n${questions[0].question}`,
    });
    setTimeout(() => inputRef.current?.focus(), 120);
  }

  async function startDeployFromDNA(deptId: string, proj: Project) {
    const d = deptInfo(deptId);
    if (messages.length === 0) {
      addMsg({ kind: "user", text: proj.brief || proj.name });
    }
    addMsg({
      kind: "assistant",
      text: `Starting **${d.icon} ${d.name}** — estimated **~${d.eta}**.`,
    });
    await startDeploy(deptId, {});
  }

  async function startDeploy(deptId: string, answers: Record<string, string>) {
    if (deploying) return;
    setDeploying(true);
    const d = deptInfo(deptId);
    const brief = { ...buildBrief(deptId, answers), notes: project?.brief || "" };

    addMsg({ kind: "assistant", text: `All set. Starting **${d.icon} ${d.name}** — estimated **~${d.eta}**. Watch the progress below.` });
    addMsg({ kind: "thinking" });

    try {
      const job = await apiFetch<{ job_id: string }>("/me/run-crew", {
        method: "POST",
        body: JSON.stringify({ project_id: id, crew_name: deptId, brief }),
      });

      setMessages(p => {
        const c   = [...p];
        const idx = c.map(m => m.kind).lastIndexOf("thinking");
        if (idx >= 0) c[idx] = { kind: "stream", lines: [], done: false, dept: deptId };
        return c;
      });

      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const es   = new EventSource(`${base}/me/stream/${job.job_id}?api_key=${getToken()}`);

      es.onmessage = evt => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === "line") {
            updateLastStream(s => ({ ...s, lines: [...s.lines, data.text] }));
          } else if (data.type === "done") {
            es.close();
            updateLastStream(s => ({ ...s, done: true }));
            setDeploying(false);
            apiFetch<Deliverable[]>(`/me/projects/${id}/deliverables`)
              .then(dels => { if (dels.length) addMsg({ kind: "result", deliverable: dels[0] }); })
              .catch(() => {});
          } else if (data.type === "error") {
            es.close();
            updateLastStream(s => ({ ...s, done: true }));
            addMsg({ kind: "error", text: data.text ?? "Deployment failed." });
            setDeploying(false);
          }
        } catch { /* ignore non-json */ }
      };
      es.onerror = () => {
        es.close();
        updateLastStream(s => ({ ...s, done: true }));
        addMsg({ kind: "error", text: "Stream disconnected." });
        setDeploying(false);
      };
    } catch (e: any) {
      setMessages(p => p.filter(m => m.kind !== "thinking"));
      addMsg({ kind: "error", text: e.message });
      setDeploying(false);
    }
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();

    // Allow skipping optional intake questions with empty Enter
    if (!text && intake && !intake.questions[intake.idx]?.required) {
      advanceIntake(intake, "");
      return;
    }
    if (!text) return;
    setInput("");
    addMsg({ kind: "user", text });

    // INTAKE: intercept answer — never falls through to chat API
    if (intake) {
      advanceIntake(intake, text);
      return;
    }

    // Regular chat
    try {
      addMsg({ kind: "thinking" });
      const res = await apiFetch<{ reply: string }>(`/me/projects/${id}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: text, context: project?.brief }),
      });
      setMessages(p => {
        const c = [...p]; const i = c.map(m => m.kind).lastIndexOf("thinking");
        if (i >= 0) c[i] = { kind: "assistant", text: res.reply };
        return c;
      });
    } catch (e: any) {
      setMessages(p => {
        const c = [...p]; const i = c.map(m => m.kind).lastIndexOf("thinking");
        if (i >= 0) c[i] = { kind: "error", text: e.message };
        return c;
      });
    }
  }

  function advanceIntake(current: IntakeState, answer: string) {
    const { dept, questions, answers, idx } = current;
    const updatedAnswers = answer ? { ...answers, [questions[idx].key]: answer } : answers;
    const nextIdx = idx + 1;

    if (nextIdx < questions.length) {
      const nextQ = questions[nextIdx];
      setIntake({ dept, questions, answers: updatedAnswers, idx: nextIdx });
      addMsg({
        kind: "assistant",
        text: nextQ.question + (nextQ.required ? "" : "\n\n*(Optional — press Enter to skip)*"),
      });
    } else {
      setIntake(null);
      startDeploy(dept, updatedAnswers);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const activeDept = deptInfo(selDept);
  const isActive   = deploying || !!intake;

  function getDeptStatus(deptId: string): "DONE" | "RUNNING" | "READY" {
    if (messages.some(m => m.kind === "result" && m.deliverable.crew === deptId)) return "DONE";
    if (deploying && selDept === deptId) return "RUNNING";
    return "READY";
  }

  return (
    <div style={{ height: "calc(100vh - 57px)", display: "flex", flexDirection: "column", background: "#f7f4ef" }}>

      {/* Sub-header */}
      <div style={{ padding: "0.65rem 1.5rem", borderBottom: "1px solid #ece6dc", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/app" style={{ fontSize: 11, fontWeight: 600, color: "#b0a090", textDecoration: "none" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#786b58")}
            onMouseLeave={e => (e.currentTarget.style.color = "#b0a090")}>← Studio</Link>
          <span style={{ color: "#ddd8d0" }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1c1812", fontFamily: "Playfair Display, serif" }}>{project?.name ?? "Loading..."}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            title={sidebarOpen ? "Hide departments" : "Show departments"}
            style={{ fontSize: 11, fontWeight: 600, color: "#b0a090", background: "none", border: "1px solid #e8e0d5", borderRadius: 6, padding: "0.3rem 0.65rem", cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "#c8bfb2")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "#e8e0d5")}
          >{sidebarOpen ? "◧ Hide" : "◨ Depts"}</button>
          <Link href="/app/credits" style={{ fontSize: 11, fontWeight: 600, color: "#b0a090", textDecoration: "none" }}>Credits</Link>
        </div>
      </div>

      {/* Main content row: messages + sidebar */}
      <div style={{ flex: 1, display: "flex", flexDirection: "row", overflow: "hidden" }}>

      {/* Left: messages + bottom bar */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1.75rem 1.5rem" }}>
        <div style={{ maxWidth: 700, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {messages.length === 0 && (
            <div style={{ textAlign: "center", paddingTop: "5rem" }}>
              <p style={{ fontFamily: "Playfair Display, serif", fontSize: 24, color: "#c8bfb2", fontStyle: "italic" }}>Ready to run.</p>
              <p style={{ fontSize: 12, color: "#c8bfb2", marginTop: "0.5rem" }}>Select a department from the sidebar and hit Deploy.</p>
            </div>
          )}

          {messages.map((msg, i) => {
            if (msg.kind === "user") return (
              <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ background: "#1c1812", borderRadius: "14px 14px 4px 14px", padding: "0.85rem 1.1rem", maxWidth: "75%", fontSize: 14, color: "#f7f4ef", lineHeight: 1.65, boxShadow: "0 4px 16px rgba(28,24,18,0.12)" }}>{msg.text}</div>
              </div>
            );

            if (msg.kind === "thinking") return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#f0ece5", border: "2px solid #e8e0d5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>◎</div>
                <div style={{ display: "flex", gap: 5 }}>{[0,1,2].map(j => <div key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: "#c8bfb2", animation: `bounce 0.9s ease ${j * 0.2}s infinite` }} />)}</div>
              </div>
            );

            if (msg.kind === "stream") {
              const dep  = deptInfo(msg.dept);
              const { done, now } = msg.done
                ? { done: [], now: "" }
                : buildCommentary(msg.lines, msg.dept);
              return (
                <div key={i} style={{ background: "#fff", border: `1.5px solid ${msg.done ? "#2daa6e30" : dep.color + "30"}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 20px rgba(0,0,0,0.06)" }}>

                  {/* Header */}
                  <div style={{ padding: "0.85rem 1.1rem", background: msg.done ? "#edfaf4" : dep.bg, borderBottom: `1px solid ${msg.done ? "#2daa6e20" : dep.color + "20"}`, display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: msg.done ? "#2daa6e" : dep.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: "#fff", flexShrink: 0, boxShadow: `0 3px 10px ${msg.done ? "#2daa6e" : dep.color}40` }}>
                      {msg.done ? "✓" : dep.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#1c1812" }}>{dep.name}</p>
                        {!msg.done && <span style={{ fontSize: 9, color: dep.color, background: `${dep.color}18`, padding: "0.15rem 0.55rem", borderRadius: 4, fontWeight: 700, letterSpacing: "0.06em" }}>LIVE</span>}
                        {msg.done  && <span style={{ fontSize: 9, color: "#2daa6e", background: "#edfaf4", padding: "0.15rem 0.55rem", borderRadius: 4, fontWeight: 700, letterSpacing: "0.06em" }}>DONE</span>}
                      </div>
                      <p style={{ fontSize: 11, color: msg.done ? "#2daa6e" : "#b0a090", marginTop: 1 }}>~{dep.eta} estimated</p>
                    </div>
                    {!msg.done && <div style={{ width: 18, height: 18, border: `2.5px solid ${dep.color}35`, borderTopColor: dep.color, borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />}
                  </div>

                  {/* Commentary body */}
                  <div style={{ padding: "0.85rem 1.1rem" }}>

                    {/* Current action — pulsing */}
                    {!msg.done && now && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: done.length ? "0.85rem" : 0 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dep.color, flexShrink: 0, animation: "pulse 1.4s ease infinite", boxShadow: `0 0 0 0 ${dep.color}60` }} />
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#1c1812" }}>{now}</p>
                      </div>
                    )}

                    {/* Completed steps */}
                    {done.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                        {done.map((step, si) => (
                          <div key={si} style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#edfaf4", border: "1.5px solid #2daa6e40", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <span style={{ fontSize: 8, color: "#2daa6e", fontWeight: 800 }}>✓</span>
                            </div>
                            <p style={{ fontSize: 12, color: "#a89880", lineHeight: 1.5 }}>{step}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Done state */}
                    {msg.done && (
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#2daa6e" }}>All done — your deliverable is ready below.</p>
                    )}

                    {/* Empty state */}
                    {!msg.done && !now && done.length === 0 && (
                      <p style={{ fontSize: 12, color: "#c8bfb2" }}>Warming up agents...</p>
                    )}
                  </div>
                </div>
              );
            }

            if (msg.kind === "result") {
              const dep = deptInfo(msg.deliverable.crew);
              return (
                <div key={i} style={{ background: "#fff", border: "1.5px solid #ece6dc", borderRadius: 14, padding: "1rem 1.1rem", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: dep.bg, border: `1.5px solid ${dep.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: dep.color, flexShrink: 0 }}>{dep.icon}</div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#1c1812", marginBottom: 3 }}>{msg.deliverable.filename}</p>
                      <p style={{ fontSize: 11, color: "#b0a090" }}>{dep.name} · {fmtDate(msg.deliverable.created)}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button onClick={() => setViewer(msg.deliverable)} style={{ padding: "0.45rem 1rem", background: dep.color, border: "none", borderRadius: 8, fontSize: 11, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: `0 4px 12px ${dep.color}40` }}>View</button>
                    {!msg.deliverable.locked && <a href={`/api/backend/me/deliverable/${msg.deliverable.path}/pdf`} target="_blank" rel="noreferrer" style={{ padding: "0.45rem 1rem", background: "#f0ece5", border: "none", borderRadius: 8, fontSize: 11, fontWeight: 600, color: "#786b58", textDecoration: "none" }}>PDF</a>}
                  </div>
                </div>
              );
            }

            if (msg.kind === "assistant") return (
              <div key={i} style={{ display: "flex", gap: "0.75rem" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#f0ece5", border: "2px solid #e8e0d5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#786b58", flexShrink: 0, marginTop: 2 }}>AP</div>
                <div style={{ background: "#fff", border: "1px solid #ece6dc", borderRadius: "4px 14px 14px 14px", padding: "0.85rem 1.1rem", fontSize: 13, color: "#4a3f35", lineHeight: 1.75, maxWidth: "85%", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  <ChatMd text={msg.text} />
                </div>
              </div>
            );

            if (msg.kind === "error") return (
              <div key={i} style={{ padding: "0.85rem 1.1rem", background: "#fff5f5", border: "1.5px solid #f1505030", borderRadius: 10, fontSize: 12, color: "#c0392b", fontWeight: 500 }}>⚠ {msg.text}</div>
            );

            return null;
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Bottom bar — textarea + send only */}
      <div style={{ flexShrink: 0, padding: "0.75rem 1.5rem 1rem", borderTop: "1px solid #ece6dc", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
            placeholder={intake ? `Your answer...` : "Ask AP anything about your project..."}
            rows={1}
            style={{ flex: 1, background: intake ? "#faf6ff" : "#faf8f5", border: `1.5px solid ${intake ? "#9b5de580" : "#e8e0d5"}`, borderRadius: 10, padding: "0.75rem 1rem", fontSize: 13, color: "#1c1812", outline: "none", resize: "none", lineHeight: 1.6, fontFamily: "Inter, sans-serif", transition: "border-color 0.15s", maxHeight: 100, overflow: "auto" }}
            onFocus={e => (e.currentTarget.style.borderColor = intake ? "#9b5de5" : activeDept.color)}
            onBlur={e  => (e.currentTarget.style.borderColor = intake ? "#9b5de550" : "#e8e0d5")}
          />
          <button onClick={() => handleSend()}
            style={{ padding: "0.75rem 1rem", background: (input.trim() || (intake && !intake.questions[intake.idx]?.required)) ? (intake ? "#9b5de5" : activeDept.color) : "#e8e0d5", border: "none", borderRadius: 10, color: "#fff", fontSize: 14, cursor: "pointer", flexShrink: 0, transition: "all 0.15s", boxShadow: input.trim() ? "0 4px 14px rgba(0,0,0,0.12)" : "none" }}>→</button>
        </div>

        {intake && (
          <p style={{ fontSize: 11, color: "#9b5de5", marginTop: "0.45rem", opacity: 0.85 }}>
            Question {intake.idx + 1} of {intake.questions.length}
            {!intake.questions[intake.idx]?.required && " · Optional — press Enter to skip"}
          </p>
        )}
      </div>

      </div>{/* end left column */}

      {/* Right Sidebar — Department modules */}
      {sidebarOpen && (
        <div style={{ width: 220, flexShrink: 0, borderLeft: "1px solid #ece6dc", background: "#fff", display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #ece6dc", flexShrink: 0 }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#b0a090" }}>Departments</p>
          </div>
          {DEPTS.map(d => {
            const status = getDeptStatus(d.id);
            const isSelected = selDept === d.id;
            const statusColor = status === "DONE" ? "#2daa6e" : status === "RUNNING" ? d.color : "#b0a090";
            const statusBg    = status === "DONE" ? "#edfaf4" : status === "RUNNING" ? d.color + "15" : "#f7f4ef";
            return (
              <div key={d.id}
                onClick={() => !isActive && setSelDept(d.id)}
                style={{
                  padding: "0.85rem 1rem",
                  borderBottom: "1px solid #f0ece5",
                  borderLeft: `3px solid ${isSelected ? d.color : "transparent"}`,
                  background: isSelected ? d.color + "07" : "transparent",
                  cursor: isActive ? "default" : "pointer",
                  transition: "all 0.15s",
                }}
              >
                {/* Icon + name */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                  <span style={{ fontSize: 15, color: d.color }}>{d.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? d.color : "#1c1812", flex: 1 }}>{d.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.05em", color: statusColor, background: statusBg, padding: "0.12rem 0.4rem", borderRadius: 4 }}>
                    {status === "RUNNING" ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", border: `1.5px solid ${d.color}50`, borderTopColor: d.color, animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                        LIVE
                      </span>
                    ) : status}
                  </span>
                </div>

                {/* Cost + ETA */}
                <div style={{ display: "flex", gap: "0.35rem", marginBottom: isSelected ? "0.65rem" : 0 }}>
                  <span style={{ fontSize: 10, color: d.color, background: d.bg, borderRadius: 4, padding: "0.1rem 0.45rem", fontWeight: 600 }}>{d.cost} cr</span>
                  <span style={{ fontSize: 10, color: "#b0a090", background: "#f7f4ef", borderRadius: 4, padding: "0.1rem 0.45rem" }}>~{d.eta}</span>
                </div>

                {/* Deploy button — only shown for selected, non-running dept */}
                {isSelected && status !== "RUNNING" && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (project) startDeployFromDNA(d.id, project);
                    }}
                    disabled={isActive}
                    style={{
                      width: "100%", padding: "0.45rem 0", borderRadius: 8,
                      background: isActive ? "#e8e0d5" : d.color,
                      color: isActive ? "#b0a090" : "#fff",
                      border: "none", fontSize: 11, fontWeight: 700,
                      cursor: isActive ? "not-allowed" : "pointer",
                      transition: "all 0.15s",
                      boxShadow: isActive ? "none" : `0 3px 10px ${d.color}40`,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem",
                    }}
                  >
                    {intake
                      ? `Q${intake.idx + 1}/${intake.questions.length} answering...`
                      : status === "DONE"
                      ? `↺ Re-run ${d.name}`
                      : `Deploy ${d.name} →`
                    }
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      </div>{/* end main content row */}

      {viewer && <DeliverableViewer d={viewer} projectId={id} onClose={() => setViewer(null)} />}

      <style>{`
        @keyframes spin   { to { transform: rotate(360deg) } }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes pulse  { 0%{box-shadow:0 0 0 0 currentColor} 70%{box-shadow:0 0 0 6px transparent} 100%{box-shadow:0 0 0 0 transparent} }
      `}</style>
    </div>
  );
}
