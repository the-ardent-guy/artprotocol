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


# ─── AGENTS ──────────────────────────────────────────────────────────────────

market_researcher = Agent(
    role="Market & Cultural Research Specialist",
    goal=(
        "Research the brand's market, cultural context, competitor landscape, "
        "and identify positioning whitespace. Surface both secondary and any "
        "primary research data provided."
    ),
    backstory=(
        "You are a cultural historian, semiotician, and competitive intelligence analyst. "
        "You uncover the deep cultural and historical forces shaping a category, dissect "
        "how competitors position themselves, and find the gap in the market that is real "
        "and ownable. You make connections across domains others miss and understand how "
        "products carry cultural meaning, class codes, and generational identity. "
        "When primary research data is provided — surveys, interviews, user observations — "
        "you treat it as the highest-quality signal and integrate it with your secondary "
        "findings. Generic observations are your failure state. Every insight must be "
        "traceable to this specific brand, category, and context."
    ),
    tools=[search_tool],
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
    max_iter=10
)

brand_strategist = Agent(
    role="Brand Identity Strategist",
    goal=(
        "Build the complete Brand Key and brand identity system: archetype, personality, "
        "messaging framework, tone of voice, brand promise, and a brand manifesto that "
        "captures what this brand truly stands for."
    ),
    backstory=(
        "You are a senior brand strategist with 20 years building category-defining brands "
        "for global agencies. You think in the Brand Key framework — the industry standard "
        "that runs from Root Strength through to Brand Essence — and you translate that "
        "architecture into specific brand behaviors, not abstract labels. "
        "You are a specialist in Jungian archetypes, narrative, and brand mythology. "
        "You write manifestos that make people feel something. Every recommendation you "
        "produce is specific, earned, and defensible. Strategies that could belong to "
        "any other brand are your failure state. You always write example copy in the "
        "brand's voice — you show, not just tell."
    ),
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
    max_iter=10
)

visual_director = Agent(
    role="Visual Identity Director",
    goal=(
        "Define THREE distinct visual identity directions — each a complete system with "
        "color palette, typography, design principles, mood, and rationale. "
        "Each direction must feel like a real, deployable brand — not a variation on a theme."
    ),
    backstory=(
        "You are a senior creative director and art director with deep knowledge of color "
        "psychology, typography history, semiotics, and visual culture across global markets. "
        "You think in visual systems, not individual assets. You deliver three genuinely "
        "different creative directions — the way a top agency presents options to a client. "
        "Each direction has its own name, personality, and full visual specification. "
        "Every visual decision is traceable to a real insight about the brand's psychology, "
        "culture, and audience. You never choose colors or fonts because they look nice — "
        "you choose them because they carry the right meaning. "
        "You always complete your full output. You never stop mid-section."
    ),
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
    max_iter=10
)

launch_strategist = Agent(
    role="GTM & Positioning Strategist",
    goal=(
        "Build go-to-market strategy, positioning statement, pricing approach, "
        "SWOT analysis, launch sequence, and a concrete 90-day action plan."
    ),
    backstory=(
        "You are a positioning specialist and GTM strategist who has launched brands "
        "across D2C, retail, service, and content categories globally. "
        "You think in perceptual maps, competitive axes, and market dynamics. "
        "You define exactly how to own a position, defend it, and communicate it. "
        "You are specific about which channels, in what order, with what budget logic, "
        "and why. Your SWOTs have no generic entries — every point traces to real evidence. "
        "Your 90-day plans are specific enough to brief a team on Monday morning."
    ),
    tools=[search_tool],
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
    max_iter=8
)

document_compiler = Agent(
    role="Brand Document Compiler",
    goal=(
        "Take all previous task outputs and compile the final client-ready Brand Strategy "
        "Document. Complete every section in full — never summarise, shorten, or skip."
    ),
    backstory=(
        "You are a meticulous document architect at a top brand consultancy. "
        "You assemble research, strategy, visual identity, and GTM into a single coherent "
        "deliverable that any designer, copywriter, or marketer can act on immediately. "
        "Structure and completeness are your craft. You format with clean markdown headers. "
        "You never stop before completing the full document."
    ),
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
    max_iter=6
)


# ─── TASKS ───────────────────────────────────────────────────────────────────

def create_tasks(brief, existing_research=None):
    brand_name      = brief.get("brand_name", "")
    what_it_is      = brief.get("what_it_is", "")
    target_audience = brief.get("target_audience", "")
    category        = brief.get("category", "")
    personality     = brief.get("personality", "")
    notes           = brief.get("notes", "")
    geography       = brief.get("geography", "")
    project_type    = brief.get("project_type", "brand")
    usp             = brief.get("usp", "")
    stage           = brief.get("stage", "")

    brief_block = (
        f"Brand / Project name: {brand_name}\n"
        f"Project type: {project_type}\n"
        f"What it is: {what_it_is}\n"
        f"USP / Core differentiator: {usp}\n"
        f"Target audience: {target_audience}\n"
        f"Category: {category}\n"
        f"Stage: {stage}\n"
        f"Geography / Primary market: {geography}\n"
        f"Personality notes: {personality}\n"
        f"Additional context: {notes}"
    )

    # DNA context from onboarding enrichment
    dna_fields = {}
    for key in ("brand_archetype", "tone_axis", "visual_mood", "competitor_keywords",
                "positioning_territory", "content_pillars", "geo_tier"):
        val = brief.get(key, "")
        if val:
            dna_fields[key] = val

    dna_block = ""
    if dna_fields:
        dna_block = "\n\nBRAND DNA (pre-enriched — use as foundation, not constraint):\n"
        for k, v in dna_fields.items():
            dna_block += f"  {k}: {v}\n"

    # Primary research data block
    primary_data = brief.get("primary_data", "").strip()
    primary_block = ""
    if primary_data:
        primary_block = (
            "\n\nPRIMARY RESEARCH DATA (highest-quality signal — prioritise this above "
            "all secondary findings. Integrate, reference, and build on this data "
            "throughout your analysis):\n\n"
            + primary_data[:8000]
        )

    # Existing research report (if user already ran the Research service)
    research_context_block = ""
    if existing_research:
        research_context_block = (
            "\n\nEXISTING RESEARCH REPORT (already completed — do NOT repeat this work. "
            "Reference findings from this report to support your strategy):\n\n"
            + str(existing_research)[:6000]
        )

    # ── TASK 1: Market Research ───────────────────────────────────────────────
    if existing_research:
        # If we have prior research, skip the research agent and write a synthesis task
        market_research_task = Task(
            description=(
                "Synthesise the existing research report below for the brand strategy process.\n\n"
                + brief_block + dna_block + primary_block + research_context_block + "\n\n"
                "Write a concise synthesis (400–600 words) covering:\n"
                "1. TOP 5 INSIGHTS from the research most relevant to brand positioning\n"
                "2. KEY COMPETITORS and their positioning vulnerabilities\n"
                "3. MARKET GAPS — the unclaimed territory this brand should own\n"
                "4. TARGET AUDIENCE PSYCHOGRAPHICS — who they are beyond demographics\n\n"
                "If primary research data is provided, integrate it directly into findings."
            ),
            agent=market_researcher,
            expected_output=(
                "A 400–600 word synthesis with 4 clearly labeled sections. "
                "Every insight specific and evidence-based."
            )
        )
    else:
        market_research_task = Task(
            description=(
                "Research the market landscape for the brand described below.\n\n"
                + brief_block + dna_block + primary_block + "\n\n"
                "Produce a detailed research report. Minimum 700 words total.\n\n"
                "1. CULTURAL CONTEXT AND TRENDS\n"
                "   What cultural, historical, and generational forces shape this category "
                "right now? What movements or societal shifts make this brand relevant? "
                "Cite specific examples. Reference any primary data provided.\n\n"
                "2. TOP 5 COMPETITORS WITH POSITIONING\n"
                "   For each: name, positioning, messaging emphasis, visual and verbal codes "
                "used, and their single biggest vulnerability.\n\n"
                "3. MARKET GAPS AND OPPORTUNITIES\n"
                "   What is nobody in this category saying that consumers clearly care about? "
                "What positioning territory is completely unclaimed?\n\n"
                "4. TARGET AUDIENCE PSYCHOGRAPHICS\n"
                "   Go beyond demographics. What are they moving away from and toward? "
                "What do they signal with their choices? What would they never admit?\n\n"
                "5. PRIMARY DATA INTEGRATION (if provided)\n"
                "   Summarise key findings from primary research. Where do they confirm or "
                "contradict secondary findings? What do they reveal that no desk research could?"
            ),
            agent=market_researcher,
            expected_output=(
                "A detailed market research report with 5 clearly labeled sections. "
                "Minimum 700 words. Every observation specific to this brand's context."
            )
        )

    # ── TASK 2: Brand Key + Identity ─────────────────────────────────────────
    brand_strategy_task = Task(
        description=(
            "Build the complete Brand Key and brand identity for " + brand_name + ".\n\n"
            "Brief:\n" + brief_block + dna_block + primary_block + "\n\n"
            "Use the market research from the previous task to ground every decision.\n\n"
            "Deliver all 7 sections below. Minimum 700 words total.\n\n"

            "1. BRAND KEY\n"
            "   The Brand Key is the industry-standard brand architecture framework. "
            "Complete all 8 layers:\n"
            "   - Root Strength: the one core truth that makes this brand credible\n"
            "   - Competitive Environment: the world this brand lives in\n"
            "   - Target: who this brand is for (go deep — psychology, not just demographics)\n"
            "   - Insight: the single human truth that makes this brand necessary\n"
            "   - Benefits: Functional (what it does) + Emotional (how it makes you feel) + "
            "Social (what it says about you)\n"
            "   - Values, Personality & Character: 5 traits — for each: what it IS, "
            "what it is NOT, and the shadow side\n"
            "   - Reasons to Believe: 3 specific, verifiable proof points\n"
            "   - Discriminator: the single most important difference vs. all competitors\n"
            "   - Brand Essence: one to four words that capture the brand's soul\n\n"

            "2. BRAND ARCHETYPE + MYTHOLOGY\n"
            "   Which Jungian archetype and precisely why — including how it manifests in "
            "verbal expression and behavior. The brand's creation myth: the true story of "
            "why it exists, told to be worth repeating.\n\n"

            "3. MESSAGING FRAMEWORK\n"
            "   Hero tagline. Three key messages, each with a one-line proof point. "
            "Then write 3 example headlines in the brand's actual voice — "
            "one for acquisition, one for retention, one for culture/values.\n\n"

            "4. TONE OF VOICE GUIDE\n"
            "   How the brand speaks to: new customers, loyal customers, product descriptions, "
            "and critics. Words it owns. Words it never uses. "
            "Write one example paragraph in the brand's voice on the topic: "
            "'Why we exist' — this should feel unmistakably this brand.\n\n"

            "5. BRAND MANIFESTO\n"
            "   A 150–200 word manifesto that captures what this brand truly believes. "
            "Not a mission statement. Not bullet points. Prose that makes someone feel "
            "something. Write it as if it would appear on the back of the brand's first "
            "product, or the first line of their website.\n\n"

            "6. BRAND PROMISE\n"
            "   One sentence internal north star: for whom, what it gives them, "
            "why it is different, what it stands for.\n\n"

            "7. WHAT THIS BRAND IS NOT\n"
            "   5 specific things this brand must never be, do, or say — "
            "with a one-line rationale for each."
        ),
        agent=brand_strategist,
        expected_output=(
            "A complete brand identity document with 7 sections: Brand Key (all 8 layers), "
            "Brand Archetype + Mythology, Messaging Framework (with example headlines), "
            "Tone of Voice (with example paragraph), Brand Manifesto, Brand Promise, "
            "What This Brand Is Not. Minimum 700 words. Nothing generic."
        )
    )

    # ── TASK 3: Three Visual Identity Directions ──────────────────────────────
    visual_identity_task = Task(
        description=(
            "Design THREE distinct visual identity directions for " + brand_name + ".\n\n"
            "Brief:\n" + brief_block + dna_block + "\n\n"
            "Each direction must be a complete, deployable visual system — not a variation "
            "on the same theme. A real agency delivers three genuinely different routes "
            "so the client can choose, mix, or evolve. Think: different personality, "
            "different cultural reference, different emotional register.\n\n"
            "For EACH of the three directions, deliver all 6 components:\n\n"
            "DIRECTION NAME + POSITIONING LINE\n"
            "   Give each direction a memorable name and a one-line positioning line "
            "that captures its personality.\n\n"
            "1. DESIGN PHILOSOPHY\n"
            "   In 3–4 sentences: what drives the visual decisions in this direction. "
            "What cultural or aesthetic world does it live in?\n\n"
            "2. COLOR PALETTE\n"
            "   Primary (2 colors), Secondary (2 colors), Accent (1 color). "
            "For each: brand-specific name (not generic), exact HEX code, "
            "psychological rationale, cultural/sensory reference, and where it lives.\n\n"
            "3. TYPOGRAPHY\n"
            "   Headline font: specific name, historical/cultural rationale, what it signals. "
            "Body font: specific name and rationale. "
            "Display accent (optional): for pull quotes or hero moments. "
            "2 typography rules specific to this direction.\n\n"
            "4. FIVE DESIGN PRINCIPLES\n"
            "   Governing rules for all visual output. For each: what it means, "
            "correct use example, violation example.\n\n"
            "5. MOOD BOARD DESCRIPTION\n"
            "   5 specific visual references — real images, artworks, spaces, moments, "
            "or cultural artifacts. For each: what it is, where to find it, why it belongs.\n\n"
            "6. VISUAL DONTS\n"
            "   5 specific visual choices that would feel immediately wrong for this direction.\n\n"
            "After the three directions, add:\n\n"
            "DIRECTION RECOMMENDATION\n"
            "   Which direction best fits the brand strategy and why. "
            "Which elements from the other directions could be borrowed. "
            "What to brief a designer on first."
        ),
        agent=visual_director,
        expected_output=(
            "Three complete visual identity directions, each with a name and positioning line, "
            "plus 6 components: Design Philosophy, Color Palette (with HEX codes), Typography, "
            "Five Design Principles, Mood Board Description, Visual Donts. "
            "Followed by a Direction Recommendation. All sections complete, nothing cut short."
        )
    )

    # ── TASK 4: GTM + Positioning + 90-day plan ───────────────────────────────
    launch_strategy_task = Task(
        description=(
            "Build the complete launch and go-to-market plan for " + brand_name + ".\n\n"
            "Brief:\n" + brief_block + research_context_block + "\n\n"
            "Minimum 600 words total.\n\n"

            "1. POSITIONING STATEMENT\n"
            "   Expanded format: For [target] / Who [need] / [Brand] is the [category] / "
            "That [key benefit] / Unlike [competitor] / Our brand [differentiator]. "
            "Then a one-sentence internal version. "
            "Show exactly where this brand sits on the competitive map.\n\n"

            "2. COMPETITIVE POSITIONING MAP\n"
            "   Define two axes that best show this brand's differentiated position "
            "(e.g. Mass ↔ Premium vs. Rational ↔ Emotional). "
            "List 5 competitors on the map with their coordinates. "
            "Explain where this brand sits and why.\n\n"

            "3. GTM CHANNEL STRATEGY\n"
            "   Primary / Secondary / Ignore for each relevant channel — and why. "
            "Specific about order, logic, and expected outcome per channel.\n\n"

            "4. LAUNCH SEQUENCE (3 PHASES)\n"
            "   Phase 1 Pre-launch (weeks 1–4): specific actions, goal, success metric.\n"
            "   Phase 2 Launch (weeks 5–8): specific actions, goal, metric.\n"
            "   Phase 3 Growth (weeks 9–16): specific actions, goal, metric.\n\n"

            "5. PRICING RECOMMENDATION\n"
            "   What pricing model reinforces positioning? "
            "How does the price signal the brand's identity? "
            "What price would undermine it?\n\n"

            "6. SWOT MATRIX WITH STRATEGIC PRIORITIES\n"
            "   4 Strengths, 4 Weaknesses, 4 Opportunities, 4 Threats. "
            "Every point specific to this brand — not generic. "
            "End with top 3 strategic priorities derived from this SWOT.\n\n"

            "7. 90-DAY ACTION PLAN\n"
            "   Specific enough to brief a team on Monday morning. "
            "Week 1–2: foundation. Week 3–4: assets. Month 2: launch. Month 3: optimise. "
            "Each week: 3–5 specific actions with owner type (founder / designer / marketer)."
        ),
        agent=launch_strategist,
        expected_output=(
            "A complete GTM document with 7 sections: Positioning Statement, "
            "Competitive Positioning Map, GTM Channel Strategy, Launch Sequence, "
            "Pricing Recommendation, SWOT Matrix with Strategic Priorities, "
            "90-Day Action Plan. Minimum 600 words. Evidence-based throughout."
        )
    )

    # ── TASK 5: Critique ──────────────────────────────────────────────────────
    critique_task = Task(
        description=(
            "Review all previous outputs for " + brand_name + " and identify weaknesses.\n\n"
            "You have the market research, Brand Key, brand identity, visual identity "
            "directions, and GTM strategy from previous tasks in your context.\n\n"
            "Find and document:\n\n"
            "1. GENERIC CLAIMS — any statement that could apply to any brand in this category. "
            "Cite the exact claim and why it is generic.\n\n"
            "2. CONTRADICTIONS — where two sections say inconsistent things about the brand's "
            "personality, positioning, or direction. Cite both passages.\n\n"
            "3. POSITIONING OVERLAP — where this brand's positioning overlaps significantly "
            "with a named competitor. Be specific.\n\n"
            "4. UNSUPPORTED CLAIMS — important strategic claims with no evidence. "
            "List each with the section it appears in.\n\n"
            "5. VISUAL–STRATEGY ALIGNMENT — do the three visual directions genuinely reflect "
            "the Brand Key and archetype? Call out any misalignment.\n\n"
            "For each issue: state the problem, quote the text, write a specific correction.\n\n"
            "End with a VERDICT: STRONG / NEEDS REVISION / MAJOR ISSUES — "
            "and 2–3 sentences on the overall quality of the strategy package."
        ),
        agent=brand_strategist,
        expected_output=(
            "A critique with 5 sections and a VERDICT. Each issue has a quote and correction. "
            "The Visual–Strategy Alignment section specifically addresses the 3 directions."
        )
    )

    # ── TASK 6: Final Compiled Document ──────────────────────────────────────
    compile_task = Task(
        description=(
            "Compile the final Brand Strategy Document for "
            + brand_name.upper() + ".\n\n"
            "You have all 5 previous task outputs in your context. "
            "Assemble them into a single, structured, client-ready document. "
            "Do NOT summarise or shorten any section. Include everything as delivered. "
            "Do NOT stop before the full document is complete.\n\n"
            "Use this exact structure with markdown headers:\n\n"
            "# BRAND STRATEGY DOCUMENT: " + brand_name.upper() + "\n\n"
            "## Executive Summary\n"
            "(3-paragraph synthesis: the core opportunity, the brand's identity at a glance, "
            "the recommended direction and why now)\n\n"
            "## Market Landscape\n"
            "(Full market research output: cultural context, competitors, gaps, audience, "
            "primary data findings if available)\n\n"
            "## Brand Key\n"
            "(All 8 layers of the Brand Key framework)\n\n"
            "## Brand Identity\n"
            "(Archetype + mythology, messaging framework with example headlines, "
            "tone of voice with example paragraph)\n\n"
            "## Brand Manifesto\n"
            "(The full manifesto text)\n\n"
            "## Brand Promise & What This Brand Is Not\n\n"
            "## Visual Identity — Direction 1: [Name]\n"
            "(Full Direction 1 specification)\n\n"
            "## Visual Identity — Direction 2: [Name]\n"
            "(Full Direction 2 specification)\n\n"
            "## Visual Identity — Direction 3: [Name]\n"
            "(Full Direction 3 specification)\n\n"
            "## Visual Direction Recommendation\n\n"
            "## Go-To-Market Strategy\n"
            "(Positioning statement, competitive map, channels, launch sequence, pricing)\n\n"
            "## SWOT Analysis & Strategic Priorities\n\n"
            "## 90-Day Action Plan\n\n"
            "## Strategy Quality Review\n"
            "(The critique verdict and any key corrections applied)\n\n"
            "---\n"
            "*Generated by Art Protocol · " + datetime.now().strftime("%B %Y") + "*"
        ),
        agent=document_compiler,
        expected_output=(
            "A complete Brand Strategy Document for " + brand_name + " with all 13 sections. "
            "Nothing summarised or cut short. Professional client-ready format with clean "
            "markdown headers. Ends with generation attribution line."
        )
    )

    return [
        market_research_task,
        brand_strategy_task,
        visual_identity_task,
        launch_strategy_task,
        critique_task,
        compile_task,
    ]


# ─── CHECKPOINT HELPERS ───────────────────────────────────────────────────────

TASK_NAMES = [
    "1_market_research",
    "2_brand_key_identity",
    "3_visual_directions",
    "4_gtm_strategy",
    "5_critique",
    "6_compiled_document",
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


# ─── HEADLESS RUNNER (called from run_crew.py) ────────────────────────────────

def run_branding_crew_headless(brief, existing_research=None):
    """Entry point for the headless runner. Returns the compiled document string."""
    tasks = create_tasks(brief, existing_research=existing_research)

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
    result = crew.kickoff()
    return result


# ─── INTERACTIVE RUNNER (CLI) ─────────────────────────────────────────────────

def run_branding_crew():
    print("\n" + "=" * 60)
    print("BRANDING CREW - ART PROTOCOL")
    print("=" * 60)

    brand_name_input = input("1.  Brand name: ").strip()
    safe_name = brand_name_input.replace(" ", "_")
    checkpoint = load_checkpoint(safe_name)

    if checkpoint.get("completed") and checkpoint.get("brief"):
        print("\n[CHECKPOINT FOUND] Previous run saved "
              + str(len(checkpoint["completed"])) + " sections.")
        resume = input("Resume from checkpoint? (y/n): ").strip().lower()
        if resume == "y":
            brief = checkpoint["brief"]
        else:
            checkpoint = {"completed": [], "outputs": {}, "brief": {}}
            save_checkpoint(safe_name, checkpoint)
            brief = None
    else:
        brief = None

    if brief is None:
        brief = {
            "brand_name":      brand_name_input,
            "what_it_is":      input("2.  What is it (one sentence): ").strip(),
            "target_audience": input("3.  Target audience: ").strip(),
            "category":        input("4.  Category: ").strip(),
            "geography":       input("5.  Primary market / geography: ").strip(),
            "personality":     input("6.  Brand personality in 3 words: ").strip(),
            "primary_data":    input("7.  Paste primary research data (or leave blank): ").strip(),
            "notes":           input("8.  Any other notes: ").strip(),
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

    print("\nBranding Crew starting for " + brief["brand_name"] + "...")
    print("5 agents. Brand Key + 3 Visual Directions + Manifesto + 90-Day Plan.\n")

    start_time = time.time()
    result = None

    try:
        result = crew.kickoff()
    except KeyboardInterrupt:
        print("\n\n[INTERRUPTED] Saving whatever was completed...")
    except Exception as e:
        print("\n[ERROR] Crew failed: " + str(e))
        traceback.print_exc()
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
                print("Sections saved: " + str(len(checkpoint["completed"])) + " / " + str(len(TASK_NAMES)))
                print("Full document:  " + full_filename)
                print("Time elapsed:   " + str(elapsed // 60) + "m " + str(elapsed % 60) + "s")
                print("=" * 60)
            except Exception as e:
                print("[WARNING] Could not save full document: " + str(e))

        if len(checkpoint["completed"]) >= len(TASK_NAMES):
            try:
                os.remove(get_checkpoint_file(safe_name))
            except Exception:
                pass

    return result


if __name__ == "__main__":
    run_branding_crew()
