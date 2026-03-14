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

const FIELDS: Record<CrewName, FieldDef[]> = {
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
    { key: "brand_name",          label: "Brand name",                 placeholder: "e.g. NIID", required: true },
    { key: "category",            label: "Category",                   placeholder: "e.g. Food & Beverage" },
    { key: "location",            label: "Location",                   placeholder: "e.g. Mumbai" },
    { key: "customer",            label: "Who is the customer",        placeholder: "Demographics & psychographics" },
    { key: "platforms",           label: "Platforms",                  placeholder: "Instagram, LinkedIn, YouTube Shorts" },
    { key: "competitors",         label: "3–5 competitors",            placeholder: "Brand A, Brand B, Brand C" },
    { key: "personality",         label: "Brand personality (3 words)", placeholder: "e.g. Bold, Warm, Irreverent" },
    { key: "tone",                label: "Tone of voice",              placeholder: "e.g. Conversational, witty" },
    { key: "goal",                label: "Primary goal",               placeholder: "awareness / community / sales" },
    { key: "avoid",               label: "Content to avoid",           placeholder: "e.g. Corporate speak, stock photos" },
    { key: "content_inspiration", label: "2 accounts you admire",      placeholder: "@account1, @account2" },
    { key: "visual_inspiration",  label: "2–3 brands whose visual language you love", placeholder: "Nike, Aesop, Oatly" },
  ],
  ads: [
    { key: "brand_name",    label: "Brand name",                   placeholder: "e.g. NIID", required: true },
    { key: "product",       label: "Product to advertise",         placeholder: "Specific SKU or product line", required: true },
    { key: "product_url",   label: "Product URL",                  placeholder: "https://..." },
    { key: "what_it_is",    label: "Product description",          placeholder: "One sentence" },
    { key: "category",      label: "Category",                     placeholder: "e.g. Ready-to-eat food" },
    { key: "location",      label: "Location",                     placeholder: "City or country" },
    { key: "customer",      label: "Who is the customer",          placeholder: "Target audience" },
    { key: "competitors",   label: "3 competitors",                placeholder: "Brand A, Brand B, Brand C" },
    { key: "campaign_goal", label: "Campaign goal",                placeholder: "awareness / leads / sales" },
    { key: "budget",        label: "Monthly budget (INR)",         placeholder: "e.g. 50000" },
    { key: "duration",      label: "Campaign duration",            placeholder: "e.g. 30 days" },
    { key: "platforms",     label: "Platforms",                    placeholder: "Meta / Google / Both" },
    { key: "offer",         label: "Offer or hook",                placeholder: "consultation / discount / free trial" },
    { key: "brand_voice",   label: "Brand voice (3 words)",        placeholder: "e.g. Bold, Warm, Modern" },
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
  research: [
    { key: "brand_name", label: "Brand / company name",    placeholder: "e.g. NIID", required: true },
    { key: "query",      label: "Research focus",          placeholder: "What specifically to research?", type: "textarea" },
    { key: "category",   label: "Industry / category",     placeholder: "e.g. Ready-to-eat food" },
    { key: "location",   label: "Geography",               placeholder: "e.g. India" },
  ],
};

export default function BriefFields({ crew, clientName, onSubmit, onCancel }: Props) {
  const fields = FIELDS[crew] || [];
  const initial: AnyBrief = {};
  fields.forEach((f) => { initial[f.key] = ""; });
  // Pre-fill brand_name with client name
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
