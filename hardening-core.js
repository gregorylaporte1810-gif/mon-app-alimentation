(() => {
  "use strict";

  const APP_VERSION = "5.6.0";
  const SCHEMA_VERSION = 4;
  const BACKUP_FORMAT = "wellness-backup";
  const PHOTO_REF_PREFIX = "idb://wellness-progress/";

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }
  const SENSITIVE_KEYS = new Set([
    "photoAiToken",
    "access_token",
    "refresh_token",
    "token",
    "password",
  ]);

  const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

  const TRANSFER_LIMITS = Object.freeze({
    maxDepth: 40,
    maxNodes: 250000,
    maxArrayLength: 50000,
    maxObjectKeys: 20000,
    maxStringLength: 16 * 1024 * 1024,
  });

  function assertSafeStructure(
    value,
    depth = 0,
    state = { nodes: 0, stack: new WeakSet() },
  ) {
    if (depth > TRANSFER_LIMITS.maxDepth) {
      throw new Error("Données trop profondément imbriquées.");
    }

    state.nodes += 1;

    if (state.nodes > TRANSFER_LIMITS.maxNodes) {
      throw new Error("Sauvegarde trop volumineuse.");
    }

    if (typeof value === "string") {
      if (value.length > TRANSFER_LIMITS.maxStringLength) {
        throw new Error("Chaîne de données trop volumineuse.");
      }

      return;
    }

    if (!value || typeof value !== "object") {
      return;
    }

    if (state.stack.has(value)) {
      throw new Error("Structure circulaire interdite.");
    }

    state.stack.add(value);

    try {
      if (Array.isArray(value)) {
        if (value.length > TRANSFER_LIMITS.maxArrayLength) {
          throw new Error("Tableau de sauvegarde trop volumineux.");
        }

        for (const child of value) {
          assertSafeStructure(child, depth + 1, state);
        }

        return;
      }

      const keys = Object.keys(value);

      if (keys.length > TRANSFER_LIMITS.maxObjectKeys) {
        throw new Error("Objet de sauvegarde trop volumineux.");
      }

      for (const key of keys) {
        assertSafeStructure(value[key], depth + 1, state);
      }
    } finally {
      state.stack.delete(value);
    }
  }

  function sanitizeForTransfer(value) {
    assertSafeStructure(value);

    function clean(current) {
      if (Array.isArray(current)) {
        return current.map(clean);
      }

      if (!current || typeof current !== "object") {
        return current;
      }

      const result = {};

      for (const [key, child] of Object.entries(current)) {
        if (SENSITIVE_KEYS.has(key)) continue;
        if (DANGEROUS_KEYS.has(key)) continue;

        result[key] = clean(child);
      }

      return result;
    }

    return clean(value);
  }

  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function validFinite(value) {
    return Number.isFinite(Number(value));
  }

  function validateAccountEntries(account, id, errors) {
    const finiteNonNegative = (value) =>
      Number.isFinite(Number(value)) && Number(value) >= 0;
    const validDate = (value) =>
      !value || Number.isFinite(Date.parse(String(value)));

    const journalEntries = Array.isArray(account.journalCalories)
      ? account.journalCalories
      : [];
    journalEntries.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") {
        errors.push(`Entrée journal #${index + 1} invalide pour ${id}.`);
        return;
      }
      for (const key of [
        "calories",
        "proteines",
        "glucides",
        "lipides",
        "fibres",
      ]) {
        if (entry[key] != null && !finiteNonNegative(entry[key])) {
          errors.push(`Valeur ${key} invalide dans le journal de ${id}.`);
          break;
        }
      }
      if (entry.date && !validDate(entry.date)) {
        errors.push(`Date invalide dans le journal de ${id}.`);
      }
    });

    const weightEntries = Array.isArray(account.weightHistory)
      ? account.weightHistory
      : [];
    weightEntries.forEach((entry, index) => {
      const weight = Number(entry?.weight);
      if (!Number.isFinite(weight) || weight <= 0 || weight > 500) {
        errors.push(`Poids invalide #${index + 1} pour ${id}.`);
      }
      if (entry?.date && !validDate(entry.date)) {
        errors.push(`Date de poids invalide pour ${id}.`);
      }
    });

    if (
      account.pasEffectues != null &&
      !finiteNonNegative(account.pasEffectues)
    ) {
      errors.push(`Nombre de pas invalide pour ${id}.`);
    }
    if (account.verresEau != null && !finiteNonNegative(account.verresEau)) {
      errors.push(`Hydratation invalide pour ${id}.`);
    }
  }

  function validateAppState(app) {
    const errors = [];
    if (!isObject(app)) {
      return { ok: false, errors: ["État application invalide."] };
    }
    if (!isObject(app.comptes))
      errors.push("La liste des profils est absente.");
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
      if (
        account.journalCalories != null &&
        !Array.isArray(account.journalCalories)
      ) {
        errors.push(`Journal alimentaire invalide pour ${id}.`);
      }
      if (
        account.progressPhotos != null &&
        !Array.isArray(account.progressPhotos)
      ) {
        errors.push(`Photos de progression invalides pour ${id}.`);
      }
      if (
        account.weightHistory != null &&
        !Array.isArray(account.weightHistory)
      ) {
        errors.push(`Historique de poids invalide pour ${id}.`);
      }
      if (
        account.measurementHistory != null &&
        !Array.isArray(account.measurementHistory)
      ) {
        errors.push(`Mensurations invalides pour ${id}.`);
      }
      if (account.repas != null && !isObject(account.repas)) {
        errors.push(`Repas invalides pour ${id}.`);
      }

      validateAccountEntries(account, id, errors);
    });

    return { ok: errors.length === 0, errors };
  }

  function makeBackup(
    app,
    theme = "dark",
    createdAt = new Date().toISOString(),
  ) {
    const validation = validateAppState(app);
    if (!validation.ok) {
      throw new Error(validation.errors[0] || "État Wellness invalide.");
    }
    return {
      format: BACKUP_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      createdAt,
      app: sanitizeForTransfer(app),
      theme: String(theme || "dark"),
    };
  }

  function validateBackup(data) {
    if (!isObject(data) || data.format !== BACKUP_FORMAT) {
      return {
        ok: false,
        errors: ["Format de sauvegarde Wellness non reconnu."],
      };
    }
    if (
      data.schemaVersion != null &&
      Number(data.schemaVersion) > SCHEMA_VERSION
    ) {
      return {
        ok: false,
        errors: [
          "Cette sauvegarde provient d'une version plus récente de Wellness.",
        ],
      };
    }
    const validation = validateAppState(data.app);
    return validation.ok
      ? { ok: true, errors: [] }
      : { ok: false, errors: validation.errors };
  }

  function goalModeFromWeights(current, target) {
    const c = Number(current);
    const t = Number(target);
    if (!Number.isFinite(c) || !Number.isFinite(t) || c <= 0 || t <= 0)
      return null;
    if (Math.abs(c - t) < 0.05) return "maintain";
    return t < c ? "loss" : "muscle";
  }

  function goalCompatible(mode, current, target) {
    const c = Number(current);
    const t = Number(target);
    if (!Number.isFinite(c) || !Number.isFinite(t) || c <= 0 || t <= 0)
      return true;
    const delta = t - c;
    if (mode === "loss") return delta < -0.05;
    if (mode === "muscle") return delta > 0.05;
    if (mode === "maintain") return Math.abs(delta) < 0.05;
    return true;
  }

  function goalConflictMessage(mode, current, target) {
    if (goalCompatible(mode, current, target)) return "";
    if (mode === "loss")
      return "Ton poids objectif doit être inférieur à ton poids actuel pour appliquer une perte de poids.";
    if (mode === "muscle")
      return "Ton poids objectif doit être supérieur à ton poids actuel pour appliquer une prise de muscle.";
    if (mode === "maintain")
      return "Pour un objectif de maintien, mets le même poids actuel et objectif.";
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
    return {
      accountId: decodeURIComponent(account),
      photoId: decodeURIComponent(photo),
    };
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
    sanitizeForTransfer,
    validFinite,
  };

  if (typeof window !== "undefined") window.WellnessHardeningCore = api;
  if (typeof globalThis !== "undefined") globalThis.WellnessHardeningCore = api;
})();
