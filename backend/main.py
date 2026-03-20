"""
Art Protocol OS - FastAPI Backend
Serves crew management, file operations, SSE streaming, PDF generation, AI chat,
public user auth, and credit management.
"""

import os
import sys
import json
import uuid
import asyncio
import io
import traceback

import subprocess as _subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any

import aiofiles
from fastapi import FastAPI, HTTPException, Header, Query, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

load_dotenv()

# ─── USER AUTH IMPORTS ───────────────────────────────────────────────────────
from passlib.context import CryptContext
from jose import JWTError, jwt
import database as db

# ─── CONFIG ──────────────────────────────────────────────────────────────────

BACKEND_API_KEY  = os.getenv("BACKEND_API_KEY", "dev-secret")
PROJECT_ROOT     = os.path.abspath(os.getenv("PROJECT_ROOT", os.path.dirname(__file__)))
CLIENTS_DIR      = os.getenv("CLIENTS_DIR") or os.path.join(PROJECT_ROOT, "clients")
USER_CLIENTS_DIR = os.path.join(CLIENTS_DIR, "users")
JWT_SECRET       = os.getenv("JWT_SECRET", "ap-jwt-secret-change-in-prod")
JWT_ALGORITHM    = "HS256"
JWT_EXPIRE_DAYS  = 30
os.makedirs(USER_CLIENTS_DIR, exist_ok=True)

# ─── PASSWORD HASHING ────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ─── CREDIT COSTS PER DEPARTMENT ─────────────────────────────────────────────
CREW_COSTS = {
    "research":  20,
    "branding":  20,
    "social":    20,
    "ads":       20,
    "proposal":  20,
}

# ─── CREDIT PACKAGES ─────────────────────────────────────────────────────────
CREDIT_PACKAGES = {
    "starter": {"credits": 500,  "inr": 499,  "usd": 6,  "label": "Starter"},
    "growth":  {"credits": 1600, "inr": 1499, "usd": 18, "label": "Growth"},
    "agency":  {"credits": 4500, "inr": 3999, "usd": 48, "label": "Agency"},
}
KNOWLEDGE_DIR   = os.path.join(PROJECT_ROOT, "knowledge")
PYTHON_EXEC     = os.getenv("PYTHON_EXEC", sys.executable)
CORS_ORIGIN     = os.getenv("CORS_ORIGIN", "http://localhost:3000")
ANTHROPIC_KEY   = os.getenv("ANTHROPIC_API_KEY", "")

os.makedirs(CLIENTS_DIR, exist_ok=True)
os.makedirs(KNOWLEDGE_DIR, exist_ok=True)

# ─── APP ─────────────────────────────────────────────────────────────────────

app = FastAPI(title="Art Protocol OS", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ORIGIN, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    print(f"\n[UNHANDLED ERROR] {request.method} {request.url.path}\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {str(exc)}"},
    )

# ─── IN-MEMORY JOB STORE ─────────────────────────────────────────────────────

# job_id -> { status: "running"|"done"|"error", lines: [str], output_path: str|None }
jobs: Dict[str, Dict[str, Any]] = {}

# ─── AUTH ─────────────────────────────────────────────────────────────────────

def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != BACKEND_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key

def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(days=JWT_EXPIRE_DAYS)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_user(authorization: str = Header(...)) -> dict:
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise ValueError()
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError()
        user = db.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except (JWTError, ValueError, AttributeError):
        raise HTTPException(status_code=401, detail="Invalid token")

# ─── MODELS ──────────────────────────────────────────────────────────────────

class NewClientRequest(BaseModel):
    name: str
    brief: Optional[str] = ""

class RunCrewRequest(BaseModel):
    client_name: str
    crew_name: str          # branding | social | ads | proposal | research
    brief: Dict[str, str]
    brand_doc_path: Optional[str] = None

class SaveOutputRequest(BaseModel):
    content: str

class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = ""
    history: Optional[List[Dict[str, str]]] = []

class SaveBriefRequest(BaseModel):
    content: str

class ClientCredentials(BaseModel):
    username: str
    password: str

# ─── HELPERS ─────────────────────────────────────────────────────────────────

def safe_path(base: str, rel: str) -> str:
    """Resolve a path safely, preventing directory traversal."""
    base = os.path.realpath(base)
    full = os.path.realpath(os.path.join(base, rel))
    if not full.startswith(base):
        raise HTTPException(status_code=400, detail="Invalid path")
    return full

def get_client_dir(client_name: str) -> str:
    safe = client_name.replace("..", "").replace("/", "").replace("\\", "")
    return os.path.join(CLIENTS_DIR, safe)

def list_outputs(client_name: str) -> List[Dict]:
    client_dir = get_client_dir(client_name)
    if not os.path.exists(client_dir):
        return []
    outputs = []
    for fname in sorted(os.listdir(client_dir), reverse=True):
        if fname.endswith((".txt", ".md")) and fname != "brief.md":
            fpath = os.path.join(client_dir, fname)
            stat  = os.stat(fpath)
            outputs.append({
                "name":     fname,
                "path":     f"{client_name}/{fname}",
                "size":     stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "crew":     guess_crew(fname),
            })
    return outputs

def guess_crew(filename: str) -> str:
    f = filename.lower()
    if "brand" in f:   return "branding"
    if "social" in f:  return "social"
    if "ads" in f:     return "ads"
    if "proposal" in f: return "proposal"
    if "research" in f: return "research"
    return "output"

def get_last_run(client_name: str) -> Optional[str]:
    outputs = list_outputs(client_name)
    if outputs:
        return outputs[0]["modified"]
    return None

def generate_pdf(content: str, title: str = "Output") -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, PageBreak
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    from reportlab.pdfgen import canvas as pdfcanvas

    PAGE_W, PAGE_H = A4
    MARGIN = 20 * mm

    # ── Watermark callback ────────────────────────────────────────────────────
    def add_watermark(canv, doc):
        """Draws a subtle Art Protocol watermark at the bottom of every page."""
        canv.saveState()
        canv.setFont("Helvetica", 7)
        canv.setFillColor(colors.HexColor("#cccccc"))
        watermark_text = "Art Protocol Studio"
        text_width = canv.stringWidth(watermark_text, "Helvetica", 7)
        x = (PAGE_W - text_width) / 2
        y = 10 * mm
        canv.drawString(x, y, watermark_text)
        # Page number on right
        canv.setFillColor(colors.HexColor("#cccccc"))
        canv.drawRightString(PAGE_W - MARGIN, y, f"p. {doc.page}")
        canv.restoreState()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=MARGIN,
        leftMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=25 * mm,   # extra bottom space for watermark
        onFirstPage=add_watermark,
        onLaterPages=add_watermark,
    )

    styles = getSampleStyleSheet()

    # ── Custom styles ─────────────────────────────────────────────────────────
    cover_title = ParagraphStyle(
        "cover_title",
        parent=styles["Normal"],
        fontSize=28,
        leading=34,
        spaceAfter=6,
        textColor=colors.HexColor("#111111"),
        fontName="Helvetica-Bold",
    )
    cover_sub = ParagraphStyle(
        "cover_sub",
        parent=styles["Normal"],
        fontSize=11,
        leading=16,
        spaceAfter=4,
        textColor=colors.HexColor("#888888"),
        fontName="Helvetica",
    )
    h1 = ParagraphStyle(
        "h1", parent=styles["Normal"],
        fontSize=18, leading=24, spaceBefore=14, spaceAfter=6,
        textColor=colors.HexColor("#111111"), fontName="Helvetica-Bold",
        borderPad=0,
    )
    h2 = ParagraphStyle(
        "h2", parent=styles["Normal"],
        fontSize=13, leading=18, spaceBefore=12, spaceAfter=4,
        textColor=colors.HexColor("#222222"), fontName="Helvetica-Bold",
    )
    h3 = ParagraphStyle(
        "h3", parent=styles["Normal"],
        fontSize=11, leading=16, spaceBefore=8, spaceAfter=3,
        textColor=colors.HexColor("#444444"), fontName="Helvetica-Bold",
    )
    body = ParagraphStyle(
        "body", parent=styles["Normal"],
        fontSize=10, leading=15, spaceAfter=5,
        textColor=colors.HexColor("#333333"), fontName="Helvetica",
    )
    bullet = ParagraphStyle(
        "bullet", parent=styles["Normal"],
        fontSize=10, leading=15, spaceAfter=3,
        textColor=colors.HexColor("#333333"), fontName="Helvetica",
        leftIndent=12, bulletIndent=0,
    )
    code_style = ParagraphStyle(
        "code_style", parent=styles["Normal"],
        fontSize=8, leading=12, spaceAfter=4,
        textColor=colors.HexColor("#555555"), fontName="Courier",
        backColor=colors.HexColor("#f5f5f5"),
        leftIndent=8, rightIndent=8,
    )

    # ── Cover page ────────────────────────────────────────────────────────────
    story = []

    # Spacer to push title down visually
    story.append(Spacer(1, 40 * mm))
    story.append(Paragraph(title, cover_title))
    story.append(Spacer(1, 3 * mm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#111111")))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("Art Protocol Studio", cover_sub))
    story.append(Paragraph(datetime.now().strftime("Generated %B %d, %Y"), cover_sub))
    story.append(PageBreak())

    # ── Content ───────────────────────────────────────────────────────────────
    in_code_block = False

    for line in content.split("\n"):
        line_stripped = line.strip()

        # Code block toggle
        if line_stripped.startswith("```"):
            in_code_block = not in_code_block
            continue

        if in_code_block:
            safe = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            story.append(Paragraph(safe or "&nbsp;", code_style))
            continue

        # Headings
        if line_stripped.startswith("#### "):
            safe = _escape(line_stripped[5:])
            story.append(Paragraph(safe, h3))
        elif line_stripped.startswith("### "):
            safe = _escape(line_stripped[4:])
            story.append(Paragraph(safe, h3))
        elif line_stripped.startswith("## "):
            safe = _escape(line_stripped[3:])
            story.append(Spacer(1, 2 * mm))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e0e0e0")))
            story.append(Paragraph(safe, h2))
        elif line_stripped.startswith("# "):
            safe = _escape(line_stripped[2:])
            story.append(Spacer(1, 4 * mm))
            story.append(Paragraph(safe, h1))
            story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#dddddd")))

        # Dividers
        elif line_stripped in ("---", "===", "***"):
            story.append(Spacer(1, 2 * mm))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#dddddd")))
            story.append(Spacer(1, 2 * mm))

        # Bullet points
        elif line_stripped.startswith("- ") or line_stripped.startswith("* "):
            text = _escape_inline(line_stripped[2:])
            story.append(Paragraph(f"&bull; &nbsp;{text}", bullet))

        elif line_stripped.startswith("  - ") or line_stripped.startswith("  * "):
            text = _escape_inline(line_stripped[4:])
            story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;&bull; &nbsp;{text}", bullet))

        # Numbered list
        elif len(line_stripped) > 2 and line_stripped[0].isdigit() and line_stripped[1] in ".)" and line_stripped[2] == " ":
            text = _escape_inline(line_stripped[3:])
            num = line_stripped[0]
            story.append(Paragraph(f"{num}. &nbsp;{text}", bullet))

        # Blockquote
        elif line_stripped.startswith("> "):
            safe = _escape_inline(line_stripped[2:])
            bq = ParagraphStyle(
                "bq", parent=body,
                leftIndent=16, textColor=colors.HexColor("#666666"),
                fontName="Helvetica-Oblique",
            )
            story.append(Paragraph(safe, bq))

        # Empty line
        elif not line_stripped:
            story.append(Spacer(1, 3 * mm))

        # Body text
        else:
            safe = _escape_inline(line_stripped)
            story.append(Paragraph(safe, body))

    doc.build(story)
    return buffer.getvalue()


def _escape(text: str) -> str:
    """Escape HTML special chars for ReportLab."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _escape_inline(text: str) -> str:
    """Escape and convert inline markdown bold/italic to ReportLab tags."""
    import re
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Bold: **text** or __text__
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'__(.+?)__', r'<b>\1</b>', text)
    # Italic: *text* or _text_
    text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)
    text = re.sub(r'_(.+?)_', r'<i>\1</i>', text)
    # Inline code: `text`
    text = re.sub(r'`(.+?)`', r'<font name="Courier" size="9">\1</font>', text)
    return text

# ─── ROUTES: HEALTH ───────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "project_root": PROJECT_ROOT}


# ─── ROUTES: CLIENTS ─────────────────────────────────────────────────────────

@app.get("/clients")
async def get_clients(x_api_key: str = Depends(verify_api_key)):
    """List all client folders."""
    if not os.path.exists(CLIENTS_DIR):
        return []
    clients = []
    for name in sorted(os.listdir(CLIENTS_DIR)):
        client_dir = os.path.join(CLIENTS_DIR, name)
        if not os.path.isdir(client_dir):
            continue
        session_file = os.path.join(client_dir, "session.json")
        session = {}
        if os.path.exists(session_file):
            try:
                with open(session_file) as f:
                    session = json.load(f)
            except Exception:
                pass
        has_brief = os.path.exists(os.path.join(client_dir, "brief.md"))
        clients.append({
            "name":      name,
            "last_run":  get_last_run(name),
            "has_brief": has_brief,
            "crews_done": {
                "branding": session.get("brand_done", False),
                "social":   session.get("social_done", False),
                "ads":      session.get("ads_done", False),
                "proposal": session.get("proposal_done", False),
            },
        })
    return clients


@app.post("/clients")
async def create_client(
    body: NewClientRequest,
    x_api_key: str = Depends(verify_api_key),
):
    """Create a new client folder."""
    safe = body.name.strip().replace(" ", "_")
    if not safe:
        raise HTTPException(status_code=400, detail="Client name required")
    client_dir = get_client_dir(safe)
    os.makedirs(client_dir, exist_ok=True)
    # Create blank brief
    brief_path = os.path.join(client_dir, "brief.md")
    if not os.path.exists(brief_path):
        with open(brief_path, "w", encoding="utf-8") as f:
            f.write(f"# {safe}\n\n{body.brief or ''}")
    # Create blank session
    session_path = os.path.join(client_dir, "session.json")
    if not os.path.exists(session_path):
        with open(session_path, "w") as f:
            json.dump({}, f)
    # Create empty credentials file placeholder
    creds_path = os.path.join(client_dir, "credentials.json")
    if not os.path.exists(creds_path):
        with open(creds_path, "w") as f:
            json.dump({"username": safe.lower(), "password": ""}, f, indent=2)
    return {"name": safe, "path": client_dir}


@app.get("/client/{client_name}/brief")
async def get_brief(
    client_name: str,
    x_api_key: str = Depends(verify_api_key),
):
    client_dir = get_client_dir(client_name)
    brief_path = os.path.join(client_dir, "brief.md")
    if not os.path.exists(brief_path):
        return {"content": ""}
    async with aiofiles.open(brief_path, "r", encoding="utf-8") as f:
        content = await f.read()
    return {"content": content}


@app.post("/client/{client_name}/brief")
async def save_brief(
    client_name: str,
    body: SaveBriefRequest,
    x_api_key: str = Depends(verify_api_key),
):
    client_dir = get_client_dir(client_name)
    os.makedirs(client_dir, exist_ok=True)
    brief_path = os.path.join(client_dir, "brief.md")
    async with aiofiles.open(brief_path, "w", encoding="utf-8") as f:
        await f.write(body.content)
    return {"saved": True}


@app.get("/client/{client_name}/outputs")
async def get_outputs(
    client_name: str,
    x_api_key: str = Depends(verify_api_key),
):
    return list_outputs(client_name)


@app.get("/client/{client_name}/credentials")
async def get_credentials(
    client_name: str,
    x_api_key: str = Depends(verify_api_key),
):
    client_dir = get_client_dir(client_name)
    creds_path = os.path.join(client_dir, "credentials.json")
    if not os.path.exists(creds_path):
        return {"username": client_name.lower(), "password": ""}
    async with aiofiles.open(creds_path, "r") as f:
        data = json.loads(await f.read())
    return {"username": data.get("username", ""), "password": data.get("password", "")}


@app.post("/client/{client_name}/credentials")
async def set_credentials(
    client_name: str,
    body: ClientCredentials,
    x_api_key: str = Depends(verify_api_key),
):
    client_dir = get_client_dir(client_name)
    os.makedirs(client_dir, exist_ok=True)
    creds_path = os.path.join(client_dir, "credentials.json")
    async with aiofiles.open(creds_path, "w") as f:
        await f.write(json.dumps({"username": body.username, "password": body.password}, indent=2))
    return {"saved": True}

# ─── ROUTES: OUTPUTS ─────────────────────────────────────────────────────────

@app.get("/output/{path:path}")
async def get_output(
    path: str,
    x_api_key: str = Depends(verify_api_key),
):
    """Get the content of an output file."""
    full_path = safe_path(CLIENTS_DIR, path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    async with aiofiles.open(full_path, "r", encoding="utf-8", errors="replace") as f:
        content = await f.read()
    return {"content": content, "path": path}


@app.post("/output/{path:path}/save")
async def save_output_version(
    path: str,
    body: SaveOutputRequest,
    x_api_key: str = Depends(verify_api_key),
):
    """Save edited content as a new version (v1, v2, v3...)."""
    full_path = safe_path(CLIENTS_DIR, path)
    base, ext  = os.path.splitext(full_path)

    # Find next version number
    version = 1
    while os.path.exists(f"{base}_v{version}{ext}"):
        version += 1

    versioned_path = f"{base}_v{version}{ext}"
    async with aiofiles.open(versioned_path, "w", encoding="utf-8") as f:
        await f.write(body.content)

    # Also update the original
    async with aiofiles.open(full_path, "w", encoding="utf-8") as f:
        await f.write(body.content)

    # Return relative path from clients dir
    rel = os.path.relpath(versioned_path, CLIENTS_DIR)
    return {"saved": True, "version": version, "path": rel.replace("\\", "/")}


@app.get("/output/{path:path}/pdf")
async def download_pdf(
    path: str,
    x_api_key: str = Depends(verify_api_key),
):
    """Convert output file to PDF and serve."""
    full_path = safe_path(CLIENTS_DIR, path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    async with aiofiles.open(full_path, "r", encoding="utf-8", errors="replace") as f:
        content = await f.read()

    title = os.path.basename(path).replace(".txt", "").replace("_", " ").title()
    pdf_bytes = generate_pdf(content, title)

    filename = os.path.basename(path).replace(".txt", ".pdf").replace(".md", ".pdf")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

# ─── ROUTES: CREW RUNNER ─────────────────────────────────────────────────────

@app.post("/run-crew")
async def run_crew(
    body: RunCrewRequest,
    x_api_key: str = Depends(verify_api_key),
):
    """Start a crew job asynchronously. Returns job_id for streaming."""
    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {"status": "running", "lines": [], "output_path": None}

    # Build command
    brief_json = json.dumps(body.brief)
    cmd = [
        PYTHON_EXEC,
        os.path.join(PROJECT_ROOT, "run_crew.py"),
        "--client", body.client_name,
        "--crew",   body.crew_name,
        "--brief-json", brief_json,
    ]
    if body.brand_doc_path:
        doc_path = safe_path(CLIENTS_DIR, body.brand_doc_path)
        cmd += ["--brand-doc", doc_path]

    # Launch subprocess in background
    asyncio.create_task(_run_subprocess(job_id, cmd))

    return {"job_id": job_id}


def _run_subprocess_sync(job_id: str, cmd: list):
    """Synchronous subprocess runner — called in a thread via asyncio.to_thread."""
    try:
        proc = _subprocess.Popen(
            cmd,
            stdout=_subprocess.PIPE,
            stderr=_subprocess.STDOUT,
            cwd=PROJECT_ROOT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        for line in proc.stdout:
            line = line.rstrip()
            jobs[job_id]["lines"].append(line)
            if "[SAVED]" in line and "->" in line:
                path_part = line.split("->")[-1].strip()
                jobs[job_id]["output_path"] = path_part
        proc.wait()
        jobs[job_id]["status"] = "done" if proc.returncode == 0 else "error"
    except Exception as e:
        jobs[job_id]["lines"].append(f"[ERROR] {e}")
        jobs[job_id]["lines"].append(traceback.format_exc())
        jobs[job_id]["status"] = "error"


async def _run_subprocess(job_id: str, cmd: list):
    await asyncio.to_thread(_run_subprocess_sync, job_id, cmd)


@app.get("/stream/{job_id}")
async def stream_job(
    job_id:    str,
    x_api_key: Optional[str] = Header(None),
    api_key:   Optional[str] = Query(None),
):
    """SSE endpoint: streams crew output lines as they arrive.
    Accepts API key in x-api-key header OR ?api_key= query param
    (EventSource doesn't support custom headers).
    """
    key = x_api_key or api_key
    if key != BACKEND_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        idx = 0
        while True:
            job   = jobs[job_id]
            lines = job["lines"]

            while idx < len(lines):
                data = lines[idx].replace("\n", " ")
                yield f"data: {data}\n\n"
                idx += 1

            if job["status"] in ("done", "error"):
                status   = job["status"]
                out_path = job.get("output_path") or ""
                yield f"data: [COMPLETE:{status}:{out_path}]\n\n"
                break

            await asyncio.sleep(0.25)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":  "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/job/{job_id}")
async def get_job_status(
    job_id: str,
    x_api_key: str = Depends(verify_api_key),
):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs[job_id]
    return {
        "status":      job["status"],
        "line_count":  len(job["lines"]),
        "output_path": job.get("output_path"),
    }

# ─── ROUTES: CHAT ─────────────────────────────────────────────────────────────

@app.post("/chat")
async def chat(
    body: ChatRequest,
    x_api_key: str = Depends(verify_api_key),
):
    """Stream a chat response using Claude, with document context."""
    if not ANTHROPIC_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")

    import anthropic

    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

    system_prompt = (
        "You are an expert creative strategist and document editor at Art Protocol Studio. "
        "You help users understand, improve, and build on their brand strategy documents. "
        "Be precise, direct, and actionable. When asked to rewrite or improve something, "
        "produce the actual improved text — not instructions about how to improve it. "
        "When asked questions, answer from the document. "
        "When asked to add something new, write it in the same voice and style as the document."
    )
    if body.context:
        # Use up to 20000 chars — covers most research and brand documents fully
        context_text = body.context[:20000]
        system_prompt += (
            f"\n\n---\nDOCUMENT CONTENT:\n\n{context_text}\n---\n\n"
            "The document above is what the user is working with. "
            "Reference it specifically in your answers."
        )

    messages = []
    for h in (body.history or []):
        if h.get("role") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": body.message})

    async def generate():
        with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=system_prompt,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {json.dumps(text)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

# ─── ROUTES: KNOWLEDGE BASE ───────────────────────────────────────────────────

@app.get("/knowledge")
async def list_knowledge(
    x_api_key: str = Depends(verify_api_key),
):
    """List all files in the knowledge base."""
    if not os.path.exists(KNOWLEDGE_DIR):
        return []
    files = []
    for fname in sorted(os.listdir(KNOWLEDGE_DIR)):
        fpath = os.path.join(KNOWLEDGE_DIR, fname)
        if os.path.isfile(fpath):
            stat = os.stat(fpath)
            # Read tags from sidecar file
            tags_path = fpath + ".tags"
            tags = []
            if os.path.exists(tags_path):
                with open(tags_path) as f:
                    tags = [t.strip() for t in f.read().split(",") if t.strip()]
            files.append({
                "name":     fname,
                "size":     stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "tags":     tags,
            })
    return files


@app.post("/knowledge/upload")
async def upload_knowledge(
    file: UploadFile = File(...),
    tags: str = Form(""),
    x_api_key: str = Depends(verify_api_key),
):
    """Upload a file to the knowledge base."""
    os.makedirs(KNOWLEDGE_DIR, exist_ok=True)
    safe_name = os.path.basename(file.filename).replace(" ", "_")
    dest = os.path.join(KNOWLEDGE_DIR, safe_name)

    content = await file.read()
    async with aiofiles.open(dest, "wb") as f:
        await f.write(content)

    if tags:
        async with aiofiles.open(dest + ".tags", "w") as f:
            await f.write(tags)

    return {"uploaded": safe_name}


@app.delete("/knowledge/{filename}")
async def delete_knowledge(
    filename: str,
    x_api_key: str = Depends(verify_api_key),
):
    safe_name = os.path.basename(filename)
    dest = os.path.join(KNOWLEDGE_DIR, safe_name)
    if not os.path.exists(dest):
        raise HTTPException(status_code=404, detail="File not found")
    os.remove(dest)
    tags_path = dest + ".tags"
    if os.path.exists(tags_path):
        os.remove(tags_path)
    return {"deleted": safe_name}


@app.get("/knowledge/{filename}")
async def get_knowledge_file(
    filename: str,
    x_api_key: str = Depends(verify_api_key),
):
    safe_name = os.path.basename(filename)
    dest = os.path.join(KNOWLEDGE_DIR, safe_name)
    if not os.path.exists(dest):
        raise HTTPException(status_code=404, detail="File not found")
    async with aiofiles.open(dest, "r", encoding="utf-8", errors="replace") as f:
        content = await f.read()
    return {"content": content, "name": safe_name}

# ─── ROUTES: PUBLIC USER AUTH ────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: str
    password: str
    name: str

class LoginRequest(BaseModel):
    email: str
    password: str

class UserRunCrewRequest(BaseModel):
    project_id: str
    crew_name:  str
    brief:      Optional[Dict[str, str]] = None

class CreateOrderRequest(BaseModel):
    package_id: str
    currency:   str = "INR"


@app.post("/auth/signup")
async def signup(body: SignupRequest):
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if not body.email or "@" not in body.email:
        raise HTTPException(status_code=400, detail="Invalid email")
    existing = db.get_user_by_email(body.email)
    if existing:
        raise HTTPException(status_code=409, detail="Account already exists")
    password_hash = pwd_context.hash(body.password)
    user = db.create_user(body.email, password_hash, body.name.strip())
    token = create_access_token({"sub": user["id"], "email": user["email"]})
    return {
        "token":   token,
        "user":    {"id": user["id"], "email": user["email"], "name": user["name"], "credits": user["credits"]},
    }


@app.post("/auth/login")
async def login(body: LoginRequest):
    user = db.get_user_by_email(body.email)
    if not user or not pwd_context.verify(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": user["id"], "email": user["email"]})
    return {
        "token": token,
        "user":  {"id": user["id"], "email": user["email"], "name": user["name"], "credits": user["credits"]},
    }


@app.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    fresh = db.get_user_by_id(user["id"])
    return {
        "id":          fresh["id"],
        "email":       fresh["email"],
        "name":        fresh["name"],
        "credits":     fresh["credits"],
        "trial_used":  fresh["trial_used"],
    }


@app.get("/me/credits")
async def get_credits(user: dict = Depends(get_current_user)):
    history = db.get_credit_history(user["id"])
    return {
        "balance": db.get_user_credits(user["id"]),
        "history": history,
        "packages": CREDIT_PACKAGES,
    }


# ─── ROUTES: USER PROJECTS ────────────────────────────────────────────────────

def get_user_project_dir(user_id: str, project_id: str) -> str:
    safe_proj = project_id.replace("..", "").replace("/", "").replace("\\", "")
    d = os.path.join(USER_CLIENTS_DIR, user_id, safe_proj)
    os.makedirs(d, exist_ok=True)
    return d


@app.get("/me/projects")
async def list_user_projects(user: dict = Depends(get_current_user)):
    user_dir = os.path.join(USER_CLIENTS_DIR, user["id"])
    if not os.path.exists(user_dir):
        return []
    projects = []
    for name in sorted(os.listdir(user_dir)):
        proj_dir = os.path.join(user_dir, name)
        if not os.path.isdir(proj_dir):
            continue
        outputs = [
            f for f in os.listdir(proj_dir)
            if f.endswith((".txt", ".md")) and f != "brief.md"
        ]
        projects.append({
            "id":           name,
            "name":         name.replace("_", " "),
            "output_count": len(outputs),
            "last_run":     get_last_run_from_dir(proj_dir),
        })
    return projects


def get_last_run_from_dir(d: str) -> Optional[str]:
    files = [
        f for f in os.listdir(d)
        if f.endswith(".txt") and f != "brief.md"
    ]
    if not files:
        return None
    latest = max(files, key=lambda f: os.path.getmtime(os.path.join(d, f)))
    return datetime.fromtimestamp(os.path.getmtime(os.path.join(d, latest))).isoformat()


@app.post("/me/projects")
async def create_user_project(
    body: NewClientRequest,
    user: dict = Depends(get_current_user),
):
    safe = body.name.strip().replace(" ", "_")
    if not safe:
        raise HTTPException(status_code=400, detail="Project name required")
    proj_dir = get_user_project_dir(user["id"], safe)
    brief_path = os.path.join(proj_dir, "brief.md")
    if not os.path.exists(brief_path):
        async with aiofiles.open(brief_path, "w") as f:
            await f.write(f"# {safe}\n\n{body.brief or ''}")
    return {"id": safe, "name": safe.replace("_", " ")}


@app.get("/me/projects/{project_id}/brief")
async def get_user_brief(project_id: str, user: dict = Depends(get_current_user)):
    proj_dir = get_user_project_dir(user["id"], project_id)
    brief_path = os.path.join(proj_dir, "brief.md")
    content = ""
    if os.path.exists(brief_path):
        async with aiofiles.open(brief_path, "r") as f:
            content = await f.read()
    return {"content": content}


@app.post("/me/projects/{project_id}/brief")
async def save_user_brief(
    project_id: str,
    body: SaveBriefRequest,
    user: dict = Depends(get_current_user),
):
    proj_dir = get_user_project_dir(user["id"], project_id)
    async with aiofiles.open(os.path.join(proj_dir, "brief.md"), "w") as f:
        await f.write(body.content)
    return {"saved": True}


@app.get("/me/projects/{project_id}/deliverables")
async def list_user_deliverables(
    project_id: str,
    user: dict = Depends(get_current_user),
):
    proj_dir = get_user_project_dir(user["id"], project_id)
    files = []
    balance = db.get_user_credits(user["id"])
    for fname in sorted(os.listdir(proj_dir), reverse=True):
        if fname.endswith((".txt", ".md")) and fname != "brief.md":
            fpath = os.path.join(proj_dir, fname)
            stat  = os.stat(fpath)
            files.append({
                "filename": fname,
                "path":     f"users/{user['id']}/{project_id}/{fname}",
                "size":     stat.st_size,
                "created":  datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "crew":     guess_crew(fname),
                "locked":   user["trial_used"] == 1 and balance <= 0,
            })
    return files


@app.get("/me/projects/{project_id}")
async def get_user_project(project_id: str, user: dict = Depends(get_current_user)):
    proj_dir   = get_user_project_dir(user["id"], project_id)
    brief_path = os.path.join(proj_dir, "brief.md")
    brief_text = ""
    if os.path.exists(brief_path):
        async with aiofiles.open(brief_path, "r") as f:
            brief_text = await f.read()
    outputs = [
        f for f in os.listdir(proj_dir)
        if f.endswith((".txt", ".md")) and f != "brief.md"
    ] if os.path.exists(proj_dir) else []
    return {
        "id":           project_id,
        "name":         project_id.replace("_", " "),
        "brief":        brief_text,
        "output_count": len(outputs),
    }


class SaveDNARequest(BaseModel):
    raw_fields: Dict[str, Any]

# ─── ROUTES: BRAND DNA ────────────────────────────────────────────────────────

@app.get("/me/projects/{project_id}/dna")
async def get_project_dna(project_id: str, user: dict = Depends(get_current_user)):
    """Return brand DNA for a project (raw + enriched fields)."""
    dna = db.get_brand_dna(f"{user['id']}:{project_id}")
    if not dna:
        return {"raw_fields": None, "enriched_fields": None}
    return {"raw_fields": dna["raw_fields"], "enriched_fields": dna["enriched_fields"]}


@app.post("/me/projects/{project_id}/dna")
async def save_project_dna(
    project_id: str,
    body: SaveDNARequest,
    user: dict = Depends(get_current_user),
):
    """Save raw brand DNA fields for a project."""
    dna_key = f"{user['id']}:{project_id}"
    # Preserve existing enriched_fields if any
    existing = db.get_brand_dna(dna_key)
    enriched_json = None
    if existing and existing.get("enriched_fields"):
        enriched_json = json.dumps(existing["enriched_fields"])
    saved = db.save_brand_dna(dna_key, json.dumps(body.raw_fields), enriched_json)
    return {"raw_fields": saved["raw_fields"], "enriched_fields": saved["enriched_fields"]}


@app.post("/me/projects/{project_id}/dna/enrich")
async def enrich_project_dna(project_id: str, user: dict = Depends(get_current_user)):
    """Use Claude to derive enriched brand DNA fields from raw_fields."""
    if not ANTHROPIC_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")

    dna_key = f"{user['id']}:{project_id}"
    dna = db.get_brand_dna(dna_key)
    if not dna or not dna.get("raw_fields"):
        raise HTTPException(status_code=400, detail="No raw DNA saved yet. POST to /dna first.")

    import anthropic
    ac = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

    raw_json = json.dumps(dna["raw_fields"], indent=2)
    user_prompt = (
        f"Here is a structured brand brief:\n\n{raw_json}\n\n"
        "Derive the following fields and return them as a single JSON object:\n"
        "- brand_archetype (string: the primary Jungian archetype)\n"
        "- tone_axis (string: e.g. 'playful-serious', 'bold-refined')\n"
        "- visual_mood (string: 1-2 sentence visual direction)\n"
        "- content_pillars (array of exactly 3 strings)\n"
        "- competitor_keywords (array of exactly 5 strings: key terms competitors own)\n"
        "- positioning_territory (string: the unclaimed positioning space this brand can own)\n"
        "- geo_tier (string: 'global', 'national', 'regional', or 'local')"
    )

    try:
        response = ac.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1000,
            system=(
                "You are a brand strategist. Given this structured brand brief, derive the following fields. "
                "Return valid JSON only, no preamble, no explanation, no markdown code blocks. "
                "Just the raw JSON object."
            ),
            messages=[{"role": "user", "content": user_prompt}],
        )
        enriched_text = response.content[0].text.strip()
        # Strip markdown code fences if model adds them despite instruction
        if enriched_text.startswith("```"):
            enriched_text = enriched_text.split("```")[1]
            if enriched_text.startswith("json"):
                enriched_text = enriched_text[4:]
            enriched_text = enriched_text.strip()
        enriched = json.loads(enriched_text)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Claude returned invalid JSON: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enrichment failed: {e}")

    saved = db.save_brand_dna(dna_key, json.dumps(dna["raw_fields"]), json.dumps(enriched))
    return {"raw_fields": saved["raw_fields"], "enriched_fields": saved["enriched_fields"]}


class UpdateBriefRequest(BaseModel):
    brief:   Optional[str] = None
    content: Optional[str] = None

@app.put("/me/projects/{project_id}/brief")
async def update_user_brief(
    project_id: str,
    body: UpdateBriefRequest,
    user: dict = Depends(get_current_user),
):
    proj_dir = get_user_project_dir(user["id"], project_id)
    content  = body.brief if body.brief is not None else (body.content or "")
    async with aiofiles.open(os.path.join(proj_dir, "brief.md"), "w") as f:
        await f.write(content)
    return {"saved": True}


@app.get("/me/stream/{job_id}")
async def user_stream_job(
    job_id:        str,
    authorization: Optional[str] = Header(None),
    api_key:       Optional[str] = Query(None),
):
    """SSE endpoint for public users. Accepts Bearer token or ?api_key= for EventSource."""
    # Accept either user JWT (Bearer) or the raw token via query param
    token = api_key
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        idx = 0
        while True:
            job   = jobs[job_id]
            lines = job["lines"]
            while idx < len(lines):
                payload_str = json.dumps({"type": "line", "text": lines[idx]})
                yield f"data: {payload_str}\n\n"
                idx += 1
            if job["status"] == "done":
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                break
            elif job["status"] == "error":
                yield f"data: {json.dumps({'type': 'error', 'text': 'Deployment failed'})}\n\n"
                break
            await asyncio.sleep(0.25)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/me/projects/{project_id}/chat")
async def user_project_chat(
    project_id: str,
    body:        ChatRequest,
    user:        dict = Depends(get_current_user),
):
    """Chat with a deliverable. Reads actual file for full context. Costs 10 credits per message."""
    CHAT_COST = 10
    balance   = db.get_user_credits(user["id"])
    trial_used = user["trial_used"]

    if trial_used == 1 and balance < CHAT_COST:
        raise HTTPException(status_code=402, detail="Not enough credits to chat. Add credits to continue.")

    if not ANTHROPIC_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")

    import anthropic
    ac = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

    # Load deliverable file from disk if body.context is a file path
    file_context = ""
    if body.context:
        candidate = os.path.join(USER_CLIENTS_DIR, body.context.lstrip("/"))
        if os.path.isfile(candidate):
            try:
                with open(candidate, "r", encoding="utf-8", errors="replace") as fh:
                    file_context = fh.read()[:24000]
            except Exception:
                file_context = body.context[:24000]
        else:
            file_context = body.context[:24000]

    system_prompt = (
        "You are an expert creative and brand strategist at Art Protocol. "
        "You help users understand, question, and act on their brand deliverables. "
        "Be concise, direct, and specific. When the user asks about the document, "
        "quote or reference it directly. When asked to improve or rewrite something, "
        "produce the actual text, not instructions. "
        "The deliverable is provided below — never say you cannot see it."
    )
    if file_context:
        system_prompt += f"\n\n---\nDELIVERABLE:\n\n{file_context}\n---"

    messages = []
    for h in (body.history or []):
        if h.get("role") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": body.message})

    response = ac.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1500,
        system=system_prompt,
        messages=messages,
    )
    reply = response.content[0].text

    # Deduct credits (only for non-trial users)
    if trial_used == 1:
        db.deduct_credits(user["id"], CHAT_COST, f"Chat - project {project_id}")

    return {"reply": reply, "credits_used": CHAT_COST}

# ─── ROUTES: USER CREW RUNNER ─────────────────────────────────────────────────

@app.post("/me/run-crew")
async def user_run_crew(
    body: UserRunCrewRequest,
    user: dict = Depends(get_current_user),
):
    """Run a crew for the logged-in user. Handles trial + credit logic."""
    crew_cost  = CREW_COSTS.get(body.crew_name, 300)
    balance    = db.get_user_credits(user["id"])
    trial_used = user["trial_used"]

    # Free trial: one run allowed regardless of cost, output will be gated
    is_trial = (trial_used == 0 and balance < crew_cost)

    if not is_trial and balance < crew_cost:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. This deployment costs {crew_cost} credits. You have {balance:.0f}."
        )

    # Mark trial as used now (even if run fails — prevents abuse)
    if is_trial:
        db.mark_trial_used(user["id"])
    else:
        db.deduct_credits(user["id"], crew_cost, f"{body.crew_name} deployment — {body.project_id}", )

    proj_dir  = get_user_project_dir(user["id"], body.project_id)
    client_id = f"users/{user['id']}/{body.project_id}"

    # Read brief from disk if not provided in body
    brief_data = body.brief or {}
    if not brief_data:
        brief_path = os.path.join(proj_dir, "brief.md")
        if os.path.exists(brief_path):
            with open(brief_path, "r", encoding="utf-8") as f:
                brief_data = {"brief": f.read()}

    # Inject Brand DNA if available
    dna_key = f"{user['id']}:{body.project_id}"
    dna = db.get_brand_dna(dna_key)
    if dna and (dna.get("raw_fields") or dna.get("enriched_fields")):
        brief_data["_dna"] = {
            **(dna.get("raw_fields") or {}),
            **(dna.get("enriched_fields") or {}),
        }

    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {"status": "running", "lines": [], "output_path": None, "is_trial": is_trial}

    brief_json = json.dumps(brief_data)
    cmd = [
        PYTHON_EXEC,
        os.path.join(PROJECT_ROOT, "run_crew.py"),
        "--client", client_id,
        "--crew",   body.crew_name,
        "--brief-json", brief_json,
    ]
    asyncio.create_task(_run_subprocess(job_id, cmd))

    return {
        "job_id":   job_id,
        "is_trial": is_trial,
        "cost":     0 if is_trial else crew_cost,
        "balance":  db.get_user_credits(user["id"]),
    }


@app.get("/me/deliverable/{path:path}")
async def get_user_deliverable(
    path: str,
    user: dict = Depends(get_current_user),
    preview: bool = Query(False),
):
    """Serve deliverable content. Truncates to 20% for trial/locked users."""
    # Validate the path belongs to this user
    if not path.startswith(f"users/{user['id']}/"):
        raise HTTPException(status_code=403, detail="Access denied")

    full_path = safe_path(CLIENTS_DIR, path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")

    async with aiofiles.open(full_path, "r", encoding="utf-8", errors="replace") as f:
        content = await f.read()

    balance    = db.get_user_credits(user["id"])
    is_locked  = user["trial_used"] == 1 and balance <= 0

    if is_locked or preview:
        # Return first 20% of content
        cutoff   = max(500, int(len(content) * 0.20))
        content  = content[:cutoff]
        return {"content": content, "locked": True, "path": path}

    return {"content": content, "locked": False, "path": path}


@app.get("/me/deliverable-pdf")
async def user_download_pdf(
    path: str = Query(...),
    user: dict = Depends(get_current_user),
):
    """PDF download — requires paid credits."""
    if not path.startswith(f"users/{user['id']}/"):
        raise HTTPException(status_code=403, detail="Access denied")

    balance = db.get_user_credits(user["id"])
    if user["trial_used"] == 1 and balance <= 0:
        raise HTTPException(status_code=402, detail="Top up credits to download PDF")

    full_path = safe_path(CLIENTS_DIR, path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")

    async with aiofiles.open(full_path, "r", encoding="utf-8", errors="replace") as f:
        content = await f.read()

    title     = os.path.basename(path).replace(".txt", "").replace("_", " ").title()
    pdf_bytes = generate_pdf(content, title)
    filename  = os.path.basename(path).replace(".txt", ".pdf")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─── ROUTES: PAYMENTS (Razorpay — keys added later) ──────────────────────────

@app.get("/payments/packages")
async def get_packages():
    return CREDIT_PACKAGES


@app.post("/payments/razorpay/order")
async def create_order(
    body: CreateOrderRequest,
    user: dict = Depends(get_current_user),
):
    RAZORPAY_KEY_ID     = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
    if not RAZORPAY_KEY_ID:
        raise HTTPException(status_code=503, detail="Payment not configured yet")

    pkg = CREDIT_PACKAGES.get(body.package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid package")

    try:
        import razorpay
        client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        amount = pkg["inr"] * 100 if body.currency == "INR" else pkg["usd"] * 100
        currency = body.currency if body.currency in ("INR", "USD") else "INR"
        order = client.order.create({
            "amount":   amount,
            "currency": currency,
            "notes":    {"user_id": user["id"], "credits": pkg["credits"], "package": body.package_id},
        })
        return {
            "razorpay_order_id": order["id"],
            "amount":            order["amount"],
            "currency":          order["currency"],
            "credits":           pkg["credits"],
            "key_id":            RAZORPAY_KEY_ID,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/payments/razorpay/verify")
async def verify_payment(
    body: dict,
    user: dict = Depends(get_current_user),
):
    import hmac, hashlib
    RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
    if not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=503, detail="Payment not configured yet")

    try:
        order_id   = body["razorpay_order_id"]
        payment_id = body["razorpay_payment_id"]
        signature  = body["razorpay_signature"]
        msg        = f"{order_id}|{payment_id}"
        expected   = hmac.new(RAZORPAY_KEY_SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()
        if expected != signature:
            raise HTTPException(status_code=400, detail="Payment verification failed")

        # Get credits from the order amount (re-lookup from Razorpay)
        # For now use the package passed in body
        credits = float(body.get("credits", 0))
        if credits <= 0:
            raise HTTPException(status_code=400, detail="Invalid credits amount")

        new_balance = db.add_credits(user["id"], credits, f"Purchase — {payment_id}", payment_id)
        return {"success": True, "credits_added": credits, "new_balance": new_balance}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── ROUTES: IMAGE ANALYSIS ──────────────────────────────────────────────────

class AnalyseImagesRequest(BaseModel):
    images:  List[Dict[str, str]]   # [{ b64: "...", mime: "image/jpeg" }, ...]
    context: Optional[str] = ""

@app.post("/me/analyse-images")
async def analyse_product_images(
    body: AnalyseImagesRequest,
    user: dict = Depends(get_current_user),
):
    """Use Claude Vision to extract structured product context from uploaded images."""
    if not ANTHROPIC_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")
    if not body.images:
        raise HTTPException(status_code=400, detail="No images provided")
    if len(body.images) > 4:
        raise HTTPException(status_code=400, detail="Maximum 4 images allowed")

    import anthropic as ac_module
    client = ac_module.Anthropic(api_key=ANTHROPIC_KEY)

    # Build vision message with all images
    content: List[Dict] = []
    for img in body.images:
        mime = img.get("mime", "image/jpeg")
        if mime not in ("image/jpeg", "image/png", "image/gif", "image/webp"):
            mime = "image/jpeg"
        content.append({
            "type": "image",
            "source": { "type": "base64", "media_type": mime, "data": img["b64"] },
        })

    brand_ctx = f"Brand/product context: {body.context}" if body.context else ""
    content.append({
        "type": "text",
        "text": (
            f"{brand_ctx}\n\n"
            "Analyse these product image(s) and return a concise structured description that will help "
            "marketing, branding, and advertising AI agents better understand this product. Include:\n"
            "- Product type and category\n"
            "- Visual aesthetic (colours, materials, form factor, packaging style)\n"
            "- Quality tier and price positioning cues\n"
            "- Target audience signals visible in the product/packaging\n"
            "- Brand personality and tone visible in the design\n"
            "- Any text, logos, or claims visible on packaging\n"
            "- Unique visual differentiators vs typical category products\n\n"
            "Return plain prose, 150–250 words. No bullet points. No headers. "
            "Write as if briefing a senior creative strategist who has never seen the product."
        ),
    })

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            messages=[{"role": "user", "content": content}],
        )
        visual_context = response.content[0].text.strip()
        return {"visual_context": visual_context}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image analysis failed: {e}")


# ─── ROUTES: ADMIN / DEV UTILS ───────────────────────────────────────────────

@app.post("/admin/clear-test-users")
async def clear_test_users(x_admin_key: Optional[str] = Header(None)):
    if x_admin_key != "clear-test-2026":
        raise HTTPException(status_code=403, detail="Forbidden")
    print("[WARNING] clear-test-users endpoint called — all users deleted")
    count = db.clear_all_users()
    return {"deleted_users": count}


# ─── ENTRY POINT ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
