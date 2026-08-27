"use strict";

window.WellnessCore = (() => {
  const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || 0));
  const kgToLb = (kg) => round1((Number(kg) || 0) * 2.2046226218);
  const lbToKg = (lb) => round1((Number(lb) || 0) / 2.2046226218);

  function scaleFood(food, grams = 100) {
    const factor = Math.max(0, Number(grams) || 0) / 100;
    return {
      grams: round1(grams),
      calories: Math.round((Number(food.kcal) || 0) * factor),
      protein: round1((Number(food.protein) || 0) * factor),
      carbs: round1((Number(food.carbs) || 0) * factor),
      fat: round1((Number(food.fat) || 0) * factor),
      fiber: round1((Number(food.fiber) || 0) * factor),
    };
  }

  function calorieAdherence(consumed, target) {
    const t = Number(target) || 0;
    if (t <= 0) return 0;
    const delta = Math.abs((Number(consumed) || 0) - t) / t;
    return Math.round(clamp(100 - delta * 120, 0, 100));
  }

  function macroAdherence(value, target) {
    const t = Number(target) || 0;
    if (t <= 0) return 0;
    return Math.round(clamp((Number(value) || 0) / t * 100, 0, 100));
  }

  function healthScore(metrics = {}) {
    const parts = [];
    const add = (value, weight) => {
      if (Number.isFinite(Number(value))) parts.push({ value: clamp(value, 0, 100), weight });
    };
    add(metrics.waterPct, 1.15);
    add(metrics.stepsPct, 1.15);
    add(metrics.mealsPct, 0.75);
    if (Number(metrics.calorieTarget) > 0) add(calorieAdherence(metrics.calories, metrics.calorieTarget), 1.1);
    if (Number(metrics.proteinTarget) > 0) add(macroAdherence(metrics.protein, metrics.proteinTarget), 0.9);
    if (Number(metrics.sleepHours) > 0) {
      const sleep = Number(metrics.sleepHours);
      const sleepScore = sleep >= 7 && sleep <= 9 ? 100 : sleep < 7 ? clamp(sleep / 7 * 100, 0, 100) : clamp(100 - (sleep - 9) * 14, 40, 100);
      add(sleepScore, 1.05);
    }
    if (Number(metrics.mood) > 0) add(Number(metrics.mood) / 5 * 100, 0.55);
    if (!parts.length) return 0;
    const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
    return Math.round(parts.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight);
  }

  function percentDelta(current, previous) {
    const c = Number(current) || 0;
    const p = Number(previous) || 0;
    if (p === 0) return c === 0 ? 0 : null;
    return round1((c - p) / Math.abs(p) * 100);
  }

  function linearRegression(points) {
    const clean = (points || []).filter((p) => Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)));
    if (clean.length < 2) return null;
    const n = clean.length;
    const sx = clean.reduce((s, p) => s + Number(p.x), 0);
    const sy = clean.reduce((s, p) => s + Number(p.y), 0);
    const sxy = clean.reduce((s, p) => s + Number(p.x) * Number(p.y), 0);
    const sxx = clean.reduce((s, p) => s + Number(p.x) ** 2, 0);
    const denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-9) return null;
    const slope = (n * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / n;
    return { slope, intercept };
  }

  function weightForecast(history, target, goalMode = "maintain") {
    const latestByDay = new Map();
    (history || []).forEach((e, index) => {
      const date = new Date(`${e?.date || ""}T12:00:00`);
      const weight = Number(e?.weight);
      if (Number.isNaN(date.getTime()) || !Number.isFinite(weight)) return;
      const createdAt = Date.parse(e?.createdAt || "");
      const order = Number.isFinite(createdAt) ? createdAt : date.getTime() + index;
      const previous = latestByDay.get(e.date);
      if (!previous || order >= previous.order) latestByDay.set(e.date, { date, weight, order });
    });
    const clean = [...latestByDay.values()]
      .sort((a, b) => a.date - b.date)
      .slice(-14);
    const targetWeight = Number(target);
    if (!Number.isFinite(targetWeight) || clean.length === 0) return null;
    const last = clean[clean.length - 1];
    const startMs = clean[0].date.getTime();
    const day = 86400000;
    const points = clean.map((e) => ({ x: (e.date.getTime() - startMs) / day, y: e.weight }));
    const regression = linearRegression(points);
    let dailyRate = regression?.slope || 0;
    const needsLoss = targetWeight < last.weight;
    const needsGain = targetWeight > last.weight;
    const trendUseful = (needsLoss && dailyRate < -0.005) || (needsGain && dailyRate > 0.005);
    let source = "tendance";
    if (!trendUseful) {
      const weekly = goalMode === "muscle" ? 0.2 : goalMode === "loss" ? -0.4 : goalMode === "recomp" ? -0.15 : 0;
      dailyRate = weekly / 7;
      source = "rythme indicatif";
    }
    if (Math.abs(dailyRate) < 0.001) return { date: null, days: null, dailyRate, source, current: last.weight, target: targetWeight };
    const days = (targetWeight - last.weight) / dailyRate;
    if (!Number.isFinite(days) || days < 0 || days > 730) return { date: null, days: null, dailyRate, source, current: last.weight, target: targetWeight };
    const date = new Date(last.date);
    date.setDate(date.getDate() + Math.ceil(days));
    return { date, days: Math.ceil(days), dailyRate, source, current: last.weight, target: targetWeight };
  }

  function recipeText(recipe) {
    return [recipe?.nom, recipe?.categorie, recipe?.typeRepas, ...(recipe?.ingredients || [])].join(" ").toLowerCase();
  }

  const sets = {
    meat: /poulet|dinde|b[œo]uf|boeuf|porc|jambon|steak|viande|filet mignon/,
    fish: /saumon|thon|cabillaud|colin|sardine|crevette|poisson|fruits? de mer/,
    dairy: /lait|fromage|feta|ricotta|mozzarella|skyr|yaourt|parmesan|cr[eè]me/,
    egg: /\bœufs?\b|\boeufs?\b|omelette/,
    gluten: /pain|p[aâ]tes|pate|farine|tortilla|semoule|boulgour|orzo|gnocchi|cro[uû]ton|muesli|granola|avoine/,
    nuts: /amande|noix|noisette|cacahu[eè]te|pistache|noix de cajou|pur[eé]e d.amande/,
    soy: /tofu|soja|edamame/,
    shellfish: /crevette|crabe|homard|moule|hu[iî]tre|fruits? de mer/,
  };

  function recipeAllowed(recipe, prefs = {}) {
    const text = recipeText(recipe);
    const diet = prefs.diet || "omnivore";
    if (diet === "vegetarian" && (sets.meat.test(text) || sets.fish.test(text))) return false;
    if (diet === "vegan" && (sets.meat.test(text) || sets.fish.test(text) || sets.dairy.test(text) || sets.egg.test(text))) return false;
    if (diet === "pescatarian" && sets.meat.test(text)) return false;
    if (prefs.noPork && /porc|jambon|filet mignon/.test(text)) return false;
    const allergies = new Set(prefs.allergies || []);
    if (allergies.has("lactose") && sets.dairy.test(text)) return false;
    if (allergies.has("gluten") && sets.gluten.test(text)) return false;
    if (allergies.has("nuts") && sets.nuts.test(text)) return false;
    if (allergies.has("egg") && sets.egg.test(text)) return false;
    if (allergies.has("fish") && sets.fish.test(text)) return false;
    if (allergies.has("shellfish") && sets.shellfish.test(text)) return false;
    if (allergies.has("soy") && sets.soy.test(text)) return false;
    const disliked = (prefs.disliked || []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
    if (disliked.some((x) => text.includes(x))) return false;
    return true;
  }

  function recommendationScore(recipe, context = {}) {
    let score = 50;
    const kcal = Number(recipe?.calories) || 0;
    const protein = Number(recipe?.proteines) || 0;
    const remaining = Number(context.remainingCalories);
    const proteinRemaining = Number(context.proteinRemaining);
    if (Number.isFinite(remaining) && remaining > 0) {
      const ratio = kcal / remaining;
      if (ratio >= .35 && ratio <= .85) score += 22;
      else if (ratio <= 1.05) score += 10;
      else score -= 22;
    }
    if (Number.isFinite(proteinRemaining) && proteinRemaining > 0) score += Math.min(22, protein / proteinRemaining * 22);
    if ((Number(recipe?.temps) || 99) <= 20) score += 6;
    if (context.goalMode === "muscle" || context.goalMode === "recomp" || context.goalMode === "loss") score += Math.min(10, protein / 4);
    return score;
  }

  return {
    round1, clamp, kgToLb, lbToKg, scaleFood, calorieAdherence, macroAdherence,
    healthScore, percentDelta, linearRegression, weightForecast, recipeAllowed,
    recommendationScore,
  };
})();

// ======================================================
// MOBILE FILES — iOS/Capacitor friendly share + PDF
// ======================================================
window.WellnessFiles = (() => {
  function toBlob(data, type = "application/octet-stream") {
    if (data instanceof Blob) return data;
    if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
      return new Blob([data], { type });
    }
    return new Blob([String(data)], { type });
  }

  async function shareOrDownload(filename, data, type = "application/octet-stream") {
    // Real Capacitor app: persist a temporary native file then open the iOS/Android share sheet.
    if (window.WellnessNative?.isNative?.()) {
      const nativeResult = await window.WellnessNative.writeAndShare(filename, data, type);
      if (nativeResult?.ok || nativeResult?.cancelled) return nativeResult;
      // If the native bridge fails unexpectedly, keep the browser fallbacks below.
    }

    const blob = toBlob(data, type);
    const file = new File([blob], filename, { type, lastModified: Date.now() });

    // iOS / Android / compatible WKWebView: use the native share sheet.
    try {
      if (typeof navigator.share === "function") {
        const shareData = { files: [file] };
        const canShareFiles =
          typeof navigator.canShare !== "function" ||
          navigator.canShare(shareData);

        if (canShareFiles) {
          // Keep this call directly in the click gesture chain.
          await navigator.share(shareData);
          return { ok: true, method: "share" };
        }
      }
    } catch (error) {
      // AbortError simply means the user closed the share sheet.
      if (error?.name === "AbortError") {
        return { ok: false, cancelled: true, method: "share" };
      }
      console.warn("Wellness share failed, using download fallback:", error);
    }

    // Desktop / normal browser fallback.
    try {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2500);
      return { ok: true, method: "download" };
    } catch (error) {
      console.error("Wellness file export failed:", error);
      return { ok: false, error, method: "none" };
    }
  }

  function ascii(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, "?")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
  }

  function buildTextPdf(lines = [], options = {}) {
    const title = ascii(options.title || "Wellness");
    const safeLines = [title, "", ...lines.map(ascii)];
    const pageWidth = 595;
    const pageHeight = 842;
    const left = 52;
    const top = 790;
    const lineHeight = 18;

    const commands = ["BT", "/F1 12 Tf", `${left} ${top} Td`];
    safeLines.forEach((line, index) => {
      if (index > 0) commands.push(`0 -${lineHeight} Td`);
      commands.push(`(${line}) Tj`);
    });
    commands.push("ET");
    const stream = commands.join("\n");

    const objects = [];
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
    objects[3] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>";
    objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
    objects[5] = `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`;

    let pdf = "%PDF-1.4\n";
    const offsets = [0];

    for (let i = 1; i <= 5; i += 1) {
      offsets[i] = new TextEncoder().encode(pdf).length;
      pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }

    const xrefOffset = new TextEncoder().encode(pdf).length;
    pdf += "xref\n0 6\n";
    pdf += "0000000000 65535 f \n";
    for (let i = 1; i <= 5; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += "trailer\n<< /Size 6 /Root 1 0 R >>\n";
    pdf += `startxref\n${xrefOffset}\n%%EOF`;

    return new TextEncoder().encode(pdf);
  }

  return { shareOrDownload, buildTextPdf };
})();

