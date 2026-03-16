---
name: push-to-github
description: Git add, commit, and push changes to GitHub for the Art Protocol workspace. Use when asked to push to GitHub, commit changes, git push, deploy, or save to git. Always lists what changed before pushing. Workspace: C:\Users\thear\OneDrive\Desktop\aiagency
---

# Push to GitHub

Commit and push workspace changes to GitHub. Always show the diff first.

## Steps

### 1. Show what changed
```powershell
cd "C:\Users\thear\OneDrive\Desktop\aiagency"
git status
git diff --stat
```

Show the user exactly what files changed. Ask: "These files will be committed. Proceed?"

### 2. Never push without confirmation
- List every changed file
- State the commit message you'll use
- Wait for explicit approval

### 3. Commit and push
```powershell
cd "C:\Users\thear\OneDrive\Desktop\aiagency"
git add .
git commit -m "<message>"
git push
```

## Safety Rules

- **Never** push `.env` files — verify `.gitignore` includes `.env` before pushing
- **Never** push `clients/` output files — they may contain private client data
- **Never** push `venv311/` or `backend_venv/`
- If unsure about a file, ask before including it

## Commit Message Format

`<type>: <what changed>`

Types: `feat`, `fix`, `refactor`, `docs`, `chore`

Example: `feat: add CLI args to research.py and branding_crew.py`
