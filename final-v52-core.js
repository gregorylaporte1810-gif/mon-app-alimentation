(() => {
  "use strict";

  const normalize = (value = "") =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[’']/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;

  function frenchWeekRange(startKey, endKey) {
    const parse = (key) => {
      const [y, m, d] = String(key || "").split("-").map(Number);
      return new Date(y || 2000, (m || 1) - 1, d || 1, 12);
    };
    const start = parse(startKey);
    const end = parse(endKey);
    const month = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(end);
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} → ${end.getDate()} ${month}`;
    }
    const sm = new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(start);
    const em = new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(end);
    return `${start.getDate()} ${sm} → ${end.getDate()} ${em}`;
  }

  function isLikelySettingsQuery(query, settings = []) {
    const q = normalize(query);
    if (!q) return false;
    return settings.some((label) => {
      const n = normalize(label);
      return n === q || n.startsWith(q) || q.startsWith(n) || n.includes(q);
    });
  }

  function foodQueryStrength(food = {}, query = "") {
    const q = normalize(query);
    const name = normalize(food.name || food.nom || "");
    if (!q || !name) return 0;
    if (name === q) return 1000;
    if (name.startsWith(q)) return 800;
    if (name.includes(q)) return 650;

    const qTokens = q.split(" ").filter(Boolean);
    const nTokens = name.split(" ").filter(Boolean);
    let hits = 0;
    for (const token of qTokens) {
      if (nTokens.some((candidate) => candidate === token || candidate.startsWith(token) || token.startsWith(candidate))) hits += 1;
    }
    return hits === qTokens.length ? 320 + hits * 20 : 0;
  }

  function simpleFoodRank(food = {}, query = "") {
    const q = normalize(query);
    const name = normalize(food.name || food.nom || "");
    let score = foodQueryStrength(food, query);
    const tokens = name.split(" ").filter(Boolean);

    if (name === q) score += 1000;
    if (tokens[0] === q) score += 350;
    if (tokens.length <= 3) score += 140;
    if (/\b(cuit|cru|blanc|complet|basmati|brun|nature)\b/.test(name)) score += 90;
    if (/\b(au lait|caramel|vanille|rayon frais|preemballe|sauce|dessert|gateau|creme)\b/.test(name)) score -= 240;
    score -= Math.max(0, tokens.length - 3) * 14;
    return score;
  }

  function compactEmptyMeal(slotEntries = []) {
    return !Array.isArray(slotEntries) || slotEntries.length === 0;
  }

  function healthDisplayState(health = {}) {
    const last = health.last || {};
    const hasRealData = [
      last.steps,
      last.sleepHours,
      last.weight,
      last.restingHeartRate,
      last.activeCalories,
      last.workouts,
      last.vo2Max,
      last.heartRateVariability,
    ].some((value) => Number(value) > 0);

    if (health.entitlementBlocked) {
      return { kind: "blocked", label: "Signature HealthKit bloquée", compact: true };
    }
    if (hasRealData) {
      return { kind: "ready", label: "Synchronisé", compact: false };
    }
    return { kind: "installed", label: "Intégration installée", compact: true };
  }

  function graphEmpty(text = "") {
    const n = normalize(text);
    return n.includes("aucune donnee") || n.includes("ajoute des pesees") || n.includes("pas encore de donnee");
  }

  globalThis.WellnessFinalCoreV52 = {
    normalize,
    round1,
    frenchWeekRange,
    isLikelySettingsQuery,
    foodQueryStrength,
    simpleFoodRank,
    compactEmptyMeal,
    healthDisplayState,
    graphEmpty,
  };
})();
