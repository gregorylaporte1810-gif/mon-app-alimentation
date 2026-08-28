(() => {
  "use strict";

  // The dedicated OTA branch is the primary channel from V4.1 onward.
  // The main-branch manifest remains as a permanent bootstrap fallback for
  // older installed builds whose updater still only knows the old location.
  const MANIFEST_URLS = [
    "https://raw.githubusercontent.com/gregorylaporte1810-gif/mon-app-alimentation/ota/latest.json",
    "https://raw.githubusercontent.com/gregorylaporte1810-gif/mon-app-alimentation/main/ota/latest.json",
  ];

  const PENDING_VERSION_KEY = "wellnessOtaPendingVersion";
  const ACTIVE_VERSION_KEY = "wellnessOtaActiveVersion";
  const LAST_CHECK_KEY = "wellnessOtaLastCheck";
  const CHECK_INTERVAL_MS = 15 * 60 * 1000;
  const BUNDLED_APP_VERSION = "5.4.0";
  const SUPPORTED_SCHEMA_VERSION = 4;

  function semverCore(value) {
    const m = String(value || "").match(/(\d+)\.(\d+)\.(\d+)/);
    return m ? m.slice(1).map(Number) : [0, 0, 0];
  }

  function compareSemver(a, b) {
    const left = semverCore(a);
    const right = semverCore(b);
    for (let i = 0; i < 3; i += 1) {
      if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
    }
    return 0;
  }

  function manifestSafeForInstall(manifest, currentVersion) {
    const schema = Number(manifest?.schemaVersion);
    if (Number.isFinite(schema) && schema > SUPPORTED_SCHEMA_VERSION) {
      return { ok: false, reason: `schéma OTA trop récent (${schema})` };
    }

    const remoteApp = String(manifest?.appVersion || manifest?.version || "");
    const currentCore = currentVersion && currentVersion !== "builtin"
      ? currentVersion
      : BUNDLED_APP_VERSION;

    if (compareSemver(remoteApp, currentCore) < 0) {
      return { ok: false, reason: `downgrade refusé (${remoteApp} < ${currentCore})` };
    }

    return { ok: true, reason: "" };
  }

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
    const result = await updater.notifyAppReady();
    const currentVersion = result?.bundle?.version;

    if (currentVersion && currentVersion !== "builtin") {
      localStorage.setItem(ACTIVE_VERSION_KEY, currentVersion);

      if (localStorage.getItem(PENDING_VERSION_KEY) === currentVersion) {
        localStorage.removeItem(PENDING_VERSION_KEY);
      }
    }
  }

  async function fetchManifestFrom(url) {
    const separator = url.includes("?") ? "&" : "?";
    const response = await fetch(`${url}${separator}t=${Date.now()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Manifest OTA indisponible (${response.status})`);
    }

    const manifest = await response.json();
    if (!manifest?.version || !manifest?.url) {
      throw new Error("Manifest OTA invalide");
    }
    return manifest;
  }

  async function fetchManifest() {
    let lastError = null;
    for (const url of MANIFEST_URLS) {
      try {
        return await fetchManifestFrom(url);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("Aucun canal OTA disponible");
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
      const safety = manifestSafeForInstall(manifest, currentVersion);
      if (!safety.ok) {
        console.warn("[Wellness OTA] Mise à jour ignorée :", safety.reason);
        return;
      }
      const pendingVersion = localStorage.getItem(PENDING_VERSION_KEY);

      if (manifest.version === currentVersion || manifest.version === pendingVersion) {
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

    window.setTimeout(() => checkForWebUpdate({ force: true }), 1200);

    window.setInterval(() => {
      if (document.visibilityState === "visible") checkForWebUpdate();
    }, CHECK_INTERVAL_MS);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkForWebUpdate();
    });

    window.addEventListener("online", () => checkForWebUpdate({ force: true }));
  }

  function loadHardening() {
    if (document.getElementById("wellness-hardening-core")) return;
    const core = document.createElement("script");
    core.id = "wellness-hardening-core";
    core.src = "hardening-core.js";
    core.onload = () => {
      const runtime = document.createElement("script");
      runtime.id = "wellness-hardening-runtime";
      runtime.src = "hardening.js";
      document.body.appendChild(runtime);
    };
    core.onerror = () => console.error("[Wellness 4.1] Impossible de charger hardening-core.js");
    document.body.appendChild(core);
  }

  if (document.readyState === "complete") loadHardening();
  else window.addEventListener("load", loadHardening, { once: true });

  initNativeUpdates();
})();
