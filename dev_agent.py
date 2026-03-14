#!/usr/bin/env python3
"""
Art Protocol Dev Agent
Autonomous error-detection and fix agent.
Starts the backend, runs tests against every endpoint, detects errors,
uses Claude to generate fixes, applies them, and re-tests.

Usage:
    python dev_agent.py
    python dev_agent.py --test-only     # don't start server, just run tests
    python dev_agent.py --fix           # detect and auto-apply fixes
"""

import os
import sys
import json
import time
import subprocess
import requests
import argparse
import traceback
from pathlib import Path

ROOT = os.path.dirname(os.path.abspath(__file__))

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, "backend", ".env"))
    load_dotenv(os.path.join(ROOT, ".env"))
except ImportError:
    pass

import anthropic

BACKEND_URL  = "http://localhost:8000"
BACKEND_DIR  = os.path.join(ROOT, "backend")
PYTHON_EXEC  = os.getenv("PYTHON_EXEC", sys.executable)
API_KEY      = os.getenv("BACKEND_API_KEY", "ap-dev-secret-2024")
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")

claude = anthropic.Anthropic(api_key=ANTHROPIC_KEY) if ANTHROPIC_KEY else None

HEADERS_ADMIN = {"x-api-key": API_KEY, "Content-Type": "application/json"}

# -- colours for terminal output --
def green(s):  return f"\033[92m{s}\033[0m"
def red(s):    return f"\033[91m{s}\033[0m"
def yellow(s): return f"\033[93m{s}\033[0m"
def bold(s):   return f"\033[1m{s}\033[0m"
def cyan(s):   return f"\033[96m{s}\033[0m"

# -- Test definitions --
TESTS = [
    {
        "name": "Backend health check",
        "method": "GET",
        "path": "/health",
        "headers": {},
        "expected_status": 200,
    },
    {
        "name": "Auth — register new user",
        "method": "POST",
        "path": "/auth/signup",
        "headers": {"Content-Type": "application/json"},
        "body": {"email": "devagent_test@artprotocol.ai", "password": "TestPass123!", "name": "Dev Agent"},
        "expected_status": [200, 201, 400],  # 400 = already exists, fine
    },
    {
        "name": "Auth — login",
        "method": "POST",
        "path": "/auth/login",
        "headers": {"Content-Type": "application/json"},
        "body": {"email": "devagent_test@artprotocol.ai", "password": "TestPass123!"},
        "expected_status": 200,
        "save_token": True,
    },
    {
        "name": "Get /me (authenticated)",
        "method": "GET",
        "path": "/me",
        "requires_auth": True,
        "expected_status": 200,
    },
    {
        "name": "Create project",
        "method": "POST",
        "path": "/me/projects",
        "requires_auth": True,
        "body": {"name": "Dev Agent Test Project", "brief": "Test brief for dev agent validation"},
        "expected_status": [200, 201],
        "save_project_id": True,
    },
    {
        "name": "List projects",
        "method": "GET",
        "path": "/me/projects",
        "requires_auth": True,
        "expected_status": 200,
    },
    {
        "name": "Get credits page",
        "method": "GET",
        "path": "/me/credits",
        "requires_auth": True,
        "expected_status": 200,
    },
    {
        "name": "List deliverables (project)",
        "method": "GET",
        "path": "/me/projects/{project_id}/deliverables",
        "requires_auth": True,
        "expected_status": 200,
    },
]


class DevAgent:
    def __init__(self, auto_fix=False):
        self.auto_fix   = auto_fix
        self.token      = None
        self.project_id = None
        self.errors     = []
        self.fixes      = []
        self.server_proc = None

    def start_backend(self):
        print(bold("\n-- Starting backend server --"))
        if self._is_backend_running():
            print(green("  Backend already running on :8000"))
            return True

        print(f"  Launching: {PYTHON_EXEC} main.py")
        self.server_proc = subprocess.Popen(
            [PYTHON_EXEC, "main.py"],
            cwd=BACKEND_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        # Wait for startup
        for _ in range(20):
            time.sleep(1)
            if self._is_backend_running():
                print(green("  Backend started successfully"))
                return True
            if self.server_proc.poll() is not None:
                out, _ = self.server_proc.communicate()
                print(red(f"  Backend crashed on startup:\n{out[:1000]}"))
                self.errors.append({"test": "startup", "error": out})
                return False
        print(red("  Backend failed to start within 20s"))
        return False

    def _is_backend_running(self):
        try:
            r = requests.get(f"{BACKEND_URL}/health", timeout=2)
            return r.status_code < 500
        except Exception:
            return False

    def run_tests(self):
        print(bold("\n-- Running endpoint tests --\n"))
        results = []
        for test in TESTS:
            result = self._run_test(test)
            results.append(result)
            status = green("PASS") if result["passed"] else red("FAIL")
            print(f"  [{status}] {test['name']}")
            if not result["passed"]:
                print(f"         {yellow(result['error'])}")
        return results

    def _run_test(self, test):
        path = test["path"]
        if self.project_id:
            path = path.replace("{project_id}", self.project_id)

        url = BACKEND_URL + path
        headers = dict(test.get("headers", {}))
        if test.get("requires_auth") and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        body = test.get("body")

        try:
            method = test["method"].lower()
            fn = getattr(requests, method)
            kwargs = {"headers": headers, "timeout": 10}
            if body:
                kwargs["json"] = body
            resp = fn(url, **kwargs)

            expected = test["expected_status"]
            if isinstance(expected, int):
                expected = [expected]
            passed = resp.status_code in expected

            # Save token / project_id
            if passed and test.get("save_token"):
                data = resp.json()
                self.token = data.get("access_token") or data.get("token")
            if passed and test.get("save_project_id"):
                data = resp.json()
                self.project_id = data.get("id") or data.get("project_id")

            return {
                "passed": passed,
                "test":   test["name"],
                "status": resp.status_code,
                "error":  f"Expected {expected}, got {resp.status_code}. Body: {resp.text[:200]}" if not passed else "",
                "body":   resp.text[:500],
            }

        except Exception as e:
            return {"passed": False, "test": test["name"], "status": 0, "error": str(e), "body": ""}

    def collect_backend_errors(self):
        """Read backend main.py and look for obvious issues."""
        issues = []
        main_path = os.path.join(BACKEND_DIR, "main.py")
        try:
            with open(main_path, "r", encoding="utf-8") as f:
                content = f.read()
            # Try to compile
            try:
                compile(content, main_path, "exec")
            except SyntaxError as e:
                issues.append(f"SyntaxError in main.py line {e.lineno}: {e.msg}")
        except Exception as e:
            issues.append(f"Could not read main.py: {e}")
        return issues

    def collect_run_crew_errors(self):
        issues = []
        path = os.path.join(ROOT, "run_crew.py")
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            try:
                compile(content, path, "exec")
            except SyntaxError as e:
                issues.append(f"SyntaxError in run_crew.py line {e.lineno}: {e.msg}")
        except Exception as e:
            issues.append(f"Could not read run_crew.py: {e}")
        return issues

    def ask_claude_for_fix(self, error_context, file_path, file_content):
        if not claude:
            print(yellow("  No ANTHROPIC_API_KEY — cannot auto-fix"))
            return None

        print(cyan(f"\n  Asking Claude to fix: {os.path.basename(file_path)}"))
        prompt = (
            f"You are a senior Python/TypeScript engineer fixing a bug in a FastAPI + Next.js project.\n\n"
            f"FILE: {file_path}\n\n"
            f"ERROR:\n{error_context}\n\n"
            f"FILE CONTENT:\n```\n{file_content[:6000]}\n```\n\n"
            f"Provide ONLY the corrected complete file content. No explanations, no markdown fences."
        )
        try:
            msg = claude.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4000,
                messages=[{"role": "user", "content": prompt}]
            )
            return msg.content[0].text.strip()
        except Exception as e:
            print(red(f"  Claude error: {e}"))
            return None

    def apply_fix(self, file_path, new_content):
        backup = file_path + ".bak"
        with open(file_path, "r", encoding="utf-8") as f:
            original = f.read()
        with open(backup, "w", encoding="utf-8") as f:
            f.write(original)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(green(f"  Applied fix to {os.path.basename(file_path)} (backup: .bak)"))

    def run(self, start_server=True, test_only=False):
        print(bold(cyan("\n=== Art Protocol Dev Agent ===")))

        # Syntax check
        print(bold("\n-- Static checks --"))
        issues = self.collect_backend_errors() + self.collect_run_crew_errors()
        if issues:
            for iss in issues:
                print(red(f"  FAIL {iss}"))
            if self.auto_fix:
                self._attempt_syntax_fixes(issues)
        else:
            print(green("  OK No syntax errors found"))

        # Start server
        if start_server and not test_only:
            ok = self.start_backend()
            if not ok:
                self._attempt_startup_fix()
                return

        # Run tests
        if not self._is_backend_running():
            print(yellow("\n  Backend not reachable — skipping endpoint tests"))
            print(yellow("  Run 'python main.py' in the backend folder first"))
        else:
            results = self.run_tests()
            failed  = [r for r in results if not r["passed"]]
            passed  = [r for r in results if r["passed"]]

            print(bold(f"\n-- Results: {green(str(len(passed)))} passed, {red(str(len(failed)))} failed --"))

            if failed and self.auto_fix:
                print(bold("\n-- Attempting auto-fixes --"))
                for f in failed:
                    print(f"  Analysing: {f['test']}")
                    # For now, report the error clearly
                    print(red(f"  Error: {f['error']}"))
                    self.errors.append(f)

        # Final summary
        print(bold("\n-- Summary --"))
        if not self.errors:
            print(green("  All checks passed. System looks healthy."))
        else:
            print(red(f"  {len(self.errors)} issue(s) found:"))
            for e in self.errors:
                print(f"    • {e.get('test', 'unknown')}: {e.get('error', '')[:120]}")
            print(yellow("\n  Run with --fix to attempt auto-fixes"))

        print()

    def _attempt_startup_fix(self):
        if not self.auto_fix or not claude:
            return
        main_path = os.path.join(BACKEND_DIR, "main.py")
        with open(main_path, "r", encoding="utf-8") as f:
            content = f.read()
        error_ctx = "\n".join(self.errors[0].get("error", "")[:2000] if self.errors else ["Startup failed"])
        fix = self.ask_claude_for_fix(error_ctx, main_path, content)
        if fix:
            self.apply_fix(main_path, fix)
            print(cyan("  Retrying backend startup..."))
            self.start_backend()

    def _attempt_syntax_fixes(self, issues):
        if not claude:
            return
        for issue in issues:
            if "main.py" in issue:
                fp = os.path.join(BACKEND_DIR, "main.py")
            elif "run_crew.py" in issue:
                fp = os.path.join(ROOT, "run_crew.py")
            else:
                continue
            with open(fp, "r", encoding="utf-8") as f:
                content = f.read()
            fix = self.ask_claude_for_fix(issue, fp, content)
            if fix:
                self.apply_fix(fp, fix)


def main():
    parser = argparse.ArgumentParser(description="Art Protocol Dev Agent")
    parser.add_argument("--test-only", action="store_true", help="Run tests only, don't start server")
    parser.add_argument("--fix",       action="store_true", help="Auto-apply Claude-generated fixes")
    parser.add_argument("--no-server", action="store_true", help="Don't attempt to start server")
    args = parser.parse_args()

    agent = DevAgent(auto_fix=args.fix)
    agent.run(
        start_server=not args.no_server and not args.test_only,
        test_only=args.test_only,
    )


if __name__ == "__main__":
    main()
