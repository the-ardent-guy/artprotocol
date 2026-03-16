---
name: run-social
description: Run the 10-agent social media crew for an Art Protocol client. Use when asked to run social, do social media, create content calendar, or build social strategy for a client. Triggers run_crew.py with crew=social. Workspace: C:\Users\thear\OneDrive\Desktop\aiagency
---

# Run Social

Trigger the 10-agent social media crew for a client via `run_crew.py`.

## Pre-flight

1. Confirm `clients/<ClientName>/` exists
2. Read `clients/<ClientName>/brief.md`
3. Look for the most recent `brand_document_*.txt` in the client folder — pass it as `--brand-doc` if found
4. Inject any `.txt`/`.md` from `knowledge/social-media/` into brief notes

## Execution

```powershell
$client = "ClientName"
$workspace = "C:\Users\thear\OneDrive\Desktop\aiagency"
$python = "$workspace\venv311\Scripts\python.exe"
$brief = Get-Content "$workspace\clients\$client\brief.md" -Raw -ErrorAction SilentlyContinue

$brandDoc = Get-ChildItem "$workspace\clients\$client" -Filter "brand_document_*.txt" |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName

$briefJson = @{
    brand_name      = $client
    platforms       = "Instagram, LinkedIn"
    target_audience = ""
    tone            = ""
    notes           = $brief
} | ConvertTo-Json -Compress

$cmd = @("$workspace\run_crew.py", "--client", $client, "--crew", "social", "--brief-json", $briefJson)
if ($brandDoc) { $cmd += @("--brand-doc", $brandDoc) }

& $python @cmd
```

## After Run

- Output saves to `clients/<ClientName>/social_media_<timestamp>.txt`
- Trigger **Output QA Node** automatically on completion
