(() => {
  "use strict";

  const normalize = (value = "") =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/['’]/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

  function dateKey(date = new Date()) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function addDays(key, days) {
    const [y, m, d] = String(key).split("-").map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
    date.setDate(date.getDate() + Number(days || 0));
    return dateKey(date);
  }

  function previousDay(key = dateKey()) {
    return addDays(key, -1);
  }

  function foodKey(food = {}) {
    if (food.id) return String(food.id);
    return `food:${normalize(`${food.name || food.nom || ""}|${food.brand || food.category || ""}`)}`;
  }

  function entryKey(entry = {}) {
    if (entry.foodId) return `${entry.foodId}|${Number(entry.quantity) || ""}|${entry.unit || ""}`;
    return `entry:${normalize(`${entry.nom || entry.name || ""}|${entry.repasSlot || ""}`)}`;
  }

  function cloneEntry(entry = {}) {
    const copy = JSON.parse(JSON.stringify(entry || {}));
    delete copy.id;
    delete copy.createdAt;
    delete copy.updatedAt;
    return copy;
  }

  function mealTotals(journal = [], slot = "") {
    return (Array.isArray(journal) ? journal : [])
      .filter((entry) => !slot || entry?.repasSlot === slot)
      .reduce((acc, entry) => {
        acc.calories += Number(entry?.calories) || 0;
        acc.protein += Number(entry?.proteines ?? entry?.protein) || 0;
        acc.carbs += Number(entry?.glucides ?? entry?.carbs) || 0;
        acc.fat += Number(entry?.lipides ?? entry?.fat) || 0;
        acc.fiber += Number(entry?.fibres ?? entry?.fiber) || 0;
        acc.sugars += Number(entry?.sucres ?? entry?.sugars) || 0;
        acc.saturatedFat += Number(entry?.grasSatures ?? entry?.saturatedFat) || 0;
        acc.salt += Number(entry?.sel ?? entry?.salt) || 0;
        acc.count += 1;
        return acc;
      }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugars: 0, saturatedFat: 0, salt: 0, count: 0 });
  }

  function qualityTargets(calorieTarget = 0) {
    const calories = Number(calorieTarget) || 0;
    return {
      fiber: 30,
      salt: 5,
      saturatedFat: calories > 0 ? round1((calories * 0.10) / 9) : 20,
    };
  }

  function rankUsage(usage = {}, mode = "recent", limit = 6) {
    const list = Object.values(usage || {}).filter((item) => item?.entry);
    list.sort((a, b) => {
      if (mode === "frequent") {
        const countDelta = (Number(b.count) || 0) - (Number(a.count) || 0);
        if (countDelta) return countDelta;
      }
      return String(b.lastUsedAt || "").localeCompare(String(a.lastUsedAt || ""));
    });
    return list.slice(0, limit);
  }

  function isPlainWaterName(value = "") {
    const text = normalize(value);
    if (!text) return false;
    if (text.includes("eau de coco")) return false;
    return text === "eau" ||
      text.startsWith("eau ") ||
      text.includes("eau minerale") ||
      text.includes("eau gazeuse") ||
      text.includes("eau petillante") ||
      text.includes("eau du robinet") ||
      text === "water" ||
      text.startsWith("water ");
  }

  function entryWaterMl(entry = {}) {
    if (!isPlainWaterName(entry.nom || entry.name || "")) return 0;

    const quantity = Number(entry.quantity);
    const unit = String(entry.unit || "").toLowerCase();

    if (Number.isFinite(quantity) && quantity > 0) {
      if (unit === "ml") return quantity;
      if (unit === "cl") return quantity * 10;
      if (unit === "l") return quantity * 1000;
      if (unit === "g") return quantity;
      if (unit === "kg") return quantity * 1000;
    }

    const reference = Number(entry.referenceAmount);
    return Number.isFinite(reference) && reference > 0 ? reference : 0;
  }

  function waterFromJournalMl(journal = []) {
    return round1((Array.isArray(journal) ? journal : []).reduce((sum, entry) => sum + entryWaterMl(entry), 0));
  }

  function waterGlasses(ml, glassMl = 250) {
    const volume = Math.max(1, Number(glassMl) || 250);
    return Math.round((Math.max(0, Number(ml) || 0) / volume) * 4) / 4;
  }

  function suggestionScore(food = {}, needs = {}) {
    const kcal = Number(food.kcal) || 0;
    if (kcal <= 0 || kcal > 800) return -Infinity;

    const remainingCalories = Math.max(0, Number(needs.remainingCalories) || 0);
    const proteinRemaining = Math.max(0, Number(needs.proteinRemaining) || 0);
    const fiberRemaining = Math.max(0, Number(needs.fiberRemaining) || 0);

    if (remainingCalories > 0 && kcal > remainingCalories * 1.25) return -1000 - kcal;

    const protein = Number(food.protein) || 0;
    const fiber = Number(food.fiber) || 0;
    const salt = Number(food.salt) || 0;
    const sat = Number(food.saturatedFat) || 0;

    let score = 0;
    if (proteinRemaining > 0) score += Math.min(protein, proteinRemaining) * 7;
    if (fiberRemaining > 0) score += Math.min(fiber, fiberRemaining) * 4;
    if (remainingCalories > 0) {
      const usefulTarget = Math.min(350, Math.max(100, remainingCalories * 0.35));
      score -= Math.abs(kcal - usefulTarget) / 18;
    }
    score -= salt * 1.5;
    score -= sat * 0.35;
    return score;
  }

  function diverseSuggestions(foods = [], needs = {}, limit = 5, allowed = () => true) {
    const ranked = (Array.isArray(foods) ? foods : [])
      .filter((food) => food && allowed(food))
      .map((food) => ({ food, score: suggestionScore(food, needs) }))
      .filter((row) => Number.isFinite(row.score) && row.score > -900)
      .sort((a, b) => b.score - a.score);

    const result = [];
    const categories = new Set();
    for (const row of ranked) {
      const category = normalize(row.food.category || row.food.subcategory || "autre");
      if (categories.has(category) && result.length < Math.ceil(limit / 2)) continue;
      result.push(row.food);
      categories.add(category);
      if (result.length >= limit) break;
    }
    return result;
  }

  function trimDailyJournals(daily = {}, maxDays = 90) {
    const keys = Object.keys(daily || {}).sort();
    const copy = { ...(daily || {}) };
    while (keys.length > maxDays) {
      delete copy[keys.shift()];
    }
    return copy;
  }

  globalThis.WellnessDailyCoreV43 = {
    normalize,
    round1,
    clamp,
    dateKey,
    addDays,
    previousDay,
    foodKey,
    entryKey,
    cloneEntry,
    mealTotals,
    qualityTargets,
    rankUsage,
    isPlainWaterName,
    entryWaterMl,
    waterFromJournalMl,
    waterGlasses,
    suggestionScore,
    diverseSuggestions,
    trimDailyJournals,
  };
})();
