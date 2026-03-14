"""
research.py - Art Protocol Deep Research Agent
5-layer research pipeline:
  L1: Query understanding - decompose, type-detect, scope
  L2: Multi-modal retrieval - web, pages, follow-up branches
  L3: Reading + extraction - credibility, claims, contradictions
  L4: Adversarial + iterative deepening + sufficiency check
  L5: Synthesis + reflection loop - draft, gap-check, refine
"""

import anthropic
from serpapi import GoogleSearch
from dotenv import load_dotenv
import os
import sys
import json
import requests
import time
import traceback
from datetime import datetime
from bs4 import BeautifulSoup

load_dotenv()

# ENV VALIDATION
def validate_env():
    missing = []
    if not os.getenv("ANTHROPIC_API_KEY"):
        missing.append("ANTHROPIC_API_KEY")
    if not os.getenv("SERPER_API_KEY") and not os.getenv("SERP_API_KEY"):
        missing.append("SERPER_API_KEY (or SERP_API_KEY)")
    if missing:
        print("\n[ERROR] Missing required environment variables:")
        for key in missing:
            print("  - " + key + " not found in .env")
        print("\nAdd them to your .env file and try again.")
        sys.exit(1)

validate_env()

# Support both key names
SERP_KEY = os.getenv("SERPER_API_KEY") or os.getenv("SERP_API_KEY")
claude   = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


# FOLDER HELPER

def get_research_folder(safe_name):
    folder = safe_name + "_Research"
    os.makedirs(folder, exist_ok=True)
    return folder


# CHECKPOINT HELPERS

def get_checkpoint_path(safe_name):
    folder = get_research_folder(safe_name)
    return os.path.join(folder, safe_name + "_research_checkpoint.json")

def load_checkpoint(safe_name):
    path = get_checkpoint_path(safe_name)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            print("\n[CHECKPOINT FOUND] Previous research run detected.")
            print("  Completed layers: " + ", ".join(data.get("completed_layers", [])))
            resume = input("  Resume from checkpoint? (y/n): ").strip().lower()
            if resume == "y":
                return data
            print("  Starting fresh.")
        except Exception as e:
            print("[WARNING] Could not load checkpoint: " + str(e))
    return {"completed_layers": [], "data": {}, "brief": {}}

def save_checkpoint(safe_name, checkpoint):
    path = get_checkpoint_path(safe_name)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(checkpoint, f, indent=2)
    except Exception as e:
        print("[WARNING] Could not save checkpoint: " + str(e))

def save_layer_output(safe_name, layer_name, content, checkpoint):
    if not content:
        return
    folder = get_research_folder(safe_name)
    filename = os.path.join(folder, safe_name + "_layer_" + layer_name + ".txt")
    try:
        with open(filename, "w", encoding="utf-8") as f:
            f.write(content if isinstance(content, str) else json.dumps(content, indent=2))
        checkpoint["data"][layer_name] = content
        if layer_name not in checkpoint["completed_layers"]:
            checkpoint["completed_layers"].append(layer_name)
        save_checkpoint(safe_name, checkpoint)
        print("  [SAVED] " + filename)
    except Exception as e:
        print("[WARNING] Could not save layer " + layer_name + ": " + str(e))


# INTAKE

def get_client_brief():
    print("\n" + "=" * 60)
    print("CLIENT BRIEF INTAKE - ART PROTOCOL RESEARCH")
    print("=" * 60)
    print("Answer carefully. Research quality depends on this.\n")

    brief = {
        'brand_name':     input("1.  Brand name: ").strip(),
        'what_it_is':     input("2.  What is it exactly (one sentence): ").strip(),
        'category':       input("3.  Category: ").strip(),
        'subcategory':    input("4.  Subcategory / niche: ").strip(),
        'location':       input("5.  Primary location: ").strip(),
        'target_geo':     input("6.  Target geography: ").strip(),
        'customer':       input("7.  Who is the customer: ").strip(),
        'problem_solved': input("8.  What problem does this solve: ").strip(),
        'competitors':    input("9.  Three competitors (comma separated): ").strip(),
        'founder_belief': input("10. What does the founder believe that others do not: ").strip(),
        'stage':          input("11. Stage - new / existing / repositioning: ").strip(),
        'never_do':       input("12. What would this brand never do: ").strip(),
    }
    return brief


# GOOGLE SEARCH with retry

def google_search(query, num=5, retries=3):
    for attempt in range(retries):
        try:
            search = GoogleSearch({
                "q": query,
                "api_key": SERP_KEY,
                "num": num
            })
            results = search.get_dict()
            output = []
            for r in results.get("organic_results", []):
                output.append({
                    "title":   r.get("title", ""),
                    "snippet": r.get("snippet", ""),
                    "link":    r.get("link", ""),
                    "source":  r.get("displayed_link", ""),
                    "date":    r.get("date", ""),
                })
            paa = [p.get("question", "") for p in results.get("related_questions", [])]
            return output, paa
        except Exception as e:
            if attempt < retries - 1:
                print("    [RETRY] Search failed (" + str(e) + "), retrying in 3s...")
                time.sleep(3)
            else:
                print("    [SKIP] Search failed after " + str(retries) + " attempts: " + str(e))
                return [], []


# SOURCE CREDIBILITY ASSESSMENT

def assess_credibility(domain):
    high = [
        "reuters.com", "bloomberg.com", "ft.com", "wsj.com", "economist.com",
        "hbr.org", "mckinsey.com", "bcg.com", "statista.com", "ibisworld.com",
        "techcrunch.com", "forbes.com", "inc.com", "yourstory.com", "livemint.com",
        "economictimes.com", "moneycontrol.com", "business-standard.com",
        "entrackr.com", "inc42.com", "thehindubusinessline.com", "mintlounge.com",
        "mordorintelligence.com", "grandviewresearch.com", "marketsandmarkets.com"
    ]
    medium = [
        "reddit.com", "quora.com", "medium.com", "substack.com",
        "linkedin.com", "twitter.com", "instagram.com", "youtube.com"
    ]
    low = ["blogspot.com", "wordpress.com", "wix.com", "weebly.com"]

    for h in high:
        if h in domain:
            return "HIGH"
    for m in medium:
        if m in domain:
            return "MEDIUM"
    for l in low:
        if l in domain:
            return "LOW"
    return "MEDIUM"


# FETCH PAGE with credibility tagging

def fetch_page(url):
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        # Try to extract publish date
        date_meta = (
            soup.find("meta", {"property": "article:published_time"}) or
            soup.find("meta", {"name": "date"}) or
            soup.find("time")
        )
        pub_date = ""
        if date_meta:
            pub_date = (date_meta.get("content", "") or
                        date_meta.get("datetime", ""))[:10]

        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)

        domain = url.split("/")[2] if "/" in url else url
        credibility = assess_credibility(domain)

        prefix = ""
        if pub_date:
            prefix += "[Published: " + pub_date + "] "
        prefix += "[Credibility: " + credibility + "] [Domain: " + domain + "]\n"
        return prefix + text[:2500]

    except requests.exceptions.Timeout:
        return "[Timed out: " + url + "]"
    except requests.exceptions.HTTPError as e:
        return "[HTTP " + str(e) + "]"
    except Exception as e:
        return "[Fetch failed: " + str(e) + "]"


# CLAUDE HELPER

def ask_claude(prompt, system="You are a senior research analyst.", model="claude-haiku-4-5-20251001", max_tokens=1500):
    try:
        response = claude.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
    except Exception as e:
        print("  [ERROR] Claude call failed: " + str(e))
        return "Error: " + str(e)


# LAYER 1: QUERY UNDERSTANDING
# Decompose, type-detect, ambiguity, scope, search plan

def layer1_query_understanding(brief):
    print("\n  L1 - Query Understanding: building research plan...")

    prompt = (
        "I need to deeply research this brand before building its strategy.\n\n"
        "Brand: " + brief['brand_name'] + "\n"
        "What it is: " + brief['what_it_is'] + "\n"
        "Category: " + brief['category'] + " / " + brief['subcategory'] + "\n"
        "Location: " + brief['location'] + "\n"
        "Customer: " + brief['customer'] + "\n"
        "Problem solved: " + brief['problem_solved'] + "\n"
        "Competitors: " + brief['competitors'] + "\n"
        "Founder belief: " + brief['founder_belief'] + "\n\n"
        "Deliver a research plan in 4 parts:\n\n"
        "PART 1 - SUB-QUESTIONS (10 specific research questions)\n"
        "For each: question, why it matters, "
        "answer type (factual/comparative/causal/predictive/cultural)\n\n"
        "PART 2 - AMBIGUITY FLAGS\n"
        "What is unclear in this brief that affects research direction? "
        "List 3-5 ambiguities and the assumption being made for each.\n\n"
        "PART 3 - RESEARCH SCOPE\n"
        "Primary markets to focus on. Time horizon (relevant years). "
        "Data types needed. What to explicitly exclude.\n\n"
        "PART 4 - SEARCH PLAN\n"
        "15 specific search queries to run. "
        "For each: query string, source type to prioritize, what a good result looks like."
    )

    result = ask_claude(prompt, max_tokens=2000)
    print("  done: Research plan built")
    return result


# LAYER 2: MULTI-MODAL RETRIEVAL
# Web search + full page fetch + follow-up branches from findings

def layer2_retrieval(brief, research_plan):
    print("\n  L2 - Retrieval: web search + full page extraction + follow-up branches...")

    b = brief
    comp_list = b['competitors'].split(',')
    comp1 = comp_list[0].strip() if comp_list else b['competitors']

    base_queries = [
        (b['category'] + " " + b['subcategory'] + " market size India 2024 2025", "Market Size"),
        (b['category'] + " consumer behavior " + b['location'] + " Gen Z millennials", "Consumer Behavior"),
        (b['problem_solved'] + " India unmet need pain point consumer", "Problem Validation"),
        (comp1 + " brand positioning marketing strategy India", "Competitor 1"),
        (b['competitors'] + " " + b['category'] + " India market comparison", "Competitor Landscape"),
        (b['brand_name'] + " India review feedback customer", "Brand Perception"),
        (b['category'] + " culture " + b['location'] + " lifestyle habits", "Cultural Context"),
        (b['category'] + " India industry report growth CAGR 2025", "Industry Data"),
        (b['category'] + " D2C brand India success failure case study", "Case Studies"),
        (b['customer'] + " spending habits food lifestyle India 2025", "Customer Trends"),
        (b['category'] + " whitespace opportunity India underserved segment", "Market Gaps"),
        (b['category'] + " packaging design trend India Gen Z", "Design Trends"),
        (comp1 + " Instagram social media strategy content India", "Competitor Social"),
        (b['brand_name'] + " " + b['category'] + " UK diaspora international market", "International Market"),
        (b['category'] + " pricing strategy India premium affordable segment", "Pricing Intel"),
    ]

    all_findings = ""
    all_sources = []
    follow_up_triggers = []

    for query, label in base_queries:
        print("    >> " + label + "...")
        results, paa = google_search(query, num=5)

        all_findings += "\n" + "=" * 50 + "\n"
        all_findings += "RESEARCH AREA: " + label + "\n"
        all_findings += "Query: " + query + "\n"
        all_findings += "=" * 50 + "\n\n"

        if not results:
            all_findings += "[No results]\n\n"
            continue

        for i, r in enumerate(results[:4]):
            all_findings += "SOURCE: " + r['title'] + "\n"
            all_findings += "URL: " + r['link'] + "\n"
            if r.get('date'):
                all_findings += "Date: " + r['date'] + "\n"
            all_findings += "Summary: " + r['snippet'] + "\n"

            # Fetch full content for top 2 results per query
            if i < 2:
                print("         Fetching: " + r['link'][:65] + "...")
                content = fetch_page(r['link'])
                all_findings += "Full Content:\n" + content + "\n"

                # Trigger follow-up on competitor mentions
                content_lower = content.lower()
                for comp in brief['competitors'].split(','):
                    comp = comp.strip().lower()
                    if comp and len(comp) > 3 and comp in content_lower:
                        q = comp + " India market strategy brand 2024"
                        if q not in follow_up_triggers:
                            follow_up_triggers.append(q)

            all_findings += "\n"
            all_sources.append(r)

        if paa:
            all_findings += "PEOPLE ALSO ASK:\n"
            for q in paa[:4]:
                all_findings += "  - " + q + "\n"

        all_findings += "\n"
        time.sleep(1)

    # FOLLOW-UP BRANCH: queries spawned by what was found
    unique_followups = list(dict.fromkeys(follow_up_triggers))[:4]
    if unique_followups:
        print("\n    [FOLLOW-UP] " + str(len(unique_followups)) + " branch queries spawned from findings...")
        for q in unique_followups:
            print("    >> Follow-up: " + q[:55] + "...")
            results, _ = google_search(q, num=3)
            all_findings += "\n[FOLLOW-UP BRANCH]\nQuery: " + q + "\n"
            for r in results[:2]:
                all_findings += "  " + r['title'] + ": " + r['snippet'] + "\n"
                all_findings += "  URL: " + r['link'] + "\n"
                all_sources.append(r)
            time.sleep(1)

    print("  done: Retrieval complete. Sources collected: " + str(len(all_sources)))
    return all_findings, all_sources


# LAYER 3: READING + EXTRACTION
# Claim extraction, credibility assessment, contradiction flagging

def layer3_extraction(brief, depth_findings):
    print("\n  L3 - Extraction: claims, credibility, contradictions...")

    # Step 1: Extract structured claims
    claims_prompt = (
        "From this research data, extract all important factual claims.\n\n"
        "For each claim:\n"
        "- The specific claim (with numbers/dates where present)\n"
        "- Source URL\n"
        "- Credibility: HIGH (established publication) / MEDIUM / LOW (blog/opinion)\n"
        "- Recency: year if visible, else 'unknown'\n"
        "- Type: MARKET DATA / CONSUMER INSIGHT / COMPETITIVE INTEL / "
        "CULTURAL OBSERVATION / RISK FACTOR\n\n"
        "Then separately list:\n"
        "CONTRADICTIONS: where two sources say conflicting things "
        "(state both sides and the URLs)\n"
        "UNVERIFIED: important claims with no clear primary source\n"
        "PRIMARY SOURCES FOUND: list any government data, industry reports, "
        "or academic sources (these are most trustworthy)\n\n"
        "Research data:\n" + depth_findings[:5000]
    )

    extraction = ask_claude(claims_prompt, max_tokens=2500)

    # Step 2: Identify and verify top claims
    verify_prompt = (
        "From this extraction, identify the 4 claims that are:\n"
        "1. Most strategically important for brand positioning\n"
        "2. Most likely to be inaccurate, outdated, or exaggerated\n\n"
        "Return just the 4 claims as a numbered list. Be specific.\n\n"
        + extraction[:2000]
    )

    top_claims_text = ask_claude(verify_prompt, max_tokens=400)

    verification = ""
    print("    Verifying key claims with secondary searches...")
    for line in top_claims_text.strip().split('\n')[:4]:
        line = line.strip()
        if not line or len(line) < 10:
            continue
        # Strip numbering prefix
        if line and line[0].isdigit() and len(line) > 2:
            line = line[2:].strip()
        results, _ = google_search(
            "verify " + line[:80] + " " + brief['category'] + " India 2024",
            num=3
        )
        verification += "\nCLAIM: " + line + "\n"
        for r in results[:2]:
            domain = r['link'].split("/")[2] if "/" in r['link'] else r['link']
            credibility = assess_credibility(domain)
            verification += "  [" + credibility + "] " + r['title'] + "\n"
            verification += "  " + r['snippet'] + "\n"
            verification += "  URL: " + r['link'] + "\n"
        time.sleep(1)

    print("  done: Extraction and verification complete")
    return extraction + "\n\n=== CLAIM VERIFICATION ===\n" + verification


# LAYER 4: ADVERSARIAL + ITERATIVE DEEPENING + SUFFICIENCY CHECK

def layer4_adversarial(brief, depth_findings, extraction):
    print("\n  L4 - Adversarial + Iterative Deepening...")

    # Adversarial searches
    adversarial_queries = [
        brief['category'] + " brand failures India lessons learned",
        "problems " + brief['category'] + " " + brief['location'] + " consumer complaints negative",
        brief['category'] + " market risks challenges India 2025",
        "why consumers stop buying " + brief['category'] + " India churn reasons",
        brief['brand_name'] + " negative review criticism problem India",
    ]

    adversarial_findings = ""
    adv_sources = []

    print("    Running adversarial searches...")
    for q in adversarial_queries:
        print("    [RISK] " + q[:55] + "...")
        results, _ = google_search(q, num=3)
        adversarial_findings += "\nQUERY: " + q + "\n"
        if not results:
            adversarial_findings += "  [No results]\n"
            continue
        for r in results[:2]:
            adversarial_findings += "  " + r['title'] + ": " + r['snippet'] + "\n"
            adversarial_findings += "  URL: " + r['link'] + "\n"
            adv_sources.append(r)
        time.sleep(1)

    # ITERATIVE DEEPENING: ask Claude what is still missing, spawn searches
    print("    Identifying research gaps for deepening...")
    gap_prompt = (
        "Review this research for " + brief['brand_name'] + " and identify "
        "the 3 most critical unanswered questions that would most affect brand strategy.\n\n"
        "For each: state the question and suggest one specific 4-6 word search query.\n"
        "Format each suggestion as: SEARCH: [query here]\n\n"
        "Research volume: " + str(len(depth_findings)) + " chars collected.\n"
        "Key findings so far:\n" + extraction[:1500]
    )

    gaps = ask_claude(gap_prompt, max_tokens=500)

    # Extract SEARCH: lines and run them
    gap_findings = ""
    gap_queries = []
    for line in gaps.split('\n'):
        line = line.strip()
        if line.upper().startswith("SEARCH:"):
            q = line[7:].strip().strip('"').strip("'")
            if q and len(q) > 5:
                gap_queries.append(q)

    if gap_queries:
        print("    Running " + str(len(gap_queries[:3])) + " gap-filling searches...")
        for q in gap_queries[:3]:
            print("    [GAP] " + q[:55] + "...")
            results, _ = google_search(q, num=3)
            gap_findings += "\nGAP QUERY: " + q + "\n"
            for r in results[:2]:
                gap_findings += "  " + r['title'] + ": " + r['snippet'] + "\n"
                gap_findings += "  URL: " + r['link'] + "\n"
            time.sleep(1)

    # SUFFICIENCY CHECK
    print("    Running sufficiency check...")
    sufficiency_prompt = (
        "Score the research sufficiency for " + brief['brand_name'] + " on 5 dimensions (1-10):\n\n"
        "1. Market size and growth data\n"
        "2. Consumer psychology and behavior\n"
        "3. Competitive landscape clarity\n"
        "4. Cultural context depth\n"
        "5. Risk and failure modes\n\n"
        "For any score below 7: state exactly what is missing.\n"
        "End with: OVERALL SUFFICIENCY: SUFFICIENT / PARTIAL / INSUFFICIENT\n\n"
        "Data collected: " + str(len(depth_findings)) + " chars raw research.\n"
        "Adversarial: " + str(len(adversarial_findings)) + " chars.\n"
        "Claims extracted: " + extraction[:300]
    )

    sufficiency = ask_claude(sufficiency_prompt, max_tokens=500)

    print("  done: Adversarial + deepening complete")
    combined = (
        "=== ADVERSARIAL FINDINGS ===\n" + adversarial_findings +
        "\n\n=== RESEARCH GAPS ===\n" + gaps +
        "\n\n=== GAP-FILLING FINDINGS ===\n" + (gap_findings or "[No additional queries run]") +
        "\n\n=== SUFFICIENCY ASSESSMENT ===\n" + sufficiency
    )
    return combined, adv_sources


# LAYER 5: SYNTHESIS + REFLECTION LOOP
# Draft report, self-review for gaps, refine

def layer5_synthesis(brief, research_plan, depth_findings, extraction, adversarial, all_sources):
    print("\n  L5 - Synthesis + Reflection Loop...")

    # Build source index with credibility ratings
    source_index = ""
    seen_urls = set()
    source_num = 1
    for s in all_sources:
        url = s.get('link', '')
        if url and url not in seen_urls:
            domain = url.split("/")[2] if "/" in url else url
            credibility = assess_credibility(domain)
            source_index += (
                "[" + str(source_num) + "] " + s.get('title', '') +
                " [" + credibility + "]\n    " + url + "\n"
            )
            seen_urls.add(url)
            source_num += 1

    synthesis_system = (
        "You are a senior research analyst completing a deep research project for a brand strategist.\n\n"
        "Rules:\n"
        "- Every factual claim must reference a source by URL or [number]\n"
        "- Tag every claim: [ESTABLISHED] [CONTESTED] [EMERGING] [SPECULATIVE]\n"
        "- Confidence: HIGH (multiple agreeing sources) / MEDIUM (single source) / LOW (inferred)\n"
        "- Surface contradictions explicitly. Never hide conflicts between sources.\n"
        "- Show reasoning chain for strategic implications: finding -> implication -> recommendation\n"
        "- Generic observations are a failure state. Be specific to this brand and location.\n"
        "- Every insight must be actionable for a brand strategist."
    )

    synthesis_prompt = (
        "Write the complete research report for " + brief['brand_name'] + ".\n\n"
        "BRAND: " + brief['brand_name'] + " | " + brief['what_it_is'] + "\n"
        "CATEGORY: " + brief['category'] + " / " + brief['subcategory'] + "\n"
        "LOCATION: " + brief['location'] + " | CUSTOMER: " + brief['customer'] + "\n"
        "PROBLEM: " + brief['problem_solved'] + "\n"
        "COMPETITORS: " + brief['competitors'] + "\n"
        "STAGE: " + brief['stage'] + "\n\n"
        "RESEARCH PLAN:\n" + research_plan[:800] + "\n\n"
        "DEPTH FINDINGS:\n" + depth_findings[:6000] + "\n\n"
        "CLAIMS AND EXTRACTION:\n" + extraction[:2500] + "\n\n"
        "ADVERSARIAL AND GAPS:\n" + adversarial[:2000] + "\n\n"
        "SOURCES:\n" + source_index + "\n\n"
        "Write each section fully. Use markdown formatting throughout.\n\n"
        "## EXECUTIVE SUMMARY\n"
        "5 sentences. High-confidence findings only. Specific numbers where available.\n\n"
        "### DATA SNAPSHOT\n"
        "List 5-8 key metrics, one per line, in format '- Label: Value' (e.g. '- Market Size: $4.2B', '- CAGR: 18%', '- Digital Share: 62%'). Use real numbers from sources.\n\n"
        "## MARKET FINDINGS\n"
        "Size, growth, structure. Every claim tagged [ESTABLISHED], [EMERGING], or [SPECULATIVE] and sourced. Use a markdown table for market segments if relevant.\n\n"
        "## CONSUMER PSYCHOLOGY\n"
        "Real desires, fears, tribal signals. Specific to " + brief['location']
        + " and " + brief['customer'] + ". Not generic. Use bullet points.\n\n"
        "## CULTURAL CONTEXT\n"
        "Hyperlocal behaviors, rituals, forces outsiders miss. Use bullet points.\n\n"
        "## COMPETITIVE LANDSCAPE\n"
        "Who is winning, why, and the specific gap they are leaving open.\n"
        "Include a markdown table: | Competitor | Strength | Weakness | Gap Left Open |\n\n"
        "## CONTESTED TERRAIN\n"
        "Where sources disagree. Every contradiction surfaced. Tag claims [CONTESTED].\n\n"
        "## CONFIDENCE ASSESSMENT\n"
        "Two columns: HIGH confidence findings vs LOW confidence. What we know vs what we inferred.\n\n"
        "## RESEARCH GAPS\n"
        "What could not be verified. What field research would resolve. Numbered list.\n\n"
        "## STRATEGIC IMPLICATIONS\n"
        "5 specific opportunities. For each, use this exact format:\n"
        "**Opportunity N: [Name]**\n"
        "- Finding: ...\n"
        "- Implication: ...\n"
        "- Recommendation: ...\n\n"
        "## SUGGESTED FOLLOW-UP QUESTIONS\n"
        "5 questions a senior strategist would probe next. Numbered list.\n\n"
        "## VERIFIED SOURCES\n"
        "Full numbered list with credibility ratings [HIGH/MEDIUM/LOW]."
    )

    print("    Generating synthesis draft...")
    draft_report = ask_claude(
        synthesis_prompt,
        system=synthesis_system,
        model="claude-sonnet-4-6",
        max_tokens=7000
    )

    # REFLECTION LOOP: self-review for gaps and unsupported claims
    print("    Running reflection loop...")
    reflection_prompt = (
        "You wrote a research report for " + brief['brand_name'] + ". "
        "Re-read your draft and find:\n\n"
        "1. UNSUPPORTED CLAIMS - important claims made without a source citation\n"
        "2. THIN SECTIONS - any section that lacks depth or specificity\n"
        "3. MISSED SUB-QUESTIONS - research questions from the plan not addressed\n"
        "4. SURFACED CONTRADICTIONS - conflicts in the data that were not mentioned\n"
        "5. GENERIC STATEMENTS - observations that could apply to any brand in this category\n\n"
        "For each issue: state the problem precisely and write the specific fix.\n\n"
        "Draft (first 4000 chars):\n" + draft_report[:4000]
    )

    reflection = ask_claude(
        reflection_prompt,
        model="claude-sonnet-4-6",
        max_tokens=2000
    )

    final_report = (
        draft_report +
        "\n\n" + "=" * 60 + "\n"
        "## REFLECTION REVIEW\n"
        "(Self-assessment: gaps, unsupported claims, corrections)\n"
        "=" * 60 + "\n\n" +
        reflection
    )

    print("  done: Synthesis and reflection complete")
    return final_report, source_index


# MAIN

def run():
    brief = get_client_brief()
    safe_name = brief['brand_name'].replace(' ', '_')

    print("\n>> Starting deep research for " + brief['brand_name'] + "...")
    print("5-layer pipeline. Saves after every layer. Resumes if interrupted.\n")

    start_time = time.time()
    checkpoint = load_checkpoint(safe_name)

    # Save brief immediately
    if not checkpoint.get("brief"):
        checkpoint["brief"] = brief
        save_checkpoint(safe_name, checkpoint)

    all_sources = []
    final_report = ""
    source_index = ""

    try:
        # L1: Query Understanding
        if "layer1" not in checkpoint["completed_layers"]:
            research_plan = layer1_query_understanding(brief)
            save_layer_output(safe_name, "layer1", research_plan, checkpoint)
        else:
            research_plan = checkpoint["data"].get("layer1", "")
            print("  [SKIP] Layer 1 loaded from checkpoint")

        # L2: Retrieval
        if "layer2" not in checkpoint["completed_layers"]:
            depth_findings, sources2 = layer2_retrieval(brief, research_plan)
            all_sources += sources2
            save_layer_output(safe_name, "layer2", depth_findings, checkpoint)
            checkpoint["data"]["sources"] = sources2
            save_checkpoint(safe_name, checkpoint)
        else:
            depth_findings = checkpoint["data"].get("layer2", "")
            all_sources += checkpoint["data"].get("sources", [])
            print("  [SKIP] Layer 2 loaded from checkpoint")

        # L3: Extraction
        if "layer3" not in checkpoint["completed_layers"]:
            extraction = layer3_extraction(brief, depth_findings)
            save_layer_output(safe_name, "layer3", extraction, checkpoint)
        else:
            extraction = checkpoint["data"].get("layer3", "")
            print("  [SKIP] Layer 3 loaded from checkpoint")

        # L4: Adversarial + Deepening
        if "layer4" not in checkpoint["completed_layers"]:
            adversarial, sources4 = layer4_adversarial(brief, depth_findings, extraction)
            all_sources += sources4
            save_layer_output(safe_name, "layer4", adversarial, checkpoint)
        else:
            adversarial = checkpoint["data"].get("layer4", "")
            print("  [SKIP] Layer 4 loaded from checkpoint")

        # L5: Synthesis + Reflection
        if "layer5" not in checkpoint["completed_layers"]:
            final_report, source_index = layer5_synthesis(
                brief, research_plan, depth_findings,
                extraction, adversarial, all_sources
            )
            save_layer_output(safe_name, "layer5", final_report, checkpoint)
        else:
            final_report = checkpoint["data"].get("layer5", "")
            source_index = ""
            print("  [SKIP] Layer 5 loaded from checkpoint")

    except KeyboardInterrupt:
        print("\n\n[INTERRUPTED] Progress saved. Re-run to resume.")
        final_report = checkpoint["data"].get("layer5",
            "Run interrupted. Layers completed: " +
            ", ".join(checkpoint["completed_layers"]) +
            "\nRe-run to resume."
        )

    except Exception as e:
        print("\n[ERROR] Research failed: " + str(e))
        traceback.print_exc()
        final_report = checkpoint["data"].get("layer5", "")

        # Emergency synthesis if we have at least L2 data
        if not final_report and "layer2" in checkpoint["completed_layers"]:
            print("\n[RECOVERY] Emergency synthesis from completed layers...")
            try:
                final_report, source_index = layer5_synthesis(
                    brief,
                    checkpoint["data"].get("layer1", ""),
                    checkpoint["data"].get("layer2", ""),
                    checkpoint["data"].get("layer3", "No extraction completed"),
                    checkpoint["data"].get("layer4", "No adversarial completed"),
                    all_sources
                )
                save_layer_output(safe_name, "layer5", final_report, checkpoint)
            except Exception as e2:
                print("[RECOVERY FAILED] " + str(e2))
                final_report = "Research failed. Partial data saved. Error: " + str(e)

    finally:
        folder = get_research_folder(safe_name)
        filename = os.path.join(folder, safe_name + "_research_report.txt")
        try:
            with open(filename, "w", encoding="utf-8") as f:
                f.write("DEEP RESEARCH REPORT: " + brief['brand_name'].upper() + "\n")
                f.write("Category: " + brief['category'] + " | Location: " + brief['location'] + "\n")
                f.write("Generated: " + datetime.now().strftime('%Y-%m-%d %H:%M') + "\n")
                f.write("=" * 60 + "\n\n")
                f.write(final_report if final_report else "No report generated.")
                f.write("\n\n" + "=" * 60 + "\n")
                f.write("VERIFIED SOURCE INDEX\n")
                f.write("=" * 60 + "\n")
                f.write(source_index if isinstance(source_index, str) else "")

            elapsed = int(time.time() - start_time)
            print("\n" + "=" * 60)
            print("RESEARCH COMPLETE")
            print("=" * 60)
            print("Output folder:   " + folder + "/")
            print("Report saved:    " + filename)
            print("Sources found:   " + str(len(all_sources)))
            print("Layers complete: " + str(len(checkpoint["completed_layers"])) + " / 5")
            print("Time elapsed:    " + str(elapsed // 60) + "m " + str(elapsed % 60) + "s")
            print("=" * 60)
            print("\nReport preview:")
            print("-" * 40)
            preview = final_report[:1500] if final_report else "No preview."
            print(preview)
            print("\n[Full report -> " + filename + "]")

        except Exception as e:
            print("[ERROR] Could not save final report: " + str(e))

        if len(checkpoint["completed_layers"]) >= 5:
            try:
                os.remove(get_checkpoint_path(safe_name))
                print("[OK] Checkpoint cleaned up.")
            except Exception:
                pass

    return final_report


if __name__ == "__main__":
    run()