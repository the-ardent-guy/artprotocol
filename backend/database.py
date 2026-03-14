"""
Art Protocol OS — SQLite database layer.
Handles public users, credits, transactions, and jobs.
"""

import sqlite3
import os
import uuid
from datetime import datetime
from typing import Optional, Dict, Any

DB_PATH = os.path.join(os.path.dirname(__file__), "artprotocol.db")


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        email         TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name          TEXT,
        credits       REAL    DEFAULT 100.0,
        trial_used    INTEGER DEFAULT 0,
        created_at    TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS credit_transactions (
        id                   TEXT PRIMARY KEY,
        user_id              TEXT NOT NULL,
        amount               REAL NOT NULL,
        description          TEXT,
        job_id               TEXT,
        razorpay_payment_id  TEXT,
        created_at           TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS user_jobs (
        id           TEXT PRIMARY KEY,
        user_id      TEXT NOT NULL,
        project_id   TEXT NOT NULL,
        crew_name    TEXT NOT NULL,
        status       TEXT DEFAULT 'running',
        credits_used REAL DEFAULT 0,
        output_path  TEXT,
        is_trial     INTEGER DEFAULT 0,
        created_at   TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
    """)
    conn.commit()
    conn.close()


# ─── USER OPERATIONS ─────────────────────────────────────────────────────────

def create_user(email: str, password_hash: str, name: str) -> Dict:
    conn = get_db()
    user_id = str(uuid.uuid4())
    try:
        conn.execute(
            "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)",
            (user_id, email.lower().strip(), password_hash, name)
        )
        # Log signup credit grant
        conn.execute(
            "INSERT INTO credit_transactions (id, user_id, amount, description) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), user_id, 100.0, "Welcome — free trial credits")
        )
        conn.commit()
        return get_user_by_id(user_id)
    finally:
        conn.close()


def get_user_by_email(email: str) -> Optional[Dict]:
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (email.lower().strip(),)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_user_by_id(user_id: str) -> Optional[Dict]:
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_user_credits(user_id: str) -> float:
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT credits FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        return row["credits"] if row else 0.0
    finally:
        conn.close()


def deduct_credits(user_id: str, amount: float, description: str, job_id: str = None) -> float:
    """Deduct credits and return new balance. Raises if insufficient."""
    conn = get_db()
    try:
        row = conn.execute("SELECT credits FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise ValueError("User not found")
        if row["credits"] < amount:
            raise ValueError(f"Insufficient credits: have {row['credits']:.0f}, need {amount:.0f}")
        new_balance = row["credits"] - amount
        conn.execute("UPDATE users SET credits = ? WHERE id = ?", (new_balance, user_id))
        conn.execute(
            "INSERT INTO credit_transactions (id, user_id, amount, description, job_id) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), user_id, -amount, description, job_id)
        )
        conn.commit()
        return new_balance
    finally:
        conn.close()


def add_credits(user_id: str, amount: float, description: str, payment_id: str = None) -> float:
    conn = get_db()
    try:
        conn.execute("UPDATE users SET credits = credits + ? WHERE id = ?", (amount, user_id))
        conn.execute(
            "INSERT INTO credit_transactions (id, user_id, amount, description, razorpay_payment_id) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), user_id, amount, description, payment_id)
        )
        conn.commit()
        row = conn.execute("SELECT credits FROM users WHERE id = ?", (user_id,)).fetchone()
        return row["credits"]
    finally:
        conn.close()


def mark_trial_used(user_id: str):
    conn = get_db()
    try:
        conn.execute("UPDATE users SET trial_used = 1 WHERE id = ?", (user_id,))
        conn.commit()
    finally:
        conn.close()


def get_credit_history(user_id: str, limit: int = 20):
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ─── JOB OPERATIONS ──────────────────────────────────────────────────────────

def create_job(user_id: str, project_id: str, crew_name: str, is_trial: bool) -> str:
    conn = get_db()
    job_id = str(uuid.uuid4())[:8]
    try:
        conn.execute(
            "INSERT INTO user_jobs (id, user_id, project_id, crew_name, is_trial) VALUES (?, ?, ?, ?, ?)",
            (job_id, user_id, project_id, crew_name, 1 if is_trial else 0)
        )
        conn.commit()
        return job_id
    finally:
        conn.close()


def update_job(job_id: str, status: str, credits_used: float = 0, output_path: str = None):
    conn = get_db()
    try:
        conn.execute(
            "UPDATE user_jobs SET status = ?, credits_used = ?, output_path = ? WHERE id = ?",
            (status, credits_used, output_path, job_id)
        )
        conn.commit()
    finally:
        conn.close()


# Run on import
init_db()
