import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Support both: WP shortcode div and Vite dev's index.html div
const MOUNT_IDS = ["mortgage-master-root", "root"];

let target: HTMLElement | null = null;
for (const id of MOUNT_IDS) {
  const el = document.getElementById(id);
  if (el) { target = el; break; }
}

// Optional: if in dev and nothing found, create a fallback container
if (!target && import.meta.env.DEV) {
  target = document.createElement("div");
  target.id = "root";
  document.body.appendChild(target);
  console.warn(
    '[MMT] No mount element found; created <div id="root"> for dev fallback.'
  );
}

if (target) {
  ReactDOM.createRoot(target).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error(
    '[MMT] No mount element found. Expected one of: #mortgage-master-root or #root.'
  );
}
