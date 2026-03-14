from crewai import Agent, Task, Crew, Process
from crewai_tools import SerperDevTool
from dotenv import load_dotenv
import os
import sys
import json
import time
import traceback
from datetime import datetime

load_dotenv()

# ENV VALIDATION
def validate_env():
    missing = []
    if not os.getenv("ANTHROPIC_API_KEY"):
        missing.append("ANTHROPIC_API_KEY")
    if not os.getenv("SERPER_API_KEY"):
        missing.append("SERPER_API_KEY")
    if missing:
        print("\n[ERROR] Missing required environment variables:")
        for key in missing:
            print("  - " + key + " not found in .env")
        print("\nAdd them to your .env file and try again.")
        sys.exit(1)

validate_env()

# TOOLS
search_tool = SerperDevTool()

# API FLAGS
HAS_META_API   = bool(os.getenv("META_ACCESS_TOKEN"))
HAS_GOOGLE_API = bool(os.getenv("GOOGLE_ADS_TOKEN"))


# PLATFORM HELPERS

def wants_meta(brief):
    p = brief.get('platforms', '').lower()
    return 'meta' in p or 'both' in p or 'facebook' in p or 'instagram' in p

def wants_google(brief):
    p = brief.get('platforms', '').lower()
    return 'google' in p or 'both' in p


# FOLDER + CHECKPOINT HELPERS

def get_ads_folder(brand_name, product_name):
    safe_brand   = brand_name.replace(' ', '_')
    safe_product = product_name.replace(' ', '_').replace('/', '-')[:30]
    folder = safe_brand + "_" + safe_product + "_Ads"
    os.makedirs(folder, exist_ok=True)
    return folder

def get_checkpoint_path(folder, safe_name):
    return os.path.join(folder, safe_name + "_ads_checkpoint.json")

def load_checkpoint(folder, safe_name):
    path = get_checkpoint_path(folder, safe_name)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            print("\n[CHECKPOINT FOUND] Previous ads run detected.")
            print("  Completed: " + ", ".join(data.get("completed", [])))
            resume = input("  Resume from checkpoint? (y/n): ").strip().lower()
            if resume == "y":
                return data
            print("  Starting fresh.")
        except Exception as e:
            print("[WARNING] Could not load checkpoint: " + str(e))
    return {"completed": [], "outputs": {}, "brief": {}}

def save_checkpoint(folder, safe_name, checkpoint):
    path = get_checkpoint_path(folder, safe_name)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(checkpoint, f, indent=2)
    except Exception as e:
        print("[WARNING] Could not save checkpoint: " + str(e))

def save_task_output(folder, safe_name, task_name, content, checkpoint):
    if not content or not str(content).strip():
        return
    filename = os.path.join(folder, safe_name + "_" + task_name + ".txt")
    try:
        with open(filename, "w", encoding="utf-8") as f:
            f.write(str(content))
        checkpoint["outputs"][task_name] = filename
        if task_name not in checkpoint["completed"]:
            checkpoint["completed"].append(task_name)
        save_checkpoint(folder, safe_name, checkpoint)
        print("  [SAVED] " + filename)
    except Exception as e:
        print("[WARNING] Could not save " + task_name + ": " + str(e))

def extract_task_output(task):
    try:
        if hasattr(task, 'output') and task.output:
            if hasattr(task.output, 'raw') and task.output.raw:
                return str(task.output.raw)
            return str(task.output)
    except Exception:
        pass
    return ""

def assemble_full_document(folder, safe_name, checkpoint, task_names):
    sections = []
    for task_name in task_names:
        filepath = checkpoint["outputs"].get(task_name)
        if filepath and os.path.exists(filepath):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                header = "\n\n" + "=" * 60 + "\n"
                header += "SECTION: " + task_name.upper() + "\n"
                header += "=" * 60 + "\n\n"
                sections.append(header + content)
            except Exception:
                pass
    return "\n".join(sections)


# COMPETITOR ADS — scraping removed for reliability
def get_competitor_ads(brand_name, category):
    """Returns empty string. Scraping removed for reliability — agents use web search instead."""
    return ""


# AGENTS

TASK_NAMES = [
    "1_audience_research",
    "2_campaign_strategy",
    "3_ad_copy",
    "4_campaign_architecture",
]

audience_strategist = Agent(
    role="Audience & Competitive Intelligence Strategist",
    goal=(
        "Research the target audience profiles, competitor ad strategies, "
        "and identify the strongest content angles for this campaign"
    ),
    backstory=(
        "You are an audience intelligence specialist and competitive ads analyst "
        "combined. You build precise targeting logic for Meta and Google — not personas, "
        "but specific interest categories, behavioral signals, life events, and keyword "
        "intent clusters that signal purchase intent. You study competitor ads to "
        "understand the battlefield: which hooks are overused, which angles nobody is "
        "running, and where the creative whitespace is. You mine consumer language to "
        "find the exact phrases real buyers use. Spray-and-pray targeting is your "
        "failure state."
    ),
    tools=[search_tool],
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
    max_iter=10
)

ad_strategist = Agent(
    role="Performance Marketing Strategist",
    goal=(
        "Build the complete campaign strategy and creative direction for "
        "Meta and/or Google campaigns"
    ),
    backstory=(
        "You are a senior paid media strategist who has managed significant ad spend "
        "across Meta and Google. You understand funnel architecture, campaign objectives, "
        "budget allocation logic, and how to structure campaigns for maximum learning "
        "and efficiency. You bridge strategy and production — you define the visual and "
        "creative direction with enough specificity that a designer can act on it "
        "immediately. Generic strategies that could apply to any campaign are your "
        "failure state."
    ),
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
    max_iter=8
)

ad_copywriter = Agent(
    role="Performance Ad Copywriter",
    goal=(
        "Write all ad copy: Meta ads across funnel stages with headline and body copy "
        "variants, and Google search ads with headlines and descriptions"
    ),
    backstory=(
        "You are a direct response copywriter who understands that every word in an ad "
        "must earn its place. For Meta, you write hooks that stop the scroll, body copy "
        "that builds desire, and CTAs that create urgency without being pushy. "
        "For Google Search, you write within character limits — 30-character headlines, "
        "90-character descriptions — matching copy precisely to search intent. "
        "You always write the minimum 3 variations per format. "
        "You write in customer language, not corporate speak. "
        "You never skip a platform the client has asked for."
    ),
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
    max_iter=8
)

campaign_architect = Agent(
    role="Campaign Architect",
    goal=(
        "Structure the complete campaign architecture, KPI dashboard, "
        "weekly optimization checklist, and performance benchmarks"
    ),
    backstory=(
        "You are a campaign architect and performance measurement specialist. "
        "You translate strategy and copy into platform-ready campaign structure "
        "(campaign → ad set → ad for Meta; campaign → ad group → ad for Google). "
        "A campaign without a measurement framework is just spending money. "
        "You define the right KPIs, build decision trees so the team always knows "
        "what to do when a number goes red, and set specific benchmarks for "
        "30/60/90 days. Your output can be acted on directly without interpretation."
    ),
    verbose=True,
    llm="anthropic/claude-haiku-4-5-20251001",
    max_iter=5
)


# TASK CREATION

def create_ads_tasks(brief, competitor_ads="", brand_document=None):

    meta_in_scope   = wants_meta(brief)
    google_in_scope = wants_google(brief)

    platforms_list = []
    if meta_in_scope:
        platforms_list.append("Meta (Facebook + Instagram)")
    if google_in_scope:
        platforms_list.append("Google (Search + Display)")
    if not platforms_list:
        platforms_list.append("Meta (Facebook + Instagram)")
    platforms_str = " AND ".join(platforms_list)

    context_block = ""
    if brand_document:
        context_block = (
            "\n\nBRAND AND RESEARCH CONTEXT (use this to inform all decisions):\n"
            + str(brand_document)[:3000] +
            "\n[Context continues — use audience profiles, competitive intelligence, "
            "and brand positioning from this document to inform all outputs]\n"
        )

    brand_name = brief.get('brand_name', '')
    product    = brief.get('product', brief.get('what_it_is', ''))
    category   = brief.get('category', '')
    budget     = brief.get('budget', '')
    notes      = brief.get('notes', '')

    brief_block = (
        "Brand: " + brand_name + "\n"
        "Product: " + product + "\n"
        "Category: " + category + "\n"
        "Budget: " + budget + "\n"
        "Platforms in scope: " + platforms_str + "\n"
        "Campaign goal: " + brief.get('campaign_goal', brief.get('goal', '')) + "\n"
        "Notes: " + notes
    )

    # TASK 1: Audience Research + Competitive Intelligence
    audience_task = Task(
        description=(
            "Research the target audience and competitor ads for this campaign.\n\n"
            + brief_block
            + context_block + "\n\n"
            "Produce a detailed intelligence report. Minimum 600 words total.\n\n"
            "1. TWO PRIMARY AUDIENCE PROFILES\n"
            "   For each profile:\n"
            "   - Demographics, psychographics, behaviors, pain points, desires\n"
            "   - Meta targeting parameters: specific interest categories, "
            "behavioral signals, life events, estimated audience size\n"
            "   - Google targeting: keyword intent clusters, in-market audiences\n\n"
            "2. COMPETITOR AD ANALYSIS (5 COMPETITORS)\n"
            "   For each competitor: what ad angles they are running, what hooks they use, "
            "what offers they emphasize. Identify the 3 most overused angles in this "
            "category. Identify the creative whitespace nobody is running.\n\n"
            "3. CONTENT ANGLES WITH STRONGEST POTENTIAL\n"
            "   5 specific ad angles this brand should test, ranked by expected performance. "
            "For each: the angle, why it will work, which audience it targets.\n\n"
            "4. CONSUMER LANGUAGE MINING\n"
            "   20 exact phrases the target audience uses to describe their desire or "
            "problem. Real buyer language — these become headline and body copy fodder."
        ),
        agent=audience_strategist,
        expected_output=(
            "Audience and competitive intelligence report with 4 sections: "
            "Two Audience Profiles with targeting params, Competitor Ad Analysis, "
            "5 Content Angles, Consumer Language Mining. Minimum 600 words."
        )
    )

    # TASK 2: Campaign Strategy + Creative Direction
    strategy_task = Task(
        description=(
            "Build the complete campaign strategy and creative direction for "
            + brand_name + ".\n\n"
            + brief_block
            + context_block + "\n\n"
            "Use the audience research and competitive intelligence from the previous task. "
            "Minimum 600 words total.\n\n"
            "1. CAMPAIGN OBJECTIVE AND FUNNEL STRUCTURE\n"
            "   Campaign objective and why. Full funnel architecture: "
            "Awareness → Consideration → Conversion → Retargeting. "
            "Budget allocation across funnel stages (percentages).\n\n"
            "2. META CAMPAIGN STRATEGY (if Meta in scope)\n"
            "   Campaign and ad set structure. Testing framework: what to test first, "
            "decision thresholds. Bid strategy and optimization events.\n\n"
            "3. GOOGLE CAMPAIGN STRATEGY (if Google in scope)\n"
            "   Search campaign: ad group structure, keyword match type strategy. "
            "Display campaign: retargeting vs prospecting approach. "
            "Budget split between Search and Display.\n\n"
            "4. BUDGET ALLOCATION TABLE\n"
            "   Show exactly how " + budget + " splits across all platforms and "
            "funnel stages. Every allocation with one-line justification.\n\n"
            "5. CREATIVE DIRECTION BRIEFS\n"
            "   For each funnel stage: visual style, tone, hooks to test. "
            "Describe exactly what the first frame looks like — who, what, emotion, "
            "why it stops the scroll. Specific enough for a designer to act on immediately."
        ),
        agent=ad_strategist,
        expected_output=(
            "Complete campaign strategy with 5 sections: Campaign Objective and Funnel, "
            "Meta Strategy, Google Strategy, Budget Allocation Table, "
            "Creative Direction Briefs. Minimum 600 words."
        )
    )

    # TASK 3: Ad Copy
    copy_task = Task(
        description=(
            "Write all ad copy for " + brand_name + " — " + product + ".\n\n"
            + brief_block
            + context_block + "\n\n"
            "Write in consumer language from the audience research. No corporate speak. "
            "Write ALL variations — do not stop early. Minimum 1500 words total.\n\n"
            "META AD COPY (if Meta in scope):\n"
            "For each funnel stage, write 3 headline variants + 2 body copy variants:\n"
            "- AWARENESS: 3 headlines (pain point / curiosity / bold statement angle) + "
            "2 body copy variations\n"
            "- CONSIDERATION: 3 headlines (story / social proof / education angle) + "
            "2 body copy variations\n"
            "- CONVERSION: 3 headlines (direct offer / risk reversal / comparison angle) + "
            "2 body copy variations\n"
            "- RETARGETING: 3 headlines + 2 body copy variations\n"
            "Each ad must include a specific CTA — not just 'Learn More'.\n\n"
            "GOOGLE SEARCH AD COPY (if Google in scope):\n"
            "3 search campaigns, for each:\n"
            "- Campaign name and keyword theme\n"
            "- 5 headlines — MAX 30 characters each (include character count)\n"
            "- 3 descriptions — MAX 90 characters each (include character count)\n"
            "- Display path: 2 x 15-character path fields\n"
            "Any 3 headlines together must form a coherent message."
        ),
        agent=ad_copywriter,
        expected_output=(
            "Complete ad copy library. Meta: 3 headline variants + 2 body copy variants "
            "per funnel stage (Awareness, Consideration, Conversion, Retargeting). "
            "Google: 3 search campaigns with 5 headlines and 3 descriptions each, "
            "all with character counts. Minimum 1500 words total."
        )
    )

    # TASK 4: Campaign Architecture + Measurement
    architecture_task = Task(
        description=(
            "Build the complete campaign architecture and measurement framework for "
            + brand_name + ".\n\n"
            + brief_block + "\n\n"
            "Minimum 500 words total.\n\n"
            "1. COMPLETE CAMPAIGN STRUCTURE\n"
            "   Meta (if in scope): Campaign → Ad Sets → Ads. For each level: name, "
            "objective, audience, budget, optimization event, status.\n"
            "   Google (if in scope): Campaign → Ad Groups → Ads + Keywords. "
            "For each level: name, type, targeting, bid strategy.\n"
            "   Include UTM parameter structure and naming conventions.\n\n"
            "2. KPI DASHBOARD\n"
            "   Primary metrics (top 3 per platform) with Indian market benchmarks. "
            "Secondary health metrics. What to check weekly.\n\n"
            "3. WEEKLY OPTIMIZATION CHECKLIST\n"
            "   Every Monday: exactly what to check, thresholds that trigger action, "
            "who is responsible for what decision.\n\n"
            "4. SCALE DECISION TREE\n"
            "   IF [metric] is [value] THEN [action] — for every platform and scenario. "
            "When to scale, when to kill, when to test a new angle.\n\n"
            "5. 30-DAY PERFORMANCE BENCHMARKS\n"
            "   What good looks like at Day 7, Day 14, Day 30 for each platform. "
            "Specific numbers, not ranges."
        ),
        agent=campaign_architect,
        expected_output=(
            "Complete campaign architecture and measurement framework with 5 sections: "
            "Campaign Structure, KPI Dashboard, Weekly Optimization Checklist, "
            "Scale Decision Tree, 30-Day Performance Benchmarks. Minimum 500 words."
        )
    )

    return [
        audience_task,
        strategy_task,
        copy_task,
        architecture_task,
    ]


# AGENT ALIASES (for run_crew.py compatibility)
audience_researcher    = audience_strategist
competitor_ads_analyst = audience_strategist
creative_director      = ad_strategist
performance_analyst    = campaign_architect
deployment_agent       = campaign_architect


# CREW

def run_ads_crew(brand_document=None):
    print("\n" + "=" * 60)
    print("ADS CREW - ART PROTOCOL")
    print("=" * 60)

    if HAS_META_API:
        print("[OK]  Meta API detected")
    else:
        print("[INFO] No Meta API - will prepare manual upload package")
    if HAS_GOOGLE_API:
        print("[OK]  Google API detected")
    else:
        print("[INFO] No Google API - will prepare manual upload package")

    print("\nAnswer carefully. Output quality depends on this.")

    if not brand_document:
        print("\nDo you have a brand document or research report for this client?")
        print("  1. Yes - load a file")
        print("  2. No - work from brief only")
        doc_choice = input("Choice [2]: ").strip() or "2"
        if doc_choice == "1":
            filepath = input("File path (drag file into terminal): ").strip().strip('"')
            if os.path.exists(filepath):
                with open(filepath, "r", encoding="utf-8") as f:
                    brand_document = f.read()
                print("[OK] Context document loaded (" + str(len(brand_document)) + " chars)")
            else:
                print("[WARNING] File not found. Continuing without context document.")

    brief = {
        'brand_name':    input("\n1.  Brand name: ").strip(),
        'product':       input("2.  Specific product to advertise: ").strip(),
        'category':      input("3.  Category: ").strip(),
        'budget':        input("4.  Monthly budget (in INR): ").strip(),
        'platforms':     input("5.  Platforms (Meta / Google / Both): ").strip(),
        'campaign_goal': input("6.  Campaign goal (awareness/leads/sales): ").strip(),
        'notes':         input("7.  Any other notes: ").strip(),
    }

    if not wants_meta(brief) and not wants_google(brief):
        print("  [WARNING] No recognised platform - defaulting to Meta only")
        brief['platforms'] = 'Meta'

    safe_name = (
        brief['brand_name'].replace(' ', '_') + "_" +
        brief['product'].replace(' ', '_').replace('/', '-')[:25]
    )
    folder     = get_ads_folder(brief['brand_name'], brief['product'])
    checkpoint = load_checkpoint(folder, safe_name)

    if checkpoint.get("completed") and checkpoint.get("brief"):
        brief = checkpoint["brief"]
        print("  [OK] Brief loaded from checkpoint.")

    checkpoint["brief"] = brief
    save_checkpoint(folder, safe_name, checkpoint)

    competitor_ads = get_competitor_ads(brief['brand_name'], brief['category'])

    tasks = create_ads_tasks(brief, competitor_ads, brand_document)

    platforms_label = "+".join(filter(None, [
        "Meta"   if wants_meta(brief)   else "",
        "Google" if wants_google(brief) else "",
    ]))

    crew = Crew(
        agents=[
            audience_strategist,
            ad_strategist,
            ad_copywriter,
            campaign_architect,
        ],
        tasks=tasks,
        process=Process.sequential,
        max_rpm=3,
        verbose=True,
    )

    print(">> Ads Crew starting: " + brief['product'] + " by " + brief['brand_name'])
    print("   Platforms: " + platforms_label)
    print("   4 agents. Saves after every agent. Safe to interrupt.\n")

    start_time = time.time()
    result = None

    try:
        result = crew.kickoff()

    except KeyboardInterrupt:
        print("\n\n[INTERRUPTED] Saving completed sections...")

    except Exception as e:
        print("\n[ERROR] Crew failed: " + str(e))
        traceback.print_exc()
        print("\n[RECOVERY] Saving all completed sections...")

    finally:
        for i, task in enumerate(tasks):
            task_name = TASK_NAMES[i]
            if task_name in checkpoint["completed"]:
                continue
            output = extract_task_output(task)
            if output:
                save_task_output(folder, safe_name, task_name, output, checkpoint)

        full_doc = assemble_full_document(folder, safe_name, checkpoint, TASK_NAMES)

        if full_doc.strip():
            filename = os.path.join(
                folder,
                safe_name + "_" + platforms_label + "_ads_campaign_FULL.txt"
            )
            try:
                with open(filename, "w", encoding="utf-8") as f:
                    f.write("ADS CAMPAIGN: " + brief['brand_name'].upper()
                            + " - " + brief['product'].upper() + "\n")
                    f.write("Platforms:   " + platforms_label + "\n")
                    f.write("Goal: " + brief.get('campaign_goal', '')
                            + " | Budget: " + brief['budget'] + "\n")
                    f.write("Generated:  " + datetime.now().strftime('%Y-%m-%d %H:%M') + "\n")
                    f.write("=" * 60 + "\n\n")
                    f.write(full_doc)

                elapsed = int(time.time() - start_time)
                print("\n" + "=" * 60)
                print("ADS CREW COMPLETE")
                print("=" * 60)
                print("Output folder:  " + folder + "/")
                print("Sections saved: " + str(len(checkpoint["completed"]))
                      + " / " + str(len(TASK_NAMES)))
                print("Full document:  " + filename)
                print("Time elapsed:   " + str(elapsed // 60) + "m "
                      + str(elapsed % 60) + "s")
                print("=" * 60)
                print("\nFiles in " + folder + "/:")
                for fname in sorted(os.listdir(folder)):
                    print("  -> " + fname)
            except Exception as e:
                print("[WARNING] Could not save full document: " + str(e))
        else:
            print("[WARNING] No output captured. Check API keys and try again.")

        if len(checkpoint["completed"]) >= len(TASK_NAMES):
            try:
                os.remove(get_checkpoint_path(folder, safe_name))
                print("[OK] Checkpoint cleaned up.")
            except Exception:
                pass

    return result


if __name__ == "__main__":
    run_ads_crew()
