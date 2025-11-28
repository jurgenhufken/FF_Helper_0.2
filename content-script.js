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

  function ensureVideoReady(video) {
    if (!video) return Promise.resolve();
    if (video.readyState >= 2 && (video.videoWidth || video.clientWidth)) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        video.removeEventListener("loadeddata", finish);
        video.removeEventListener("loadedmetadata", finish);
        video.removeEventListener("resize", finish);
        clearTimeout(timer);
        resolve();
      };
      video.addEventListener("loadeddata", finish, { once: true });
      video.addEventListener("loadedmetadata", finish, { once: true });
      video.addEventListener("resize", finish, { once: true });
      const timer = setTimeout(finish, 4000);
    });
  }

  async function captureVideoFrameElement(format) {
    try {
      const videos = Array.from(document.querySelectorAll("video"));
      if (!videos.length) {
        return { ok: false, error: "Geen video-element gevonden" };
      }

      const video = videos.sort((a, b) => {
        const areaA = (a.videoWidth || a.clientWidth || 0) * (a.videoHeight || a.clientHeight || 0);
        const areaB = (b.videoWidth || b.clientWidth || 0) * (b.videoHeight || b.clientHeight || 0);
        return areaB - areaA;
      })[0];

      await ensureVideoReady(video);

      const baseW = video.videoWidth || video.clientWidth;
      const baseH = video.videoHeight || video.clientHeight;
      if (!baseW || !baseH) {
        return { ok: false, error: "Video heeft geen resolutie beschikbaar" };
      }

      let width = baseW * 2;
      let height = baseH * 2;

      const maxDim = 4096;
      if (width > maxDim || height > maxDim) {
        const factor = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * factor);
        height = Math.round(height * factor);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return { ok: false, error: "Canvas-context niet beschikbaar" };
      }

      ctx.imageSmoothingEnabled = true;
      if (typeof ctx.imageSmoothingQuality !== "undefined") {
        ctx.imageSmoothingQuality = "high";
      }

      ctx.drawImage(video, 0, 0, width, height);

      const useJpeg = format === "jpeg";
      let dataUrl;
      if (useJpeg) {
        dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      } else {
        dataUrl = canvas.toDataURL("image/png");
      }

      console.log("[YTHQ] captureVideoFrameElement", { baseW, baseH, width, height });

      return { ok: true, dataUrl, width, height };
    } catch (e) {
      console.error("[YTHQ] captureVideoFrameElement fout:", e);
      return {
        ok: false,
        error: e && e.message ? e.message : String(e)
      };
    }
  }

  function createFloatingButton() {
    if (document.getElementById("ythq-floating-capture")) return;

    const wrapper = document.createElement("div");
    wrapper.id = "ythq-floating-capture";
    wrapper.style.position = "fixed";
    wrapper.style.top = "120px";
    wrapper.style.right = "24px";
    wrapper.style.zIndex = "99999";
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.gap = "4px";

    const baseButtonStyle = (btn) => {
      btn.style.padding = "4px 8px";
      btn.style.fontSize = "11px";
      btn.style.background = "rgba(0,0,0,0.7)";
      btn.style.color = "#fff";
      btn.style.border = "1px solid rgba(255,255,255,0.4)";
      btn.style.borderRadius = "4px";
      btn.style.cursor = "pointer";
      btn.style.minWidth = "60px";
    };

    const btnJpg = document.createElement("button");
    btnJpg.textContent = "JPG";
    baseButtonStyle(btnJpg);
    btnJpg.addEventListener("click", () => {
      browserApi.runtime.sendMessage({ type: "FLOATING_CAPTURE_SINGLE_JPG" });
    });

    const btnBurst = document.createElement("button");
    btnBurst.textContent = "Burst";
    baseButtonStyle(btnBurst);
    btnBurst.addEventListener("click", () => {
      browserApi.runtime.sendMessage({ type: "FLOATING_CAPTURE_BURST" });
    });

    wrapper.appendChild(btnJpg);
    wrapper.appendChild(btnBurst);

    document.body.appendChild(wrapper);
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

  let lastHref = window.location.href;

  function checkRouteChange() {
    const current = window.location.href;
    if (current === lastHref) return;
    lastHref = current;
    initFloatingButton();
  }

  ["pushState", "replaceState"].forEach((method) => {
    const orig = history[method];
    if (typeof orig !== "function") return;
    history[method] = function () {
      const res = orig.apply(this, arguments);
      setTimeout(checkRouteChange, 80);
      return res;
    };
  });

  window.addEventListener("popstate", () => {
    setTimeout(checkRouteChange, 80);
  });

  new MutationObserver(() => {
    checkRouteChange();
  }).observe(document.documentElement, { childList: true, subtree: true });

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
    } else if (message.type === "CAPTURE_VIDEO_FRAME") {
      captureVideoFrameElement(message && message.format).then((result) => {
        sendResponse(result);
      });
      return true; // async response
    }
  });
  initFloatingButton();
})();
