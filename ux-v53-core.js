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

  function viewportRepair({ userAgent = "", screenWidth = 0, screenHeight = 0, innerWidth = 0, innerHeight = 0 } = {}) {
    const phoneLike =
      /iphone|ipod/i.test(userAgent) ||
      (/macintosh/i.test(userAgent) && Math.min(screenWidth, screenHeight) <= 520);

    const deviceWidth = Math.max(1, Math.min(Number(screenWidth) || 0, Number(screenHeight) || 0));
    const portrait = Number(innerHeight) >= Number(innerWidth);
    const ratio = deviceWidth > 0 ? Number(innerWidth) / deviceWidth : 1;

    const active =
      phoneLike &&
      portrait &&
      deviceWidth <= 520 &&
      Number(innerWidth) >= 460 &&
      ratio >= 1.18;

    return {
      active,
      deviceWidth,
      ratio: active ? Math.min(2.85, Math.max(1, ratio)) : 1,
    };
  }

  function isLiquid(food = {}) {
    if (food?.basisUnit === "ml") return true;
    if (food?.liquid === true) return true;

    const text = normalize(
      `${food?.name || ""} ${food?.category || ""} ${food?.subcategory || ""} ${food?.brand || ""}`
    );

    return /(^| )(boisson|eau|jus|nectar|smoothie|soda|cola|limonade|lait|cafe|the|infusion|tisane|vin|biere|cidre|alcool|spiritueux|cocktail|soupe|potage|bouillon|huile|sirop|vinaigre|sauce|kefir|kombucha|shake|milkshake|boisson vegetale|boisson lactee|boisson energetique|boisson sportive|yaourt a boire|creme liquide|lait de coco|a boire)( |$)/.test(text);
  }

  function allowedUnits(food = {}) {
    return isLiquid(food)
      ? ["ml", "cl", "l", "g", "kg", "unit"]
      : ["g", "kg", "unit"];
  }

  function defaultQuantity(food = {}) {
    return isLiquid(food)
      ? { value: 250, unit: "ml" }
      : { value: 100, unit: "g" };
  }

  function stepConstraints(unit = "g") {
    const map = {
      ml: { min: 1, max: 20000, step: 1 },
      cl: { min: 0.1, max: 2000, step: 0.1 },
      l: { min: 0.01, max: 20, step: 0.01 },
      g: { min: 1, max: 30000, step: 1 },
      kg: { min: 0.01, max: 50, step: 0.01 },
      unit: { min: 1, max: 100, step: 1 },
    };
    return map[unit] || map.g;
  }

  function sanitizeSteps(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.round(n));
  }

  globalThis.WellnessUsabilityCoreV53 = {
    normalize,
    viewportRepair,
    isLiquid,
    allowedUnits,
    defaultQuantity,
    stepConstraints,
    sanitizeSteps,
  };
})();
