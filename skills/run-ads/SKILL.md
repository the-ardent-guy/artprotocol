---
name: run-ads
description: Run the 8-agent paid media ads crew for an Art Protocol client. Use when asked to run ads, do ads, build ad campaigns, create Meta or Google campaigns for a client. Triggers run_crew.py with crew=ads. Workspace: C:\Users\thear\OneDrive\Desktop\aiagency
---

# Run Ads

Trigger the 8-agent ads crew for a client via `run_crew.py`.

## Pre-flight

1. Confirm `clients/<ClientName>/` exists
2. Read `clients/<ClientName>/brief.md`
3. Look for most recent `brand_document_*.txt` — pass as `--brand-doc` if found
4. Inject any `.txt`/`.md` from `knowledge/frameworks/` into brief notes

## Execution

```powershell
$client = "ClientName"
$workspace = "C:\Users\thear\OneDrive\Desktop\aiagency"
$python = "$workspace\venv311\Scripts\python.exe"
$brief = Get-Content "$workspace\clients\$client\brief.md" -Raw -ErrorAction SilentlyContinue

$brandDoc = Get-ChildItem "$workspace\clients\$client" -Filter "brand_document_*.txt" |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName

$briefJson = @{
    brand_name = $client
    category   = ""
    platforms  = "Meta, Google"
    product    = $client
    notes      = $brief
} | ConvertTo-Json -Compress

$cmd = @("$workspace\run_crew.py", "--client", $client, "--crew", "ads", "--brief-json", $briefJson)
if ($brandDoc) { $cmd += @("--brand-doc", $brandDoc) }

& $python @cmd
```

## After Run

- Output saves to `clients/<ClientName>/ads_campaign_<timestamp>.txt`
- Trigger **Output QA Node** automatically on completion
