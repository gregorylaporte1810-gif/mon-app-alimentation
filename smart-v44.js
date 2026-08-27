(() => {
  "use strict";

  const C = window.WellnessSmartCoreV44;
  const U = window.WellnessFoodUnits;
  if (!C || !U) {
    console.error("[Wellness 4.4] smart core absent.");
    return;
  }

  const VERSION = "4.4.0";
  const MEALS = ["Petit-déjeuner", "Déjeuner", "Dîner", "Collation"];
  let calendarCursor = new Date();
  let selectedCalendarDay = null;
  let recipeDraft = [];
  let quickCandidates = [];
  let renderTimer = 0;

  const esc = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  function account() {
    try { return typeof obtenirCompteActif === "function" ? obtenirCompteActif() : null; }
    catch { return null; }
  }

  function today() {
    try { return obtenirDateLocale(); } catch { return C.dateKey(); }
  }

  function v43(a = account()) {
    if (!a) return null;
    if (!a.v43 || typeof a.v43 !== "object") a.v43 = {};
    if (!a.v43.dailyJournals || typeof a.v43.dailyJournals !== "object") a.v43.dailyJournals = {};
    if (!a.v43.usage || typeof a.v43.usage !== "object") a.v43.usage = {};
    if (!a.v43.favoriteFoods || typeof a.v43.favoriteFoods !== "object") a.v43.favoriteFoods = {};
    return a.v43;
  }

  function ensureState(a = account()) {
    if (!a) return null;
    if (!a.v44 || typeof a.v44 !== "object") a.v44 = {};
    const state = a.v44;
    if (!state.customGoals || typeof state.customGoals !== "object") state.customGoals = {};
    const defaults = {
      fiberDaily: 30,
      sleepAverage: 7.5,
      weeklyActivityMinutes: 150,
      weeklyWorkouts: 3,
    };
    Object.entries(defaults).forEach(([key, value]) => {
      if (!Number.isFinite(Number(state.customGoals[key]))) state.customGoals[key] = value;
    });
    if (!state.settings || typeof state.settings !== "object") state.settings = {};
    if (typeof state.settings.habitSuggestions !== "boolean") state.settings.habitSuggestions = true;
    if (typeof state.settings.adaptiveCalories !== "boolean") state.settings.adaptiveCalories = true;
    return state;
  }

  function save() {
    try { sauvegarderEtatApplication(); } catch {}
  }

  function dailyJournals(a = account()) {
    const daily = { ...(v43(a)?.dailyJournals || {}) };
    daily[today()] = Array.isArray(a?.journalCalories) ? JSON.parse(JSON.stringify(a.journalCalories)) : [];
    return daily;
  }

  function recentFoodIds(a = account()) {
    return Object.values(v43(a)?.usage || {})
      .sort((x, y) => String(y?.lastUsedAt || "").localeCompare(String(x?.lastUsedAt || "")))
      .slice(0, 20)
      .map((item) => item?.food?.id)
      .filter(Boolean);
  }

  function searchFoods(query = "") {
    const a = account();
    return C.fuzzyFoodSearch(
      window.WELLNESS_FOODS || [],
      query,
      {
        usage: v43(a)?.usage || {},
        favorites: v43(a)?.favoriteFoods || {},
        recentKeys: recentFoodIds(a),
      },
      40,
    );
  }

  window.WellnessSmartV44 = { searchFoods };

  function patchSearchRuntime() {
    try { w2SearchFoods = searchFoods; } catch {}
  }

  function addFood(food, { quantity = 100, unit = "g", meal = "Déjeuner", pieceWeight = null } = {}) {
    if (!food) return false;
    const scaled = U.scaleFood(food, quantity, unit, pieceWeight);
    if (!scaled) return false;
    const a = account();
    const before = new Set((a?.journalCalories || []).map((entry) => entry.id));
    const name = `${U.stripQuantitySuffix(food.name || "Aliment")} (${U.formatQuantity(quantity, unit)})`;
    const ok = ajouterCaloriesAuJournal(name, scaled.calories, "aliment", {
      proteines: scaled.protein,
      glucides: scaled.carbs,
      lipides: scaled.fat,
      repasSlot: meal,
      portions: scaled.referenceAmount / 100,
      quantity,
      unit,
    });
    if (!ok) return false;

    queueMicrotask(() => {
      const entry = [...(a.journalCalories || [])].reverse().find((item) => !before.has(item.id));
      if (!entry) return;
      Object.assign(entry, {
        quantity,
        unit,
        referenceAmount: scaled.referenceAmount,
        basisUnit: food.basisUnit || "g",
        basisQuantity: Number(food.basisQuantity) || 100,
        density: scaled.density,
        pieceWeight: scaled.pieceWeight,
        foodId: food.id || null,
        sourceDatabase: food.sourceDatabase || food.source || "Wellness",
        fibres: scaled.fiber || 0,
        sucres: scaled.sugars || 0,
        grasSatures: scaled.saturatedFat || 0,
        sel: scaled.salt || 0,
      });
      save();
      window.WellnessDailyUX?.snapshotToday?.();
      try { rafraichirApplication(); } catch {}
      scheduleRender();
    });
    return true;
  }

  function showMessage(text, type = "info") {
    const el = document.getElementById("v44-quick-message");
    if (!el) return;
    el.textContent = text;
    el.dataset.type = type;
  }

  function runQuickEntry() {
    const input = document.getElementById("v44-quick-input");
    const text = input?.value.trim() || "";
    if (!text) return;
    const parsed = C.parseQuickEntry(text);
    if (!parsed.query) {
      showMessage("Ajoute le nom de l'aliment, par exemple : 250 g riz déjeuner.", "error");
      return;
    }
    quickCandidates = searchFoods(parsed.query).slice(0, 4);
    const result = document.getElementById("v44-quick-results");
    if (!result) return;

    if (!quickCandidates.length) {
      result.innerHTML = "";
      showMessage(`Aucun aliment proche de « ${parsed.query} » dans la base locale.`, "error");
      return;
    }

    const top = quickCandidates[0];
    const second = quickCandidates[1];
    const topScore = C.foodSearchScore(top, parsed.query, {});
    const secondScore = second ? C.foodSearchScore(second, parsed.query, {}) : 0;

    if (topScore >= 1000 || topScore >= secondScore + 150) {
      if (addFood(top, parsed)) {
        input.value = "";
        result.innerHTML = "";
        showMessage(`✅ ${top.name} · ${U.formatQuantity(parsed.quantity, parsed.unit)} · ${parsed.meal}`, "success");
      }
      return;
    }

    result.innerHTML = quickCandidates.map((food, index) => `
      <button type="button" data-v44-candidate="${index}">
        <strong>${esc(food.name)}</strong>
        <small>${Math.round(Number(food.kcal) || 0)} kcal/100 g · P ${C.round1(food.protein)} g</small>
      </button>`).join("");
    showMessage(`Plusieurs aliments correspondent. Choisis le bon pour ${U.formatQuantity(parsed.quantity, parsed.unit)} · ${parsed.meal}.`);

    result.querySelectorAll("[data-v44-candidate]").forEach((button) => {
      button.addEventListener("click", () => {
        const food = quickCandidates[Number(button.dataset.v44Candidate)];
        if (!food) return;
        addFood(food, parsed);
        input.value = "";
        result.innerHTML = "";
        showMessage(`✅ ${food.name} ajouté.`, "success");
      });
    });
  }

  function ensureQuickEntry() {
    const anchor = document.getElementById("v43-smart-tools") || document.querySelector(".px-journal-card");
    if (!anchor || document.getElementById("v44-quick-entry")) return;
    const section = document.createElement("section");
    section.id = "v44-quick-entry";
    section.className = "v44-quick-entry px-card";
    section.innerHTML = `
      <div class="v44-section-head"><div><small>SAISIE EXPRESS</small><strong>Écris comme tu parles</strong></div><span>⚡</span></div>
      <div class="v44-quick-line">
        <input id="v44-quick-input" type="text" autocomplete="off" placeholder="Ex : 250 g riz déjeuner">
        <button type="button" id="v44-quick-add">Ajouter</button>
      </div>
      <div class="v44-examples">« 1 banane collation » · « 50 cl eau déjeuner » · « 150 g poulet dîner »</div>
      <div id="v44-quick-results" class="v44-quick-results"></div>
      <p id="v44-quick-message" class="v44-inline-message"></p>`;
    anchor.parentElement.insertBefore(section, anchor);
    document.getElementById("v44-quick-add")?.addEventListener("click", runQuickEntry);
    document.getElementById("v44-quick-input")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") runQuickEntry();
    });
  }

  function createRecipeOverlay() {
    let overlay = document.getElementById("v44-recipe-builder-overlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "v44-recipe-builder-overlay";
    overlay.className = "modal-simple-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <section class="modal-simple v44-recipe-modal" role="dialog" aria-modal="true" aria-labelledby="v44-recipe-title">
        <div class="modal-simple-header">
          <div><p class="sur-titre">Ciqual + Wellness</p><h2 id="v44-recipe-title">Créer un repas / une recette</h2></div>
          <button type="button" id="v44-recipe-close" class="fermer-modal-simple">✕</button>
        </div>
        <div class="v44-recipe-content">
          <div class="v44-recipe-fields">
            <label><span>Nom</span><input id="v44-recipe-name" type="text" placeholder="Ex : Poulet riz maison"></label>
            <label><span>Type</span><select id="v44-recipe-meal"><option>Petit-déjeuner</option><option selected>Déjeuner</option><option>Dîner</option><option>Collation</option></select></label>
            <label><span>Nombre de portions</span><input id="v44-recipe-portions" type="number" min="1" step="1" value="1"></label>
          </div>
          <div class="v44-builder-search">
            <input id="v44-builder-query" type="search" placeholder="Ajouter un ingrédient Ciqual...">
            <div id="v44-builder-results"></div>
          </div>
          <div id="v44-builder-items" class="v44-builder-items"></div>
          <div id="v44-builder-total" class="v44-builder-total"></div>
          <p id="v44-builder-message" class="v44-inline-message"></p>
        </div>
        <div class="v44-recipe-actions">
          <button type="button" id="v44-recipe-cancel" class="bouton-secondaire">Annuler</button>
          <button type="button" id="v44-recipe-save">Enregistrer la recette</button>
        </div>
      </section>`;
    document.body.appendChild(overlay);

    const close = () => {
      try { megaCloseOverlay(overlay); } catch {
        overlay.classList.remove("ouverte");
        overlay.setAttribute("aria-hidden", "true");
      }
    };
    document.getElementById("v44-recipe-close")?.addEventListener("click", close);
    document.getElementById("v44-recipe-cancel")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    document.getElementById("v44-builder-query")?.addEventListener("input", renderBuilderSearch);
    document.getElementById("v44-recipe-portions")?.addEventListener("input", renderRecipeDraft);
    document.getElementById("v44-recipe-save")?.addEventListener("click", saveRecipe);
    return overlay;
  }

  function openRecipeBuilder() {
    recipeDraft = [];
    const overlay = createRecipeOverlay();
    ["v44-recipe-name", "v44-builder-query"].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
    const portions = document.getElementById("v44-recipe-portions"); if (portions) portions.value = "1";
    renderBuilderSearch();
    renderRecipeDraft();
    try { megaOpenOverlay(overlay); } catch {
      overlay.classList.add("ouverte");
      overlay.setAttribute("aria-hidden", "false");
    }
  }

  function renderBuilderSearch() {
    const input = document.getElementById("v44-builder-query");
    const box = document.getElementById("v44-builder-results");
    if (!box) return;
    const q = input?.value.trim() || "";
    if (q.length < 2) {
      box.innerHTML = '<small>Commence à taper un aliment.</small>';
      return;
    }
    const foods = searchFoods(q).slice(0, 6);
    box.innerHTML = foods.map((food, index) => `
      <button type="button" data-v44-builder-food="${esc(food.id || String(index))}" data-v44-builder-index="${index}">
        <strong>${esc(food.name)}</strong><small>${Math.round(Number(food.kcal) || 0)} kcal/100 g</small>
      </button>`).join("");
    box.querySelectorAll("[data-v44-builder-food]").forEach((button) => {
      button.addEventListener("click", () => {
        const food = foods[Number(button.dataset.v44BuilderIndex)];
        if (!food) return;
        const quantity = food.liquid ? 250 : 100;
        const unit = food.liquid ? "ml" : "g";
        const nutrition = U.scaleFood(food, quantity, unit);
        recipeDraft.push({ id: `ingredient-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, food, quantity, unit, nutrition });
        input.value = "";
        renderBuilderSearch();
        renderRecipeDraft();
      });
    });
  }

  function recalcDraftItem(item) {
    item.nutrition = U.scaleFood(item.food, item.quantity, item.unit, item.pieceWeight || null);
  }

  function renderRecipeDraft() {
    const box = document.getElementById("v44-builder-items");
    const totalBox = document.getElementById("v44-builder-total");
    if (!box || !totalBox) return;

    box.innerHTML = recipeDraft.length ? recipeDraft.map((item) => `
      <div class="v44-builder-row" data-v44-item="${esc(item.id)}">
        <div><strong>${esc(item.food.name)}</strong><small>${esc(item.food.category || "Aliment")}</small></div>
        <input data-v44-quantity type="number" min="0.1" step="0.1" value="${item.quantity}">
        <select data-v44-unit>${U.allowedUnits(item.food).map((unit) => `<option value="${unit}" ${unit === item.unit ? "selected" : ""}>${unit === "l" ? "L" : unit === "unit" ? "unité" : unit}</option>`).join("")}</select>
        <button type="button" data-v44-remove>✕</button>
      </div>`).join("") : '<p class="v44-empty">Ajoute les ingrédients un par un. Wellness calcule automatiquement les valeurs nutritionnelles.</p>';

    box.querySelectorAll("[data-v44-item]").forEach((row) => {
      const item = recipeDraft.find((x) => x.id === row.dataset.v44Item);
      if (!item) return;
      row.querySelector("[data-v44-quantity]")?.addEventListener("input", (event) => {
        item.quantity = Number(event.target.value) || 0;
        recalcDraftItem(item);
        updateRecipeTotals();
      });
      row.querySelector("[data-v44-unit]")?.addEventListener("change", (event) => {
        item.unit = event.target.value;
        recalcDraftItem(item);
        updateRecipeTotals();
      });
      row.querySelector("[data-v44-remove]")?.addEventListener("click", () => {
        recipeDraft = recipeDraft.filter((x) => x.id !== item.id);
        renderRecipeDraft();
      });
    });
    updateRecipeTotals();
  }

  function updateRecipeTotals() {
    const totalBox = document.getElementById("v44-builder-total");
    if (!totalBox) return;
    recipeDraft.forEach(recalcDraftItem);
    const totals = C.recipeTotals(recipeDraft);
    const portions = Math.max(1, Number(document.getElementById("v44-recipe-portions")?.value) || 1);
    totalBox.innerHTML = recipeDraft.length ? `
      <span>Recette entière <strong>${Math.round(totals.calories)} kcal</strong></span>
      <span>Par portion <strong>${Math.round(totals.calories / portions)} kcal · P ${C.round1(totals.protein / portions)} g · G ${C.round1(totals.carbs / portions)} g · L ${C.round1(totals.fat / portions)} g</strong></span>` : "";
  }

  function saveRecipe() {
    const a = account();
    const name = document.getElementById("v44-recipe-name")?.value.trim() || "";
    const meal = document.getElementById("v44-recipe-meal")?.value || "Déjeuner";
    const portions = Math.max(1, Number(document.getElementById("v44-recipe-portions")?.value) || 1);
    const message = document.getElementById("v44-builder-message");
    if (!name || !recipeDraft.length) {
      if (message) message.textContent = "⚠️ Ajoute un nom et au moins un ingrédient.";
      return;
    }
    if (!a) return;
    megaNormalizeAccount(a);
    if (recettes.some((recipe) => C.normalize(recipe.nom) === C.normalize(name))) {
      if (message) message.textContent = "⚠️ Une recette porte déjà ce nom.";
      return;
    }

    recipeDraft.forEach(recalcDraftItem);
    const totals = C.recipeTotals(recipeDraft);
    const per = (value) => C.round1(value / portions);
    const ingredientsText = recipeDraft.map((item) => `${U.formatQuantity(item.quantity, item.unit)} ${item.food.name}`);
    a.customRecipes.push({
      nom: name,
      typeRepas: meal,
      categorie: "Personnalisée Ciqual",
      temps: 10,
      calories: Math.max(1, Math.round(totals.calories / portions)),
      proteines: per(totals.protein),
      glucides: per(totals.carbs),
      lipides: per(totals.fat),
      fibres: per(totals.fiber),
      sucres: per(totals.sugars),
      grasSatures: per(totals.saturatedFat),
      sel: per(totals.salt),
      ingredients: ingredientsText,
      preparation: ["Préparer les ingrédients.", "Assembler ou cuisiner selon tes habitudes.", `La recette correspond à ${portions} portion${portions > 1 ? "s" : ""}.`],
      personnalisée: true,
      _v44Calculated: true,
      _v44Portions: portions,
      _v44Ingredients: recipeDraft.map((item) => ({
        foodId: item.food.id || null,
        name: item.food.name,
        quantity: item.quantity,
        unit: item.unit,
        nutrition: item.nutrition,
      })),
    });
    save();
    megaSyncCustomRecipes();
    try { rafraichirApplication(); } catch {}
    if (message) message.textContent = `✅ ${name} enregistrée avec calcul automatique.`;
    setTimeout(() => megaCloseOverlay(document.getElementById("v44-recipe-builder-overlay")), 350);
  }

  function ensureRecipeBuilderCard() {
    const anchor = document.querySelector("#page-recettes .px-two-actions") || document.querySelector(".px-journal-card");
    if (!anchor || document.getElementById("v44-recipe-builder-card")) return;
    const card = document.createElement("section");
    card.id = "v44-recipe-builder-card";
    card.className = "v44-recipe-builder-card px-card";
    card.innerHTML = `
      <div><span>🍳</span><div><small>REPAS PERSONNALISÉ</small><strong>Créer depuis la base Ciqual</strong><p>Ajoute tes ingrédients et Wellness calcule calories, macros, fibres, sucres, sel et saturés par portion.</p></div></div>
      <button type="button" id="v44-open-recipe-builder">Créer</button>`;
    anchor.insertAdjacentElement("beforebegin", card);
    document.getElementById("v44-open-recipe-builder")?.addEventListener("click", openRecipeBuilder);
  }

  function weekData(a = account()) {
    const currentStart = C.startOfWeek(today());
    const previousStart = C.addDays(currentStart, -7);
    const daily = dailyJournals(a);
    const opts = {
      currentKey: today(),
      currentJournal: a?.journalCalories || [],
      dailyMetrics: a?.w2?.dailyMetrics || {},
      activities: a?.w2?.activities || [],
    };
    return {
      current: C.weekSummary(daily, currentStart, opts),
      previous: C.weekSummary(daily, previousStart, opts),
    };
  }

  function ensureProgressPanels() {
    const screen = document.querySelector("#page-suivi .px-screen") || document.getElementById("page-suivi");
    if (!screen || document.getElementById("v44-progress-suite")) return;
    const suite = document.createElement("div");
    suite.id = "v44-progress-suite";
    suite.className = "v44-progress-suite";
    suite.innerHTML = `
      <section id="v44-weekly-card" class="v44-weekly-card px-card"></section>
      <section id="v44-calendar-card" class="v44-calendar-card px-card"></section>
      <section id="v44-goals-card" class="v44-goals-card px-card"></section>
      <section id="v44-adaptive-card" class="v44-adaptive-card px-card"></section>`;
    screen.insertAdjacentElement("afterbegin", suite);
  }

  function renderWeekly() {
    const box = document.getElementById("v44-weekly-card");
    const a = account();
    const state = ensureState(a);
    if (!box || !a || !state) return;
    const { current, previous } = weekData(a);
    const insights = C.weeklyInsights(
      current,
      previous,
      state.customGoals,
      Number(a.objectifCalories) || 0,
      Number(a.macroTargets?.protein) || 0,
    );
    const deltaText = (currentValue, previousValue, unit = "") => {
      const delta = C.percentDelta(currentValue, previousValue);
      if (delta == null) return "";
      return `<small class="${delta > 0 ? "up" : delta < 0 ? "down" : ""}">${delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} ${Math.abs(delta)}%${unit}</small>`;
    };
    box.innerHTML = `
      <div class="v44-section-head"><div><small>BILAN HEBDOMADAIRE</small><strong>Cette semaine vs précédente</strong></div><span>${current.startKey.slice(5).replace("-", "/")} → ${current.endKey.slice(5).replace("-", "/")}</span></div>
      <div class="v44-week-kpis">
        <div><span>🔥 Calories/j</span><strong>${current.avgCalories || "--"}</strong>${deltaText(current.avgCalories, previous.avgCalories)}</div>
        <div><span>💪 Protéines/j</span><strong>${current.avgProtein || "--"}${current.avgProtein ? " g" : ""}</strong>${deltaText(current.avgProtein, previous.avgProtein)}</div>
        <div><span>🌾 Fibres/j</span><strong>${current.avgFiber || "--"}${current.avgFiber ? " g" : ""}</strong>${deltaText(current.avgFiber, previous.avgFiber)}</div>
        <div><span>🌙 Sommeil</span><strong>${current.avgSleep || "--"}${current.avgSleep ? " h" : ""}</strong>${deltaText(current.avgSleep, previous.avgSleep)}</div>
        <div><span>🏃 Activité</span><strong>${current.activityMinutes} min</strong>${deltaText(current.activityMinutes, previous.activityMinutes)}</div>
        <div><span>🎯 Séances</span><strong>${current.workouts}</strong>${deltaText(current.workouts, previous.workouts)}</div>
      </div>
      <div class="v44-insights">${insights.length ? insights.map((text) => `<p>• ${esc(text)}</p>`).join("") : "<p>Continue à enregistrer tes journées pour obtenir un bilan plus précis.</p>"}</div>`;
  }

  function archiveForDay(key) {
    const a = account();
    if (key === today()) return a?.journalCalories || [];
    return v43(a)?.dailyJournals?.[key] || [];
  }

  function renderCalendarDetail(key) {
    selectedCalendarDay = key;
    const box = document.getElementById("v44-calendar-detail");
    if (!box) return;
    const journal = archiveForDay(key);
    const totals = C.journalTotals(journal);
    if (!journal.length) {
      box.innerHTML = `<strong>${new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(C.parseKey(key))}</strong><p>Aucun journal alimentaire archivé pour cette journée.</p>`;
      return;
    }
    box.innerHTML = `
      <div class="v44-calendar-detail-head"><strong>${new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(C.parseKey(key))}</strong><span>${Math.round(totals.calories)} kcal · P ${Math.round(totals.protein)} g · Fibres ${C.round1(totals.fiber)} g</span></div>
      ${MEALS.map((slot) => {
        const entries = journal.filter((entry) => entry.repasSlot === slot);
        if (!entries.length) return "";
        return `<div class="v44-history-meal"><strong>${esc(slot)}</strong>${entries.map((entry) => `<span>${esc(entry.nom || "Ajout")} <em>${Math.round(Number(entry.calories) || 0)} kcal</em></span>`).join("")}</div>`;
      }).join("")}`;
  }

  function renderCalendar() {
    const box = document.getElementById("v44-calendar-card");
    if (!box) return;
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(calendarCursor);
    const cells = C.calendarCells(year, month);
    const dayNames = ["L", "M", "M", "J", "V", "S", "D"];
    box.innerHTML = `
      <div class="v44-section-head">
        <div><small>HISTORIQUE ALIMENTAIRE</small><strong>Calendrier</strong></div>
        <div class="v44-calendar-nav"><button type="button" data-v44-month="-1">‹</button><span>${monthLabel}</span><button type="button" data-v44-month="1">›</button></div>
      </div>
      <div class="v44-calendar-weekdays">${dayNames.map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="v44-calendar-grid">${cells.map((key) => {
        if (!key) return "<i></i>";
        const journal = archiveForDay(key);
        const totals = C.journalTotals(journal);
        const active = key === selectedCalendarDay ? " active" : "";
        const todayClass = key === today() ? " today" : "";
        return `<button type="button" class="${active}${todayClass}" data-v44-day="${key}"><strong>${Number(key.slice(-2))}</strong>${journal.length ? `<small>${Math.round(totals.calories)}</small><b></b>` : ""}</button>`;
      }).join("")}</div>
      <div id="v44-calendar-detail" class="v44-calendar-detail"></div>`;

    box.querySelectorAll("[data-v44-month]").forEach((button) => {
      button.addEventListener("click", () => {
        calendarCursor = new Date(year, month + Number(button.dataset.v44Month), 1, 12);
        selectedCalendarDay = null;
        renderCalendar();
      });
    });
    box.querySelectorAll("[data-v44-day]").forEach((button) => {
      button.addEventListener("click", () => {
        renderCalendarDetail(button.dataset.v44Day);
        renderCalendar();
        renderCalendarDetail(button.dataset.v44Day);
      });
    });

    if (selectedCalendarDay) renderCalendarDetail(selectedCalendarDay);
  }

  function renderGoals() {
    const box = document.getElementById("v44-goals-card");
    const state = ensureState();
    if (!box || !state) return;
    const g = state.customGoals;
    const { current } = weekData();
    const fiberPct = C.clamp((current.avgFiber / g.fiberDaily) * 100, 0, 100);
    const sleepPct = C.clamp((current.avgSleep / g.sleepAverage) * 100, 0, 100);
    const actPct = C.clamp((current.activityMinutes / g.weeklyActivityMinutes) * 100, 0, 100);
    const workoutPct = C.clamp((current.workouts / g.weeklyWorkouts) * 100, 0, 100);
    box.innerHTML = `
      <div class="v44-section-head"><div><small>OBJECTIFS PERSONNELS</small><strong>Ce que tu veux vraiment suivre</strong></div><button type="button" id="v44-edit-goals">Modifier</button></div>
      <div class="v44-goal-grid">
        <div><span>🌾 Fibres/jour</span><strong>${current.avgFiber || 0} / ${g.fiberDaily} g</strong><i><b style="width:${fiberPct}%"></b></i></div>
        <div><span>🌙 Sommeil moyen</span><strong>${current.avgSleep || 0} / ${g.sleepAverage} h</strong><i><b style="width:${sleepPct}%"></b></i></div>
        <div><span>🏃 Activité/semaine</span><strong>${current.activityMinutes} / ${g.weeklyActivityMinutes} min</strong><i><b style="width:${actPct}%"></b></i></div>
        <div><span>🎯 Séances/semaine</span><strong>${current.workouts} / ${g.weeklyWorkouts}</strong><i><b style="width:${workoutPct}%"></b></i></div>
      </div>`;
    document.getElementById("v44-edit-goals")?.addEventListener("click", editGoals);
  }

  function editGoals() {
    const state = ensureState();
    const g = state.customGoals;
    const fiber = prompt("Objectif fibres par jour (g)", g.fiberDaily);
    if (fiber == null) return;
    const sleep = prompt("Objectif sommeil moyen (heures)", g.sleepAverage);
    if (sleep == null) return;
    const activity = prompt("Objectif activité par semaine (minutes)", g.weeklyActivityMinutes);
    if (activity == null) return;
    const workouts = prompt("Objectif séances par semaine", g.weeklyWorkouts);
    if (workouts == null) return;
    const values = [Number(fiber), Number(sleep), Number(activity), Number(workouts)];
    if (values.some((v) => !Number.isFinite(v) || v <= 0)) return alert("Entre des valeurs positives.");
    [g.fiberDaily, g.sleepAverage, g.weeklyActivityMinutes, g.weeklyWorkouts] = values;
    save();
    scheduleRender();
  }

  function renderAdaptive() {
    const box = document.getElementById("v44-adaptive-card");
    const a = account();
    const state = ensureState(a);
    if (!box || !a || !state) return;
    const suggestion = C.adaptiveCalorieSuggestion(
      a.weightHistory || [],
      a.w2?.goalMode || "maintain",
      Number(a.objectifCalories) || 0,
    );
    if (!state.settings.adaptiveCalories) {
      box.innerHTML = `<div class="v44-section-head"><div><small>AJUSTEMENT PROGRESSIF</small><strong>Désactivé</strong></div><button id="v44-enable-adaptive">Activer</button></div><p class="v44-muted">Wellness ne modifiera jamais ta cible sans ton accord.</p>`;
      document.getElementById("v44-enable-adaptive")?.addEventListener("click", () => { state.settings.adaptiveCalories = true; save(); renderAdaptive(); });
      return;
    }
    if (!suggestion) {
      box.innerHTML = `<div class="v44-section-head"><div><small>AJUSTEMENT PROGRESSIF</small><strong>Pas encore assez de recul</strong></div><span>analyse ≥ 14 jours</span></div><p class="v44-muted">Il faut au moins 4 pesées réparties sur 14 jours. Aucune cible n'est modifiée automatiquement.</p>`;
      return;
    }
    const change = suggestion.delta;
    box.innerHTML = `
      <div class="v44-section-head"><div><small>AJUSTEMENT PROGRESSIF</small><strong>Tendance ${suggestion.weeklyKg > 0 ? "+" : ""}${suggestion.weeklyKg} kg/semaine</strong></div><span>indicatif</span></div>
      <p class="v44-muted">${esc(suggestion.reason)}</p>
      ${change ? `<div class="v44-adaptive-action"><span>Cible actuelle <strong>${Math.round(Number(a.objectifCalories) || 0)} kcal</strong></span><span>Proposition <strong>${suggestion.suggestedTarget} kcal</strong></span><button type="button" id="v44-apply-adaptive">Appliquer</button></div>` : '<p class="v44-good">✓ Pas d’ajustement proposé actuellement.</p>'}`;
    document.getElementById("v44-apply-adaptive")?.addEventListener("click", () => {
      if (!confirm(`Passer la cible à ${suggestion.suggestedTarget} kcal/j ?`)) return;
      a.objectifCalories = suggestion.suggestedTarget;
      try { megaCalculateMacroTargets(a); } catch {}
      save();
      try { rafraichirApplication(); } catch {}
      scheduleRender();
    });
  }

  function renderTodayPriorities() {
    const home = document.querySelector("#page-accueil .px-home-screen");
    if (!home) return;
    let box = document.getElementById("v44-priority-card");
    if (!box) {
      box = document.createElement("section");
      box.id = "v44-priority-card";
      box.className = "v44-priority-card px-card";
      const coach = home.querySelector(".px-coach-card");
      if (coach) home.insertBefore(box, coach);
      else home.appendChild(box);
    }
    const a = account();
    const state = ensureState(a);
    if (!a || !state) return;
    const totals = C.journalTotals(a.journalCalories || []);
    const sleep = Number(a.w2?.dailyMetrics?.[today()]?.sleepHours) || 0;
    const items = C.priorities({ account: a, totals, goals: state.customGoals, sleepHours: sleep });
    const habits = state.settings.habitSuggestions
      ? C.detectMealHabits(dailyJournals(a), { days: 14, minOccurrences: 3, endKey: today() })
      : [];
    const firstHabit = habits.find((habit) => !(a.journalCalories || []).some((entry) => entry.repasSlot === habit.slot));

    box.innerHTML = `
      <div class="v44-section-head"><div><small>PRIORITÉS</small><strong>Le plus utile maintenant</strong></div><span>${items.length ? items.length : "✓"}</span></div>
      <div class="v44-priority-list">${items.length ? items.map((item) => `<div><span>${item.icon}</span><strong>${esc(item.title)}</strong></div>`).join("") : "<p>Tout est bien avancé pour aujourd’hui.</p>"}</div>
      ${firstHabit ? `<button type="button" class="v44-habit" id="v44-use-habit"><span>✨ Habitude détectée</span><strong>${esc(firstHabit.slot)} repris ${firstHabit.count} fois récemment</strong><small>Ajouter ce repas habituel</small></button>` : ""}`;
    document.getElementById("v44-use-habit")?.addEventListener("click", () => {
      const count = window.WellnessDailyUX?.addEntries
        ? window.WellnessDailyUX.addEntries(firstHabit.entries, firstHabit.slot)
        : 0;
      if (!count) {
        firstHabit.entries.forEach((entry) => {
          try {
            ajouterCaloriesAuJournal(entry.nom, entry.calories, entry.source || "manuel", {
              proteines: entry.proteines, glucides: entry.glucides, lipides: entry.lipides, repasSlot: firstHabit.slot, portions: entry.portions,
            });
          } catch {}
        });
        try { rafraichirApplication(); } catch {}
      }
      scheduleRender();
    });
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderAll, 80);
  }

  function renderAll() {
    ensureState();
    patchSearchRuntime();
    ensureQuickEntry();
    ensureRecipeBuilderCard();
    ensureProgressPanels();
    renderWeekly();
    renderCalendar();
    renderGoals();
    renderAdaptive();
    renderTodayPriorities();
  }

  // Keep the new panels current after the app refreshes.
  if (typeof rafraichirApplication === "function" && !rafraichirApplication.__v44) {
    const originalRefresh = rafraichirApplication;
    const wrapped = function wellness44Refresh(...args) {
      const value = originalRefresh.apply(this, args);
      scheduleRender();
      return value;
    };
    wrapped.__v44 = true;
    rafraichirApplication = wrapped;
  }

  // Nutrition mutations also refresh calendar/week/priorities.
  ["ajouterCaloriesAuJournal", "modifierEntreeJournal", "supprimerEntreeJournal"].forEach((name) => {
    const original = window[name];
    if (typeof original !== "function" || original.__v44) return;
    const wrapped = function wellness44JournalMutation(...args) {
      const value = original.apply(this, args);
      if (value && typeof value.then === "function") {
        return value.then((result) => { scheduleRender(); return result; });
      }
      scheduleRender();
      return value;
    };
    wrapped.__v44 = true;
    window[name] = wrapped;
  });

  renderAll();

  window.WellnessV44 = {
    version: VERSION,
    refresh: renderAll,
    searchFoods,
    addFood,
    openRecipeBuilder,
  };
})();
