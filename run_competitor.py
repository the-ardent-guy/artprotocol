from crewai import Agent, Task, Crew, Process
from crewai_tools import SerperDevTool
from dotenv import load_dotenv
import os
import sys
import time
import traceback

load_dotenv()

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

search_tool = SerperDevTool()

# AGENT
competitor_analyst = Agent(
    role="Competitive Intelligence Analyst",
    goal="Map the competitive landscape precisely and find positioning whitespace",
    backstory=(
        "You are a senior competitive intelligence analyst. You dissect "
        "how competitors position themselves, what messaging they spend money on, "
        "where they are clustered, and most importantly what they are all missing. "
        "You find the gap in the market that is real and ownable. "
        "You search for live data. You do not rely on memory."
    ),
    tools=[search_tool],
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
    max_iter=15
)

def run():
    print("\n" + "=" * 60)
    print("COMPETITOR ANALYSIS - STANDALONE")
    print("=" * 60)
    print("Runs one agent. Saves to NIID_Branding folder.")
    print("Uses live search data.\n")

    brand_name  = input("Brand name [NIID]: ").strip() or "NIID"
    category    = input("Category [Ready to eat packaged Indian food]: ").strip() or "Ready to eat packaged Indian food"
    location    = input("Location [UK universities + India]: ").strip() or "UK universities + India"
    competitors = input("Competitors [MTR, Haldiram, Bowlful, DryM, Slurrp Farm]: ").strip() or "MTR, Haldiram, Bowlful, DryM, Slurrp Farm"

    safe_name = brand_name.replace(' ', '_')
    folder = safe_name + "_Branding"
    os.makedirs(folder, exist_ok=True)

    task = Task(
        description=(
            "Map the LIVE competitive landscape for " + brand_name + " right now.\n\n"
            "Use search to find real, current data on each competitor.\n\n"
            "Category: " + category + "\n"
            "Location: " + location + "\n"
            "Known competitors: " + competitors + "\n\n"
            "Search specifically for:\n"
            "- Each competitor's current UK pricing and shelf presence\n"
            "- Their current Instagram/social media strategy and tone\n"
            "- Recent campaigns or product launches (2024-2025)\n"
            "- UK stockist and distribution data\n"
            "- Consumer reviews and complaints (Reddit, Trustpilot, Amazon UK)\n"
            "- Their website positioning language right now\n\n"
            "Deliver exactly:\n\n"
            "1. CATEGORY CODES\n"
            "What every brand does visually, verbally, and behaviourally. "
            "Cite specific live examples from search.\n\n"
            "2. COMPETITOR PROFILES (one per competitor)\n"
            "For each: current positioning, UK price point, social strategy, "
            "distribution channels, biggest weakness, consumer sentiment.\n\n"
            "3. POSITIONING MAP\n"
            "Two axes. Plot all competitors. Show exactly where the whitespace is.\n\n"
            "4. THE 3 BIGGEST ASSUMPTIONS this category makes without questioning.\n\n"
            "5. CATEGORY CLICHES\n"
            "Specific phrases, visual tropes, and campaign structures that are "
            "overused and dead. Cite real examples.\n\n"
            "6. WHITESPACE\n"
            "The specific, uncontested position available to " + brand_name + ". "
            "Be precise about why it is genuinely empty.\n\n"
            "7. COMPETITOR WEAKNESSES\n"
            "For each competitor: their single biggest vulnerability "
            "that " + brand_name + " can exploit.\n\n"
            "8. THE OPPORTUNITY\n"
            "Exact positioning recommendation for " + brand_name + " "
            "based on live competitive data. "
            "One paragraph. Specific and actionable."
        ),
        agent=competitor_analyst,
        expected_output=(
            "A competitive intelligence report with 8 sections. "
            "Every claim backed by live search data. "
            "Specific competitor pricing, social strategy, and weaknesses. "
            "A clearly defined whitespace opportunity with precise rationale."
        )
    )

    crew = Crew(
        agents=[competitor_analyst],
        tasks=[task],
        process=Process.sequential,
        max_rpm=10,
        verbose=True
    )

    print("\nRunning competitor analysis for " + brand_name + "...")
    print("Using live search. Takes 5-8 minutes.\n")

    start = time.time()
    result = None

    try:
        result = crew.kickoff()

    except KeyboardInterrupt:
        print("\n[INTERRUPTED]")

    except Exception as e:
        print("\n[ERROR] " + str(e))
        traceback.print_exc()

    finally:
        output = ""
        try:
            if result and hasattr(result, 'raw'):
                output = str(result.raw)
            elif result:
                output = str(result)
        except Exception:
            pass

        if output.strip():
            # Save standalone file
            out_file = os.path.join(folder, safe_name + "_2_competitor_analysis_LIVE.txt")
            with open(out_file, "w", encoding="utf-8") as f:
                f.write("# " + brand_name.upper() + " - COMPETITOR ANALYSIS (LIVE DATA)\n")
                f.write("# Run: " + time.strftime("%Y-%m-%d %H:%M") + "\n\n")
                f.write(output)
            print("\n[SAVED] " + out_file)

            # Also append to the full brand document
            full_doc = os.path.join(folder, safe_name + "_brand_document_FULL.txt")
            if os.path.exists(full_doc):
                with open(full_doc, "a", encoding="utf-8") as f:
                    f.write("\n\n" + "=" * 60 + "\n")
                    f.write("SECTION: 2_COMPETITOR_ANALYSIS_LIVE (UPDATED)\n")
                    f.write("=" * 60 + "\n\n")
                    f.write(output)
                print("[APPENDED] to " + full_doc)

            elapsed = int(time.time() - start)
            print("\n" + "=" * 60)
            print("COMPETITOR ANALYSIS COMPLETE")
            print("Time: " + str(elapsed // 60) + "m " + str(elapsed % 60) + "s")
            print("=" * 60)
        else:
            print("\n[WARNING] No output captured.")

    return result

if __name__ == "__main__":
    run()