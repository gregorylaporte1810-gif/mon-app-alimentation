(() => {
  "use strict";

  const U = window.WellnessFoodUnits;
  if (!U) {
    console.error("[Wellness 4.2] food-units-core.js absent.");
    return;
  }

  const localFoods = window.WELLNESS_FOODS || [];
  let selectedRemoteSearchToken = 0;
  let remoteTimer = 0;

  localFoods.forEach((food) => {
    if (!food.basisQuantity) food.basisQuantity = 100;
    if (!food.basisUnit) food.basisUnit = "g";
    if (food.liquid == null) food.liquid = U.inferLiquid(food);
    if (!food.density) food.density = U.inferDensity(food);
    if (!food.pieceWeight) food.pieceWeight = U.inferPieceWeight(food);
  });

  function scoreFood(food, query) {
    if (!query) return 1;
    const q = U.normalizeText(query);
    const name = U.normalizeText(food.name);
    const haystack = U.normalizeText(`${food.name} ${food.category || ""} ${food.subcategory || ""} ${food.brand || ""}`);
    if (name === q) return 1000;
    if (name.startsWith(q)) return 700;
    if (name.includes(q)) return 500;
    const tokens = q.split(" ").filter(Boolean);
    const hits = tokens.filter((token) => haystack.includes(token)).length;
    if (hits === tokens.length) return 300 + hits * 20;
    if (hits) return hits * 40;
    return 0;
  }

  function searchLocal(query = "") {
    if (window.WellnessSmartV44?.searchFoods) {
      return window.WellnessSmartV44.searchFoods(query);
    }
    return localFoods
      .map((food) => ({ food, score: scoreFood(food, query) }))
      .filter((row) => !query || row.score > 0)
      .sort((a, b) => b.score - a.score || String(a.food.name).localeCompare(String(b.food.name), "fr"))
      .slice(0, 36)
      .map((row) => row.food);
  }

  if (typeof w2SearchFoods === "function") {
    w2SearchFoods = searchLocal;
  }

  function sourceLabel(food) {
    if (food.sourceDatabase === "Ciqual 2025" || String(food.source || "").includes("Ciqual")) return "Ciqual 2025";
    if (String(food.source || "").includes("Open Food Facts")) return "Open Food Facts";
    return food.sourceDatabase || "Wellness";
  }

  if (typeof w2RenderFoodCards === "function") {
    w2RenderFoodCards = function wellness42RenderFoodCards(container, foods) {
      if (!container) return;
      container.innerHTML = "";
      if (!foods.length) {
        container.innerHTML = '<p class="message-vide">Aucun aliment trouvé.</p>';
        return;
      }
      foods.forEach((food) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "w2-food-card v42-food-card";
        const basis = food.basisUnit === "ml" ? "100 ml" : "100 g";
        card.innerHTML = `
          <span class="w2-food-category">${w2Escape(food.category || "Aliment")}</span>
          <strong>${w2Escape(food.name)}</strong>
          <span class="w2-food-kcal">${Math.round(Number(food.kcal) || 0)} kcal / ${basis}</span>
          <small>P ${U.round1(food.protein)} g · G ${U.round1(food.carbs)} g · L ${U.round1(food.fat)} g${Number(food.fiber) ? ` · Fibres ${U.round1(food.fiber)} g` : ""}</small>
          <em class="v42-food-source">${w2Escape(sourceLabel(food))}</em>`;
        card.addEventListener("click", () => w2OpenPortion(food));
        container.appendChild(card);
      });
    };
  }

  async function searchOpenFoodFacts(query) {
    const q = String(query || "").trim();
    if (q.length < 2 || !navigator.onLine) return [];
    const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    url.searchParams.set("search_terms", q);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "12");
    url.searchParams.set("fields", "code,product_name,brands,nutriments,categories_tags,serving_size,quantity");
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return (data.products || [])
      .filter((p) => p?.product_name && p?.nutriments)
      .map((p) => {
        const n = p.nutriments || {};
        const name = p.product_name;
        const category = p.brands || "Produit";
        return {
          id: `off-${p.code || Math.random().toString(36).slice(2)}`,
          name,
          category,
          brand: p.brands || "",
          kcal: Number(n["energy-kcal_100g"]) || 0,
          protein: Number(n.proteins_100g) || 0,
          carbs: Number(n.carbohydrates_100g) || 0,
          fat: Number(n.fat_100g) || 0,
          fiber: Number(n.fiber_100g) || 0,
          sugars: Number(n.sugars_100g) || 0,
          saturatedFat: Number(n["saturated-fat_100g"]) || 0,
          salt: Number(n.salt_100g) || 0,
          basisQuantity: 100,
          basisUnit: "g",
          liquid: U.inferLiquid({ name, category }),
          density: U.inferDensity({ name, category }),
          source: "Open Food Facts",
          sourceDatabase: "Open Food Facts",
        };
      });
  }

  function mergeFoodResults(local, remote) {
    const seen = new Set();
    return [...local, ...remote].filter((food) => {
      const key = U.normalizeText(`${food.name}|${food.brand || food.category || ""}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 48);
  }

  function installSearchEnhancement(inputId, containerId) {
    const input = document.getElementById(inputId);
    const container = document.getElementById(containerId);
    if (!input || !container) return;

    input.addEventListener("input", () => {
      clearTimeout(remoteTimer);
      const query = input.value;
      const local = searchLocal(query);
      w2RenderFoodCards(container, local);
      if (query.trim().length < 2) return;

      const token = ++selectedRemoteSearchToken;
      remoteTimer = window.setTimeout(async () => {
        try {
          const remote = await searchOpenFoodFacts(query);
          if (token !== selectedRemoteSearchToken || input.value !== query) return;
          w2RenderFoodCards(container, mergeFoodResults(local, remote));
        } catch {
          // La base locale Ciqual continue de fonctionner hors ligne.
        }
      }, 380);
    });
  }

  function ensureFoodDbInfo() {
    ["w2-food-query", "w2-modal-food-query"].forEach((id) => {
      const input = document.getElementById(id);
      if (!input || input.parentElement?.querySelector(".v42-fooddb-info")) return;
      const p = document.createElement("p");
      p.className = "v42-fooddb-info";
      const ciqualCount = Number(window.CIQUAL_FOODS?.length || 0);
      p.textContent = `${ciqualCount.toLocaleString("fr-FR")} aliments Ciqual hors ligne · produits Open Food Facts en ligne`;
      input.insertAdjacentElement("afterend", p);
    });
  }

  function ensurePortionUnitUi() {
    const input = document.getElementById("w2-portion-grams");
    const wrap = input?.closest(".w2-inline-unit");
    if (!input || !wrap) return null;

    const quantityLabel = document.querySelector('label[for="w2-portion-grams"]');
    if (quantityLabel) quantityLabel.textContent = "Quantité";
    const oldUnit = wrap.querySelector("span");
    if (oldUnit) oldUnit.hidden = true;

    let select = document.getElementById("w2-portion-unit");
    if (!select) {
      select = document.createElement("select");
      select.id = "w2-portion-unit";
      select.className = "v42-unit-select";
      wrap.appendChild(select);
      select.addEventListener("change", () => {
        renderUnitChoices();
        w2UpdatePortionPreview();
      });
    }

    let pieceRow = document.getElementById("w2-piece-weight-row");
    if (!pieceRow) {
      pieceRow = document.createElement("label");
      pieceRow.id = "w2-piece-weight-row";
      pieceRow.className = "v42-piece-weight-row";
      pieceRow.hidden = true;
      pieceRow.innerHTML = `<span>Poids d'une unité</span><div class="w2-inline-unit"><input id="w2-piece-weight" type="number" min="0.1" step="0.1" inputmode="decimal"><span>g</span></div>`;
      wrap.parentElement.insertBefore(pieceRow, document.querySelector(".w2-portion-shortcuts"));
      document.getElementById("w2-piece-weight")?.addEventListener("input", w2UpdatePortionPreview);
    }

    input.addEventListener("input", w2UpdatePortionPreview);
    return select;
  }

  function renderUnitChoices() {
    const select = document.getElementById("w2-portion-unit");
    const food = typeof w2SelectedFood !== "undefined" ? w2SelectedFood : null;
    if (!select || !food) return;

    const current = select.value;
    const labels = { g: "g", kg: "kg", ml: "ml", cl: "cl", l: "L", unit: "unité" };
    const units = U.allowedUnits(food);
    select.innerHTML = units.map((unit) => `<option value="${unit}">${labels[unit]}</option>`).join("");
    select.value = units.includes(current) ? current : (food.liquid ? "ml" : "g");

    const pieceRow = document.getElementById("w2-piece-weight-row");
    const pieceInput = document.getElementById("w2-piece-weight");
    if (pieceRow) pieceRow.hidden = select.value !== "unit";
    if (pieceInput && select.value === "unit" && !pieceInput.value) {
      pieceInput.value = U.inferPieceWeight(food) || "";
    }

    const presets = {
      g: [[50, "50 g"], [100, "100 g"], [150, "150 g"], [200, "200 g"]],
      kg: [[0.1, "100 g"], [0.25, "250 g"], [0.5, "500 g"], [1, "1 kg"]],
      ml: [[100, "100 ml"], [250, "250 ml"], [330, "330 ml"], [500, "500 ml"]],
      cl: [[10, "10 cl"], [25, "25 cl"], [33, "33 cl"], [50, "50 cl"]],
      l: [[0.25, "0,25 L"], [0.5, "0,5 L"], [0.75, "0,75 L"], [1, "1 L"]],
      unit: [[1, "1 unité"], [2, "2 unités"], [3, "3 unités"], [4, "4 unités"]],
    };
    document.querySelectorAll("#w2-portion-overlay [data-grams]").forEach((button, index) => {
      const preset = presets[select.value]?.[index];
      if (!preset) return;
      button.dataset.grams = String(preset[0]);
      button.textContent = preset[1];
    });
  }

  const originalOpenPortion = typeof w2OpenPortion === "function" ? w2OpenPortion : null;
  if (originalOpenPortion) {
    w2OpenPortion = function wellness42OpenPortion(food) {
      w2SelectedFood = food;
      ensurePortionUnitUi();
      document.getElementById("w2-portion-title").textContent = food.name;
      const input = document.getElementById("w2-portion-grams");
      if (input) input.value = food.liquid ? "250" : "100";
      const unit = document.getElementById("w2-portion-unit");
      if (unit) unit.value = food.liquid ? "ml" : "g";
      const piece = document.getElementById("w2-piece-weight");
      if (piece) piece.value = U.inferPieceWeight(food) || "";
      renderUnitChoices();
      w2UpdatePortionPreview();
      megaOpenOverlay(document.getElementById("w2-portion-overlay"));
      w2Haptic();
    };
  }

  if (typeof w2UpdatePortionPreview === "function") {
    w2UpdatePortionPreview = function wellness42UpdatePortionPreview() {
      if (!w2SelectedFood) return;
      const value = Number(document.getElementById("w2-portion-grams")?.value);
      const unit = document.getElementById("w2-portion-unit")?.value || "g";
      const pieceWeight = Number(document.getElementById("w2-piece-weight")?.value) || null;
      const n = U.scaleFood(w2SelectedFood, value, unit, pieceWeight);
      const preview = document.getElementById("w2-portion-preview");
      if (!preview) return;
      if (!n) {
        preview.innerHTML = `<strong>${w2Escape(w2SelectedFood.name)}</strong><span>Renseigne une quantité valide${unit === "unit" ? " et le poids d'une unité" : ""}.</span>`;
        return;
      }
      const approx = n.approximateVolume ? " · conversion volume ↔ poids approximative" : "";
      preview.innerHTML = `<strong>${w2Escape(w2SelectedFood.name)} · ${U.formatQuantity(value, unit)}</strong><span>${n.calories} kcal · P ${n.protein} g · G ${n.carbs} g · L ${n.fat} g${n.fiber ? ` · Fibres ${n.fiber} g` : ""}${approx}</span>`;
    };
  }

  if (typeof w2AddSelectedFood === "function") {
    w2AddSelectedFood = function wellness42AddSelectedFood() {
      if (!w2SelectedFood) return;
      const value = Number(document.getElementById("w2-portion-grams")?.value);
      const unit = document.getElementById("w2-portion-unit")?.value || "g";
      const pieceWeight = Number(document.getElementById("w2-piece-weight")?.value) || null;
      const meal = document.getElementById("w2-portion-meal")?.value || "Déjeuner";
      const n = U.scaleFood(w2SelectedFood, value, unit, pieceWeight);
      if (!n) return;

      const account = obtenirCompteActif();
      const beforeIds = new Set((account.journalCalories || []).map((entry) => entry.id));
      const displayName = `${U.stripQuantitySuffix(w2SelectedFood.name)} (${U.formatQuantity(value, unit)})`;
      const ok = ajouterCaloriesAuJournal(displayName, n.calories, "aliment", {
        proteines: n.protein,
        glucides: n.carbs,
        lipides: n.fat,
        repasSlot: meal,
        portions: n.referenceAmount / 100,
      });

      if (!ok) return;
      const entry = [...account.journalCalories].reverse().find((item) => !beforeIds.has(item.id));
      if (entry) {
        Object.assign(entry, {
          quantity: value,
          unit,
          referenceAmount: n.referenceAmount,
          basisUnit: w2SelectedFood.basisUnit || "g",
          basisQuantity: Number(w2SelectedFood.basisQuantity) || 100,
          density: n.density,
          pieceWeight: n.pieceWeight,
          foodId: w2SelectedFood.id || null,
          sourceDatabase: sourceLabel(w2SelectedFood),
        });
        sauvegarderEtatApplication();
      }

      megaCloseOverlay(document.getElementById("w2-portion-overlay"));
      w2AwardXpOnce(`food|${w2Today()}|${Date.now()}`, 2);
      rafraichirApplication();
      w2Haptic(25);
    };
  }

  // Le listener historique a été enregistré avant la surcharge ci-dessus.
  // Un listener en capture prend donc la main et évite un double ajout.
  document.getElementById("w2-add-portion")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    w2AddSelectedFood();
  }, true);

  // Enrichit l'ajout manuel du journal avec une quantité et une unité.
  function installManualQuantityFields() {
    const caloriesInput = document.getElementById("input-calories");
    if (!caloriesInput || document.getElementById("v42-manual-quantity")) return;
    const grid = document.createElement("div");
    grid.className = "v42-manual-quantity-grid";
    grid.innerHTML = `
      <label><span>Quantité <small>(facultatif)</small></span><input id="v42-manual-quantity" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Ex : 250"></label>
      <label><span>Unité</span><select id="v42-manual-unit"><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="cl">cl</option><option value="l">L</option><option value="unit">unité</option></select></label>`;
    caloriesInput.parentElement.insertBefore(grid, caloriesInput.previousElementSibling);
  }

  const originalAddJournal = typeof ajouterCaloriesAuJournal === "function" ? ajouterCaloriesAuJournal : null;
  if (originalAddJournal) {
    ajouterCaloriesAuJournal = function wellness42AddJournal(name, calories, source = "manuel", extras = {}) {
      const account = obtenirCompteActif();
      const beforeIds = new Set((account.journalCalories || []).map((entry) => entry.id));
      let quantity = Number(extras.quantity);
      let unit = extras.unit;

      if (source === "manuel" && !Number.isFinite(quantity)) {
        quantity = Number(document.getElementById("v42-manual-quantity")?.value);
        unit = document.getElementById("v42-manual-unit")?.value || "g";
      }

      let finalName = name;
      if (source === "manuel" && Number.isFinite(quantity) && quantity > 0) {
        finalName = `${U.stripQuantitySuffix(name || "Ajout manuel")} (${U.formatQuantity(quantity, unit)})`;
      }

      const ok = originalAddJournal(finalName, calories, source, extras);
      if (!ok) return false;

      const entry = [...account.journalCalories].reverse().find((item) => !beforeIds.has(item.id));
      if (entry && Number.isFinite(quantity) && quantity > 0) {
        entry.quantity = quantity;
        entry.unit = unit || "g";
        entry.referenceAmount = quantity;
        entry.basisUnit = U.unitFamily(entry.unit) === "volume" ? "ml" : U.unitFamily(entry.unit) === "mass" ? "g" : "unit";
        entry.basisQuantity = quantity;
        sauvegarderEtatApplication();
      }

      if (source === "manuel") {
        const q = document.getElementById("v42-manual-quantity");
        if (q) q.value = "";
      }
      return true;
    };
  }

  // Editeur du journal : g, kg, ml, cl, L ou unités.
  const originalEditorOpen = window.megaOpenJournalEditor;
  const originalEditorScale = typeof megaScaleJournalEditFromQuantity === "function" ? megaScaleJournalEditFromQuantity : null;
  const originalEditorSave = typeof megaSaveJournalEdit === "function" ? megaSaveJournalEdit : null;

  function ensureEditorUnitUi() {
    const wrap = document.getElementById("mega-journal-edit-quantity-wrap");
    const input = document.getElementById("mega-journal-edit-quantity");
    if (!wrap || !input) return;
    let select = document.getElementById("mega-journal-edit-unit");
    if (!select) {
      select = document.createElement("select");
      select.id = "mega-journal-edit-unit";
      select.className = "v42-unit-select";
      select.innerHTML = `<option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="cl">cl</option><option value="l">L</option><option value="unit">unité</option>`;
      wrap.appendChild(select);
      select.addEventListener("change", () => megaScaleJournalEditFromQuantity());
    }
  }

  function editorFactor() {
    if (!megaJournalEditState?.v42) return null;
    const state = megaJournalEditState.v42;
    const quantity = Number(document.getElementById("mega-journal-edit-quantity")?.value);
    const unit = document.getElementById("mega-journal-edit-unit")?.value || state.unit;
    if (!Number.isFinite(quantity) || quantity <= 0) return null;

    if (state.source === "aliment") {
      const reference = U.toReferenceAmount(quantity, unit, {
        basisUnit: state.basisUnit,
        density: state.density,
        pieceWeight: state.pieceWeight,
      }, state.pieceWeight);
      if (!reference || !state.referenceBase) return null;
      return reference / state.referenceBase;
    }

    if (!state.quantityBase) return null;
    return quantity / state.quantityBase;
  }

  megaScaleJournalEditFromQuantity = function wellness42ScaleJournalEditor() {
    if (!megaJournalEditState?.v42) {
      originalEditorScale?.();
      return;
    }
    const factor = editorFactor();
    if (!factor) return;
    const put = (id, base, decimals = 1) => {
      const input = document.getElementById(id);
      if (!input) return;
      input.value = decimals === 0
        ? String(Math.max(1, Math.round(base * factor)))
        : String(Math.round(base * factor * 10) / 10);
    };
    put("mega-journal-edit-kcal", megaJournalEditState.caloriesBase, 0);
    put("mega-journal-edit-protein", megaJournalEditState.proteinBase);
    put("mega-journal-edit-carbs", megaJournalEditState.carbsBase);
    put("mega-journal-edit-fat", megaJournalEditState.fatBase);
  };

  megaSaveJournalEdit = function wellness42SaveJournalEditor() {
    if (!megaJournalEditState?.v42 || megaJournalEditState.source === "recette") {
      originalEditorSave?.();
      return;
    }

    const message = document.getElementById("mega-journal-edit-message");
    const quantity = Number(document.getElementById("mega-journal-edit-quantity")?.value);
    const unit = document.getElementById("mega-journal-edit-unit")?.value || "g";
    const calories = Number(document.getElementById("mega-journal-edit-kcal")?.value);
    const protein = Number(document.getElementById("mega-journal-edit-protein")?.value || 0);
    const carbs = Number(document.getElementById("mega-journal-edit-carbs")?.value || 0);
    const fat = Number(document.getElementById("mega-journal-edit-fat")?.value || 0);
    let name = document.getElementById("mega-journal-edit-name")?.value.trim() || "Ajout manuel";

    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(calories) || calories <= 0 ||
        [protein, carbs, fat].some((v) => !Number.isFinite(v) || v < 0)) {
      if (message) message.textContent = "⚠️ Vérifie la quantité, les calories et les macros.";
      return;
    }

    const state = megaJournalEditState.v42;
    const referenceAmount = state.source === "aliment"
      ? U.toReferenceAmount(quantity, unit, {
          basisUnit: state.basisUnit,
          density: state.density,
          pieceWeight: state.pieceWeight,
        }, state.pieceWeight)
      : quantity;

    const changes = {
      nom: `${U.stripQuantitySuffix(name)} (${U.formatQuantity(quantity, unit)})`,
      calories,
      proteines: protein,
      glucides: carbs,
      lipides: fat,
      repasSlot: document.getElementById("mega-journal-edit-meal")?.value || "Déjeuner",
      quantity,
      unit,
      referenceAmount,
      basisUnit: state.basisUnit,
      basisQuantity: state.basisQuantity,
      density: state.density,
      pieceWeight: state.pieceWeight,
    };
    if (state.source === "aliment" && referenceAmount) changes.portions = referenceAmount / 100;

    if (!modifierEntreeJournal(megaJournalEditState.id, changes)) {
      if (message) message.textContent = "⚠️ Impossible de modifier cet ajout.";
      return;
    }
    if (message) message.textContent = "✅ Journal corrigé.";
    if (typeof w2Haptic === "function") w2Haptic(20);
    setTimeout(() => megaCloseOverlay(document.getElementById("mega-journal-edit-overlay")), 220);
  };

  if (originalEditorOpen) {
    window.megaOpenJournalEditor = function wellness42OpenJournalEditor(entryId) {
      originalEditorOpen(entryId);
      const account = obtenirCompteActif();
      const entry = (account.journalCalories || []).find((item) => item.id === entryId);
      if (!entry) return;

      ensureEditorUnitUi();
      const wrap = document.getElementById("mega-journal-edit-quantity-wrap");
      const input = document.getElementById("mega-journal-edit-quantity");
      const select = document.getElementById("mega-journal-edit-unit");
      const label = document.getElementById("mega-journal-edit-quantity-label");

      if (entry.source === "recette") {
        if (select) select.hidden = true;
        return;
      }

      if (wrap) wrap.hidden = false;
      if (select) select.hidden = false;
      if (label) label.textContent = "Quantité";

      const storedUnit = entry.unit || "g";
      const storedQuantity = Number(entry.quantity) > 0
        ? Number(entry.quantity)
        : entry.source === "aliment"
          ? Math.max(1, (Number(entry.portions) || 1) * 100)
          : 1;

      if (input) input.value = String(storedQuantity);
      if (select) select.value = storedUnit;

      megaJournalEditState.quantityBase = storedQuantity;
      megaJournalEditState.v42 = {
        source: entry.source || "manuel",
        unit: storedUnit,
        quantityBase: storedQuantity,
        referenceBase: Number(entry.referenceAmount) > 0
          ? Number(entry.referenceAmount)
          : entry.source === "aliment"
            ? Math.max(1, (Number(entry.portions) || 1) * 100)
            : storedQuantity,
        basisUnit: entry.basisUnit || (U.unitFamily(storedUnit) === "volume" ? "ml" : "g"),
        basisQuantity: Number(entry.basisQuantity) || 100,
        density: Number(entry.density) || 1,
        pieceWeight: Number(entry.pieceWeight) || null,
      };
      document.getElementById("mega-journal-edit-name").value = U.stripQuantitySuffix(entry.nom || "Ajout manuel");
    };
  }

  // Remplace la recherche barcode pour conserver les métadonnées utiles aux unités.
  if (typeof w2LookupBarcode === "function") {
    w2LookupBarcode = async function wellness42LookupBarcode(code) {
      const value = String(code || "").trim();
      const result = document.getElementById("w2-barcode-result");
      if (!value) {
        result.innerHTML = '<p class="mega-inline-message">Saisis un code-barres.</p>';
        return;
      }
      result.innerHTML = '<p class="mega-help">Recherche du produit…</p>';
      try {
        const fields = "product_name,nutriments,serving_size,brands,categories_tags,quantity";
        const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(value)}.json?fields=${fields}`);
        const data = await response.json();
        if (!data?.product) {
          result.innerHTML = '<p class="mega-inline-message">Produit non trouvé dans Open Food Facts.</p>';
          return;
        }
        const p = data.product;
        const n = p.nutriments || {};
        const name = p.product_name || `Produit ${value}`;
        const category = p.brands || "Open Food Facts";
        const food = {
          id: `off-${value}`,
          name,
          category,
          kcal: Number(n["energy-kcal_100g"]) || 0,
          protein: Number(n.proteins_100g) || 0,
          carbs: Number(n.carbohydrates_100g) || 0,
          fat: Number(n.fat_100g) || 0,
          fiber: Number(n.fiber_100g) || 0,
          sugars: Number(n.sugars_100g) || 0,
          saturatedFat: Number(n["saturated-fat_100g"]) || 0,
          salt: Number(n.salt_100g) || 0,
          basisQuantity: 100,
          basisUnit: "g",
          liquid: U.inferLiquid({ name, category }),
          density: U.inferDensity({ name, category }),
          source: "Open Food Facts",
          sourceDatabase: "Open Food Facts",
        };
        result.innerHTML = `<div class="w2-barcode-product"><h3>${w2Escape(food.name)}</h3><p>${w2Escape(food.category)} · ${Math.round(food.kcal)} kcal / 100 g · P ${U.round1(food.protein)} · G ${U.round1(food.carbs)} · L ${U.round1(food.fat)}</p><button id="w2-add-barcode-product">Choisir la quantité</button></div>`;
        document.getElementById("w2-add-barcode-product")?.addEventListener("click", () => {
          w2OpenPortion(food);
          w2StopBarcodeCamera();
        });
        w2AwardXpOnce(`barcode|${w2Today()}|${value}`, 4);
        w2Haptic(25);
      } catch (err) {
        result.innerHTML = `<p class="mega-inline-message">Impossible d'interroger la base en ligne. Vérifie ta connexion. (${w2Escape(err.message)})</p>`;
      }
    };
  }

  installManualQuantityFields();
  ensurePortionUnitUi();
  ensureFoodDbInfo();
  installSearchEnhancement("w2-food-query", "w2-food-grid");
  installSearchEnhancement("w2-modal-food-query", "w2-modal-food-results");

  // Le premier rendu bénéficie immédiatement de la base Ciqual.
  try { w2RenderFoodHub(); } catch {}
})();


/* ======================================================
   WELLNESS V4.2.1 JOURNAL TODAY MEAL SYNC
====================================================== */
(() => {
  "use strict";

  const U = window.WellnessFoodUnits;
  const MEALS = ["Petit-déjeuner", "Déjeuner", "Dîner"];

  function ensureAutoState(account) {
    if (!account.repas || typeof account.repas !== "object") {
      account.repas = {
        "Petit-déjeuner": false,
        "Déjeuner": false,
        "Dîner": false,
      };
    }

    if (!account.repasAutoJournal || typeof account.repasAutoJournal !== "object") {
      account.repasAutoJournal = {
        "Petit-déjeuner": false,
        "Déjeuner": false,
        "Dîner": false,
      };
    }

    MEALS.forEach((meal) => {
      if (!(meal in account.repas)) account.repas[meal] = false;
      if (!(meal in account.repasAutoJournal)) account.repasAutoJournal[meal] = false;
    });

    return account.repasAutoJournal;
  }

  function syncMealsFromJournal({ refresh = false } = {}) {
    if (typeof obtenirCompteActif !== "function") return false;

    const account = obtenirCompteActif();
    if (!account) return false;

    const auto = ensureAutoState(account);
    const presence = U?.journalMealPresence
      ? U.journalMealPresence(account.journalCalories || [])
      : {
          "Petit-déjeuner": (account.journalCalories || []).some((entry) => entry.repasSlot === "Petit-déjeuner"),
          "Déjeuner": (account.journalCalories || []).some((entry) => entry.repasSlot === "Déjeuner"),
          "Dîner": (account.journalCalories || []).some((entry) => entry.repasSlot === "Dîner"),
        };

    let changed = false;

    MEALS.forEach((meal) => {
      if (presence[meal]) {
        if (account.repas[meal] !== true) {
          account.repas[meal] = true;
          changed = true;
        }
        if (auto[meal] !== true) {
          auto[meal] = true;
          changed = true;
        }
        return;
      }

      if (auto[meal] === true) {
        if (account.repas[meal] !== false) {
          account.repas[meal] = false;
          changed = true;
        }
        auto[meal] = false;
        changed = true;
      }
    });

    if (changed && typeof sauvegarderEtatApplication === "function") {
      sauvegarderEtatApplication();
    }

    if (changed && refresh && typeof rafraichirApplication === "function") {
      queueMicrotask(() => rafraichirApplication());
    }

    return changed;
  }

  function wrapMutation(name, refreshAfter) {
    const original = window[name];
    if (typeof original !== "function" || original.__wellnessMealSyncWrapped) return;

    const wrapped = function wellnessMealSyncMutation(...args) {
      const result = original.apply(this, args);
      if (result && typeof result.then === "function") {
        return result.then((value) => {
          if (value !== false) syncMealsFromJournal({ refresh: refreshAfter });
          return value;
        });
      }
      if (result !== false) syncMealsFromJournal({ refresh: refreshAfter });
      return result;
    };

    wrapped.__wellnessMealSyncWrapped = true;
    wrapped.__wellnessMealSyncOriginal = original;
    window[name] = wrapped;
  }

  wrapMutation("ajouterCaloriesAuJournal", false);
  wrapMutation("modifierEntreeJournal", true);
  wrapMutation("supprimerEntreeJournal", true);

  syncMealsFromJournal({ refresh: true });

  window.WellnessMealJournalSync = {
    sync: syncMealsFromJournal,
  };
})();
