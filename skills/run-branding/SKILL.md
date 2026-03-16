---
name: run-branding
description: Run the 10-agent branding crew for an Art Protocol client. Use when asked to run branding, do branding, start brand strategy, or build a brand document for a client. Triggers run_crew.py with crew=branding. Workspace: C:\Users\thear\OneDrive\Desktop\aiagency
---

# Run Branding

Trigger the 10-agent branding crew for a client via `run_crew.py`.

## Pre-flight

1. Confirm `clients/<ClientName>/` exists — if not, create it first
2. Read `clients/<ClientName>/brief.md` for brief content
3. Check if a research output exists in the client folder — if so, pass it as `brand_doc`
4. Inject any `.txt`/`.md` files from `knowledge/brand-strategy/` into the brief notes

## Execution

```powershell
$client = "ClientName"
$workspace = "C:\Users\thear\OneDrive\Desktop\aiagency"
$python = "$workspace\venv311\Scripts\python.exe"
$brief = Get-Content "$workspace\clients\$client\brief.md" -Raw -ErrorAction SilentlyContinue

# Check for existing research doc to pass as brand_doc
$researchDoc = Get-ChildItem "$workspace\clients\$client" -Filter "research_*.txt" |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName

$briefJson = @{
    brand_name      = $client
    what_it_is      = ""
    target_audience = ""
    category        = ""
    notes           = $brief
} | ConvertTo-Json -Compress

$cmd = @("$workspace\run_crew.py", "--client", $client, "--crew", "branding", "--brief-json", $briefJson)
if ($researchDoc) { $cmd += @("--brand-doc", $researchDoc) }

& $python @cmd
```

## After Run

- Output saves to `clients/<ClientName>/brand_document_<timestamp>.txt`
- Trigger **Output QA Node** automatically on completion
