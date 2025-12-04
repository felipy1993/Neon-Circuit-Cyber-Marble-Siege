import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Setup CSS variable --vh to reliably represent viewport height on mobile
const setVh = () => {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
};

// Setup UI scale variable to slightly reduce HUD on very tall / high-density phones
const computeUiScale = () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  // Heuristic: Full HD tall phones (1080x~2400) often need a small reduction
  if (w >= 1080 && h >= 2000) return 0.92;
  if (w >= 900 && h >= 1600) return 0.95;
  if (dpr >= 3 && w >= 720) return 0.95;
  return 1;
};

const setUiScale = () => {
  const scale = computeUiScale();
  document.documentElement.style.setProperty("--ui-scale", String(scale));
};

const recalibrateUI = () => {
  setVh();
  setUiScale();
};

setVh();
setUiScale();
window.addEventListener("resize", recalibrateUI);
window.addEventListener("orientationchange", recalibrateUI);

// expose for debug / manual recalibration from UI
(window as any).recalibrateUI = recalibrateUI;

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
