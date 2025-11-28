// background.js
const browserApi = typeof browser !== "undefined" ? browser : chrome;
const SERVER_URL = "http://127.0.0.1:8765";

let currentRecordingId = null;

async function getVideoInfo(tabId) {
  try {
    const resp = await browserApi.tabs.sendMessage(tabId, {
      type: "GET_VIDEO_INFO"
    });
    return resp;
  } catch (e) {
    console.error("Fout bij opvragen video-info:", e);
    return { ok: false, error: e && e.message };
  }
}

async function startRecordingForActiveTab() {
  const tabs = await browserApi.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !/youtube\.com/.test(tab.url || "")) {
    console.log("Geen YouTube-tab actief");
    return;
  }

  const info = await getVideoInfo(tab.id);
  if (!info || !info.ok) {
    console.log("Kon video-info niet ophalen:", info && info.error);
    return;
  }

  const { rect, dpr, title } = info;
  const payload = {
    x: Math.round(rect.x * dpr),
    y: Math.round(rect.y * dpr),
    width: Math.round(rect.width * dpr),
    height: Math.round(rect.height * dpr),
    fps: 30,
    title: title,
    url: tab.url
  };

  try {
    const res = await fetch(`${SERVER_URL}/record/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error("Server error bij /record/start:", res.status);
      return;
    }

    const data = await res.json();
    if (data.ok) {
      currentRecordingId = data.recording_id;
      console.log("Opname gestart:", data);
    } else {
      console.error("Start mislukt:", data.error);
    }
  } catch (e) {
    console.error("Fout bij fetch /record/start:", e);
  }
}

async function stopRecording() {
  if (!currentRecordingId) {
    console.log("Geen actieve opname");
    return;
  }

  try {
    const res = await fetch(`${SERVER_URL}/record/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recording_id: currentRecordingId })
    });

    if (!res.ok) {
      console.error("Server error bij /record/stop:", res.status);
      return;
    }

    const data = await res.json();
    if (data.ok) {
      console.log("Opname gestopt, bestand:", data.path);
    } else {
      console.error("Stop mislukt:", data.error);
    }
  } catch (e) {
    console.error("Fout bij fetch /record/stop:", e);
  }

  currentRecordingId = null;
}

async function toggleRecording() {
  if (currentRecordingId == null) {
    await startRecordingForActiveTab();
  } else {
    await stopRecording();
  }
}

browserApi.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === "POPUP_TOGGLE_RECORDING") {
    toggleRecording();
  }
});
