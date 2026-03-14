import anthropic
from dotenv import load_dotenv
import os

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

#  INPUT 
brand_name = input("Brand name: ")
category   = input("Category/niche: ")
location   = input("Location/market: ")
competitors = input("3 competitors (comma separated): ")
founder_belief = input("What does the founder believe that others don't: ")

print("\n Pass 1 - Category & Market Analysis...\n")

#  PASS 1 - CATEGORY AUTOPSY 
pass1 = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=2000,
    system="""You are a senior market analyst. You dissect categories 
ruthlessly. You find what everyone assumes, what nobody questions, 
and where the white space is. You are specific, not generic.""",
    messages=[
        {
            "role": "user",
            "content": f"""Analyze this category and market:

Brand: {brand_name}
Category: {category}
Location: {location}
Competitors: {competitors}

Deliver:
1. DOMINANT CATEGORY CODES - what does every brand in this space do visually, verbally, behaviorally?
2. THE 3 BIGGEST UNQUESTIONED ASSUMPTIONS in this category
3. COMPETITIVE WHITESPACE - what position is completely empty?
4. CATEGORY CLICHS - what's overused and dead?
5. ORIGIN - when and why did this category come into cultural existence?

Be specific. No generic observations."""
        }
    ]
)

pass1_output = pass1.content[0].text
print("done: Pass 1 complete\n")
print(pass1_output)
print("\n" + "="*50 + "\n")

#  PASS 2 - CONSUMER PSYCHOLOGY 
print(" Pass 2 - Consumer Psychology...\n")

pass2 = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=2000,
    system="""You are a consumer psychologist and behavioral economist. 
You go beneath what people say to what they actually feel. 
You understand desire, fear, identity, and tribal signaling.""",
    messages=[
        {
            "role": "user",
            "content": f"""Using this category analysis:

{pass1_output}

Now go deeper into the psychology of the {category} consumer in {location}:

1. STATED DESIRE - what they say they want
2. REAL DESIRE - the underlying psychological need
3. SECRET FEAR - what they're afraid of if they don't buy or buy wrong
4. TRIBAL IDENTITY SIGNAL - what does choosing this brand say about who you are?
5. EMOTIONAL JOURNEY - what does the customer feel at awareness, consideration, purchase, post-purchase?
6. COGNITIVE BIASES most active in this category's purchase behavior

Be specific to {location} culture and context. Not generic psychology."""
        }
    ]
)

pass2_output = pass2.content[0].text
print("done: Pass 2 complete\n")
print(pass2_output)
print("\n" + "="*50 + "\n")

#  PASS 3 - CULTURAL EXCAVATION 
print(" Pass 3 - Cultural & Historical Analysis...\n")

pass3 = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=2000,
    system="""You are a cultural historian and semiotician. You understand 
how products carry cultural meaning, class codes, generational identity, 
and historical weight. You make connections across pop culture, history, 
subcultures, and philosophy that others miss.""",
    messages=[
        {
            "role": "user",
            "content": f"""Using everything gathered so far:

CATEGORY ANALYSIS:
{pass1_output}

CONSUMER PSYCHOLOGY:
{pass2_output}

Now excavate the cultural layer for {brand_name} in {location}:

1. CULTURAL HISTORY - what movements, eras, shifts gave this category meaning?
2. SUBCULTURES - who adopted this early and what does that signal?
3. POP CULTURE MOMENTS - films, music, figures that shaped perception
4. LOCAL CULTURAL FORCES - hyperlocal behaviors, rituals, attitudes specific to {location}
5. CROSS-DOMAIN ANALOGY - name 2 brands or movements in completely different industries with structural similarities to this brand's challenge. Explain the parallel precisely.
6. THE SILENCE - what is nobody in this category talking about that consumers clearly care about?"""
        }
    ]
)

pass3_output = pass3.content[0].text
print("done: Pass 3 complete\n")
print(pass3_output)
print("\n" + "="*50 + "\n")

#  PASS 4 - BRAND STRATEGY SYNTHESIS 
print(" Pass 4 - Brand Strategy Synthesis...\n")

pass4 = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=3000,
    system="""You are a senior brand strategist. You synthesize research 
into actionable brand strategy. Every recommendation must be traceable 
to a real insight from the research. Nothing decorative. Nothing assumed.
Specificity is your standard.""",
    messages=[
        {
            "role": "user",
            "content": f"""You have completed deep research on {brand_name}.

CATEGORY ANALYSIS:
{pass1_output}

CONSUMER PSYCHOLOGY:
{pass2_output}

CULTURAL ANALYSIS:
{pass3_output}

FOUNDER'S BELIEF: {founder_belief}

Now synthesize everything into a full brand strategy:

1. BRAND POSITIONING STATEMENT
   Single sentence. Who it's for, what it does, why different, what it stands for.

2. BRAND TRUTH
   The one thing this brand believes that most in its category don't.

3. TARGET AUDIENCE - REAL PROFILE
   Psychographic portrait. Not demographics.
   How they think, what they're moving away from, what they're moving toward.

4. BRAND PERSONALITY
   3 traits with shadow sides (what it is NOT even though adjacent).

5. TONE OF VOICE
   How it speaks to: new customer / loyal customer / about its product

6. MESSAGING ARCHITECTURE
   - Hero message (the one thing)
   - 3 supporting pillars
   - Words the brand owns
   - Words the brand never uses

7. COMPETITIVE DIFFERENTIATION
   How is this brand different from {competitors} - not in features but in worldview?

8. THE BIGGEST RISK
   What could go wrong with this positioning?"""
        }
    ]
)

pass4_output = pass4.content[0].text
print("done: Pass 4 complete\n")
print(pass4_output)
print("\n" + "="*50 + "\n")

#  SAVE FULL REPORT 
print(" Saving full report...\n")

output_filename = f"{brand_name.replace(' ', '_')}_brand_strategy.txt"
with open(output_filename, 'w', encoding='utf-8') as f:
    f.write(f"BRAND STRATEGY REPORT: {brand_name.upper()}\n")
    f.write(f"Category: {category} | Market: {location}\n")
    f.write("="*60 + "\n\n")
    
    f.write("PASS 1 - CATEGORY & MARKET ANALYSIS\n")
    f.write("-"*40 + "\n")
    f.write(pass1_output + "\n\n")
    
    f.write("PASS 2 - CONSUMER PSYCHOLOGY\n")
    f.write("-"*40 + "\n")
    f.write(pass2_output + "\n\n")
    
    f.write("PASS 3 - CULTURAL EXCAVATION\n")
    f.write("-"*40 + "\n")
    f.write(pass3_output + "\n\n")
    
    f.write("PASS 4 - BRAND STRATEGY\n")
    f.write("-"*40 + "\n")
    f.write(pass4_output + "\n\n")

print(f"done: Full report saved to {output_filename}")
print(f"\n>> Brand strategy for {brand_name} complete.")