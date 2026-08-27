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
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

  function dateKey(date = new Date()) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function parseKey(key) {
    const [y, m, d] = String(key || "").split("-").map(Number);
    return new Date(y || 2000, (m || 1) - 1, d || 1, 12, 0, 0, 0);
  }

  function addDays(key, days) {
    const d = parseKey(key);
    d.setDate(d.getDate() + Number(days || 0));
    return dateKey(d);
  }

  function startOfWeek(key = dateKey()) {
    const d = parseKey(key);
    const weekday = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - weekday);
    return dateKey(d);
  }

  function weekKeys(startKey) {
    return Array.from({ length: 7 }, (_, i) => addDays(startKey, i));
  }

  function levenshtein(a = "", b = "") {
    const x = normalize(a);
    const y = normalize(b);
    if (x === y) return 0;
    if (!x) return y.length;
    if (!y) return x.length;
    const prev = Array.from({ length: y.length + 1 }, (_, i) => i);
    const curr = new Array(y.length + 1);
    for (let i = 1; i <= x.length; i += 1) {
      curr[0] = i;
      for (let j = 1; j <= y.length; j += 1) {
        curr[j] = Math.min(
          curr[j - 1] + 1,
          prev[j] + 1,
          prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
        );
      }
      for (let j = 0; j <= y.length; j += 1) prev[j] = curr[j];
    }
    return prev[y.length];
  }

  function fuzzyTokenScore(queryToken, candidateToken) {
    if (!queryToken || !candidateToken) return 0;
    if (candidateToken === queryToken) return 120;
    if (candidateToken.startsWith(queryToken)) return 95;
    if (candidateToken.includes(queryToken)) return 75;
    const distance = levenshtein(queryToken, candidateToken);
    const maxLen = Math.max(queryToken.length, candidateToken.length, 1);
    const similarity = 1 - distance / maxLen;
    if (similarity >= 0.8) return Math.round(similarity * 70);
    if (queryToken.length >= 4 && similarity >= 0.65) return Math.round(similarity * 45);
    return 0;
  }

  function foodSearchScore(food = {}, query = "", boosts = {}) {
    const q = normalize(query);
    if (!q) {
      return (boosts.favorite ? 400 : 0) + (Number(boosts.frequency) || 0) * 10 + (boosts.recent ? 25 : 0);
    }

    const name = normalize(food.name || food.nom || "");
    const extra = normalize(`${food.category || ""} ${food.subcategory || ""} ${food.brand || ""}`);
    if (name === q) return 2000;
    if (name.startsWith(q)) return 1500;
    if (name.includes(q)) return 1200;

    const qTokens = q.split(" ").filter(Boolean);
    const nameTokens = name.split(" ").filter(Boolean);
    const extraTokens = extra.split(" ").filter(Boolean);
    let score = 0;

    for (const token of qTokens) {
      let best = 0;
      for (const candidate of nameTokens) best = Math.max(best, fuzzyTokenScore(token, candidate));
      for (const candidate of extraTokens) best = Math.max(best, Math.round(fuzzyTokenScore(token, candidate) * 0.45));
      if (!best) return 0;
      score += best;
    }

    score += boosts.favorite ? 220 : 0;
    score += Math.min(180, (Number(boosts.frequency) || 0) * 18);
    score += boosts.recent ? 70 : 0;
    return score;
  }

  function fuzzyFoodSearch(foods = [], query = "", context = {}, limit = 36) {
    const usage = context.usage || {};
    const favorites = context.favorites || {};
    const recentKeys = new Set(context.recentKeys || []);

    return (Array.isArray(foods) ? foods : [])
      .map((food) => {
        const id = String(food.id || "");
        const usageItems = Object.values(usage).filter((item) =>
          item?.food?.id && id && String(item.food.id) === id
        );
        const frequency = usageItems.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
        const favorite = !!favorites[id] || Object.values(favorites).some((item) => item?.food?.id === id);
        const recent = recentKeys.has(id);
        return {
          food,
          score: foodSearchScore(food, query, { favorite, frequency, recent }),
        };
      })
      .filter((row) => !query || row.score > 0)
      .sort((a, b) => b.score - a.score || String(a.food.name || "").localeCompare(String(b.food.name || ""), "fr"))
      .slice(0, limit)
      .map((row) => row.food);
  }

  const mealAliases = [
    ["Petit-déjeuner", ["petit dejeuner", "petit-dejeuner", "petitdej", "breakfast", "matin"]],
    ["Déjeuner", ["dejeuner", "midi", "lunch"]],
    ["Dîner", ["diner", "soir", "dinner"]],
    ["Collation", ["collation", "snack", "gouter", "gouter", "encas"]],
  ];

  function detectMeal(text = "") {
    const n = normalize(text);
    for (const [meal, aliases] of mealAliases) {
      if (aliases.some((alias) => n.includes(normalize(alias)))) return meal;
    }
    return null;
  }

  function stripMealWords(text = "") {
    let out = normalize(text);
    for (const [, aliases] of mealAliases) {
      aliases.forEach((alias) => {
        const a = normalize(alias);
        out = out.replace(new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), " ");
      });
    }
    return out.replace(/\s+/g, " ").trim();
  }

  function parseQuickEntry(text = "") {
    const raw = String(text || "").trim();
    const meal = detectMeal(raw) || "Déjeuner";
    let working = stripMealWords(raw);
    const quantityMatch = working.match(
      /(?:^|\s)(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l|litre|litres|unite|unites|unité|unités)?(?:\s|$)/i,
    );

    let quantity = null;
    let unit = null;
    if (quantityMatch) {
      quantity = Number(quantityMatch[1].replace(",", "."));
      const rawUnit = normalize(quantityMatch[2] || "");
      unit =
        rawUnit === "litre" || rawUnit === "litres" || rawUnit === "l" ? "l" :
        rawUnit === "kg" ? "kg" :
        rawUnit === "ml" ? "ml" :
        rawUnit === "cl" ? "cl" :
        rawUnit === "unite" || rawUnit === "unites" ? "unit" :
        rawUnit === "g" ? "g" :
        null;

      working = `${working.slice(0, quantityMatch.index)} ${working.slice((quantityMatch.index || 0) + quantityMatch[0].length)}`
        .replace(/\s+/g, " ")
        .trim();
    }

    if (quantity != null && !unit) unit = quantity <= 10 ? "unit" : "g";
    if (quantity == null) {
      quantity = 100;
      unit = "g";
    }

    return {
      raw,
      meal,
      quantity,
      unit,
      query: working.trim(),
    };
  }

  function journalTotals(journal = []) {
    return (Array.isArray(journal) ? journal : []).reduce((acc, entry) => {
      acc.calories += Number(entry?.calories) || 0;
      acc.protein += Number(entry?.proteines ?? entry?.protein) || 0;
      acc.carbs += Number(entry?.glucides ?? entry?.carbs) || 0;
      acc.fat += Number(entry?.lipides ?? entry?.fat) || 0;
      acc.fiber += Number(entry?.fibres ?? entry?.fiber) || 0;
      acc.sugars += Number(entry?.sucres ?? entry?.sugars) || 0;
      acc.saturatedFat += Number(entry?.grasSatures ?? entry?.saturatedFat) || 0;
      acc.salt += Number(entry?.sel ?? entry?.salt) || 0;
      acc.entries += 1;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugars: 0, saturatedFat: 0, salt: 0, entries: 0 });
  }

  function dailyJournal(daily = {}, key, currentKey = "", currentJournal = []) {
    if (key === currentKey && Array.isArray(currentJournal)) return currentJournal;
    return Array.isArray(daily?.[key]) ? daily[key] : [];
  }

  function weekSummary(daily = {}, startKey, { currentKey = "", currentJournal = [], dailyMetrics = {}, activities = [] } = {}) {
    const keys = weekKeys(startKey);
    const days = keys.map((key) => {
      const journal = dailyJournal(daily, key, currentKey, currentJournal);
      const nutrition = journalTotals(journal);
      const metric = dailyMetrics?.[key] || {};
      const dayActivities = (Array.isArray(activities) ? activities : []).filter((a) => a?.date === key);
      const activityMinutes = dayActivities.reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
      return {
        key,
        hasData: journal.length > 0 || Number(metric.sleepHours) > 0 || activityMinutes > 0,
        nutrition,
        sleepHours: Number(metric.sleepHours) || 0,
        activityMinutes,
        workouts: dayActivities.length,
      };
    });

    const trackedNutritionDays = days.filter((day) => day.nutrition.entries > 0);
    const sleepDays = days.filter((day) => day.sleepHours > 0);
    const sum = (array, getter) => array.reduce((total, item) => total + getter(item), 0);

    return {
      startKey,
      endKey: keys[6],
      days,
      nutritionDays: trackedNutritionDays.length,
      avgCalories: trackedNutritionDays.length ? Math.round(sum(trackedNutritionDays, (d) => d.nutrition.calories) / trackedNutritionDays.length) : 0,
      avgProtein: trackedNutritionDays.length ? round1(sum(trackedNutritionDays, (d) => d.nutrition.protein) / trackedNutritionDays.length) : 0,
      avgFiber: trackedNutritionDays.length ? round1(sum(trackedNutritionDays, (d) => d.nutrition.fiber) / trackedNutritionDays.length) : 0,
      avgSalt: trackedNutritionDays.length ? round1(sum(trackedNutritionDays, (d) => d.nutrition.salt) / trackedNutritionDays.length) : 0,
      avgSleep: sleepDays.length ? round1(sum(sleepDays, (d) => d.sleepHours) / sleepDays.length) : 0,
      activityMinutes: sum(days, (d) => d.activityMinutes),
      workouts: sum(days, (d) => d.workouts),
    };
  }

  function percentDelta(current, previous) {
    const a = Number(current) || 0;
    const b = Number(previous) || 0;
    if (!b) return null;
    return Math.round(((a - b) / Math.abs(b)) * 100);
  }

  function weeklyInsights(current = {}, previous = {}, goals = {}, calorieTarget = 0, proteinTarget = 0) {
    const insights = [];
    if (current.nutritionDays < 3) {
      insights.push("Encore peu de journées nutritionnelles enregistrées cette semaine : le bilan deviendra plus précis avec la régularité.");
    } else {
      if (calorieTarget > 0) {
        const diff = current.avgCalories - calorieTarget;
        if (Math.abs(diff) <= calorieTarget * 0.08) insights.push("Les calories moyennes sont proches de ta cible.");
        else if (diff > 0) insights.push(`Les calories moyennes sont environ ${Math.round(diff)} kcal au-dessus de ta cible.`);
        else insights.push(`Les calories moyennes sont environ ${Math.round(Math.abs(diff))} kcal sous ta cible.`);
      }
      if (proteinTarget > 0 && current.avgProtein < proteinTarget * 0.85) {
        insights.push(`Les protéines moyennes sont encore basses (${Math.round(current.avgProtein)} g/j pour une cible de ${Math.round(proteinTarget)} g).`);
      }
      if (current.avgFiber < (Number(goals.fiberDaily) || 30) * 0.8) {
        insights.push(`Les fibres sont à renforcer : ${round1(current.avgFiber)} g/j en moyenne.`);
      }
    }

    if (Number(goals.sleepAverage) > 0 && current.avgSleep > 0 && current.avgSleep < Number(goals.sleepAverage) - 0.4) {
      insights.push(`Sommeil moyen ${current.avgSleep} h : en dessous de ton objectif de ${goals.sleepAverage} h.`);
    }
    if (Number(goals.weeklyActivityMinutes) > 0 && current.activityMinutes < Number(goals.weeklyActivityMinutes)) {
      insights.push(`Activité : ${current.activityMinutes}/${goals.weeklyActivityMinutes} min cette semaine.`);
    }
    if (Number(goals.weeklyWorkouts) > 0 && current.workouts < Number(goals.weeklyWorkouts)) {
      insights.push(`Séances : ${current.workouts}/${goals.weeklyWorkouts} cette semaine.`);
    }

    const kcalDelta = percentDelta(current.avgCalories, previous.avgCalories);
    if (kcalDelta != null && Math.abs(kcalDelta) >= 10) {
      insights.push(`Calories moyennes ${kcalDelta > 0 ? "en hausse" : "en baisse"} de ${Math.abs(kcalDelta)}% par rapport à la semaine précédente.`);
    }

    return insights.slice(0, 5);
  }

  function recipeTotals(items = []) {
    return (Array.isArray(items) ? items : []).reduce((acc, item) => {
      const n = item?.nutrition || {};
      acc.calories += Number(n.calories) || 0;
      acc.protein += Number(n.protein) || 0;
      acc.carbs += Number(n.carbs) || 0;
      acc.fat += Number(n.fat) || 0;
      acc.fiber += Number(n.fiber) || 0;
      acc.sugars += Number(n.sugars) || 0;
      acc.saturatedFat += Number(n.saturatedFat) || 0;
      acc.salt += Number(n.salt) || 0;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugars: 0, saturatedFat: 0, salt: 0 });
  }

  function normalizeMealSignature(journal = [], slot = "") {
    const names = (Array.isArray(journal) ? journal : [])
      .filter((entry) => entry?.repasSlot === slot)
      .map((entry) => normalize(String(entry?.nom || "").replace(/\([^)]*(?:g|kg|ml|cl|l|unité|unités)[^)]*\)\s*$/iu, "")))
      .filter(Boolean)
      .sort();
    return names.join("|");
  }

  function detectMealHabits(daily = {}, { days = 14, minOccurrences = 3, endKey = dateKey() } = {}) {
    const slots = ["Petit-déjeuner", "Déjeuner", "Dîner", "Collation"];
    const candidates = new Map();

    for (let i = 1; i <= days; i += 1) {
      const key = addDays(endKey, -i);
      const journal = daily?.[key] || [];
      for (const slot of slots) {
        const signature = normalizeMealSignature(journal, slot);
        if (!signature) continue;
        const id = `${slot}|${signature}`;
        const existing = candidates.get(id) || { slot, signature, count: 0, lastDate: key, entries: [] };
        existing.count += 1;
        if (key > existing.lastDate) existing.lastDate = key;
        if (!existing.entries.length) existing.entries = journal.filter((entry) => entry?.repasSlot === slot);
        candidates.set(id, existing);
      }
    }

    return [...candidates.values()]
      .filter((item) => item.count >= minOccurrences)
      .sort((a, b) => b.count - a.count || String(b.lastDate).localeCompare(String(a.lastDate)))
      .slice(0, 5);
  }

  function weightPoint(item = {}) {
    const value = Number(item.weight ?? item.poids ?? item.value);
    const date = item.createdAt || item.date;
    const time = Date.parse(date);
    return Number.isFinite(value) && Number.isFinite(time) ? { value, time } : null;
  }

  function adaptiveCalorieSuggestion(weightHistory = [], goalMode = "maintain", calorieTarget = 0) {
    const points = (Array.isArray(weightHistory) ? weightHistory : [])
      .map(weightPoint)
      .filter(Boolean)
      .sort((a, b) => a.time - b.time)
      .filter((point, index, all) => point.time >= all[all.length - 1].time - 35 * 86400000);

    if (points.length < 4) return null;
    const spanDays = (points[points.length - 1].time - points[0].time) / 86400000;
    if (spanDays < 14) return null;

    const x0 = points[0].time;
    const xs = points.map((p) => (p.time - x0) / 86400000);
    const ys = points.map((p) => p.value);
    const xMean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const yMean = ys.reduce((a, b) => a + b, 0) / ys.length;
    let numerator = 0;
    let denominator = 0;
    xs.forEach((x, i) => {
      numerator += (x - xMean) * (ys[i] - yMean);
      denominator += (x - xMean) ** 2;
    });
    if (!denominator) return null;

    const weeklyKg = round1((numerator / denominator) * 7);
    let delta = 0;
    let reason = "";

    if (goalMode === "loss") {
      if (weeklyKg > -0.1) { delta = -100; reason = "La tendance de poids est presque stable malgré un objectif de perte."; }
      else if (weeklyKg < -0.9) { delta = 100; reason = "La tendance baisse rapidement ; une cible légèrement plus haute peut être plus progressive."; }
    } else if (goalMode === "muscle") {
      if (weeklyKg < 0.05) { delta = 100; reason = "La tendance de poids est stable malgré un objectif de prise."; }
      else if (weeklyKg > 0.6) { delta = -100; reason = "La tendance monte rapidement ; une hausse calorique plus modérée peut être utile."; }
    } else if (goalMode === "maintain" || goalMode === "eatbetter" || goalMode === "activity") {
      if (weeklyKg > 0.3) { delta = -100; reason = "La tendance monte alors que l'objectif est proche du maintien."; }
      else if (weeklyKg < -0.3) { delta = 100; reason = "La tendance baisse alors que l'objectif est proche du maintien."; }
    } else if (goalMode === "recomp" && Math.abs(weeklyKg) > 0.5) {
      delta = weeklyKg > 0 ? -100 : 100;
      reason = "Pour une recomposition, une variation de poids plus modérée est généralement plus cohérente.";
    }

    if (!delta || !(Number(calorieTarget) > 0)) {
      return { weeklyKg, delta: 0, suggestedTarget: Number(calorieTarget) || 0, reason: "La tendance actuelle ne justifie pas d'ajustement automatique." };
    }

    return {
      weeklyKg,
      delta,
      suggestedTarget: Math.max(1200, Math.round((Number(calorieTarget) + delta) / 10) * 10),
      reason,
    };
  }

  function priorities({ account = {}, totals = {}, goals = {}, sleepHours = 0 } = {}) {
    const items = [];
    const waterGoal = Number(account.objectifEau) || 8;
    const water = Number(account.verresEau) || 0;
    const stepsGoal = Number(account.objectifPas) || 10000;
    const steps = Number(account.pasEffectues) || 0;
    const proteinGoal = Number(account.macroTargets?.protein) || 0;
    const fiberGoal = Number(goals.fiberDaily) || 30;
    const calorieGoal = Number(account.objectifCalories) || 0;

    if (water < waterGoal) items.push({ key: "water", icon: "💧", title: `${round1(waterGoal - water)} verre${waterGoal - water > 1 ? "s" : ""} d'eau`, score: (waterGoal - water) / waterGoal });
    if (steps < stepsGoal) items.push({ key: "steps", icon: "👟", title: `${Math.round(stepsGoal - steps).toLocaleString("fr-FR")} pas`, score: (stepsGoal - steps) / stepsGoal });
    if (proteinGoal > 0 && totals.protein < proteinGoal) items.push({ key: "protein", icon: "💪", title: `${Math.round(proteinGoal - totals.protein)} g protéines`, score: (proteinGoal - totals.protein) / proteinGoal + 0.15 });
    if (totals.fiber < fiberGoal) items.push({ key: "fiber", icon: "🌾", title: `${round1(fiberGoal - totals.fiber)} g fibres`, score: (fiberGoal - totals.fiber) / fiberGoal + 0.1 });
    if (calorieGoal > 0 && totals.calories < calorieGoal * 0.55) items.push({ key: "calories", icon: "🔥", title: `${Math.max(0, Math.round(calorieGoal - totals.calories))} kcal restantes`, score: 0.25 });
    if (Number(goals.sleepAverage) > 0 && sleepHours > 0 && sleepHours < Number(goals.sleepAverage)) {
      items.push({ key: "sleep", icon: "🌙", title: `${round1(Number(goals.sleepAverage) - sleepHours)} h de sommeil à récupérer`, score: 0.65 });
    }

    return items.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  function calendarCells(year, monthIndex) {
    const first = new Date(year, monthIndex, 1, 12);
    const count = new Date(year, monthIndex + 1, 0, 12).getDate();
    const mondayOffset = (first.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < mondayOffset; i += 1) cells.push(null);
    for (let day = 1; day <= count; day += 1) cells.push(dateKey(new Date(year, monthIndex, day, 12)));
    while (cells.length % 7) cells.push(null);
    return cells;
  }

  globalThis.WellnessSmartCoreV44 = {
    normalize,
    round1,
    clamp,
    dateKey,
    parseKey,
    addDays,
    startOfWeek,
    weekKeys,
    levenshtein,
    fuzzyFoodSearch,
    foodSearchScore,
    parseQuickEntry,
    journalTotals,
    weekSummary,
    percentDelta,
    weeklyInsights,
    recipeTotals,
    normalizeMealSignature,
    detectMealHabits,
    adaptiveCalorieSuggestion,
    priorities,
    calendarCells,
  };
})();
