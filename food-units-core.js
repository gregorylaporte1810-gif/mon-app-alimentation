(() => {
  "use strict";

  const normalizeText = (value = "") =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/['’]/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;

  function unitFamily(unit) {
    if (["g", "kg"].includes(unit)) return "mass";
    if (["ml", "cl", "l"].includes(unit)) return "volume";
    if (unit === "unit") return "count";
    return "unknown";
  }

  function inferDensity(food = {}) {
    const explicit = Number(food.density);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;

    const text = normalizeText(`${food.name || ""} ${food.category || ""} ${food.subcategory || ""}`);
    if (/huile/.test(text)) return 0.92;
    if (/miel/.test(text)) return 1.42;
    if (/sirop/.test(text)) return 1.33;
    if (/lait|boisson lactee|milk/.test(text)) return 1.03;
    if (/jus|nectar|smoothie/.test(text)) return 1.04;
    if (/soda|cola|limonade|boisson gazeuse/.test(text)) return 1.01;
    if (/vin|biere|cidre|alcool|spiritueux/.test(text)) return 0.98;
    if (/soupe|potage|bouillon/.test(text)) return 1.02;
    return 1;
  }

  function inferLiquid(food = {}) {
    if (typeof food.liquid === "boolean") return food.liquid;
    const text = normalizeText(`${food.name || ""} ${food.category || ""} ${food.subcategory || ""}`);
    return /boisson|eau|mineral|jus|nectar|smoothie|soda|cola|limonade|lait|cafe|the|infusion|vin|biere|cidre|alcool|spiritueux|soupe|potage|bouillon|huile|sirop/.test(text);
  }

  function inferPieceWeight(food = {}) {
    const explicit = Number(food.pieceWeight);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;

    const text = normalizeText(food.name || "");
    const rules = [
      [/oeuf|œuf/, 60],
      [/banane/, 120],
      [/pomme(?! de terre)/, 150],
      [/poire/, 160],
      [/orange/, 160],
      [/kiwi/, 80],
      [/mandarine|clementine/, 80],
      [/avocat/, 150],
      [/yaourt|skyr|fromage blanc/, 125],
      [/galette de riz/, 9],
      [/tranche.*pain|pain.*tranche/, 35],
    ];
    const match = rules.find(([pattern]) => pattern.test(text));
    return match ? match[1] : null;
  }

  function allowedUnits(food = {}) {
    const units = ["g", "kg"];
    if (inferLiquid(food)) units.push("ml", "cl", "l");
    units.push("unit");
    return units;
  }

  function toReferenceAmount(value, unit, food = {}, customPieceWeight = null) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const basisUnit = food.basisUnit || "g";
    const density = inferDensity(food);
    const pieceWeight = Number(customPieceWeight) > 0
      ? Number(customPieceWeight)
      : inferPieceWeight(food);

    let grams = null;
    let milliliters = null;

    if (unit === "g") grams = amount;
    if (unit === "kg") grams = amount * 1000;
    if (unit === "ml") milliliters = amount;
    if (unit === "cl") milliliters = amount * 10;
    if (unit === "l") milliliters = amount * 1000;

    if (unit === "unit") {
      if (!pieceWeight) return null;
      grams = amount * pieceWeight;
    }

    if (basisUnit === "ml") {
      if (milliliters != null) return milliliters;
      if (grams != null) return grams / density;
    }

    if (grams != null) return grams;
    if (milliliters != null) return milliliters * density;
    return null;
  }

  function scaleFood(food = {}, value = 100, unit = "g", customPieceWeight = null) {
    const referenceAmount = toReferenceAmount(value, unit, food, customPieceWeight);
    if (!Number.isFinite(referenceAmount) || referenceAmount <= 0) return null;
    const basisQuantity = Math.max(0.0001, Number(food.basisQuantity) || 100);
    const factor = referenceAmount / basisQuantity;
    return {
      value: Number(value),
      unit,
      referenceAmount: round1(referenceAmount),
      basisUnit: food.basisUnit || "g",
      density: inferDensity(food),
      pieceWeight: Number(customPieceWeight) > 0 ? Number(customPieceWeight) : inferPieceWeight(food),
      approximateVolume: ["ml", "cl", "l"].includes(unit) && (food.basisUnit || "g") === "g",
      calories: Math.max(0, Math.round((Number(food.kcal) || 0) * factor)),
      protein: round1((Number(food.protein) || 0) * factor),
      carbs: round1((Number(food.carbs) || 0) * factor),
      fat: round1((Number(food.fat) || 0) * factor),
      fiber: round1((Number(food.fiber) || 0) * factor),
      sugars: round1((Number(food.sugars) || 0) * factor),
      saturatedFat: round1((Number(food.saturatedFat) || 0) * factor),
      salt: round1((Number(food.salt) || 0) * factor),
    };
  }

  function formatQuantity(value, unit) {
    const n = round1(value);
    const shown = String(n).replace(".", ",");
    const label = unit === "l" ? "L" : unit === "unit" ? (n > 1 ? "unités" : "unité") : unit;
    return `${shown} ${label}`;
  }

  function stripQuantitySuffix(name = "") {
    return String(name)
      .replace(/(?:\s*\([0-9]+(?:[.,][0-9]+)?\s*(?:g|kg|ml|cl|l|L|unite|unites|unité|unités)\))+\s*$/iu, "")
      .trim();
  }

  globalThis.WellnessFoodUnits = {
    normalizeText,
    round1,
    unitFamily,
    inferDensity,
    inferLiquid,
    inferPieceWeight,
    allowedUnits,
    toReferenceAmount,
    scaleFood,
    formatQuantity,
    stripQuantitySuffix,
  };
})();
