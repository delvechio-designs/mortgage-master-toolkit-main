// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

/**
 * We’ll accept any of these mount points:
 *  - <div id="mortgage-master-root"></div>     (WP shortcode)
 *  - <div id="root"></div>                     (dev/Vite)
 *  - <div data-mmtk-root></div>                (optional data-attr target)
 */
const SELECTORS = ["#mortgage-master-root", "#root", "[data-mmtk-root]"];

let mounted = false;
let root: ReactDOM.Root | null = null;

function findTarget(): HTMLElement | null {
  for (const sel of SELECTORS) {
    const el = document.querySelector(sel);
    if (el) return el as HTMLElement;
  }
  return null;
}

function mountIfReady(): boolean {
  if (mounted) return true;
  const target = findTarget();

  // Dev fallback: create a container if none exists
  if (!target && import.meta.env.DEV) {
    const el = document.createElement("div");
    el.id = "root";
    document.body.appendChild(el);
    console.warn(
      "[MMT] No mount element found; created <div id='root'> for dev fallback."
    );
    return mountIfReady(); // try again now that it exists
  }

  if (!target) return false;

  root = ReactDOM.createRoot(target);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  mounted = true;
  return true;
}

// 1) Try immediately (in case the shortcode HTML is already on the page)
if (!mountIfReady()) {
  const onReady = () => {
    if (mountIfReady()) return;

    // 2) Observe DOM for dynamically inserted shortcode content.
    // IMPORTANT: always observe a real Node (document.body), never a null target.
    const mo = new MutationObserver(() => {
      if (mountIfReady()) mo.disconnect();
    });
    mo.observe(document.body, { childList: true, subtree: true });
  };

  // 2a) Wait for DOM if still loading
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady, { once: true });
  } else {
    onReady();
  }
}
