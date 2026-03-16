---
name: list-clients
description: List all client folders in the Art Protocol clients/ directory. Use when asked to list clients, show clients, who are the clients, or what clients exist. Workspace: C:\Users\thear\OneDrive\Desktop\aiagency
---

# List Clients

List all client folders under `clients/` (excluding `users/`).

## Steps

```powershell
Get-ChildItem "C:\Users\thear\OneDrive\Desktop\aiagency\clients" -Directory |
  Where-Object { $_.Name -ne "users" } |
  ForEach-Object {
    $brief = Test-Path "$($_.FullName)\brief.md"
    $session = if (Test-Path "$($_.FullName)\session.json") {
      Get-Content "$($_.FullName)\session.json" | ConvertFrom-Json
    } else { $null }
    "$($_.Name) | brief=$brief | brand=$($session.brand_done) | social=$($session.social_done) | ads=$($session.ads_done)"
  }
```

Return a formatted list showing each client name and which crews have been run.
