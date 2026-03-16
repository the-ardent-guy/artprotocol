"use client";

import { useState } from "react";
import { CrewName, AnyBrief } from "@/lib/types";

interface Props {
  crew:       CrewName;
  clientName: string;
  onSubmit:   (fields: AnyBrief) => void;
  onCancel:   () => void;
}

type FieldDef = {
  key:         string;
  label:       string;
  placeholder: string;
  required?:   boolean;
  type?:       "text" | "textarea";
};

// ─── STATIC FIELD DEFS (branding, social, ads, proposal) ─────────────────────

const FIELDS: Record<Exclude<CrewName, "research">, FieldDef[]> = {
  branding: [
    { key: "brand_name",     label: "Brand name",                           placeholder: "e.g. NIID", required: true },
    { key: "what_it_is",     label: "What is it",                           placeholder: "One sentence description", required: true },
    { key: "category",       label: "Category",                             placeholder: "e.g. Ready-to-eat food", required: true },
    { key: "subcategory",    label: "Subcategory / niche",                  placeholder: "e.g. Indian street food" },
    { key: "location",       label: "Primary location",                     placeholder: "e.g. Mumbai" },
    { key: "target_geo",     label: "Target geography",                     placeholder: "e.g. Tier 1 cities, India" },
    { key: "customer",       label: "Who is the customer",                  placeholder: "e.g. 25-35, urban professionals" },
    { key: "problem_solved", label: "Problem solved",                       placeholder: "What problem does it solve?" },
    { key: "competitors",    label: "3 competitors",                        placeholder: "Brand A, Brand B, Brand C" },
    { key: "founder_belief", label: "Founder belief others don't share",    placeholder: "A contrarian view" },
    { key: "stage",          label: "Stage",                                placeholder: "new / existing / repositioning" },
    { key: "never_do",       label: "What would this brand never do",       placeholder: "Non-negotiable brand rule" },
  ],
  social: [
    { key: "brand_name",          label: "Brand name",                          placeholder: "e.g. NIID", required: true },
    { key: "category",            label: "Category",                            placeholder: "e.g. Food & Beverage" },
    { key: "location",            label: "Location",                            placeholder: "e.g. Mumbai" },
    { key: "customer",            label: "Who is the customer",                 placeholder: "Demographics & psychographics" },
    { key: "platforms",           label: "Platforms",                           placeholder: "Instagram, LinkedIn, YouTube Shorts" },
    { key: "competitors",         label: "3–5 competitors",                     placeholder: "Brand A, Brand B, Brand C" },
    { key: "personality",         label: "Brand personality (3 words)",         placeholder: "e.g. Bold, Warm, Irreverent" },
    { key: "tone",                label: "Tone of voice",                       placeholder: "e.g. Conversational, witty" },
    { key: "goal",                label: "Primary goal",                        placeholder: "awareness / community / sales" },
    { key: "avoid",               label: "Content to avoid",                    placeholder: "e.g. Corporate speak, stock photos" },
    { key: "content_inspiration", label: "2 accounts you admire",               placeholder: "@account1, @account2" },
    { key: "visual_inspiration",  label: "2–3 brands whose visual style you love", placeholder: "Nike, Aesop, Oatly" },
  ],
  ads: [
    { key: "brand_name",    label: "Brand name",              placeholder: "e.g. NIID", required: true },
    { key: "product",       label: "Product to advertise",    placeholder: "Specific SKU or product line", required: true },
    { key: "product_url",   label: "Product URL",             placeholder: "https://..." },
    { key: "what_it_is",    label: "Product description",     placeholder: "One sentence" },
    { key: "category",      label: "Category",                placeholder: "e.g. Ready-to-eat food" },
    { key: "location",      label: "Location",                placeholder: "City or country" },
    { key: "customer",      label: "Who is the customer",     placeholder: "Target audience" },
    { key: "competitors",   label: "3 competitors",           placeholder: "Brand A, Brand B, Brand C" },
    { key: "campaign_goal", label: "Campaign goal",           placeholder: "awareness / leads / sales" },
    { key: "budget",        label: "Monthly budget (INR)",    placeholder: "e.g. 50000" },
    { key: "duration",      label: "Campaign duration",       placeholder: "e.g. 30 days" },
    { key: "platforms",     label: "Platforms",               placeholder: "Meta / Google / Both" },
    { key: "offer",         label: "Offer or hook",           placeholder: "consultation / discount / free trial" },
    { key: "brand_voice",   label: "Brand voice (3 words)",   placeholder: "e.g. Bold, Warm, Modern" },
  ],
  proposal: [
    { key: "brand_name",  label: "Client / brand name",          placeholder: "e.g. NIID", required: true },
    { key: "what_it_is",  label: "What they do (2–3 sentences)", placeholder: "Describe the client's business", type: "textarea" as const },
    { key: "challenge",   label: "Their main challenge",         placeholder: "What problem are they trying to solve?" },
    { key: "goal",        label: "What they want to achieve",    placeholder: "e.g. Launch brand, grow social, run ads" },
    { key: "audience",    label: "Target audience",              placeholder: "Who are their customers?" },
    { key: "services",    label: "Services requested",           placeholder: "e.g. Branding, Social Media, Ads" },
    { key: "stage",       label: "Brand stage",                  placeholder: "new / growing / repositioning" },
    { key: "budget",      label: "Budget indication",            placeholder: "e.g. ₹2L–5L or 'not discussed'" },
    { key: "personality", label: "Brand personality (3 words)",  placeholder: "e.g. Bold, Warm, Modern" },
    { key: "notes",       label: "Additional context",           placeholder: "Any other relevant info (optional)" },
  ],
};

// ─── RESEARCH: CONVERSATIONAL STEP DEFINITIONS ───────────────────────────────

type StepType = "text" | "textarea" | "select" | "optional-text";

interface ResearchStep {
  key:         string;
  question:    string;
  subtext:     string;
  placeholder: string;
  type:        StepType;
  required:    boolean;
  options?:    { value: string; label: string; desc: string }[];
}

const RESEARCH_STEPS: ResearchStep[] = [
  {
    key:         "brand_name",
    question:    "What's the name of the brand or company?",
    subtext:     "This is who we're researching.",
    placeholder: "e.g. NIID, Zepto, Bombay Shirt Company",
    type:        "text",
    required:    true,
  },
  {
    key:         "what_it_is",
    question:    "What does it do?",
    subtext:     "One clear sentence — what it is, what it sells or offers.",
    placeholder: "e.g. A ready-to-eat Indian street food brand targeting urban millennials",
    type:        "textarea",
    required:    true,
  },
  {
    key:         "category",
    question:    "What industry or category is this in?",
    subtext:     "Be as specific as you can — it makes the research sharper.",
    placeholder: "e.g. D2C skincare, SaaS for SMBs, Ready-to-eat food, EV two-wheelers",
    type:        "text",
    required:    true,
  },
  {
    key:         "location",
    question:    "Where is the brand based, and where does it operate?",
    subtext:     "Primary city or market. This shapes the cultural and competitive research.",
    placeholder: "e.g. Mumbai, Pan-India, UAE, Southeast Asia",
    type:        "text",
    required:    true,
  },
  {
    key:         "problem_solved",
    question:    "What problem does this brand solve?",
    subtext:     "What's broken, missing, or frustrating about the current options — and how does this brand fix it?",
    placeholder: "e.g. Healthy Indian street food doesn't exist at scale. Everything is either junk or tasteless health food.",
    type:        "textarea",
    required:    true,
  },
  {
    key:         "stage",
    question:    "Where is the brand right now?",
    subtext:     "This tells us what kind of research to prioritise.",
    placeholder: "",
    type:        "select",
    required:    true,
    options: [
      {
        value: "new",
        label: "New Launch",
        desc:  "Pre-launch or just launched — building from scratch",
      },
      {
        value: "existing",
        label: "Existing Brand",
        desc:  "Already operating — looking to grow or improve",
      },
      {
        value: "repositioning",
        label: "Repositioning",
        desc:  "Changing direction, audience, or identity",
      },
    ],
  },
  {
    key:         "customer",
    question:    "Who is the target customer?",
    subtext:     "Optional — if you're not sure, the research will map this out for you.",
    placeholder: "e.g. Urban women, 25–35, working professionals in Tier 1 cities",
    type:        "optional-text",
    required:    false,
  },
  {
    key:         "competitors",
    question:    "Who are the main competitors?",
    subtext:     "Optional — we'll find them. But if you know them, add them here for more targeted research.",
    placeholder: "e.g. Haldirams, iD Fresh, Epigamia",
    type:        "optional-text",
    required:    false,
  },
];

// ─── CONVERSATIONAL RESEARCH FORM ────────────────────────────────────────────

function ResearchBriefFlow({
  clientName,
  onSubmit,
  onCancel,
}: {
  clientName: string;
  onSubmit:   (fields: AnyBrief) => void;
  onCancel:   () => void;
}) {
  const [step,   setStep]   = useState(0);
  const [values, setValues] = useState<AnyBrief>({
    brand_name:     clientName.replace(/_/g, " "),
    what_it_is:     "",
    category:       "",
    location:       "",
    problem_solved: "",
    stage:          "",
    customer:       "",
    competitors:    "",
  });

  const current   = RESEARCH_STEPS[step];
  const total     = RESEARCH_STEPS.length;
  const progress  = Math.round(((step) / total) * 100);
  const isLast    = step === total - 1;
  const val       = values[current.key] || "";

  function update(v: string) {
    setValues((prev) => ({ ...prev, [current.key]: v }));
  }

  function canAdvance() {
    if (!current.required) return true;
    return val.trim().length > 0;
  }

  function handleNext() {
    if (!canAdvance()) return;
    if (isLast) {
      onSubmit(values);
    } else {
      setStep((s) => s + 1);
    }
  }

  function handleSkip() {
    setValues((prev) => ({ ...prev, [current.key]: "" }));
    if (isLast) {
      onSubmit(values);
    } else {
      setStep((s) => s + 1);
    }
  }

  function handleBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && current.type !== "textarea") {
      e.preventDefault();
      handleNext();
    }
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* Progress bar */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-[#555] uppercase tracking-widest font-medium">
            Research Brief
          </span>
          <span className="text-[10px] text-[#555] font-mono">
            {step + 1} / {total}
          </span>
        </div>
        <div className="h-0.5 bg-[#1e1e1e] rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-300"
            style={{ width: `${progress + (100 / total)}%` }}
          />
        </div>
      </div>

      {/* Question area */}
      <div className="px-6 pb-2 flex-1">
        <h3 className="text-base font-semibold text-white mb-1 leading-snug">
          {current.question}
        </h3>
        <p className="text-xs text-[#555] mb-5 leading-relaxed">
          {current.subtext}
        </p>

        {/* Text input */}
        {current.type === "text" && (
          <input
            autoFocus
            type="text"
            value={val}
            onChange={(e) => update(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={current.placeholder}
            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-white placeholder-[#3a3a3a] focus:border-amber-500 focus:outline-none transition-colors"
          />
        )}

        {/* Textarea */}
        {(current.type === "textarea") && (
          <textarea
            autoFocus
            value={val}
            onChange={(e) => update(e.target.value)}
            placeholder={current.placeholder}
            rows={3}
            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-white placeholder-[#3a3a3a] focus:border-amber-500 focus:outline-none transition-colors resize-none leading-relaxed"
          />
        )}

        {/* Optional text */}
        {current.type === "optional-text" && (
          <input
            autoFocus
            type="text"
            value={val}
            onChange={(e) => update(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={current.placeholder}
            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-white placeholder-[#3a3a3a] focus:border-amber-500 focus:outline-none transition-colors"
          />
        )}

        {/* Stage selector */}
        {current.type === "select" && current.options && (
          <div className="space-y-2">
            {current.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update(opt.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                  val === opt.value
                    ? "border-amber-500/60 bg-amber-500/8 text-white"
                    : "border-[#2a2a2a] bg-[#0d0d0d] text-[#888] hover:border-[#3a3a3a] hover:text-[#bbb]"
                }`}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-[#555] mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="px-6 py-4 border-t border-[#1e1e1e] mt-4">
        <div className="flex gap-2">
          {/* Cancel / Back */}
          {step === 0 ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 border border-[#2a2a2a] hover:border-[#3a3a3a] text-[#666] text-sm rounded-lg transition-colors"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2.5 border border-[#2a2a2a] hover:border-[#3a3a3a] text-[#666] text-sm rounded-lg transition-colors"
            >
              ← Back
            </button>
          )}

          <div className="flex-1" />

          {/* Skip (optional questions only) */}
          {!current.required && (
            <button
              type="button"
              onClick={handleSkip}
              className="px-4 py-2.5 text-[#555] hover:text-[#888] text-sm transition-colors"
            >
              Skip
            </button>
          )}

          {/* Next / Start */}
          <button
            type="button"
            onClick={handleNext}
            disabled={!canAdvance()}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed text-black text-sm font-semibold rounded-lg transition-colors"
          >
            {isLast ? "Start Research →" : "Next →"}
          </button>
        </div>

        {/* Enter hint for text fields */}
        {(current.type === "text" || current.type === "optional-text") && (
          <p className="text-[10px] text-[#333] text-center mt-2">
            Press Enter to continue
          </p>
        )}
      </div>
    </div>
  );
}

// ─── STATIC FORM (branding, social, ads, proposal) ───────────────────────────

function StaticBriefForm({
  crew,
  clientName,
  onSubmit,
  onCancel,
}: {
  crew:       Exclude<CrewName, "research">;
  clientName: string;
  onSubmit:   (fields: AnyBrief) => void;
  onCancel:   () => void;
}) {
  const fields  = FIELDS[crew] || [];
  const initial: AnyBrief = {};
  fields.forEach((f) => { initial[f.key] = ""; });
  if (initial.brand_name !== undefined) {
    initial.brand_name = clientName.replace(/_/g, " ");
  }

  const [values, setValues] = useState<AnyBrief>(initial);

  function update(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="px-6 py-4 max-h-[65vh] overflow-y-auto space-y-4">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs text-[#666] uppercase tracking-widest">
              {f.label}
              {f.required && <span className="text-amber-500 ml-0.5">*</span>}
            </label>
            {f.type === "textarea" ? (
              <textarea
                value={values[f.key] || ""}
                onChange={(e) => update(f.key, e.target.value)}
                required={f.required}
                rows={3}
                placeholder={f.placeholder}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2.5 text-sm text-white placeholder-[#444] focus:border-amber-500 focus:outline-none transition-colors resize-none"
              />
            ) : (
              <input
                type="text"
                value={values[f.key] || ""}
                onChange={(e) => update(f.key, e.target.value)}
                required={f.required}
                placeholder={f.placeholder}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2.5 text-sm text-white placeholder-[#444] focus:border-amber-500 focus:outline-none transition-colors"
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-3 px-6 py-4 border-t border-[#1e1e1e]">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-[#2a2a2a] hover:border-[#3a3a3a] text-[#888] text-sm py-2.5 rounded transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm py-2.5 rounded transition-colors"
        >
          Start Run
        </button>
      </div>
    </form>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export default function BriefFields({ crew, clientName, onSubmit, onCancel }: Props) {
  if (crew === "research") {
    return (
      <ResearchBriefFlow
        clientName={clientName}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );
  }

  return (
    <StaticBriefForm
      crew={crew as Exclude<CrewName, "research">}
      clientName={clientName}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
}
