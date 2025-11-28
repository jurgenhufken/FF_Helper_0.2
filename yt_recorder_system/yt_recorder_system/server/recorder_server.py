import os
import platform
import subprocess
import datetime
import sqlite3
from pathlib import Path
from typing import Optional, Dict, List

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel

app = FastAPI(title="YT Region Recorder Server")

PROCESSES: Dict[int, subprocess.Popen] = {}

BASE_DIR = Path.home() / "yt_recorder_server"
BASE_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = BASE_DIR / "recordings.db"

DOWNLOADS_DIR = Path.home() / "Downloads"
CLIP_DIR = DOWNLOADS_DIR
CLIP_DIR.mkdir(parents=True, exist_ok=True)


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS recordings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            url TEXT,
            start_time TEXT,
            end_time TEXT,
            duration REAL,
            path TEXT,
            x INTEGER,
            y INTEGER,
            width INTEGER,
            height INTEGER,
            fps INTEGER,
            tags TEXT,
            note TEXT
        )
        """
    )
    conn.commit()
    conn.close()


init_db()


class StartRequest(BaseModel):
    x: int
    y: int
    width: int
    height: int
    fps: int = 30
    title: Optional[str] = None
    url: Optional[str] = None


class StartResponse(BaseModel):
    ok: bool
    recording_id: Optional[int] = None
    path: Optional[str] = None
    error: Optional[str] = None


class StopRequest(BaseModel):
    recording_id: int


class StopResponse(BaseModel):
    ok: bool
    recording_id: Optional[int] = None
    path: Optional[str] = None
    error: Optional[str] = None


class TagsUpdate(BaseModel):
    tags: Optional[str] = None
    note: Optional[str] = None


def build_ffmpeg_cmd(x, y, width, height, fps, output_path: Path):
    system = platform.system().lower()

    if system == "windows":
        cmd = [
            "ffmpeg",
            "-f", "gdigrab",
            "-framerate", str(fps),
            "-offset_x", str(x),
            "-offset_y", str(y),
            "-video_size", f"{width}x{height}",
            "-i", "desktop",
            # Audio: gebruik de dshow virtual-audio-capturer om systeemgeluid mee te nemen
            "-f", "dshow",
            "-i", "audio=virtual-audio-capturer",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "16",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "160k",
            "-y",
            str(output_path),
        ]
    elif system == "linux":
        display = os.environ.get("DISPLAY", ":0.0")
        cmd = [
            "ffmpeg",
            "-f", "x11grab",
            "-framerate", str(fps),
            "-video_size", f"{width}x{height}",
            "-i", f"{display}+{x},{y}",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "16",
            "-pix_fmt", "yuv420p",
            "-y",
            str(output_path),
        ]
    elif system == "darwin":
        cmd = [
            "ffmpeg",
            "-f", "avfoundation",
            "-framerate", str(fps),
            "-i", "1:none",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "16",
            "-pix_fmt", "yuv420p",
            "-y",
            str(output_path),
        ]
    else:
        raise RuntimeError(f"Onbekend systeem: {system}")

    return cmd


def db_insert_record(title, url, path, x, y, width, height, fps):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    start_time = datetime.datetime.now().isoformat()
    cur.execute(
        """
        INSERT INTO recordings (title, url, start_time, end_time, duration, path, x, y, width, height, fps, tags, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        ,
        (title, url, start_time, None, None, str(path), x, y, width, height, fps, "", ""),
    )
    conn.commit()
    recording_id = cur.lastrowid
    conn.close()
    return recording_id


def db_update_end_time_and_duration(recording_id):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("SELECT start_time, path FROM recordings WHERE id = ?", (recording_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return None

    start_time_str, path = row
    end_time = datetime.datetime.now()
    duration = None
    try:
        start_dt = datetime.datetime.fromisoformat(start_time_str)
        duration = (end_time - start_dt).total_seconds()
    except Exception:
        duration = None

    cur.execute(
        """
        UPDATE recordings
        SET end_time = ?, duration = ?
        WHERE id = ?
        """
        ,
        (end_time.isoformat(), duration, recording_id),
    )
    conn.commit()
    conn.close()
    return path


def db_list_recordings(search: Optional[str] = None, tag_filter: Optional[str] = None):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    query = "SELECT id, title, url, start_time, end_time, duration, path, tags, note FROM recordings"
    params: List[str] = []

    conditions = []
    if search:
        conditions.append("(title LIKE ? OR url LIKE ?)")
        pattern = f"%{search}%"
        params.extend([pattern, pattern])
    if tag_filter:
        conditions.append("tags LIKE ?")
        params.append(f"%{tag_filter}%")

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY id DESC"

    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()
    return rows


@app.post("/record/start", response_model=StartResponse)
def start_recording(req: StartRequest):
    now = datetime.datetime.now()
    ts = now.strftime("%Y%m%d_%H%M%S")

    raw_title = (req.title or "yt_clip").strip()
    safe_chars = []
    for ch in raw_title:
        if ch.isalnum() or ch in (" ", "_", "-", "#"):
            safe_chars.append(ch)
        else:
            safe_chars.append("_")
    sanitized_title = "".join(safe_chars)
    base_title = sanitized_title.replace(" ", "_")[:60]
    filename = f"{base_title}_{ts}.mp4"
    output_path = CLIP_DIR / filename

    # Zorg dat breedte/hoogte even zijn voor yuv420p-compatibiliteit
    safe_width = req.width - (req.width % 2)
    safe_height = req.height - (req.height % 2)
    if safe_width <= 0 or safe_height <= 0:
        raise HTTPException(status_code=400, detail="Ongeldige afmetingen voor opnamegebied")

    recording_id = db_insert_record(
        req.title or "", req.url or "", output_path, req.x, req.y, safe_width, safe_height, req.fps
    )

    cmd = build_ffmpeg_cmd(req.x, req.y, safe_width, safe_height, req.fps, output_path)

    try:
        # Laat ffmpeg stdout/stderr erven van het serverproces zodat we fouten kunnen zien
        # in de terminal in plaats van ze te verbergen. Dit helpt bij het debuggen van
        # corrupte bestanden.
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="ffmpeg niet gevonden in PATH")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kon ffmpeg niet starten: {e}")

    PROCESSES[recording_id] = proc

    return StartResponse(ok=True, recording_id=recording_id, path=str(output_path))


@app.post("/record/stop", response_model=StopResponse)
def stop_recording(req: StopRequest):
    recording_id = req.recording_id
    proc = PROCESSES.get(recording_id)

    if not proc:
        return StopResponse(ok=False, error="Geen actief proces voor deze recording_id")

    try:
        # Stuur 'q' naar ffmpeg en wacht tot het proces netjes afsluit,
        # zodat de mp4 volledig wordt weggeschreven (moov atom, audio, etc.).
        proc.communicate(input=b"q")
    except Exception:
        try:
            proc.terminate()
        except Exception:
            pass

    PROCESSES.pop(recording_id, None)
    path = db_update_end_time_and_duration(recording_id)

    return StopResponse(ok=True, recording_id=recording_id, path=path)


@app.get("/recordings")
def list_recordings_api(
    search: Optional[str] = Query(default=None),
    tag: Optional[str] = Query(default=None),
):
    rows = db_list_recordings(search=search, tag_filter=tag)
    result = []
    for r in rows:
        result.append(
            {
                "id": r[0],
                "title": r[1],
                "url": r[2],
                "start_time": r[3],
                "end_time": r[4],
                "duration": r[5],
                "path": r[6],
                "tags": r[7] or "",
                "note": r[8] or "",
            }
        )
    return result


@app.post("/recordings/{rec_id}/tags")
def update_tags(rec_id: int, payload: TagsUpdate):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("SELECT id FROM recordings WHERE id = ?", (rec_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Record niet gevonden")

    tags = payload.tags if payload.tags is not None else ""
    note = payload.note if payload.note is not None else ""

    cur.execute(
        """
        UPDATE recordings
        SET tags = ?, note = ?
        WHERE id = ?
        """
        ,
        (tags, note, rec_id),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/clip/{rec_id}")
def get_clip(rec_id: int):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT path FROM recordings WHERE id = ?", (rec_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Clip niet gevonden")

    clip_path = Path(row[0])
    if not clip_path.exists():
        raise HTTPException(status_code=404, detail="Bestand bestaat niet")

    return FileResponse(clip_path, media_type="video/mp4", filename=clip_path.name)


@app.get("/ui", response_class=HTMLResponse)
def ui(
    search: Optional[str] = Query(default=None),
    tag: Optional[str] = Query(default=None),
):
    rows = db_list_recordings(search=search, tag_filter=tag)

    def esc(s: Optional[str]) -> str:
        if s is None:
            return ""
        return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    html_rows = []
    for r in rows:
        rec_id, title, url, start_t, end_t, duration, path, tags, note = r
        dur_str = f"{duration:.1f}s" if duration is not None else ""
        clip_link = f"/clip/{rec_id}"
        html_rows.append(
            f"""
            <tr>
              <td>{rec_id}</td>
              <td>{esc(title)}</td>
              <td><a href="{esc(url)}" target="_blank">link</a></td>
              <td>{esc(start_t or "")}</td>
              <td>{esc(end_t or "")}</td>
              <td>{dur_str}</td>
              <td><a href="{clip_link}" target="_blank">clip</a></td>
              <td>
                <input type="text" value="{esc(tags or '')}" data-id="{rec_id}" class="tags-input" />
              </td>
              <td>
                <input type="text" value="{esc(note or '')}" data-id="{rec_id}" class="note-input" />
              </td>
            </tr>
            """
        )

    html = f"""
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>YT Recorder Dashboard</title>
        <style>
          body {{ font-family: system-ui, sans-serif; font-size: 13px; margin: 10px; }}
          table {{ border-collapse: collapse; width: 100%; }}
          th, td {{ border: 1px solid #ccc; padding: 4px; vertical-align: top; }}
          th {{ background: #eee; }}
          input[type="text"] {{ width: 100%; box-sizing: border-box; }}
          .filter-form {{ margin-bottom: 10px; }}
          .filter-form input {{ margin-right: 4px; }}
        </style>
      </head>
      <body>
        <h1>YT Recorder Dashboard</h1>
        <form class="filter-form" method="get" action="/ui">
          <input type="text" name="search" placeholder="zoek in titel/url" value="{esc(search or '')}" />
          <input type="text" name="tag" placeholder="filter op tag" value="{esc(tag or '')}" />
          <button type="submit">Filter</button>
          <a href="/ui">Reset</a>
        </form>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Titel</th>
              <th>URL</th>
              <th>Start</th>
              <th>Einde</th>
              <th>Duur</th>
              <th>Clip</th>
              <th>Tags</th>
              <th>Notitie</th>
            </tr>
          </thead>
          <tbody>
            {''.join(html_rows)}
          </tbody>
        </table>

        <script>
          async function updateField(id, tags, note) {{
            const payload = {{
              tags: tags,
              note: note
            }};
            try {{
              await fetch("/recordings/" + id + "/tags", {{
                method: "POST",
                headers: {{ "Content-Type": "application/json" }},
                body: JSON.stringify(payload)
              }});
            }} catch (e) {{
              console.error("Fout bij update tags/note:", e);
            }}
          }}

          document.addEventListener("change", (ev) => {{
            if (ev.target.classList.contains("tags-input") ||
                ev.target.classList.contains("note-input")) {{
              const tr = ev.target.closest("tr");
              if (!tr) return;
              const idCell = tr.querySelector("td");
              const id = idCell ? idCell.textContent.trim() : null;
              if (!id) return;

              const tagsInput = tr.querySelector(".tags-input");
              const noteInput = tr.querySelector(".note-input");
              const tags = tagsInput ? tagsInput.value : "";
              const note = noteInput ? noteInput.value : "";
              updateField(id, tags, note);
            }}
          }});
        </script>
      </body>
    </html>
    """
    return HTMLResponse(html)
