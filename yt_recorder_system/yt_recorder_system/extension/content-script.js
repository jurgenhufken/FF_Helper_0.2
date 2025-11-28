// content-script.js
(function () {
  const browserApi =
    typeof browser !== "undefined"
      ? browser
      : typeof chrome !== "undefined" && chrome.runtime
        ? chrome
        : null;
  let isRecording = false;

  try {
    console.log("[YT-REC v2] content script loaded");
  } catch (e) {
    // ignore
  }

  function getMainVideoRect() {
    const video =
      document.querySelector("video.html5-main-video") ||
      document.querySelector("video");

    if (!video) return null;

    const rect = video.getBoundingClientRect();

    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
  }

  function getVideoTitle() {
    const h1 =
      document.querySelector("h1.title yt-formatted-string") ||
      document.querySelector("h1.title") ||
      document.querySelector("h1#title");

    if (h1 && h1.textContent) {
      return h1.textContent.trim();
    }
    return (document.title || "youtube-video").trim();
  }

  function createFloatingRecorderButton() {
    let btn = document.getElementById("yt-recorder-floating-btn");

    if (btn) {
      try {
        console.log("[YT-REC] reusing existing floating button");
      } catch (e) {
        // ignore
      }
    } else {
      try {
        console.log("[YT-REC] creating floating recorder button");
      } catch (e) {
        // ignore
      }

      btn = document.createElement("button");
      btn.id = "yt-recorder-floating-btn";

      if (document.body) {
        document.body.appendChild(btn);
      } else {
        document.documentElement.appendChild(btn);
      }
    }

    const style = btn.style;
    style.position = "fixed";
    style.bottom = "80px";
    style.right = "20px";
    style.zIndex = "2147483647";
    style.padding = "6px 10px";
    style.backgroundColor = isRecording ? "#b71c1c" : "#e53935";
    style.color = "#ffffff";
    style.border = "none";
    style.borderRadius = "4px";
    style.cursor = "pointer";
    style.fontSize = "12px";
    style.fontFamily = "system-ui, sans-serif";

    btn.textContent = isRecording ? "STOP" : "REC";

    if (!btn.dataset.ytRecHandlerAttached) {
      btn.dataset.ytRecHandlerAttached = "1";

      btn.addEventListener("click", function () {
        // UI altijd toggelen
        isRecording = !isRecording;
        btn.textContent = isRecording ? "STOP" : "REC";
        btn.style.backgroundColor = isRecording ? "#b71c1c" : "#e53935";

        // En alleen als de runtime beschikbaar is, ook de background laten toggelen
        if (!browserApi || !browserApi.runtime || !browserApi.runtime.sendMessage) {
          try {
            console.warn("[YT-REC v2] cannot send POPUP_TOGGLE_RECORDING, no runtime");
          } catch (e) {
            // ignore
          }
          return;
        }

        try {
          browserApi.runtime.sendMessage({ type: "POPUP_TOGGLE_RECORDING" });
        } catch (e) {
          try {
            console.error("[YT-REC v2] error sending POPUP_TOGGLE_RECORDING", e);
          } catch (_) {
            // ignore
          }
        }
      });
    }
  }

  if (browserApi && browserApi.runtime && browserApi.runtime.onMessage) {
    try {
      console.log("[YT-REC v2] installing runtime listener");
    } catch (e) {
      // ignore
    }

    browserApi.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || !msg.type) return;

      if (msg.type === "GET_VIDEO_INFO") {
        const rect = getMainVideoRect();
        if (!rect) {
          sendResponse({ ok: false, error: "Geen <video> element gevonden" });
          return;
        }

        const dpr = window.devicePixelRatio || 1;
        const title = getVideoTitle();

        // Reken viewport-coördinaten om naar schermcoördinaten (CSS pixels)
        const screenX = (window.screenX ?? window.screenLeft ?? 0);
        const screenY = (window.screenY ?? window.screenTop ?? 0);
        const outerW = window.outerWidth || window.innerWidth;
        const outerH = window.outerHeight || window.innerHeight;
        const innerW = window.innerWidth;
        const innerH = window.innerHeight;

        const borderX = Math.max(0, (outerW - innerW) / 2);
        const borderY = Math.max(0, outerH - innerH);

        const absRect = {
          x: screenX + borderX + rect.x,
          y: screenY + borderY + rect.y,
          width: rect.width,
          height: rect.height,
        };

        sendResponse({ ok: true, rect: absRect, dpr, title });
      }
    });
  } else {
    try {
      console.warn("[YT-REC v2] browserApi.runtime not available in content script");
    } catch (e) {
      // ignore
    }
  }

  function ensureFloatingButtonLoop() {
    try {
      createFloatingRecorderButton();
    } catch (e) {
      try {
        console.error("[YT-REC] error while creating floating button", e);
      } catch (_) {
        // ignore
      }
    }
  }

  try {
    console.log("[YT-REC v2] starting ensureFloatingButtonLoop");
  } catch (e) {
    // ignore
  }

  // Direct proberen
  ensureFloatingButtonLoop();
  // En daarna periodiek nog eens, zodat de knop ook verschijnt als YouTube later de DOM wijzigt
  setInterval(ensureFloatingButtonLoop, 2000);
})();
