(() => {
  "use strict";

  const C = window.WellnessDailyCoreV43;
  const U = window.WellnessFoodUnits;
  if (!C || !U) {
    console.error("[Wellness 4.3] Core quotidien absent.");
    return;
  }

  const VERSION = "4.4.0";
  const MEALS = ["Petit-déjeuner", "Déjeuner", "Dîner", "Collation"];
  let activeQuickTab = "recent";
  let renderTimer = 0;
  let decorating = false;
  let lastDeleted = null;
  let suppressUndoToast = false;

  function esc(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function account() {
    try { return typeof obtenirCompteActif === "function" ? obtenirCompteActif() : null; }
    catch { return null; }
  }

  function today() {
    try { return typeof obtenirDateLocale === "function" ? obtenirDateLocale() : C.dateKey(); }
    catch { return C.dateKey(); }
  }

  function selectedFood() {
    try { return typeof w2SelectedFood !== "undefined" ? w2SelectedFood : null; }
    catch { return null; }
  }

  function ensureState(a = account()) {
    if (!a) return null;
    if (!a.v43 || typeof a.v43 !== "object") a.v43 = {};
    const v = a.v43;

    if (!v.usage || typeof v.usage !== "object") v.usage = {};
    if (!v.favoriteFoods || typeof v.favoriteFoods !== "object") v.favoriteFoods = {};
    if (!Array.isArray(v.mealTemplates)) v.mealTemplates = [];
    if (!v.dailyJournals || typeof v.dailyJournals !== "object") v.dailyJournals = {};
    if (!v.portionPresets || typeof v.portionPresets !== "object") v.portionPresets = {};
    if (!v.settings || typeof v.settings !== "object") v.settings = {};
    if (typeof v.settings.waterJournalSync !== "boolean") v.settings.waterJournalSync = false;
    if (!Number.isFinite(Number(v.settings.glassMl))) v.settings.glassMl = 250;
    if (!v.hydration || typeof v.hydration !== "object") v.hydration = {};
    if (!Number.isFinite(Number(v.hydration.autoGlasses))) v.hydration.autoGlasses = 0;

    v.dailyJournals = C.trimDailyJournals(v.dailyJournals, 90);
    return v;
  }

  function save() {
    try { sauvegarderEtatApplication(); } catch {}
  }

  function snapshotEntry(entry) {
    return C.cloneEntry(entry);
  }

  function snapshotToday() {
    const a = account();
    const v = ensureState(a);
    if (!a || !v) return;
    v.dailyJournals[today()] = (a.journalCalories || []).map(snapshotEntry);
    v.dailyJournals = C.trimDailyJournals(v.dailyJournals, 90);
    save();
  }

  function foodSnapshot(food) {
    if (!food) return null;
    const keys = [
      "id", "ciqualCode", "name", "category", "subcategory", "brand",
      "kcal", "protein", "carbs", "fat", "fiber", "sugars",
      "saturatedFat", "salt", "basisQuantity", "basisUnit",
      "liquid", "density", "pieceWeight", "source", "sourceDatabase"
    ];
    const result = {};
    keys.forEach((key) => {
      if (food[key] !== undefined) result[key] = food[key];
    });
    return result;
  }

  function usageFoodMatchesEntry(food, entry) {
    if (!food || !entry) return false;
    if (entry.foodId && food.id) return String(entry.foodId) === String(food.id);
    const base = U.stripQuantitySuffix(entry.nom || "");
    return C.normalize(base) === C.normalize(food.name || "");
  }

  function captureAdded(beforeIds, foodAtCall = null) {
    // Deux microtasks : laisse l'ajout V4.2 enrichir d'abord l'entrée
    // (quantité, unité, fibres, sucres, sel, saturés) avant l'historisation.
    queueMicrotask(() => queueMicrotask(() => {
      const a = account();
      const v = ensureState(a);
      if (!a || !v) return;
      const added = (a.journalCalories || []).filter((entry) => !beforeIds.has(entry.id));
      const now = new Date().toISOString();

      added.forEach((entry) => {
        const key = C.entryKey(entry);
        const previous = v.usage[key] || {};
        v.usage[key] = {
          key,
          count: (Number(previous.count) || 0) + 1,
          lastUsedAt: now,
          entry: snapshotEntry(entry),
          food: usageFoodMatchesEntry(foodAtCall, entry)
            ? foodSnapshot(foodAtCall)
            : previous.food || null,
        };
      });

      snapshotToday();
      syncHydrationFromJournal();
      scheduleRender();
    }));
  }

  function patchQualityOnModification(id, changes) {
    const a = account();
    const entry = (a?.journalCalories || []).find((item) => item.id === id);
    if (!entry || entry.source !== "aliment" || !changes || typeof changes !== "object") return changes;

    const oldRef = Number(entry.referenceAmount) || ((Number(entry.portions) || 1) * 100);
    const newRef = Number(changes.referenceAmount) || (Number(changes.portions) > 0 ? Number(changes.portions) * 100 : oldRef);
    if (!(oldRef > 0) || !(newRef > 0) || Math.abs(oldRef - newRef) < 0.0001) return changes;

    const factor = newRef / oldRef;
    const next = { ...changes };
    const fields = ["fibres", "sucres", "grasSatures", "sel"];
    fields.forEach((field) => {
      if (next[field] == null && Number.isFinite(Number(entry[field]))) {
        next[field] = C.round1(Number(entry[field]) * factor);
      }
    });
    return next;
  }

  function installMutationHooks() {
    if (typeof ajouterCaloriesAuJournal === "function" && !ajouterCaloriesAuJournal.__v43) {
      const original = ajouterCaloriesAuJournal;
      const wrapped = function wellness43Add(...args) {
        const a = account();
        const before = new Set((a?.journalCalories || []).map((entry) => entry.id));
        const food = selectedFood();
        const result = original.apply(this, args);
        if (result && typeof result.then === "function") {
          return result.then((value) => {
            if (value !== false) captureAdded(before, food);
            return value;
          });
        }
        if (result !== false) captureAdded(before, food);
        return result;
      };
      wrapped.__v43 = true;
      ajouterCaloriesAuJournal = wrapped;
    }

    if (typeof modifierEntreeJournal === "function" && !modifierEntreeJournal.__v43) {
      const original = modifierEntreeJournal;
      const wrapped = function wellness43Edit(id, changes = {}) {
        const next = patchQualityOnModification(id, changes);
        const result = original.call(this, id, next);
        if (result !== false) {
          queueMicrotask(() => {
            snapshotToday();
            syncHydrationFromJournal();
            scheduleRender();
          });
        }
        return result;
      };
      wrapped.__v43 = true;
      modifierEntreeJournal = wrapped;
    }

    if (typeof supprimerEntreeJournal === "function" && !supprimerEntreeJournal.__v43) {
      const original = supprimerEntreeJournal;
      const wrapped = function wellness43Delete(id) {
        const a = account();
        const entry = (a?.journalCalories || []).find((item) => item.id === id);
        if (entry) lastDeleted = snapshotEntry(entry);
        const result = original.call(this, id);
        if (result !== false) {
          queueMicrotask(() => {
            snapshotToday();
            syncHydrationFromJournal();
            scheduleRender();
            if (lastDeleted && !suppressUndoToast) {
              showToast("Aliment supprimé", "Annuler", () => {
                const restore = lastDeleted;
                lastDeleted = null;
                addClonedEntry(restore, restore.repasSlot);
              });
            }
          });
        }
        return result;
      };
      wrapped.__v43 = true;
      supprimerEntreeJournal = wrapped;
    }
  }

  function enrichSelectedFoodQuality() {
    if (typeof w2AddSelectedFood !== "function" || w2AddSelectedFood.__v43quality) return;
    const original = w2AddSelectedFood;
    const wrapped = function wellness43AddSelectedFood(...args) {
      const a = account();
      const before = new Set((a?.journalCalories || []).map((entry) => entry.id));
      const food = selectedFood();
      const quantity = Number(document.getElementById("w2-portion-grams")?.value);
      const unit = document.getElementById("w2-portion-unit")?.value || "g";
      const pieceWeight = Number(document.getElementById("w2-piece-weight")?.value) || null;
      const scaled = food ? U.scaleFood(food, quantity, unit, pieceWeight) : null;

      const result = original.apply(this, args);
      queueMicrotask(() => {
        const current = account();
        const entry = (current?.journalCalories || []).find((item) => !before.has(item.id));
        if (!entry || !scaled) return;
        entry.fibres = scaled.fiber || 0;
        entry.sucres = scaled.sugars || 0;
        entry.grasSatures = scaled.saturatedFat || 0;
        entry.sel = scaled.salt || 0;
        save();
        snapshotToday();
        scheduleRender();
      });
      return result;
    };
    wrapped.__v43quality = true;
    w2AddSelectedFood = wrapped;
  }

  function addClonedEntry(source, targetSlot = null) {
    if (!source) return false;
    const a = account();
    const before = new Set((a?.journalCalories || []).map((entry) => entry.id));
    const slot = targetSlot || source.repasSlot || "Déjeuner";

    const ok = ajouterCaloriesAuJournal(
      source.nom || "Ajout",
      Number(source.calories) || 1,
      source.source || "manuel",
      {
        proteines: Number(source.proteines) || 0,
        glucides: Number(source.glucides) || 0,
        lipides: Number(source.lipides) || 0,
        repasSlot: slot,
        portions: Number(source.portions) || 1,
        quantity: source.quantity,
        unit: source.unit,
      },
    );

    if (!ok) return false;
    const newEntry = [...(a.journalCalories || [])].reverse().find((entry) => !before.has(entry.id));
    if (newEntry) {
      const id = newEntry.id;
      const clone = JSON.parse(JSON.stringify(source));
      delete clone.id;
      Object.assign(newEntry, clone, { id, repasSlot: slot });
      save();
    }
    return true;
  }

  function addEntries(entries, slotOverride = null) {
    if (!Array.isArray(entries) || !entries.length) return 0;
    let count = 0;
    entries.forEach((entry) => {
      if (addClonedEntry(entry, slotOverride || entry.repasSlot)) count += 1;
    });
    snapshotToday();
    syncHydrationFromJournal();
    try { rafraichirApplication(); } catch {}
    scheduleRender();
    return count;
  }

  function yesterdayJournal() {
    const v = ensureState();
    return v?.dailyJournals?.[C.previousDay(today())] || [];
  }

  function copyYesterday() {
    const entries = yesterdayJournal();
    if (!entries.length) {
      showToast("Aucun journal d'hier disponible");
      return;
    }
    const a = account();
    if ((a?.journalCalories || []).length &&
        !confirm("Ajouter toute la journée d'hier au journal actuel ?")) return;
    const count = addEntries(entries);
    showToast(`${count} ajout${count > 1 ? "s" : ""} copié${count > 1 ? "s" : ""} depuis hier`);
  }

  function repeatYesterdayMeal(slot) {
    const entries = yesterdayJournal().filter((entry) => entry.repasSlot === slot);
    if (!entries.length) {
      showToast(`Aucun ${slot.toLowerCase()} enregistré hier`);
      return;
    }
    const count = addEntries(entries, slot);
    showToast(`${count} ajout${count > 1 ? "s" : ""} repris pour ${slot}`);
  }

  function saveMealTemplate(slot) {
    const a = account();
    const v = ensureState(a);
    const entries = (a?.journalCalories || []).filter((entry) => entry.repasSlot === slot).map(snapshotEntry);
    if (!entries.length) {
      showToast(`Ajoute d'abord des aliments à ${slot}`);
      return;
    }
    const name = prompt("Nom de ce repas enregistré :", `${slot} habituel`)?.trim();
    if (!name) return;
    v.mealTemplates.unshift({
      id: `meal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      slot,
      entries,
      createdAt: new Date().toISOString(),
    });
    v.mealTemplates = v.mealTemplates.slice(0, 30);
    save();
    renderSmartTools();
    showToast(`"${name}" enregistré`);
  }

  function deleteTemplate(id) {
    const v = ensureState();
    if (!v) return;
    v.mealTemplates = v.mealTemplates.filter((item) => item.id !== id);
    save();
    renderSmartTools();
  }

  function addTemplate(id) {
    const v = ensureState();
    const template = v?.mealTemplates?.find((item) => item.id === id);
    if (!template) return;
    const count = addEntries(template.entries, template.slot);
    showToast(`${template.name} ajouté · ${count} élément${count > 1 ? "s" : ""}`);
  }

  function toggleFavoriteFood(food) {
    const v = ensureState();
    if (!v || !food) return false;
    const key = C.foodKey(food);
    if (v.favoriteFoods[key]) {
      delete v.favoriteFoods[key];
      save();
      renderSmartTools();
      return false;
    }
    v.favoriteFoods[key] = {
      key,
      savedAt: new Date().toISOString(),
      food: foodSnapshot(food),
    };
    save();
    renderSmartTools();
    return true;
  }

  function isFavoriteFood(food) {
    const v = ensureState();
    return !!v?.favoriteFoods?.[C.foodKey(food)];
  }

  function installFavoriteFoodCards() {
    if (typeof w2RenderFoodCards !== "function" || w2RenderFoodCards.__v43) return;
    const wrapped = function wellness43FoodCards(container, foods) {
      if (!container) return;
      container.innerHTML = "";
      if (!foods?.length) {
        container.innerHTML = '<p class="message-vide">Aucun aliment trouvé.</p>';
        return;
      }

      foods.forEach((food) => {
        const wrap = document.createElement("div");
        wrap.className = "v43-food-card-wrap";

        const card = document.createElement("button");
        card.type = "button";
        card.className = "w2-food-card v42-food-card";
        const basis = food.basisUnit === "ml" ? "100 ml" : "100 g";
        card.innerHTML = `
          <span class="w2-food-category">${esc(food.category || "Aliment")}</span>
          <strong>${esc(food.name || "Aliment")}</strong>
          <span class="w2-food-kcal">${Math.round(Number(food.kcal) || 0)} kcal / ${basis}</span>
          <small>P ${C.round1(food.protein)} g · G ${C.round1(food.carbs)} g · L ${C.round1(food.fat)} g${Number(food.fiber) ? ` · Fibres ${C.round1(food.fiber)} g` : ""}</small>
          <em class="v42-food-source">${esc(food.sourceDatabase || (String(food.source || "").includes("Ciqual") ? "Ciqual 2025" : food.source || "Wellness"))}</em>`;
        card.addEventListener("click", () => w2OpenPortion(food));

        const favorite = document.createElement("button");
        favorite.type = "button";
        favorite.className = "v43-food-favorite";
        favorite.setAttribute("aria-label", isFavoriteFood(food) ? "Retirer des favoris" : "Ajouter aux favoris");
        favorite.textContent = isFavoriteFood(food) ? "★" : "☆";
        favorite.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const on = toggleFavoriteFood(food);
          favorite.textContent = on ? "★" : "☆";
          favorite.setAttribute("aria-label", on ? "Retirer des favoris" : "Ajouter aux favoris");
          favorite.classList.toggle("active", on);
          if (on) showToast(`${food.name} ajouté aux favoris`);
        });
        favorite.classList.toggle("active", isFavoriteFood(food));

        wrap.append(card, favorite);
        container.appendChild(wrap);
      });
    };
    wrapped.__v43 = true;
    w2RenderFoodCards = wrapped;
    try { w2RenderFoodHub(); } catch {}
  }

  function ensurePortionPresetsUi() {
    const overlay = document.getElementById("w2-portion-overlay");
    const shortcuts = overlay?.querySelector(".w2-portion-shortcuts");
    if (!overlay || !shortcuts || document.getElementById("v43-portion-presets")) return;

    const section = document.createElement("section");
    section.id = "v43-portion-presets";
    section.className = "v43-portion-presets";
    section.innerHTML = `
      <div class="v43-mini-head"><strong>Mes portions</strong><button type="button" id="v43-save-portion">+ Enregistrer</button></div>
      <div id="v43-portion-preset-list" class="v43-chip-row"></div>`;
    shortcuts.insertAdjacentElement("afterend", section);

    document.getElementById("v43-save-portion")?.addEventListener("click", () => {
      const food = selectedFood();
      const v = ensureState();
      if (!food || !v) return;
      const value = Number(document.getElementById("w2-portion-grams")?.value);
      const unit = document.getElementById("w2-portion-unit")?.value || "g";
      const pieceWeight = Number(document.getElementById("w2-piece-weight")?.value) || null;
      if (!(value > 0)) return;
      const defaultName = unit === "ml" || unit === "cl" || unit === "l" ? "Mon verre" : "Ma portion";
      const name = prompt("Nom de cette portion :", defaultName)?.trim();
      if (!name) return;
      const key = C.foodKey(food);
      if (!Array.isArray(v.portionPresets[key])) v.portionPresets[key] = [];
      v.portionPresets[key].unshift({
        id: `portion-${Date.now()}`,
        name,
        value,
        unit,
        pieceWeight,
      });
      v.portionPresets[key] = v.portionPresets[key].slice(0, 6);
      save();
      renderPortionPresets();
      showToast(`${name} enregistrée`);
    });
  }

  function renderPortionPresets() {
    ensurePortionPresetsUi();
    const list = document.getElementById("v43-portion-preset-list");
    const food = selectedFood();
    const v = ensureState();
    if (!list || !food || !v) return;
    const key = C.foodKey(food);
    const items = v.portionPresets[key] || [];

    list.innerHTML = items.length
      ? items.map((preset) => `<button type="button" class="v43-chip" data-v43-portion="${esc(preset.id)}">${esc(preset.name)} · ${esc(U.formatQuantity(preset.value, preset.unit))}</button>`).join("")
      : '<small class="v43-empty-note">Enregistre ton bol, ton verre ou ta portion habituelle.</small>';

    list.querySelectorAll("[data-v43-portion]").forEach((button) => {
      button.addEventListener("click", () => {
        const preset = items.find((item) => item.id === button.dataset.v43Portion);
        if (!preset) return;
        const quantity = document.getElementById("w2-portion-grams");
        const unit = document.getElementById("w2-portion-unit");
        const piece = document.getElementById("w2-piece-weight");
        if (unit) {
          unit.value = preset.unit;
          unit.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (quantity) quantity.value = preset.value;
        if (piece && preset.pieceWeight) piece.value = preset.pieceWeight;
        try { w2UpdatePortionPreview(); } catch {}
      });
    });
  }

  function installPortionHook() {
    if (typeof w2OpenPortion !== "function" || w2OpenPortion.__v43) return;
    const original = w2OpenPortion;
    const wrapped = function wellness43OpenPortion(food) {
      const value = original.call(this, food);
      queueMicrotask(renderPortionPresets);
      return value;
    };
    wrapped.__v43 = true;
    w2OpenPortion = wrapped;
  }

  function totalMacros(a = account()) {
    return C.mealTotals(a?.journalCalories || []);
  }

  function foodAllowed(food, a = account()) {
    try {
      if (typeof W2_CORE !== "undefined" && W2_CORE?.recipeAllowed && a?.w2?.preferences) {
        return W2_CORE.recipeAllowed(
          { nom: food.name || "", ingredients: [food.name || "", food.category || ""] },
          a.w2.preferences,
        );
      }
    } catch {}
    return true;
  }

  function smartSuggestions(a = account()) {
    if (!a) return [];
    const totals = totalMacros(a);
    const targetCalories = Number(a.objectifCalories) || 0;
    const targetProtein = Number(a.macroTargets?.protein) || 0;
    const qTargets = C.qualityTargets(targetCalories);
    const needs = {
      remainingCalories: Math.max(0, targetCalories - totals.calories),
      proteinRemaining: Math.max(0, targetProtein - totals.protein),
      fiberRemaining: Math.max(0, qTargets.fiber - totals.fiber),
    };

    return C.diverseSuggestions(
      window.WELLNESS_FOODS || [],
      needs,
      5,
      (food) => foodAllowed(food, a),
    );
  }

  function renderRemaining() {
    const box = document.getElementById("v43-remaining-card");
    const a = account();
    if (!box || !a) return;
    const totals = totalMacros(a);
    const kcalTarget = Number(a.objectifCalories) || 0;
    const proteinTarget = Number(a.macroTargets?.protein) || 0;
    const remainingKcal = Math.max(0, Math.round(kcalTarget - totals.calories));
    const remainingProtein = Math.max(0, Math.round(proteinTarget - totals.protein));
    const fiberTarget = C.qualityTargets(kcalTarget).fiber;
    const remainingFiber = Math.max(0, Math.round((fiberTarget - totals.fiber) * 10) / 10);
    const suggestions = smartSuggestions(a);

    box.innerHTML = `
      <div class="v43-section-head">
        <div><small>POUR COMPLÉTER TA JOURNÉE</small><strong>Il te reste</strong></div>
        <span>${kcalTarget ? `${remainingKcal} kcal` : "objectif à configurer"}</span>
      </div>
      <div class="v43-remaining-pills">
        ${proteinTarget ? `<span>💪 ${remainingProtein} g protéines</span>` : ""}
        <span>🌾 ${remainingFiber} g fibres</span>
      </div>
      <div class="v43-suggestion-row">
        ${suggestions.length ? suggestions.map((food) => `
          <button type="button" class="v43-suggestion" data-v43-suggest="${esc(C.foodKey(food))}">
            <strong>${esc(food.name)}</strong><small>${Math.round(Number(food.kcal) || 0)} kcal/100 g · P ${C.round1(food.protein)} g</small>
          </button>`).join("") : '<small class="v43-empty-note">Tes principaux repères sont déjà bien couverts.</small>'}
      </div>`;

    box.querySelectorAll("[data-v43-suggest]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.v43Suggest;
        const food = (window.WELLNESS_FOODS || []).find((item) => C.foodKey(item) === key);
        if (food) w2OpenPortion(food);
      });
    });
  }

  function renderQuality() {
    const box = document.getElementById("v43-quality-card");
    const a = account();
    if (!box || !a) return;
    const totals = totalMacros(a);
    const targets = C.qualityTargets(a.objectifCalories);
    const fiberPct = C.clamp((totals.fiber / targets.fiber) * 100, 0, 100);
    const saltPct = C.clamp((totals.salt / targets.salt) * 100, 0, 100);
    const satPct = C.clamp((totals.saturatedFat / targets.saturatedFat) * 100, 0, 100);

    box.innerHTML = `
      <div class="v43-section-head"><div><small>QUALITÉ NUTRITIONNELLE</small><strong>Repères du jour</strong></div><span>indicatifs</span></div>
      <div class="v43-quality-grid">
        <div><span>🌾 Fibres</span><strong>${C.round1(totals.fiber)} / ${targets.fiber} g</strong><i><b style="width:${fiberPct}%"></b></i></div>
        <div><span>🧂 Sel</span><strong>${C.round1(totals.salt)} / ${targets.salt} g</strong><i><b style="width:${saltPct}%"></b></i></div>
        <div><span>🥛 Saturés</span><strong>${C.round1(totals.saturatedFat)} / ${targets.saturatedFat} g</strong><i><b style="width:${satPct}%"></b></i></div>
        <div><span>🍬 Sucres totaux</span><strong>${C.round1(totals.sugars)} g</strong><small>information, sans jugement automatique</small></div>
      </div>`;
  }

  function quickTabItems(tab) {
    const v = ensureState();
    if (!v) return [];
    if (tab === "recent") return C.rankUsage(v.usage, "recent", 8);
    if (tab === "frequent") return C.rankUsage(v.usage, "frequent", 8);
    if (tab === "favorites") {
      return Object.values(v.favoriteFoods)
        .sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));
    }
    if (tab === "templates") return v.mealTemplates;
    return [];
  }

  function renderQuickContent() {
    const content = document.getElementById("v43-quick-content");
    const v = ensureState();
    if (!content || !v) return;
    const items = quickTabItems(activeQuickTab);

    if (activeQuickTab === "favorites") {
      content.innerHTML = items.length ? items.map((item) => `
        <button class="v43-quick-card" type="button" data-v43-favorite="${esc(item.key)}">
          <span>★</span><strong>${esc(item.food?.name || "Aliment")}</strong><small>${Math.round(Number(item.food?.kcal) || 0)} kcal / 100 g</small>
        </button>`).join("") : '<p class="v43-empty-note">Appuie sur ☆ dans la recherche pour épingler tes aliments.</p>';
    } else if (activeQuickTab === "templates") {
      content.innerHTML = items.length ? items.map((item) => `
        <div class="v43-template-card">
          <button type="button" data-v43-template="${esc(item.id)}"><span>🍽️</span><strong>${esc(item.name)}</strong><small>${esc(item.slot)} · ${item.entries?.length || 0} éléments</small></button>
          <button type="button" class="v43-template-delete" data-v43-template-delete="${esc(item.id)}" aria-label="Supprimer ${esc(item.name)}">✕</button>
        </div>`).join("") : '<p class="v43-empty-note">Dans un repas du journal, utilise « Enregistrer » pour créer ton premier repas habituel.</p>';
    } else {
      content.innerHTML = items.length ? items.map((item) => `
        <button class="v43-quick-card" type="button" data-v43-usage="${esc(item.key)}">
          <span>${activeQuickTab === "frequent" ? "⚡" : "🕘"}</span>
          <strong>${esc(item.entry?.nom || "Ajout")}</strong>
          <small>${esc(item.entry?.repasSlot || "Repas")} · ${Math.round(Number(item.entry?.calories) || 0)} kcal${activeQuickTab === "frequent" ? ` · ${Number(item.count) || 1}×` : ""}</small>
        </button>`).join("") : `<p class="v43-empty-note">${activeQuickTab === "recent" ? "Tes derniers ajouts apparaîtront ici." : "Les aliments que tu utilises souvent apparaîtront ici."}</p>`;
    }

    content.querySelectorAll("[data-v43-usage]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = v.usage[button.dataset.v43Usage];
        if (!item?.entry) return;
        addClonedEntry(item.entry, item.entry.repasSlot);
        try { rafraichirApplication(); } catch {}
        showToast(`${U.stripQuantitySuffix(item.entry.nom || "Aliment")} ajouté`);
      });
    });

    content.querySelectorAll("[data-v43-favorite]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = v.favoriteFoods[button.dataset.v43Favorite];
        if (item?.food) w2OpenPortion(item.food);
      });
    });

    content.querySelectorAll("[data-v43-template]").forEach((button) => {
      button.addEventListener("click", () => addTemplate(button.dataset.v43Template));
    });

    content.querySelectorAll("[data-v43-template-delete]").forEach((button) => {
      button.addEventListener("click", () => {
        if (confirm("Supprimer ce repas enregistré ?")) deleteTemplate(button.dataset.v43TemplateDelete);
      });
    });
  }

  function ensureSmartTools() {
    const journal = document.querySelector(".px-journal-card");
    const anchor = document.getElementById("px-nutrition-tools-anchor") || journal;
    if (!journal || !anchor || document.getElementById("v43-smart-tools")) return;

    const tools = document.createElement("section");
    tools.id = "v43-smart-tools";
    tools.className = "v43-smart-tools px-card";
    tools.innerHTML = `
      <div class="v43-section-head">
        <div><small>AJOUT RAPIDE</small><strong>Moins de saisie, plus pratique</strong></div>
        <button type="button" id="v43-copy-yesterday">↻ Copier hier</button>
      </div>
      <div class="v43-tabs" role="tablist">
        <button type="button" class="active" data-v43-tab="recent">Récents</button>
        <button type="button" data-v43-tab="frequent">Fréquents</button>
        <button type="button" data-v43-tab="favorites">Favoris</button>
        <button type="button" data-v43-tab="templates">Mes repas</button>
      </div>
      <div id="v43-quick-content" class="v43-quick-content"></div>
      <details class="v43-options">
        <summary>Options pratiques</summary>
        <label class="v43-toggle">
          <span><strong>Eau du journal → hydratation</strong><small>Compte automatiquement seulement l'eau plate/gazeuse ajoutée au journal.</small></span>
          <input id="v43-water-sync" type="checkbox">
        </label>
        <label class="v43-glass-setting"><span>Volume d'un verre</span><select id="v43-glass-ml"><option value="200">200 ml</option><option value="250">250 ml</option><option value="300">300 ml</option><option value="330">330 ml</option></select></label>
      </details>`;

    const remaining = document.createElement("section");
    remaining.id = "v43-remaining-card";
    remaining.className = "v43-remaining-card px-card";

    const quality = document.createElement("section");
    quality.id = "v43-quality-card";
    quality.className = "v43-quality-card px-card";

    anchor.parentElement.insertBefore(tools, anchor);
    anchor.parentElement.insertBefore(remaining, anchor);
    anchor.parentElement.insertBefore(quality, anchor);

    document.getElementById("v43-copy-yesterday")?.addEventListener("click", copyYesterday);
    tools.querySelectorAll("[data-v43-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        activeQuickTab = button.dataset.v43Tab;
        tools.querySelectorAll("[data-v43-tab]").forEach((item) => item.classList.toggle("active", item === button));
        renderQuickContent();
      });
    });

    const v = ensureState();
    const water = document.getElementById("v43-water-sync");
    const glass = document.getElementById("v43-glass-ml");
    if (water) water.checked = !!v.settings.waterJournalSync;
    if (glass) glass.value = String(v.settings.glassMl || 250);

    water?.addEventListener("change", () => {
      v.settings.waterJournalSync = water.checked;
      save();
      const changed = syncHydrationFromJournal();
      if (changed) try { rafraichirApplication(); } catch {}
      showToast(water.checked ? "Hydratation automatique activée" : "Hydratation automatique désactivée");
    });

    glass?.addEventListener("change", () => {
      v.settings.glassMl = Number(glass.value) || 250;
      save();
      const changed = syncHydrationFromJournal();
      if (changed) try { rafraichirApplication(); } catch {}
    });
  }

  function renderSmartTools() {
    ensureSmartTools();
    renderQuickContent();
    renderRemaining();
    renderQuality();
    decorateJournal();
  }

  function mealSlotFromGroup(group) {
    const text = group.querySelector(".px-journal-group-head")?.textContent || "";
    return MEALS.find((slot) => text.includes(slot)) || null;
  }

  function decorateJournal() {
    if (decorating) return;
    const list = document.getElementById("px-journal-list");
    const a = account();
    if (!list || !a) return;

    decorating = true;
    try {
      list.querySelectorAll(".px-journal-group").forEach((group) => {
        const slot = mealSlotFromGroup(group);
        if (!slot) return;
        const head = group.querySelector(".px-journal-group-head");
        const totals = C.mealTotals(a.journalCalories || [], slot);

        let summary = group.querySelector(".v43-meal-macros");
        if (!summary) {
          summary = document.createElement("div");
          summary.className = "v43-meal-macros";
          head?.insertAdjacentElement("afterend", summary);
        }
        summary.textContent = totals.count
          ? `P ${Math.round(totals.protein)} g · G ${Math.round(totals.carbs)} g · L ${Math.round(totals.fat)} g${totals.fiber ? ` · Fibres ${C.round1(totals.fiber)} g` : ""}`
          : "";

        if (slot !== "Collation" && !group.querySelector(".v43-meal-actions")) {
          const actions = document.createElement("div");
          actions.className = "v43-meal-actions";
          actions.innerHTML = `
            <button type="button" data-v43-repeat="${esc(slot)}">↻ Hier</button>
            <button type="button" data-v43-save-meal="${esc(slot)}">☆ Enregistrer</button>`;
          summary.insertAdjacentElement("afterend", actions);
        }
      });

      list.querySelectorAll(".px-journal-entry").forEach((row) => {
        if (row.querySelector(".v43-entry-menu")) return;
        const main = row.querySelector("[data-journal-edit]");
        const id = main?.dataset.journalEdit;
        if (!id) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "v43-entry-menu";
        button.dataset.v43EntryMenu = id;
        button.setAttribute("aria-label", "Actions sur cet aliment");
        button.textContent = "•••";
        const del = row.querySelector(".px-journal-entry-delete");
        row.insertBefore(button, del || null);
      });
    } finally {
      decorating = false;
    }
  }

  function ensureEntryMenu() {
    let overlay = document.getElementById("v43-entry-menu-overlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "v43-entry-menu-overlay";
    overlay.className = "modal-simple-overlay v43-entry-menu-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <section class="modal-simple v43-entry-sheet" role="dialog" aria-modal="true" aria-labelledby="v43-entry-menu-title">
        <div class="modal-simple-header"><div><p class="sur-titre">Journal</p><h2 id="v43-entry-menu-title">Actions</h2></div><button type="button" id="v43-entry-menu-close" class="fermer-modal-simple" aria-label="Fermer">✕</button></div>
        <div id="v43-entry-menu-content" class="v43-entry-menu-content"></div>
      </section>`;
    document.body.appendChild(overlay);
    const close = () => {
      try { megaCloseOverlay(overlay); } catch { overlay.classList.remove("ouverte"); }
    };
    document.getElementById("v43-entry-menu-close")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    return overlay;
  }

  function openEntryMenu(id) {
    const overlay = ensureEntryMenu();
    const a = account();
    const entry = (a?.journalCalories || []).find((item) => item.id === id);
    const content = document.getElementById("v43-entry-menu-content");
    if (!entry || !content) return;
    document.getElementById("v43-entry-menu-title").textContent = U.stripQuantitySuffix(entry.nom || "Aliment");
    content.innerHTML = `
      <button type="button" data-v43-action="edit">✏️ Modifier</button>
      <button type="button" data-v43-action="duplicate">⧉ Dupliquer</button>
      <div class="v43-move-block"><span>Déplacer vers</span>${MEALS.map((slot) => `<button type="button" data-v43-move="${esc(slot)}" ${slot === entry.repasSlot ? "disabled" : ""}>${esc(slot)}</button>`).join("")}</div>
      <button type="button" class="v43-danger-action" data-v43-action="delete">🗑️ Supprimer</button>`;

    content.querySelector('[data-v43-action="edit"]')?.addEventListener("click", () => {
      megaCloseOverlay(overlay);
      window.megaOpenJournalEditor?.(id);
    });
    content.querySelector('[data-v43-action="duplicate"]')?.addEventListener("click", () => {
      megaCloseOverlay(overlay);
      addClonedEntry(entry, entry.repasSlot);
      try { rafraichirApplication(); } catch {}
      showToast("Entrée dupliquée");
    });
    content.querySelectorAll("[data-v43-move]").forEach((button) => {
      button.addEventListener("click", () => {
        megaCloseOverlay(overlay);
        modifierEntreeJournal(id, { repasSlot: button.dataset.v43Move });
        showToast(`Déplacé vers ${button.dataset.v43Move}`);
      });
    });
    content.querySelector('[data-v43-action="delete"]')?.addEventListener("click", () => {
      if (!confirm("Supprimer cet aliment du journal ?")) return;
      megaCloseOverlay(overlay);
      supprimerEntreeJournal(id);
    });

    try { megaOpenOverlay(overlay); } catch {
      overlay.classList.add("ouverte");
      overlay.setAttribute("aria-hidden", "false");
    }
  }

  function syncHydrationFromJournal() {
    const a = account();
    const v = ensureState(a);
    if (!a || !v) return false;

    const previousAuto = Number(v.hydration.autoGlasses) || 0;
    const nextAuto = v.settings.waterJournalSync
      ? C.waterGlasses(C.waterFromJournalMl(a.journalCalories || []), v.settings.glassMl)
      : 0;

    if (Math.abs(previousAuto - nextAuto) < 0.001) return false;

    const total = Math.max(0, (Number(a.verresEau) || 0) - previousAuto + nextAuto);
    a.verresEau = Math.round(total * 4) / 4;
    v.hydration.autoGlasses = nextAuto;
    save();
    return true;
  }

  function showToast(message, actionLabel = "", action = null) {
    let toast = document.getElementById("v43-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "v43-toast";
      toast.className = "v43-toast";
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span>${esc(message)}</span>${actionLabel ? `<button type="button">${esc(actionLabel)}</button>` : ""}`;
    toast.classList.add("show");
    const button = toast.querySelector("button");
    if (button && action) {
      button.onclick = () => {
        toast.classList.remove("show");
        action();
      };
    }
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), actionLabel ? 6000 : 2600);
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderSmartTools, 60);
  }

  function installGlobalEvents() {
    document.addEventListener("click", (event) => {
      const repeat = event.target.closest("[data-v43-repeat]");
      if (repeat) {
        event.preventDefault();
        repeatYesterdayMeal(repeat.dataset.v43Repeat);
        return;
      }

      const saveMeal = event.target.closest("[data-v43-save-meal]");
      if (saveMeal) {
        event.preventDefault();
        saveMealTemplate(saveMeal.dataset.v43SaveMeal);
        return;
      }

      const menu = event.target.closest("[data-v43-entry-menu]");
      if (menu) {
        event.preventDefault();
        openEntryMenu(menu.dataset.v43EntryMenu);
      }
    });

    const journal = document.getElementById("px-journal-list");
    if (journal) {
      const observer = new MutationObserver(() => {
        if (!decorating) requestAnimationFrame(decorateJournal);
      });
      observer.observe(journal, { childList: true, subtree: true });
    }
  }

  ensureState();
  installMutationHooks();
  enrichSelectedFoodQuality();
  installFavoriteFoodCards();
  installPortionHook();
  ensurePortionPresetsUi();
  installGlobalEvents();
  snapshotToday();
  syncHydrationFromJournal();
  scheduleRender();

  window.WellnessDailyUX = {
    version: VERSION,
    refresh: renderSmartTools,
    snapshotToday,
    copyYesterday,
    repeatYesterdayMeal,
    syncHydrationFromJournal,
  };
})();
