# YouTube HQ Screen Capture (FF_HELPER)

Browserextensie voor Firefox/Chromium om **hoge kwaliteit screenshots** van YouTube-video's te maken. De extensie crop’t automatisch alleen het videobeeld (zonder bovenbalk en afgeronde hoeken), en slaat de PNG-bestanden direct op in je downloadmap.

## Features

- **Single capture**
  - Eén screenshot van de huidige video player.
  - Via popup-knop, floating knop op de pagina of sneltoets.
- **Burst mode**
  - Meerdere frames achter elkaar met instelbaar interval.
- **Slimme crop**
  - Cropt het zichtbare tabblad tot alleen het videogebied.
  - Verwijdert YouTube-bovenbalk en afgeronde hoeken.
- **Floating capture-knop**
  - Kleine `Capture`-knop rechtsboven op elke `watch`-pagina.
  - Werkt ook als de popup niet open is.
- **Bestandsnamen met context**
  - Formaat:
    - `host__kanaal__titel_YYYYMMDD_HHMMSS_fNNN.png`
    - Voorbeeld: `www_youtube_com__MyChannel__My_Video_20251127_231234_f001.png`
- **Automatisch naar Downloads**
  - Gebruikt de standaard downloadlocatie van de browser.
- **Instelbare instellingen via popup**
  - Aantal frames voor burst.
  - Interval tussen frames (ms).
  - Of burst gebruikt moet worden voor toolbar-acties.
  - Of de videotitel in de bestandsnaam gebruikt wordt.

## Installatie (Firefox)

1. Download of clone deze repository.
2. Ga in Firefox naar `about:debugging` → **This Firefox**.
3. Klik op **Load Temporary Add-on… / Tijdelijke add-on laden…**.
4. Kies `manifest.json` in de map `youtube-hq-capture`.
5. De extensie verschijnt nu in de toolbar.

> Let op: tijdelijke add-ons verdwijnen na het herstarten van Firefox. Voor permanent gebruik kun je dit project als eigen add-on packagen/ondertekenen via AMO.

## Installatie (Chromium/Chrome/Edge)

1. Open `chrome://extensions` (of `edge://extensions`).
2. Zet **Developer mode / Ontwikkelaarsmodus** aan.
3. Kies **Load unpacked** en selecteer de map `youtube-hq-capture`.

## Gebruik

### Floating knop

- Open een YouTube-video: `https://www.youtube.com/watch?v=...`.
- Wacht een moment tot de **Capture**-knop rechtsboven in beeld verschijnt.
- Klik op **Capture**.
- Er wordt direct een PNG in je downloadmap geplaatst.

### Popup

- Klik op het extensie-icoon om de popup te openen.
- Knoppen:
  - **Single Capture** → één screenshot.
  - **Burst Capture** → meerdere screenshots volgens de ingestelde waarden.
- Je kunt hier ook de instellingen aanpassen en opslaan.

### Sneltoetsen (indien geconfigureerd door de browser)

- `Ctrl+Shift+Y` → single capture
- `Ctrl+Shift+U` → burst capture

(De daadwerkelijke toetsencombinaties kunnen per browser/OS verschillen; ze zijn gedefinieerd in `manifest.json`.)

## Bestandsnaam-schema

De bestandsnaam wordt opgebouwd als:

```text
<host>__<kanaal>__<titel>_<YYYYMMDD>_<HHMMSS>_fNNN.png
```

- **host**: bijvoorbeeld `www_youtube_com`.
- **kanaal**: kanaalnaam van de video (genormaliseerd voor een bestandsnaam).
- **titel**: videotitel (genormaliseerd).
- **fNNN**: volgnummer, oplopend per capture-sessie (of per burst-frame).

Voorbeeld:

```text
www_youtube_com__Veritasium__This_Is_Why_Flying_Is_Safe_20251127_231234_f003.png
```

## Belangrijkste bestanden

- `manifest.json` – extensieconfiguratie (permissions, background, popup, content script, commands).
- `background.js` – hoofdlogica:
  - Vraagt videoinfo op bij het content-script.
  - Maakt een screenshot van de zichtbare tab.
  - Cropt met een canvas tot het videogebied.
  - Converteert de data-URL naar een blob-URL en start `downloads.download`.
  - Handelt popup-berichten, floating-berichten en sneltoetsen af.
- `content-script.js` – draait op YouTube:
  - Bepaalt het videorechthoek (met marge en zonder bovenbalk).
  - Leest titel + kanaalnaam + host/URL uit.
  - Stuurt deze info terug naar de background.
  - Plaatst de floating `Capture`-knop.
- `popup.html` / `popup.js` – UI en opslag van instellingen.

## Development

- Pas bestanden aan in de `youtube-hq-capture`-map.
- Na elke wijziging:
  - In Firefox: `about:debugging` → **Reload** bij de extensie.
  - In Chromium/Chrome/Edge: `chrome://extensions` → **Reload**.
- Gebruik de **background console** om logs te zien:
  - Firefox: `about:debugging` → Inspect bij de extensie.
  - Chromium: `chrome://extensions` → klik op *service worker/background page*.

## Licentie

Kies zelf de gewenste licentie (bijv. MIT) en voeg een `LICENSE`-bestand toe als je deze code publiek wilt delen of laten forken.
