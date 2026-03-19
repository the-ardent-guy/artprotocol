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
    base = os.getenv("AP_CLIENT_BASE", "")
    if base:
        folder = os.path.join(base, safe_name + "_Research")
    else:
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


# GOOGLE SEARCH via Serper.dev REST API

def google_search(query, num=5, retries=3):
    """Search using Serper.dev — fast, cheap, same Google results."""
    for attempt in range(retries):
        try:
            resp = requests.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": SERP_KEY, "Content-Type": "application/json"},
                json={"q": query, "num": num, "gl": "us", "hl": "en"},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            output = []
            for r in data.get("organic", []):
                output.append({
                    "title":   r.get("title", ""),
                    "snippet": r.get("snippet", ""),
                    "link":    r.get("link", ""),
                    "source":  r.get("displayedLink", r.get("link", "")),
                    "date":    r.get("date", ""),
                })
            paa = [p.get("question", "") for p in data.get("peopleAlsoAsk", [])]
            print(f"    [SEARCH] '{query[:60]}' → {len(output)} results")
            return output, paa
        except Exception as e:
            if attempt < retries - 1:
                print(f"    [RETRY] Search failed ({e}), retrying in 3s...")
                time.sleep(3)
            else:
                print(f"    [SKIP] Search failed after {retries} attempts: {e}")
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
    print('[STATUS] Mapping out your research strategy...', flush=True)
    print("\n  L1 - Query Understanding: building research plan...")

    location = brief.get('location', '') or 'the primary market'
    customer = brief.get('customer', '') or 'target customers'
    competitors = brief.get('competitors', '') or 'key competitors'
    problem = brief.get('problem_solved', '') or ''
    stage = brief.get('stage', 'new')

    # DNA enrichment context for L1 (if available from Brand DNA system)
    dna_context = ""
    brand_archetype = brief.get("brand_archetype", "")
    tone_axis       = brief.get("tone_axis", "")
    comp_keywords   = brief.get("competitor_keywords", "")
    if brand_archetype or tone_axis or comp_keywords:
        dna_context = "\nBRAND DNA (pre-defined):\n"
        if brand_archetype:
            dna_context += f"  Archetype: {brand_archetype}\n"
        if tone_axis:
            dna_context += f"  Tone axis: {tone_axis}\n"
        if comp_keywords:
            dna_context += f"  Competitor keywords to research: {comp_keywords}\n"
        dna_context += "\nIncorporate these Brand DNA fields into your research plan — validate, deepen, or challenge them.\n"

    prompt = (
        "I need to deeply research this brand before building its strategy.\n\n"
        "Brand: " + brief['brand_name'] + "\n"
        "What it is: " + brief['what_it_is'] + "\n"
        "Category: " + brief['category'] + "\n"
        "Location / Primary market: " + location + "\n"
        "Target customer: " + customer + "\n"
        "Problem solved: " + problem + "\n"
        "Known competitors: " + competitors + "\n"
        "Stage: " + stage + "\n"
        + dna_context + "\n"
        "Deliver a research plan in 4 parts:\n\n"
        "PART 1 - SUB-QUESTIONS (10 specific research questions)\n"
        "For each: question, why it matters for brand strategy, "
        "answer type (factual/comparative/causal/predictive/cultural)\n\n"
        "PART 2 - AMBIGUITY FLAGS\n"
        "What is unclear in this brief that affects research direction? "
        "List 3-5 ambiguities and the assumption you are making for each.\n\n"
        "PART 3 - RESEARCH SCOPE\n"
        "Primary markets to focus on. Time horizon (relevant years). "
        "Data types needed. What to explicitly exclude.\n\n"
        "PART 4 - SEARCH PLAN\n"
        "15 specific search queries tailored to this brand, category, and location. "
        "Do NOT use generic or India-specific queries unless the brand is India-based. "
        "For each query: the exact search string, source type to prioritize "
        "(industry report / news / social / review), "
        "and what a good result looks like.\n\n"
        "Format each query on its own line as: QUERY: [exact search string]"
    )

    result = ask_claude(
        prompt,
        system="You are a senior brand strategist and research director. "
               "You build precise research plans that uncover genuine strategic insight. "
               "Every query you write must be specific to this brand's actual context — "
               "never generic. Your search plan will drive the entire research pipeline.",
        model="claude-sonnet-4-6",
        max_tokens=3000
    )
    query_count = sum(1 for line in result.split('\n') if line.strip().upper().startswith('QUERY:'))
    print(f'[STATUS] Built {query_count} targeted search queries', flush=True)
    print("  done: Research plan built")
    return result


# LAYER 2: MULTI-MODAL RETRIEVAL
# Web search + full page fetch + follow-up branches from findings

def layer2_retrieval(brief, research_plan):
    print('[STATUS] Searching the web for market data...', flush=True)
    print("\n  L2 - Retrieval: web search + full page extraction + follow-up branches...")

    b = brief
    location = b.get('location', '') or 'global'
    customer = b.get('customer', '') or ''
    problem  = b.get('problem_solved', '') or ''
    comp_list = b.get('competitors', '').split(',')
    comp1 = comp_list[0].strip() if comp_list and comp_list[0].strip() else b['brand_name']

    # PRIMARY: Extract dynamic queries from L1 research plan
    # L1 formats each query as: QUERY: [exact search string]
    dynamic_queries = []
    for line in research_plan.split('\n'):
        line = line.strip()
        if line.upper().startswith("QUERY:"):
            q = line[6:].strip().strip('"').strip("'").strip('[').strip(']')
            if q and len(q) > 8:
                dynamic_queries.append(q)

    print(f"    [L1 queries extracted: {len(dynamic_queries)}]")

    # FALLBACK: location-aware base queries if L1 didn't produce enough
    fallback_queries = [
        (b['category'] + " market size " + location + " 2024 2025",                   "Market Size"),
        (b['category'] + " consumer behavior " + location,                             "Consumer Behavior"),
        (problem[:60] + " " + location + " unmet need consumer",                       "Problem Validation"),
        (comp1 + " brand strategy positioning " + location,                            "Competitor 1"),
        (b.get('competitors', '') + " " + b['category'] + " " + location,             "Competitor Landscape"),
        (b['brand_name'] + " " + location + " review customer feedback",               "Brand Perception"),
        (b['category'] + " culture " + location + " lifestyle habits",                 "Cultural Context"),
        (b['category'] + " industry report growth 2024 2025",                          "Industry Data"),
        (b['category'] + " brand case study success failure",                          "Case Studies"),
        (customer[:60] + " spending habits " + location + " 2024" if customer else
         b['category'] + " target audience " + location,                               "Customer Trends"),
        (b['category'] + " whitespace opportunity underserved " + location,            "Market Gaps"),
        (b['category'] + " pricing strategy premium " + location,                     "Pricing Intel"),
        (comp1 + " social media marketing strategy",                                   "Competitor Social"),
        (b['brand_name'] + " " + b['category'] + " positioning differentiation",      "Differentiation"),
        (b['category'] + " trends innovation 2025",                                    "Trends"),
    ]

    # Use dynamic queries if L1 gave us enough, else pad with fallbacks
    if len(dynamic_queries) >= 10:
        # Use all dynamic queries with generic labels
        base_queries = [(q, f"Research Query {i+1}") for i, q in enumerate(dynamic_queries[:15])]
        print("    Using L1 dynamic search plan")
    else:
        # Pad dynamic with fallbacks to reach 15
        combined = [(q, f"Research Query {i+1}") for i, q in enumerate(dynamic_queries)]
        needed = 15 - len(combined)
        combined += fallback_queries[:needed]
        base_queries = combined
        print(f"    Using {len(dynamic_queries)} L1 queries + {needed} fallbacks")

    all_findings = ""
    all_sources = []
    follow_up_triggers = []

    for query, label in base_queries:
        print(f'[STATUS] Scanning {label}...', flush=True)
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
                _domain = r['link'].split("/")[2] if "/" in r['link'] else r['link']
                print(f'[STATUS] Reading source: {_domain}...', flush=True)
                print("         Fetching: " + r['link'][:65] + "...")
                content = fetch_page(r['link'])
                all_findings += "Full Content:\n" + content + "\n"

                # Trigger follow-up on competitor mentions
                content_lower = content.lower()
                for comp in brief.get('competitors', '').split(','):
                    comp = comp.strip().lower()
                    if comp and len(comp) > 3 and comp in content_lower:
                        q = comp + " " + location + " brand strategy market 2024"
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

    print(f'[STATUS] Found {len(all_sources)} sources across {len(base_queries)} searches', flush=True)
    print("  done: Retrieval complete. Sources collected: " + str(len(all_sources)))
    return all_findings, all_sources


# LAYER 3: READING + EXTRACTION
# Claim extraction, credibility assessment, contradiction flagging

def layer3_extraction(brief, depth_findings):
    print('[STATUS] Extracting key claims from sources...', flush=True)
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

    extraction = ask_claude(claims_prompt, model="claude-haiku-4-5-20251001", max_tokens=2500)

    # Step 2: Identify and verify top claims
    verify_prompt = (
        "From this extraction, identify the 4 claims that are:\n"
        "1. Most strategically important for brand positioning\n"
        "2. Most likely to be inaccurate, outdated, or exaggerated\n\n"
        "Return just the 4 claims as a numbered list. Be specific.\n\n"
        + extraction[:2000]
    )

    top_claims_text = ask_claude(verify_prompt, model="claude-haiku-4-5-20251001", max_tokens=400)

    verification = ""
    print('[STATUS] Verifying top claims with secondary searches...', flush=True)
    _claim_lines = [l.strip() for l in top_claims_text.strip().split('\n')[:4] if l.strip() and len(l.strip()) >= 10]
    print(f'[STATUS] Cross-checking {len(_claim_lines)} critical claims', flush=True)
    print("    Verifying key claims with secondary searches...")
    for line in top_claims_text.strip().split('\n')[:4]:
        line = line.strip()
        if not line or len(line) < 10:
            continue
        # Strip numbering prefix
        if line and line[0].isdigit() and len(line) > 2:
            line = line[2:].strip()
        results, _ = google_search(
            "verify " + line[:80] + " " + brief['category'] + " " + brief.get('location', '') + " 2024",
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
    print('[STATUS] Running adversarial checks — what could go wrong?', flush=True)
    print("\n  L4 - Adversarial + Iterative Deepening...")

    # Adversarial searches — location-aware, no hardcoded geography
    loc = brief.get('location', '')
    adversarial_queries = [
        brief['category'] + " brand failures " + loc + " lessons learned",
        "problems " + brief['category'] + " " + loc + " consumer complaints negative",
        brief['category'] + " market risks challenges 2024 2025",
        "why consumers stop buying " + brief['category'] + " " + loc + " churn reasons",
        brief['brand_name'] + " negative review criticism problem",
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
    print('[STATUS] Identifying research gaps...', flush=True)
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
        print(f'[STATUS] Running {len(gap_queries[:3])} gap-filling searches', flush=True)
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
    print('[STATUS] Scoring research sufficiency...', flush=True)
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
    print('[STATUS] Synthesising findings into your report...', flush=True)
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

    # Smart truncation: distribute context budget across layers
    # Total ~16000 chars across all inputs to stay within model context
    depth_chunk     = depth_findings[:8000]
    extraction_chunk = extraction[:3000]
    adversarial_chunk = adversarial[:2500]
    plan_chunk      = research_plan[:1000]

    location = brief.get('location', 'the primary market')
    customer = brief.get('customer', 'target customers')
    problem  = brief.get('problem_solved', '')
    competitors = brief.get('competitors', '')
    stage    = brief.get('stage', 'new')

    brand_context = (
        "BRAND: " + brief['brand_name'] + " | " + brief['what_it_is'] + "\n"
        "CATEGORY: " + brief['category'] + "\n"
        "LOCATION: " + location + "\n"
        "CUSTOMER: " + customer + "\n"
        "PROBLEM SOLVED: " + problem + "\n"
        "KNOWN COMPETITORS: " + competitors + "\n"
        "STAGE: " + stage + "\n\n"
        "RESEARCH PLAN:\n" + plan_chunk + "\n\n"
        "DEPTH FINDINGS:\n" + depth_chunk + "\n\n"
        "CLAIMS AND EXTRACTION:\n" + extraction_chunk + "\n\n"
        "ADVERSARIAL AND GAPS:\n" + adversarial_chunk + "\n\n"
        "SOURCES:\n" + source_index
    )

    synthesis_prompt_1 = (
        "Write the FIRST HALF of the research report for " + brief['brand_name'] + ".\n\n"
        + brand_context + "\n\n"
        "Write each section fully. Use markdown formatting throughout. "
        "Never truncate a section. Complete every section before moving to the next.\n\n"
        "## EXECUTIVE SUMMARY\n"
        "5 sentences. High-confidence findings only. Specific numbers where available.\n\n"
        "### DATA SNAPSHOT\n"
        "5-8 key metrics, one per line: '- Label: Value' "
        "(e.g. '- Market Size: $4.2B', '- CAGR: 18%'). Use real numbers from sources only.\n\n"
        "## MARKET FINDINGS\n"
        "Size, growth, structure. Every claim tagged [ESTABLISHED], [EMERGING], or [SPECULATIVE] "
        "and sourced. Use a markdown table for market segments if relevant.\n\n"
        "## CONSUMER PSYCHOLOGY\n"
        "Real desires, fears, identity signals. Specific to " + location + " and " + customer + ". "
        "Not generic — every point must be traceable to this brand's actual audience. Bullet points.\n\n"
        "## CULTURAL CONTEXT\n"
        "Hyperlocal behaviors, rituals, cultural forces outsiders miss. "
        "Specific to " + location + ". Bullet points.\n\n"
        "## COMPETITIVE LANDSCAPE\n"
        "Who is winning, why, and the specific gap they are leaving open.\n"
        "Include a markdown table: | Competitor | Core Strength | Key Weakness | Gap Left Open |"
    )

    synthesis_prompt_2 = (
        "Write the SECOND HALF of the research report for " + brief['brand_name'] + ".\n\n"
        + brand_context + "\n\n"
        "Write each section fully. Use markdown formatting throughout. "
        "Never truncate a section. Complete every section before moving to the next.\n\n"
        "## DIFFERENTIATION OPPORTUNITY\n"
        "Based on the competitive landscape and consumer psychology: "
        "what is the one positioning territory that is genuinely unclaimed? "
        "What can " + brief['brand_name'] + " own that no competitor currently owns? "
        "Be specific — not 'be authentic' or 'focus on quality'. "
        "What exact narrative, audience insight, or cultural moment creates this opening?\n\n"
        "## BRAND BUILDING IMPLICATIONS\n"
        "5 specific findings from this research that the branding crew must know. "
        "These are the non-negotiables that should shape brand archetype, voice, and visual identity. "
        "For each: the finding, why it matters for branding, and what would go wrong if ignored.\n\n"
        "## CONTESTED TERRAIN\n"
        "Where sources disagree. Every contradiction surfaced. Tag claims [CONTESTED].\n\n"
        "## CONFIDENCE ASSESSMENT\n"
        "Two columns: HIGH confidence findings (multiple agreeing sources) vs "
        "LOW confidence (inferred or single source). Be honest about what we don't know.\n\n"
        "## RESEARCH GAPS\n"
        "What could not be verified online. What primary/field research would resolve this. "
        "Numbered list.\n\n"
        "## STRATEGIC IMPLICATIONS\n"
        "5 specific opportunities for " + brief['brand_name'] + ". "
        "For each, use this exact format:\n"
        "**Opportunity N: [Name]**\n"
        "- Finding: [specific data point or observation]\n"
        "- Implication: [what this means for the brand]\n"
        "- Recommendation: [concrete action]\n\n"
        "## VERIFIED SOURCES\n"
        "Full numbered list with credibility ratings [HIGH/MEDIUM/LOW]."
    )

    print('[STATUS] Writing market analysis...', flush=True)
    print("    Generating synthesis draft (part 1: Executive Summary → Competitive Landscape)...")
    draft_part1 = ask_claude(
        synthesis_prompt_1,
        system=synthesis_system,
        model="claude-sonnet-4-6",
        max_tokens=4000
    )

    print('[STATUS] Writing competitive landscape...', flush=True)
    print("    Generating synthesis draft (part 2: Differentiation → Verified Sources)...")
    draft_part2 = ask_claude(
        synthesis_prompt_2,
        system=synthesis_system,
        model="claude-sonnet-4-6",
        max_tokens=4000
    )

    draft_report = draft_part1 + "\n\n" + draft_part2

    # REFLECTION LOOP: self-review for gaps and unsupported claims
    print('[STATUS] Writing strategic implications...', flush=True)
    print('[STATUS] Running self-review for gaps...', flush=True)
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

    print('[STATUS] Report complete.', flush=True)
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


def run_headless_direct(brief: dict, client_name: str) -> str:
    """
    Run all 5 research layers directly from a brief dict — no input() calls.
    Saves output to clients/<client_name>/ and returns the final report string.
    """
    safe_name = brief.get("brand_name", client_name).replace(" ", "_")

    print(f"\n>> Starting deep research for {brief.get('brand_name', client_name)}...")
    print("5-layer pipeline. Saves after every layer.\n")

    import time as _time
    start_time = _time.time()
    checkpoint = {"completed_layers": [], "data": {}, "brief": brief}
    save_checkpoint(safe_name, checkpoint)

    all_sources = []
    final_report = ""
    source_index = ""

    try:
        # L1
        research_plan = layer1_query_understanding(brief)
        save_layer_output(safe_name, "layer1", research_plan, checkpoint)

        # L2
        depth_findings, sources2 = layer2_retrieval(brief, research_plan)
        all_sources += sources2
        save_layer_output(safe_name, "layer2", depth_findings, checkpoint)
        checkpoint["data"]["sources"] = sources2
        save_checkpoint(safe_name, checkpoint)

        # L3
        extraction = layer3_extraction(brief, depth_findings)
        save_layer_output(safe_name, "layer3", extraction, checkpoint)

        # L4
        adversarial, sources4 = layer4_adversarial(brief, depth_findings, extraction)
        all_sources += sources4
        save_layer_output(safe_name, "layer4", adversarial, checkpoint)

        # L5
        final_report, source_index = layer5_synthesis(
            brief, research_plan, depth_findings, extraction, adversarial, all_sources
        )
        save_layer_output(safe_name, "layer5", final_report, checkpoint)

    except Exception as e:
        print(f"\n[ERROR] Research failed: {e}")
        traceback.print_exc()
        final_report = checkpoint["data"].get("layer5", "")
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
                print(f"[RECOVERY FAILED] {e2}")
                final_report = f"Research failed. Partial data saved. Error: {e}"

    # Save final report
    folder = get_research_folder(safe_name)
    filename = os.path.join(folder, safe_name + "_research_report.txt")
    try:
        with open(filename, "w", encoding="utf-8") as f:
            f.write("DEEP RESEARCH REPORT: " + brief.get("brand_name", "").upper() + "\n")
            f.write("Category: " + brief.get("category", "") + " | Location: " + brief.get("location", "") + "\n")
            f.write("Generated: " + datetime.now().strftime("%Y-%m-%d %H:%M") + "\n")
            f.write("=" * 60 + "\n\n")
            f.write(final_report if final_report else "No report generated.")
            f.write("\n\n" + "=" * 60 + "\n")
            f.write("VERIFIED SOURCE INDEX\n" + "=" * 60 + "\n")
            f.write(source_index if isinstance(source_index, str) else "")
    except Exception as e:
        print(f"[ERROR] Could not save final report: {e}")

    # Copy to clients/<client_name>/
    clients_base = os.getenv("CLIENTS_DIR") or os.path.join(
        os.getenv("AP_CLIENT_BASE", "").rsplit(os.sep, 1)[0] if os.getenv("AP_CLIENT_BASE") else "",
        ""
    )
    # Resolve destination using AP_CLIENT_BASE if available
    ap_base = os.getenv("AP_CLIENT_BASE", "")
    if ap_base:
        dest_dir = ap_base
    else:
        dest_dir = os.path.join("clients", client_name)
    os.makedirs(dest_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    dest_file = os.path.join(dest_dir, f"research_{timestamp}.txt")
    try:
        import shutil
        shutil.copy2(filename, dest_file)
        print(f"\n[SAVED] Output -> {dest_file}", flush=True)
    except Exception as e:
        print(f"[WARNING] Could not copy to client folder: {e}")

    # Cleanup checkpoint
    if len(checkpoint["completed_layers"]) >= 5:
        try:
            os.remove(get_checkpoint_path(safe_name))
        except Exception:
            pass

    return final_report


def run_headless(client_name: str, brief_json: str):
    """
    Headless entrypoint for CLI / run_crew.py subprocess calls.
    Accepts a client name and a JSON brief string.
    Saves output to clients/<client_name>/ folder.
    """
    import argparse as _argparse

    try:
        brief = json.loads(brief_json)
    except json.JSONDecodeError as e:
        print(f"[ERROR] Invalid brief JSON: {e}", flush=True)
        sys.exit(1)

    # Fill in defaults from brief fields
    safe_name = brief.get("brand_name", client_name).replace(" ", "_")

    # Patch checkpoint to never ask resume question (always fresh in headless mode)
    def load_checkpoint_headless(name):
        return {"completed_layers": [], "data": {}, "brief": {}}

    # Override the module-level load_checkpoint for this run
    import research as _self
    _original_load = _self.load_checkpoint
    _self.load_checkpoint = load_checkpoint_headless

    # Override get_client_brief to return the passed brief
    _original_brief = _self.get_client_brief
    _self.get_client_brief = lambda: brief

    try:
        result = run()
    finally:
        _self.load_checkpoint = _original_load
        _self.get_client_brief = _original_brief

    # Copy final report to clients/<client_name>/ folder
    report_src = os.path.join(
        safe_name + "_Research",
        safe_name + "_research_report.txt"
    )
    if os.path.exists(report_src):
        dest_dir = os.path.join("clients", client_name)
        os.makedirs(dest_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M")
        dest_file = os.path.join(dest_dir, f"research_{timestamp}.txt")
        import shutil
        shutil.copy2(report_src, dest_file)
        print(f"\n[SAVED] Output -> {dest_file}", flush=True)

    return result


if __name__ == "__main__":
    import argparse as _ap
    _parser = _ap.ArgumentParser(description="Art Protocol Research Agent")
    _parser.add_argument("--client",     default=None, help="Client folder name")
    _parser.add_argument("--brief-json", default=None, help="Brief as JSON string")
    _args, _unknown = _parser.parse_known_args()

    if _args.client and _args.brief_json:
        run_headless(_args.client, _args.brief_json)
    else:
        run()