---
name: run-research
description: Run the 5-layer deep research pipeline for an Art Protocol client. Use when asked to run research, do research, start research, or research a client or brand. Triggers run_crew.py with crew=research. Workspace: C:\Users\thear\OneDrive\Desktop\aiagency
---

# Run Research

Trigger the 5-layer research pipeline for a client via `run_crew.py`.

## Pre-flight

Before running:
1. Confirm `clients/<ClientName>/` exists — if not, create it first (use new-client skill)
2. Read `clients/<ClientName>/brief.md` if it exists — pass its content as the brief
3. Inject any `.txt`/`.md` files from `knowledge/` as additional context in the brief notes

## Execution

```powershell
$client = "ClientName"
$workspace = "C:\Users\thear\OneDrive\Desktop\aiagency"
$python = "$workspace\venv311\Scripts\python.exe"
$brief = Get-Content "$workspace\clients\$client\brief.md" -Raw -ErrorAction SilentlyContinue

$briefJson = @{
    brand_name = $client
    what_it_is = ""
    category   = ""
    notes      = $brief
} | ConvertTo-Json -Compress

& $python "$workspace\run_crew.py" --client $client --crew research --brief-json $briefJson
```

## After Run

- Output saves to `clients/<ClientName>/research_<timestamp>.txt`
- Automatically trigger the **Code Reviewer Node** if any .py was modified
- Offer to run **Output QA Node** on the result
