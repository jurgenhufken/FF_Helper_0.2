// content-script.js
(function () {
  const browserApi = typeof browser !== "undefined" ? browser : chrome;

  console.log("[YTHQ] content-script geladen op", window.location.href);

  function getMainVideoRect() {
    let video =
      document.querySelector("video.html5-main-video") ||
      document.querySelector("video");

    if (!video) {
      return null;
    }

    const rect = video.getBoundingClientRect();
    let top = rect.top;
    let bottom = rect.bottom;

    const masthead =
      document.getElementById("masthead-container") ||
      document.getElementById("masthead");

    if (masthead) {
      const mhRect = masthead.getBoundingClientRect();
      const mastheadBottom = mhRect.bottom;
      if (mastheadBottom > top) {
        top = mastheadBottom;
      }
    }

    const margin = 12; // kleine binnenmarge om afgeronde hoeken weg te snijden

    top += margin;
    bottom -= margin;

    const height = Math.max(0, bottom - top);

    return {
      x: rect.left + margin,
      y: top,
      width: Math.max(0, rect.width - margin * 2),
      height,
      devicePixelRatio: window.devicePixelRatio || 1
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

  function getChannelName() {
    const selectors = [
      "#owner #text-container a",
      "#owner ytd-channel-name a",
      "ytd-channel-name a"
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent) {
        return el.textContent.trim();
      }
    }
    return "";
  }

  function createFloatingButton() {
    if (document.getElementById("ythq-floating-capture")) return;

    const btn = document.createElement("button");
    btn.id = "ythq-floating-capture";
    btn.textContent = "Capture";
    btn.style.position = "fixed";
    btn.style.top = "120px";
    btn.style.right = "24px";
    btn.style.zIndex = "99999";
    btn.style.padding = "4px 8px";
    btn.style.fontSize = "12px";
    btn.style.background = "rgba(0,0,0,0.7)";
    btn.style.color = "#fff";
    btn.style.border = "1px solid rgba(255,255,255,0.4)";
    btn.style.borderRadius = "4px";
    btn.style.cursor = "pointer";

    btn.addEventListener("click", () => {
      browserApi.runtime.sendMessage({ type: "FLOATING_CAPTURE_SINGLE" });
    });

    document.body.appendChild(btn);
  }

  function initFloatingButton() {
    if (!/youtube\.com\/watch/.test(window.location.href)) return;

    let tries = 0;
    const maxTries = 20;
    const intervalId = setInterval(() => {
      const rect = getMainVideoRect();
      if (rect) {
        clearInterval(intervalId);
        createFloatingButton();
      } else if (++tries >= maxTries) {
        clearInterval(intervalId);
      }
    }, 500);
  }

  browserApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    console.log("[YTHQ] content-script message", message.type);

    if (message.type === "GET_VIDEO_INFO") {
      const rect = getMainVideoRect();
      if (!rect) {
        sendResponse({ ok: false, error: "Geen <video> element gevonden" });
        return; // ❗ GEEN 'return true' hier
      }

      const title = getVideoTitle();
      const host = window.location.host || "";
      const href = window.location.href || "";
      const channel = getChannelName();
      sendResponse({ ok: true, rect, title, host, href, channel });
      // ook hier GEEN 'return true' – we antwoorden synchroon
    }
  });
  initFloatingButton();
})();
