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


# AGENTS

market_researcher = Agent(
    role="Market & Cultural Research Specialist",
    goal=(
        "Research the brand's market, cultural context, competitor landscape, "
        "and identify positioning whitespace"
    ),
    backstory=(
        "You are a cultural historian, semiotician, and competitive intelligence analyst "
        "rolled into one. You uncover the deep cultural and historical forces shaping a "
        "category, dissect how competitors position themselves, and find the gap in the "
        "market that is real and ownable. You make connections across domains that others "
        "miss and understand how products carry cultural meaning, class codes, and "
        "generational identity. You always search for live data. Generic observations "
        "are your failure state — every insight must be traceable to this specific brand, "
        "category, and context."
    ),
    tools=[search_tool],
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
    max_iter=10
)

brand_strategist = Agent(
    role="Brand Identity Strategist",
    goal=(
        "Define brand archetype, personality, messaging framework, value proposition, "
        "and tone of voice"
    ),
    backstory=(
        "You are a senior brand strategist and psychologist with 15 years experience "
        "building category-defining brands. You think in layers: surface, psychology, "
        "culture, pattern, synthesis. You are a specialist in Jungian archetypes, "
        "narrative, and brand mythology — translating them into specific brand behaviors, "
        "not abstract labels. You build brand creation myths that are true and worth "
        "repeating. Every recommendation you produce is specific, earned, and defensible. "
        "Strategies that could belong to any other brand are your failure state."
    ),
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
    max_iter=8
)

visual_director = Agent(
    role="Visual Identity Director",
    goal=(
        "Define the full visual system: color palette with hex codes, typography pairing, "
        "design principles, mood board description, and what NOT to do"
    ),
    backstory=(
        "You are a senior art director with deep knowledge of color psychology, typography "
        "history, semiotics, and visual culture. Every visual decision you make is traceable "
        "to a real insight about the brand's psychology, culture, and audience. You never "
        "choose colors or fonts because they look nice — you choose them because they carry "
        "the right meaning. You always complete your full output. You never stop mid-section."
    ),
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
    max_iter=8
)

launch_strategist = Agent(
    role="GTM & Positioning Strategist",
    goal=(
        "Build go-to-market strategy, positioning statement, pricing approach, "
        "SWOT analysis, and launch sequence"
    ),
    backstory=(
        "You are a positioning specialist and GTM strategist who has launched brands "
        "across D2C, retail, and service categories. You think in perceptual maps, "
        "competitive axes, and market dynamics. You define exactly how to own a position, "
        "defend it, and communicate it. You are specific about which channels, in what "
        "order, with what budget logic, and why. You build SWOTs where every point is "
        "traceable to real evidence — no generic SWOT entries that could apply to any brand. "
        "Generic GTM plans are your failure state."
    ),
    tools=[search_tool],
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
    max_iter=8
)

document_compiler = Agent(
    role="Brand Document Compiler",
    goal=(
        "Take all previous task outputs as context and compile a comprehensive, structured "
        "brand document with clear sections, headers, and executive summary"
    ),
    backstory=(
        "You are a meticulous document architect. You take research, strategy, identity, "
        "and go-to-market outputs and assemble them into a single coherent brand document "
        "that any designer, copywriter, or marketer can act on immediately. Structure and "
        "clarity are your craft. You never summarise or shorten any section — you include "
        "everything as delivered. You never stop before completing the full document."
    ),
    verbose=True,
    llm="anthropic/claude-haiku-4-5-20251001",
    max_iter=5
)


# TASKS

def create_tasks(brief):
    brand_name      = brief.get('brand_name', '')
    what_it_is      = brief.get('what_it_is', '')
    target_audience = brief.get('target_audience', '')
    category        = brief.get('category', '')
    personality     = brief.get('personality', '')
    notes           = brief.get('notes', '')

    brief_block = (
        "Brand name: " + brand_name + "\n"
        "What it is: " + what_it_is + "\n"
        "Target audience: " + target_audience + "\n"
        "Category: " + category + "\n"
        "Personality: " + personality + "\n"
        "Notes: " + notes
    )

    market_research_task = Task(
        description=(
            "Research the market landscape for the brand described in this brief:\n\n"
            + brief_block + "\n\n"
            "Produce a detailed research report covering all four areas below. "
            "Minimum 600 words total.\n\n"
            "1. CULTURAL CONTEXT AND TRENDS\n"
            "   What cultural, historical, and generational forces are shaping this category "
            "right now? What movements, subcultures, or societal shifts make this brand "
            "relevant or necessary? Cite specific examples.\n\n"
            "2. TOP 5 COMPETITORS WITH THEIR POSITIONING\n"
            "   For each competitor: name, how they position themselves, what messaging "
            "they emphasize, what visual and verbal codes they use, and their single "
            "biggest vulnerability.\n\n"
            "3. MARKET GAPS AND OPPORTUNITIES\n"
            "   What is nobody in this category saying that consumers clearly care about? "
            "What positioning territory is completely unclaimed? What assumptions does "
            "this category make without questioning?\n\n"
            "4. TARGET AUDIENCE PSYCHOGRAPHICS\n"
            "   Go beyond demographics. Who is this person? What are they moving away from "
            "and toward? What do they signal with their choices? What would they never "
            "admit? What do they want to feel when they use a brand in this category?"
        ),
        agent=market_researcher,
        expected_output=(
            "A detailed market research report with 4 clearly labeled sections: "
            "Cultural Context and Trends, Top 5 Competitors, Market Gaps and Opportunities, "
            "Target Audience Psychographics. Minimum 600 words. "
            "Every observation specific to this brand's category and context."
        )
    )

    brand_strategy_task = Task(
        description=(
            "Define the complete brand identity for " + brand_name + " using the market "
            "research produced in the previous task.\n\n"
            "Brief context:\n" + brief_block + "\n\n"
            "Produce a complete brand identity document covering all five areas below. "
            "Minimum 500 words total.\n\n"
            "1. BRAND ARCHETYPE + MYTHOLOGY\n"
            "   Which Jungian archetype and precisely why. How the archetype manifests in "
            "the brand's verbal expression, behavioral choices, and how it handles "
            "criticism. The brand's creation myth — the true story of why it exists, "
            "told to be worth repeating.\n\n"
            "2. BRAND PERSONALITY (5 TRAITS)\n"
            "   Five specific personality traits. For each: what it IS and what it is NOT. "
            "Include the shadow side — the dark version of this trait and how the brand "
            "guards against it.\n\n"
            "3. MESSAGING FRAMEWORK\n"
            "   Hero tagline + 3 key messages. Each key message should have a one-line "
            "proof point rooted in what the brand actually does or believes.\n\n"
            "4. TONE OF VOICE GUIDE\n"
            "   How the brand speaks to: new customers, loyal customers, product "
            "descriptions, and criticism. Words it owns. Words it never uses. "
            "Sentence structures it favors.\n\n"
            "5. BRAND PROMISE\n"
            "   One sentence internal north star: for whom, what it gives them, "
            "why it is different, what it stands for."
        ),
        agent=brand_strategist,
        expected_output=(
            "A complete brand identity document with 5 clearly labeled sections: "
            "Brand Archetype + Mythology, Brand Personality, Messaging Framework, "
            "Tone of Voice Guide, Brand Promise. Minimum 500 words. "
            "Every claim specific and traceable — nothing generic."
        )
    )

    visual_identity_task = Task(
        description=(
            "Design the complete visual identity system for " + brand_name + ".\n\n"
            "Brief context:\n" + brief_block + "\n\n"
            "Use the brand archetype, personality, and strategy from previous tasks to "
            "ground every decision. Minimum 400 words total.\n\n"
            "1. COLOR PALETTE\n"
            "   Primary colors (2), secondary colors (2), accent color (1). "
            "For each color: brand-specific name (not a generic color name), "
            "exact hex code, psychological rationale, cultural or sensory reference, "
            "and where it lives in the visual system.\n\n"
            "2. TYPOGRAPHY PAIRING\n"
            "   Heading font: specific font name, historical rationale, cultural signal. "
            "Body font: specific font name and rationale. "
            "Typography donts: 2 specific categories to avoid and why.\n\n"
            "3. FIVE DESIGN PRINCIPLES\n"
            "   Five governing principles for all visual output. For each: what it means, "
            "an example of correct use, and an example of a violation.\n\n"
            "4. MOOD BOARD DESCRIPTION\n"
            "   Describe 5 specific visual references — real images, artworks, spaces, "
            "or moments. For each: what it is, where to find it, why it belongs.\n\n"
            "5. VISUAL DONTS\n"
            "   Five specific visual choices that would immediately feel wrong for this brand. "
            "Be specific — not generic advice like 'avoid clutter'."
        ),
        agent=visual_director,
        expected_output=(
            "A complete visual identity system with 5 clearly labeled sections: "
            "Color Palette (with hex codes), Typography Pairing, Five Design Principles, "
            "Mood Board Description, Visual Donts. Minimum 400 words. "
            "Every decision rationale-driven. All sections complete."
        )
    )

    launch_strategy_task = Task(
        description=(
            "Build the complete launch and go-to-market plan for " + brand_name + " "
            "using the market research and brand strategy from previous tasks.\n\n"
            "Brief context:\n" + brief_block + "\n\n"
            "Minimum 500 words total.\n\n"
            "1. POSITIONING STATEMENT\n"
            "   Expanded format: For / Who / Is the / That / Unlike / Our brand. "
            "Then a one-sentence internal version. Show exactly where this brand sits "
            "on the competitive map and what territory it owns.\n\n"
            "2. GTM CHANNEL STRATEGY\n"
            "   For each relevant channel: primary / secondary / ignore and why. "
            "Be specific about which channels, in what order, with what logic.\n\n"
            "3. LAUNCH SEQUENCE (3 PHASES)\n"
            "   Phase 1 Pre-launch: specific actions, goal, success metric. "
            "Phase 2 Launch: specific actions, goal, metric. "
            "Phase 3 Growth: specific actions, goal, metric.\n\n"
            "4. PRICING RECOMMENDATION\n"
            "   What pricing model reinforces positioning? "
            "How does the price signal the brand's identity? "
            "What pricing would undermine positioning?\n\n"
            "5. SWOT MATRIX WITH STRATEGIC PRIORITIES\n"
            "   4 Strengths, 4 Weaknesses, 4 Opportunities, 4 Threats. "
            "Every point specific to this brand — not generic. "
            "Each point must reference a real finding from the research. "
            "End with the top 3 strategic priorities derived from this SWOT."
        ),
        agent=launch_strategist,
        expected_output=(
            "A complete GTM and positioning document with 5 clearly labeled sections: "
            "Positioning Statement, GTM Channel Strategy, Launch Sequence, "
            "Pricing Recommendation, SWOT Matrix with Strategic Priorities. "
            "Minimum 500 words. Evidence-based throughout."
        )
    )

    compile_task = Task(
        description=(
            "Compile all outputs into the final Brand Strategy Document for "
            + brand_name.upper() + ".\n\n"
            "You have the outputs of all 4 previous tasks in your context. "
            "Assemble them into a single, structured, client-ready document. "
            "Do NOT summarise or shorten any section — include everything as delivered. "
            "Do NOT stop before completing the full document.\n\n"
            "Use this structure with markdown headers:\n\n"
            "# BRAND STRATEGY DOCUMENT: " + brand_name.upper() + "\n\n"
            "## Executive Summary\n"
            "(2-3 paragraph synthesis of the brand's core opportunity, identity, and launch approach)\n\n"
            "## Market Landscape\n"
            "(Full market research output: cultural context, competitors, gaps, audience)\n\n"
            "## Brand Identity\n"
            "(Full brand strategy output: archetype, personality, messaging, tone, promise)\n\n"
            "## Visual Identity\n"
            "(Full visual identity output: colors, typography, principles, mood board, donts)\n\n"
            "## Go-To-Market Strategy\n"
            "(Full GTM output: positioning, channels, launch sequence, pricing)\n\n"
            "## SWOT Analysis\n"
            "(Full SWOT with strategic priorities)\n\n"
            "Professional, client-ready format throughout. Clear headers at every level."
        ),
        agent=document_compiler,
        expected_output=(
            "A complete structured Brand Strategy Document for " + brand_name + " with all 6 "
            "sections: Executive Summary, Market Landscape, Brand Identity, Visual Identity, "
            "Go-To-Market Strategy, SWOT Analysis. Nothing summarised or cut short. "
            "Professional client-ready format with markdown headers."
        )
    )

    return [
        market_research_task,
        brand_strategy_task,
        visual_identity_task,
        launch_strategy_task,
        compile_task,
    ]


# CHECKPOINT HELPERS

TASK_NAMES = [
    "1_market_research",
    "2_brand_strategy",
    "3_visual_identity",
    "4_launch_strategy",
    "5_compiled_document",
]

def get_branding_folder(safe_name):
    base = os.getenv("AP_CLIENT_BASE", "")
    if base:
        folder = os.path.join(base, safe_name + "_Branding")
    else:
        folder = safe_name + "_Branding"
    os.makedirs(folder, exist_ok=True)
    return folder

def get_checkpoint_file(safe_name):
    folder = get_branding_folder(safe_name)
    return os.path.join(folder, safe_name + "_checkpoint.json")

def load_checkpoint(safe_name):
    path = get_checkpoint_file(safe_name)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"completed": [], "outputs": {}, "brief": {}}

def save_checkpoint(safe_name, checkpoint):
    path = get_checkpoint_file(safe_name)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(checkpoint, f, indent=2)
    except Exception as e:
        print("[WARNING] Could not save checkpoint: " + str(e))

def save_task_output(safe_name, task_name, content, checkpoint):
    if not content or not str(content).strip():
        return
    folder = get_branding_folder(safe_name)
    filename = os.path.join(folder, safe_name + "_" + task_name + ".txt")
    try:
        with open(filename, "w", encoding="utf-8") as f:
            f.write(str(content))
        checkpoint["outputs"][task_name] = filename
        if task_name not in checkpoint["completed"]:
            checkpoint["completed"].append(task_name)
        save_checkpoint(safe_name, checkpoint)
        print("  [SAVED] " + filename)
    except Exception as e:
        print("[WARNING] Could not save " + filename + ": " + str(e))

def extract_task_output(task):
    try:
        if hasattr(task, 'output') and task.output:
            if hasattr(task.output, 'raw') and task.output.raw:
                return str(task.output.raw)
            return str(task.output)
    except Exception:
        pass
    return ""

def assemble_full_document(safe_name, checkpoint):
    sections = []
    for task_name in TASK_NAMES:
        filepath = checkpoint["outputs"].get(task_name)
        if filepath and os.path.exists(filepath):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    section_content = f.read()
                header = "\n\n" + "=" * 60 + "\n"
                header += "SECTION: " + task_name.upper() + "\n"
                header += "=" * 60 + "\n\n"
                sections.append(header + section_content)
            except Exception:
                pass
    return "\n".join(sections)


# AGENT ALIASES (for run_crew.py compatibility)
cultural_researcher   = market_researcher
competitor_analyst    = market_researcher
archetype_agent       = brand_strategist
strategy_agent        = brand_strategist
visual_identity_agent = visual_director
positioning_agent     = launch_strategist
gtm_agent             = launch_strategist
swot_agent            = launch_strategist
critic_agent          = document_compiler


# CREW

def run_branding_crew():
    print("\n" + "=" * 60)
    print("BRANDING CREW - ART PROTOCOL")
    print("=" * 60)
    print("Answer carefully. Output quality depends on this.\n")

    brand_name_input = input("1.  Brand name: ").strip()
    safe_name = brand_name_input.replace(" ", "_")
    checkpoint = load_checkpoint(safe_name)

    if checkpoint.get("completed") and checkpoint.get("brief"):
        print("\n[CHECKPOINT FOUND] Previous run saved "
              + str(len(checkpoint["completed"])) + " sections.")
        print("Completed: " + ", ".join(checkpoint["completed"]))
        print("Brief on file for: " + checkpoint["brief"].get("brand_name", ""))
        resume = input("Resume from checkpoint? (y/n): ").strip().lower()
        if resume == "y":
            brief = checkpoint["brief"]
            print("  [OK] Brief loaded. Skipping completed sections.")
        else:
            checkpoint = {"completed": [], "outputs": {}, "brief": {}}
            save_checkpoint(safe_name, checkpoint)
            brief = None
    else:
        brief = None

    if brief is None:
        brief = {
            'brand_name':      brand_name_input,
            'what_it_is':      input("2.  What is it (one sentence): ").strip(),
            'target_audience': input("3.  Target audience: ").strip(),
            'category':        input("4.  Category: ").strip(),
            'personality':     input("5.  Brand personality in 3 words: ").strip(),
            'notes':           input("6.  Any other notes: ").strip(),
        }
        checkpoint["brief"] = brief
        save_checkpoint(safe_name, checkpoint)

    tasks = create_tasks(brief)

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
    )

    print("\nBranding Crew starting for " + brief['brand_name'] + "...")
    print("5 agents. Saves after every agent. Safe to interrupt.\n")

    start_time = time.time()
    result = None

    try:
        result = crew.kickoff()

    except KeyboardInterrupt:
        print("\n\n[INTERRUPTED] Saving whatever was completed...")

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
                save_task_output(safe_name, task_name, output, checkpoint)

        full_doc = assemble_full_document(safe_name, checkpoint)
        folder = get_branding_folder(safe_name)

        if full_doc.strip():
            full_filename = os.path.join(folder, safe_name + "_brand_document_FULL.txt")
            try:
                with open(full_filename, "w", encoding="utf-8") as f:
                    f.write(full_doc)
                elapsed = int(time.time() - start_time)
                print("\n" + "=" * 60)
                print("BRANDING CREW COMPLETE")
                print("=" * 60)
                print("Output folder:  " + folder + "/")
                print("Sections saved: " + str(len(checkpoint["completed"]))
                      + " / " + str(len(TASK_NAMES)))
                print("Full document:  " + full_filename)
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
                os.remove(get_checkpoint_file(safe_name))
                print("[OK] Checkpoint cleaned up.")
            except Exception:
                pass

    return result


if __name__ == "__main__":
    run_branding_crew()
