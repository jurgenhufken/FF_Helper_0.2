// popup.js
const browserApi = typeof browser !== "undefined" ? browser : chrome;

const DEFAULT_SETTINGS = {
  frameCount: 5,
  intervalMs: 200,
  useBurstForToolbar: false,
  useTitleInFilename: true
};

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

function saveSettings(settings) {
  const storage = getStorage();
  if (!storage) return Promise.resolve();

  return new Promise((resolve) => {
    storage.set({ ytHqCaptureSettings: settings }, () => resolve());
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const frameCountInput = document.getElementById("frameCount");
  const intervalMsInput = document.getElementById("intervalMs");
  const useBurstForToolbarInput = document.getElementById("useBurstForToolbar");
  const useTitleInFilenameInput = document.getElementById("useTitleInFilename");

  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const singleCaptureBtn = document.getElementById("singleCaptureBtn");
  const burstCaptureBtn = document.getElementById("burstCaptureBtn");

  const settings = await loadSettings();

  frameCountInput.value = settings.frameCount;
  intervalMsInput.value = settings.intervalMs;
  useBurstForToolbarInput.checked = settings.useBurstForToolbar;
  useTitleInFilenameInput.checked = settings.useTitleInFilename;

  saveSettingsBtn.addEventListener("click", async () => {
    const newSettings = {
      frameCount: parseInt(frameCountInput.value, 10) || DEFAULT_SETTINGS.frameCount,
      intervalMs: parseInt(intervalMsInput.value, 10) || DEFAULT_SETTINGS.intervalMs,
      useBurstForToolbar: !!useBurstForToolbarInput.checked,
      useTitleInFilename: !!useTitleInFilenameInput.checked
    };

    await saveSettings(newSettings);

    browserApi.runtime.sendMessage({
      type: "SAVE_SETTINGS",
      settings: newSettings
    });

    window.close();
  });

  singleCaptureBtn.addEventListener("click", () => {
    browserApi.runtime.sendMessage({ type: "POPUP_CAPTURE_SINGLE" });
    window.close();
  });

  burstCaptureBtn.addEventListener("click", () => {
    browserApi.runtime.sendMessage({ type: "POPUP_CAPTURE_BURST" });
    window.close();
  });
});
