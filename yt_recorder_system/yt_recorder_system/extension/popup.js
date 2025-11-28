// popup.js
const browserApi = window.browser || window.chrome;

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("toggleBtn");
  btn.addEventListener("click", () => {
    browserApi.runtime.sendMessage({ type: "POPUP_TOGGLE_RECORDING" });
    window.close();
  });
});
