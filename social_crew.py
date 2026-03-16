import os
os.environ["CREWAI_DISABLE_TELEMETRY"] = "true"

from crewai import Agent, Task, Crew, Process
from crewai_tools import SerperDevTool
from dotenv import load_dotenv
import sys
import json
import time
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
        print("\n[ERROR] Missing environment variables:")
        for k in missing:
            print("  - " + k)
        sys.exit(1)

validate_env()

# TOOLS
search_tool = SerperDevTool()


# FOLDER + PROGRESS SAVER

def get_social_folder(brand_name):
    safe_name = brand_name.replace(" ", "_")
    base = os.getenv("AP_CLIENT_BASE", "")
    if base:
        folder = os.path.join(base, safe_name + "_Social")
    else:
        folder = safe_name + "_Social"
    os.makedirs(folder, exist_ok=True)
    return folder

def save_progress(brand_name, task_name, content):
    folder    = get_social_folder(brand_name)
    safe_name = brand_name.replace(" ", "_")
    filename  = os.path.join(folder, safe_name + "_social_progress.txt")
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(filename, "a", encoding="utf-8") as f:
        f.write("\n\n" + "=" * 60 + "\n")
        f.write("TASK COMPLETED: " + task_name + "\n")
        f.write("TIME: " + timestamp + "\n")
        f.write("=" * 60 + "\n\n")
        f.write(str(content))
    print("\n[SAVED] " + task_name + " -> " + filename)


# AGENTS

social_analyst = Agent(
    role="Social Media Research Analyst",
    goal=(
        "Research the brand's social media landscape: brand voice, competitor social "
        "presence, and platform performance intelligence"
    ),
    backstory=(
        "You are a social media intelligence specialist who combines brand voice analysis, "
        "competitor social media research, and platform performance insights into one "
        "comprehensive brief. You research real profiles and engagement patterns to get "
        "actual data on what is working and what is missing in the category. You identify "
        "the content white space nobody is owning. Generic social media observations are "
        "your failure state — every finding must be specific and actionable."
    ),
    tools=[search_tool],
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
    max_iter=10
)

content_strategist = Agent(
    role="Content Strategy Director",
    goal=(
        "Build content pillars, 30-day calendar structure, and 2 campaign concepts "
        "specific to this brand"
    ),
    backstory=(
        "You are a content strategist and creative director who thinks in campaigns, "
        "not posts. You build content pillars that could not belong to any other brand "
        "in the category and campaign concepts with clear central tension and a reason "
        "for the audience to care. You turn strategy into a precise 30-day execution "
        "plan where every post has purpose. Generic content strategies are your failure "
        "state — specificity to this brand's world is your standard."
    ),
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
    max_iter=8
)

social_copywriter = Agent(
    role="Social Media Copywriter",
    goal=(
        "Write all 30 post captions with Hook, Caption, CTA, Hashtags, and Variation B "
        "for every post in the calendar"
    ),
    backstory=(
        "You are a social media copywriter who writes in brand voice, not generic content "
        "voice. You know the difference between a hook that stops the scroll and one that "
        "gets ignored. You write captions that feel like a person, not a brand account. "
        "You always write 2 variations per post. You never use cliches, empty enthusiasm, "
        "or hollow CTAs. You write ALL 30 posts assigned to you. You do not stop early."
    ),
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
    max_iter=20
)

qa_reviewer = Agent(
    role="Social Media QA Reviewer",
    goal=(
        "Review all 30 posts against brand voice, score them on 4 criteria, "
        "and rewrite any post scoring below 7"
    ),
    backstory=(
        "You are the last line of defence before content goes out. You check every post "
        "against brand voice, engagement potential, clarity, and CTA strength. You flag "
        "everything that fails and rewrite it immediately. You read posts from the previous "
        "agent context — you never ask for posts to be provided. They are already in your "
        "context. You identify standout posts and explain why they work."
    ),
    verbose=True,
    llm="anthropic/claude-haiku-4-5-20251001",
    max_iter=8
)

social_compiler = Agent(
    role="Social Strategy Compiler",
    goal=(
        "Compile everything into a final social media strategy document and "
        "scheduler-ready export"
    ),
    backstory=(
        "You are a content operations manager and document architect. You take all "
        "approved content and strategy outputs and format them into two deliverables: "
        "a complete Social Media Strategy document and a scheduler-ready export for "
        "Buffer or Publer. Every post is organised by date, platform, format, caption, "
        "and hashtags. You read all content from previous agents in your context."
    ),
    verbose=True,
    llm="anthropic/claude-haiku-4-5-20251001",
    max_iter=5
)


# TASKS

def create_social_tasks(brief, brand_document=None):

    brand_name      = brief.get('brand_name', '')
    platforms       = brief.get('platforms', 'Instagram, LinkedIn')
    target_audience = brief.get('target_audience', brief.get('customer', ''))
    tone            = brief.get('tone', '')
    notes           = brief.get('notes', '')

    brand_context = brand_document if brand_document else (
        "Brand: "           + brand_name      + "\n"
        "Platforms: "       + platforms        + "\n"
        "Target audience: " + target_audience  + "\n"
        "Tone: "            + tone             + "\n"
        "Notes: "           + notes
    )

    def make_callback(task_name):
        def callback(output):
            save_progress(brand_name, task_name, output)
        return callback

    social_analysis_task = Task(
        description=(
            "Research the social media landscape for " + brand_name + ".\n\n"
            "Brand context:\n" + brand_context + "\n\n"
            "Produce a detailed analysis covering all four areas below. "
            "Minimum 600 words total.\n\n"
            "1. BRAND VOICE GUIDE\n"
            "   Extract and codify how this brand should speak on social media. "
            "Include: personality (3 traits with on-brand and off-brand examples), "
            "tone spectrum (formal/casual, serious/playful, reserved/bold), "
            "vocabulary (10 words owned, 10 never used), "
            "content dos (6 specific on-brand behaviors), "
            "content donts (6 specific off-brand behaviors).\n\n"
            "2. TOP 3 COMPETITOR SOCIAL ANALYSIS\n"
            "   For each competitor: platform presence, format mix, caption style, "
            "what is working for them, and what is clearly missing from their content. "
            "Search for live data before writing.\n\n"
            "3. PLATFORM PERFORMANCE INSIGHTS\n"
            "   For each platform in scope (" + platforms + "): what content formats "
            "are performing, what hook styles get engagement, what is oversaturated, "
            "optimal posting frequency. Based on current category data.\n\n"
            "4. CONTENT OPPORTUNITIES IDENTIFIED\n"
            "   5 specific content angles that no competitor is owning in this category. "
            "Each must be specific enough to brief a writer immediately."
        ),
        agent=social_analyst,
        expected_output=(
            "A complete social media research report with 4 sections: "
            "Brand Voice Guide, Competitor Analysis, Platform Performance Insights, "
            "Content Opportunities. Minimum 600 words. "
            "Specific to this brand and category throughout."
        ),
        callback=make_callback("Social Analysis")
    )

    content_strategy_task = Task(
        description=(
            "Build the complete content strategy for " + brand_name + " "
            "using the research from the previous task.\n\n"
            "Platforms: " + platforms + "\n\n"
            "Produce a complete strategy document. Minimum 800 words total.\n\n"
            "1. FIVE CONTENT PILLARS WITH RATIONALE\n"
            "   Five pillars specific to THIS brand — not generic categories. "
            "For each pillar: name, why only this brand owns it, 5 content ideas, "
            "best platform, best format. Generic pillars like "
            "'Behind the Scenes' are not acceptable.\n\n"
            "2. 30-DAY CONTENT CALENDAR\n"
            "   Plan every post across all 30 days. For each post: day number, "
            "platform, pillar, format, hook direction (one line), CTA. "
            "Week 1 (Days 1-7): Establishment. Week 2 (Days 8-14): Depth. "
            "Week 3 (Days 15-21): Campaign launch. Week 4 (Days 22-30): Community.\n\n"
            "3. TWO CAMPAIGN CONCEPTS WITH EXECUTION PLANS\n"
            "   For each campaign: name, central idea (one sentence tension), "
            "why now (cultural relevance), audience mechanic (how they participate), "
            "4-week execution plan (Week 1 teaser, Week 2 launch, "
            "Week 3 amplify, Week 4 community), and success metrics."
        ),
        agent=content_strategist,
        expected_output=(
            "A complete content strategy document with 3 sections: "
            "Five Content Pillars, 30-Day Content Calendar (all 30 posts planned), "
            "Two Campaign Concepts with 4-week execution plans. Minimum 800 words."
        ),
        callback=make_callback("Content Strategy")
    )

    copy_task = Task(
        description=(
            "Write all 30 post captions from the content calendar for " + brand_name + ".\n\n"
            "The 30-day calendar is in your context from the previous task. "
            "Follow it exactly — same day, platform, pillar, format.\n\n"
            "For EACH of the 30 posts, produce:\n"
            "HOOK: The first line — stops the scroll, creates curiosity or immediate value\n"
            "FULL CAPTION: Complete caption, 3-5 lines, ready to post\n"
            "CTA: Specific call to action — not generic ('Save this', not 'Like if you agree')\n"
            "HASHTAGS: 10-15 relevant hashtags for this post\n"
            "VARIATION B: Alternative caption with a different angle or tone\n\n"
            "Format each post clearly:\n"
            "DAY [N] - [Platform] - [Format]\n"
            "HOOK: ...\n"
            "CAPTION: ...\n"
            "CTA: ...\n"
            "HASHTAGS: ...\n"
            "VARIATION B: ...\n\n"
            "Rules: Every caption must sound like " + brand_name + " specifically. "
            "No hollow enthusiasm. No generic CTAs. No cliches. "
            "Hooks create curiosity, tension, or immediate value. "
            "Captions feel written by a human.\n\n"
            "Write ALL 30 posts. Do not stop before Day 30. Minimum 2000 words total."
        ),
        agent=social_copywriter,
        expected_output=(
            "Full copy for all 30 posts. Each post has: Hook, Full Caption, "
            "CTA, Hashtags (10-15), Variation B. Clearly numbered Day 1 through Day 30. "
            "Minimum 2000 words total."
        ),
        callback=make_callback("Copy All 30 Posts")
    )

    qa_task = Task(
        description=(
            "Review all 30 posts for " + brand_name + ".\n\n"
            "CRITICAL: The 30 posts are in your context from the previous agent output. "
            "Read them from context right now. Do NOT ask for posts to be provided.\n\n"
            "Score every post on 4 criteria (1-10 each):\n"
            "1. BRAND VOICE MATCH - sounds like " + brand_name + " specifically?\n"
            "2. ENGAGEMENT POTENTIAL - would this get comments, saves, or shares?\n"
            "3. CLARITY - is the message clear and compelling?\n"
            "4. CTA STRENGTH - does the CTA create a specific, motivated action?\n\n"
            "For any post scoring below 7 on any criterion:\n"
            "- Flag it with the post number and criterion\n"
            "- Explain the specific problem\n"
            "- Provide a full rewrite\n\n"
            "Deliver:\n"
            "- Complete QA scorecard (all 30 posts, all 4 scores per post)\n"
            "- All flagged posts with full rewrites\n"
            "- Overall quality assessment (one paragraph)\n"
            "- Top 5 standout posts and why they are exceptional"
        ),
        agent=qa_reviewer,
        expected_output=(
            "QA scorecard for all 30 posts with 4 scores each. "
            "Full rewrites for all posts flagged below 7. "
            "Overall quality assessment. Top 5 standout posts identified."
        ),
        context=[copy_task],
        callback=make_callback("QA Review")
    )

    compile_task = Task(
        description=(
            "Compile the final Social Media Strategy document for " + brand_name + ".\n\n"
            "You have all previous task outputs in your context. "
            "Assemble them into two deliverables:\n\n"
            "DELIVERABLE 1: SOCIAL MEDIA STRATEGY DOCUMENT\n"
            "Use this structure with markdown headers:\n\n"
            "# SOCIAL MEDIA STRATEGY: " + brand_name.upper() + "\n\n"
            "## Brand Voice Bible\n"
            "(Full brand voice guide from the research: personality, tone, vocabulary, dos, donts)\n\n"
            "## Content Strategy\n"
            "(Full content pillars and rationale)\n\n"
            "## 30-Day Calendar\n"
            "(Complete calendar with all 30 posts planned)\n\n"
            "## Copy Bank\n"
            "(All 30 posts with approved/rewritten copy, hooks, CTAs, hashtags, variations)\n\n"
            "## Campaign Concepts\n"
            "(Both campaign concepts with full execution plans)\n\n"
            "DELIVERABLE 2: SCHEDULER-READY EXPORT\n"
            "For each of the 30 posts, use this format:\n"
            "---\n"
            "DATE:\n"
            "PLATFORM:\n"
            "TIME: (recommended posting time)\n"
            "FORMAT:\n"
            "PILLAR:\n"
            "CAPTION:\n"
            "HASHTAGS:\n"
            "VISUAL DIRECTION: (2 sentences)\n"
            "---\n\n"
            "Use QA-approved versions where posts were rewritten."
        ),
        agent=social_compiler,
        expected_output=(
            "Two deliverables: (1) Complete Social Media Strategy Document with "
            "5 sections using markdown headers, client-ready format. "
            "(2) Scheduler-ready export of all 30 posts in structured format."
        ),
        context=[copy_task, qa_task],
        callback=make_callback("Final Compiled Document")
    )

    return [
        social_analysis_task,
        content_strategy_task,
        copy_task,
        qa_task,
        compile_task,
    ]


# AGENT ALIASES (for run_crew.py compatibility)
brand_voice_agent            = social_analyst
competitor_social_agent      = social_analyst
platform_intelligence_agent  = social_analyst
social_brand_language_agent  = content_strategist
content_strategist_agent     = content_strategist
campaign_ideation_agent      = content_strategist
content_calendar_agent       = content_strategist
copy_agent                   = social_copywriter
qa_agent                     = qa_reviewer
scheduler_agent              = social_compiler


# CREW

def run_social_crew(brand_document=None):
    print("\n" + "=" * 60)
    print("SOCIAL MEDIA CREW - ART PROTOCOL")
    print("=" * 60)
    print("Answer carefully. Output quality depends on this.\n")

    if not brand_document:
        print("Do you have a brand document or research report for this client?")
        print("  1. Yes - load a file")
        print("  2. No - work from brief only")
        doc_choice = input("Choice [2]: ").strip() or "2"
        if doc_choice == "1":
            filepath = input("File path (drag into terminal): ").strip().strip('"')
            if os.path.exists(filepath):
                with open(filepath, "r", encoding="utf-8") as f:
                    brand_document = f.read()
                print("[OK] Document loaded (" + str(len(brand_document)) + " chars)\n")
            else:
                print("[WARNING] File not found. Continuing without document.\n")

    brief = {
        'brand_name':      input("1.  Brand name: ").strip(),
        'platforms':       input("2.  Platforms (e.g. Instagram, LinkedIn): ").strip(),
        'target_audience': input("3.  Target audience: ").strip(),
        'tone':            input("4.  Tone of voice: ").strip(),
        'notes':           input("5.  Any other notes: ").strip(),
    }

    folder        = get_social_folder(brief['brand_name'])
    safe_name     = brief['brand_name'].replace(' ', '_')
    progress_file = os.path.join(folder, safe_name + "_social_progress.txt")
    final_file    = os.path.join(folder, safe_name + "_social_media.txt")

    with open(progress_file, "w", encoding="utf-8") as f:
        f.write("SOCIAL MEDIA CREW - " + brief['brand_name'].upper() + "\n")
        f.write("Started: " + datetime.now().strftime('%Y-%m-%d %H:%M:%S') + "\n")
        f.write("=" * 60 + "\n\nBRIEF:\n")
        f.write(json.dumps(brief, indent=2))
        f.write("\n\n" + "=" * 60 + "\n")
    print("\n[SAVED] Brief -> " + progress_file)

    tasks = create_social_tasks(brief, brand_document)

    crew = Crew(
        agents=[
            social_analyst,
            content_strategist,
            social_copywriter,
            qa_reviewer,
            social_compiler,
        ],
        tasks=tasks,
        process=Process.sequential,
        verbose=True,
        max_rpm=3,
        max_retries=2,
    )

    print("\n>> Starting crew for " + brief['brand_name'] + "...")
    print("5 agents. Each task saves to: " + progress_file + "\n")

    start_time = time.time()
    result = None

    try:
        result = crew.kickoff()

    except KeyboardInterrupt:
        print("\n\n[INTERRUPTED] Saving completed tasks...")

    except Exception as e:
        print("\n[ERROR] " + str(e))
        import traceback
        traceback.print_exc()
        print("\n[RECOVERY] Saving all completed tasks...")

    finally:
        if result:
            try:
                with open(final_file, "w", encoding="utf-8") as f:
                    f.write(str(result))
                save_progress(brief['brand_name'], "FINAL COMPLETE OUTPUT", result)
            except Exception as e:
                print("[WARNING] Could not save final file: " + str(e))

        elapsed = int(time.time() - start_time)
        print("\n" + "=" * 60)
        print("SOCIAL CREW " + ("COMPLETE" if result else "STOPPED"))
        print("=" * 60)
        print("Output folder: " + folder)
        print("Progress file: " + progress_file)
        print("Time elapsed:  " + str(elapsed // 60) + "m " + str(elapsed % 60) + "s")
        print("=" * 60)

    return result


# ENTRY POINT

if __name__ == "__main__":
    run_social_crew()
