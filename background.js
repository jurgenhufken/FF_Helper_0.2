 // ---- video info opvragen uit content-script ----
const browserApi = typeof browser !== "undefined" ? browser : chrome;

const DEFAULT_SETTINGS = {
  frameCount: 5,
  intervalMs: 200,
  useBurstForToolbar: false,
  useTitleInFilename: true
};

let captureSequence = 0;

function getStorage() {
  return browserApi.storage && browserApi.storage.local;
}
 function loadSettings() {
   const storage = getStorage();
   if (!storage) {
     return Promise.resolve(DEFAULT_SETTINGS);
   }
   return new Promise((resolve) => {
     storage.get("ytHqCaptureSettings", (res) => {
       const s = res && res.ytHqCaptureSettings ? res.ytHqCaptureSettings : {};
       resolve(Object.assign({}, DEFAULT_SETTINGS, s));
     });
   });
 }

 async function requestVideoInfo(tabId) {
  try {
    // eerste poging: direct message sturen
    let response = await browserApi.tabs.sendMessage(tabId, {
      type: "GET_VIDEO_INFO"
    });

    // als er niks terugkomt, content-script handmatig injecteren en opnieuw proberen
    if (!response) {
      console.warn("Geen response van content-script, probeer injectie…");
      await browserApi.tabs.executeScript(tabId, { file: "content-script.js" });
      response = await browserApi.tabs.sendMessage(tabId, {
        type: "GET_VIDEO_INFO"
      });
    }

    return response;
  } catch (e) {
    console.error("Fout bij opvragen video-info (eerste poging):", e);

    // tweede poging: alsnog proberen te injecteren en opnieuw sturen
    try {
      await browserApi.tabs.executeScript(tabId, { file: "content-script.js" });
      const response = await browserApi.tabs.sendMessage(tabId, {
        type: "GET_VIDEO_INFO"
      });
      return response;
    } catch (e2) {
      console.error("Injectie + tweede poging mislukt:", e2);
      return { ok: false, error: e2 && e2.message ? e2.message : "Geen content-script" };
    }
  }
}


// ---- bestandsnaam / titel ----
function sanitizeTitle(title) {
  if (!title) return "youtube-video";
  return title
    .replace(/[\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function buildFilenameFromTitle(title, index, host, channel) {
  const baseTitle = sanitizeTitle(title);
  const baseHost = host ? sanitizeTitle(host) : "site";
  const baseChannel = channel ? sanitizeTitle(channel) : "channel";
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const h = pad(now.getHours());
  const min = pad(now.getMinutes());
  const s = pad(now.getSeconds());

  const idxPart = index != null ? `_f${String(index).padStart(3, "0")}` : "";

  return `${baseHost}__${baseChannel}__${baseTitle}_${y}${m}${d}_${h}${min}${s}${idxPart}.jpg`;
}

// ---- canvas-cropping ----
function cropDataUrlWithCanvas(dataUrl, rect, dpr, callback, outputMime, outputQuality) {
  const img = new Image();
  img.onload = () => {
    const scale = dpr || 1;

    const sx = rect.x * scale;
    const sy = rect.y * scale;
    const sw = rect.width * scale;
    const sh = rect.height * scale;

    console.log("[YTHQ] cropDataUrlWithCanvas", { scale, sx, sy, sw, sh });

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const mime = outputMime || "image/png";
    let croppedDataUrl;
    try {
      if (mime === "image/jpeg" && typeof outputQuality === "number") {
        croppedDataUrl = canvas.toDataURL(mime, outputQuality);
      } else {
        croppedDataUrl = canvas.toDataURL(mime);
      }
    } catch (e) {
      console.error("[YTHQ] canvas.toDataURL fout:", e);
      croppedDataUrl = canvas.toDataURL("image/png");
    }
    callback(croppedDataUrl);
  };
  img.src = dataUrl;
}

function dataUrlToBlobUrl(dataUrl) {
  try {
    const parts = dataUrl.split(",");
    if (parts.length < 2) {
      return dataUrl;
    }

    const mimeMatch = parts[0].match(/data:(.*?);base64/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";

    const bstr = atob(parts[1]);
    const len = bstr.length;
    const u8arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }

    const blob = new Blob([u8arr], { type: mime });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error("[YTHQ] dataUrlToBlobUrl fout:", e);
    return dataUrl;
  }
}

// ---- captures ----
async function captureSingleFrame(tab, index, baseTitle, settings, outputFormat) {
  if (!tab || !tab.id) return;
  if (!/youtube\.com/.test(tab.url || "")) return;

  let effectiveIndex = index;
  if (effectiveIndex == null) {
    captureSequence += 1;
    effectiveIndex = captureSequence;
  }

  console.log("[YTHQ] captureSingleFrame start", { index: effectiveIndex, baseTitle, url: tab.url });

  const info = await requestVideoInfo(tab.id);
  if (!info || !info.ok) {
    console.log("Kon video-info niet ophalen:", info && info.error);
    return;
  }

  const { rect, title, host, channel } = info;
  const dpr = rect.devicePixelRatio || 1;

  // We gebruiken overal JPEG als outputformaat
  const format = "jpeg";

  let usedDirectFrame = false;
  let frameData = null;

  try {
    frameData = await browserApi.tabs.sendMessage(tab.id, {
      type: "CAPTURE_VIDEO_FRAME",
      format
    });
  } catch (e) {
    console.warn("[YTHQ] CAPTURE_VIDEO_FRAME bericht fout:", e);
  }

  let dataUrl = null;

  if (frameData && frameData.ok && frameData.dataUrl) {
    usedDirectFrame = true;
    dataUrl = frameData.dataUrl;
    console.log("[YTHQ] gebruik directe videoframe", {
      width: frameData.width,
      height: frameData.height
    });
  } else {
    dataUrl = await browserApi.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: 95
    });

    console.log("[YTHQ] captureVisibleTab dataUrl length", dataUrl && dataUrl.length);
  }

  return new Promise((resolve) => {
    const handleDataUrl = (finalDataUrl) => {
      let effectiveTitle = baseTitle || title;
      if (settings && settings.useTitleInFilename === false) {
        effectiveTitle = "capture";
      }

      const filename = buildFilenameFromTitle(effectiveTitle, effectiveIndex, host, channel);
      console.log(
        "[YTHQ] start download",
        filename,
        usedDirectFrame ? "(directe video)" : "(schermcapture)"
      );

      const blobUrl = dataUrlToBlobUrl(finalDataUrl);
      console.log("[YTHQ] blobUrl created", !!blobUrl);

      if (!browserApi.downloads || !browserApi.downloads.download) {
        console.error("[YTHQ] downloads API niet beschikbaar");
        resolve();
        return;
      }

      try {
        const result = browserApi.downloads.download({
          url: blobUrl,
          filename: filename,
          saveAs: false
        });

        if (result && typeof result.then === "function") {
          result.then(
            (id) => console.log("[YTHQ] download gestart, id:", id),
            (err) => console.error("[YTHQ] download fout:", err)
          );
        }
      } catch (e) {
        console.error("[YTHQ] downloads.download exception:", e);
      }

      resolve();
    };

    if (usedDirectFrame) {
      handleDataUrl(dataUrl);
    } else {
      const mime = format === "jpeg" ? "image/jpeg" : "image/png";
      const quality = format === "jpeg" ? 0.95 : undefined;
      cropDataUrlWithCanvas(dataUrl, rect, dpr, (cropped) => {
        handleDataUrl(cropped);
      }, mime, quality);
    }
  });
}

async function captureBurst(tab, settings) {
  if (!tab || !tab.id) return;

  const info = await requestVideoInfo(tab.id);
  if (!info || !info.ok) {
    console.log("Kon video-info niet ophalen voor burst:", info && info.error);
    return;
  }

  const baseTitle = settings && settings.useTitleInFilename === false
    ? "capture"
    : info.title;

  const frameCount = Math.max(1, settings.frameCount | 0);
  const intervalMs = Math.max(0, settings.intervalMs | 0);

  for (let i = 0; i < frameCount; i++) {
    await captureSingleFrame(tab, i + 1, baseTitle, settings);
    if (i < frameCount - 1 && intervalMs > 0) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
}

async function handleCapture(tab, mode /* 'single' | 'burst' | 'autoToolbar' */, outputFormat) {
  if (!tab || !tab.id) return;
  if (!/youtube\.com/.test(tab.url || "")) {
    console.log("Geen YouTube-tab, skip.");
    return;
  }

  console.log("[YTHQ] handleCapture start", { mode, url: tab.url });

  const settings = await loadSettings();

  let effectiveMode = mode;
  if (mode === "autoToolbar") {
    effectiveMode = settings.useBurstForToolbar ? "burst" : "single";
  }

  if (effectiveMode === "burst") {
    await captureBurst(tab, settings);
  } else {
    await captureSingleFrame(tab, null, null, settings, outputFormat);
  }
}

// ---- commands (sneltoetsen) ----
browserApi.commands.onCommand.addListener((command) => {
  console.log("[YTHQ] command ontvangen", command);
  browserApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    const tab = tabs[0];

    if (command === "capture_youtube_single") {
      handleCapture(tab, "single");
    } else if (command === "capture_youtube_burst") {
      handleCapture(tab, "burst");
    }
  });
});

// ---- messages vanuit popup ----
browserApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  console.log("[YTHQ] runtime message", message.type);

  if (message.type === "POPUP_CAPTURE_SINGLE") {
    browserApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;
      handleCapture(tabs[0], "single");
    });
  } else if (message.type === "POPUP_CAPTURE_SINGLE_JPG") {
    browserApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;
      handleCapture(tabs[0], "single", "jpeg");
    });
  } else if (message.type === "FLOATING_CAPTURE_SINGLE") {
    browserApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;
      handleCapture(tabs[0], "single");
    });
  } else if (message.type === "FLOATING_CAPTURE_SINGLE_JPG") {
    browserApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;
      handleCapture(tabs[0], "single", "jpeg");
    });
  } else if (message.type === "FLOATING_CAPTURE_BURST") {
    browserApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;
      handleCapture(tabs[0], "burst");
    });
  } else if (message.type === "POPUP_CAPTURE_BURST") {
    browserApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;
      handleCapture(tabs[0], "burst");
    });
  } else if (message.type === "SAVE_SETTINGS" && message.settings) {
    const storage = getStorage();
    if (storage) {
      storage.set(
        { ytHqCaptureSettings: message.settings },
        () => sendResponse && sendResponse({ ok: true })
      );
      return true; // async response
    }
  }
});
