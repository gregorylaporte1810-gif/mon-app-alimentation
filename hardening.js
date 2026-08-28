(() => {
  "use strict";

  const Core = window.WellnessHardeningCore;
  if (!Core) {
    console.error("[Wellness 4.1] hardening-core.js est absent.");
    return;
  }
  const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
  const APP_KEY =
    typeof CLE_APPLICATION !== "undefined"
      ? CLE_APPLICATION
      : "wellnessAppComptes";
  const ROLLBACK_KEY = "wellnessRestoreRollbackV41";
  const CLOUD_SYNC_KEY = "wellnessCloudLastSyncAt";
  const LOCAL_CHANGED_KEY = "wellnessLocalChangedAt";
  const PHOTO_DB = "wellness-v41";
  const PHOTO_STORE = "progressPhotos";
  const PHOTO_DB_VERSION = 1;
  const SECURE_SESSION_NATIVE_KEY = "wellness_supabase_session";
  const PHOTO_AI_TOKEN_SESSION_KEY = "wellnessPhotoAiToken";
  const SECURE_PHOTO_AI_NATIVE_KEY = "wellness_photo_ai_token";
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
    try {
      return typeof obtenirCompteActif === "function"
        ? obtenirCompteActif()
        : null;
    } catch {
      return null;
    }
  }

  function setMessage(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function openPhotoDb() {
    if (!window.indexedDB)
      return Promise.reject(new Error("IndexedDB indisponible"));
    if (photoDbPromise) return photoDbPromise;
    photoDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(PHOTO_DB, PHOTO_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PHOTO_STORE))
          db.createObjectStore(PHOTO_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error || new Error("IndexedDB indisponible"));
    });
    return photoDbPromise;
  }

  async function photoDbSet(key, data) {
    const db = await openPhotoDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readwrite");
      tx.objectStore(PHOTO_STORE).put(data, key);
      tx.oncomplete = resolve;
      tx.onerror = () =>
        reject(tx.error || new Error("Écriture photo impossible"));
    });
  }

  async function photoDbGet(key) {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readonly");
      const req = tx.objectStore(PHOTO_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () =>
        reject(req.error || new Error("Lecture photo impossible"));
    });
  }

  async function photoDbKeys() {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readonly");
      const req = tx.objectStore(PHOTO_STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () =>
        reject(req.error || new Error("Lecture des clés impossible"));
    });
  }

  async function photoDbDelete(key) {
    const db = await openPhotoDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readwrite");
      tx.objectStore(PHOTO_STORE).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () =>
        reject(tx.error || new Error("Suppression photo impossible"));
    });
  }

  function storageSnapshot() {
    const state = activeState();
    if (!state) return null;
    const copy = clone(state);
    Object.entries(copy.comptes || {}).forEach(([accountId, account]) => {
      (account.progressPhotos || []).forEach((photo) => {
        if (
          photo?.storageRef &&
          typeof photo.data === "string" &&
          photo.data.startsWith("data:image/")
        ) {
          photo.data = photo.storageRef;
        } else if (Core.isPhotoRef(photo?.data)) {
          photo.storageRef = photo.data;
        }
        if (!photo.storageRef && Core.isPhotoRef(photo.data))
          photo.storageRef = photo.data;
        if (photo.storageRef && !Core.isPhotoRef(photo.storageRef)) {
          photo.storageRef = Core.photoRef(
            accountId,
            photo.id || `photo-${Date.now()}`,
          );
        }
      });
    });
    return copy;
  }

  function installSafeSave() {
    if (typeof sauvegarderEtatApplication !== "function" || originalSave)
      return;
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
      if (previous !== next)
        localStorage.setItem(LOCAL_CHANGED_KEY, new Date().toISOString());
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
        const ref = Core.isPhotoRef(photo?.data)
          ? photo.data
          : photo?.storageRef;
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
          console.warn(
            "[Wellness 4.1] Photo locale non restaurée :",
            accountId,
            error,
          );
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
          const ref =
            photo.storageRef ||
            (Core.isPhotoRef(photo.data)
              ? photo.data
              : Core.photoRef(accountId, photo.id));
          liveRefs.add(ref);
          if (
            !photo.storageRef &&
            typeof photo.data === "string" &&
            photo.data.startsWith("data:image/")
          ) {
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
        await Promise.all(
          keys
            .filter((key) => !liveRefs.has(String(key)))
            .map((key) => photoDbDelete(key)),
        );
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
    localStorage.setItem(
      ROLLBACK_KEY,
      JSON.stringify({
        createdAt: new Date().toISOString(),
        appRaw: raw,
        theme: localStorage.getItem("wellnessTheme") || "dark",
      }),
    );
  }

  function recoverIfNeeded() {
    const raw = localStorage.getItem(APP_KEY);
    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {}
    const validation = Core.validateAppState(parsed);
    if (validation.ok) return true;

    try {
      const rollback = JSON.parse(localStorage.getItem(ROLLBACK_KEY) || "null");
      const previous = rollback?.appRaw ? JSON.parse(rollback.appRaw) : null;
      if (Core.validateAppState(previous).ok) {
        localStorage.setItem(APP_KEY, rollback.appRaw);
        if (rollback.theme)
          localStorage.setItem("wellnessTheme", rollback.theme);
        console.warn(
          "[Wellness 4.1] État invalide restauré depuis le rollback.",
        );
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
    const payload = Core.makeBackup(
      state,
      localStorage.getItem("wellnessTheme") || "dark",
    );
    const result = await window.WellnessFiles?.shareOrDownload?.(
      `wellness-backup-${typeof obtenirDateLocale === "function" ? obtenirDateLocale() : new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
    setMessage(
      "w2-backup-message",
      result?.ok
        ? "✅ Sauvegarde 4.1 prête."
        : result?.cancelled
          ? ""
          : "⚠️ Export impossible.",
    );
  }

  function applyRestore(data, sourceName = "sauvegarde") {
    const cleanData = Core.sanitizeForTransfer(data);
    const validation = Core.validateBackup(cleanData);
    if (!validation.ok) throw new Error(validation.errors[0]);
    saveRollback();
    localStorage.setItem(APP_KEY, JSON.stringify(cleanData.app));
    if (data.theme) localStorage.setItem("wellnessTheme", data.theme);
    localStorage.setItem(LOCAL_CHANGED_KEY, new Date().toISOString());
    setMessage(
      "w2-backup-message",
      `✅ ${sourceName} restaurée. Rechargement…`,
    );
    setTimeout(() => location.reload(), 350);
  }

  async function restoreFromWebFile(file) {
    assertBackupSize(file.size, file.name || "Sauvegarde");
    const raw = await file.text();
    assertBackupSize(raw, file.name || "Sauvegarde");
    const data = JSON.parse(raw);
    const validation = Core.validateBackup(data);
    if (!validation.ok) throw new Error(validation.errors[0]);
    if (
      !confirm(
        `Restaurer ${file.name || "cette sauvegarde"} ? Les données actuelles seront sécurisées en rollback.`,
      )
    )
      return;
    applyRestore(data, file.name || "Sauvegarde");
  }

  function assertBackupSize(value, label = "Sauvegarde") {
    const size =
      typeof value === "string" ? new Blob([value]).size : Number(value || 0);

    if (size > MAX_BACKUP_BYTES) {
      throw new Error(`${label} trop volumineuse. Taille maximale : 64 Mo.`);
    }
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
    const result = await picker.pickFiles({
      types: ["application/json", "text/json"],
      limit: 1,
      readData: true,
    });
    const file = result?.files?.[0];
    if (!file) return;
    assertBackupSize(file.size, file.name || "Sauvegarde");
    let raw = "";
    if (file.data) raw = base64ToUtf8(file.data);
    else if (file.blob?.text) raw = await file.blob.text();
    else if (file.path) raw = await (await fetch(file.path)).text();
    if (!raw) throw new Error("Impossible de lire ce fichier.");
    assertBackupSize(raw, file.name || "Sauvegarde");
    const data = JSON.parse(raw);
    const validation = Core.validateBackup(data);
    if (!validation.ok) throw new Error(validation.errors[0]);
    if (
      !confirm(
        `Restaurer ${file.name || "cette sauvegarde"} ? Les données actuelles seront sécurisées en rollback.`,
      )
    )
      return;
    applyRestore(data, file.name || "Sauvegarde");
  }

  function syncGoalFromWeightTarget() {
    const account = activeAccount();
    if (!account?.w2) return;
    const current = Number(
      document.getElementById("profil-poids-actuel")?.value ||
        account.poidsActuel,
    );
    const target = Number(
      document.getElementById("profil-poids-objectif")?.value ||
        account.poidsObjectif,
    );
    const mode = Core.goalModeFromWeights(current, target);
    if (!mode) return;
    account.w2.goalMode = mode;
    if (typeof w2LoadGoalPreferences === "function") w2LoadGoalPreferences();
    sauvegarderEtatApplication?.();
    const label =
      mode === "loss"
        ? "Perte de poids"
        : mode === "muscle"
          ? "Prise de muscle"
          : "Maintien";
    setMessage("w2-goal-message", `Objectif principal synchronisé : ${label}.`);
  }

  function guardAdvancedGoal(event) {
    const button = event.target.closest("#w2-apply-goal");
    if (!button) return false;
    const account = activeAccount();
    const mode = account?.w2?.goalMode;
    if (!mode) return false;
    const current = Number(
      document.getElementById("profil-poids-actuel")?.value ||
        account.poidsActuel,
    );
    const target = Number(
      document.getElementById("profil-poids-objectif")?.value ||
        account.poidsObjectif,
    );
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
      const remoteNewer =
        remote?.updated_at &&
        (!lastSync || Core.compareIso(remote.updated_at, lastSync) > 0);
      if (remoteNewer && remote?.payload) {
        const ok = confirm(
          "Le cloud contient des données plus récentes que la dernière synchronisation. Les remplacer par les données de cet appareil ?",
        );
        if (!ok) {
          cloudMessage("Envoi annulé pour éviter un écrasement.");
          return;
        }
      }
      const at = await WellnessCloud.push(
        Core.sanitizeForTransfer(activeState()),
      );
      localStorage.setItem(CLOUD_SYNC_KEY, at);
      cloudMessage(
        `✅ Données envoyées au cloud (${new Date(at).toLocaleString("fr-FR")}).`,
      );
    } catch (error) {
      cloudMessage(`⚠️ ${error.message || "Synchronisation impossible."}`);
    }
  }

  async function safeCloudPull() {
    try {
      cloudMessage("Récupération…");
      const row = await WellnessCloud.pull();
      if (!row?.payload) {
        cloudMessage("Aucune sauvegarde cloud trouvée.");
        return;
      }
      const cleanPayload = Core.sanitizeForTransfer(row.payload);
      const validation = Core.validateAppState(cleanPayload);
      if (!validation.ok)
        throw new Error(`Sauvegarde cloud invalide : ${validation.errors[0]}`);
      const lastSync = localStorage.getItem(CLOUD_SYNC_KEY);
      const localChanged = localStorage.getItem(LOCAL_CHANGED_KEY);
      const bothChanged =
        !!lastSync &&
        Core.compareIso(localChanged, lastSync) > 0 &&
        Core.compareIso(row.updated_at, lastSync) > 0;
      const question = bothChanged
        ? "Les données locales ET le cloud ont changé depuis la dernière synchronisation. Utiliser quand même la version cloud ?"
        : "Remplacer les données locales par la sauvegarde cloud ? Une copie de sécurité locale sera conservée.";
      if (!confirm(question)) {
        cloudMessage("Récupération annulée.");
        return;
      }
      saveRollback();
      localStorage.setItem(APP_KEY, JSON.stringify(cleanPayload));
      localStorage.setItem(
        CLOUD_SYNC_KEY,
        row.updated_at || new Date().toISOString(),
      );
      localStorage.setItem(
        LOCAL_CHANGED_KEY,
        row.updated_at || new Date().toISOString(),
      );
      cloudMessage("✅ Données cloud restaurées. Rechargement…");
      setTimeout(() => location.reload(), 350);
    } catch (error) {
      cloudMessage(`⚠️ ${error.message || "Récupération impossible."}`);
    }
  }

  function secureStorageNative() {
    if (!window.WellnessNative?.isNative?.()) return null;
    const plugin =
      window.WellnessNative.plugin?.("SecureStorage") ||
      window.Capacitor?.Plugins?.SecureStorage;
    if (
      !plugin?.internalGetItem ||
      !plugin?.internalSetItem ||
      !plugin?.internalRemoveItem
    )
      return null;
    return plugin;
  }

  async function photoAiTokenRead() {
    const plugin = secureStorageNative();

    if (plugin) {
      try {
        const result = await plugin.internalGetItem({
          prefixedKey: SECURE_PHOTO_AI_NATIVE_KEY,
          sync: false,
        });

        return String(result?.data || "");
      } catch {
        return "";
      }
    }

    try {
      return sessionStorage.getItem(PHOTO_AI_TOKEN_SESSION_KEY) || "";
    } catch {
      return "";
    }
  }

  async function photoAiTokenWrite(token) {
    const value = String(token || "").trim();
    const plugin = secureStorageNative();

    if (!value) {
      await photoAiTokenRemove();
      return "";
    }

    if (plugin) {
      await plugin.internalSetItem({
        prefixedKey: SECURE_PHOTO_AI_NATIVE_KEY,
        data: value,
        sync: false,
        access: 1,
      });

      try {
        sessionStorage.removeItem(PHOTO_AI_TOKEN_SESSION_KEY);
      } catch {}

      return value;
    }

    try {
      sessionStorage.setItem(PHOTO_AI_TOKEN_SESSION_KEY, value);
    } catch {}

    return value;
  }

  async function photoAiTokenRemove() {
    const plugin = secureStorageNative();

    if (plugin) {
      try {
        await plugin.internalRemoveItem({
          prefixedKey: SECURE_PHOTO_AI_NATIVE_KEY,
          sync: false,
        });
      } catch {}
    }

    try {
      sessionStorage.removeItem(PHOTO_AI_TOKEN_SESSION_KEY);
    } catch {}

    return true;
  }

  async function migrateLegacyPhotoAiToken() {
    const account = activeAccount();
    const settings = account?.w2?.settings;

    if (!settings) return;

    const legacyToken = String(settings.photoAiToken || "").trim();

    if (legacyToken) {
      const existing = await photoAiTokenRead();

      if (!existing) {
        await photoAiTokenWrite(legacyToken);
      }
    }

    if (Object.prototype.hasOwnProperty.call(settings, "photoAiToken")) {
      delete settings.photoAiToken;

      if (typeof sauvegarderEtatApplication === "function") {
        sauvegarderEtatApplication();
      }
    }
  }

  async function secureSessionRead(plugin = secureStorageNative()) {
    if (!plugin) return null;
    try {
      const result = await plugin.internalGetItem({
        prefixedKey: SECURE_SESSION_NATIVE_KEY,
        sync: false,
      });
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
      await plugin.internalRemoveItem({
        prefixedKey: SECURE_SESSION_NATIVE_KEY,
        sync: false,
      });
      return true;
    } catch {
      return false;
    }
  }

  async function installSecureCloudSession() {
    const plugin = secureStorageNative();

    if (!plugin || !window.WellnessCloud || secureCloudEnabled) {
      return false;
    }

    const original = {
      getSession: WellnessCloud.getSession,
      useMemorySession: WellnessCloud.useMemorySession,
      signUp: WellnessCloud.signUp,
      signIn: WellnessCloud.signIn,
      signOut: WellnessCloud.signOut,
      push: WellnessCloud.push,
      pull: WellnessCloud.pull,
      deleteRemoteData: WellnessCloud.deleteRemoteData,
      validSession: WellnessCloud.validSession,
    };

    if (typeof original.useMemorySession !== "function") {
      console.warn("[Wellness 5.5] Session mémoire cloud indisponible.");
      return false;
    }

    // cloud.js a déjà migré une éventuelle ancienne session
    // de localStorage vers sa mémoire/session temporaire.
    const migratedSession = original.getSession?.() || null;

    // Le Trousseau iOS reste prioritaire s'il contient déjà une session.
    secureCloudSession = await secureSessionRead(plugin);

    if (!secureCloudSession && migratedSession) {
      try {
        await secureSessionWrite(migratedSession, plugin);
        secureCloudSession = migratedSession;
      } catch (error) {
        console.warn(
          "[Wellness 5.5] Migration vers le Trousseau impossible :",
          error,
        );
        return false;
      }
    }

    // À partir d'ici, la session Supabase reste uniquement en mémoire
    // pendant l'exécution et dans le Trousseau iOS pour la persistance.
    original.useMemorySession(secureCloudSession);

    async function withSecureSession(operation) {
      original.useMemorySession(secureCloudSession);

      const result = await operation();
      const updated = original.getSession?.() || null;

      if (updated) {
        secureCloudSession = updated;
        await secureSessionWrite(updated, plugin);
      } else {
        secureCloudSession = null;
        await secureSessionRemove(plugin);
      }

      return result;
    }

    WellnessCloud.getSession = () => secureCloudSession;

    WellnessCloud.signUp = (...args) =>
      withSecureSession(() => original.signUp(...args));

    WellnessCloud.signIn = (...args) =>
      withSecureSession(() => original.signIn(...args));

    WellnessCloud.validSession = (...args) =>
      withSecureSession(() => original.validSession(...args));

    WellnessCloud.push = (...args) =>
      withSecureSession(() => original.push(...args));

    WellnessCloud.pull = (...args) =>
      withSecureSession(() => original.pull(...args));

    WellnessCloud.deleteRemoteData = (...args) =>
      withSecureSession(() => original.deleteRemoteData(...args));

    WellnessCloud.signOut = async () => {
      let signOutError = null;

      try {
        await original.signOut();
      } catch (error) {
        signOutError = error;
      } finally {
        secureCloudSession = null;
        original.useMemorySession(null);
        await secureSessionRemove(plugin);
      }

      if (signOutError) {
        throw signOutError;
      }

      return true;
    };

    secureCloudEnabled = true;

    const note = document.querySelector(".w2-cloud-card .texte-aide");

    if (note && !note.dataset.keychain) {
      note.dataset.keychain = "true";
      note.insertAdjacentHTML(
        "beforeend",
        " <strong>Sur iPhone, la session est protégée par le Trousseau iOS.</strong>",
      );
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
        await fs
          .deleteFile({ path: `wellness/${name}`, directory: "CACHE" })
          .catch(() => {});
      }
    } catch {}
  }

  async function stopScannerWhenHidden() {
    if (
      document.visibilityState !== "hidden" ||
      !window.WellnessNative?.isNative?.()
    )
      return;
    const scanner = window.WellnessNative.plugin?.("BarcodeScanner");
    if (!scanner) return;
    try {
      await scanner.stopScan?.();
    } catch {}
    try {
      await scanner.removeAllListeners?.();
    } catch {}
    document.documentElement.classList.remove("w2-native-scan-active");
    document.body?.classList.remove("w2-native-scan-active");
    document.getElementById("w2-native-scanner-ui")?.classList.remove("active");
  }

  function updateAccessibility() {
    const moodLabels = {
      1: "Très mauvaise",
      2: "Mauvaise",
      3: "Neutre",
      4: "Bonne",
      5: "Excellente",
    };
    document.querySelectorAll("#w2-mood-rating button").forEach((button) => {
      button.type = "button";
      button.setAttribute(
        "aria-label",
        `Humeur : ${moodLabels[button.dataset.value] || button.dataset.value}`,
      );
      button.setAttribute(
        "aria-pressed",
        button.classList.contains("active") ? "true" : "false",
      );
    });
    document.querySelectorAll("#w2-energy-rating button").forEach((button) => {
      button.type = "button";
      button.setAttribute(
        "aria-label",
        `Énergie ${button.dataset.value} sur 5`,
      );
      button.setAttribute(
        "aria-pressed",
        button.classList.contains("active") ? "true" : "false",
      );
    });
    document
      .querySelectorAll(".fermer-modal-simple:not([aria-label])")
      .forEach((button) => button.setAttribute("aria-label", "Fermer"));
  }

  const MODAL_SELECTOR = [
  ".modal-simple-overlay",
  ".modal-filtres-overlay",
  ".px-sheet-overlay",
  "#mega-onboarding-overlay",
].join(",");

const modalFocusReturn = new WeakMap();
const modalStack = [];
let lastNonModalFocus = null;

function modalIsOpen(overlay) {
  return (
    overlay instanceof HTMLElement &&
    overlay.getAttribute("aria-hidden") === "false"
  );
}

function modalFocusableElements(overlay) {
  return [
    ...overlay.querySelectorAll(
      [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(","),
    ),
  ].filter(
    (element) =>
      element instanceof HTMLElement &&
      !element.hidden &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.getClientRects().length > 0,
  );
}

function modalDialogElement(overlay) {
  return overlay.querySelector(
    '[role="dialog"], .modal-simple, .modal-filtres, .px-sheet',
  );
}

function focusWithoutScroll(element) {
  if (!(element instanceof HTMLElement)) return;

  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function registerModalOpen(overlay) {
  if (!modalIsOpen(overlay)) return;

  const existingIndex = modalStack.indexOf(overlay);

  if (existingIndex !== -1) {
    modalStack.splice(existingIndex, 1);
  }

  const active = document.activeElement;

  if (
    active instanceof HTMLElement &&
    !overlay.contains(active)
  ) {
    modalFocusReturn.set(overlay, active);
  } else if (lastNonModalFocus) {
    modalFocusReturn.set(overlay, lastNonModalFocus);
  }

  modalStack.push(overlay);

  const dialog = modalDialogElement(overlay);

  if (dialog) {
    if (!dialog.hasAttribute("role")) {
      dialog.setAttribute("role", "dialog");
    }

    dialog.setAttribute("aria-modal", "true");

    if (!dialog.hasAttribute("tabindex")) {
      dialog.setAttribute("tabindex", "-1");
    }
  }

  setTimeout(() => {
    if (!modalIsOpen(overlay)) return;

    if (overlay.contains(document.activeElement)) {
      return;
    }

    const preferred =
      overlay.querySelector(
        [
          ".fermer-modal-simple",
          ".px-sheet-close",
          ".px-editor-close",
          '[aria-label="Fermer"]',
        ].join(","),
      ) ||
      modalFocusableElements(overlay)[0] ||
      dialog;

    focusWithoutScroll(preferred);
  }, 0);
}

function registerModalClose(overlay) {
  const index = modalStack.indexOf(overlay);

  if (index !== -1) {
    modalStack.splice(index, 1);
  }

  const returnTarget = modalFocusReturn.get(overlay);
  modalFocusReturn.delete(overlay);

  setTimeout(() => {
    const topModal = modalStack.at(-1);

    if (topModal && modalIsOpen(topModal)) {
      if (
        returnTarget instanceof HTMLElement &&
        topModal.contains(returnTarget)
      ) {
        focusWithoutScroll(returnTarget);
        return;
      }

      const fallback =
        modalFocusableElements(topModal)[0] ||
        modalDialogElement(topModal);

      focusWithoutScroll(fallback);
      return;
    }

    if (
      returnTarget instanceof HTMLElement &&
      returnTarget.isConnected
    ) {
      focusWithoutScroll(returnTarget);
    }
  }, 0);
}

function syncModalAccessibility(overlay) {
  if (!(overlay instanceof HTMLElement)) return;

  if (modalIsOpen(overlay)) {
    registerModalOpen(overlay);
  } else {
    registerModalClose(overlay);
  }
}

function installModalAccessibility() {
  document.querySelectorAll(MODAL_SELECTOR).forEach((overlay) => {
    if (modalIsOpen(overlay)) {
      registerModalOpen(overlay);
    }
  });

  document.addEventListener(
    "focusin",
    (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) return;

      const activeModal = modalStack.at(-1);

      if (!activeModal || !modalIsOpen(activeModal)) {
        lastNonModalFocus = target;
      }
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (event) => {
      const overlay = modalStack.at(-1);

      if (!overlay || !modalIsOpen(overlay)) return;

      if (event.key === "Escape") {
        const closeButton = overlay.querySelector(
          [
            ".fermer-modal-simple",
            ".px-sheet-close",
            ".px-editor-close",
            '[aria-label="Fermer"]',
            '[id$="-close"]',
          ].join(","),
        );

        if (closeButton instanceof HTMLElement) {
          event.preventDefault();
          event.stopPropagation();
          closeButton.click();
        }

        return;
      }

      if (event.key !== "Tab") return;

      const focusable = modalFocusableElements(overlay);
      const dialog = modalDialogElement(overlay);

      if (!focusable.length) {
        event.preventDefault();
        focusWithoutScroll(dialog);
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!overlay.contains(active)) {
        event.preventDefault();
        focusWithoutScroll(event.shiftKey ? last : first);
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        focusWithoutScroll(last);
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        focusWithoutScroll(first);
      }
    },
    true,
  );

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (
        mutation.type === "attributes" &&
        mutation.target instanceof HTMLElement &&
        mutation.target.matches(MODAL_SELECTOR)
      ) {
        syncModalAccessibility(mutation.target);
      }

      for (const node of mutation.addedNodes || []) {
        if (!(node instanceof HTMLElement)) continue;

        if (node.matches(MODAL_SELECTOR)) {
          syncModalAccessibility(node);
        }

        node
          .querySelectorAll?.(MODAL_SELECTOR)
          .forEach(syncModalAccessibility);
      }
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["aria-hidden", "class"],
  });
}

  function enforceFirstSleepLabel() {
    try {
      if (typeof w2AggregatePeriod !== "function") return;
      const current = w2AggregatePeriod(6, 0);
      const previous = w2AggregatePeriod(13, 7);
      const el = document.getElementById("px-week-sleep-delta");
      if (el && Number(current.sleep) > 0 && !Number(previous.sleep))
        el.textContent = "Première mesure";
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
    if (danger) page.insertBefore(card, danger);
    else page.appendChild(card);
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
    document.addEventListener(
      "click",
      async (event) => {
        const target = event.target.closest("button");
        if (!target) return;
        if (target.id === "w2-backup-export") {
          event.preventDefault();
          event.stopImmediatePropagation();
          try {
            await exportBackup();
          } catch (error) {
            setMessage("w2-backup-message", `⚠️ ${error.message}`);
          }
          return;
        }
        if (target.id === "w2-native-restore") {
          event.preventDefault();
          event.stopImmediatePropagation();
          try {
            await restoreNative();
          } catch (error) {
            setMessage("w2-backup-message", `⚠️ ${error.message}`);
          }
          return;
        }
        if (target.id === "w2-cloud-push") {
          event.preventDefault();
          event.stopImmediatePropagation();
          await safeCloudPush();
          return;
        }
        if (target.id === "w2-cloud-pull") {
          event.preventDefault();
          event.stopImmediatePropagation();
          await safeCloudPull();
          return;
        }
        if (guardAdvancedGoal(event)) return;
      },
      true,
    );

    document.addEventListener(
      "change",
      async (event) => {
        if (event.target?.id !== "w2-backup-file") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          assertBackupSize(file.size, file.name || "Sauvegarde");
          await restoreFromWebFile(file);
        } catch (error) {
          setMessage("w2-backup-message", `⚠️ ${error.message}`);
        } finally {
          event.target.value = "";
        }
      },
      true,
    );

    document
      .getElementById("calculer-objectif-calories")
      ?.addEventListener("click", () =>
        setTimeout(syncGoalFromWeightTarget, 0),
      );
    document
      .getElementById("w2-save-wellness")
      ?.addEventListener("click", () => setTimeout(enforceFirstSleepLabel, 50));
    document.addEventListener("visibilitychange", stopScannerWhenHidden);
    document.addEventListener(
      "click",
      () => setTimeout(updateAccessibility, 0),
      { passive: true },
    );
  }

  async function boot() {
    if (!recoverIfNeeded()) return;
    installSafeSave();
    injectHardeningStyles();
    injectVersionUi();
    updateAccessibility();
    installModalAccessibility();
    installEventGuards();
    await rehydratePhotos();
    queuePhotoMigration();
    enforceFirstSleepLabel();
    cleanupNativeCache();
    await migrateLegacyPhotoAiToken();
    await installSecureCloudSession();
    window.WellnessV41 = {
      photoAiToken: {
        get: photoAiTokenRead,
        set: photoAiTokenWrite,
        remove: photoAiTokenRemove,
      },
      version: Core.APP_VERSION,
      schemaVersion: Core.SCHEMA_VERSION,
      validate: Core.validateAppState,
      exportBackup,
      rehydratePhotos,
      migratePhotos,
      secureCloud: () => secureCloudEnabled,
    };
  }

  boot().catch((error) =>
    console.error("[Wellness 4.1] Initialisation :", error),
  );
})();
