"""
memory_stack.py - Art Protocol Project Memory

Every project maintains a memory.json that accumulates structured facts
across crew runs. Each crew reads from it before running and writes to it
after completing.

Memory structure:
{
  "brand_name": str,
  "category": str,
  "location": str,
  "stage": str,
  "last_updated": ISO timestamp,
  "runs_completed": ["research", "branding", ...],
  "brief": { ...original brief fields... },
  "research": {
    "market_summary": str,        # 3-5 key market findings
    "target_customer": str,       # who the customer is
    "top_competitors": str,       # competitor names and gaps
    "differentiation": str,       # unclaimed positioning territory
    "cultural_context": str,      # hyperlocal insights
    "key_risks": str,             # adversarial findings
  },
  "branding": {
    "archetype": str,
    "personality": str,           # 3-5 traits
    "tagline": str,
    "tone_of_voice": str,
    "color_palette": str,         # hex codes and names
    "positioning_statement": str,
  },
  "social": {
    "content_pillars": str,       # 5 pillars
    "brand_voice": str,
    "platforms": str,
  },
  "ads": {
    "primary_audience": str,
    "campaign_hook": str,
    "channels": str,
  }
}
"""

import os
import json
from datetime import datetime
from typing import Optional


def get_memory_path(client_name: str) -> str:
    base = os.getenv("AP_CLIENT_BASE", "")
    if base:
        folder = base
    else:
        folder = os.path.join("clients", client_name)
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, "memory.json")


def load_memory(client_name: str) -> dict:
    path = get_memory_path(client_name)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[MEMORY] Could not load memory: {e}", flush=True)
    return {}


def save_memory(client_name: str, memory: dict):
    path = get_memory_path(client_name)
    memory["last_updated"] = datetime.now().isoformat()
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(memory, f, indent=2, ensure_ascii=False)
        print(f"[MEMORY] Saved -> {path}", flush=True)
    except Exception as e:
        print(f"[MEMORY] Could not save: {e}", flush=True)


def init_memory(client_name: str, brief: dict) -> dict:
    """Create or update base memory from brief."""
    memory = load_memory(client_name)
    # Always update brief fields
    memory.update({
        "brand_name":      brief.get("brand_name", client_name),
        "category":        brief.get("category", ""),
        "location":        brief.get("location", ""),
        "stage":           brief.get("stage", "new"),
        "brief":           brief,
        "runs_completed":  memory.get("runs_completed", []),
    })
    save_memory(client_name, memory)
    return memory


def extract_research_memory(output: str, brief: dict) -> dict:
    """
    Extract key facts from research output using Claude.
    Called after research crew completes.
    """
    import anthropic
    from dotenv import load_dotenv
    load_dotenv()

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

    prompt = (
        "Extract the key strategic facts from this research report for " +
        brief.get("brand_name", "this brand") + ".\n\n"
        "Return a JSON object with exactly these keys:\n"
        "- market_summary: 2-3 sentences on market size, growth, structure\n"
        "- target_customer: who the customer is (demographics + psychographics)\n"
        "- top_competitors: comma-separated competitor names and their positioning\n"
        "- differentiation: the unclaimed positioning territory identified\n"
        "- cultural_context: 2-3 key cultural/behavioral insights\n"
        "- key_risks: top 2-3 market risks or failure modes\n\n"
        "Return ONLY valid JSON. No markdown, no explanation.\n\n"
        "Research report (first 8000 chars):\n" + output[:8000]
    )

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        text = response.content[0].text.strip()
        # Strip any markdown code fences
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        print(f"[MEMORY] Research extraction failed: {e}", flush=True)
        return {}


def extract_branding_memory(output: str) -> dict:
    """Extract key facts from branding output."""
    import anthropic
    from dotenv import load_dotenv
    load_dotenv()

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

    prompt = (
        "Extract the core brand identity facts from this brand strategy document.\n\n"
        "Return a JSON object with exactly these keys:\n"
        "- archetype: the brand archetype (one word or phrase)\n"
        "- personality: 3-5 personality traits as comma-separated list\n"
        "- tagline: the brand tagline or hero message\n"
        "- tone_of_voice: how the brand speaks (2-3 sentences)\n"
        "- color_palette: primary colors with hex codes if mentioned\n"
        "- positioning_statement: the full positioning statement\n\n"
        "Return ONLY valid JSON. No markdown, no explanation.\n\n"
        "Brand document (first 8000 chars):\n" + output[:8000]
    )

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}]
        )
        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        print(f"[MEMORY] Branding extraction failed: {e}", flush=True)
        return {}


def build_context_injection(client_name: str, crew_name: str) -> str:
    """
    Build a context string to inject into crew runs.
    Each crew gets the memory relevant to it.
    """
    memory = load_memory(client_name)
    if not memory:
        return ""

    brand = memory.get("brand_name", client_name)
    runs  = memory.get("runs_completed", [])

    if not runs:
        return ""

    lines = [
        f"=== PROJECT MEMORY: {brand} ===",
        f"Category: {memory.get('category', '')}",
        f"Location: {memory.get('location', '')}",
        f"Stage: {memory.get('stage', '')}",
        f"Crews completed: {', '.join(runs)}",
        "",
    ]

    # Inject research memory for branding/social/ads crews
    if crew_name in ("branding", "social", "ads") and "research" in runs:
        research = memory.get("research", {})
        if research:
            lines += [
                "--- RESEARCH FINDINGS ---",
                f"Market: {research.get('market_summary', '')}",
                f"Customer: {research.get('target_customer', '')}",
                f"Competitors: {research.get('top_competitors', '')}",
                f"Differentiation opportunity: {research.get('differentiation', '')}",
                f"Cultural context: {research.get('cultural_context', '')}",
                f"Key risks: {research.get('key_risks', '')}",
                "",
            ]

    # Inject branding memory for social/ads crews
    if crew_name in ("social", "ads") and "branding" in runs:
        branding = memory.get("branding", {})
        if branding:
            lines += [
                "--- BRAND IDENTITY ---",
                f"Archetype: {branding.get('archetype', '')}",
                f"Personality: {branding.get('personality', '')}",
                f"Tagline: {branding.get('tagline', '')}",
                f"Tone of voice: {branding.get('tone_of_voice', '')}",
                f"Colors: {branding.get('color_palette', '')}",
                f"Positioning: {branding.get('positioning_statement', '')}",
                "",
            ]

    lines.append("=== END MEMORY ===")
    return "\n".join(lines)
