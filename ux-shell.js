"use strict";

// ======================================================
// WELLNESS PREMIUM V3 — mobile-first presentation shell
// Keeps the existing engine, storage and feature IDs intact,
// while presenting the app with the simplified premium UI.
// Runs before app.js; data synchronisation starts after the
// remaining scripts have finished loading.
// ======================================================

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const byId = (id) => document.getElementById(id);

  const vault = document.createElement("div");
  vault.id = "ux-legacy-vault";
  vault.hidden = true;
  document.body.appendChild(vault);

  const references = {
    home: {},
    nutrition: {},
    plan: {},
    progress: {},
    profile: {},
  };

  let plannerDayIndex = 0;
  let activeSheetNodes = [];
  let sheetReturnParent = null;
  let plannerEditSource = null;
  let premiumJournalSignature = "";

  function safeMove(node, parent = vault) {
    if (node && parent) parent.appendChild(node);
    return node;
  }

  function esc(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function svgIcon(name, className = "") {
    const icons = {
      home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M9.5 20v-6h5v6"/>',
      fork: '<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10"/><path d="M15 3v18M15 3c3 1 4.5 3.2 4.5 6.2 0 2.2-1.4 3.8-4.5 3.8"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8 14h3M13 14h3M8 17h3"/>',
      chart: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      sliders: '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="13" cy="18" r="2"/>',
      chevron: '<path d="m9 18 6-6-6-6"/>',
      cart: '<path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.5L21 8H7"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
      scale: '<rect x="4" y="5" width="16" height="15" rx="4"/><path d="M9 10a3 3 0 0 1 6 0"/><path d="m12 10 2-2"/>',
      ruler: '<path d="M4 17 17 4l3 3L7 20H4v-3Z"/><path d="m11 10 3 3M8 13l2 2M14 7l2 2"/>',
      camera: '<path d="M5 7h3l1.5-2h5L16 7h3a2 2 0 0 1 2 2v9H3V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="3"/>',
      cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6.2 8.5 4.5 4.5 0 0 0 7 18Z"/>',
      upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 14v6h14v-6"/>',
      download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 19h14"/>',
      gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.05.05-2.8 2.8-.05-.05a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65V21h-4v-.08A1.8 1.8 0 0 0 8.7 19.3a1.8 1.8 0 0 0-2 .36l-.05.05-2.8-2.8.05-.05a1.8 1.8 0 0 0 .36-2A1.8 1.8 0 0 0 2.6 13.8H2.5v-4h.08A1.8 1.8 0 0 0 4.2 8.7a1.8 1.8 0 0 0-.36-2l-.05-.05 2.8-2.8.05.05a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 9.8 2.6V2.5h4v.08A1.8 1.8 0 0 0 15 4.2a1.8 1.8 0 0 0 2-.36l.05-.05 2.8 2.8-.05.05a1.8 1.8 0 0 0-.36 2 1.8 1.8 0 0 0 1.65 1.1h.08v4h-.08A1.8 1.8 0 0 0 19.4 15Z"/>',
      sparkles: '<path d="m12 3 1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2L12 3Z"/><path d="m18 13 .8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8L18 13Z"/><path d="m5 14 .7 1.8 1.8.7-1.8.7L5 19l-.7-1.8-1.8-.7 1.8-.7L5 14Z"/>',
    };
    return `<svg class="px-icon ${className}" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.chevron}</svg>`;
  }

  function setHeader(page, title, subtitle, { greeting = false } = {}) {
    const header = $(":scope > .header", page);
    if (!header) return;
    header.className = "header px-header";
    header.innerHTML = `
      <div class="px-header-copy">
        <h1${greeting ? ' id="nom"' : ''}>${greeting ? '<span id="px-greeting">Bonjour</span> <span id="px-greeting-name"></span> <span aria-hidden="true">👋</span>' : title}</h1>
        <p>${greeting ? '<span id="px-current-date"></span>' : subtitle}</p>
      </div>
      <button type="button" class="px-notification-trigger" aria-label="Notifications">
        ${svgIcon("bell")}
        <span class="px-notification-dot"></span>
      </button>
    `;
  }

  function collectDirect(page, except = []) {
    if (!page) return [];
    return [...page.children].filter((node) => !except.includes(node));
  }

  function simplifyMainNavigation() {
    const nav = $(".navigation-principale");
    if (!nav) return;
    $("[data-page='favoris']", nav)?.remove();
    const config = {
      accueil: ["Aujourd'hui", "home"],
      recettes: ["Nutrition", "fork"],
      plan: ["Plan", "calendar"],
      suivi: ["Progrès", "chart"],
      profil: ["Moi", "user"],
    };
    Object.entries(config).forEach(([key, [label, icon]]) => {
      const button = $(`[data-page='${key}']`, nav);
      if (!button) return;
      button.innerHTML = `${svgIcon(icon, "nav-icon")}<small>${label}</small>`;
      button.setAttribute("aria-label", label);
    });
  }

  function transformHome() {
    const page = byId("page-accueil");
    if (!page) return;
    const header = $(":scope > .header", page);
    const nodes = collectDirect(page, [header]);
    nodes.forEach((node) => safeMove(node));

    references.home = {
      todayCenter: $(".today-center", vault),
      coach: $(".w2-coach-panel", vault),
      motivation: $(".motivation", vault),
      streak: $(".carte-streak", vault),
      objectives: $(".suivi", vault),
      challenges: $(".challenges-section", vault),
      rewards: $(".recompenses-section", vault),
    };

    setHeader(page, "Aujourd'hui", "", { greeting: true });

    const shell = document.createElement("div");
    shell.className = "px-screen px-home-screen";
    shell.innerHTML = `
      <section class="px-score-card px-card">
        <strong id="hero-score" hidden></strong>
        <div class="px-score-copy">
          <span>Bien-être</span>
          <div class="px-score-number"><strong id="px-health-score">--</strong><em>/ 100</em></div>
          <p id="px-health-label">Commence ta journée</p>
        </div>
        <div class="px-score-ring" id="px-health-ring" style="--score:0">
          <div class="px-score-heart">♥</div>
        </div>
      </section>

      <section class="px-stat-grid">
        <button type="button" class="px-stat-card px-card" data-ux-action="food">
          <span class="px-stat-emoji">🔥</span><div><strong id="px-kcal-remaining">--</strong><small>kcal restantes</small></div>
        </button>
        <button type="button" class="px-stat-card px-card" data-ux-action="food">
          <span class="px-stat-emoji">💪</span><div><strong id="px-protein-remaining">--</strong><small>protéines restantes</small></div>
        </button>
        <div class="px-stat-card px-card px-water-stat" aria-label="Hydratation">
          <span class="px-stat-emoji">💧</span>
          <div class="px-water-stat-copy"><strong id="px-water-today">--</strong><small>verres</small></div>
          <div class="px-water-adjusters" aria-label="Ajuster les verres d'eau">
            <button type="button" data-water-adjust="-1" aria-label="Retirer un verre">−</button>
            <button type="button" data-water-adjust="1" aria-label="Ajouter un verre">+</button>
          </div>
        </div>
        <button type="button" class="px-stat-card px-card" data-ux-action="steps">
          <span class="px-stat-emoji">👟</span><div><strong id="px-steps-today">--</strong><small>pas</small></div>
        </button>
      </section>

      <button type="button" class="px-coach-card px-card" data-open-feature="coach">
        <span class="px-coach-avatar">🧑🏻</span>
        <span class="px-coach-copy"><small>✦ Conseil du coach</small><strong id="px-coach-text">Ajoute quelques données pour recevoir un conseil personnalisé.</strong></span>
      </button>

      <section class="px-journal-card px-card px-home-journal-card">
        <p class="px-kicker">JOURNAL ALIMENTAIRE</p>
        <div id="px-journal-list" class="px-journal-list"></div>
      </section>

      <section class="px-home-footer-grid">
        <button type="button" class="px-mini-card px-card" data-open-feature="challenges"><span>🎯</span><strong id="px-challenge-count">0 / 5</strong><small>défis</small></button>
        <button type="button" class="px-mini-card px-card" data-open-feature="motivation"><span>🔥</span><strong id="px-streak-count">0</strong><small>Série</small></button>
        <button type="button" class="px-mini-card px-card" data-open-feature="rewards"><span>🎁</span><strong>Roue</strong><small>récompense</small></button>
      </section>
    `;
    page.appendChild(shell);
  }

  function transformNutrition() {
    const page = byId("page-recettes");
    const favoritesPage = byId("page-favoris");
    if (!page) return;
    const header = $(":scope > .header", page);

    references.nutrition = {
      foodHub: $(".w2-food-hub", page),
      forYou: $(".w2-for-you-section", page),
      smart: $(".smart-recipes-card", page),
      recipeNav: $(".navigation-recettes", page),
      recipeList: byId("liste-recettes"),
      recipeDetail: byId("detail-recette"),
      favoriteCollections: favoritesPage ? $(".favorite-collections", favoritesPage) : null,
      favoriteList: favoritesPage ? $("#liste-favoris", favoritesPage) : null,
    };

    collectDirect(page, [header]).forEach((node) => safeMove(node));
    if (favoritesPage) {
      const favHeader = $(":scope > .header", favoritesPage);
      collectDirect(favoritesPage, [favHeader]).forEach((node) => safeMove(node));
      favoritesPage.remove();
    }

    setHeader(page, "Nutrition", "Gère tes repas, calories et macros pour atteindre tes objectifs.");

    const shell = document.createElement("div");
    shell.className = "px-screen px-nutrition-screen";
    shell.innerHTML = `
      <button type="button" class="px-search-bar px-card" data-ux-action="food">
        ${svgIcon("search")}<span>Rechercher un aliment ou une recette</span><span class="px-filter-button">${svgIcon("sliders")}</span>
      </button>

      <section class="px-nutrition-today px-card">
        <p class="px-kicker">AUJOURD'HUI</p>
        <div class="px-kcal-line"><span>🔥</span><strong id="px-nutrition-kcal">0</strong><em id="px-nutrition-kcal-target">/ -- kcal</em></div>
        <div class="px-progress-track"><i id="px-nutrition-kcal-bar"></i></div>
        <p class="px-muted" id="px-nutrition-remaining">Objectif à configurer</p>
        <div class="px-macro-lines">
          <div class="px-macro-line protein"><span>💪</span><div><strong>Protéines</strong><div class="px-progress-track"><i id="px-protein-bar"></i></div></div><em id="px-protein-pair">0 / -- g</em></div>
          <div class="px-macro-line carbs"><span>🌾</span><div><strong>Glucides</strong><div class="px-progress-track"><i id="px-carbs-bar"></i></div></div><em id="px-carbs-pair">0 / -- g</em></div>
          <div class="px-macro-line fat"><span>💧</span><div><strong>Lipides</strong><div class="px-progress-track"><i id="px-fat-bar"></i></div></div><em id="px-fat-pair">0 / -- g</em></div>
        </div>
      </section>

      <div id="px-nutrition-tools-anchor" aria-hidden="true"></div>

      <section class="px-meals-card px-card px-nutrition-meals-card">
        <div class="px-section-row"><strong>🍴 Repas du jour</strong><span id="px-meals-count">0 / 3 repas</span></div>
        <button type="button" class="px-meal-check-row" data-meal-toggle="Petit-déjeuner"><span>🌅</span><strong>Petit-déjeuner</strong><i id="px-check-breakfast"></i></button>
        <button type="button" class="px-meal-check-row" data-meal-toggle="Déjeuner"><span>☀️</span><strong>Déjeuner</strong><i id="px-check-lunch"></i></button>
        <button type="button" class="px-meal-check-row" data-meal-toggle="Dîner"><span>🌙</span><strong>Dîner</strong><i id="px-check-dinner"></i></button>
      </section>

      <section class="px-two-actions">
        <button type="button" class="px-card" data-open-feature="recipes"><span>🍲</span><strong>Recettes</strong></button>
        <button type="button" class="px-card" data-open-feature="favorites"><span>❤️</span><strong>Favoris</strong></button>
      </section>
    `;
    page.appendChild(shell);
  }

  function transformPlan() {
    const page = byId("page-plan");
    if (!page) return;
    const header = $(":scope > .header", page);
    references.plan = {
      planner: $(".plan-section", page),
      shopping: $(".shopping-section", page),
    };
    collectDirect(page, [header]).forEach((node) => safeMove(node));
    setHeader(page, "Plan", "Ton plan du jour, clair et simple.");

    const shell = document.createElement("div");
    shell.className = "px-screen px-plan-screen";
    shell.innerHTML = `
      <section class="px-day-strip" data-horizontal-scroll="true">
        <button type="button" class="px-day-arrow" data-plan-day="prev">‹</button>
        <button type="button" class="px-day-chip" id="px-plan-prev-day"></button>
        <span class="px-day-divider"></span>
        <button type="button" class="px-day-chip active" id="px-plan-current-day"></button>
        <span class="px-day-divider"></span>
        <button type="button" class="px-day-chip" id="px-plan-next-day"></button>
        <button type="button" class="px-day-arrow" data-plan-day="next">›</button>
      </section>

      <section class="px-plan-day-card px-card">
        <div class="px-plan-title-row"><h2 id="px-plan-title">Aujourd'hui</h2><button type="button" data-open-feature="week-plan" class="px-square-button">${svgIcon("calendar")}</button></div>
        <div id="px-plan-meals" class="px-plan-meals"></div>
      </section>

      <button type="button" class="px-link-row px-card" data-open-feature="week-plan">
        <span class="px-row-icon">${svgIcon("calendar")}</span><span><strong>Voir la semaine</strong><small>Aperçu de la semaine complète</small></span>${svgIcon("chevron")}
      </button>
      <button type="button" class="px-link-row px-card" data-open-feature="shopping">
        <span class="px-row-icon green">${svgIcon("cart")}</span><span><strong>Liste de courses</strong><small id="px-shopping-label">Génère ta liste depuis le planning</small></span><em id="px-shopping-badge">0</em>
      </button>
    `;
    page.appendChild(shell);
  }

  function transformProgress() {
    const page = byId("page-suivi");
    if (!page) return;
    const header = $(":scope > .header", page);
    references.progress = {
      summary: $(".suivi-resume", page),
      stats: $(".statistiques", page),
      macros: $(".macros-section", page),
      wellness: $(".w2-wellness-section", page),
      insights: $(".w2-insights-section", page),
      history: $(".historique-section", page),
      weekly: $(".weekly-dashboard-section", page),
      badges: $(".badges-section", page),
      body: $(".body-progress-section", page),
      photos: $(".photo-progress-section", page),
      calendar: $(".calendar-section", page),
    };
    collectDirect(page, [header]).forEach((node) => safeMove(node));
    setHeader(page, "Progrès 📈", "Suis tes résultats et célèbre chaque victoire.");

    const shell = document.createElement("div");
    shell.className = "px-screen px-progress-screen";
    shell.innerHTML = `
      <button type="button" class="px-section-link" data-open-feature="week-progress">${svgIcon("calendar")}<strong>Cette semaine</strong>${svgIcon("chevron")}</button>
      <section class="px-progress-kpis">
        <button type="button" class="px-kpi-card px-card" data-open-feature="weight"><span class="px-kpi-icon">⚖️</span><div><small>Poids</small><strong id="px-weight-main">--</strong><em id="px-weight-delta">--</em></div></button>
        <button type="button" class="px-kpi-card px-card" data-ux-action="steps"><span class="px-kpi-icon">👟</span><div><small>Pas</small><strong id="px-week-steps">--</strong><em id="px-week-steps-delta">Cette semaine</em></div></button>
        <button type="button" class="px-kpi-card px-card" data-open-feature="nutrition-details"><span class="px-kpi-icon">🔥</span><div><small>Nutrition</small><strong id="px-week-kcal">--</strong><em id="px-week-kcal-delta">kcal / jour</em></div></button>
        <button type="button" class="px-kpi-card px-card" data-ux-action="wellness"><span class="px-kpi-icon">🌙</span><div><small>Sommeil</small><strong id="px-week-sleep">--</strong><em id="px-week-sleep-delta">Cette semaine</em></div></button>
      </section>

      <section class="px-weight-chart-card px-card">
        <div class="px-chart-head"><div><h2>Évolution du poids</h2><p><strong id="px-chart-delta">--</strong> <span id="px-chart-delta-label">sur les 7 derniers jours</span></p></div><button type="button" class="px-range-pill" data-open-feature="weight">7 jours⌄</button></div>
        <div id="px-weight-chart-clone" class="px-weight-chart"></div>
      </section>

      <button type="button" class="px-section-link px-body-heading" data-open-feature="body-all">${svgIcon("user")}<strong>Corps</strong>${svgIcon("chevron")}</button>
      <section class="px-body-grid">
        <button type="button" class="px-body-card px-card" data-open-feature="measurements"><span>${svgIcon("ruler")}</span><strong>Mensurations</strong><small>Suis tes mesures et tes progrès</small></button>
        <button type="button" class="px-body-card px-card" data-open-feature="photos"><span>${svgIcon("camera")}</span><strong>Photos</strong><small>Compare tes évolutions</small></button>
      </section>
    `;
    page.appendChild(shell);
  }

  function profileCardByHeading(page, text) {
    return $$(':scope > .profil-carte', page).find((card) => card.textContent?.includes(text));
  }

  function transformProfile() {
    const page = byId("page-profil");
    if (!page) return;
    const header = $(":scope > .header", page);

    references.profile = {
      account: [$(".gestion-comptes", page), profileCardByHeading(page, "Informations personnelles")].filter(Boolean),
      goal: [$(".nutrition-profil", page), $(".w2-goal-settings", page)].filter(Boolean),
      nutrition: [$(".w2-preferences-card", page), $(".mega-nutrition-settings", page)].filter(Boolean),
      reminders: [$(".mega-tools-card", page)].filter(Boolean),
      appearance: [$(".apparence-profil", page)].filter(Boolean),
      backup: [$(".w2-backup-card", page)].filter(Boolean),
      export: [$(".mega-export-card", page)].filter(Boolean),
      advanced: [$(".w2-settings-center", page), $(".zone-danger", page)].filter(Boolean),
      cloud: [$(".w2-cloud-card", page)].filter(Boolean),
      ai: [$(".w2-photo-ai-card", page)].filter(Boolean),
      motivation: [$(".recompenses-profil", page)].filter(Boolean),
    };

    collectDirect(page, [header]).forEach((node) => safeMove(node));
    setHeader(page, "Moi", "Tes réglages, tes préférences, tout au même endroit.");

    const row = (key, icon, title, subtitle, extra = "") => `
      <button type="button" class="px-settings-row" data-settings="${key}">
        <span class="px-settings-icon ${extra}">${icon}</span>
        <span><strong>${title}</strong><small>${subtitle}</small></span>
        ${svgIcon("chevron")}
      </button>`;

    const shell = document.createElement("div");
    shell.className = "px-screen px-profile-screen";
    shell.innerHTML = `
      <p class="px-group-label">ESSENTIEL</p>
      <section class="px-settings-group px-card">
        ${row("account", "👤", "Compte & profil", "Profils et informations personnelles")}
        ${row("goal", "🎯", "Mon objectif", "Tes objectifs et réglages")}
        ${row("nutrition", "🥗", "Nutrition & préférences", "Calories, objectif, préférences et macros")}
        ${row("reminders", "🔔", "Rappels", "Hydratation, pesée et notifications")}
        ${row("appearance", "🎨", "Apparence", "Thème clair, sombre ou automatique")}
      </section>

      <p class="px-group-label">DONNÉES</p>
      <section class="px-settings-group px-card">
        ${row("backup", "☁️", "Sauvegarde", "Sauvegarde et restauration des données")}
        ${row("export", "⇩", "Export", "Exporter tes données et rapports", "purple")}
      </section>

      <p class="px-group-label">PLUS</p>
      <section class="px-settings-group px-card">
        ${row("advanced", "⚙️", "Réglages avancés", "Paramètres et personnalisations avancées", "muted")}
        ${row("cloud", "☁️", "Cloud", "Synchronisation et stockage", "cyan")}
        ${row("ai", "✦", "Analyse IA", "Conseils et insights personnalisés", "purple")}
      </section>
    `;
    page.appendChild(shell);
  }

  function moveGlobalOverlays() {
    [
      "modal-pas-overlay", "modal-repas-overlay", "modal-calories-overlay", "modal-filtres-overlay",
      "mega-custom-recipe-overlay", "w2-quick-overlay", "w2-food-overlay", "w2-portion-overlay",
      "w2-barcode-overlay", "w2-photo-overlay", "w2-notification-overlay", "mega-onboarding-overlay",
    ].forEach((id) => {
      const overlay = byId(id);
      if (overlay) document.body.appendChild(overlay);
    });
  }

  function createFeatureSheet() {
    const overlay = document.createElement("div");
    overlay.className = "px-sheet-overlay";
    overlay.id = "px-feature-sheet";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <section class="px-sheet" role="dialog" aria-modal="true" aria-labelledby="px-sheet-title">
        <div class="px-sheet-handle"></div>
        <header class="px-sheet-header"><div><p id="px-sheet-kicker">Wellness</p><h2 id="px-sheet-title">Détails</h2></div><button type="button" class="px-sheet-close" aria-label="Fermer">✕</button></header>
        <div class="px-sheet-content" id="px-sheet-content"></div>
      </section>
    `;
    document.body.appendChild(overlay);
    $(".px-sheet-close", overlay).addEventListener("click", closeFeatureSheet);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) closeFeatureSheet(); });
  }

  function openFeatureSheet(title, nodes, kicker = "Wellness") {
    const overlay = byId("px-feature-sheet");
    const content = byId("px-sheet-content");
    if (!overlay || !content) return;
    closeFeatureSheet({ silent: true });
    byId("px-sheet-title").textContent = title;
    byId("px-sheet-kicker").textContent = kicker;
    sheetReturnParent = vault;
    activeSheetNodes = (Array.isArray(nodes) ? nodes : [nodes]).filter(Boolean);
    activeSheetNodes.forEach((node) => content.appendChild(node));
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("px-sheet-open");
  }

  function closeFeatureSheet({ silent = false } = {}) {
    const overlay = byId("px-feature-sheet");
    if (!overlay) return;
    activeSheetNodes.forEach((node) => (sheetReturnParent || vault).appendChild(node));
    activeSheetNodes = [];
    sheetReturnParent = null;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("px-sheet-open");
    if (!silent) syncPremiumUI();
  }

  function createPlannerEditor() {
    const overlay = document.createElement("div");
    overlay.className = "px-sheet-overlay px-mini-sheet-overlay";
    overlay.id = "px-planner-editor";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <section class="px-sheet px-mini-sheet" role="dialog" aria-modal="true">
        <div class="px-sheet-handle"></div>
        <header class="px-sheet-header"><div><p>PLANNING</p><h2 id="px-editor-title">Repas</h2></div><button type="button" class="px-editor-close">✕</button></header>
        <div class="px-editor-body">
          <label for="px-editor-recipe">Recette</label><select id="px-editor-recipe"></select>
          <label for="px-editor-portions">Portions</label><select id="px-editor-portions"><option value="0.5">½</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select>
          <button type="button" id="px-editor-save">Enregistrer</button>
        </div>
      </section>
    `;
    document.body.appendChild(overlay);
    $(".px-editor-close", overlay).addEventListener("click", closePlannerEditor);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) closePlannerEditor(); });
    byId("px-editor-save").addEventListener("click", savePlannerEditor);
  }

  function openPlannerEditor(source) {
    if (!source) return;
    plannerEditSource = source;
    const recipe = $("select", source);
    const portions = $(".plan-portion select", source);
    const label = $("label", source)?.textContent?.trim() || "Repas";
    const dateLabel = source.closest(".plan-day")?.querySelector(".plan-date")?.textContent?.trim() || "";
    byId("px-editor-title").textContent = `${label} · ${dateLabel}`;
    const target = byId("px-editor-recipe");
    target.innerHTML = recipe?.innerHTML || '<option value="">— Choisir —</option>';
    target.value = recipe?.value || "";
    byId("px-editor-portions").value = portions?.value || "1";
    const overlay = byId("px-planner-editor");
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
  }

  function closePlannerEditor() {
    const overlay = byId("px-planner-editor");
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
    plannerEditSource = null;
  }

  function savePlannerEditor() {
    if (!plannerEditSource) return closePlannerEditor();
    const sourceRecipe = $("select", plannerEditSource);
    const sourcePortions = $(".plan-portion select", plannerEditSource);
    if (sourceRecipe) {
      sourceRecipe.value = byId("px-editor-recipe").value;
      sourceRecipe.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (sourcePortions) {
      sourcePortions.value = byId("px-editor-portions").value;
      sourcePortions.dispatchEvent(new Event("change", { bubbles: true }));
    }
    closePlannerEditor();
    window.setTimeout(syncPremiumUI, 80);
  }

  function dataAccount() {
    try {
      if (typeof window.w2NormalizeAccount === "function") return window.w2NormalizeAccount();
      if (typeof window.megaNormalizeAccount === "function") return window.megaNormalizeAccount();
      if (typeof window.obtenirCompteActif === "function") return window.obtenirCompteActif();
    } catch {}
    return null;
  }

  function journalTotals(account) {
    try {
      if (typeof window.megaJournalTotals === "function") return window.megaJournalTotals(account);
    } catch {}
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    (account?.journalCalories || []).forEach((entry) => {
      totals.calories += Number(entry.calories) || 0;
      totals.protein += Number(entry.proteines) || 0;
      totals.carbs += Number(entry.glucides) || 0;
      totals.fat += Number(entry.lipides) || 0;
    });
    return totals;
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
  }

  function setWidth(id, pct) {
    const el = byId(id);
    if (el) el.style.width = `${Math.max(0, Math.min(100, Number(pct) || 0))}%`;
  }

  function healthLabel(score) {
    if (score >= 85) return "Excellente journée ✨";
    if (score >= 70) return "Bonne journée 👍";
    if (score >= 50) return "Bonne base 💪";
    if (score > 0) return "Continue, chaque action compte";
    return "Commence ta journée";
  }

  function syncHome(account) {
    if (!byId("px-health-score") || !account) return;
    setText("px-greeting-name", account.prenom || account.nomCompte || "");
    const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    setText("px-current-date", date.charAt(0).toUpperCase() + date.slice(1));

    let score = 0;
    try {
      if (typeof window.w2CurrentMetrics === "function" && window.W2_CORE?.healthScore) score = window.W2_CORE.healthScore(window.w2CurrentMetrics()) || 0;
      else if (typeof window.obtenirProgressions === "function") score = Math.round(window.obtenirProgressions().score || 0);
    } catch {}
    setText("px-health-score", score || "--");
    setText("px-health-label", healthLabel(score));
    byId("px-health-ring")?.style.setProperty("--score", score || 0);

    const totals = journalTotals(account);
    const kcalTarget = Number(account.objectifCalories) || 0;
    const remainKcal = kcalTarget ? Math.max(0, kcalTarget - totals.calories) : null;
    const proteinTarget = Number(account.macroTargets?.protein) || 0;
    const remainProtein = proteinTarget ? Math.max(0, proteinTarget - totals.protein) : null;
    setText("px-kcal-remaining", remainKcal === null ? "--" : Math.round(remainKcal).toLocaleString("fr-FR"));
    setText("px-protein-remaining", remainProtein === null ? "--" : `${Math.round(remainProtein)} g`);
    const currentWater = Number(account.verresEau) || 0;
    const waterGoal = Number(account.objectifEau) || 8;
    setText("px-water-today", `${currentWater} / ${waterGoal}`);
    const waterMinus = document.querySelector('[data-water-adjust="-1"]');
    const waterPlus = document.querySelector('[data-water-adjust="1"]');
    if (waterMinus) waterMinus.disabled = currentWater <= 0;
    if (waterPlus) waterPlus.disabled = currentWater >= waterGoal;
    setText("px-steps-today", `${(Number(account.pasEffectues) || 0).toLocaleString("fr-FR")} / ${(Number(account.objectifPas) || 10000).toLocaleString("fr-FR")}`);

    const mealMap = [
      ["Petit-déjeuner", "px-check-breakfast"], ["Déjeuner", "px-check-lunch"], ["Dîner", "px-check-dinner"],
    ];
    let mealCount = 0;
    mealMap.forEach(([name, id]) => {
      const done = Boolean(account.repas?.[name]);
      if (done) mealCount += 1;
      const el = byId(id);
      if (el) { el.classList.toggle("done", done); el.textContent = done ? "✓" : ""; }
    });
    setText("px-meals-count", `${mealCount} / 3 repas`);

    const coach = byId("w2-coach-summary")?.textContent?.trim();
    setText("px-coach-text", coach || "Ajoute quelques données pour recevoir un conseil personnalisé.");
    const challenge = byId("mega-challenge-count")?.textContent?.trim();
    setText("px-challenge-count", challenge || "0 / 5");
    const streak = byId("streak-jour")?.textContent?.trim();
    setText("px-streak-count", streak || "0 jour");
  }

  function syncNutrition(account) {
    if (!byId("px-nutrition-kcal") || !account) return;
    const totals = journalTotals(account);
    const target = Number(account.objectifCalories) || 0;
    const targets = account.macroTargets || {};
    setText("px-nutrition-kcal", Math.round(totals.calories).toLocaleString("fr-FR"));
    setText("px-nutrition-kcal-target", `/ ${target ? Math.round(target).toLocaleString("fr-FR") : "--"} kcal`);
    setWidth("px-nutrition-kcal-bar", target ? totals.calories / target * 100 : 0);
    setText("px-nutrition-remaining", target ? `${Math.max(0, Math.round(target - totals.calories)).toLocaleString("fr-FR")} kcal restantes` : "Objectif à configurer");

    const macros = [
      ["protein", totals.protein, Number(targets.protein) || 0, "px-protein-pair", "px-protein-bar"],
      ["carbs", totals.carbs, Number(targets.carbs) || 0, "px-carbs-pair", "px-carbs-bar"],
      ["fat", totals.fat, Number(targets.fat) || 0, "px-fat-pair", "px-fat-bar"],
    ];
    macros.forEach(([, current, goal, pair, bar]) => {
      setText(pair, `${Math.round(current)} / ${goal || "--"} g`);
      setWidth(bar, goal ? current / goal * 100 : 0);
    });

    renderPremiumJournal(account);
  }

  function mealIcon(slot = "") {
    if (slot === "Petit-déjeuner") return "🌅";
    if (slot === "Dîner") return "🌙";
    if (slot === "Collation") return "🌿";
    return "☀️";
  }

  function renderPremiumJournal(account) {
    const list = byId("px-journal-list");
    if (!list) return;
    const entries = account.journalCalories || [];
    const slots = ["Petit-déjeuner", "Déjeuner", "Dîner", "Collation"];
    const journalSignature = JSON.stringify(entries.map((entry) => [
      entry.id,
      entry.nom,
      entry.calories,
      entry.proteines,
      entry.glucides,
      entry.lipides,
      entry.repasSlot,
      entry.quantity,
      entry.unit,
    ]));

    // Ne reconstruit pas le DOM toutes les 1,5 s si rien n'a changé.
    // Cela préserve le scroll, les boutons Recettes/Favoris et les
    // décorations ajoutées par V4.3.
    if (journalSignature === premiumJournalSignature) return;
    premiumJournalSignature = journalSignature;

    const scrollBefore = window.scrollY;
    const preserveScroll = document.getElementById("page-accueil")?.classList.contains("active") && scrollBefore > 0;

    list.innerHTML = slots.map((slot) => {
      const slotEntries = entries.filter((entry) => (entry.repasSlot || "Déjeuner") === slot);
      const kcal = slotEntries.reduce((sum, entry) => sum + (Number(entry.calories) || 0), 0);

      const rows = slotEntries.map((entry) => {
        const macros = [
          Number(entry.proteines) > 0 ? `P ${Math.round(Number(entry.proteines))} g` : "",
          Number(entry.glucides) > 0 ? `G ${Math.round(Number(entry.glucides))} g` : "",
          Number(entry.lipides) > 0 ? `L ${Math.round(Number(entry.lipides))} g` : "",
        ].filter(Boolean).join(" · ");

        return `<div class="px-journal-entry">
          <button type="button" class="px-journal-entry-main" data-journal-edit="${esc(entry.id)}">
            <span><strong>${esc(entry.nom || "Ajout manuel")}</strong><small>${macros || esc(entry.source === "recette" ? "Recette" : "Aliment")}</small></span>
            <em>${Math.round(Number(entry.calories) || 0)} kcal</em>
          </button>
          <button type="button" class="px-journal-entry-delete" data-journal-delete="${esc(entry.id)}" aria-label="Supprimer ${esc(entry.nom || "cet aliment")}">✕</button>
        </div>`;
      }).join("");

      return `<section class="px-journal-group">
        <div class="px-journal-group-head">
          <span class="px-journal-icon">${mealIcon(slot)}</span>
          <span><strong>${slot}</strong><small>${slotEntries.length ? `${slotEntries.length} ajout${slotEntries.length > 1 ? "s" : ""}` : "Aucun aliment"}</small></span>
          <em>${slotEntries.length ? `${Math.round(kcal)} kcal` : ""}</em>
          <button type="button" data-journal-slot="${esc(slot)}" aria-label="Ajouter à ${esc(slot)}">+</button>
        </div>
        ${rows || `<button type="button" class="px-journal-empty" data-journal-slot="${esc(slot)}">Ajouter un aliment</button>`}
      </section>`;
    }).join("");

    if (preserveScroll) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollBefore, behavior: "auto" });
      });
    }
  }

  function plannerCards() {
    return $$("#mega-meal-plan-grid .plan-day");
  }

  function plannerInitialIndex(cards) {
    if (!cards.length) return 0;
    const today = new Intl.DateTimeFormat("fr-FR", { weekday: "long" }).format(new Date()).toLowerCase();
    const found = cards.findIndex((card) => card.querySelector("h3")?.textContent?.trim().toLowerCase() === today);
    return found >= 0 ? found : Math.min(plannerDayIndex, cards.length - 1);
  }

  function renderPlan() {
    if (!byId("px-plan-meals")) return;
    const cards = plannerCards();
    if (!cards.length) {
      byId("px-plan-meals").innerHTML = '<p class="px-empty">Le planning se prépare…</p>';
      return;
    }
    if (!Number.isInteger(plannerDayIndex) || plannerDayIndex < 0 || plannerDayIndex >= cards.length) plannerDayIndex = plannerInitialIndex(cards);
    const current = cards[plannerDayIndex];
    const previous = cards[Math.max(0, plannerDayIndex - 1)];
    const next = cards[Math.min(cards.length - 1, plannerDayIndex + 1)];

    const dayChip = (card) => {
      const name = card.querySelector("h3")?.textContent?.trim() || "";
      const date = card.querySelector(".plan-date")?.textContent?.trim() || "";
      return `<strong>${name}</strong><small>${date}</small>`;
    };
    byId("px-plan-prev-day").innerHTML = dayChip(previous);
    byId("px-plan-current-day").innerHTML = dayChip(current);
    byId("px-plan-next-day").innerHTML = dayChip(next);
    setText("px-plan-title", `${current.querySelector("h3")?.textContent?.trim() || ""} ${current.querySelector(".plan-date")?.textContent?.trim() || ""}`.trim());

    const rows = $$(".plan-slot", current);
    byId("px-plan-meals").innerHTML = rows.map((row, index) => {
      const label = $("label", row)?.textContent?.trim() || "Repas";
      const select = $("select", row);
      const chosen = select?.selectedOptions?.[0]?.textContent?.split("·")?.[0]?.trim() || "";
      const empty = !select?.value;
      const icons = ["🌅", "☀️", "🌙", "🌿"];
      return `<button type="button" class="px-plan-meal-row" data-plan-slot-index="${index}">
        <span class="px-plan-meal-icon">${icons[index] || "🍴"}</span>
        <span><small>${esc(label)}</small><strong>${empty ? "Ajouter un repas" : esc(chosen)}</strong></span>
        ${svgIcon("chevron")}
      </button>`;
    }).join("");

    const count = byId("mega-shopping-count")?.textContent?.match(/\d+/)?.[0] || "0";
    setText("px-shopping-badge", count);
    setText("px-shopping-label", `${count} article${count === "1" ? "" : "s"} à acheter`);
  }

  function renderProgress(account) {
    if (!byId("px-week-steps") || !account) return;
    let period = null;
    let prev = null;
    try {
      if (typeof window.w2AggregatePeriod === "function") {
        period = window.w2AggregatePeriod(6, 0);
        prev = window.w2AggregatePeriod(13, 7);
      }
    } catch {}

    const weights = (account.weightHistory || [])
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => {
        const aStamp = Date.parse(a.entry?.createdAt || "");
        const bStamp = Date.parse(b.entry?.createdAt || "");
        const aDay = Date.parse(`${a.entry?.date || ""}T12:00:00`);
        const bDay = Date.parse(`${b.entry?.date || ""}T12:00:00`);
        const av = Number.isFinite(aStamp) ? aStamp : (Number.isFinite(aDay) ? aDay : 0) + a.index;
        const bv = Number.isFinite(bStamp) ? bStamp : (Number.isFinite(bDay) ? bDay : 0) + b.index;
        return av - bv;
      })
      .map(({ entry }) => entry)
      .slice(-7);
    if (weights.length) {
      const last = Number(weights.at(-1).weight) || 0;
      const previous = weights.length > 1 ? Number(weights.at(-2).weight) || 0 : null;
      const latestDelta = previous === null ? null : Math.round((last - previous) * 10) / 10;
      setText("px-weight-main", previous !== null ? `${String(previous).replace(".", ",")} → ${String(last).replace(".", ",")} kg` : `${String(last).replace(".", ",")} kg`);
      setText("px-weight-delta", latestDelta === null ? "Première mesure" : `${latestDelta > 0 ? "+" : ""}${String(latestDelta).replace(".", ",")} kg`);
      byId("px-weight-delta")?.classList.toggle("negative", latestDelta !== null && latestDelta > 0);

      const distinctDays = new Set(weights.map((entry) => entry.date)).size;
      if (weights.length === 1) {
        setText("px-chart-delta", "--");
        setText("px-chart-delta-label", "première mesure");
      } else if (distinctDays === 1) {
        setText("px-chart-delta", `${latestDelta > 0 ? "+" : ""}${String(latestDelta).replace(".", ",")} kg`);
        setText("px-chart-delta-label", "dernière variation");
      } else {
        const first = Number(weights[0].weight) || 0;
        const periodDelta = Math.round((last - first) * 10) / 10;
        setText("px-chart-delta", `${periodDelta > 0 ? "+" : ""}${String(periodDelta).replace(".", ",")} kg`);
        setText("px-chart-delta-label", "sur les 7 derniers jours");
      }
    } else {
      setText("px-weight-main", "--");
      setText("px-weight-delta", "Ajoute une pesée");
      setText("px-chart-delta", "--");
      setText("px-chart-delta-label", "aucune donnée");
    }

    if (period) {
      const avgSteps = Math.round((period.stepsPct || 0) / 100 * (Number(account.objectifPas) || 10000));
      setText("px-week-steps", avgSteps ? `${avgSteps.toLocaleString("fr-FR")} / jour` : "--");
      setText("px-week-kcal", period.calories ? `${Math.round(period.calories).toLocaleString("fr-FR")} kcal / jour` : "--");
      setText("px-week-sleep", period.sleep ? `${Math.floor(period.sleep)} h ${String(Math.round((period.sleep % 1) * 60)).padStart(2, "0")}` : "--");
      if (prev) {
        const deltaPct = (cur, old) => old ? Math.round((cur - old) / old * 100) : null;
        const s = deltaPct(period.stepsPct, prev.stepsPct);
        const k = deltaPct(period.calories, prev.calories);
        const hasPreviousSleep = Number(prev.sleep) > 0;
        const sleepMinutes = hasPreviousSleep ? Math.round((period.sleep - prev.sleep) * 60) : null;
        setText("px-week-steps-delta", s === null ? "Cette semaine" : `${s >= 0 ? "↑" : "↓"} ${Math.abs(s)} %`);
        setText("px-week-kcal-delta", k === null ? "kcal / jour" : `${k >= 0 ? "↑" : "↓"} ${Math.abs(k)} %`);
        setText(
          "px-week-sleep-delta",
          !period.sleep
            ? "Cette semaine"
            : !hasPreviousSleep
              ? "Première mesure"
              : `${sleepMinutes >= 0 ? "↑" : "↓"} ${Math.abs(sleepMinutes)} min`
        );
      }
    }

    renderWeightChart(account);
  }

  function renderWeightChart(account) {
    const target = byId("px-weight-chart-clone");
    if (!target) return;
    const data = (account.weightHistory || [])
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => {
        const aStamp = Date.parse(a.entry?.createdAt || "");
        const bStamp = Date.parse(b.entry?.createdAt || "");
        const aDay = Date.parse(`${a.entry?.date || ""}T12:00:00`);
        const bDay = Date.parse(`${b.entry?.date || ""}T12:00:00`);
        const av = Number.isFinite(aStamp) ? aStamp : (Number.isFinite(aDay) ? aDay : 0) + a.index;
        const bv = Number.isFinite(bStamp) ? bStamp : (Number.isFinite(bDay) ? bDay : 0) + b.index;
        return av - bv;
      })
      .map(({ entry }) => entry)
      .slice(-7);
    if (!data.length) {
      target.innerHTML = '<div class="px-chart-empty">Ajoute des pesées pour voir ta courbe.</div>';
      return;
    }
    const values = data.map((x) => Number(x.weight)).filter(Number.isFinite);
    const min = Math.min(...values) - 0.5;
    const max = Math.max(...values) + 0.5;
    const range = Math.max(1, max - min);
    const points = data.map((entry, i) => ({
      x: data.length === 1 ? 50 : 7 + i * (86 / (data.length - 1)),
      y: 82 - ((Number(entry.weight) - min) / range) * 60,
      weight: Number(entry.weight),
      date: entry.date,
    }));
    const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
    const fill = `7,88 ${polyline} 93,88`;
    const duplicateDays = new Set(data.filter((entry, index, all) => all.some((other, otherIndex) => otherIndex !== index && other.date === entry.date)).map((entry) => entry.date));
    const dayNames = data.map((entry) => {
      const d = new Date(`${entry.date}T12:00:00`);
      if (Number.isNaN(d.getTime())) return "";
      const day = new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(d).replace(".", "");
      if (!duplicateDays.has(entry.date) || !entry.createdAt) return day;
      const time = new Date(entry.createdAt);
      return Number.isNaN(time.getTime()) ? day : `${day} ${time.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    });
    target.innerHTML = `
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Évolution du poids">
        <defs><linearGradient id="pxWeightFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4267ff" stop-opacity=".28"/><stop offset="1" stop-color="#4267ff" stop-opacity="0"/></linearGradient></defs>
        <g class="px-chart-grid-lines"><line x1="7" x2="93" y1="24" y2="24"/><line x1="7" x2="93" y1="53" y2="53"/><line x1="7" x2="93" y1="82" y2="82"/></g>
        <polygon points="${fill}" fill="url(#pxWeightFill)"/>
        <polyline points="${polyline}" fill="none" stroke="#5270ff" stroke-width="1.8" vector-effect="non-scaling-stroke"/>
        ${points.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="1.8" fill="#5d79ff" vector-effect="non-scaling-stroke"/>`).join("")}
      </svg>
      <div class="px-chart-axis">${dayNames.map((d) => `<span>${esc(d)}</span>`).join("")}</div>
    `;
  }

  function syncPremiumUI() {
    const account = dataAccount();
    if (!account) return;
    syncHome(account);
    syncNutrition(account);
    renderPlan();
    renderProgress(account);
  }

  function featureNodes(key) {
    const r = references;
    const map = {
      coach: [r.home.coach],
      challenges: [r.home.challenges],
      motivation: [r.home.motivation, r.home.streak],
      rewards: [r.home.rewards],
      recipes: [r.nutrition.forYou, r.nutrition.smart, r.nutrition.recipeNav, r.nutrition.recipeList, r.nutrition.recipeDetail],
      favorites: [r.nutrition.favoriteCollections, r.nutrition.favoriteList],
      "week-plan": [r.plan.planner],
      shopping: [r.plan.shopping],
      "week-progress": [r.progress.insights, r.progress.history, r.progress.weekly, r.progress.badges, r.progress.calendar],
      weight: [r.progress.body],
      "nutrition-details": [r.progress.macros],
      "body-all": [r.progress.body, r.progress.photos],
      measurements: [r.progress.body],
      photos: [r.progress.photos],
    };
    return (map[key] || []).filter(Boolean);
  }

  function featureTitle(key) {
    const map = {
      coach: ["Coach du jour", "CONSEILS"], challenges: ["Défis du jour", "MOTIVATION"], motivation: ["Motivation & série", "MOTIVATION"], rewards: ["Roue de récompense", "RÉCOMPENSE"],
      recipes: ["Recettes", "NUTRITION"], favorites: ["Favoris", "NUTRITION"], "week-plan": ["Planning de la semaine", "PLAN"], shopping: ["Liste de courses", "PLAN"],
      "week-progress": ["Cette semaine", "PROGRÈS"], weight: ["Poids & mensurations", "CORPS"], "nutrition-details": ["Macros & nutrition", "PROGRÈS"], "body-all": ["Corps", "PROGRÈS"], measurements: ["Mensurations", "CORPS"], photos: ["Photos de progression", "CORPS"],
    };
    return map[key] || ["Détails", "WELLNESS"];
  }

  function bindGlobalActions() {
    document.addEventListener("click", (event) => {
      const notify = event.target.closest(".px-notification-trigger");
      if (notify) return byId("w2-notification-button")?.click();

      const waterAdjust = event.target.closest("[data-water-adjust]");
      if (waterAdjust) {
        const delta = Number(waterAdjust.dataset.waterAdjust) || 0;
        const targetId = delta < 0 ? "retirer-eau" : "ajouter-eau";
        byId(targetId)?.click();
        window.setTimeout(syncPremiumUI, 40);
        return;
      }

      const journalEdit = event.target.closest("[data-journal-edit]");
      if (journalEdit) {
        if (typeof window.megaOpenJournalEditor === "function") {
          window.megaOpenJournalEditor(journalEdit.dataset.journalEdit);
        }
        return;
      }

      const journalDelete = event.target.closest("[data-journal-delete]");
      if (journalDelete) {
        const id = journalDelete.dataset.journalDelete;
        if (typeof window.supprimerEntreeJournal === "function" && confirm("Supprimer cet ajout du journal ?")) {
          window.supprimerEntreeJournal(id);
        }
        return;
      }

      const action = event.target.closest("[data-ux-action]");
      if (action) {
        const key = action.dataset.uxAction;
        if (key === "water") byId("ajouter-eau")?.click();
        if (key === "steps") byId("ouvrir-modal-pas")?.click();
        if (key === "food") byId("w2-open-food-search")?.click();
        if (key === "barcode") byId("w2-open-barcode")?.click();
        if (key === "photo") byId("w2-open-meal-photo")?.click();
        if (key === "wellness") openFeatureSheet("Sommeil, humeur & énergie", [references.progress.wellness], "BIEN-ÊTRE");
        return;
      }

      const mealToggle = event.target.closest("[data-meal-toggle]");
      if (mealToggle) {
        const map = { "Petit-déjeuner": "petit-dejeuner", "Déjeuner": "dejeuner", "Dîner": "diner" };
        byId(map[mealToggle.dataset.mealToggle])?.click();
        return window.setTimeout(syncPremiumUI, 60);
      }

      const journal = event.target.closest("[data-journal-slot]");
      if (journal) {
        const meal = byId("w2-portion-meal");
        if (meal && journal.dataset.journalSlot) meal.value = journal.dataset.journalSlot;
        byId("w2-open-food-search")?.click();
        return;
      }

      const feature = event.target.closest("[data-open-feature]");
      if (feature) {
        const key = feature.dataset.openFeature;
        const [title, kicker] = featureTitle(key);
        openFeatureSheet(title, featureNodes(key), kicker);
        return;
      }

      const setting = event.target.closest("[data-settings]");
      if (setting) {
        const key = setting.dataset.settings;
        const labels = {
          account: ["Compte & profil", "ESSENTIEL"], goal: ["Mon objectif", "ESSENTIEL"], nutrition: ["Nutrition & préférences", "ESSENTIEL"], reminders: ["Rappels", "ESSENTIEL"], appearance: ["Apparence", "ESSENTIEL"],
          backup: ["Sauvegarde", "DONNÉES"], export: ["Export", "DONNÉES"], advanced: ["Réglages avancés", "PLUS"], cloud: ["Cloud", "PLUS"], ai: ["Analyse IA", "PLUS"],
        };
        const [title, kicker] = labels[key] || ["Réglages", "MOI"];
        openFeatureSheet(title, references.profile[key] || [], kicker);
        return;
      }

      const planDay = event.target.closest("[data-plan-day]");
      if (planDay) {
        const cards = plannerCards();
        if (!cards.length) return;
        const dir = planDay.dataset.planDay === "next" ? 1 : -1;
        const nextIndex = plannerDayIndex + dir;
        if (nextIndex < 0) {
          byId("mega-plan-prev")?.click();
          plannerDayIndex = 6;
          return window.setTimeout(renderPlan, 80);
        }
        if (nextIndex >= cards.length) {
          byId("mega-plan-next")?.click();
          plannerDayIndex = 0;
          return window.setTimeout(renderPlan, 80);
        }
        plannerDayIndex = nextIndex;
        renderPlan();
        return;
      }

      const chip = event.target.closest(".px-day-chip");
      if (chip) {
        if (chip.id === "px-plan-prev-day") plannerDayIndex = Math.max(0, plannerDayIndex - 1);
        if (chip.id === "px-plan-next-day") plannerDayIndex = Math.min(plannerCards().length - 1, plannerDayIndex + 1);
        return renderPlan();
      }

      const planSlot = event.target.closest("[data-plan-slot-index]");
      if (planSlot) {
        const card = plannerCards()[plannerDayIndex];
        const source = $$(".plan-slot", card)[Number(planSlot.dataset.planSlotIndex)];
        return openPlannerEditor(source);
      }
    });
  }

  function observeAppChanges() {
    const observer = new MutationObserver(() => {
      window.clearTimeout(observeAppChanges.timer);
      observeAppChanges.timer = window.setTimeout(syncPremiumUI, 30);
    });
    observer.observe(vault, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["value", "class"] });
    ["input", "change"].forEach((eventName) => document.addEventListener(eventName, () => window.setTimeout(syncPremiumUI, 40), true));
  }

  function init() {
    moveGlobalOverlays();
    simplifyMainNavigation();
    transformHome();
    transformNutrition();
    transformPlan();
    transformProgress();
    transformProfile();
    createFeatureSheet();
    createPlannerEditor();
    bindGlobalActions();
    document.documentElement.classList.add("premium-v3");

    // The engine scripts execute immediately after this file. The timeout lets
    // app.js/features.js/wellness2.js create their first data render before sync.
    window.setTimeout(() => {
      plannerDayIndex = plannerInitialIndex(plannerCards());
      syncPremiumUI();
      observeAppChanges();
      window.setInterval(() => {
      if (document.visibilityState === "visible") syncPremiumUI();
    }, 3000);
    }, 180);
  }

  window.WellnessUX = {
    showTab(group, key) {
      if (group === "progress") {
        if (key === "body") openFeatureSheet("Corps", featureNodes("body-all"), "PROGRÈS");
        if (key === "today") openFeatureSheet("Aujourd'hui", [references.progress.stats, references.progress.macros, references.progress.wellness], "PROGRÈS");
        if (key === "week") openFeatureSheet("Cette semaine", featureNodes("week-progress"), "PROGRÈS");
      }
      if (group === "nutrition") {
        if (key === "recipes") openFeatureSheet("Recettes", featureNodes("recipes"), "NUTRITION");
        if (key === "favorites") openFeatureSheet("Favoris", featureNodes("favorites"), "NUTRITION");
      }
    },
    getActiveTab() { return null; },
  };

  init();
})();
