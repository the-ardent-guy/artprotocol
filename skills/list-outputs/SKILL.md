---
name: list-outputs
description: List all output files for a specific Art Protocol client. Use when asked to list outputs, show outputs, what files exist for a client, or what has been generated for a client. Workspace: C:\Users\thear\OneDrive\Desktop\aiagency
---

# List Outputs

List all output files inside a client's folder.

## Steps

Extract the client name from the user's message, then:

```powershell
$client = "ClientName"  # extracted from user message
$path = "C:\Users\thear\OneDrive\Desktop\aiagency\clients\$client"
if (Test-Path $path) {
    Get-ChildItem $path -Recurse -File |
      Where-Object { $_.Name -ne "session.json" } |
      Select-Object @{N="File";E={$_.FullName.Replace($path,"")}},
                    @{N="Size";E={"$([math]::Round($_.Length/1KB,1))KB"}},
                    @{N="Modified";E={$_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")}} |
      Format-Table -AutoSize
} else {
    Write-Host "Client '$client' not found."
}
```

Format the result clearly showing file paths relative to the client folder, size, and last modified date.
