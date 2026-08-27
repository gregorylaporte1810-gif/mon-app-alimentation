(() => {
  "use strict";

  const C = window.WellnessPolishCoreV51;
  const U = window.WellnessFoodUnits;
  if (!C) {
    console.error("[Wellness 5.1] polish core absent.");
    return;
  }

  const VERSION = "5.1.0";
  let observerTimer = 0;
  let searchReturnFocus = null;
  let onlineToastTimer = 0;

  const esc = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  function account() {
    try { return obtenirCompteActif(); } catch { return null; }
  }

  function ensureState(a = account()) {
    if (!a) return null;
    if (!a.v51 || typeof a.v51 !== "object") a.v51 = {};
    if (!a.v51.home || typeof a.v51.home !== "object") a.v51.home = {};
    a.v51.home = C.mergeHomePrefs(a.v51.home);
    if (!a.v51.ui || typeof a.v51.ui !== "object") a.v51.ui = {};
    return a.v51;
  }

  function save() {
    try { sauvegarderEtatApplication(); } catch {}
  }

  function journalTotals(a = account()) {
    try {
      if (window.WellnessSmartCoreV44?.journalTotals) {
        return window.WellnessSmartCoreV44.journalTotals(a?.journalCalories || []);
      }
    } catch {}
    return (a?.journalCalories || []).reduce((acc, entry) => {
      acc.calories += Number(entry.calories) || 0;
      acc.protein += Number(entry.proteines) || 0;
      acc.fiber += Number(entry.fibres) || 0;
      return acc;
    }, { calories: 0, protein: 0, fiber: 0 });
  }

  function currentSleep(a = account()) {
    try {
      const key = obtenirDateLocale();
      return Number(a?.w2?.dailyMetrics?.[key]?.sleepHours) || 0;
    } catch {
      return 0;
    }
  }

  function softHaptic(strength = 8) {
    const state = ensureState();
    if (state?.home?.haptics === false) return;
    try {
      if (typeof w2Haptic === "function") w2Haptic(strength);
    } catch {}
  }

  // =====================================================
  // OFFLINE / ONLINE
  // =====================================================

  function ensureNetworkPill() {
    let pill = document.getElementById("v51-network-pill");
    if (pill) return pill;
    pill = document.createElement("div");
    pill.id = "v51-network-pill";
    pill.className = "v51-network-pill";
    pill.setAttribute("role", "status");
    pill.setAttribute("aria-live", "polite");
    pill.hidden = true;
    document.body.appendChild(pill);
    return pill;
  }

  function renderNetworkState() {
    const pill = ensureNetworkPill();
    clearTimeout(onlineToastTimer);

    if (!navigator.onLine) {
      document.documentElement.classList.add("v51-offline");
      pill.hidden = false;
      pill.className = "v51-network-pill offline";
      pill.innerHTML = "<span>☁︎</span><strong>Mode hors ligne</strong><small>Données locales disponibles</small>";
      return;
    }

    const wasOffline = document.documentElement.classList.contains("v51-offline");
    document.documentElement.classList.remove("v51-offline");
    if (wasOffline) {
      pill.hidden = false;
      pill.className = "v51-network-pill online";
      pill.innerHTML = "<span>✓</span><strong>Connexion rétablie</strong>";
      onlineToastTimer = setTimeout(() => { pill.hidden = true; }, 1800);
    } else {
      pill.hidden = true;
    }
  }

  // =====================================================
  // UNIVERSAL SEARCH
  // =====================================================

  function recipesList() {
    try { return typeof recettes !== "undefined" && Array.isArray(recettes) ? recettes : []; }
    catch { return []; }
  }

  function foodResults(query) {
    try {
      return window.WellnessSmartV44?.searchFoods?.(query)?.slice(0, 6) || [];
    } catch {
      return [];
    }
  }

  function mealTemplates() {
    return account()?.v43?.mealTemplates || [];
  }

  function addTemplateEntries(template) {
    if (!template?.entries?.length) return;
    template.entries.forEach((entry) => {
      try {
        ajouterCaloriesAuJournal(
          entry.nom || template.name || "Repas",
          Number(entry.calories) || 1,
          entry.source || "manuel",
          {
            proteines: Number(entry.proteines) || 0,
            glucides: Number(entry.glucides) || 0,
            lipides: Number(entry.lipides) || 0,
            repasSlot: entry.repasSlot || template.slot || "Déjeuner",
            portions: Number(entry.portions) || 1,
            quantity: entry.quantity,
            unit: entry.unit,
          },
        );
      } catch {}
    });
    try { rafraichirApplication(); } catch {}
  }

  const settingsResults = [
    { label: "Mon objectif", keywords: "objectif calories poids macros", action: () => openProfileAndFocus("objectif") },
    { label: "Compte & profil", keywords: "profil compte informations", action: () => openProfileAndFocus("profil") },
    { label: "Notifications", keywords: "notification rappel", action: () => openProfileAndFocus("notification") },
    { label: "Sauvegarde et restauration", keywords: "backup sauvegarde restaurer export", action: () => openProfileAndFocus("sauvegarde") },
    { label: "Apple Santé", keywords: "apple sante healthkit iphone", action: () => openProfileAndFocus("apple") },
    { label: "Personnaliser Aujourd'hui", keywords: "accueil personnaliser cartes interface", action: openHomeCustomizer },
  ];

  function openProfileAndFocus(term = "") {
    document.querySelector("[data-page='profil']")?.click();
    setTimeout(() => {
      const normalized = C.normalize(term);
      const candidates = [...document.querySelectorAll("#page-profil section, #page-profil button, #page-profil h2, #page-profil h3")];
      const target = candidates.find((el) => C.normalize(el.textContent).includes(normalized));
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }

  function ensureSearchOverlay() {
    let overlay = document.getElementById("v51-search-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "v51-search-overlay";
    overlay.className = "modal-simple-overlay v51-search-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <section class="modal-simple v51-search-modal" role="dialog" aria-modal="true" aria-labelledby="v51-search-title">
        <div class="modal-simple-header">
          <div><p class="sur-titre">Wellness</p><h2 id="v51-search-title">Recherche universelle</h2></div>
          <button type="button" id="v51-search-close" class="fermer-modal-simple" aria-label="Fermer">✕</button>
        </div>
        <div class="v51-search-body">
          <label class="v51-search-field">
            <span aria-hidden="true">⌕</span>
            <input id="v51-search-input" type="search" autocomplete="off" placeholder="Aliment, recette, repas, réglage…">
          </label>
          <div id="v51-search-results" class="v51-search-results">
            <p class="v51-search-hint">Recherche dans les aliments, recettes, repas enregistrés et réglages.</p>
          </div>
        </div>
      </section>`;
    document.body.appendChild(overlay);

    const close = () => closeSearch();
    document.getElementById("v51-search-close")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    document.getElementById("v51-search-input")?.addEventListener("input", renderSearchResults);
    return overlay;
  }

  function openSearch(trigger = null) {
    searchReturnFocus = trigger || document.activeElement;
    const overlay = ensureSearchOverlay();
    try { megaOpenOverlay(overlay); } catch {
      overlay.classList.add("ouverte");
      overlay.setAttribute("aria-hidden", "false");
    }
    setTimeout(() => document.getElementById("v51-search-input")?.focus(), 60);
    softHaptic(6);
  }

  function closeSearch() {
    const overlay = document.getElementById("v51-search-overlay");
    if (!overlay) return;
    try { megaCloseOverlay(overlay); } catch {
      overlay.classList.remove("ouverte");
      overlay.setAttribute("aria-hidden", "true");
    }
    setTimeout(() => searchReturnFocus?.focus?.(), 30);
  }

  function renderSearchResults() {
    const input = document.getElementById("v51-search-input");
    const box = document.getElementById("v51-search-results");
    if (!input || !box) return;
    const query = input.value.trim();

    if (query.length < 2) {
      box.innerHTML = '<p class="v51-search-hint">Tape au moins 2 caractères.</p>';
      return;
    }

    const foods = foodResults(query);
    const recipes = recipesList()
      .map((recipe) => ({ recipe, score: C.universalMatchScore(`${recipe.nom} ${recipe.categorie || ""} ${recipe.typeRepas || ""}`, query) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((row) => row.recipe);
    const templates = mealTemplates()
      .map((template) => ({ template, score: C.universalMatchScore(`${template.name} ${template.slot || ""}`, query) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((row) => row.template);
    const settings = settingsResults
      .map((item) => ({ ...item, score: C.universalMatchScore(`${item.label} ${item.keywords}`, query) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    const section = (title, content) => content ? `<section><h3>${title}</h3>${content}</section>` : "";
    box.innerHTML = [
      section("Aliments", foods.map((food, index) => `<button type="button" data-v51-food="${index}"><span>🥗</span><div><strong>${esc(food.name)}</strong><small>${Math.round(Number(food.kcal) || 0)} kcal / 100 g</small></div></button>`).join("")),
      section("Recettes", recipes.map((recipe, index) => `<button type="button" data-v51-recipe="${index}"><span>🍲</span><div><strong>${esc(recipe.nom)}</strong><small>${esc(recipe.typeRepas || "Recette")} · ${Math.round(Number(recipe.calories) || 0)} kcal</small></div></button>`).join("")),
      section("Mes repas", templates.map((template, index) => `<button type="button" data-v51-template="${index}"><span>⚡</span><div><strong>${esc(template.name)}</strong><small>${esc(template.slot || "Repas")} · ${template.entries?.length || 0} éléments</small></div></button>`).join("")),
      section("Réglages", settings.map((item, index) => `<button type="button" data-v51-setting="${index}"><span>⚙️</span><div><strong>${esc(item.label)}</strong></div></button>`).join("")),
    ].join("") || '<p class="v51-search-hint">Aucun résultat.</p>';

    box.querySelectorAll("[data-v51-food]").forEach((button) => {
      button.addEventListener("click", () => {
        const food = foods[Number(button.dataset.v51Food)];
        closeSearch();
        if (food) setTimeout(() => { try { w2OpenPortion(food); } catch {} }, 80);
      });
    });

    box.querySelectorAll("[data-v51-recipe]").forEach((button) => {
      button.addEventListener("click", () => {
        const recipe = recipes[Number(button.dataset.v51Recipe)];
        closeSearch();
        document.querySelector("[data-page='recettes']")?.click();
        setTimeout(() => {
          try { afficherDetailRecette(recipe); } catch {}
          document.getElementById("detail-recette")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      });
    });

    box.querySelectorAll("[data-v51-template]").forEach((button) => {
      button.addEventListener("click", () => {
        const template = templates[Number(button.dataset.v51Template)];
        closeSearch();
        addTemplateEntries(template);
      });
    });

    box.querySelectorAll("[data-v51-setting]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = settings[Number(button.dataset.v51Setting)];
        closeSearch();
        setTimeout(() => item?.action?.(), 80);
      });
    });
  }

  function ensureHeaderSearchButtons() {
    document.querySelectorAll(".px-header").forEach((header) => {
      if (header.querySelector(".v51-search-trigger")) return;
      const bell = header.querySelector(".px-notification-trigger");
      if (!bell) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "v51-search-trigger";
      button.setAttribute("aria-label", "Recherche universelle");
      button.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5"></circle>
          <path d="m16 16 4 4"></path>
        </svg>`;
      button.addEventListener("click", () => openSearch(button));
      bell.insertAdjacentElement("beforebegin", button);
    });
  }

  // =====================================================
  // HOME CUSTOMIZATION + EVENING SUMMARY
  // =====================================================

  const homeSelectors = {
    score: ".px-score-card",
    stats: ".px-stat-grid",
    priorities: "#v44-priority-card",
    coach: ".px-coach-card",
    meals: ".px-meals-card",
    shortcuts: ".px-home-footer-grid",
    evening: "#v51-evening-summary",
  };

  function applyHomePrefs() {
    const state = ensureState();
    if (!state) return;
    Object.entries(homeSelectors).forEach(([key, selector]) => {
      document.querySelectorAll(`#page-accueil ${selector}`).forEach((el) => {
        el.dataset.v51HomeHidden = state.home[key] === false ? "true" : "false";
      });
    });
    document.documentElement.classList.toggle("v51-motion-off", state.home.animations === false);
  }

  function ensureCustomizerOverlay() {
    let overlay = document.getElementById("v51-customizer-overlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "v51-customizer-overlay";
    overlay.className = "modal-simple-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <section class="modal-simple v51-customizer-modal" role="dialog" aria-modal="true" aria-labelledby="v51-customizer-title">
        <div class="modal-simple-header">
          <div><p class="sur-titre">Aujourd'hui</p><h2 id="v51-customizer-title">Personnaliser l'accueil</h2></div>
          <button type="button" id="v51-customizer-close" class="fermer-modal-simple" aria-label="Fermer">✕</button>
        </div>
        <div id="v51-customizer-list" class="v51-customizer-list"></div>
        <div class="v51-customizer-actions">
          <button type="button" id="v51-preview-evening" class="bouton-secondaire">Aperçu du bilan du soir</button>
          <button type="button" id="v51-customizer-done">Terminé</button>
        </div>
      </section>`;
    document.body.appendChild(overlay);
    document.getElementById("v51-customizer-close")?.addEventListener("click", closeCustomizer);
    document.getElementById("v51-customizer-done")?.addEventListener("click", closeCustomizer);
    document.getElementById("v51-preview-evening")?.addEventListener("click", () => {
      sessionStorage.setItem("wellness-v51-evening-preview", String(Date.now() + 5 * 60 * 1000));
      closeCustomizer();
      document.querySelector("[data-page='accueil']")?.click();
      setTimeout(() => {
        renderEveningSummary();
        document.getElementById("v51-evening-summary")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    });
    return overlay;
  }

  function renderCustomizer() {
    const state = ensureState();
    const list = document.getElementById("v51-customizer-list");
    if (!state || !list) return;
    const options = [
      ["score", "Score bien-être", "Le grand score du jour"],
      ["stats", "Stats rapides", "Calories, protéines, eau et pas"],
      ["priorities", "Priorités", "Les 3 actions les plus utiles maintenant"],
      ["coach", "Conseil du coach", "Conseil court et contextuel"],
      ["meals", "Repas du jour", "Petit-déjeuner, déjeuner et dîner"],
      ["shortcuts", "Défis / série / roue", "Raccourcis de motivation"],
      ["evening", "Bilan du soir", "Résumé automatique après 18 h"],
      ["animations", "Animations", "Transitions discrètes et premium"],
      ["haptics", "Retours haptiques", "Petits retours sur les actions importantes"],
    ];
    list.innerHTML = options.map(([key, label, help]) => `
      <label>
        <span><strong>${label}</strong><small>${help}</small></span>
        <input type="checkbox" data-v51-pref="${key}" ${state.home[key] !== false ? "checked" : ""}>
      </label>`).join("");
    list.querySelectorAll("[data-v51-pref]").forEach((input) => {
      input.addEventListener("change", () => {
        state.home[input.dataset.v51Pref] = input.checked;
        save();
        applyHomePrefs();
        renderEveningSummary();
      });
    });
  }

  function openHomeCustomizer() {
    const overlay = ensureCustomizerOverlay();
    renderCustomizer();
    try { megaOpenOverlay(overlay); } catch {
      overlay.classList.add("ouverte");
      overlay.setAttribute("aria-hidden", "false");
    }
  }

  function closeCustomizer() {
    const overlay = document.getElementById("v51-customizer-overlay");
    if (!overlay) return;
    try { megaCloseOverlay(overlay); } catch {
      overlay.classList.remove("ouverte");
      overlay.setAttribute("aria-hidden", "true");
    }
  }

  function ensureCustomizerCard() {
    const profile = document.querySelector("#page-profil .px-screen");
    if (!profile || document.getElementById("v51-customize-card")) return;
    const card = document.createElement("button");
    card.id = "v51-customize-card";
    card.type = "button";
    card.className = "v51-customize-card px-card";
    card.innerHTML = `<span>✨</span><div><small>INTERFACE</small><strong>Personnaliser Aujourd'hui</strong><p>Choisis les blocs vraiment utiles pour toi.</p></div><em>›</em>`;
    card.addEventListener("click", openHomeCustomizer);
    const health = document.getElementById("v5-health-card");
    if (health) health.insertAdjacentElement("afterend", card);
    else profile.insertAdjacentElement("afterbegin", card);
  }

  function ensureEveningCard() {
    const home = document.querySelector("#page-accueil .px-home-screen");
    if (!home) return null;
    let card = document.getElementById("v51-evening-summary");
    if (card) return card;
    card = document.createElement("section");
    card.id = "v51-evening-summary";
    card.className = "v51-evening-summary px-card";
    const footer = home.querySelector(".px-home-footer-grid");
    if (footer) footer.insertAdjacentElement("beforebegin", card);
    else home.appendChild(card);
    return card;
  }

  function renderEveningSummary() {
    const state = ensureState();
    const card = ensureEveningCard();
    if (!state || !card) return;
    const previewUntil = Number(sessionStorage.getItem("wellness-v51-evening-preview")) || 0;
    const forced = previewUntil > Date.now();
    const visible = state.home.evening !== false && C.shouldShowEveningSummary(new Date().getHours(), forced);
    card.hidden = !visible;
    card.dataset.v51HomeHidden = state.home.evening === false ? "true" : "false";
    if (!visible) return;

    const a = account();
    if (!a) return;
    const goals = a.v44?.customGoals || {};
    const summary = C.eveningSummary({
      account: a,
      totals: journalTotals(a),
      goals,
      sleepHours: currentSleep(a),
    });

    card.innerHTML = `
      <div class="v51-section-head"><div><small>BILAN DU JOUR</small><strong>Ta journée en un coup d'œil</strong></div><span>🌙</span></div>
      <div class="v51-evening-kpis">${summary.items.map((item) => `
        <div><span>${item.label}</span><strong>${item.value}${item.unit ? ` ${item.unit}` : ""}</strong><small>${item.target ? `repère ${item.target}${item.unit ? ` ${item.unit}` : ""}` : ""}</small></div>`).join("")}</div>
      <div class="v51-evening-tips">${summary.tips.length ? summary.tips.map((tip) => `<p>• ${esc(tip)}</p>`).join("") : "<p>✓ Tes principaux repères sont bien avancés aujourd'hui.</p>"}</div>`;
  }

  // =====================================================
  // CONTEXTUAL NAVIGATION
  // =====================================================

  function navigateNutrition(target = "remaining") {
    document.querySelector("[data-page='recettes']")?.click();
    setTimeout(() => {
      const selector = target === "quality" ? "#v43-quality-card" : "#v43-remaining-card";
      document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }

  function installContextualNavigation() {
    document.addEventListener("click", (event) => {
      const priority = event.target.closest(".v44-priority-list > div");
      if (priority) {
        const text = C.normalize(priority.textContent);
        if (text.includes("protein") || text.includes("proteine") || text.includes("kcal") || text.includes("calorie")) navigateNutrition("remaining");
        else if (text.includes("fibre")) navigateNutrition("quality");
        else if (text.includes("pas")) document.querySelector("[data-ux-action='steps']")?.click();
        else if (text.includes("sommeil")) {
          document.querySelector("[data-page='suivi']")?.click();
          setTimeout(() => {
            [...document.querySelectorAll("#page-suivi section, #page-suivi button")].find((el) => C.normalize(el.textContent).includes("sommeil"))?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 120);
        }
      }

      const foodStat = event.target.closest("#page-accueil [data-ux-action='food']");
      if (foodStat) {
        event.preventDefault();
        event.stopImmediatePropagation();
        navigateNutrition("remaining");
      }
    }, true);
  }

  // =====================================================
  // GRAPH POLISH
  // =====================================================

  function cleanupGraphLabels() {
    const axes = document.querySelectorAll(".px-chart-axis, .mega-chart-axis, .w2-chart-axis, [class*='chart-axis']");
    axes.forEach((axis) => {
      const labels = [...axis.querySelectorAll("span")];
      if (labels.length < 2) return;
      const hide = C.labelsToHide(labels.map((label) => label.textContent));
      labels.forEach((label, index) => {
        label.classList.toggle("v51-axis-duplicate", !!hide[index]);
        if (hide[index]) label.setAttribute("aria-hidden", "true");
        else label.removeAttribute("aria-hidden");
      });
    });
  }

  // =====================================================
  // EMPTY STATES
  // =====================================================

  function candidateActionForEmpty(node) {
    const card = node.closest("section, .px-card, .modal-simple, .carte, .w2-panel") || node.parentElement;
    if (!card) return null;
    const buttons = [...card.querySelectorAll("button")].filter((button) =>
      button !== node &&
      !button.disabled &&
      /ajouter|créer|creer|scanner|enregistrer|nouveau/i.test(button.textContent || "")
    );
    if (buttons[0]) return { type: "button", element: buttons[0] };
    const input = card.querySelector("input:not([type='hidden']):not(:disabled), textarea:not(:disabled), select:not(:disabled)");
    return input ? { type: "focus", element: input } : null;
  }

  function enhanceEmptyStates() {
    const nodes = document.querySelectorAll(".message-vide, .mega-help, .v43-empty-note, .v44-empty");
    nodes.forEach((node) => {
      if (node.dataset.v51EmptyEnhanced === "true") return;
      const label = C.emptyStateAction(node.textContent);
      if (!label) return;
      const action = candidateActionForEmpty(node);

      if (!action && (C.normalize(node.textContent).includes("aliment") || node.closest("#v43-quick-content"))) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "v51-empty-action";
        button.textContent = "Rechercher un aliment";
        button.addEventListener("click", () => openSearch(button));
        node.insertAdjacentElement("afterend", button);
        node.dataset.v51EmptyEnhanced = "true";
        return;
      }

      if (!action) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "v51-empty-action";
      button.textContent = label;
      button.addEventListener("click", () => {
        if (action.type === "button") action.element.click();
        else {
          action.element.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => action.element.focus(), 180);
        }
      });
      node.insertAdjacentElement("afterend", button);
      node.dataset.v51EmptyEnhanced = "true";
    });
  }

  // =====================================================
  // ACCESSIBILITY + MICRO INTERACTIONS
  // =====================================================

  function enhanceA11y() {
    document.querySelectorAll("button").forEach((button) => {
      if (button.getAttribute("aria-label") || (button.textContent || "").trim()) return;
      const title = button.getAttribute("title");
      if (title) button.setAttribute("aria-label", title);
    });

    document.querySelectorAll(".v44-priority-list > div").forEach((item) => {
      if (!item.hasAttribute("tabindex")) {
        item.tabIndex = 0;
        item.setAttribute("role", "button");
        item.setAttribute("aria-label", `Ouvrir : ${(item.textContent || "").trim()}`);
        item.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            item.click();
          }
        });
      }
    });
  }

  function installMicroInteractions() {
    document.addEventListener("click", (event) => {
      const target = event.target.closest(
        "[data-page], .px-meal-check-row, [data-water-adjust], [data-journal-slot], .v51-search-trigger, .v51-empty-action"
      );
      if (!target) return;
      softHaptic(target.matches(".px-meal-check-row, [data-water-adjust]") ? 12 : 6);
      if (target.matches(".px-meal-check-row")) {
        target.classList.remove("v51-tap-pop");
        requestAnimationFrame(() => target.classList.add("v51-tap-pop"));
        setTimeout(() => target.classList.remove("v51-tap-pop"), 320);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (document.getElementById("v51-search-overlay")?.classList.contains("ouverte")) closeSearch();
        if (document.getElementById("v51-customizer-overlay")?.classList.contains("ouverte")) closeCustomizer();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    });
  }

  // =====================================================
  // RENDER / OBSERVER
  // =====================================================

  function renderAll() {
    ensureState();
    ensureHeaderSearchButtons();
    ensureCustomizerCard();
    renderEveningSummary();
    applyHomePrefs();
    cleanupGraphLabels();
    enhanceEmptyStates();
    enhanceA11y();
  }

  const observer = new MutationObserver(() => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(renderAll, 120);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("online", renderNetworkState);
  window.addEventListener("offline", renderNetworkState);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") renderAll();
  });

  installContextualNavigation();
  installMicroInteractions();
  renderNetworkState();
  renderAll();
  setTimeout(renderAll, 500);

  window.WellnessPolishV51 = {
    version: VERSION,
    refresh: renderAll,
    openSearch,
    openHomeCustomizer,
  };
})();
