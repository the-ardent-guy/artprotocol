---
name: run-all
description: Run all Art Protocol crews in sequence for a client — research, branding, social, ads. Use when asked to run everything, run all crews, full run, or do the full pipeline for a client. Workspace: C:\Users\thear\OneDrive\Desktop\aiagency
---

# Run All

Run all 4 crews in sequence for a client: research → branding → social → ads.
Each crew uses the output of the previous as context.

## Sequence

Run these skills in order, passing output forward:

1. **run-research** → saves `research_<ts>.txt`
2. **run-branding** → passes research as `--brand-doc` → saves `brand_document_<ts>.txt`
3. **run-social** → passes brand doc as `--brand-doc` → saves `social_media_<ts>.txt`
4. **run-ads** → passes brand doc as `--brand-doc` → saves `ads_campaign_<ts>.txt`

## Safety

- Confirm with the user before starting: "This will run all 4 crews for `<ClientName>`. Estimated time: 60–90 minutes. Proceed?"
- After each crew completes, confirm success before starting the next
- If any crew fails, stop and report — do not continue to the next crew
- After each crew, trigger **Output QA Node** on the output

## After Full Run

List all files generated:
```powershell
Get-ChildItem "C:\Users\thear\OneDrive\Desktop\aiagency\clients\<ClientName>" -File |
    Select-Object Name, @{N="Size";E={"$([math]::Round($_.Length/1KB,1))KB"}} |
    Format-Table -AutoSize
```
