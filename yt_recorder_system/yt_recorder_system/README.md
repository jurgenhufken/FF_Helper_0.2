# YT Region Recorder System

Dit pakket bevat:

- `server/recorder_server.py` — FastAPI-server met ffmpeg-opname + dashboard.
- `extension/` — Firefox-extensie die de YouTube-playerregio doorstuurt naar de server.

## Server starten

1. Installeer Python dependencies:

   ```bash
   pip install fastapi uvicorn pydantic
   ```

   Zorg dat `ffmpeg` in je PATH staat:

   ```bash
   ffmpeg -version
   ```

2. Start de server:

   ```bash
   cd server
   uvicorn recorder_server:app --host 127.0.0.1 --port 8765
   ```

3. Dashboard openen:

   - Ga naar: `http://127.0.0.1:8765/ui`

## Extensie laden (Firefox)

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Kies **"Load Temporary Add-on…"**.
3. Selecteer `manifest.json` in de map `extension/`.

## Gebruik

1. Open een YouTube-video in Firefox.
2. Zorg dat de recorder-server draait.
3. Klik op het extensie-icoon en druk op **REC / STOP**:
   - Eerste klik → `/record/start` → ffmpeg begint op te nemen (beeld van de player).
   - Tweede klik → `/record/stop` → opname stopt, metadata wordt opgeslagen.

4. Bekijk clips en metadata in het dashboard (`/ui`):
   - Titel, URL, start/eind-tijd, duur, pad.
   - Tags en notities kun je inline aanpassen.
   - Clips kun je via de "clip"-link bekijken/downloaden.
