(() => {
  "use strict";

  const cap = window.Capacitor;

  function isNative() {
    if (!cap) return false;
    if (typeof cap.isNativePlatform === "function") return cap.isNativePlatform();
    const platform = cap.getPlatform?.();
    return platform === "ios" || platform === "android";
  }

  function plugin(name) {
    return cap?.Plugins?.[name] || null;
  }

  function setMessage(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function utf8ToBase64(text) {
    const bytes = new TextEncoder().encode(String(text));
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function bytesToBase64(value) {
    const bytes = value instanceof Uint8Array
      ? value
      : value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : new TextEncoder().encode(String(value));

    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function base64ToUtf8(base64) {
    const clean = String(base64 || "").replace(/^data:[^;]+;base64,/, "");
    const binary = atob(clean);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async function writeAndShare(filename, data, type = "application/octet-stream") {
    const Filesystem = plugin("Filesystem");
    const Share = plugin("Share");

    if (!isNative() || !Filesystem || !Share) return null;

    const safe = String(filename || "wellness-export")
      .replace(/[^\w.\-]+/g, "-")
      .replace(/-+/g, "-");

    const base64 = typeof data === "string"
      ? utf8ToBase64(data)
      : bytesToBase64(data);

    const path = `wellness/${Date.now()}-${safe}`;

    try {
      await Filesystem.writeFile({
        path,
        data: base64,
        directory: "CACHE",
        recursive: true,
      });

      const { uri } = await Filesystem.getUri({
        path,
        directory: "CACHE",
      });

      await Share.share({
        title: "Wellness",
        text: type === "application/pdf" ? "Rapport Wellness" : undefined,
        url: uri,
        dialogTitle: "Enregistrer ou partager",
      });

      return { ok: true, method: "native-share", uri };
    } catch (error) {
      console.error("[Wellness Native] Export natif impossible :", error);
      return { ok: false, error, method: "native-share" };
    }
  }

  async function pickBackup() {
    const FilePicker = plugin("FilePicker");
    if (!isNative() || !FilePicker) return null;

    const result = await FilePicker.pickFiles({
      types: ["application/json", "text/json"],
      limit: 1,
      readData: true,
    });

    const file = result?.files?.[0];
    if (!file) return { cancelled: true };

    let raw = "";

    if (file.data) {
      raw = base64ToUtf8(file.data);
    } else if (file.blob && typeof file.blob.text === "function") {
      raw = await file.blob.text();
    } else if (file.path) {
      const response = await fetch(file.path);
      raw = await response.text();
    }

    if (!raw) throw new Error("Impossible de lire ce fichier.");

    const data = JSON.parse(raw);
    if (data?.format !== "wellness-backup" || !data?.app?.comptes) {
      throw new Error("Format de sauvegarde Wellness non reconnu.");
    }

    return { data, name: file.name || "sauvegarde.json" };
  }

  async function restoreBackupNative() {
    try {
      setMessage("w2-backup-message", "Ouverture de Fichiers…");
      const result = await pickBackup();
      if (!result || result.cancelled) {
        setMessage("w2-backup-message", "");
        return;
      }

      if (!confirm(`Restaurer ${result.name} ? Les données actuelles seront remplacées.`)) {
        setMessage("w2-backup-message", "Restauration annulée.");
        return;
      }

      localStorage.setItem(CLE_APPLICATION, JSON.stringify(result.data.app));
      if (result.data.theme) {
        localStorage.setItem("wellnessTheme", result.data.theme);
      }

      setMessage("w2-backup-message", "✅ Sauvegarde restaurée. Rechargement…");
      setTimeout(() => location.reload(), 500);
    } catch (error) {
      setMessage("w2-backup-message", `⚠️ ${error.message || "Restauration impossible."}`);
      console.error("[Wellness Native] Restore :", error);
    }
  }

  async function notificationPermission({ request = false } = {}) {
    const LocalNotifications = plugin("LocalNotifications");
    if (!LocalNotifications) return "unavailable";

    let status = await LocalNotifications.checkPermissions();
    if (request && status?.display === "prompt") {
      status = await LocalNotifications.requestPermissions();
    }
    return status?.display || "denied";
  }

  function parseTime(value, fallbackHour = 9) {
    const [h, m] = String(value || "").split(":").map(Number);
    return {
      hour: Number.isInteger(h) ? h : fallbackHour,
      minute: Number.isInteger(m) ? m : 0,
    };
  }

  async function scheduleNativeReminders({ requestPermission = true } = {}) {
    const LocalNotifications = plugin("LocalNotifications");
    if (!isNative() || !LocalNotifications) return false;

    const permission = await notificationPermission({ request: requestPermission });
    if (permission !== "granted") {
      setMessage("mega-reminder-message", "⚠️ Autorise les notifications dans les réglages iOS.");
      return false;
    }

    const account = megaNormalizeAccount();
    const settings = account.reminderSettings || {};

    await LocalNotifications.cancel({
      notifications: [{ id: 41001 }, { id: 41002 }],
    }).catch(() => {});

    const notifications = [];

    if (settings.waterEnabled) {
      const time = parseTime(settings.waterTime, 14);
      notifications.push({
        id: 41001,
        title: "💧 Hydratation",
        body: "Pense à boire un verre d’eau.",
        schedule: {
          on: { hour: time.hour, minute: time.minute },
          repeats: true,
        },
      });
    }

    if (settings.weightEnabled) {
      const time = parseTime(settings.weightTime, 8);
      notifications.push({
        id: 41002,
        title: "⚖️ Pesée",
        body: "Si tu le souhaites, pense à enregistrer ton poids.",
        schedule: {
          on: { hour: time.hour, minute: time.minute },
          repeats: true,
        },
      });
    }

    if (notifications.length) {
      await LocalNotifications.schedule({ notifications });
    }

    setMessage(
      "mega-reminder-message",
      notifications.length
        ? `✅ ${notifications.length} rappel${notifications.length > 1 ? "s" : ""} iOS programmé${notifications.length > 1 ? "s" : ""}.`
        : "✅ Aucun rappel actif."
    );

    return true;
  }

  async function saveReminderSettingsNative() {
    const account = megaNormalizeAccount();
    account.reminderSettings.waterEnabled =
      !!document.getElementById("mega-reminder-water-enabled")?.checked;
    account.reminderSettings.waterTime =
      document.getElementById("mega-reminder-water-time")?.value || "14:00";
    account.reminderSettings.weightEnabled =
      !!document.getElementById("mega-reminder-weight-enabled")?.checked;
    account.reminderSettings.weightTime =
      document.getElementById("mega-reminder-weight-time")?.value || "08:00";

    sauvegarderEtatApplication();
    await scheduleNativeReminders({ requestPermission: true });
  }

  async function nativeBarcodeScan() {
    const BarcodeScanner = plugin("BarcodeScanner");
    if (!isNative() || !BarcodeScanner) return false;

    try {
      const permission = await BarcodeScanner.requestPermissions?.();
      if (permission && permission.camera && permission.camera !== "granted") {
        setMessage("w2-barcode-help", "⚠️ Autorise la caméra pour scanner.");
        return true;
      }

      setMessage("w2-barcode-help", "Place le code-barres dans le cadre du scanner iOS…");

      const result = await BarcodeScanner.scan({
        formats: [
          "EAN_13",
          "EAN_8",
          "UPC_A",
          "UPC_E",
          "CODE_128",
          "CODE_39",
        ],
      });

      const barcode = result?.barcodes?.[0];
      const value = barcode?.rawValue || barcode?.displayValue || "";

      if (!value) {
        setMessage("w2-barcode-help", "Aucun code-barres détecté.");
        return true;
      }

      const input = document.getElementById("w2-barcode-input");
      if (input) input.value = value;

      setMessage("w2-barcode-help", `Code détecté : ${value}. Recherche du produit…`);
      await w2LookupBarcode(value);
      return true;
    } catch (error) {
      console.error("[Wellness Native] Scanner :", error);
      setMessage(
        "w2-barcode-help",
        `⚠️ ${error?.message || "Scanner indisponible."} Tu peux toujours saisir le code manuellement.`
      );
      return true;
    }
  }

  function configureNativeUi() {
    if (!isNative()) return;

    const pwaStatus = document.getElementById("mega-pwa-status");
    if (pwaStatus) pwaStatus.textContent = cap.getPlatform?.() === "ios" ? "iPhone" : "Application";

    const install = document.getElementById("mega-install-pwa");
    if (install) install.hidden = true;

    const help = document.getElementById("mega-reminder-message");
    if (help && help.textContent.includes("navigateur")) {
      help.textContent = "Les rappels utilisent les notifications locales de l’iPhone.";
    }
  }

  function installEventBridges() {
    if (!isNative()) return;

    // Restore from Files is a real native document picker.
    const restoreButton = document.getElementById("w2-native-restore");
    restoreButton?.addEventListener("click", async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      await restoreBackupNative();
    }, true);

    // Native reminders: intercept the old Web Notification handlers.
    document.getElementById("mega-enable-notifications")?.addEventListener("click", async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const permission = await notificationPermission({ request: true });
      setMessage(
        "mega-reminder-message",
        permission === "granted"
          ? "✅ Notifications iOS autorisées."
          : "⚠️ Notifications non autorisées."
      );
    }, true);

    document.getElementById("mega-save-reminders")?.addEventListener("click", async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      await saveReminderSettingsNative();
    }, true);

    // Native ML Kit scanner: intercept BarcodeDetector/Web camera flow.
    document.getElementById("w2-start-barcode-camera")?.addEventListener("click", async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      await nativeBarcodeScan();
    }, true);
  }

  window.WellnessNative = {
    isNative,
    plugin,
    writeAndShare,
    restoreBackupNative,
    scheduleNativeReminders,
    nativeBarcodeScan,
  };

  const boot = () => {
    configureNativeUi();
    installEventBridges();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();