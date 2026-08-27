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

  function shouldShowEveningSummary(hour, forced = false) {
    return !!forced || Number(hour) >= 18;
  }

  function labelsToHide(labels = []) {
    const result = [];
    let previous = "";
    (Array.isArray(labels) ? labels : []).forEach((label) => {
      const text = String(label || "").trim();
      const comparable = normalize(text);
      const meaningful = /\d/.test(text) || comparable.length > 2;
      const hide = meaningful && comparable && comparable === previous;
      result.push(hide);
      if (!hide && comparable) previous = comparable;
    });
    return result;
  }

  function mergeHomePrefs(value = {}) {
    return {
      score: value.score !== false,
      stats: value.stats !== false,
      priorities: value.priorities !== false,
      coach: value.coach !== false,
      meals: value.meals !== false,
      shortcuts: value.shortcuts !== false,
      evening: value.evening !== false,
      animations: value.animations !== false,
      haptics: value.haptics !== false,
    };
  }

  function eveningSummary({ account = {}, totals = {}, goals = {}, sleepHours = 0 } = {}) {
    const calorieTarget = Number(account.objectifCalories) || 0;
    const proteinTarget = Number(account.macroTargets?.protein) || 0;
    const waterTarget = Number(account.objectifEau) || 8;
    const stepsTarget = Number(account.objectifPas) || 10000;
    const water = Number(account.verresEau) || 0;
    const steps = Number(account.pasEffectues) || 0;
    const fiberTarget = Number(goals.fiberDaily) || 30;
    const sleepTarget = Number(goals.sleepAverage) || 7.5;

    const items = [
      { key: "calories", label: "Calories", value: Math.round(Number(totals.calories) || 0), target: calorieTarget, unit: "kcal" },
      { key: "protein", label: "Protéines", value: round1(totals.protein), target: proteinTarget, unit: "g" },
      { key: "fiber", label: "Fibres", value: round1(totals.fiber), target: fiberTarget, unit: "g" },
      { key: "water", label: "Eau", value: round1(water), target: waterTarget, unit: "verres" },
      { key: "steps", label: "Pas", value: Math.round(steps), target: stepsTarget, unit: "" },
    ];

    const tips = [];
    if (proteinTarget > 0 && Number(totals.protein) < proteinTarget * 0.8) {
      tips.push(`Il manque encore environ ${Math.max(0, Math.round(proteinTarget - Number(totals.protein || 0)))} g de protéines pour ta cible.`);
    }
    if (Number(totals.fiber) < fiberTarget * 0.75) {
      tips.push(`Fibres encore basses aujourd'hui (${round1(totals.fiber)} g).`);
    }
    if (water < waterTarget) {
      tips.push(`Hydratation : ${round1(waterTarget - water)} verre${waterTarget - water > 1 ? "s" : ""} restant${waterTarget - water > 1 ? "s" : ""}.`);
    }
    if (steps < stepsTarget * 0.7) {
      tips.push(`Il reste ${Math.max(0, Math.round(stepsTarget - steps)).toLocaleString("fr-FR")} pas pour ton objectif.`);
    }
    if (sleepHours > 0 && sleepHours < sleepTarget - 0.5) {
      tips.push(`Sommeil noté : ${round1(sleepHours)} h pour un repère personnel de ${round1(sleepTarget)} h.`);
    }

    return { items, tips: tips.slice(0, 2) };
  }

  function emptyStateAction(text = "") {
    const n = normalize(text);
    if (!n.startsWith("aucun") && !n.startsWith("aucune") && !n.includes("pas encore")) return "";
    if (n.includes("activite")) return "Ajouter une activité";
    if (n.includes("pesee") || n.includes("poids")) return "Ajouter mon poids";
    if (n.includes("photo")) return "Ajouter une photo";
    if (n.includes("aliment") || n.includes("journal")) return "Ajouter un aliment";
    if (n.includes("repas")) return "Créer mon premier repas";
    return "Commencer";
  }

  function universalMatchScore(label = "", query = "") {
    const l = normalize(label);
    const q = normalize(query);
    if (!q) return 0;
    if (l === q) return 1000;
    if (l.startsWith(q)) return 750;
    if (l.includes(q)) return 500;
    const tokens = q.split(" ").filter(Boolean);
    const hits = tokens.filter((token) => l.includes(token)).length;
    return hits ? hits * 80 : 0;
  }

  globalThis.WellnessPolishCoreV51 = {
    normalize,
    round1,
    shouldShowEveningSummary,
    labelsToHide,
    mergeHomePrefs,
    eveningSummary,
    emptyStateAction,
    universalMatchScore,
  };
})();
