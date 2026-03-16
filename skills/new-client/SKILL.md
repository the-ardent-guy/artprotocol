---
name: new-client
description: Create a new client folder in the Art Protocol workspace. Use when asked to create a new client, add a client, set up a client, or onboard a client. Creates clients/ClientName/ with brief.md and session.json. Workspace: C:\Users\thear\OneDrive\Desktop\aiagency
---

# New Client

Create the folder structure for a new Art Protocol client.

## Steps

1. Sanitize the client name: replace spaces with underscores, strip special chars
2. Create the folder: `clients/<ClientName>/`
3. Create `clients/<ClientName>/brief.md` with a template header
4. Create `clients/<ClientName>/session.json` as `{}`
5. Confirm creation to the user

## Example

User: "new client TestBrand"

```powershell
$name = "TestBrand"
$base = "C:\Users\thear\OneDrive\Desktop\aiagency\clients\$name"
New-Item -ItemType Directory -Force -Path $base
"# $name`n`nAdd client brief here." | Out-File "$base\brief.md" -Encoding utf8
"{}" | Out-File "$base\session.json" -Encoding utf8
Write-Host "Created: $base"
```

Confirm: "✅ Client `TestBrand` created at `clients/TestBrand/`"
