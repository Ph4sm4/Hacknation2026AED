"""SQLite persistence for holder accounts, uploads/submissions and citizen reports."""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from ..schema import ROOT

DB_PATH = Path(os.environ.get("AED_DB", ROOT / "data" / "app.sqlite3"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    organization TEXT NOT NULL,
    regon TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS uploads (
    token TEXT PRIMARY KEY,
    user_id INTEGER,
    filename TEXT,
    summary_json TEXT,
    records_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    upload_token TEXT NOT NULL,
    title TEXT NOT NULL,
    license TEXT NOT NULL,
    update_frequency TEXT NOT NULL,
    records INTEGER NOT NULL,
    conformity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'przekazane',
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aed_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    comment TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);
"""


def init() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as c:
        c.executescript(SCHEMA)


@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
