(() => {
  "use strict";

  const Core = window.WellnessHardeningCore;
  if (!Core) {
    console.error("[Wellness 4.1] hardening-core.js est absent.");
    return;
  }

  const APP_KEY = typeof CLE_APPLICATION !== "undefined" ? CLE_APPLICATION : "wellnessAppComptes";
  const ROLLBACK_KEY = "wellnessRestoreRollbackV41";
  const CLOUD_SYNC_KEY = "wellnessCloudLastSyncAt";
  const LOCAL_CHANGED_KEY = "wellnessLocalChangedAt";
  const PHOTO_DB = "wellness-v41";
  const PHOTO_STORE = "progressPhotos";
  const PHOTO_DB_VERSION = 1;
  const CLOUD_SESSION_KEY = "wellnessSupabaseSession";
  const SECURE_SESSION_NATIVE_KEY = "wellness_supabase_session";
  let photoDbPromise = null;
  let migrationRunning = false;
  let originalSave = null;
  let secureCloudSession = null;
  let secureCloudEnabled = false;

  function clone(value) {
    return Core.clone(value);
  }

  function activeState() {
    return typeof etatApplication !== "undefined" ? etatApplication : null;
  }

  function activeAccount() {
    try { return typeof obtenirCompteActif === "function" ? obtenirCompteActif() : null; }
    catch { return null; }
  }

  function setMessage(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function openPhotoDb() {
    if (!window.indexedDB) return Promise.reject(new Error("IndexedDB indisponible"));
    if (photoDbPromise) return photoDbPromise;
    photoDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(PHOTO_DB, PHOTO_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB indisponible"));
    });
    return photoDbPromise;
  }

  async function photoDbSet(key, data) {
    const db = await openPhotoDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readwrite");
      tx.objectStore(PHOTO_STORE).put(data, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("Écriture photo impossible"));
    });
  }

  async function photoDbGet(key) {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readonly");
      const req = tx.objectStore(PHOTO_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error("Lecture photo impossible"));
    });
  }

  async function photoDbKeys() {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readonly");
      const req = tx.objectStore(PHOTO_STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error("Lecture des clés impossible"));
    });
  }

  async function photoDbDelete(key) {
    const db = await openPhotoDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readwrite");
      tx.objectStore(PHOTO_STORE).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("Suppression photo impossible"));
    });
  }

  function storageSnapshot() {
    const state = activeState();
    if (!state) return null;
    const copy = clone(state);
    Object.entries(copy.comptes || {}).forEach(([accountId, account]) => {
      (account.progressPhotos || []).forEach((photo) => {
        if (photo?.storageRef && typeof photo.data === "string" && photo.data.startsWith("data:image/")) {
          photo.data = photo.storageRef;
        } else if (Core.isPhotoRef(photo?.data)) {
          photo.storageRef = photo.data;
        }
        if (!photo.storageRef && Core.isPhotoRef(photo.data)) photo.storageRef = photo.data;
        if (photo.storageRef && !Core.isPhotoRef(photo.storageRef)) {
          photo.storageRef = Core.photoRef(accountId, photo.id || `photo-${Date.now()}`);
        }
      });
    });
    return copy;
  }

  function installSafeSave() {
    if (typeof sauvegarderEtatApplication !== "function" || originalSave) return;
    originalSave = sauvegarderEtatApplication;
    sauvegarderEtatApplication = function wellnessV41Save() {
      const snapshot = storageSnapshot();
      if (!snapshot) return originalSave();
      const validation = Core.validateAppState(snapshot);
      if (!validation.ok) {
        console.error("[Wellness 4.1] Sauvegarde refusée :", validation.errors);
        return false;
      }
      const next = JSON.stringify(snapshot);
      const previous = localStorage.getItem(APP_KEY);
      localStorage.setItem(APP_KEY, next);
      if (previous !== next) localStorage.setItem(LOCAL_CHANGED_KEY, new Date().toISOString());
      queuePhotoMigration();
      return true;
    };
  }

  async function rehydratePhotos() {
    const state = activeState();
    if (!state || !window.indexedDB) return;
    let changed = false;
    for (const [accountId, account] of Object.entries(state.comptes || {})) {
      for (const photo of account.progressPhotos || []) {
        const ref = Core.isPhotoRef(photo?.data) ? photo.data : photo?.storageRef;
        if (!Core.isPhotoRef(ref)) continue;
        photo.storageRef = ref;
        if (!Core.isPhotoRef(photo.data)) continue;
        try {
          const data = await photoDbGet(ref);
          if (data) {
            photo.data = data;
            changed = true;
          }
        } catch (error) {
          console.warn("[Wellness 4.1] Photo locale non restaurée :", accountId, error);
        }
      }
    }
    if (changed && typeof megaRenderPhotos === "function") megaRenderPhotos();
  }

  async function migratePhotos() {
    if (migrationRunning || !window.indexedDB) return;
    migrationRunning = true;
    try {
      const state = activeState();
      if (!state) return;
      const liveRefs = new Set();
      let persisted = false;
      for (const [accountId, account] of Object.entries(state.comptes || {})) {
        for (const photo of account.progressPhotos || []) {
          if (!photo?.id) continue;
          const ref = photo.storageRef || (Core.isPhotoRef(photo.data) ? photo.data : Core.photoRef(accountId, photo.id));
          liveRefs.add(ref);
          if (!photo.storageRef && typeof photo.data === "string" && photo.data.startsWith("data:image/")) {
            try {
              await photoDbSet(ref, photo.data);
              const verified = await photoDbGet(ref);
              if (verified) {
                photo.storageRef = ref;
                persisted = true;
              }
            } catch (error) {
              console.warn("[Wellness 4.1] Migration photo ignorée :", error);
            }
          }
        }
      }
      try {
        const keys = await photoDbKeys();
        await Promise.all(keys.filter((key) => !liveRefs.has(String(key))).map((key) => photoDbDelete(key)));
      } catch {}
      if (persisted && originalSave) sauvegarderEtatApplication();
    } finally {
      migrationRunning = false;
    }
  }

  function queuePhotoMigration() {
    window.clearTimeout(queuePhotoMigration.timer);
    queuePhotoMigration.timer = window.setTimeout(() => migratePhotos(), 250);
  }

  function saveRollback() {
    const raw = localStorage.getItem(APP_KEY);
    if (!raw) return;
    localStorage.setItem(ROLLBACK_KEY, JSON.stringify({
      createdAt: new Date().toISOString(),
      appRaw: raw,
      theme: localStorage.getItem("wellnessTheme") || "dark",
    }));
  }

  function recoverIfNeeded() {
    const raw = localStorage.getItem(APP_KEY);
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch {}
    const validation = Core.validateAppState(parsed);
    if (validation.ok) return true;

    try {
      const rollback = JSON.parse(localStorage.getItem(ROLLBACK_KEY) || "null");
      const previous = rollback?.appRaw ? JSON.parse(rollback.appRaw) : null;
      if (Core.validateAppState(previous).ok) {
        localStorage.setItem(APP_KEY, rollback.appRaw);
        if (rollback.theme) localStorage.setItem("wellnessTheme", rollback.theme);
        console.warn("[Wellness 4.1] État invalide restauré depuis le rollback.");
        location.reload();
        return false;
      }
    } catch {}
    console.error("[Wellness 4.1] État local invalide :", validation.errors);
    return false;
  }

  async function exportBackup() {
    await rehydratePhotos();
    const state = activeState();
    const payload = Core.makeBackup(state, localStorage.getItem("wellnessTheme") || "dark");
    const result = await window.WellnessFiles?.shareOrDownload?.(
      `wellness-backup-${typeof obtenirDateLocale === "function" ? obtenirDateLocale() : new Date().toISOString().slice(0,10)}.json`,
      JSON.stringify(payload, null, 2),
      "application/json"
    );
    setMessage("w2-backup-message", result?.ok ? "✅ Sauvegarde 4.1 prête." : result?.cancelled ? "" : "⚠️ Export impossible.");
  }

  function applyRestore(data, sourceName = "sauvegarde") {
    const validation = Core.validateBackup(data);
    if (!validation.ok) throw new Error(validation.errors[0]);
    saveRollback();
    localStorage.setItem(APP_KEY, JSON.stringify(data.app));
    if (data.theme) localStorage.setItem("wellnessTheme", data.theme);
    localStorage.setItem(LOCAL_CHANGED_KEY, new Date().toISOString());
    setMessage("w2-backup-message", `✅ ${sourceName} restaurée. Rechargement…`);
    setTimeout(() => location.reload(), 350);
  }

  async function restoreFromWebFile(file) {
    const raw = await file.text();
    const data = JSON.parse(raw);
    const validation = Core.validateBackup(data);
    if (!validation.ok) throw new Error(validation.errors[0]);
    if (!confirm(`Restaurer ${file.name || "cette sauvegarde"} ? Les données actuelles seront sécurisées en rollback.`)) return;
    applyRestore(data, file.name || "Sauvegarde");
  }

  function base64ToUtf8(base64) {
    const clean = String(base64 || "").replace(/^data:[^;]+;base64,/, "");
    const binary = atob(clean);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async function restoreNative() {
    const picker = window.WellnessNative?.plugin?.("FilePicker");
    if (!picker) {
      document.getElementById("w2-backup-file")?.click();
      return;
    }
    setMessage("w2-backup-message", "Ouverture de Fichiers…");
    const result = await picker.pickFiles({ types: ["application/json", "text/json"], limit: 1, readData: true });
    const file = result?.files?.[0];
    if (!file) return;
    let raw = "";
    if (file.data) raw = base64ToUtf8(file.data);
    else if (file.blob?.text) raw = await file.blob.text();
    else if (file.path) raw = await (await fetch(file.path)).text();
    if (!raw) throw new Error("Impossible de lire ce fichier.");
    const data = JSON.parse(raw);
    const validation = Core.validateBackup(data);
    if (!validation.ok) throw new Error(validation.errors[0]);
    if (!confirm(`Restaurer ${file.name || "cette sauvegarde"} ? Les données actuelles seront sécurisées en rollback.`)) return;
    applyRestore(data, file.name || "Sauvegarde");
  }

  function syncGoalFromWeightTarget() {
    const account = activeAccount();
    if (!account?.w2) return;
    const current = Number(document.getElementById("profil-poids-actuel")?.value || account.poidsActuel);
    const target = Number(document.getElementById("profil-poids-objectif")?.value || account.poidsObjectif);
    const mode = Core.goalModeFromWeights(current, target);
    if (!mode) return;
    account.w2.goalMode = mode;
    if (typeof w2LoadGoalPreferences === "function") w2LoadGoalPreferences();
    sauvegarderEtatApplication?.();
    const label = mode === "loss" ? "Perte de poids" : mode === "muscle" ? "Prise de muscle" : "Maintien";
    setMessage("w2-goal-message", `Objectif principal synchronisé : ${label}.`);
  }

  function guardAdvancedGoal(event) {
    const button = event.target.closest("#w2-apply-goal");
    if (!button) return false;
    const account = activeAccount();
    const mode = account?.w2?.goalMode;
    if (!mode) return false;
    const current = Number(document.getElementById("profil-poids-actuel")?.value || account.poidsActuel);
    const target = Number(document.getElementById("profil-poids-objectif")?.value || account.poidsObjectif);
    const message = Core.goalConflictMessage(mode, current, target);
    if (!message) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    setMessage("w2-goal-message", `⚠️ ${message}`);
    return true;
  }

  function cloudMessage(text) {
    setMessage("w2-cloud-message", text);
  }

  async function safeCloudPush() {
    try {
      cloudMessage("Vérification du cloud…");
      const remote = await WellnessCloud.pull();
      const lastSync = localStorage.getItem(CLOUD_SYNC_KEY);
      const remoteNewer = remote?.updated_at && (!lastSync || Core.compareIso(remote.updated_at, lastSync) > 0);
      if (remoteNewer && remote?.payload) {
        const ok = confirm("Le cloud contient des données plus récentes que la dernière synchronisation. Les remplacer par les données de cet appareil ?");
        if (!ok) { cloudMessage("Envoi annulé pour éviter un écrasement."); return; }
      }
      const at = await WellnessCloud.push(activeState());
      localStorage.setItem(CLOUD_SYNC_KEY, at);
      cloudMessage(`✅ Données envoyées au cloud (${new Date(at).toLocaleString("fr-FR")}).`);
    } catch (error) {
      cloudMessage(`⚠️ ${error.message || "Synchronisation impossible."}`);
    }
  }

  async function safeCloudPull() {
    try {
      cloudMessage("Récupération…");
      const row = await WellnessCloud.pull();
      if (!row?.payload) { cloudMessage("Aucune sauvegarde cloud trouvée."); return; }
      const validation = Core.validateAppState(row.payload);
      if (!validation.ok) throw new Error(`Sauvegarde cloud invalide : ${validation.errors[0]}`);
      const lastSync = localStorage.getItem(CLOUD_SYNC_KEY);
      const localChanged = localStorage.getItem(LOCAL_CHANGED_KEY);
      const bothChanged = !!lastSync && Core.compareIso(localChanged, lastSync) > 0 && Core.compareIso(row.updated_at, lastSync) > 0;
      const question = bothChanged
        ? "Les données locales ET le cloud ont changé depuis la dernière synchronisation. Utiliser quand même la version cloud ?"
        : "Remplacer les données locales par la sauvegarde cloud ? Une copie de sécurité locale sera conservée.";
      if (!confirm(question)) { cloudMessage("Récupération annulée."); return; }
      saveRollback();
      localStorage.setItem(APP_KEY, JSON.stringify(row.payload));
      localStorage.setItem(CLOUD_SYNC_KEY, row.updated_at || new Date().toISOString());
      localStorage.setItem(LOCAL_CHANGED_KEY, row.updated_at || new Date().toISOString());
      cloudMessage("✅ Données cloud restaurées. Rechargement…");
      setTimeout(() => location.reload(), 350);
    } catch (error) {
      cloudMessage(`⚠️ ${error.message || "Récupération impossible."}`);
    }
  }


  function secureStorageNative() {
    if (!window.WellnessNative?.isNative?.()) return null;
    const plugin = window.WellnessNative.plugin?.("SecureStorage") || window.Capacitor?.Plugins?.SecureStorage;
    if (!plugin?.internalGetItem || !plugin?.internalSetItem || !plugin?.internalRemoveItem) return null;
    return plugin;
  }

  async function secureSessionRead(plugin = secureStorageNative()) {
    if (!plugin) return null;
    try {
      const result = await plugin.internalGetItem({ prefixedKey: SECURE_SESSION_NATIVE_KEY, sync: false });
      if (!result?.data) return null;
      return JSON.parse(result.data);
    } catch {
      return null;
    }
  }

  async function secureSessionWrite(session, plugin = secureStorageNative()) {
    if (!plugin || !session) return false;
    await plugin.internalSetItem({
      prefixedKey: SECURE_SESSION_NATIVE_KEY,
      data: JSON.stringify(session),
      sync: false,
      // KeychainAccess.whenUnlockedThisDeviceOnly in capacitor-secure-storage.
      access: 1,
    });
    return true;
  }

  async function secureSessionRemove(plugin = secureStorageNative()) {
    if (!plugin) return false;
    try {
      await plugin.internalRemoveItem({ prefixedKey: SECURE_SESSION_NATIVE_KEY, sync: false });
      return true;
    } catch {
      return false;
    }
  }

  function parseLocalCloudSession() {
    try { return JSON.parse(localStorage.getItem(CLOUD_SESSION_KEY) || "null"); }
    catch { return null; }
  }

  async function installSecureCloudSession() {
    const plugin = secureStorageNative();
    if (!plugin || !window.WellnessCloud || secureCloudEnabled) return false;

    const original = {
      getSession: WellnessCloud.getSession,
      signUp: WellnessCloud.signUp,
      signIn: WellnessCloud.signIn,
      signOut: WellnessCloud.signOut,
      push: WellnessCloud.push,
      pull: WellnessCloud.pull,
      validSession: WellnessCloud.validSession,
    };

    const legacy = parseLocalCloudSession();
    secureCloudSession = await secureSessionRead(plugin);
    if (!secureCloudSession && legacy) {
      try {
        await secureSessionWrite(legacy, plugin);
        secureCloudSession = legacy;
      } catch (error) {
        console.warn("[Wellness 4.1] Migration Keychain impossible :", error);
        return false;
      }
    }
    localStorage.removeItem(CLOUD_SESSION_KEY);

    async function withSecureSession(operation) {
      if (secureCloudSession) localStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(secureCloudSession));
      try {
        const result = await operation();
        const updated = parseLocalCloudSession();
        if (updated) {
          secureCloudSession = updated;
          await secureSessionWrite(updated, plugin);
        }
        return result;
      } finally {
        localStorage.removeItem(CLOUD_SESSION_KEY);
      }
    }

    WellnessCloud.getSession = () => secureCloudSession;
    WellnessCloud.signUp = (...args) => withSecureSession(() => original.signUp(...args));
    WellnessCloud.signIn = (...args) => withSecureSession(() => original.signIn(...args));
    WellnessCloud.validSession = (...args) => withSecureSession(() => original.validSession(...args));
    WellnessCloud.push = (...args) => withSecureSession(() => original.push(...args));
    WellnessCloud.pull = (...args) => withSecureSession(() => original.pull(...args));
    WellnessCloud.signOut = () => {
      secureCloudSession = null;
      try { original.signOut(); } catch {}
      localStorage.removeItem(CLOUD_SESSION_KEY);
      secureSessionRemove(plugin);
    };

    secureCloudEnabled = true;
    const note = document.querySelector(".w2-cloud-card .texte-aide");
    if (note && !note.dataset.keychain) {
      note.dataset.keychain = "true";
      note.insertAdjacentHTML("beforeend", " <strong>Sur iPhone, la session est protégée par le Trousseau iOS.</strong>");
    }
    return true;
  }

  async function cleanupNativeCache() {
    if (!window.WellnessNative?.isNative?.()) return;
    const fs = window.WellnessNative.plugin?.("Filesystem");
    if (!fs?.readdir || !fs?.deleteFile) return;
    try {
      const result = await fs.readdir({ path: "wellness", directory: "CACHE" });
      for (const entry of result?.files || []) {
        const name = typeof entry === "string" ? entry : entry.name;
        if (!name) continue;
        await fs.deleteFile({ path: `wellness/${name}`, directory: "CACHE" }).catch(() => {});
      }
    } catch {}
  }

  async function stopScannerWhenHidden() {
    if (document.visibilityState !== "hidden" || !window.WellnessNative?.isNative?.()) return;
    const scanner = window.WellnessNative.plugin?.("BarcodeScanner");
    if (!scanner) return;
    try { await scanner.stopScan?.(); } catch {}
    try { await scanner.removeAllListeners?.(); } catch {}
    document.documentElement.classList.remove("w2-native-scan-active");
    document.body?.classList.remove("w2-native-scan-active");
    document.getElementById("w2-native-scanner-ui")?.classList.remove("active");
  }

  function updateAccessibility() {
    const moodLabels = { 1: "Très mauvaise", 2: "Mauvaise", 3: "Neutre", 4: "Bonne", 5: "Excellente" };
    document.querySelectorAll("#w2-mood-rating button").forEach((button) => {
      button.type = "button";
      button.setAttribute("aria-label", `Humeur : ${moodLabels[button.dataset.value] || button.dataset.value}`);
      button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
    });
    document.querySelectorAll("#w2-energy-rating button").forEach((button) => {
      button.type = "button";
      button.setAttribute("aria-label", `Énergie ${button.dataset.value} sur 5`);
      button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
    });
    document.querySelectorAll(".fermer-modal-simple:not([aria-label])").forEach((button) => button.setAttribute("aria-label", "Fermer"));
  }

  function enforceFirstSleepLabel() {
    try {
      if (typeof w2AggregatePeriod !== "function") return;
      const current = w2AggregatePeriod(6, 0);
      const previous = w2AggregatePeriod(13, 7);
      const el = document.getElementById("px-week-sleep-delta");
      if (el && Number(current.sleep) > 0 && !Number(previous.sleep)) el.textContent = "Première mesure";
    } catch {}
  }

  function injectVersionUi() {
    document.title = `Wellness ${Core.APP_VERSION}`;
    const badge = document.querySelector(".w2-settings-center .mini-pill");
    if (badge) badge.textContent = `Wellness ${Core.APP_VERSION}`;
    if (document.getElementById("w41-version-card")) return;
    const page = document.getElementById("page-profil");
    if (!page) return;
    const card = document.createElement("div");
    card.id = "w41-version-card";
    card.className = "carte profil-carte";
    const platform = window.Capacitor?.getPlatform?.() || "web";
    const ota = localStorage.getItem("wellnessOtaActiveVersion") || "builtin";
    card.innerHTML = `<div class="section-heading"><div><p class="sur-titre">À propos</p><h2>Wellness ${Core.APP_VERSION}</h2></div><span class="mini-pill">Schéma ${Core.SCHEMA_VERSION}</span></div><p class="texte-aide">Plateforme : ${platform} · OTA : <span id="w41-ota-version"></span></p>`;
    card.querySelector("#w41-ota-version").textContent = ota;
    const danger = page.querySelector(".zone-danger");
    if (danger) page.insertBefore(card, danger); else page.appendChild(card);
  }

  function injectHardeningStyles() {
    const style = document.createElement("style");
    style.id = "w41-hardening-style";
    style.textContent = `
      #w2-mood-rating button,#w2-energy-rating button,.fermer-modal-simple{min-width:44px;min-height:44px}
      #w41-version-card .texte-aide{overflow-wrap:anywhere}
    `;
    document.head.appendChild(style);
  }

  function installEventGuards() {
    document.addEventListener("click", async (event) => {
      const target = event.target.closest("button");
      if (!target) return;
      if (target.id === "w2-backup-export") {
        event.preventDefault(); event.stopImmediatePropagation();
        try { await exportBackup(); } catch (error) { setMessage("w2-backup-message", `⚠️ ${error.message}`); }
        return;
      }
      if (target.id === "w2-native-restore") {
        event.preventDefault(); event.stopImmediatePropagation();
        try { await restoreNative(); } catch (error) { setMessage("w2-backup-message", `⚠️ ${error.message}`); }
        return;
      }
      if (target.id === "w2-cloud-push") {
        event.preventDefault(); event.stopImmediatePropagation(); await safeCloudPush(); return;
      }
      if (target.id === "w2-cloud-pull") {
        event.preventDefault(); event.stopImmediatePropagation(); await safeCloudPull(); return;
      }
      if (guardAdvancedGoal(event)) return;
    }, true);

    document.addEventListener("change", async (event) => {
      if (event.target?.id !== "w2-backup-file") return;
      event.preventDefault(); event.stopImmediatePropagation();
      const file = event.target.files?.[0];
      if (!file) return;
      try { await restoreFromWebFile(file); }
      catch (error) { setMessage("w2-backup-message", `⚠️ ${error.message}`); }
      finally { event.target.value = ""; }
    }, true);

    document.getElementById("calculer-objectif-calories")?.addEventListener("click", () => setTimeout(syncGoalFromWeightTarget, 0));
    document.getElementById("w2-save-wellness")?.addEventListener("click", () => setTimeout(enforceFirstSleepLabel, 50));
    document.addEventListener("visibilitychange", stopScannerWhenHidden);
    document.addEventListener("click", () => setTimeout(updateAccessibility, 0), { passive: true });
  }

  async function boot() {
    if (!recoverIfNeeded()) return;
    installSafeSave();
    injectHardeningStyles();
    injectVersionUi();
    updateAccessibility();
    installEventGuards();
    await rehydratePhotos();
    queuePhotoMigration();
    enforceFirstSleepLabel();
    cleanupNativeCache();
    await installSecureCloudSession();
    window.WellnessV41 = {
      version: Core.APP_VERSION,
      schemaVersion: Core.SCHEMA_VERSION,
      validate: Core.validateAppState,
      exportBackup,
      rehydratePhotos,
      migratePhotos,
      secureCloud: () => secureCloudEnabled,
    };
  }

  boot().catch((error) => console.error("[Wellness 4.1] Initialisation :", error));
})();
