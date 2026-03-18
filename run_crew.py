#!/usr/bin/env python3
"""
Headless crew runner for Art Protocol OS.
Called by the FastAPI backend as a subprocess.

Usage:
    python run_crew.py --client NIID --crew branding --brief-json '{"brand_name":"NIID",...}'
    python run_crew.py --client NIID --crew social --brief-json '...' --brand-doc path/to/doc.txt
"""

import sys
import os
import json
import argparse
import time
from datetime import datetime

# Ensure we run from project root
ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

# Load .env
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Memory stack
from memory_stack import (
    init_memory, save_memory, load_memory,
    extract_research_memory, extract_branding_memory,
    build_context_injection
)


def save_to_client_folder(client_name, crew_name, content):
    """Save output to the client's folder and return the path."""
    # Use CLIENTS_DIR env var so Railway and local both save to the right place
    clients_base = os.getenv("CLIENTS_DIR") or os.path.join(ROOT, "clients")
    folder = os.path.join(clients_base, client_name)
    os.makedirs(folder, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    filename = f"{crew_name}_{timestamp}.txt"
    filepath = os.path.join(folder, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(str(content))
    print(f"\n[SAVED] Output -> {filepath}", flush=True)
    return filepath


def run_branding_headless(client_name, brief):
    print("\n" + "=" * 60, flush=True)
    print("BRANDING CREW - ART PROTOCOL (headless)", flush=True)
    print("=" * 60, flush=True)
    print(f"Client: {client_name}", flush=True)
    print(f"Brand: {brief.get('brand_name', client_name)}", flush=True)

    from branding_crew import (
        create_tasks,
        get_branding_folder,
        save_checkpoint,
        market_researcher,
        brand_strategist,
        visual_director,
        launch_strategist,
        document_compiler,
    )
    from crewai import Crew, Process

    safe_name = brief.get("brand_name", client_name).replace(" ", "_")

    # Start fresh checkpoint with this brief
    checkpoint = {"completed": [], "outputs": {}, "brief": brief}
    save_checkpoint(safe_name, checkpoint)

    tasks = create_tasks(brief)

    def branding_step_callback(step_output):
        agent_name = str(getattr(step_output, 'agent', '') or '')
        if hasattr(step_output, 'thought') and step_output.thought:
            thought_preview = str(step_output.thought)[:80]
            print(f'[STATUS] {agent_name}: {thought_preview}...', flush=True)
        elif hasattr(step_output, 'tool') and step_output.tool:
            print(f'[STATUS] {agent_name} using {step_output.tool}...', flush=True)

    crew = Crew(
        agents=[
            market_researcher,
            brand_strategist,
            visual_director,
            launch_strategist,
            document_compiler,
        ],
        tasks=tasks,
        process=Process.sequential,
        max_rpm=3,
        verbose=True,
        step_callback=branding_step_callback,
    )

    print('[STATUS] Crew assembled: Market Researcher + Brand Strategist + Visual Director + GTM Strategist', flush=True)
    print('[STATUS] Starting with competitive landscape research...', flush=True)
    print('[STATUS] Researching market landscape...', flush=True)
    print(f"\n>> Starting Branding Crew for {brief['brand_name']}...", flush=True)
    result = crew.kickoff()

    output_path = save_to_client_folder(client_name, "brand_document", result)

    # Parse .txt output and save parallel .json file
    _save_branding_json(output_path, result)

    print("\n[BRANDING CREW COMPLETE]", flush=True)
    return result


def _save_branding_json(txt_path: str, result) -> None:
    """Parse branding .txt output and save a parallel .json file with key blocks."""
    if not txt_path or not os.path.exists(txt_path):
        return

    try:
        with open(txt_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception:
        return

    result_str = str(result)
    combined = content + "\n" + result_str

    # Section header patterns → JSON key
    sections = {
        "positioning_statement": [
            "positioning statement", "positioning:", "for / who", "expanded format"
        ],
        "brand_archetype": [
            "brand archetype", "archetype +", "archetype:"
        ],
        "voice_rules": [
            "tone of voice", "tone:", "how the brand speaks", "voice guide"
        ],
        "visual_language": [
            "visual identity", "color palette", "typography", "visual system"
        ],
        "taglines": [
            "tagline", "hero tagline", "messaging framework", "key message"
        ],
        "gtm_strategy": [
            "go-to-market", "gtm", "launch sequence", "channel strategy"
        ],
        "swot": [
            "swot", "strengths", "weaknesses", "opportunities", "threats"
        ],
    }

    extracted = {}
    lines = combined.split("\n")

    for i, line in enumerate(lines):
        line_lower = line.lower().strip()
        for key, patterns in sections.items():
            if key in extracted:
                continue
            for pat in patterns:
                if pat in line_lower and (line_lower.startswith("#") or line_lower.startswith("##") or line_lower.isupper() or ":" in line_lower):
                    # Grab next 30 lines as the section content
                    end = min(i + 30, len(lines))
                    extracted[key] = "\n".join(lines[i:end]).strip()
                    break

    if extracted:
        json_path = txt_path.replace(".txt", ".json")
        try:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(extracted, f, indent=2, ensure_ascii=False)
            print(f"\n[SAVED] Brand JSON -> {json_path}", flush=True)
        except Exception as e:
            print(f"[WARNING] Could not save brand JSON: {e}", flush=True)


def run_social_headless(client_name, brief, brand_document=None):
    print("\n" + "=" * 60, flush=True)
    print("SOCIAL MEDIA CREW - ART PROTOCOL (headless)", flush=True)
    print("=" * 60, flush=True)
    print(f"Client: {client_name}", flush=True)

    from social_crew import (
        create_social_tasks,
        get_social_folder,
        brand_voice_agent,
        competitor_social_agent,
        platform_intelligence_agent,
        social_brand_language_agent,
        content_strategist_agent,
        campaign_ideation_agent,
        content_calendar_agent,
        copy_agent,
        qa_agent,
        scheduler_agent,
    )
    from crewai import Crew, Process

    folder = get_social_folder(brief.get("brand_name", client_name))

    tasks = create_social_tasks(brief, brand_document)

    def social_step_callback(step_output):
        agent_name = str(getattr(step_output, 'agent', '') or '')
        if hasattr(step_output, 'thought') and step_output.thought:
            thought_preview = str(step_output.thought)[:80]
            print(f'[STATUS] {agent_name}: {thought_preview}...', flush=True)
        elif hasattr(step_output, 'tool') and step_output.tool:
            print(f'[STATUS] {agent_name} using {step_output.tool}...', flush=True)

    crew = Crew(
        agents=[
            brand_voice_agent,
            competitor_social_agent,
            platform_intelligence_agent,
            social_brand_language_agent,
            content_strategist_agent,
            campaign_ideation_agent,
            content_calendar_agent,
            copy_agent,
            qa_agent,
            scheduler_agent,
        ],
        tasks=tasks,
        process=Process.sequential,
        verbose=True,
        max_rpm=3,
        max_retries=2,
        step_callback=social_step_callback,
    )

    print('[STATUS] Crew assembled: Brand Voice + Platform Intelligence + Content Strategist + Calendar + Copywriter', flush=True)
    print(f'[STATUS] Analysing {brief.get("brand_name", client_name)} brand voice...', flush=True)
    print(f"\n>> Starting Social Crew for {brief['brand_name']}...", flush=True)
    result = crew.kickoff()

    save_to_client_folder(client_name, "social_media", result)
    print("\n[SOCIAL CREW COMPLETE]", flush=True)
    return result


def run_ads_headless(client_name, brief, brand_document=None):
    print("\n" + "=" * 60, flush=True)
    print("ADS CREW - ART PROTOCOL (headless)", flush=True)
    print("=" * 60, flush=True)
    print(f"Client: {client_name}", flush=True)

    from ads_crew import (
        create_ads_tasks,
        get_competitor_ads,
        get_ads_folder,
        load_checkpoint,
        save_checkpoint,
        audience_researcher,
        competitor_ads_analyst,
        ad_strategist,
        ad_copywriter,
        creative_director,
        campaign_architect,
        performance_analyst,
        deployment_agent,
    )
    from crewai import Crew, Process

    context = brand_document or ""
    safe_name = (
        brief["brand_name"].replace(" ", "_")
        + "_"
        + brief.get("product", "ads").replace(" ", "_")[:25]
    )
    folder = get_ads_folder(brief["brand_name"], brief.get("product", "ads"))
    checkpoint = {"completed": [], "outputs": {}, "brief": brief}
    save_checkpoint(folder, safe_name, checkpoint)

    print('[STATUS] Crew assembled: Audience Researcher + Ad Strategist + Copywriter + Campaign Architect', flush=True)
    print('[STATUS] Profiling your target audience...', flush=True)
    print(
        f"\n>> Scraping competitor ads for {brief.get('category', '')}...", flush=True
    )
    print('[STATUS] Gathering competitor ad intelligence...', flush=True)
    competitor_ads = get_competitor_ads(brief["brand_name"], brief.get("category", ""))
    print("done: Competitor ad intelligence gathered", flush=True)

    print('[STATUS] Structuring campaign architecture...', flush=True)
    tasks = create_ads_tasks(brief, competitor_ads, context)

    def ads_step_callback(step_output):
        agent_name = str(getattr(step_output, 'agent', '') or '')
        if hasattr(step_output, 'thought') and step_output.thought:
            thought_preview = str(step_output.thought)[:80]
            print(f'[STATUS] {agent_name}: {thought_preview}...', flush=True)
        elif hasattr(step_output, 'tool') and step_output.tool:
            print(f'[STATUS] {agent_name} using {step_output.tool}...', flush=True)

    crew = Crew(
        agents=[
            audience_researcher,
            competitor_ads_analyst,
            ad_strategist,
            ad_copywriter,
            creative_director,
            campaign_architect,
            performance_analyst,
            deployment_agent,
        ],
        tasks=tasks,
        process=Process.sequential,
        max_rpm=3,
        verbose=True,
        step_callback=ads_step_callback,
    )

    print('[STATUS] Building audience profile...', flush=True)
    print(f"\n>> Starting Ads Crew for {brief['brand_name']}...", flush=True)
    result = crew.kickoff()

    save_to_client_folder(client_name, "ads_campaign", result)
    print("\n[ADS CREW COMPLETE]", flush=True)
    return result


def run_proposal_headless(client_name, brief):
    print("\n" + "=" * 60, flush=True)
    print("PROPOSAL CREW - ART PROTOCOL (headless)", flush=True)
    print("=" * 60, flush=True)
    print(f"Client: {client_name}", flush=True)

    from proposal_crew import create_proposal_tasks, proposal_writer, scope_writer, pricing_strategist, proposal_critic
    from crewai import Crew, Process

    crew_brief = {
        "client_name":        brief.get("brand_name", client_name),
        "what_they_do":       brief.get("what_it_is", ""),
        "challenge":          brief.get("challenge", ""),
        "goal":               brief.get("goal", ""),
        "audience":           brief.get("audience", ""),
        "services_requested": brief.get("services", ""),
        "stage":              brief.get("stage", "new"),
        "budget_indication":  brief.get("budget", "not discussed"),
        "personality":        brief.get("personality", ""),
        "additional_context": brief.get("notes", ""),
    }

    tasks = create_proposal_tasks(crew_brief)

    def proposal_step_callback(step_output):
        agent_name = str(getattr(step_output, 'agent', '') or '')
        if hasattr(step_output, 'thought') and step_output.thought:
            thought_preview = str(step_output.thought)[:80]
            print(f'[STATUS] {agent_name}: {thought_preview}...', flush=True)
        elif hasattr(step_output, 'tool') and step_output.tool:
            print(f'[STATUS] {agent_name} using {step_output.tool}...', flush=True)

    crew = Crew(
        agents=[proposal_writer, scope_writer, pricing_strategist, proposal_critic],
        tasks=tasks,
        process=Process.sequential,
        verbose=True,
        step_callback=proposal_step_callback,
    )

    print('[STATUS] Crew assembled: Proposal Writer + Scope Analyst + Pricing Strategist + Critic', flush=True)
    print(f'[STATUS] Drafting proposal structure for {crew_brief["client_name"]}...', flush=True)
    print(f"\n>> Starting Proposal Crew for {crew_brief['client_name']}...", flush=True)
    result = crew.kickoff()

    save_to_client_folder(client_name, "proposal", result)
    print("\n[PROPOSAL CREW COMPLETE]", flush=True)
    return result


def run_research_headless(client_name, brief):
    print("\n" + "=" * 60, flush=True)
    print("RESEARCH - ART PROTOCOL (headless)", flush=True)
    print("=" * 60, flush=True)

    from research import run_headless_direct

    name       = brief.get("brand_name", client_name)
    category   = brief.get("category", "")
    location   = brief.get("location", "")
    stage      = brief.get("stage", "new")
    competitors = brief.get("competitors", "")

    print(f"  Brand:       {name}", flush=True)
    print(f"  Category:    {category}", flush=True)
    print(f"  Location:    {location}", flush=True)
    print(f"  Stage:       {stage}", flush=True)
    print(f"  Competitors: {competitors or 'not provided — will research'}", flush=True)
    print('[STATUS] Decomposing your research brief...', flush=True)
    print(f'[STATUS] Building 15-query search plan for {name}...', flush=True)

    # Ensure research.py brief fields are fully mapped
    research_brief = {
        "brand_name":     name,
        "what_it_is":     brief.get("what_it_is", brief.get("query", "")),
        "category":       category,
        "subcategory":    "",
        "location":       location,
        "target_geo":     location,
        "customer":       brief.get("customer", ""),
        "problem_solved": brief.get("problem_solved", brief.get("notes", "")),
        "competitors":    competitors,
        "founder_belief": "",
        "stage":          stage or "new",
        "never_do":       "",
        # Pass through DNA fields if present
        **{k: v for k, v in brief.items() if k in (
            "brand_archetype", "tone_axis", "competitor_keywords",
            "positioning_territory", "geo_tier", "visual_mood"
        )},
    }

    result = run_headless_direct(research_brief, client_name)
    print("\n[RESEARCH COMPLETE]", flush=True)
    return result


def enrich_brief_with_dna(brief: dict, dna: dict) -> dict:
    """Merge DNA fields into brief so all crew runners get full context."""
    enriched = brief.copy()
    # Raw DNA field mappings
    enriched["brand_name"]       = dna.get("brand_name", brief.get("brand_name", ""))
    enriched["category"]         = dna.get("category", brief.get("category", ""))
    enriched["target_audience"]  = dna.get("audience", dna.get("target_audience", brief.get("target_audience", "")))
    enriched["what_it_is"]       = dna.get("usp", dna.get("what_it_is", brief.get("what_it_is", "")))
    enriched["stage"]            = dna.get("stage", brief.get("stage", ""))
    # Enriched DNA fields
    enriched["brand_archetype"]  = dna.get("brand_archetype", brief.get("brand_archetype", ""))
    enriched["tone_axis"]        = dna.get("tone_axis", brief.get("tone_axis", ""))
    enriched["visual_mood"]      = dna.get("visual_mood", brief.get("visual_mood", ""))
    enriched["reference_brand"]  = dna.get("reference_brand", brief.get("reference_brand", ""))
    enriched["positioning_territory"] = dna.get("positioning_territory", brief.get("positioning_territory", ""))
    enriched["geo_tier"]         = dna.get("geo_tier", brief.get("geo_tier", ""))
    # Arrays joined to comma-separated strings for crew prompt compatibility
    content_pillars = dna.get("content_pillars", brief.get("content_pillars", []))
    if isinstance(content_pillars, list):
        enriched["content_pillars"] = ", ".join(content_pillars)
    else:
        enriched["content_pillars"] = content_pillars
    competitor_keywords = dna.get("competitor_keywords", brief.get("competitor_keywords", []))
    if isinstance(competitor_keywords, list):
        enriched["competitor_keywords"] = ", ".join(competitor_keywords)
    else:
        enriched["competitor_keywords"] = competitor_keywords
    return enriched


def normalize_brief(brief: dict, client_name: str) -> dict:
    """Ensure brief has expected fields.
    When called from the user-facing app, brief may be {'brief': '<raw text>'}.
    We extract a brand_name and fill in defaults so crew runners don't crash.
    """
    if "brand_name" in brief:
        return brief  # already structured

    raw_text = brief.get("brief", "")
    # Use the last segment of the client path as project name
    folder_name = client_name.split("/")[-1].replace("_", " ").strip() or client_name
    # Title-case nicely: "my streetwear brand" → "My Streetwear Brand"
    brand_name = folder_name.title() if folder_name.islower() else folder_name

    return {
        **brief,
        "brand_name":      brand_name,
        "what_it_is":      raw_text[:600],
        "target_audience": "",
        "goal":            "",
        "challenge":       "",
        "category":        "",
        "query":           brand_name,
        "notes":           raw_text,
    }


def main():
    parser = argparse.ArgumentParser(description="Art Protocol headless crew runner")
    parser.add_argument("--client", required=True, help="Client folder name")
    parser.add_argument(
        "--crew",
        required=True,
        choices=["branding", "social", "ads", "proposal", "research"],
        help="Which crew to run",
    )
    parser.add_argument("--brief-json", required=True, help="Brief fields as JSON string")
    parser.add_argument(
        "--brand-doc", default="", help="Path to existing brand document file"
    )
    args = parser.parse_args()

    try:
        brief = json.loads(args.brief_json)
    except json.JSONDecodeError as e:
        print(f"[ERROR] Invalid brief JSON: {e}", flush=True)
        sys.exit(1)

    brief = normalize_brief(brief, args.client)

    # DNA injection: if brief carries a _dna key, merge DNA fields into brief
    if "_dna" in brief:
        dna = brief.pop("_dna")
        brief = enrich_brief_with_dna(brief, dna)
        print(f"[DNA] Brand DNA injected into brief", flush=True)

    brand_document = None
    if args.brand_doc and os.path.exists(args.brand_doc):
        with open(args.brand_doc, "r", encoding="utf-8") as f:
            brand_document = f.read()
        print(f"[OK] Brand document loaded ({len(brand_document)} chars)", flush=True)

    clients_base = os.getenv("CLIENTS_DIR") or os.path.join(ROOT, "clients")
    os.makedirs(os.path.join(clients_base, args.client), exist_ok=True)

    # Set AP_CLIENT_BASE so crew files save intermediate outputs
    # inside clients/<client>/ instead of workspace root
    clients_base = os.getenv("CLIENTS_DIR") or os.path.join(ROOT, "clients")
    os.environ["AP_CLIENT_BASE"] = os.path.join(clients_base, args.client)

    # Init memory with brief
    init_memory(args.client, brief)

    # Build memory context for this crew
    memory_context = build_context_injection(args.client, args.crew)
    if memory_context:
        print(f"\n[MEMORY] Injecting project memory ({len(memory_context)} chars)", flush=True)
        # Inject into brief notes so crew prompts can use it
        brief["memory_context"] = memory_context

    # If no brand_document passed but memory has prior output, auto-load it
    if not brand_document and args.crew in ("social", "ads", "branding"):
        client_dir = os.path.join(ROOT, "clients", args.client)
        # Try research output first, then branding
        for prefix in ("research_", "brand_document_"):
            import glob
            matches = sorted(
                glob.glob(os.path.join(client_dir, f"{prefix}*.txt")),
                key=os.path.getmtime, reverse=True
            )
            if matches:
                with open(matches[0], "r", encoding="utf-8") as f:
                    brand_document = f.read()
                print(f"[MEMORY] Auto-loaded context: {os.path.basename(matches[0])}", flush=True)
                break

    result = None
    if args.crew == "branding":
        result = run_branding_headless(args.client, brief)
    elif args.crew == "social":
        result = run_social_headless(args.client, brief, brand_document)
    elif args.crew == "ads":
        result = run_ads_headless(args.client, brief, brand_document)
    elif args.crew == "proposal":
        result = run_proposal_headless(args.client, brief)
    elif args.crew == "research":
        result = run_research_headless(args.client, brief)

    # Update memory after run completes
    if result:
        memory = load_memory(args.client)
        runs = memory.get("runs_completed", [])
        if args.crew not in runs:
            runs.append(args.crew)
        memory["runs_completed"] = runs

        result_str = str(result)
        if args.crew == "research":
            research_facts = extract_research_memory(result_str, brief)
            if research_facts:
                memory["research"] = research_facts
                print("[MEMORY] Research facts extracted and saved", flush=True)
        elif args.crew == "branding":
            branding_facts = extract_branding_memory(result_str)
            if branding_facts:
                memory["branding"] = branding_facts
                print("[MEMORY] Brand identity facts extracted and saved", flush=True)

        save_memory(args.client, memory)


if __name__ == "__main__":
    main()
