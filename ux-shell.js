"use strict";

// ======================================================
// WELLNESS — SIMPLIFIED MOBILE INFORMATION ARCHITECTURE
// Keeps every existing feature/ID while reorganising the
// UI into 5 main destinations + contextual sub-navigation.
// This file runs before app.js so the legacy app can bind
// to the final DOM structure without feature regressions.
// ======================================================

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const UX_STORAGE_PREFIX = "wellnessUxTab:";
  const uxTabs = new Map();

  function make(tag, className = "", html = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html) node.innerHTML = html;
    return node;
  }

  function safeMove(node, parent) {
    if (node && parent) parent.appendChild(node);
  }

  function setHeading(page, eyebrow, title, subtitle) {
    const header = $(":scope > .header", page);
    if (!header) return;
    const eyebrowNode = $(".eyebrow", header);
    const h1 = $("h1", header);
    const paragraph = $("h1 + p", header) || $("p:last-of-type", header);
    if (eyebrowNode) eyebrowNode.textContent = eyebrow;
    if (h1) h1.textContent = title;
    if (paragraph) paragraph.textContent = subtitle;
  }

  function createTabs(group, page, tabs, defaultKey) {
    const header = $(":scope > .header", page);
    if (!header) return null;

    const shell = make("section", "ux-tab-shell");
    shell.dataset.uxGroup = group;

    const tablist = make("div", "ux-segmented-tabs");
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-label", `Navigation ${group}`);
    tablist.dataset.horizontalScroll = "true";

    const panels = make("div", "ux-tab-panels");
    const config = { buttons: {}, panels: {}, active: null };

    const activate = (key, { persist = true, focus = false } = {}) => {
      if (!config.panels[key]) return;
      config.active = key;

      Object.entries(config.panels).forEach(([panelKey, panel]) => {
        const active = panelKey === key;
        panel.hidden = !active;
        panel.classList.toggle("active", active);
        const button = config.buttons[panelKey];
        if (button) {
          button.classList.toggle("active", active);
          button.setAttribute("aria-selected", String(active));
          button.tabIndex = active ? 0 : -1;
        }
      });

      if (persist) {
        sessionStorage.setItem(`${UX_STORAGE_PREFIX}${group}`, key);
      }

      if (focus) config.buttons[key]?.focus({ preventScroll: true });
    };

    tabs.forEach(({ key, label, icon = "", helper = "" }) => {
      const button = make(
        "button",
        "ux-segmented-tab",
        `${icon ? `<span aria-hidden="true">${icon}</span>` : ""}<strong>${label}</strong>${helper ? `<small>${helper}</small>` : ""}`,
      );
      button.type = "button";
      button.dataset.uxTab = key;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", `ux-${group}-${key}`);

      const panel = make("div", "ux-tab-panel");
      panel.id = `ux-${group}-${key}`;
      panel.dataset.uxPanel = key;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-label", label);

      button.addEventListener("click", () => activate(key));

      config.buttons[key] = button;
      config.panels[key] = panel;
      tablist.appendChild(button);
      panels.appendChild(panel);
    });

    shell.append(tablist, panels);
    header.after(shell);

    config.activate = activate;
    uxTabs.set(group, config);

    const remembered = sessionStorage.getItem(`${UX_STORAGE_PREFIX}${group}`);
    activate(config.panels[remembered] ? remembered : defaultKey, { persist: false });
    return config;
  }

  function showTab(group, key, options = {}) {
    uxTabs.get(group)?.activate(key, options);
  }

  function moveGlobalOverlays() {
    [
      "modal-pas-overlay",
      "modal-repas-overlay",
      "modal-calories-overlay",
      "modal-filtres-overlay",
      "mega-custom-recipe-overlay",
    ].forEach((id) => {
      const overlay = document.getElementById(id);
      if (overlay) document.body.appendChild(overlay);
    });
  }

  function simplifyMainNavigation() {
    const nav = $(".navigation-principale");
    if (!nav) return;

    const favoritesButton = $("[data-page='favoris']", nav);
    favoritesButton?.remove();

    const labels = {
      accueil: "Aujourd'hui",
      recettes: "Nutrition",
      plan: "Plan",
      suivi: "Progrès",
      profil: "Moi",
    };

    Object.entries(labels).forEach(([page, label]) => {
      const button = $(`[data-page='${page}']`, nav);
      const small = button?.querySelector("small");
      if (small) small.textContent = label;
      if (button) button.setAttribute("aria-label", label);
    });
  }

  function addNutritionSummary(panel) {
    const summary = make(
      "section",
      "ux-nutrition-summary carte",
      `
        <div class="ux-summary-heading">
          <div>
            <p class="sur-titre">Aujourd'hui</p>
            <h2>Ton journal nutrition</h2>
          </div>
          <span class="mini-pill">Vue rapide</span>
        </div>
        <div class="ux-summary-grid">
          <div><span>🔥 Calories</span><strong id="ux-summary-calories">--</strong></div>
          <div><span>💪 Protéines</span><strong id="ux-summary-protein">--</strong></div>
          <div><span>🍽️ Repas</span><strong id="ux-summary-meals">--</strong></div>
        </div>
        <div class="ux-inline-actions">
          <button type="button" data-ux-action="food">🥑 Aliment</button>
          <button type="button" class="bouton-secondaire" data-ux-action="barcode">▦ Scanner</button>
          <button type="button" class="bouton-secondaire" data-ux-action="photo">📷 Photo</button>
        </div>
      `,
    );
    panel.appendChild(summary);

    const bindMirror = (sourceId, targetId, fallback = "--") => {
      const source = document.getElementById(sourceId);
      const target = document.getElementById(targetId);
      if (!source || !target) return;
      const sync = () => {
        const text = source.textContent?.trim();
        target.textContent = text || fallback;
      };
      sync();
      new MutationObserver(sync).observe(source, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    };

    bindMirror("compteur-calories", "ux-summary-calories");
    bindMirror("mega-protein-value", "ux-summary-protein");
    bindMirror("compteur-repas", "ux-summary-meals");
  }

  function transformNutrition() {
    const page = document.getElementById("page-recettes");
    const favoritePage = document.getElementById("page-favoris");
    if (!page) return;

    setHeading(
      page,
      "Cuisine & journal",
      "🥗 Nutrition",
      "Ajoute tes repas, trouve des idées et garde tes recettes préférées au même endroit.",
    );

    const tabs = createTabs(
      "nutrition",
      page,
      [
        { key: "journal", label: "Journal", icon: "🥑" },
        { key: "recipes", label: "Recettes", icon: "🍲" },
        { key: "favorites", label: "Favoris", icon: "❤️" },
      ],
      "journal",
    );
    if (!tabs) return;

    const journal = tabs.panels.journal;
    const recipes = tabs.panels.recipes;
    const favorites = tabs.panels.favorites;

    addNutritionSummary(journal);

    const nutritionObjectives = make("div", "ux-nutrition-objectives");
    const homeObjectives = $("#page-accueil .suivi");
    safeMove($(".repas-card", homeObjectives), nutritionObjectives);
    safeMove($(".calories-card", homeObjectives), nutritionObjectives);
    if (nutritionObjectives.children.length) journal.appendChild(nutritionObjectives);

    const foodHub = $(".w2-food-hub", page);
    safeMove(foodHub, journal);

    const recipeIntro = make(
      "div",
      "ux-section-intro",
      `<div><p class="sur-titre">Inspiration</p><h2>Recettes & suggestions</h2><p>Des idées adaptées à ta journée, puis toute la bibliothèque de recettes.</p></div>`,
    );
    recipes.appendChild(recipeIntro);

    [
      ".w2-for-you-section",
      ".smart-recipes-card",
      ".navigation-recettes",
      "#liste-recettes",
      "#detail-recette",
    ].forEach((selector) => safeMove($(selector, page), recipes));

    const favoriteIntro = make(
      "div",
      "ux-section-intro",
      `<div><p class="sur-titre">Ta sélection</p><h2>❤️ Mes favoris</h2><p>Retrouve rapidement les recettes que tu as enregistrées.</p></div>`,
    );
    favorites.appendChild(favoriteIntro);

    if (favoritePage) {
      safeMove($(".favorite-collections", favoritePage), favorites);
      safeMove($("#liste-favoris", favoritePage), favorites);
      favoritePage.remove();
    }
  }

  function addHomeShortcuts(page) {
    const coach = $(".w2-coach-panel", page);
    if (!coach) return;
    const shortcuts = make(
      "section",
      "ux-home-shortcuts",
      `
        <button type="button" data-ux-action="water"><span>💧</span><strong>Eau</strong><small>+ 1 verre</small></button>
        <button type="button" data-ux-action="food"><span>🥑</span><strong>Aliment</strong><small>Journal</small></button>
        <button type="button" data-ux-action="steps"><span>👟</span><strong>Pas</strong><small>Ajouter</small></button>
        <button type="button" data-ux-action="weight"><span>⚖️</span><strong>Poids</strong><small>Suivre</small></button>
      `,
    );
    coach.after(shortcuts);
  }

  function transformHome() {
    const page = document.getElementById("page-accueil");
    if (!page) return;

    setHeading(
      page,
      "Ton espace bien-être",
      "Aujourd'hui",
      "L'essentiel de ta journée en un coup d'œil.",
    );

    addHomeShortcuts(page);

    const coachPanel = $(".w2-coach-panel", page);
    if (coachPanel && !$(".ux-coach-toggle", coachPanel)) {
      const toggle = make("button", "ux-coach-toggle bouton-secondaire", "Voir tous les conseils");
      toggle.type = "button";
      toggle.addEventListener("click", () => {
        const expanded = coachPanel.classList.toggle("ux-expanded");
        toggle.textContent = expanded ? "Réduire les conseils" : "Voir tous les conseils";
      });
      coachPanel.appendChild(toggle);
    }

    const more = make("details", "ux-home-more carte");
    more.innerHTML = `
      <summary>
        <span class="ux-settings-icon">✨</span>
        <span><strong>Motivation & objectifs</strong><small>Eau, pas, défis, série et récompenses</small></span>
        <span class="ux-chevron">›</span>
      </summary>
      <div class="ux-home-more-body"></div>
    `;
    const body = $(".ux-home-more-body", more);

    [
      $(".motivation", page),
      $(".carte-streak", page),
      $(".suivi", page),
      $(".challenges-section", page),
      $(".recompenses-section", page),
    ].forEach((node) => safeMove(node, body));

    const shortcuts = $(".ux-home-shortcuts", page);
    if (shortcuts) shortcuts.after(more);
    else coachPanel?.after(more);
  }

  function transformProgress() {
    const page = document.getElementById("page-suivi");
    if (!page) return;

    setHeading(
      page,
      "Tes tendances",
      "📈 Progrès",
      "Ta journée, tes semaines et ton évolution physique sans tout mélanger.",
    );

    const tabs = createTabs(
      "progress",
      page,
      [
        { key: "today", label: "Aujourd'hui", icon: "☀️" },
        { key: "week", label: "Semaine", icon: "📊" },
        { key: "body", label: "Corps", icon: "⚖️" },
      ],
      "today",
    );
    if (!tabs) return;

    [".suivi-resume", ".statistiques", ".macros-section", ".w2-wellness-section"].forEach((selector) => {
      safeMove($(selector, page), tabs.panels.today);
    });

    [".w2-insights-section", ".historique-section", ".weekly-dashboard-section", ".badges-section", ".calendar-section"].forEach((selector) => {
      safeMove($(selector, page), tabs.panels.week);
    });

    [".body-progress-section", ".photo-progress-section"].forEach((selector) => {
      safeMove($(selector, page), tabs.panels.body);
    });
  }

  function transformPlan() {
    const page = document.getElementById("page-plan");
    if (!page) return;

    setHeading(
      page,
      "Organisation",
      "🗓️ Plan",
      "Prépare tes repas puis transforme ton planning en liste de courses.",
    );

    const tabs = createTabs(
      "plan",
      page,
      [
        { key: "meals", label: "Repas", icon: "🍽️" },
        { key: "shopping", label: "Courses", icon: "🛒" },
      ],
      "meals",
    );
    if (!tabs) return;

    safeMove($(".plan-section", page), tabs.panels.meals);
    safeMove($(".shopping-section", page), tabs.panels.shopping);
  }

  function profileCardByHeading(page, text) {
    return $$(":scope > .profil-carte", page).find((card) =>
      card.textContent?.includes(text),
    );
  }

  function transformProfile() {
    const page = document.getElementById("page-profil");
    if (!page) return;

    setHeading(
      page,
      "Ton espace personnel",
      "👤 Moi",
      "Tes objectifs et réglages sont regroupés par thème pour aller directement à l'essentiel.",
    );

    const intro = make(
      "section",
      "ux-profile-intro carte",
      `
        <div class="ux-profile-avatar">👤</div>
        <div>
          <p class="sur-titre">Wellness</p>
          <h2>Mon espace</h2>
          <p>Ouvre uniquement la rubrique dont tu as besoin. Tout le reste reste rangé.</p>
        </div>
      `,
    );

    const list = make("section", "ux-settings-list");
    const header = $(":scope > .header", page);
    header.after(intro, list);

    const groups = [
      {
        icon: "👤",
        title: "Compte & profil",
        description: "Profils et informations personnelles",
        cards: [$(".gestion-comptes", page), profileCardByHeading(page, "Informations personnelles")],
      },
      {
        icon: "🎯",
        title: "Objectifs & nutrition",
        description: "Calories, objectif, préférences et macros",
        cards: [$(".nutrition-profil", page), $(".w2-goal-settings", page), $(".w2-preferences-card", page), $(".mega-nutrition-settings", page)],
      },
      {
        icon: "🎁",
        title: "Motivation",
        description: "Récompenses personnalisées",
        cards: [$(".recompenses-profil", page)],
      },
      {
        icon: "🔔",
        title: "Rappels",
        description: "Hydratation, pesée et notifications",
        cards: [$(".mega-tools-card", page)],
      },
      {
        icon: "🎨",
        title: "Apparence",
        description: "Thème clair, sombre ou automatique",
        cards: [$(".apparence-profil", page)],
      },
      {
        icon: "⚙️",
        title: "Réglages",
        description: "Unités, langue, gestes et analyse photo",
        cards: [$(".w2-settings-center", page), $(".w2-photo-ai-card", page)],
      },
      {
        icon: "☁️",
        title: "Synchronisation",
        description: "Compte cloud optionnel",
        cards: [$(".w2-cloud-card", page)],
      },
      {
        icon: "💾",
        title: "Données & sauvegarde",
        description: "Export, sauvegarde et restauration",
        cards: [$(".mega-export-card", page), $(".w2-backup-card", page)],
      },
      {
        icon: "⚠️",
        title: "Réinitialisation",
        description: "Réinitialiser ou supprimer ce profil",
        danger: true,
        cards: [$(".zone-danger", page)],
      },
    ];

    const detailsNodes = [];

    groups.forEach((group) => {
      const details = make("details", `ux-settings-group${group.danger ? " ux-danger-group" : ""}`);
      details.innerHTML = `
        <summary>
          <span class="ux-settings-icon">${group.icon}</span>
          <span class="ux-settings-copy"><strong>${group.title}</strong><small>${group.description}</small></span>
          <span class="ux-chevron">›</span>
        </summary>
        <div class="ux-settings-content"></div>
      `;
      const content = $(".ux-settings-content", details);
      group.cards.filter(Boolean).forEach((card) => content.appendChild(card));
      if (!content.children.length) return;

      details.addEventListener("toggle", () => {
        if (!details.open) return;
        detailsNodes.forEach((other) => {
          if (other !== details) other.open = false;
        });
      });

      detailsNodes.push(details);
      list.appendChild(details);
    });
  }

  function bindUxActions() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-ux-action]");
      if (!button) return;

      const action = button.dataset.uxAction;
      if (action === "water") document.getElementById("ajouter-eau")?.click();
      if (action === "steps") document.getElementById("ouvrir-modal-pas")?.click();
      if (action === "food") document.getElementById("w2-open-food-search")?.click();
      if (action === "barcode") document.getElementById("w2-open-barcode")?.click();
      if (action === "photo") document.getElementById("w2-open-meal-photo")?.click();
      if (action === "weight") {
        showTab("progress", "body");
        if (typeof window.afficherPage === "function") window.afficherPage("suivi");
        window.setTimeout(() => document.getElementById("mega-weight-input")?.focus(), 250);
      }
    });
  }

  function init() {
    moveGlobalOverlays();
    simplifyMainNavigation();
    transformNutrition();
    transformHome();
    transformProgress();
    transformPlan();
    transformProfile();
    bindUxActions();

    document.documentElement.classList.add("ux-simplified");
  }

  window.WellnessUX = {
    showTab,
    getActiveTab(group) {
      return uxTabs.get(group)?.active || null;
    },
  };

  init();
})();
