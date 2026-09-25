import { isCreationInProgress } from './lib/creation-guard';
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/cinzel/400.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// ── Service Worker update coordination ──────────────────────────────────────
// When a new service worker activates (via skipWaiting in workbox config),
// the browser fires 'controllerchange'. At that point we force a reload so
// the page re-requests HTML (NetworkFirst) and gets the new bundle hashes.
// A reload flag prevents infinite reload loops.
if ('serviceWorker' in navigator) {
  // On a first visit there is no controller yet. The page already runs the newest
  // code, so the first takeover must NOT reload (it used to wipe character creation).
  const hadControllerAtStart = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    if (!hadControllerAtStart) {
      console.log('[SW] First install took control, no reload needed');
      return;
    }
    if (isCreationInProgress()) {
      console.log('[SW] Update ready, but a character is being created. The new version loads next time the app opens.');
      return;
    }
    reloaded = true;
    console.log('[SW] New service worker activated, reloading for fresh bundles');
    window.location.reload();
  });
}
