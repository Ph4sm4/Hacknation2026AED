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
-- volunteer responders: an anonymous device id + its last position (expires, deleted on opt-out)
CREATE TABLE IF NOT EXISTS responders (
    device_id TEXT PRIMARY KEY,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    accuracy REAL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- "AED needed here" alerts sent from the app
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_device TEXT NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    accuracy REAL,
    address TEXT DEFAULT '',
    aed_id TEXT DEFAULT '',
    recipients INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'aktywny',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alert_responses (
    alert_id INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (alert_id, device_id)
);
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aed_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    comment TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);
"""


# columns added after the first release – applied in place to existing databases
MIGRATIONS = [
    ("users", "role", "TEXT NOT NULL DEFAULT 'dysponent'"),
    ("reports", "status", "TEXT NOT NULL DEFAULT 'nowe'"),
    ("reports", "moderator_note", "TEXT DEFAULT ''"),
    ("reports", "moderated_at", "TEXT"),
    ("reports", "moderated_by", "INTEGER"),
]


def init() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as c:
        c.executescript(SCHEMA)
        for table, col, ddl in MIGRATIONS:
            if col not in {r["name"] for r in c.execute(f"PRAGMA table_info({table})")}:
                c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}")


@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
