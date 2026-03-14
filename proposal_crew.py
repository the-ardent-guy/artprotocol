from crewai import Agent, Task, Crew, Process
from dotenv import load_dotenv
import os
import sys
import subprocess

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


# AGENTS

proposal_writer = Agent(
    role="Senior Proposal Writer",
    goal=(
        "Write the full proposal introduction and detailed scope of work "
        "for each requested service"
    ),
    backstory=(
        "You are a senior proposal writer for a design and strategy agency. "
        "You write proposals that win clients — not because they are persuasive, "
        "but because they are specific. You read a client brief and write an introduction "
        "that proves you understand their brand, their challenge, and their ambition "
        "better than they expected. For the scope of work, you explain what each phase "
        "does specifically for this client — not copy-pasted from a template. "
        "You write what the client will have at the end of each phase. "
        "You write in a calm, confident, direct tone. "
        "Generic agency language is your failure state. "
        "Every sentence must be specific to this client."
    ),
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
)

pricing_strategist = Agent(
    role="Commercial Strategist",
    goal=(
        "Build pricing structure, package options, payment terms, and ROI framing "
        "for the proposal"
    ),
    backstory=(
        "You are a pricing and commercial strategist for a boutique design and strategy "
        "agency in India. You understand the value of brand work, the Indian market, "
        "and how to price for different client stages — early startups, growing D2C brands, "
        "established businesses. You structure packages that feel fair, clear, and justified "
        "by scope. You frame investment in terms of return. You are honest about what the "
        "client needs right now versus what can come later. Unjustified pricing and "
        "opaque package structures are your failure state."
    ),
    verbose=True,
    llm="anthropic/claude-sonnet-4-6",
)

proposal_critic = Agent(
    role="Proposal Quality Reviewer",
    goal=(
        "Review the entire proposal for specificity, commercial logic, tone, "
        "and rewrite any generic sections"
    ),
    backstory=(
        "You are a ruthless proposal critic. Your only job is to make sure every sentence "
        "in this proposal is specific to this client. You flag any sentence that could "
        "appear in any other agency's proposal. You check that the tone is calm and "
        "confident — not salesy or desperate. You verify scope descriptions match what "
        "was actually promised. You ensure pricing feels justified by the scope. "
        "You rewrite every section that scores below 8 out of 10. "
        "Generic language is your enemy."
    ),
    verbose=True,
    llm="anthropic/claude-haiku-4-5-20251001",
)


# TASKS

def create_proposal_tasks(brief):
    brand_name  = brief.get('brand_name', brief.get('client_name', ''))
    what_it_is  = brief.get('what_it_is', brief.get('what_they_do', ''))
    challenge   = brief.get('challenge', '')
    goal        = brief.get('goal', '')
    services    = brief.get('services', brief.get('services_requested', ''))
    notes       = brief.get('notes', brief.get('additional_context', ''))

    brief_block = (
        "Client name: " + brand_name + "\n"
        "What they do: " + what_it_is + "\n"
        "Their challenge: " + challenge + "\n"
        "Their goal: " + goal + "\n"
        "Services requested: " + services + "\n"
        "Additional context: " + notes
    )

    writing_task = Task(
        description=(
            "Write the proposal introduction and scope of work for Art Protocol's "
            "proposal to " + brand_name + ".\n\n"
            "CLIENT BRIEF:\n" + brief_block + "\n\n"
            "Produce three deliverables. Minimum 600 words total. "
            "Every sentence must be specific to " + brand_name + " — "
            "no generic agency language.\n\n"
            "1. COMPELLING INTRODUCTION (2 paragraphs)\n"
            "   Paragraph 1 (2-3 sentences): Open with a bold, specific statement about "
            "what " + brand_name + " is building or stands for. Acknowledge the specific "
            "challenge or opportunity they face. Make them feel you have genuinely "
            "understood their brand — not just read a brief.\n"
            "   Paragraph 2 (2-3 sentences): Define Art Protocol's role in this engagement "
            "specifically. What will AP shape, build, or translate for this client? "
            "End with what the outcome will feel like — the experience, the positioning, "
            "the presence.\n"
            "   Tone: Calm. Confident. Direct. No enthusiasm. No exclamation marks. "
            "No phrases like 'we are excited to' or 'we believe in your vision'.\n\n"
            "2. SERVICE SCOPE DESCRIPTIONS\n"
            "   For each service in: " + services + "\n"
            "   Write: 2-3 sentences describing what this phase does specifically for "
            + brand_name + " (reference their context, product, or challenge). "
            "Then one sentence: what they will have at the end of this phase. "
            "Then one sentence commercial description for the pricing table.\n\n"
            "3. PROJECT TIMELINE OVERVIEW\n"
            "   A brief timeline showing which services happen in what sequence and "
            "approximate duration. Keep it specific and realistic."
        ),
        agent=proposal_writer,
        expected_output=(
            "Three deliverables: (1) Two-paragraph introduction specific to the client. "
            "(2) Scope descriptions for each service — 2-3 sentences + deliverable "
            "statement + commercial description. (3) Project timeline overview. "
            "Minimum 600 words. No generic language."
        )
    )

    pricing_task = Task(
        description=(
            "Build the commercial proposal for " + brand_name + ".\n\n"
            "CLIENT BRIEF:\n" + brief_block + "\n\n"
            "Art Protocol standard pricing ranges (INR):\n"
            "- Brand Strategy and Visual Identity: 50,000 - 1,20,000\n"
            "- Shopify Design and Development: 1,20,000 - 2,50,000\n"
            "- Social Media Management: 15,000 - 40,000 per month\n"
            "- Content and Discovery Setup: 30,000 - 60,000\n"
            "- Email Marketing Setup: 25,000 - 45,000\n"
            "- Performance Marketing: 20,000 - 60,000 per month\n\n"
            "Produce the complete commercial section. Minimum 300 words.\n\n"
            "1. INDIVIDUAL SERVICE PRICING IN INR\n"
            "   For each service: recommended price and one-line justification "
            "based on this client's scope and stage.\n\n"
            "2. RECOMMENDED PACKAGE WITH DISCOUNT\n"
            "   Total before discount. Recommended discounted package price. "
            "Discount percentage and clear justification.\n\n"
            "3. PAYMENT TERMS\n"
            "   Which payment structure applies to each service "
            "(e.g. 50% advance / 50% delivery, milestone-based). "
            "Any special considerations for this client's stage.\n\n"
            "4. WHAT IS INCLUDED / EXCLUDED\n"
            "   Clear list of what each service includes. What is explicitly out of scope.\n\n"
            "5. ROI FRAMING PARAGRAPH\n"
            "   One paragraph framing the investment in terms of what it unlocks "
            "for " + brand_name + ". Specific, not generic. Reference their goal."
        ),
        agent=pricing_strategist,
        expected_output=(
            "Complete commercial proposal with 5 sections: Individual Service Pricing, "
            "Recommended Package, Payment Terms, Included/Excluded scope, "
            "ROI Framing Paragraph. Minimum 300 words. All figures in INR."
        )
    )

    critique_task = Task(
        description=(
            "Review the full proposal for " + brand_name + " "
            "(introduction + scope + pricing).\n\n"
            "The full proposal content is in your context from the previous agents. "
            "Read it from context. Do not ask for it to be provided.\n\n"
            "Run 4 quality checks:\n\n"
            "CHECK 1 - SPECIFICITY\n"
            "   Flag any sentence that could appear in a proposal for a different client. "
            "Every sentence must reference something specific about " + brand_name + ". "
            "For each flagged sentence: quote it, explain the problem, provide a rewrite.\n\n"
            "CHECK 2 - TONE\n"
            "   Flag any sentence that sounds salesy, desperate, or generic. "
            "The tone must be calm, confident, direct. "
            "For each flagged sentence: quote it, explain the problem, provide a rewrite.\n\n"
            "CHECK 3 - SCOPE ACCURACY\n"
            "   Do the service descriptions accurately reflect what was requested? "
            "Is anything overpromised, underdescribed, or missing? "
            "Flag any issues with a specific recommendation.\n\n"
            "CHECK 4 - PRICING LOGIC\n"
            "   Does the recommended pricing feel justified by the scope? "
            "Is the discount reasonable and explained? "
            "Does the ROI framing feel earned? "
            "Flag any issues with specific rewrites.\n\n"
            "Score each section 1-10. Rewrite any section scoring below 8.\n\n"
            "End with the final polished version of any rewritten sections, "
            "ready to be used in the proposal document."
        ),
        agent=proposal_critic,
        expected_output=(
            "4-check quality review with scores. Specific issues flagged with "
            "exact quotes, problem explanations, and full rewrites. "
            "Final polished versions of all rewritten sections."
        )
    )

    return [writing_task, pricing_task, critique_task]


# ASSEMBLE FINAL OUTPUT

def parse_crew_output(result, brief):
    """Extract structured content from crew output for the generator."""
    output = str(result)
    return {
        "raw_output": output,
        "client_name": brief.get('brand_name', brief.get('client_name', '')),
        "services_requested": brief.get('services', brief.get('services_requested', ''))
    }


# AGENT ALIASES (for run_crew.py compatibility)
scope_writer = proposal_writer


# CREW

def run_proposal_crew():
    print("\n" + "=" * 60)
    print("PROPOSAL CREW - ART PROTOCOL")
    print("=" * 60)
    print("Answer carefully. The better your answers, the better the proposal.\n")

    brief = {
        'brand_name':  input("1.  Client name: ").strip(),
        'what_it_is':  input("2.  What does the client do (2-3 sentences): ").strip(),
        'challenge':   input("3.  What is their main challenge right now: ").strip(),
        'goal':        input("4.  What do they want to achieve: ").strip(),
        'services':    input("5.  Which services are they interested in: ").strip(),
        'notes':       input("6.  Any other context (or press Enter to skip): ").strip(),
    }

    tasks = create_proposal_tasks(brief)

    crew = Crew(
        agents=[proposal_writer, pricing_strategist, proposal_critic],
        tasks=tasks,
        process=Process.sequential,
        max_rpm=3,
        verbose=True,
    )

    print("\n>> Proposal Crew starting for " + brief['brand_name'] + "...")
    print("3 agents running. Takes 3-5 minutes.\n")

    result = crew.kickoff()
    parsed = parse_crew_output(result, brief)

    filename = brief['brand_name'].replace(' ', '_') + "_proposal_brief.txt"
    with open(filename, "w", encoding="utf-8") as f:
        f.write("PROPOSAL BRIEF: " + brief['brand_name'].upper() + "\n")
        f.write("=" * 60 + "\n\n")
        f.write(parsed['raw_output'])

    print("\ndone: Proposal content saved to " + filename)
    print("\nNow running document generator...")

    try:
        subprocess.run(
            ["node", "generate_proposal.js"],
            cwd=os.path.dirname(os.path.abspath(__file__))
        )
    except FileNotFoundError:
        print("\n[WARNING] generate_proposal.js not found in the same folder.")
        print("Run it manually: node generate_proposal.js")

    return parsed


if __name__ == "__main__":
    run_proposal_crew()
