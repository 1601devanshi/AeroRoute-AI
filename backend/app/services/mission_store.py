"""Small SQLite-backed mission history for the local operations workspace."""

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


def _database_path() -> Path:
    configured = os.getenv("AEROROUTE_DB_PATH")
    return Path(configured) if configured else Path(__file__).resolve().parents[3] / "aeroroute.db"


def _connect():
    connection = sqlite3.connect(_database_path())
    connection.row_factory = sqlite3.Row
    connection.execute(
        """CREATE TABLE IF NOT EXISTS missions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            payload TEXT NOT NULL
        )"""
    )
    return connection


def list_missions():
    with _connect() as connection:
        rows = connection.execute(
            "SELECT payload FROM missions ORDER BY created_at DESC"
        ).fetchall()
    return [json.loads(row["payload"]) for row in rows]


def save_mission(data: dict):
    record = {
        **data,
        "id": str(uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    with _connect() as connection:
        connection.execute(
            "INSERT INTO missions (id, name, created_at, payload) VALUES (?, ?, ?, ?)",
            (record["id"], record["name"], record["created_at"], json.dumps(record)),
        )
    return record
