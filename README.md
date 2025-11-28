# FF Helper 0.2 – YouTube HQ Screen Capture + Region Recorder

Deze repository bevat twee samenwerkende onderdelen:

- **YouTube HQ Screen Capture extensie** (root van deze repo)
  - Maakt hoge kwaliteit screenshots van YouTube-video's (single + burst).
- **YT Region Recorder systeem** (`yt_recorder_system/`)
  - Losse Python FastAPI-server + bijbehorende extensie om de videoregio naar ffmpeg te sturen en als clip op te nemen.

De screenshot-extensie kun je los gebruiken. Als je daarnaast de recorder-server draait + de recorder-extensie laadt, kun je vanuit de pagina ook **REC / STOP** doen en echte videoclips opnemen.

---

# YouTube HQ Screen Capture

Browserextensie voor Firefox/Chromium om **hoge kwaliteit screenshots** van YouTube-video's te maken. De extensie haalt een frame direct uit het `<video>`-element (zonder YouTube-UI) waar mogelijk, met een fallback naar een slimme crop van het zichtbare tabblad, en slaat de JPG-bestanden direct op in je downloadmap.

## Features

- **Single capture (JPG)**
  - Eén screenshot van de huidige video player als JPG.
  - Via popup-knop, floating toolbar op de pagina of sneltoets.
- **Burst mode**
  - Meerdere frames achter elkaar met instelbaar interval.
- **Directe videoframe + slimme crop**
  - Probeert eerst het grootste `<video>`-element direct naar een canvas te tekenen (intrinsieke capture, zonder UI).
  - Valt terug op een crop van het zichtbare tabblad tot alleen het videogebied (zonder YouTube-bovenbalk en afgeronde hoeken) als directe capture niet lukt.
- **Floating capture-toolbar**
  - Kleine zwevende toolbar rechtsboven op elke `watch`-pagina.
  - Knoppen: `JPG` (single frame) en `Burst` (meerdere frames).
  - Werkt ook als de popup niet open is.
- **Bestandsnamen met context**
  - Formaat:
    - `host__kanaal__titel_YYYYMMDD_HHMMSS_fNNN.jpg`
    - Voorbeeld: `www_youtube_com__MyChannel__My_Video_20251127_231234_f001.jpg`
- **Automatisch naar Downloads**
  - Gebruikt de standaard downloadlocatie van de browser.
- **Instelbare instellingen via popup**
  - Aantal frames voor burst.
  - Interval tussen frames (ms).
  - Of burst gebruikt moet worden voor toolbar-acties.
  - Of de videotitel in de bestandsnaam gebruikt wordt.

## Installatie extensie (Firefox)

1. Download of clone deze repository.
2. Ga in Firefox naar `about:debugging` → **This Firefox**.
3. Klik op **Load Temporary Add-on… / Tijdelijke add-on laden…**.
4. Kies `manifest.json` in de rootmap van deze repo.
5. De extensie verschijnt nu in de toolbar.

> Let op: tijdelijke add-ons verdwijnen na het herstarten van Firefox. Voor permanent gebruik kun je dit project als eigen add-on packagen/ondertekenen via AMO.

## Installatie extensie (Chromium/Chrome/Edge)

1. Open `chrome://extensions` (of `edge://extensions`).
2. Zet **Developer mode / Ontwikkelaarsmodus** aan.
3. Kies **Load unpacked** en selecteer de rootmap van deze repo.

## Gebruik

### Floating toolbar (aanbevolen)

- Open een YouTube-video: `https://www.youtube.com/watch?v=...`.
- Wacht een moment tot de kleine zwevende toolbar rechtsboven in beeld verschijnt.
- Knoppen:
  - **JPG** → één JPG-screenshot (directe videoframe waar mogelijk).
  - **Burst** → meerdere JPG-screenshots achter elkaar (aantal/interval volgens settings).

### Popup

- Klik op het extensie-icoon om de popup te openen.
- Knoppen:
  - **Single JPG** → één JPG-screenshot.
  - **Burst JPG (burst)** → meerdere JPG-screenshots volgens de ingestelde waarden.
- Je kunt hier ook de instellingen aanpassen en opslaan.

### Sneltoetsen (indien geconfigureerd door de browser)

- `Ctrl+Shift+Y` → single capture
- `Ctrl+Shift+U` → burst capture

(De daadwerkelijke toetsencombinaties kunnen per browser/OS verschillen; ze zijn gedefinieerd in `manifest.json`.)

## Bestandsnaam-schema

De bestandsnaam wordt opgebouwd als:

```text
<host>__<kanaal>__<titel>_<YYYYMMDD>_<HHMMSS>_fNNN.jpg
```

- **host**: bijvoorbeeld `www_youtube_com`.
- **kanaal**: kanaalnaam van de video (genormaliseerd voor een bestandsnaam).
- **titel**: videotitel (genormaliseerd).
- **fNNN**: volgnummer, oplopend per capture-sessie (of per burst-frame).

Voorbeeld:

```text
www_youtube_com__Veritasium__This_Is_Why_Flying_Is_Safe_20251127_231234_f003.jpg
```

## Belangrijkste bestanden

- `manifest.json` – extensieconfiguratie (permissions, background, popup, content script, commands).
- `background.js` – hoofdlogica:
  - Vraagt videoinfo op bij het content-script.
  - Probeert eerst een directe capture van het `<video>`-element via canvas (zonder UI).
  - Cropt anders het screenshot van de zichtbare tab tot het videogebied.
  - Converteert de data-URL naar een blob-URL en start `downloads.download`.
  - Handelt popup-berichten, floating-berichten en sneltoetsen af.
- `content-script.js` – draait op YouTube:
  - Bepaalt het videorechthoek (met marge en zonder bovenbalk).
  - Leest titel + kanaalnaam + host/URL uit.
  - Stuurt deze info terug naar de background.
  - Plaatst de zwevende `JPG`/`Burst`-toolbar.
- `popup.html` / `popup.js` – UI en opslag van instellingen.

## Development

- Pas bestanden aan in de rootmap van deze extensie.
- Na elke wijziging:
  - In Firefox: `about:debugging` → **Reload** bij de extensie.
  - In Chromium/Chrome/Edge: `chrome://extensions` → **Reload**.
- Gebruik de **background console** om logs te zien:
  - Firefox: `about:debugging` → Inspect bij de extensie.
  - Chromium: `chrome://extensions` → klik op *service worker/background page*.

## Changelog extensie

- **v0.1.0** – eerste publieke versie
  - Single & burst capture.
  - Slimme crop van het videogebied (zonder YouTube-bovenbalk en afgeronde hoeken).
  - Floating `Capture`-knop op YouTube-watchpagina's.
  - Bestandsnaam met host + kanaal + titel + volgnummer.
  - Automatisch downloaden naar de standaard downloadmap.
  
- **v0.2.0** – JPG-only + directe videoframe-capture
  - Alle captures als JPG (single, burst, floating toolbar, popup, sneltoetsen).
  - Directe canvas-capture van het `<video>`-element waar mogelijk, met fallback naar crop van de zichtbare tab.
  - Zwevende `JPG`/`Burst`-toolbar op YouTube-watchpagina's.
  - Popup-knoppen hernoemd naar `Single JPG` en `Burst JPG (burst)`.

## Toekomstige ideeën (extensie)

- Mogelijkheid om meer sites dan alleen YouTube te ondersteunen.
- Extra opties voor het bestandsnaam-schema (bijv. resolutie, eigen prefix).
- Optionele overlay met timestamp/frame-informatie in de capture.
- Uitgebreidere instellingenpagina in plaats van alleen de popup.
- Meer configurabele sneltoetsen via de browser.

## Intrinsieke frame-captures (yt-dlp + ffmpeg)

De extensie gebruikt bewust alleen officiële WebExtension-API's en kan daarom **geen ruwe videoframes** uit YouTube trekken – alleen screenshots van wat je ziet. Voor echte framegrabs zonder UI kun je buiten de browser om werken:

1. **Installeer tools**
   - [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) (YouTube-downloader)
   - [`ffmpeg`](https://ffmpeg.org/) (video → frames)

2. **Download de video**

   ```bash
   yt-dlp -f bestvideo+bestaudio --merge-output-format mkv -o "video.%(ext)s" "https://www.youtube.com/watch?v=..."
   ```

3. **Extraheer frames met ffmpeg**

   Enkele voorbeelden:

   - Eén frame op een vaste tijd (bijv. 1 minuut 23 seconden):

     ```bash
     ffmpeg -ss 00:01:23 -i video.mkv -frames:v 1 frame_0123.png
     ```

   - Elke seconde één frame:

     ```bash
     ffmpeg -i video.mkv -vf "fps=1" frames/frame_%04d.png
     ```

   - Hogere framerate (bijv. 5 fps):

     ```bash
     ffmpeg -i video.mkv -vf "fps=5" frames/frame_%04d.png
     ```

Deze methode geeft je **exacte videoframes zonder overlays** (geen YouTube-UI, geen browserchrome), maar vereist wel dat je de video eerst lokaal downloadt.

> Let op: respecteer altijd de gebruiksvoorwaarden en auteursrechten van de content die je downloadt.

---

# YT Region Recorder systeem

In de map `yt_recorder_system/yt_recorder_system/` staat een losstaand systeem om de YouTube-videoregio (of andere sites) naar een **lokale recorder-server** te sturen. De server gebruikt ffmpeg om clips op te nemen en biedt een klein dashboard om opnames terug te kijken.

Belangrijkste onderdelen:

- `yt_recorder_system/yt_recorder_system/server/recorder_server.py`  
  FastAPI-server die via `/record/start` en `/record/stop` ffmpeg-opnames aanstuurt.
- `yt_recorder_system/yt_recorder_system/extension/`  
  Firefox-extensie die de videoregio bepaalt en REC / STOP-knoppen aanbiedt.

Een beknopte handleiding (inclusief installatie van dependencies en ffmpeg) staat in:

- `yt_recorder_system/yt_recorder_system/README.md`

In het kort:

1. Zorg dat Python en `ffmpeg` geïnstalleerd zijn.
2. Installeer de dependencies en start de server volgens de README in `yt_recorder_system/yt_recorder_system/`.
3. Laad de recorder-extensie (map `extension/`) als tijdelijke add-on in Firefox.
4. Open een YouTube-video, zorg dat de server draait en gebruik de REC / STOP-knop.

---

## Licentie

Kies zelf de gewenste licentie (bijv. MIT) en voeg een `LICENSE`-bestand toe als je deze code publiek wilt delen of laten forken.
