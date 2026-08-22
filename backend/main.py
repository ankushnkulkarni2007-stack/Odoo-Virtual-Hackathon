"""
main.py
---------------------------------------------------------------------------
Backend & Local Database Lead - Starter Kit
FastAPI + SQLite | REST API + WebSocket API | 100% offline-capable

This single file is a complete, runnable local backend. Read the
Masterclass Guide (backend_masterclass_guide.md) alongside this file --
every section below is explained there in plain English.
---------------------------------------------------------------------------
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from datetime import datetime, timezone
from typing import List
import sqlite3

# ---------------------------------------------------------------------------
# 1. APP + DATABASE PATH SETUP
# ---------------------------------------------------------------------------
app = FastAPI(title="Local Backend - Sensor Readings API")

# Always resolve the database file relative to THIS script's location,
# not wherever the terminal happens to be when you run uvicorn.
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "app.db"

# ---------------------------------------------------------------------------
# 2. CORS - lets a frontend running on a different port talk to us
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # fine for local dev; lock this down for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# 3. DATABASE HELPERS
# ---------------------------------------------------------------------------
def get_db_connection() -> sqlite3.Connection:
    """Open a fresh connection to app.db. A new one per call keeps things
    simple and avoids SQLite thread-safety issues between requests."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # lets us read columns by name, like a dict
    return conn


def init_db() -> None:
    """Create the 'readings' table if it doesn't exist yet. Runs once,
    automatically, the moment this file is imported/started."""
    conn = get_db_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_name TEXT NOT NULL,
            value REAL NOT NULL,
            timestamp TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


init_db()  # runs immediately when the server starts

# ---------------------------------------------------------------------------
# 4. DATA MODELS (what a valid request/response looks like)
# ---------------------------------------------------------------------------
class ReadingIn(BaseModel):
    sensor_name: str
    value: float


class ReadingOut(BaseModel):
    id: int
    sensor_name: str
    value: float
    timestamp: str

# ---------------------------------------------------------------------------
# 5. WEBSOCKET CONNECTION MANAGER
# ---------------------------------------------------------------------------
class ConnectionManager:
    """Keeps track of every browser/client currently connected over
    WebSocket, so we can push live updates out to all of them at once."""

    def __init__(self) -> None:
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict) -> None:
        still_connected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
                still_connected.append(connection)
            except Exception:
                pass  # that client vanished; just drop it
        self.active_connections = still_connected


manager = ConnectionManager()

# ---------------------------------------------------------------------------
# 6. ROOT ENDPOINT (quick sanity check)
# ---------------------------------------------------------------------------
@app.get("/")
def root():
    return {"status": "ok", "message": "Backend is running locally."}

# ---------------------------------------------------------------------------
# 7. REST ENDPOINT: CREATE A READING  (POST /readings)
# ---------------------------------------------------------------------------
@app.post("/readings", response_model=ReadingOut, status_code=201)
async def create_reading(reading: ReadingIn):
    timestamp = datetime.now(timezone.utc).isoformat()
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO readings (sensor_name, value, timestamp) VALUES (?, ?, ?)",
            (reading.sensor_name, reading.value, timestamp),
        )
        conn.commit()
        new_id = cursor.lastrowid
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        conn.close()

    new_reading = {
        "id": new_id,
        "sensor_name": reading.sensor_name,
        "value": reading.value,
        "timestamp": timestamp,
    }

    await manager.broadcast(new_reading)  # push live to every WebSocket client
    return new_reading

# ---------------------------------------------------------------------------
# 8. REST ENDPOINT: GET ALL READINGS  (GET /readings)
# ---------------------------------------------------------------------------
@app.get("/readings", response_model=List[ReadingOut])
def get_readings(limit: int = 50):
    conn = get_db_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM readings ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    finally:
        conn.close()
    return [dict(row) for row in rows]

# ---------------------------------------------------------------------------
# 9. REST ENDPOINT: GET ONE READING BY ID  (GET /readings/{id})
# ---------------------------------------------------------------------------
@app.get("/readings/{reading_id}", response_model=ReadingOut)
def get_reading(reading_id: int):
    conn = get_db_connection()
    try:
        row = conn.execute(
            "SELECT * FROM readings WHERE id = ?", (reading_id,)
        ).fetchone()
    finally:
        conn.close()

    if row is None:
        raise HTTPException(
            status_code=404, detail=f"No reading found with id {reading_id}"
        )
    return dict(row)

# ---------------------------------------------------------------------------
# 10. WEBSOCKET ENDPOINT  (ws://127.0.0.1:8000/ws)
# ---------------------------------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            sensor_name = data.get("sensor_name", "unknown")
            value = data.get("value")

            if value is None:
                await websocket.send_json({"error": "Missing 'value' field"})
                continue

            timestamp = datetime.now(timezone.utc).isoformat()
            conn = get_db_connection()
            try:
                cursor = conn.execute(
                    "INSERT INTO readings (sensor_name, value, timestamp) VALUES (?, ?, ?)",
                    (sensor_name, value, timestamp),
                )
                conn.commit()
                new_id = cursor.lastrowid
            finally:
                conn.close()

            new_reading = {
                "id": new_id,
                "sensor_name": sensor_name,
                "value": value,
                "timestamp": timestamp,
            }
            await manager.broadcast(new_reading)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
