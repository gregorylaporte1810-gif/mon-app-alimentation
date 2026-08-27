(() => {
  "use strict";

  const APP_VERSION = "5.3.0";
  const SCHEMA_VERSION = 4;
  const BACKUP_FORMAT = "wellness-backup";
  const PHOTO_REF_PREFIX = "idb://wellness-progress/";

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function validFinite(value) {
    return Number.isFinite(Number(value));
  }

  function validateAppState(app) {
    const errors = [];
    if (!isObject(app)) {
      return { ok: false, errors: ["État application invalide."] };
    }
    if (!isObject(app.comptes)) errors.push("La liste des profils est absente.");
    const ids = isObject(app.comptes) ? Object.keys(app.comptes) : [];
    if (!ids.length) errors.push("Aucun profil n'est présent.");
    if (!app.compteActif || !ids.includes(app.compteActif)) {
      errors.push("Le profil actif n'existe pas.");
    }

    ids.forEach((id) => {
      const account = app.comptes[id];
      if (!isObject(account)) {
        errors.push(`Profil ${id} invalide.`);
        return;
      }
      if (account.journalCalories != null && !Array.isArray(account.journalCalories)) {
        errors.push(`Journal alimentaire invalide pour ${id}.`);
      }
      if (account.progressPhotos != null && !Array.isArray(account.progressPhotos)) {
        errors.push(`Photos de progression invalides pour ${id}.`);
      }
      if (account.weightHistory != null && !Array.isArray(account.weightHistory)) {
        errors.push(`Historique de poids invalide pour ${id}.`);
      }
      if (account.measurementHistory != null && !Array.isArray(account.measurementHistory)) {
        errors.push(`Mensurations invalides pour ${id}.`);
      }
      if (account.repas != null && !isObject(account.repas)) {
        errors.push(`Repas invalides pour ${id}.`);
      }
    });

    return { ok: errors.length === 0, errors };
  }

  function makeBackup(app, theme = "dark", createdAt = new Date().toISOString()) {
    const validation = validateAppState(app);
    if (!validation.ok) {
      throw new Error(validation.errors[0] || "État Wellness invalide.");
    }
    return {
      format: BACKUP_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      createdAt,
      app: clone(app),
      theme: String(theme || "dark"),
    };
  }

  function validateBackup(data) {
    if (!isObject(data) || data.format !== BACKUP_FORMAT) {
      return { ok: false, errors: ["Format de sauvegarde Wellness non reconnu."] };
    }
    if (data.schemaVersion != null && Number(data.schemaVersion) > SCHEMA_VERSION) {
      return { ok: false, errors: ["Cette sauvegarde provient d'une version plus récente de Wellness."] };
    }
    const validation = validateAppState(data.app);
    return validation.ok
      ? { ok: true, errors: [] }
      : { ok: false, errors: validation.errors };
  }

  function goalModeFromWeights(current, target) {
    const c = Number(current);
    const t = Number(target);
    if (!Number.isFinite(c) || !Number.isFinite(t) || c <= 0 || t <= 0) return null;
    if (Math.abs(c - t) < 0.05) return "maintain";
    return t < c ? "loss" : "muscle";
  }

  function goalCompatible(mode, current, target) {
    const c = Number(current);
    const t = Number(target);
    if (!Number.isFinite(c) || !Number.isFinite(t) || c <= 0 || t <= 0) return true;
    const delta = t - c;
    if (mode === "loss") return delta < -0.05;
    if (mode === "muscle") return delta > 0.05;
    if (mode === "maintain") return Math.abs(delta) < 0.05;
    return true;
  }

  function goalConflictMessage(mode, current, target) {
    if (goalCompatible(mode, current, target)) return "";
    if (mode === "loss") return "Ton poids objectif doit être inférieur à ton poids actuel pour appliquer une perte de poids.";
    if (mode === "muscle") return "Ton poids objectif doit être supérieur à ton poids actuel pour appliquer une prise de muscle.";
    if (mode === "maintain") return "Pour un objectif de maintien, mets le même poids actuel et objectif.";
    return "L'objectif principal et le poids cible ne sont pas cohérents.";
  }

  function photoRef(accountId, photoId) {
    return `${PHOTO_REF_PREFIX}${encodeURIComponent(String(accountId))}/${encodeURIComponent(String(photoId))}`;
  }

  function isPhotoRef(value) {
    return typeof value === "string" && value.startsWith(PHOTO_REF_PREFIX);
  }

  function photoRefParts(value) {
    if (!isPhotoRef(value)) return null;
    const tail = value.slice(PHOTO_REF_PREFIX.length);
    const [account, photo] = tail.split("/");
    if (!account || !photo) return null;
    return { accountId: decodeURIComponent(account), photoId: decodeURIComponent(photo) };
  }

  function compareIso(a, b) {
    const left = Date.parse(a || "");
    const right = Date.parse(b || "");
    if (!Number.isFinite(left) && !Number.isFinite(right)) return 0;
    if (!Number.isFinite(left)) return -1;
    if (!Number.isFinite(right)) return 1;
    return left === right ? 0 : left > right ? 1 : -1;
  }

  function firstMeasurementLabel(current, previous, unit = "") {
    const cur = Number(current) || 0;
    const prev = Number(previous) || 0;
    if (!cur) return "Cette semaine";
    if (!prev) return "Première mesure";
    const delta = cur - prev;
    const rounded = Math.round(Math.abs(delta) * 10) / 10;
    return `${delta >= 0 ? "↑" : "↓"} ${rounded}${unit ? ` ${unit}` : ""}`;
  }

  const api = {
    APP_VERSION,
    SCHEMA_VERSION,
    BACKUP_FORMAT,
    PHOTO_REF_PREFIX,
    clone,
    validateAppState,
    makeBackup,
    validateBackup,
    goalModeFromWeights,
    goalCompatible,
    goalConflictMessage,
    photoRef,
    isPhotoRef,
    photoRefParts,
    compareIso,
    firstMeasurementLabel,
    validFinite,
  };

  if (typeof window !== "undefined") window.WellnessHardeningCore = api;
  if (typeof globalThis !== "undefined") globalThis.WellnessHardeningCore = api;
})();
