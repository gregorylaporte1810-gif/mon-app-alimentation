(() => {
  "use strict";

  const MANIFEST_URL =
    "https://raw.githubusercontent.com/gregorylaporte1810-gif/mon-app-alimentation/main/ota/latest.json";

  const PENDING_VERSION_KEY = "wellnessOtaPendingVersion";
  const ACTIVE_VERSION_KEY = "wellnessOtaActiveVersion";
  const LAST_CHECK_KEY = "wellnessOtaLastCheck";
  const CHECK_INTERVAL_MS = 15 * 60 * 1000;

  let updateCheckRunning = false;
  let updater = null;

  function isNativeCapacitor() {
    const cap = window.Capacitor;
    if (!cap) return false;

    if (typeof cap.isNativePlatform === "function") {
      return cap.isNativePlatform();
    }

    return cap.getPlatform?.() === "ios" || cap.getPlatform?.() === "android";
  }

  function getUpdaterPlugin() {
    return window.Capacitor?.Plugins?.CapacitorUpdater || null;
  }

  function showUpdateToast(message) {
    const render = () => {
      if (document.getElementById("wellness-ota-toast")) return;

      const toast = document.createElement("div");
      toast.id = "wellness-ota-toast";
      toast.textContent = message;
      Object.assign(toast.style, {
        position: "fixed",
        left: "16px",
        right: "16px",
        bottom: "92px",
        zIndex: "99999",
        padding: "13px 16px",
        borderRadius: "16px",
        background: "rgba(15, 23, 42, .96)",
        color: "#fff",
        border: "1px solid rgba(148, 163, 184, .25)",
        boxShadow: "0 18px 50px rgba(0,0,0,.35)",
        font: "600 13px/1.45 Inter, system-ui, sans-serif",
        textAlign: "center",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)"
      });

      document.body.appendChild(toast);
      window.setTimeout(() => toast.remove(), 6500);
    };

    if (document.body) render();
    else document.addEventListener("DOMContentLoaded", render, { once: true });
  }

  async function markAppReady() {
    // This call must happen before checking the network so a valid OTA bundle
    // is not rolled back by the native updater.
    const result = await updater.notifyAppReady();
    const currentVersion = result?.bundle?.version;

    if (currentVersion && currentVersion !== "builtin") {
      localStorage.setItem(ACTIVE_VERSION_KEY, currentVersion);

      if (localStorage.getItem(PENDING_VERSION_KEY) === currentVersion) {
        localStorage.removeItem(PENDING_VERSION_KEY);
      }
    }
  }

  async function fetchManifest() {
    const separator = MANIFEST_URL.includes("?") ? "&" : "?";
    const response = await fetch(
      `${MANIFEST_URL}${separator}t=${Date.now()}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Manifest OTA indisponible (${response.status})`);
    }

    const manifest = await response.json();

    if (!manifest?.version || !manifest?.url) {
      throw new Error("Manifest OTA invalide");
    }

    return manifest;
  }

  async function getCurrentVersion() {
    try {
      const current = await updater.current();
      return current?.bundle?.version || "builtin";
    } catch {
      return localStorage.getItem(ACTIVE_VERSION_KEY) || "builtin";
    }
  }

  async function checkForWebUpdate({ force = false } = {}) {
    if (!updater || updateCheckRunning || !navigator.onLine) return;

    const lastCheck = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
    if (!force && Date.now() - lastCheck < 60_000) return;

    updateCheckRunning = true;
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));

    try {
      const manifest = await fetchManifest();
      const currentVersion = await getCurrentVersion();
      const pendingVersion = localStorage.getItem(PENDING_VERSION_KEY);

      if (
        manifest.version === currentVersion ||
        manifest.version === pendingVersion
      ) {
        return;
      }

      const bundle = await updater.download({
        version: String(manifest.version),
        url: manifest.url
      });

      await updater.next({ id: bundle.id });
      localStorage.setItem(PENDING_VERSION_KEY, String(manifest.version));

      showUpdateToast(
        "✨ Mise à jour téléchargée. Wellness l’installera automatiquement à la prochaine fermeture/réouverture."
      );
    } catch (error) {
      console.warn("[Wellness OTA] Mise à jour non appliquée :", error);
    } finally {
      updateCheckRunning = false;
    }
  }

  async function initNativeUpdates() {
    if (!isNativeCapacitor()) return;

    updater = getUpdaterPlugin();

    if (!updater) {
      console.warn(
        "[Wellness OTA] Plugin CapacitorUpdater absent. Une reconstruction native est nécessaire."
      );
      return;
    }

    try {
      await markAppReady();
    } catch (error) {
      console.warn("[Wellness OTA] notifyAppReady a échoué :", error);
    }

    // Leave the application UI time to boot, then check quietly in background.
    window.setTimeout(() => checkForWebUpdate({ force: true }), 1200);

    window.setInterval(() => {
      if (document.visibilityState === "visible") {
        checkForWebUpdate();
      }
    }, CHECK_INTERVAL_MS);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        checkForWebUpdate();
      }
    });

    window.addEventListener("online", () => checkForWebUpdate({ force: true }));
  }

  initNativeUpdates();
})();
