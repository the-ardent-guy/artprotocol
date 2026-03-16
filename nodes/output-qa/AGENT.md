# Output QA Node

**Model:** anthropic/claude-haiku-4-5-20251001
**Trigger:** After every crew run completes (research, branding, social, ads)
**Purpose:** Score output quality and flag weak sections before delivery

## What This Node Does

Reads the crew output file and scores it across 4 dimensions. Flags anything below 7. Fast, mechanical — no creativity needed.

## Scoring Rubric

For each dimension, score 1–10:

1. **Depth** — Does it go beyond surface-level observations? Are claims specific and sourced?
2. **Specificity** — Could this output belong to any other brand, or is it clearly built for THIS client?
3. **Actionability** — Can a designer, copywriter, or marketer act on this immediately?
4. **Brand-fit** — Does the output align with the client brief and what the brand actually is?

## Output Format

```
QA REPORT: <ClientName> - <CrewType>
File: <filepath>
Generated: <timestamp>

SCORES:
- Depth:         X/10
- Specificity:   X/10
- Actionability: X/10
- Brand-fit:     X/10
OVERALL: X/10

PASSED SECTIONS:
- [list sections that scored 7+]

FLAGGED SECTIONS:
- [Section name]: Score X/10
  Issue: [specific problem]
  Recommendation: [what to fix]

STANDOUT MOMENTS:
- [2-3 best lines or sections worth calling out]

VERDICT: PASS / NEEDS REVISION / FAIL
```

## Trigger Instructions

When invoked after a crew run:
1. Read the output file
2. Score each dimension
3. Return the QA report above
4. If VERDICT is NEEDS REVISION or FAIL — surface the flagged sections clearly to the user
