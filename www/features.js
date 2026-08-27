"use strict";

// ======================================================
// WELLNESS COMPLETE — EXTENSIONS
// Toutes les données restent dans le compte actif/localStorage.
// ======================================================

const MEGA_VERSION = "2.0";
const MEGA_BASE_RECIPES = recettes.filter((r) => !r._megaCustom).slice();
let megaFavoriteFilter = "all";
let megaPlanWeekOffset = 0;
let megaCalendarCursor = new Date();
let megaDeferredInstallPrompt = null;

function megaToday() {
  return obtenirDateLocale();
}

function megaClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function megaDefaultState() {
  return {
    megaVersion: MEGA_VERSION,
    customRecipes: [],
    weightHistory: [],
    measurementHistory: [],
    progressPhotos: [],
    mealPlan: {},
    shoppingChecked: {},
    macroTargets: { protein: 0, carbs: 0, fat: 0 },
    mealDistribution: { breakfast: 25, lunch: 35, dinner: 30, snack: 10 },
    xp: 0,
    challengeCompletions: {},
    onboardingDone: false,
    reminderSettings: {
      waterEnabled: false,
      waterTime: "14:00",
      weightEnabled: false,
      weightTime: "08:00",
      sent: {},
    },
  };
}

function megaNormalizeAccount(account = obtenirCompteActif()) {
  const defaults = megaDefaultState();

  Object.entries(defaults).forEach(([key, value]) => {
    if (!(key in account)) {
      account[key] = megaClone(value);
    }
  });

  if (!Array.isArray(account.customRecipes)) account.customRecipes = [];
  if (!Array.isArray(account.weightHistory)) account.weightHistory = [];
  if (!Array.isArray(account.measurementHistory)) account.measurementHistory = [];
  if (!Array.isArray(account.progressPhotos)) account.progressPhotos = [];
  if (!account.mealPlan || typeof account.mealPlan !== "object") account.mealPlan = {};
  if (!account.shoppingChecked || typeof account.shoppingChecked !== "object") account.shoppingChecked = {};
  if (!account.challengeCompletions || typeof account.challengeCompletions !== "object") account.challengeCompletions = {};
  if (!account.reminderSettings || typeof account.reminderSettings !== "object") account.reminderSettings = megaClone(defaults.reminderSettings);
  account.reminderSettings = { ...defaults.reminderSettings, ...account.reminderSettings };
  account.mealDistribution = { ...defaults.mealDistribution, ...(account.mealDistribution || {}) };
  account.macroTargets = { ...defaults.macroTargets, ...(account.macroTargets || {}) };

  if (!account.onboardingDone && Number(account.age) >= 18 && Number(account.objectifCalories) > 0) {
    account.onboardingDone = true;
  }

  // Enrich old journal entries.
  if (Array.isArray(account.journalCalories)) {
    account.journalCalories.forEach((entry) => {
      if (!("repasSlot" in entry)) entry.repasSlot = megaGuessMealSlot(entry.nom);
      if (!("proteines" in entry)) entry.proteines = 0;
      if (!("glucides" in entry)) entry.glucides = 0;
      if (!("lipides" in entry)) entry.lipides = 0;
    });
  }

  megaCalculateMacroTargets(account);
  return account;
}

function megaAllAccountsNormalize() {
  Object.values(etatApplication.comptes).forEach(megaNormalizeAccount);
  sauvegarderEtatApplication();
}

function megaRecipeMacros(recipe) {
  const protein = Math.max(0, Number(recipe.proteines) || 0);
  let carbs = Number(recipe.glucides);
  let fat = Number(recipe.lipides);

  if (!Number.isFinite(carbs) || !Number.isFinite(fat)) {
    // Estimation uniquement pour les recettes historiques qui n'avaient pas encore ces champs.
    fat = Math.max(2, Math.round((Number(recipe.calories || 0) * 0.28) / 9));
    carbs = Math.max(0, Math.round((Number(recipe.calories || 0) - protein * 4 - fat * 9) / 4));
  }

  return { protein, carbs, fat };
}

function megaCalculateMacroTargets(account = obtenirCompteActif()) {
  const calories = Number(account.objectifCalories) || 0;
  const weight = Number(account.poidsActuel) || 0;

  if (calories <= 0 || weight <= 0) {
    account.macroTargets = account.macroTargets || { protein: 0, carbs: 0, fat: 0 };
    return account.macroTargets;
  }

  let proteinFactor = 1.5;
  if (account.typeObjectifCalories === "Perte de poids") proteinFactor = 1.8;
  if (account.typeObjectifCalories === "Prise de poids") proteinFactor = 1.7;

  const protein = Math.round((weight * proteinFactor) / 5) * 5;
  const fat = Math.max(Math.round(weight * 0.7 / 5) * 5, Math.round((calories * 0.22 / 9) / 5) * 5);
  const carbs = Math.max(0, Math.round(((calories - protein * 4 - fat * 9) / 4) / 5) * 5);

  account.macroTargets = { protein, carbs, fat };
  return account.macroTargets;
}

function megaJournalTotals(account = obtenirCompteActif()) {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  (account.journalCalories || []).forEach((entry) => {
    totals.calories += Number(entry.calories) || 0;
    totals.protein += Number(entry.proteines) || 0;
    totals.carbs += Number(entry.glucides) || 0;
    totals.fat += Number(entry.lipides) || 0;
  });
  return totals;
}

function megaGuessMealSlot(name = "") {
  const text = String(name).toLowerCase();
  if (text.includes("petit") || text.includes("porridge") || text.includes("pancake") || text.includes("toast")) return "Petit-déjeuner";
  if (text.includes("collation") || text.includes("skyr") || text.includes("mousse") || text.includes("energy")) return "Collation";
  return "Déjeuner";
}

function megaMealSlotFromRecipe(recipe) {
  if (!recipe) return "Déjeuner";
  if (recipe.typeRepas === "Petit-déjeuner") return "Petit-déjeuner";
  if (recipe.typeRepas === "Dessert" || recipe.typeRepas === "Collation") return "Collation";
  return "Déjeuner";
}

// ======================================================
// CUSTOM RECIPES
// ======================================================

function megaSyncCustomRecipes() {
  const account = megaNormalizeAccount();
  for (let i = recettes.length - 1; i >= 0; i -= 1) {
    if (recettes[i]._megaCustom) recettes.splice(i, 1);
  }

  account.customRecipes.forEach((recipe) => {
    recettes.push({ ...megaClone(recipe), _megaCustom: true });
  });
}

function megaFindRecipe(name) {
  return recettes.find((recipe) => recipe.nom === name) || null;
}

function megaOpenOverlay(overlay) {
  if (!overlay) return;
  overlay.classList.add("ouverte");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-ouverte");
}

function megaCloseOverlay(overlay) {
  if (!overlay) return;
  overlay.classList.remove("ouverte");
  overlay.setAttribute("aria-hidden", "true");
  if (!document.querySelector(".modal-simple-overlay.ouverte, .modal-filtres-overlay.ouverte")) {
    document.body.classList.remove("modal-ouverte");
  }
}

function megaSetupCustomRecipe() {
  const overlay = document.getElementById("mega-custom-recipe-overlay");
  const open = document.getElementById("mega-open-custom-recipe");
  const close = document.getElementById("mega-close-custom-recipe");
  const cancel = document.getElementById("mega-cancel-custom-recipe");
  const save = document.getElementById("mega-save-custom-recipe");
  const message = document.getElementById("mega-custom-recipe-message");

  open?.addEventListener("click", () => megaOpenOverlay(overlay));
  close?.addEventListener("click", () => megaCloseOverlay(overlay));
  cancel?.addEventListener("click", () => megaCloseOverlay(overlay));
  overlay?.addEventListener("click", (event) => { if (event.target === overlay) megaCloseOverlay(overlay); });

  save?.addEventListener("click", () => {
    const name = document.getElementById("mega-recipe-name").value.trim();
    const kcal = Number(document.getElementById("mega-recipe-kcal").value);
    const protein = Number(document.getElementById("mega-recipe-protein").value) || 0;
    const carbs = Number(document.getElementById("mega-recipe-carbs").value) || 0;
    const fat = Number(document.getElementById("mega-recipe-fat").value) || 0;
    const ingredients = document.getElementById("mega-recipe-ingredients").value.split("\n").map((x) => x.trim()).filter(Boolean);
    const preparation = document.getElementById("mega-recipe-prep").value.split("\n").map((x) => x.trim()).filter(Boolean);

    if (!name || !Number.isFinite(kcal) || kcal <= 0 || ingredients.length === 0) {
      message.textContent = "⚠️ Ajoute au minimum un nom, des calories et un ingrédient.";
      return;
    }

    const account = megaNormalizeAccount();
    if (recettes.some((recipe) => recipe.nom.toLowerCase() === name.toLowerCase())) {
      message.textContent = "⚠️ Une recette porte déjà ce nom.";
      return;
    }

    account.customRecipes.push({
      nom: name,
      typeRepas: document.getElementById("mega-recipe-type").value,
      categorie: document.getElementById("mega-recipe-category").value,
      temps: Math.max(1, Number(document.getElementById("mega-recipe-time").value) || 20),
      calories: Math.round(kcal),
      proteines: Math.round(protein * 10) / 10,
      glucides: Math.round(carbs * 10) / 10,
      lipides: Math.round(fat * 10) / 10,
      ingredients,
      preparation: preparation.length ? preparation : ["Préparer les ingrédients.", "Assembler puis servir."],
      personnalisée: true,
    });

    sauvegarderEtatApplication();
    megaSyncCustomRecipes();
    message.textContent = "✅ Recette ajoutée.";
    setTimeout(() => megaCloseOverlay(overlay), 350);
    rafraichirApplication();
  });
}

// ======================================================
// CALORIE JOURNAL EXTENSION — MACROS + MEAL SLOT
// ======================================================

const megaOriginalAddCalories = ajouterCaloriesAuJournal;
ajouterCaloriesAuJournal = function megaAddCalories(name, calories, source = "manuel", extras = {}) {
  const account = megaNormalizeAccount();
  const beforeIds = new Set((account.journalCalories || []).map((entry) => entry.id));
  const ok = megaOriginalAddCalories(name, calories, source);
  if (!ok) return false;

  const entry = [...account.journalCalories].reverse().find((item) => !beforeIds.has(item.id));
  if (!entry) return true;

  const recipe = source === "recette" ? megaFindRecipe(name) : null;
  const recipeMacros = recipe ? megaRecipeMacros(recipe) : { protein: 0, carbs: 0, fat: 0 };
  const mealInput = document.getElementById("mega-journal-meal");
  const pInput = document.getElementById("mega-journal-protein");
  const cInput = document.getElementById("mega-journal-carbs");
  const fInput = document.getElementById("mega-journal-fat");

  entry.repasSlot = extras.repasSlot || (source === "manuel" ? mealInput?.value : megaMealSlotFromRecipe(recipe));
  entry.proteines = Number.isFinite(Number(extras.proteines)) ? Number(extras.proteines) : (source === "manuel" && pInput?.value !== "" ? Number(pInput.value) : recipeMacros.protein);
  entry.glucides = Number.isFinite(Number(extras.glucides)) ? Number(extras.glucides) : (source === "manuel" && cInput?.value !== "" ? Number(cInput.value) : recipeMacros.carbs);
  entry.lipides = Number.isFinite(Number(extras.lipides)) ? Number(extras.lipides) : (source === "manuel" && fInput?.value !== "" ? Number(fInput.value) : recipeMacros.fat);
  entry.portions = Number(extras.portions) || 1;

  if (source === "manuel") {
    if (pInput) pInput.value = "";
    if (cInput) cInput.value = "";
    if (fInput) fInput.value = "";
  }

  sauvegarderEtatApplication();
  return true;
};

const megaOriginalJournalDisplay = afficherJournalCalories;
afficherJournalCalories = function megaJournalDisplay() {
  megaOriginalJournalDisplay();
  const account = megaNormalizeAccount();
  const rows = [...document.querySelectorAll("#journal-calories .journal-calories-item")];
  const entries = [...(account.journalCalories || [])].reverse();
  rows.forEach((row, index) => {
    const entry = entries[index];
    if (!entry) return;
    const info = row.querySelector("div");
    if (!info || info.querySelector(".mega-journal-macro-line")) return;
    const line = document.createElement("span");
    line.className = "mega-journal-macro-line";
    line.textContent = `${entry.repasSlot || "Repas"} • P ${Math.round(entry.proteines || 0)} g • G ${Math.round(entry.glucides || 0)} g • L ${Math.round(entry.lipides || 0)} g`;
    info.appendChild(line);
  });
};

// ======================================================
// PORTIONS + SMART DETAIL
// ======================================================

function megaParseNumber(text) {
  if (text.includes("/")) {
    const [a, b] = text.split("/").map(Number);
    return b ? a / b : Number(text);
  }
  return Number(text.replace(",", "."));
}

function megaPrettyNumber(value) {
  if (Math.abs(value - Math.round(value)) < 0.01) return String(Math.round(value));
  return String(Math.round(value * 10) / 10).replace(".", ",");
}

function megaScaleIngredient(ingredient, portions) {
  return ingredient.replace(/^(\d+(?:[.,]\d+)?|\d+\/\d+)\s*/, (match, raw) => {
    const number = megaParseNumber(raw);
    return Number.isFinite(number) ? megaPrettyNumber(number * portions) + " " : match;
  });
}

const megaOriginalDetailRecipe = afficherDetailRecette;
afficherDetailRecette = function megaDetailRecipe(recipe) {
  megaOriginalDetailRecipe(recipe);
  const macros = megaRecipeMacros(recipe);
  let portions = 1;

  const toolbar = document.createElement("div");
  toolbar.className = "mega-portion-toolbar";
  toolbar.innerHTML = `<div><span>Portions</span><select id="mega-portion-select"><option value="0.5">½</option><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></div><div class="mega-detail-macros" id="mega-detail-macros"></div><div class="mega-recipe-fit-detail" id="mega-recipe-fit-detail"></div>`;

  const firstH3 = detailRecette.querySelector("h3");
  if (firstH3) detailRecette.insertBefore(toolbar, firstH3);

  const ingredientList = detailRecette.querySelector("ul");
  const info = detailRecette.querySelector("p");
  const select = toolbar.querySelector("#mega-portion-select");
  const macroBox = toolbar.querySelector("#mega-detail-macros");
  const fitBox = toolbar.querySelector("#mega-recipe-fit-detail");

  function render() {
    if (ingredientList) {
      ingredientList.innerHTML = "";
      recipe.ingredients.forEach((ingredient) => {
        const li = document.createElement("li");
        li.textContent = megaScaleIngredient(ingredient, portions);
        ingredientList.appendChild(li);
      });
    }

    const kcal = Math.round(recipe.calories * portions);
    const p = Math.round(macros.protein * portions * 10) / 10;
    const c = Math.round(macros.carbs * portions * 10) / 10;
    const f = Math.round(macros.fat * portions * 10) / 10;
    if (info) info.textContent = `🍽️ ${recipe.typeRepas} • 🏷️ ${recipe.categorie} • 🔥 ${kcal} kcal • ⏱️ ${recipe.temps} min • 💪 ${p} g protéines`;
    macroBox.textContent = `P ${p} g · G ${c} g · L ${f} g`;

    const account = megaNormalizeAccount();
    const remaining = Math.max(0, Number(account.objectifCalories || 0) - Number(account.caloriesConsommees || 0));
    if (remaining > 0) {
      const pct = Math.round((kcal / remaining) * 100);
      fitBox.textContent = `${pct}% de tes calories restantes`;
      fitBox.classList.toggle("fit-good", pct <= 55);
    } else {
      fitBox.textContent = "Configure/actualise ta cible pour comparer";
      fitBox.classList.remove("fit-good");
    }

    const oldButton = detailRecette.querySelector(".bouton-ajouter-recette-journal");
    if (oldButton) {
      const cleanButton = oldButton.cloneNode(true);
      cleanButton.textContent = `🔥 Ajouter à aujourd'hui (+${kcal} kcal)`;
      oldButton.replaceWith(cleanButton);
      cleanButton.addEventListener("click", () => {
        ajouterCaloriesAuJournal(recipe.nom, kcal, "recette", { proteines: p, glucides: c, lipides: f, portions, repasSlot: megaMealSlotFromRecipe(recipe) });
        cleanButton.textContent = "✓ Ajouté au journal";
        rafraichirApplication();
      }, { once: true });
    }
  }

  select?.addEventListener("change", () => { portions = Number(select.value) || 1; render(); });
  render();
};

// ======================================================
// SMART RECIPE SUGGESTIONS
// ======================================================

function megaRenderSmartRecipes() {
  const copy = document.getElementById("mega-smart-recipe-copy");
  const grid = document.getElementById("mega-smart-recipe-grid");
  if (!copy || !grid) return;
  const account = megaNormalizeAccount();
  const target = Number(account.objectifCalories) || 0;
  const consumed = Number(account.caloriesConsommees) || 0;
  grid.innerHTML = "";

  if (target <= 0) {
    copy.textContent = "Configure ta cible calorique dans Profil pour obtenir des suggestions adaptées à ce qu'il te reste.";
    return;
  }

  const remaining = Math.max(0, target - consumed);
  copy.textContent = remaining > 0 ? `Il te reste environ ${Math.round(remaining)} kcal aujourd'hui. Voici des recettes qui s'intègrent bien à ta journée.` : "Ta cible estimée est déjà atteinte. Voici des options plus légères pour garder un repère.";
  const max = remaining > 0 ? Math.max(250, remaining * .7) : 430;
  const picks = recettes.filter((r) => r.calories <= max).sort((a, b) => {
    const scoreA = (a.proteines || 0) * 8 - Math.abs(max * .55 - a.calories) / 5;
    const scoreB = (b.proteines || 0) * 8 - Math.abs(max * .55 - b.calories) / 5;
    return scoreB - scoreA;
  }).slice(0, 3);

  picks.forEach((recipe) => {
    const card = document.createElement("button");
    card.className = "smart-recipe-mini";
    card.innerHTML = `<strong>${recipe.nom}</strong><span>🔥 ${recipe.calories} kcal · 💪 ${recipe.proteines} g</span><span class="smart-recipe-fit">${remaining > 0 ? Math.round(recipe.calories / remaining * 100) + "% du restant" : "Option légère"}</span>`;
    card.addEventListener("click", () => afficherDetailRecette(recipe));
    grid.appendChild(card);
  });
}

// ======================================================
// FAVORITES SMART COLLECTIONS
// ======================================================

const megaOriginalFavorites = mettreAJourFavoris;
mettreAJourFavoris = function megaFavorites() {
  megaOriginalFavorites();
  const account = megaNormalizeAccount();
  let favoriteRecipes = recettes.filter((recipe) => account.favoris[recipe.nom] === true);
  document.getElementById("mega-fav-count")?.replaceChildren(document.createTextNode(`${favoriteRecipes.length} favori${favoriteRecipes.length > 1 ? "s" : ""}`));

  if (megaFavoriteFilter === "quick") favoriteRecipes = favoriteRecipes.filter((r) => r.temps <= 20);
  if (megaFavoriteFilter === "light") favoriteRecipes = favoriteRecipes.filter((r) => r.calories < 500);
  if (megaFavoriteFilter === "protein") favoriteRecipes = favoriteRecipes.filter((r) => r.proteines >= 30);
  if (megaFavoriteFilter === "dinner") favoriteRecipes = favoriteRecipes.filter((r) => r.typeRepas === "Plat");

  if (megaFavoriteFilter !== "all") {
    listeFavoris.innerHTML = "";
    if (!favoriteRecipes.length) {
      const p = document.createElement("p"); p.className = "message-vide"; p.textContent = "Aucun favori dans cette collection."; listeFavoris.appendChild(p);
    } else favoriteRecipes.forEach((r) => listeFavoris.appendChild(creerCarteRecette(r)));
  }
};

document.querySelectorAll("[data-mega-fav]").forEach((button) => {
  button.addEventListener("click", () => {
    megaFavoriteFilter = button.dataset.megaFav;
    document.querySelectorAll("[data-mega-fav]").forEach((b) => b.classList.toggle("active", b === button));
    mettreAJourFavoris();
  });
});

// ======================================================
// MACROS + MEAL DISTRIBUTION
// ======================================================

function megaMealConsumed(account, slot) {
  return (account.journalCalories || []).filter((e) => e.repasSlot === slot).reduce((sum, e) => sum + Number(e.calories || 0), 0);
}

function megaRenderMacros() {
  const account = megaNormalizeAccount();
  const totals = megaJournalTotals(account);
  const targets = megaCalculateMacroTargets(account);
  const configured = targets.protein > 0;
  const status = document.getElementById("mega-macro-status");
  if (status) status.textContent = configured ? "Objectifs personnalisés" : "À configurer";

  [["protein", totals.protein, targets.protein], ["carbs", totals.carbs, targets.carbs], ["fat", totals.fat, targets.fat]].forEach(([key, value, goal]) => {
    const valueEl = document.getElementById(`mega-${key}-value`);
    const goalEl = document.getElementById(`mega-${key}-goal`);
    const ring = document.getElementById(`mega-${key}-ring`);
    if (valueEl) valueEl.textContent = `${Math.round(value)} g`;
    if (goalEl) goalEl.textContent = goal ? `Objectif ${goal} g` : "Objectif -- g";
    if (ring) ring.style.setProperty("--macro-pct", `${goal ? Math.min(100, value / goal * 100) : 0}%`);
  });

  const preview = document.getElementById("mega-macro-target-preview");
  if (preview) preview.innerHTML = `<div><span>Protéines</span><strong>${targets.protein || "--"} g</strong></div><div><span>Glucides</span><strong>${targets.carbs || "--"} g</strong></div><div><span>Lipides</span><strong>${targets.fat || "--"} g</strong></div>`;

  const dist = account.mealDistribution;
  const grid = document.getElementById("mega-meal-calorie-grid");
  if (grid) {
    const slots = [["Petit-déjeuner", dist.breakfast, "🥞"], ["Déjeuner", dist.lunch, "☀️"], ["Dîner", dist.dinner, "🌙"], ["Collation", dist.snack, "🍎"]];
    grid.innerHTML = "";
    slots.forEach(([slot, pct, icon]) => {
      const target = Number(account.objectifCalories || 0) * pct / 100;
      const used = megaMealConsumed(account, slot);
      const card = document.createElement("div"); card.className = "meal-calorie-card";
      const percent = target > 0 ? Math.min(100, used / target * 100) : 0;
      card.innerHTML = `<div class="row"><strong>${icon} ${slot}</strong><span>${Math.round(used)} / ${target ? Math.round(target) : "--"} kcal</span></div><div class="meal-mini-bar"><div style="width:${percent}%"></div></div>`;
      grid.appendChild(card);
    });
  }

  const inputs = { breakfast: "mega-dist-breakfast", lunch: "mega-dist-lunch", dinner: "mega-dist-dinner", snack: "mega-dist-snack" };
  Object.entries(inputs).forEach(([key, id]) => { const el = document.getElementById(id); if (el && document.activeElement !== el) el.value = dist[key]; });
}

document.getElementById("mega-save-distribution")?.addEventListener("click", () => {
  const values = {
    breakfast: Number(document.getElementById("mega-dist-breakfast").value),
    lunch: Number(document.getElementById("mega-dist-lunch").value),
    dinner: Number(document.getElementById("mega-dist-dinner").value),
    snack: Number(document.getElementById("mega-dist-snack").value),
  };
  const total = Object.values(values).reduce((sum, n) => sum + n, 0);
  const message = document.getElementById("mega-distribution-message");
  if (total !== 100 || Object.values(values).some((n) => !Number.isFinite(n) || n < 0)) {
    message.textContent = `⚠️ La répartition doit faire exactement 100 % (actuellement ${total} %).`;
    return;
  }
  const account = megaNormalizeAccount(); account.mealDistribution = values; sauvegarderEtatApplication(); message.textContent = "✅ Répartition enregistrée."; megaRenderMacros();
});

// ======================================================
// WEIGHT & MEASUREMENTS
// ======================================================

function megaWeightSortValue(entry, fallbackIndex = 0) {
  const createdAt = Date.parse(entry?.createdAt || "");
  if (Number.isFinite(createdAt)) return createdAt;
  const day = Date.parse(`${entry?.date || ""}T12:00:00`);
  return (Number.isFinite(day) ? day : 0) + fallbackIndex;
}

function megaAddWeight(value) {
  const weight = Number(value);
  if (!Number.isFinite(weight) || weight < 20 || weight > 400) return false;
  const account = megaNormalizeAccount();
  const now = new Date();
  const date = megaToday();
  account.weightHistory.push({
    id: `weight-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date,
    weight,
    createdAt: now.toISOString(),
  });
  account.weightHistory = account.weightHistory
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => megaWeightSortValue(a.entry, a.index) - megaWeightSortValue(b.entry, b.index))
    .map(({ entry }) => entry);
  account.poidsActuel = weight;
  megaCalculateMacroTargets(account);
  sauvegarderEtatApplication();
  return true;
}

document.getElementById("mega-add-weight")?.addEventListener("click", () => {
  const input = document.getElementById("mega-weight-input");
  if (megaAddWeight(input.value)) { input.value = ""; rafraichirApplication(); megaConfetti(18); }
});

function megaRenderWeight() {
  const account = megaNormalizeAccount();
  const history = account.weightHistory
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => megaWeightSortValue(a.entry, a.index) - megaWeightSortValue(b.entry, b.index))
    .map(({ entry }) => entry)
    .slice(-16);
  const summary = document.getElementById("mega-weight-summary");
  const chart = document.getElementById("mega-weight-chart");
  const trend = document.getElementById("mega-weight-trend");
  if (!summary || !chart) return;
  summary.innerHTML = "";

  if (!history.length) {
    chart.innerHTML = '<div class="message-vide">Ajoute une première pesée pour créer ta courbe.</div>';
    if (trend) trend.textContent = "Aucune donnée";
    return;
  }

  const first = history[0].weight, last = history[history.length - 1].weight;
  const diff = Math.round((last - first) * 10) / 10;
  const target = Number(account.poidsObjectif) || null;
  summary.innerHTML = `<span class="weight-pill">Actuel : ${last} kg</span><span class="weight-pill">Évolution : ${diff > 0 ? "+" : ""}${diff} kg</span>${target ? `<span class="weight-pill">Objectif : ${target} kg</span>` : ""}`;
  if (trend) trend.textContent = `${diff > 0 ? "+" : ""}${diff} kg`;

  const weights = history.map((e) => e.weight);
  const min = Math.min(...weights) - .6, max = Math.max(...weights) + .6, range = Math.max(1, max - min);
  const points = history.map((e, i) => {
    const x = history.length === 1 ? 50 : 8 + i * (84 / (history.length - 1));
    const y = 88 - ((e.weight - min) / range) * 70;
    return { x, y, ...e };
  });
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  chart.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Courbe de poids"><defs><linearGradient id="megaWeightGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#60a5fa" stop-opacity=".28"/><stop offset="1" stop-color="#60a5fa" stop-opacity="0"/></linearGradient></defs><polyline points="${polyline}" fill="none" stroke="#60a5fa" stroke-width="1.5" vector-effect="non-scaling-stroke"/>${points.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="1.7" fill="#a7ccff" vector-effect="non-scaling-stroke"><title>${p.date}${p.createdAt ? ` ${new Date(p.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""} : ${p.weight} kg</title></circle>`).join("")}</svg>`;
}

document.getElementById("mega-save-measurements")?.addEventListener("click", () => {
  const ids = { waist: "mega-waist", hips: "mega-hips", chest: "mega-chest", arm: "mega-arm", thigh: "mega-thigh" };
  const data = { date: megaToday() };
  let has = false;
  Object.entries(ids).forEach(([key, id]) => { const val = Number(document.getElementById(id).value); if (Number.isFinite(val) && val > 0) { data[key] = val; has = true; } });
  if (!has) return;
  const account = megaNormalizeAccount(); const existingIndex = account.measurementHistory.findIndex((e) => e.date === data.date); if (existingIndex >= 0) account.measurementHistory[existingIndex] = { ...account.measurementHistory[existingIndex], ...data }; else account.measurementHistory.push(data); sauvegarderEtatApplication(); Object.values(ids).forEach((id) => document.getElementById(id).value = ""); rafraichirApplication();
});

function megaRenderMeasurements() {
  const container = document.getElementById("mega-measurement-history"); if (!container) return;
  const history = megaNormalizeAccount().measurementHistory.slice(-5).reverse(); container.innerHTML = "";
  if (!history.length) { container.innerHTML = '<p class="mega-help">Aucune mensuration enregistrée.</p>'; return; }
  const labels = { waist:"Taille", hips:"Hanches", chest:"Poitrine", arm:"Bras", thigh:"Cuisse" };
  history.forEach((entry) => { const values = Object.entries(labels).filter(([key]) => entry[key]).map(([key,label]) => `${label} ${entry[key]} cm`).join(" · "); const row = document.createElement("div"); row.className = "measurement-row"; row.innerHTML = `<span>${entry.date}</span><span>${values}</span>`; container.appendChild(row); });
}

// ======================================================
// PROGRESSION PHOTOS (compressed, local)
// ======================================================

async function megaCompressImage(file) {
  const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
  const img = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = dataUrl; });
  const max = 720; const ratio = Math.min(1, max / Math.max(img.width, img.height)); const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(img.width * ratio)); canvas.height = Math.max(1, Math.round(img.height * ratio)); canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height); return canvas.toDataURL("image/jpeg", .72);
}

document.getElementById("mega-add-photo")?.addEventListener("click", async () => {
  const input = document.getElementById("mega-photo-input"); const file = input.files?.[0]; if (!file) return; const account = megaNormalizeAccount(); if (account.progressPhotos.length >= 6) { alert("Maximum 6 photos locales pour éviter de saturer le stockage du navigateur."); return; }
  try { const data = await megaCompressImage(file); account.progressPhotos.push({ id:`photo-${Date.now()}`, date:megaToday(), data }); sauvegarderEtatApplication(); input.value = ""; megaRenderPhotos(); } catch { alert("Impossible de traiter cette image."); }
});

function megaRenderPhotos() {
  const account = megaNormalizeAccount(); const grid = document.getElementById("mega-photo-grid"); const count = document.getElementById("mega-photo-count"); if (!grid) return; grid.innerHTML = ""; if (count) count.textContent = `${account.progressPhotos.length} photo${account.progressPhotos.length>1?"s":""}`;
  account.progressPhotos.slice().reverse().forEach((photo) => { const item = document.createElement("div"); item.className="photo-item"; item.innerHTML = `<img src="${photo.data}" alt="Photo de progression du ${photo.date}"><span class="photo-date">${photo.date}</span><button aria-label="Supprimer">✕</button>`; item.querySelector("button").addEventListener("click", () => { account.progressPhotos = account.progressPhotos.filter((p) => p.id !== photo.id); sauvegarderEtatApplication(); megaRenderPhotos(); }); grid.appendChild(item); });
}

// ======================================================
// WEEKLY DASHBOARD
// ======================================================

function megaLastDays(count = 7) {
  const result = []; const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) { const d = new Date(now); d.setDate(now.getDate() - i); result.push(obtenirDateLocale(d)); }
  return result;
}

function megaRenderWeeklyDashboard() {
  const account = megaNormalizeAccount(); const days = megaLastDays(7); const records = days.map((date) => date === megaToday() ? { caloriesConsommees: account.caloriesConsommees, pas: calculerProgression(account.pasEffectues, account.objectifPas), eau: calculerProgression(account.verresEau, account.objectifEau) } : account.historique[date]).filter(Boolean);
  const avg = (arr) => arr.length ? arr.reduce((s,n)=>s+n,0)/arr.length : 0;
  const kcal = avg(records.map((r)=>Number(r.caloriesConsommees)||0).filter((n)=>n>0));
  const steps = avg(records.map((r)=>Math.round((Number(r.pas)||0) / 100 * account.objectifPas)));
  const water = avg(records.map((r)=>Math.round((Number(r.eau)||0) / 100 * account.objectifEau * 10)/10));
  document.getElementById("mega-week-kcal").textContent = kcal ? Math.round(kcal) : "--";
  document.getElementById("mega-week-steps").textContent = steps ? Math.round(steps).toLocaleString("fr-FR") : "--";
  document.getElementById("mega-week-water").textContent = water ? (Math.round(water*10)/10) : "--";
  const weights = account.weightHistory.slice(-2); let diff = null; if (weights.length === 2) diff = Math.round((weights[1].weight - weights[0].weight)*10)/10;
  document.getElementById("mega-week-weight").textContent = diff === null ? "--" : `${diff>0?"+":""}${diff} kg`;
}

// ======================================================
// CALENDAR
// ======================================================

function megaRenderCalendar() {
  const grid = document.getElementById("mega-calendar-grid"); if (!grid) return; const account = megaNormalizeAccount(); grid.innerHTML = "";
  const year = megaCalendarCursor.getFullYear(), month = megaCalendarCursor.getMonth();
  document.getElementById("mega-calendar-title").textContent = new Intl.DateTimeFormat("fr-FR", { month:"long", year:"numeric" }).format(new Date(year,month,1));
  ["L","M","M","J","V","S","D"].forEach((name)=>{ const el=document.createElement("div"); el.className="calendar-day-name"; el.textContent=name; grid.appendChild(el); });
  const first = new Date(year,month,1); const offset = (first.getDay()+6)%7; const days = new Date(year,month+1,0).getDate();
  for(let i=0;i<offset;i++){ const empty=document.createElement("div"); empty.className="calendar-day empty"; grid.appendChild(empty); }
  for(let day=1;day<=days;day++){ const d=new Date(year,month,day); const key=obtenirDateLocale(d); let record=account.historique[key]; if(key===megaToday()) record={ eau:calculerProgression(account.verresEau,account.objectifEau), pas:calculerProgression(account.pasEffectues,account.objectifPas), repas:calculerProgression(Object.values(account.repas).filter(Boolean).length,3), caloriesConsommees:account.caloriesConsommees, objectifCalories:account.objectifCalories, score:obtenirProgressions().score }; const el=document.createElement("button"); el.className="calendar-day"+(record?" has-data":"")+(key===megaToday()?" today":""); el.innerHTML=`<strong>${day}</strong>${record?`<small>${Math.round(record.score||0)}%</small>`:""}`; el.addEventListener("click",()=>megaShowCalendarDay(key,record)); grid.appendChild(el); }
}

function megaShowCalendarDay(key, record) {
  const detail=document.getElementById("mega-calendar-detail"); if(!detail)return; if(!record){detail.textContent=`${key} : aucune donnée enregistrée.`;return;} detail.innerHTML=`<strong>${key}</strong> · 💧 ${Math.round(record.eau||0)}% · 👟 ${Math.round(record.pas||0)}% · 🍽️ ${Math.round(record.repas||0)}% · 🔥 ${Math.round(record.caloriesConsommees||0)} kcal · Score ${Math.round(record.score||0)}%`;
}

document.getElementById("mega-calendar-prev")?.addEventListener("click",()=>{megaCalendarCursor=new Date(megaCalendarCursor.getFullYear(),megaCalendarCursor.getMonth()-1,1);megaRenderCalendar();});
document.getElementById("mega-calendar-next")?.addEventListener("click",()=>{megaCalendarCursor=new Date(megaCalendarCursor.getFullYear(),megaCalendarCursor.getMonth()+1,1);megaRenderCalendar();});

// ======================================================
// MEAL PLANNER + SHOPPING LIST
// ======================================================

function megaStartOfWeek(offset=0){ const d=new Date(); const day=(d.getDay()+6)%7; d.setHours(12,0,0,0); d.setDate(d.getDate()-day+offset*7); return d; }
function megaWeekDays(offset=0){ const start=megaStartOfWeek(offset); return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;}); }
function megaPlanKey(date,slot){return `${obtenirDateLocale(date)}|${slot}`;}
function megaRecipesForSlot(slot){
  if(slot==="Petit-déjeuner") return recettes.filter((r)=>r.typeRepas==="Petit-déjeuner");
  if(slot==="Collation") return recettes.filter((r)=>r.typeRepas==="Collation" || r.typeRepas==="Dessert");
  return recettes.filter((r)=>r.typeRepas==="Plat" || r.typeRepas==="Entrée");
}

function megaRenderPlanner(){ const grid=document.getElementById("mega-meal-plan-grid"); if(!grid)return; const account=megaNormalizeAccount(); const days=megaWeekDays(megaPlanWeekOffset); const start=days[0],end=days[6]; document.getElementById("mega-plan-week-label").textContent=`${start.toLocaleDateString("fr-FR",{day:"2-digit",month:"short"})} → ${end.toLocaleDateString("fr-FR",{day:"2-digit",month:"short"})}`; grid.innerHTML=""; const slots=["Petit-déjeuner","Déjeuner","Dîner","Collation"];
  days.forEach((date)=>{ const card=document.createElement("div"); card.className="plan-day"; card.innerHTML=`<h3>${date.toLocaleDateString("fr-FR",{weekday:"long"})}</h3><span class="plan-date">${date.toLocaleDateString("fr-FR",{day:"2-digit",month:"long"})}</span>`; slots.forEach((slot)=>{ const key=megaPlanKey(date,slot); const saved=account.mealPlan[key]||{recipeName:"",portions:1}; const wrapper=document.createElement("div");wrapper.className="plan-slot"; const label=document.createElement("label");label.textContent=slot; const select=document.createElement("select"); select.innerHTML='<option value="">— Choisir —</option>'+megaRecipesForSlot(slot).map((r)=>`<option value="${megaEscape(r.nom)}">${megaEscape(r.nom)} · ${r.calories} kcal</option>`).join(""); select.value=saved.recipeName||""; const portionWrap=document.createElement("div");portionWrap.className="plan-portion"; portionWrap.innerHTML=`<span>Portions</span><select><option>.5</option><option>1</option><option>2</option><option>3</option><option>4</option></select>`; const pSelect=portionWrap.querySelector("select"); pSelect.value=String(saved.portions||1); select.addEventListener("change",()=>{account.mealPlan[key]={recipeName:select.value,portions:Number(pSelect.value)||1};sauvegarderEtatApplication();}); pSelect.addEventListener("change",()=>{account.mealPlan[key]={recipeName:select.value,portions:Number(pSelect.value)||1};sauvegarderEtatApplication();}); wrapper.append(label,select,portionWrap);card.appendChild(wrapper); }); grid.appendChild(card); }); }

function megaEscape(text){ const div=document.createElement("div");div.textContent=text;return div.innerHTML; }

document.getElementById("mega-plan-prev")?.addEventListener("click",()=>{megaPlanWeekOffset--;megaRenderPlanner();});
document.getElementById("mega-plan-next")?.addEventListener("click",()=>{megaPlanWeekOffset++;megaRenderPlanner();});
document.getElementById("mega-clear-plan")?.addEventListener("click",()=>{const account=megaNormalizeAccount(); megaWeekDays(megaPlanWeekOffset).forEach((date)=>["Petit-déjeuner","Déjeuner","Dîner","Collation"].forEach((slot)=>delete account.mealPlan[megaPlanKey(date,slot)])); sauvegarderEtatApplication();megaRenderPlanner();megaRenderShopping();});
document.getElementById("mega-auto-plan")?.addEventListener("click",()=>{const account=megaNormalizeAccount(); megaWeekDays(megaPlanWeekOffset).forEach((date,di)=>{["Petit-déjeuner","Déjeuner","Dîner","Collation"].forEach((slot,si)=>{const options=megaRecipesForSlot(slot); if(options.length){const idx=Math.abs((date.getDate()*7+di*3+si*11))%options.length; account.mealPlan[megaPlanKey(date,slot)]={recipeName:options[idx].nom,portions:1};}});});sauvegarderEtatApplication();megaRenderPlanner();megaRenderShopping();});

function megaParseIngredient(ingredient, portions=1){ const scaled=megaScaleIngredient(ingredient,portions); const m=scaled.match(/^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|cl|l)?\s+(.+)$/i); if(!m)return{key:scaled.toLowerCase(),label:scaled,amount:null,unit:""}; return{key:`${(m[2]||"").toLowerCase()}|${m[3].toLowerCase()}`,label:m[3],amount:Number(m[1].replace(",",".")),unit:m[2]||""}; }
function megaBuildShopping(){ const account=megaNormalizeAccount(); const map=new Map(); megaWeekDays(megaPlanWeekOffset).forEach((date)=>["Petit-déjeuner","Déjeuner","Dîner","Collation"].forEach((slot)=>{const plan=account.mealPlan[megaPlanKey(date,slot)];if(!plan?.recipeName)return;const recipe=megaFindRecipe(plan.recipeName);if(!recipe)return;(recipe.ingredients||[]).forEach((ing)=>{const parsed=megaParseIngredient(ing,Number(plan.portions)||1);if(map.has(parsed.key)){const old=map.get(parsed.key);if(old.amount!==null&&parsed.amount!==null&&old.unit===parsed.unit)old.amount+=parsed.amount;else old.count=(old.count||1)+1;}else map.set(parsed.key,{...parsed,count:1});});})); return [...map.values()].map((item)=>({id:item.key,text:item.amount!==null?`${megaPrettyNumber(item.amount)} ${item.unit} ${item.label}`.replace(/\s+/g," ").trim():(item.count>1?`${item.count} × `:"")+item.label})); }
function megaRenderShopping(){ const list=document.getElementById("mega-shopping-list");if(!list)return;const account=megaNormalizeAccount();const items=megaBuildShopping();document.getElementById("mega-shopping-count").textContent=`${items.length} article${items.length>1?"s":""}`;list.innerHTML="";if(!items.length){list.innerHTML='<p class="message-vide">Planifie des repas pour générer ta liste.</p>';return;}items.forEach((item)=>{const row=document.createElement("label");row.className="shopping-item"+(account.shoppingChecked[item.id]?" done":"");const input=document.createElement("input");input.type="checkbox";input.checked=!!account.shoppingChecked[item.id];input.addEventListener("change",()=>{account.shoppingChecked[item.id]=input.checked;sauvegarderEtatApplication();row.classList.toggle("done",input.checked);});const span=document.createElement("span");span.textContent=item.text;row.append(input,span);list.appendChild(row);}); }
document.getElementById("mega-generate-shopping")?.addEventListener("click",megaRenderShopping);
document.getElementById("mega-copy-shopping")?.addEventListener("click",async()=>{const text=megaBuildShopping().map((i)=>`• ${i.text}`).join("\n");if(!text)return;try{await navigator.clipboard.writeText(text);document.getElementById("mega-copy-shopping").textContent="✓ Copié";setTimeout(()=>document.getElementById("mega-copy-shopping").textContent="Copier la liste",1200);}catch{prompt("Copie la liste :",text);}});

// ======================================================
// XP + CHALLENGES + CONFETTI
// ======================================================

const megaChallenges = [
  { id:"water", icon:"💧", title:"Hydratation", xp:20, progress:(a)=>Math.min(100,a.verresEau/a.objectifEau*100), done:(a)=>a.verresEau>=a.objectifEau, text:"Atteins ton objectif d'eau" },
  { id:"steps", icon:"👟", title:"Bouger", xp:25, progress:(a)=>Math.min(100,a.pasEffectues/a.objectifPas*100), done:(a)=>a.pasEffectues>=a.objectifPas, text:"Atteins ton objectif de pas" },
  { id:"meals", icon:"🍽️", title:"Routine repas", xp:15, progress:(a)=>Object.values(a.repas).filter(Boolean).length/3*100, done:(a)=>Object.values(a.repas).filter(Boolean).length>=3, text:"Valide tes 3 repas" },
  { id:"calories", icon:"🔥", title:"Cible calories", xp:25, progress:(a)=>a.objectifCalories?Math.min(100,a.caloriesConsommees/a.objectifCalories*100):0, done:(a)=>a.objectifCalories&&a.caloriesConsommees>=a.objectifCalories*.9&&a.caloriesConsommees<=a.objectifCalories*1.1, text:"Reste à ±10 % de ta cible" },
  { id:"protein", icon:"💪", title:"Protéines", xp:25, progress:(a)=>{const t=megaJournalTotals(a);return a.macroTargets.protein?Math.min(100,t.protein/a.macroTargets.protein*100):0;}, done:(a)=>{const t=megaJournalTotals(a);return a.macroTargets.protein>0&&t.protein>=a.macroTargets.protein;}, text:"Atteins ton objectif protéines" },
];

function megaConfetti(count=35){ if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;let layer=document.querySelector(".confetti-layer");if(layer)layer.remove();layer=document.createElement("div");layer.className="confetti-layer";const colors=["#60a5fa","#34d399","#f59e0b","#f472b6","#a78bfa"];for(let i=0;i<count;i++){const p=document.createElement("i");p.className="confetti-piece";p.style.left=Math.random()*100+"%";p.style.background=colors[i%colors.length];p.style.setProperty("--drift",(Math.random()*220-110)+"px");p.style.animationDelay=Math.random()*.35+"s";layer.appendChild(p);}document.body.appendChild(layer);setTimeout(()=>layer.remove(),2400);}

function megaEvaluateChallenges(){const account=megaNormalizeAccount();const today=megaToday();let newWins=0;megaChallenges.forEach((c)=>{const key=`${today}|${c.id}`;if(c.done(account)&&!account.challengeCompletions[key]){account.challengeCompletions[key]=true;account.xp=(Number(account.xp)||0)+c.xp;newWins++;}});if(newWins){sauvegarderEtatApplication();megaConfetti(Math.min(55,25+newWins*8));}}
function megaRenderChallenges(){const account=megaNormalizeAccount();megaEvaluateChallenges();const grid=document.getElementById("mega-challenge-grid");if(!grid)return;grid.innerHTML="";let done=0;megaChallenges.forEach((c)=>{const finished=!!account.challengeCompletions[`${megaToday()}|${c.id}`]||c.done(account);if(finished)done++;const pct=Math.round(Math.min(100,c.progress(account)||0));const card=document.createElement("div");card.className="challenge-card"+(finished?" done":"");card.innerHTML=`<span class="challenge-icon">${c.icon}</span><h3>${c.title}</h3><p>${c.text}</p><div class="challenge-progress"><div style="width:${pct}%"></div></div><span class="challenge-reward">${finished?"✓ Terminé":pct+"%"} · +${c.xp} XP</span>`;grid.appendChild(card);});document.getElementById("mega-challenge-count").textContent=`${done} / ${megaChallenges.length}`;}
function megaRenderXp(){const account=megaNormalizeAccount();const xp=Number(account.xp)||0;const level=Math.floor(xp/100)+1;const within=xp%100;document.getElementById("mega-level").textContent=level;document.getElementById("mega-xp-label").textContent=`${within} / 100 XP`;document.getElementById("mega-xp-fill").style.width=`${within}%`;}

// ======================================================
// TODAY CENTER
// ======================================================

function megaRenderToday(){const a=megaNormalizeAccount();const totals=megaJournalTotals(a);const target=Number(a.objectifCalories)||0;const calorieRemain=target?Math.max(0,target-totals.calories):null;const proteinRemain=a.macroTargets.protein?Math.max(0,a.macroTargets.protein-totals.protein):null;document.getElementById("mega-today-calories").textContent=calorieRemain===null?"--":`${Math.round(calorieRemain)} kcal`;document.getElementById("mega-today-protein").textContent=proteinRemain===null?"--":`${Math.round(proteinRemain)} g`;document.getElementById("mega-today-steps").textContent=Math.max(0,a.objectifPas-a.pasEffectues).toLocaleString("fr-FR");document.getElementById("mega-today-water").textContent=`${Math.max(0,a.objectifEau-a.verresEau)} verre${Math.max(0,a.objectifEau-a.verresEau)>1?"s":""}`;document.getElementById("mega-today-title").textContent=a.prenom?`${a.prenom}, voici ton plan du jour`:"Ton plan du jour";let msg="Chaque petit objectif complété fait progresser ta journée.";if(target&&calorieRemain!==null&&calorieRemain<350)msg="Ta cible énergétique est presque atteinte. Pense surtout à l'équilibre de ta journée.";if(a.pasEffectues>=a.objectifPas&&a.verresEau>=a.objectifEau)msg="Belle journée : activité et hydratation sont déjà au rendez-vous ✨";document.getElementById("mega-today-message").textContent=msg;megaRenderXp();}

// ======================================================
// ONBOARDING
// ======================================================

function megaMaybeShowOnboarding(){const a=megaNormalizeAccount();const overlay=document.getElementById("mega-onboarding-overlay");if(!overlay)return;if(!a.onboardingDone){overlay.classList.add("open");overlay.setAttribute("aria-hidden","false");document.body.classList.add("modal-ouverte");}else{overlay.classList.remove("open");overlay.setAttribute("aria-hidden","true");}}

document.getElementById("mega-onboarding-skip")?.addEventListener("click",()=>{const a=megaNormalizeAccount();a.onboardingDone=true;sauvegarderEtatApplication();megaMaybeShowOnboarding();document.body.classList.remove("modal-ouverte");});
document.getElementById("mega-onboarding-save")?.addEventListener("click",()=>{const a=megaNormalizeAccount();const age=Number(document.getElementById("mega-onboard-age").value);const height=Number(document.getElementById("mega-onboard-height").value);const current=Number(document.getElementById("mega-onboard-current").value);const target=Number(document.getElementById("mega-onboard-target").value);const sex=document.getElementById("mega-onboard-sex").value;const activity=document.getElementById("mega-onboard-activity").value;const message=document.getElementById("mega-onboarding-message");if(age<18||!height||!current||!target||!sex){message.textContent="⚠️ Complète les champs principaux. Le calculateur nutrition est réservé aux adultes.";return;}const result=calculerCibleCalories({age,taille:height,poidsActuel:current,poidsObjectif:target,formuleMetabolique:sex,niveauActivite:activity});if(!result){message.textContent="⚠️ Impossible de calculer avec ces valeurs.";return;}a.prenom=document.getElementById("mega-onboard-name").value.trim();a.age=age;a.taille=height;a.poidsActuel=current;a.poidsObjectif=target;a.formuleMetabolique=sex;a.niveauActivite=activity;a.objectifCalories=result.objectif;a.caloriesMaintien=result.maintien;a.typeObjectifCalories=result.typeObjectif;a.onboardingDone=true;a.xp=(Number(a.xp)||0)+20;megaCalculateMacroTargets(a);sauvegarderEtatApplication();document.getElementById("mega-onboarding-overlay").classList.remove("open");document.body.classList.remove("modal-ouverte");megaConfetti(45);rafraichirApplication();});

// ======================================================
// REMINDERS + PWA
// ======================================================

function megaLoadReminderForm(){const r=megaNormalizeAccount().reminderSettings;document.getElementById("mega-reminder-water-enabled").checked=!!r.waterEnabled;document.getElementById("mega-reminder-water-time").value=r.waterTime||"14:00";document.getElementById("mega-reminder-weight-enabled").checked=!!r.weightEnabled;document.getElementById("mega-reminder-weight-time").value=r.weightTime||"08:00";}
document.getElementById("mega-save-reminders")?.addEventListener("click",()=>{const a=megaNormalizeAccount();a.reminderSettings.waterEnabled=document.getElementById("mega-reminder-water-enabled").checked;a.reminderSettings.waterTime=document.getElementById("mega-reminder-water-time").value;a.reminderSettings.weightEnabled=document.getElementById("mega-reminder-weight-enabled").checked;a.reminderSettings.weightTime=document.getElementById("mega-reminder-weight-time").value;sauvegarderEtatApplication();document.getElementById("mega-reminder-message").textContent="✅ Rappels enregistrés. Ils fonctionnent lorsque l'application est ouverte et selon les autorisations du navigateur.";});
document.getElementById("mega-enable-notifications")?.addEventListener("click",async()=>{if(!("Notification" in window)){document.getElementById("mega-reminder-message").textContent="Ce navigateur ne prend pas en charge les notifications Web.";return;}const permission=await Notification.requestPermission();document.getElementById("mega-reminder-message").textContent=permission==="granted"?"✅ Notifications autorisées.":"Notifications non autorisées.";});
async function megaNotify(title,body){if(!("Notification" in window)||Notification.permission!=="granted")return;try{const reg=await navigator.serviceWorker?.getRegistration();if(reg)await reg.showNotification(title,{body,icon:"icons/icon-192.png",badge:"icons/icon-192.png"});else new Notification(title,{body});}catch{new Notification(title,{body});}}
function megaCheckReminders(){const a=megaNormalizeAccount();const r=a.reminderSettings;const now=new Date();const time=`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;const today=megaToday();const checks=[{enabled:r.waterEnabled,time:r.waterTime,key:"water",title:"💧 Hydratation",body:"Pense à vérifier ton objectif d'eau du jour."},{enabled:r.weightEnabled,time:r.weightTime,key:"weight",title:"⚖️ Pesée",body:"Si c'est ton jour de pesée, tu peux l'ajouter dans Suivi."}];checks.forEach((c)=>{const sentKey=`${today}|${c.key}`;if(c.enabled&&c.time===time&&!r.sent[sentKey]){r.sent[sentKey]=true;megaNotify(c.title,c.body);sauvegarderEtatApplication();}});}
setInterval(megaCheckReminders,60000);

window.addEventListener("beforeinstallprompt",(event)=>{event.preventDefault();megaDeferredInstallPrompt=event;document.getElementById("mega-pwa-status").textContent="Installable";});
document.getElementById("mega-install-pwa")?.addEventListener("click",async()=>{const msg=document.getElementById("mega-reminder-message");if(!megaDeferredInstallPrompt){msg.textContent="Si le bouton d'installation n'est pas disponible, ouvre l'app sur localhost/HTTPS puis utilise l'option Installer du navigateur.";return;}megaDeferredInstallPrompt.prompt();await megaDeferredInstallPrompt.userChoice;megaDeferredInstallPrompt=null;});
if("serviceWorker" in navigator&&location.protocol!=="file:"){window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));}

// ======================================================
// EXPORT CSV / PRINT-PDF
// ======================================================

async function megaDownload(filename,text,type="text/plain"){
  return WellnessFiles.shareOrDownload(filename,text,type);
}
document.getElementById("mega-export-csv")?.addEventListener("click",()=>{const a=megaNormalizeAccount();const rows=[["type","date","valeur1","valeur2","valeur3","valeur4","valeur5"]];Object.entries(a.historique||{}).forEach(([date,h])=>rows.push(["jour",date,h.score||0,h.caloriesConsommees||0,h.eau||0,h.pas||0,h.repas||0]));a.weightHistory.forEach((w)=>rows.push(["poids",w.date,w.weight,"","","",""]));a.measurementHistory.forEach((m)=>rows.push(["mensurations",m.date,m.waist||"",m.hips||"",m.chest||"",m.arm||"",m.thigh||""]));const csv=rows.map((r)=>r.map((x)=>`"${String(x).replaceAll('"','""')}"`).join(";")).join("\n");megaDownload(`wellness-${a.nomCompte||"profil"}.csv`,"\ufeff"+csv,"text/csv;charset=utf-8");});
document.getElementById("mega-export-pdf")?.addEventListener("click",async()=>{
  const a=megaNormalizeAccount();
  const t=megaJournalTotals(a);
  const lines=[
    `Profil : ${a.prenom||a.nomCompte||"Wellness"}`,
    `Date : ${new Date().toLocaleDateString("fr-FR")}`,
    "",
    `Calories aujourd'hui : ${Math.round(t.calories)} / ${Math.round(a.objectifCalories||0)} kcal`,
    `Proteines : ${Math.round(t.protein)} / ${a.macroTargets.protein||0} g`,
    `Pas : ${Number(a.pasEffectues||0).toLocaleString("fr-FR")}`,
    `Eau : ${Number(a.verresEau||0)} verres`,
    "",
    "Dernieres pesees :",
    ...(a.weightHistory||[]).slice(-10).map(w=>`${w.date}${w.time?` ${w.time}`:""} : ${w.weight} kg`),
    "",
    "Les objectifs nutritionnels affiches par Wellness sont des estimations indicatives."
  ];
  const pdf=WellnessFiles.buildTextPdf(lines,{title:"Rapport Wellness"});
  await WellnessFiles.shareOrDownload(
    `rapport-wellness-${megaToday()}.pdf`,
    pdf,
    "application/pdf"
  );
});

// ======================================================
// ACCOUNT / REFRESH WRAPPER
// ======================================================

const megaOriginalRefresh = rafraichirApplication;
rafraichirApplication = function megaRefresh() {
  megaNormalizeAccount();
  megaSyncCustomRecipes();
  megaOriginalRefresh();
  megaCalculateMacroTargets();
  megaRenderSmartRecipes();
  megaRenderMacros();
  megaRenderWeight();
  megaRenderMeasurements();
  megaRenderPhotos();
  megaRenderWeeklyDashboard();
  megaRenderCalendar();
  megaRenderPlanner();
  megaRenderShopping();
  megaRenderChallenges();
  megaRenderToday();
  megaLoadReminderForm();
  megaMaybeShowOnboarding();
  sauvegarderEtatApplication();
};

// Re-run after extensions are loaded.
megaAllAccountsNormalize();
megaSetupCustomRecipe();
rafraichirApplication();
