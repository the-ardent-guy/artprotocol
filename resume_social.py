"""
resume_social.py

Reads the NIID_social_progress.txt, extracts all completed work,
and runs ONLY what is missing:
- Copy for Days 3-30 (Day 3 was cut off mid-way)
- QA Review
- Scheduler Export

Drop this in your aiagency folder and run:
  python resume_social.py
"""

import os
import sys
import json
from datetime import datetime
from crewai import Agent, Task, Crew, Process
from crewai_tools import SerperDevTool
from dotenv import load_dotenv

load_dotenv()

os.environ["CREWAI_DISABLE_TELEMETRY"] = "true"
os.environ.setdefault("OPENAI_API_KEY", "sk-placeholder")

# ENV CHECK
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


# READ PROGRESS FILE

def read_progress_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    return content

def extract_section(progress_text, section_name):
    """Extract a specific completed section from the progress file."""
    marker = "TASK COMPLETED: " + section_name
    if marker not in progress_text:
        return None
    start = progress_text.index(marker)
    # Find the next section marker or end of file
    next_marker = progress_text.find("\n============================================================\nTASK COMPLETED:", start + 1)
    if next_marker == -1:
        section = progress_text[start:]
    else:
        section = progress_text[start:next_marker]
    # Strip the header lines
    lines = section.split("\n")
    # Skip the TASK COMPLETED, TIME, and separator lines (first 4 lines)
    body = "\n".join(lines[4:]).strip()
    return body

def extract_brief(progress_text):
    """Extract the brief JSON from progress file."""
    try:
        start = progress_text.index("BRIEF:\n") + len("BRIEF:\n")
        end = progress_text.index("\n\n============================================================", start)
        brief_json = progress_text[start:end].strip()
        return json.loads(brief_json)
    except Exception as e:
        print("[ERROR] Could not extract brief: " + str(e))
        return None


# SAVE HELPER

def get_social_folder(brand_name):
    folder = brand_name.replace(" ", "_") + "_Social"
    os.makedirs(folder, exist_ok=True)
    return folder

def save_output(brand_name, task_name, content):
    folder    = get_social_folder(brand_name)
    safe_name = brand_name.replace(" ", "_")
    filename  = os.path.join(folder, safe_name + "_social_progress.txt")
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(filename, "a", encoding="utf-8") as f:
        f.write("\n\n" + "=" * 60 + "\n")
        f.write("TASK COMPLETED: " + task_name + " (RESUMED)\n")
        f.write("TIME: " + timestamp + "\n")
        f.write("=" * 60 + "\n\n")
        f.write(str(content))
    print("\n[SAVED] " + task_name + " -> " + filename)
    return filename


# AGENTS

copy_agent = Agent(
    role="Social Media Copywriter",
    goal="Write actual copy for every post in the calendar in brand voice",
    backstory=(
        "You are a social media copywriter who writes in brand voice, not generic content voice. "
        "You write captions that feel like a person, not a brand account. "
        "You always write 2 variations per post. "
        "You never use cliches, empty enthusiasm, or hollow CTAs. "
        "You write ALL posts assigned. You do not stop early."
    ),
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
    max_iter=20
)

qa_agent = Agent(
    role="Content QA Critic",
    goal="Review all content for brand alignment, platform fit, originality, and engagement",
    backstory=(
        "You are the last line of defence before content goes out. "
        "You score every post on 5 criteria and rewrite anything below 7. "
        "CRITICAL: You read posts from context. You NEVER ask for posts to be provided."
    ),
    verbose=True,
    llm="anthropic/claude-haiku-4-5-20251001"
)

scheduler_agent = Agent(
    role="Content Scheduler",
    goal="Format all approved content into a scheduler-ready export",
    backstory=(
        "You format approved content into a clean document ready for Buffer or Publer. "
        "You read content from previous agents in context."
    ),
    verbose=True,
    llm="anthropic/claude-haiku-4-5-20251001"
)


# MAIN

def run():
    print("\n" + "=" * 60)
    print("SOCIAL CREW RESUME - ART PROTOCOL")
    print("=" * 60)
    print("Reads progress file and completes missing sections.\n")

    # Find progress file
    progress_path = input("Progress file path [NIID_Social/NIID_social_progress.txt]: ").strip()
    if not progress_path:
        progress_path = "NIID_Social/NIID_social_progress.txt"
        # Also check old location
        if not os.path.exists(progress_path):
            progress_path = "NIID_social_progress.txt"

    if not os.path.exists(progress_path):
        print("[ERROR] Progress file not found at: " + progress_path)
        print("Please enter the correct path to your _social_progress.txt file.")
        sys.exit(1)

    print("\n[OK] Reading progress file: " + progress_path)
    progress_text = read_progress_file(progress_path)

    # Extract brief
    brief = extract_brief(progress_text)
    if not brief:
        print("[ERROR] Could not read brief from progress file.")
        sys.exit(1)
    print("[OK] Brief loaded for: " + brief['brand_name'])

    # Extract all completed sections
    brand_voice     = extract_section(progress_text, "Brand Voice Bible")
    competitor      = extract_section(progress_text, "Competitor Analysis")
    platform_intel  = extract_section(progress_text, "Platform Intelligence")
    brand_language  = extract_section(progress_text, "Brand Language System")
    content_strategy = extract_section(progress_text, "Content Strategy")
    campaigns       = extract_section(progress_text, "Campaign Ideation")
    calendar        = extract_section(progress_text, "Content Calendar")
    partial_copy    = extract_section(progress_text, "Copy All 30 Posts") or extract_section(progress_text, "Copy")

    print("\n[STATUS] Sections found:")
    print("  Brand Voice Bible:  " + ("YES" if brand_voice else "MISSING"))
    print("  Competitor Analysis: " + ("YES" if competitor else "MISSING"))
    print("  Platform Intel:     " + ("YES" if platform_intel else "MISSING"))
    print("  Brand Language:     " + ("YES" if brand_language else "MISSING"))
    print("  Content Strategy:   " + ("YES" if content_strategy else "MISSING"))
    print("  Campaign Ideation:  " + ("YES" if campaigns else "MISSING"))
    print("  Content Calendar:   " + ("YES" if calendar else "MISSING"))
    print("  Partial Copy:       " + ("YES (Days 1-3 partial)" if partial_copy else "MISSING"))

    # Build context string from all completed work
    full_context = (
        "=== BRAND VOICE BIBLE ===\n" + (brand_voice or "Not available") + "\n\n"
        "=== COMPETITOR ANALYSIS ===\n" + (competitor or "Not available") + "\n\n"
        "=== PLATFORM INTELLIGENCE ===\n" + (platform_intel or "Not available") + "\n\n"
        "=== BRAND LANGUAGE SYSTEM ===\n" + (brand_language or "Not available") + "\n\n"
        "=== CONTENT STRATEGY ===\n" + (content_strategy or "Not available") + "\n\n"
        "=== CAMPAIGN CONCEPTS ===\n" + (campaigns or "Not available") + "\n\n"
        "=== CONTENT CALENDAR ===\n" + (calendar or "Not available") + "\n\n"
        "=== PARTIAL COPY (Days 1-3, incomplete) ===\n" + (partial_copy or "Not available")
    )

    print("\n[OK] Context assembled from completed sections.")
    print("\nReady to run:")
    print("  1. Copy agent  - complete Days 3-30")
    print("  2. QA agent    - review all 30 posts")
    print("  3. Scheduler   - format everything for Buffer/Publer")
    print("\nEstimated time: 15-20 minutes.")

    confirm = input("\nProceed? (y/n): ").strip().lower()
    if confirm != "y":
        print("Cancelled.")
        sys.exit(0)

    def make_callback(task_name):
        def callback(output):
            save_output(brief['brand_name'], task_name, output)
        return callback

    # COPY TASK  complete Days 3-30
    copy_task = Task(
        description=(
            "You are completing a 30-day social media copy job for " + brief['brand_name'] + ".\n\n"
            "IMPORTANT: Days 1 and 2 are already written (see partial copy in context). "
            "Day 3 was started but cut off mid-way. "
            "Your job is to:\n"
            "1. Complete Day 3 from where it was cut off\n"
            "2. Write Days 4 through 30 in full\n\n"
            "ALL CONTEXT FROM PREVIOUS AGENTS:\n\n"
            + full_context[:6000] +
            "\n\n[Context continues - use brand voice, pillars, and calendar above]\n\n"
            "For each post write:\n"
            "1. HOOK - first line that stops the scroll\n"
            "2. FULL CAPTION (Variation A) - complete and ready to post\n"
            "3. VARIATION B - alternative caption, different angle\n"
            "4. CTA - specific, not generic\n"
            "5. HASHTAGS - 15 to 20 relevant hashtags\n"
            "6. FOR REELS - full script with scene directions\n\n"
            "Brand: " + brief['brand_name'] + "\n"
            "Personality: " + brief.get('personality', '') + "\n"
            "Tone: " + brief.get('tone', '') + "\n"
            "Avoid: " + brief.get('avoid', '') + "\n"
            "Platforms: " + brief.get('platforms', 'Instagram, YouTube, LinkedIn') + "\n\n"
            "Label each: DAY 3 (COMPLETED) - Platform - Format, DAY 4 - Platform - Format, etc.\n\n"
            "Write through Day 30. Do not stop early."
        ),
        agent=copy_agent,
        expected_output="Complete copy for Days 3-30. Hook, caption, variation, CTA, hashtags per post.",
        callback=make_callback("Copy Days 3-30")
    )

    # QA TASK
    qa_task = Task(
        description=(
            "QA review of all 30 posts for " + brief['brand_name'] + ".\n\n"
            "CRITICAL: The posts are in your context from the previous copy agent output. "
            "Read them from context NOW. Do NOT ask for posts to be provided.\n\n"
            "Days 1-2 are in the partial copy section. Days 3-30 are from the copy agent just completed.\n\n"
            "Score every post on 5 criteria (1-10):\n"
            "1. BRAND VOICE - sounds like " + brief['brand_name'] + "?\n"
            "2. PLATFORM FIT - right format, length, style?\n"
            "3. HOOK STRENGTH - stops the scroll?\n"
            "4. ORIGINALITY - non-cliche, only this brand?\n"
            "5. ENGAGEMENT TRIGGER - reason to engage?\n\n"
            "For any post below 7: flag it, explain the problem, rewrite it.\n\n"
            "Deliver:\n"
            "- Full QA scorecard (all 30 posts)\n"
            "- Flagged posts with complete rewrites\n"
            "- Overall quality assessment\n"
            "- 3 standout posts and why"
        ),
        agent=qa_agent,
        expected_output="QA scorecard, flagged rewrites, quality assessment, 3 standouts.",
        context=[copy_task],
        callback=make_callback("QA Review")
    )

    # SCHEDULER TASK
    scheduler_task = Task(
        description=(
            "Format all 30 posts for " + brief['brand_name'] + " into a scheduler-ready export.\n\n"
            "Read posts from copy and QA context. Use approved or rewritten versions.\n\n"
            "For each post:\n"
            "---\n"
            "DATE:\n"
            "PLATFORM:\n"
            "TIME: (recommended posting time)\n"
            "FORMAT:\n"
            "PILLAR:\n"
            "CAMPAIGN: (name or Evergreen)\n\n"
            "CAPTION:\n\n"
            "HASHTAGS:\n\n"
            "VISUAL DIRECTION: (2 sentences)\n\n"
            "REEL SCRIPT: (if applicable)\n"
            "---\n\n"
            "After all 30 posts:\n"
            "MONTHLY SUMMARY - posts by platform, pillar, format, campaign vs evergreen\n"
            "NEXT MONTH PREVIEW - 3 directions, what to double down, what to test"
        ),
        agent=scheduler_agent,
        expected_output="30 posts formatted for scheduling. Monthly summary. Next month preview.",
        context=[copy_task, qa_task],
        callback=make_callback("Scheduler Export")
    )

    crew = Crew(
        agents=[copy_agent, qa_agent, scheduler_agent],
        tasks=[copy_task, qa_task, scheduler_task],
        process=Process.sequential,
        verbose=True,
        max_rpm=3,
        max_retries=2,
    )

    print("\n>> Running 3 agents: Copy (Days 3-30) -> QA -> Scheduler...")

    try:
        result = crew.kickoff()

        # Save final combined output
        folder    = get_social_folder(brief['brand_name'])
        safe_name = brief['brand_name'].replace(' ', '_')
        final_file = os.path.join(folder, safe_name + "_social_COMPLETE.txt")

        with open(final_file, "w", encoding="utf-8") as f:
            f.write("NIID SOCIAL MEDIA - COMPLETE OUTPUT\n")
            f.write("Generated: " + datetime.now().strftime('%Y-%m-%d %H:%M:%S') + "\n\n")
            f.write("=" * 60 + "\n")
            f.write("NOTE: Days 1-2 from original run. Days 3-30 from resume run.\n")
            f.write("=" * 60 + "\n\n")
            if partial_copy:
                f.write("=== DAYS 1-2 (Original) ===\n\n")
                f.write(partial_copy + "\n\n")
            f.write(str(result))

        save_output(brief['brand_name'], "FINAL COMPLETE OUTPUT", result)

        print("\n" + "=" * 60)
        print("SOCIAL CREW RESUME COMPLETE")
        print("=" * 60)
        print("Full output -> " + final_file)
        print("=" * 60)

    except Exception as e:
        print("\n[ERROR] " + str(e))
        import traceback
        traceback.print_exc()
        print("\n[SAVED] All completed output in progress file.")


if __name__ == "__main__":
    run()