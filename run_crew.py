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
        cultural_researcher,
        competitor_analyst,
        archetype_agent,
        strategy_agent,
        visual_identity_agent,
        positioning_agent,
        gtm_agent,
        swot_agent,
        critic_agent,
        document_compiler,
    )
    from crewai import Crew, Process

    safe_name = brief.get("brand_name", client_name).replace(" ", "_")

    # Start fresh checkpoint with this brief
    checkpoint = {"completed": [], "outputs": {}, "brief": brief}
    save_checkpoint(safe_name, checkpoint)

    tasks = create_tasks(brief)

    crew = Crew(
        agents=[
            cultural_researcher,
            competitor_analyst,
            archetype_agent,
            strategy_agent,
            visual_identity_agent,
            positioning_agent,
            gtm_agent,
            swot_agent,
            critic_agent,
            document_compiler,
        ],
        tasks=tasks,
        process=Process.sequential,
        max_rpm=3,
        verbose=True,
    )

    print(f"\n>> Starting Branding Crew for {brief['brand_name']}...", flush=True)
    result = crew.kickoff()

    save_to_client_folder(client_name, "brand_document", result)
    print("\n[BRANDING CREW COMPLETE]", flush=True)
    return result


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
    )

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

    print(
        f"\n>> Scraping competitor ads for {brief.get('category', '')}...", flush=True
    )
    competitor_ads = get_competitor_ads(brief["brand_name"], brief.get("category", ""))
    print("done: Competitor ad intelligence gathered", flush=True)

    tasks = create_ads_tasks(brief, competitor_ads, context)

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
    )

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

    crew = Crew(
        agents=[proposal_writer, scope_writer, pricing_strategist, proposal_critic],
        tasks=tasks,
        process=Process.sequential,
        verbose=True,
    )

    print(f"\n>> Starting Proposal Crew for {crew_brief['client_name']}...", flush=True)
    result = crew.kickoff()

    save_to_client_folder(client_name, "proposal", result)
    print("\n[PROPOSAL CREW COMPLETE]", flush=True)
    return result


def run_research_headless(client_name, brief):
    print("\n" + "=" * 60, flush=True)
    print("RESEARCH - ART PROTOCOL (headless)", flush=True)
    print("=" * 60, flush=True)

    from research import run as run_research
    import builtins

    # Map all 8 brief fields from the conversational intake
    name            = brief.get("brand_name", client_name)
    what            = brief.get("what_it_is", brief.get("query", ""))
    category        = brief.get("category", "")
    location        = brief.get("location", "")
    customer        = brief.get("customer", "")
    problem_solved  = brief.get("problem_solved", brief.get("notes", ""))
    competitors     = brief.get("competitors", "")
    stage           = brief.get("stage", "new")

    print(f"  Brand:       {name}", flush=True)
    print(f"  Category:    {category}", flush=True)
    print(f"  Location:    {location}", flush=True)
    print(f"  Stage:       {stage}", flush=True)
    print(f"  Competitors: {competitors or 'not provided — will research'}", flush=True)

    # research.py's get_client_brief() asks exactly 12 questions via input(),
    # then load_checkpoint() may ask one more. Map all fields in order.
    answers = iter([
        name,                                    # 1. Brand name
        what,                                    # 2. What is it exactly
        category,                                # 3. Category
        "",                                      # 4. Subcategory / niche (not collected)
        location,                                # 5. Primary location
        location,                                # 6. Target geography (use location as default)
        customer,                                # 7. Who is the customer
        problem_solved[:600] if problem_solved else "",  # 8. What problem does this solve
        competitors,                             # 9. Three competitors
        "",                                      # 10. Founder belief (not collected)
        stage or "new",                          # 11. Stage
        "",                                      # 12. What brand would never do (not collected)
        "n",                                     # checkpoint: Resume? (always fresh)
    ])
    original_input = builtins.input

    def patched_input(prompt=""):
        try:
            answer = next(answers)
            print(f"{prompt}{answer}", flush=True)
            return answer
        except StopIteration:
            return ""

    builtins.input = patched_input
    try:
        result = run_research()
    finally:
        builtins.input = original_input

    save_to_client_folder(client_name, "research", result)
    print("\n[RESEARCH COMPLETE]", flush=True)
    return result


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
