(() => {
  "use strict";

  const C = window.WellnessFinalCoreV52;
  if (!C) {
    console.error("[Wellness 5.2] final core absent.");
    return;
  }

  const VERSION = "5.2.0";
  let renderTimer = 0;
  let healthPatched = false;

  const esc = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  function account() {
    try { return obtenirCompteActif(); } catch { return null; }
  }

  function save() {
    try { sauvegarderEtatApplication(); } catch {}
  }

  function schedule() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderAll, 100);
  }

  // =====================================================
  // 1) GLOBAL FAB + LONG SCREEN BREATHING ROOM
  // =====================================================

  function markFab() {
    const fab = document.querySelector(".fab, .px-fab, [data-fab], .bouton-flottant, .action-flottante");
    if (fab) fab.classList.add("v52-fab");
  }

  // =====================================================
  // 2) TODAY EMPTY SCORE + COMPACT MOTIVATION FOOTER
  // =====================================================

  function polishToday() {
    const score = document.getElementById("px-health-score");
    const ring = document.getElementById("px-health-ring");
    const label = document.getElementById("px-health-label");

    if (score && ["--", "—", ""].includes(score.textContent.trim())) {
      score.textContent = "—";
      ring?.classList.add("v52-score-empty");
      if (label && /commence/i.test(label.textContent)) {
        label.textContent = "Ajoute tes premières données";
      }
    } else {
      ring?.classList.remove("v52-score-empty");
    }

    document.querySelector(".px-home-footer-grid")?.classList.add("v52-home-shortcuts");
  }

  // =====================================================
  // 3) NUTRITION EMPTY MEALS + SUGGESTIONS + DISABLED ACTIONS
  // =====================================================

  function polishNutrition() {
    document.querySelectorAll("#px-journal-list .px-journal-group").forEach((group) => {
      const empty = /aucun aliment/i.test(group.textContent || "") &&
        !group.querySelector(".px-journal-entry");
      group.classList.toggle("v52-empty-meal", empty);
      group.querySelectorAll("button").forEach((button) => {
        const text = C.normalize(button.textContent || "");
        if (empty && (text.includes("hier") || text.includes("enregistrer"))) {
          button.classList.add("v52-unavailable-action");
        } else {
          button.classList.remove("v52-unavailable-action");
        }
      });
    });

    document.querySelectorAll(".v43-suggestion strong, .v44-suggestion strong").forEach((el) => {
      el.classList.add("v52-two-lines");
    });
  }

  // =====================================================
  // 4) PROGRESS: FRENCH WEEK RANGE + CALENDAR + EMPTY GRAPH
  // =====================================================

  function progressWeekRange() {
    const card = document.getElementById("v44-weekly-card");
    if (!card) return;
    const state = account()?.v44;
    const currentStart = window.WellnessSmartCoreV44?.startOfWeek?.(
      typeof obtenirDateLocale === "function" ? obtenirDateLocale() : undefined
    );
    if (!currentStart) return;
    const end = window.WellnessSmartCoreV44.addDays(currentStart, 6);
    const label = C.frenchWeekRange(currentStart, end);
    const head = card.querySelector(".v44-section-head > span");
    if (head) head.textContent = label;
  }

  function polishCalendar() {
    const card = document.getElementById("v44-calendar-card");
    if (!card) return;
    card.classList.add("v52-calendar");
    const nav = card.querySelector(".v44-calendar-nav");
    if (nav) nav.classList.add("v52-calendar-nav");
  }

  function findWeightGraphCard() {
    const headings = [...document.querySelectorAll("#page-suivi h1, #page-suivi h2, #page-suivi h3, #page-suivi strong")];
    const heading = headings.find((el) => C.normalize(el.textContent).includes("evolution du poids"));
    return heading?.closest("section, .px-card, .carte, .w2-panel") || null;
  }

  function polishWeightGraph() {
    const card = findWeightGraphCard();
    if (!card) return;

    const empty = C.graphEmpty(card.textContent);
    card.classList.toggle("v52-empty-weight-graph", empty);

    let cta = card.querySelector(".v52-weight-cta");
    if (empty && !cta) {
      cta = document.createElement("button");
      cta.type = "button";
      cta.className = "v52-weight-cta";
      cta.textContent = "Ajouter mon poids";
      cta.addEventListener("click", () => {
        const page = document.getElementById("page-suivi");
        const candidates = [...(page?.querySelectorAll("button") || [])];
        const target = candidates.find((button) => /ajoute une pesée|ajouter.*poids|poids/i.test(button.textContent || ""));
        if (target && target !== cta) {
          target.click();
          return;
        }
        try {
          window.WellnessUX?.showTab?.("progress", "body");
        } catch {}
      });
      card.appendChild(cta);
    }
    if (!empty) cta?.remove();
  }

  // =====================================================
  // 5) HEALTHKIT TRUTHFUL STATUS + COMPACT WHEN BLOCKED/EMPTY
  // =====================================================

  function healthState() {
    const a = account();
    if (!a) return null;
    if (!a.v5 || typeof a.v5 !== "object") a.v5 = {};
    if (!a.v5.health || typeof a.v5.health !== "object") a.v5.health = {};
    return a.v5.health;
  }

  function isEntitlementError(error) {
    const text = String(error?.message || error || "").toLowerCase();
    return text.includes("com.apple.developer.healthkit") ||
      (text.includes("healthkit") && text.includes("entitlement")) ||
      text.includes("missing entitlement");
  }

  function markHealthBlocked(error) {
    if (!isEntitlementError(error)) return false;
    const h = healthState();
    if (!h) return false;
    h.entitlementBlocked = true;
    h.autoSync = false;
    if (h.last && !Object.entries(h.last).some(([key, value]) =>
      key !== "syncedAt" && Number(value) > 0
    )) {
      delete h.last.syncedAt;
    }
    save();
    setTimeout(polishHealth, 50);
    return true;
  }

  function patchHealthPlugin() {
    if (healthPatched) return;
    const Health = window.Capacitor?.Plugins?.Health;
    if (!Health) return;

    [
      "requestAuthorization",
      "checkAuthorization",
      "readSamples",
      "queryAggregated",
      "queryWorkouts",
      "saveSample",
    ].forEach((method) => {
      const original = Health[method];
      if (typeof original !== "function" || original.__v52) return;
      const wrapped = async function wellness52HealthGuard(...args) {
        try {
          return await original.apply(this, args);
        } catch (error) {
          markHealthBlocked(error);
          throw error;
        }
      };
      wrapped.__v52 = true;
      try { Health[method] = wrapped; } catch {}
    });
    healthPatched = true;
  }

  function polishHealth() {
    patchHealthPlugin();
    const card = document.getElementById("v5-health-card");
    const h = healthState();
    if (!card || !h) return;

    const display = C.healthDisplayState(h);
    card.dataset.v52HealthState = display.kind;
    card.classList.toggle("v52-health-compact", display.compact);

    const badge = card.querySelector(".v5-health-head em");
    if (badge) badge.textContent = display.label;

    const intro = card.querySelector(":scope > p");
    if (intro && display.kind === "blocked") {
      intro.innerHTML =
        "Apple Santé est intégrée à Wellness, mais l'app installée ne possède pas l'entitlement <code>HealthKit</code> requis après la signature.";
    } else if (intro && display.kind === "installed") {
      intro.textContent =
        "Intégration installée. Wellness affichera les mesures après une première synchronisation HealthKit réellement autorisée.";
    }

    const auto = document.getElementById("v5-health-auto");
    if (auto) {
      auto.disabled = display.kind === "blocked";
      if (display.kind === "blocked") auto.checked = false;
    }

    ["v5-health-authorize", "v5-health-sync", "v5-health-write-weight"].forEach((id) => {
      const button = document.getElementById(id);
      if (!button) return;
      button.disabled = display.kind === "blocked";
    });

    const status = document.getElementById("v5-health-status");
    if (status && display.kind === "blocked") {
      status.dataset.kind = "error";
      status.textContent = "⚠️ HealthKit bloqué par la signature installée. Le reste de Wellness fonctionne normalement.";
    }
  }

  // =====================================================
  // 6) SEARCH RELEVANCE
  // =====================================================

  function patchFoodSearch() {
    const api = window.WellnessSmartV44;
    const core = window.WellnessSmartCoreV44;
    if (!api?.searchFoods || api.searchFoods.__v52 || !core) return;

    const original = api.searchFoods.bind(api);
    const settingsLabels = [
      "Mon objectif",
      "Compte & profil",
      "Notifications",
      "Sauvegarde et restauration",
      "Apple Santé",
      "Personnaliser Aujourd'hui",
      "Apparence",
      "Cloud",
      "Export",
    ];

    const wrapped = function wellness52SearchFoods(query = "") {
      const raw = original(query) || [];
      const q = String(query || "").trim();
      if (!q) return raw;

      const settingsQuery = C.isLikelySettingsQuery(q, settingsLabels);
      const filtered = raw.filter((food) => {
        const strength = C.foodQueryStrength(food, q);
        if (settingsQuery) return strength >= 650;
        return strength >= 300 || core.foodSearchScore(food, q, {}) >= 50;
      });

      return filtered
        .map((food, index) => ({
          food,
          score: C.simpleFoodRank(food, q) - index * 0.01,
        }))
        .sort((a, b) => b.score - a.score)
        .map((row) => row.food);
    };

    wrapped.__v52 = true;
    api.searchFoods = wrapped;

    // V4.4 runtime may have copied its search function elsewhere.
    try {
      if (typeof w2SearchFoods !== "undefined") {
        w2SearchFoods = wrapped;
      }
    } catch {}
  }

  // =====================================================
  // 7) OFFLINE BADGE SAFE AREA
  // =====================================================

  function markNetworkPill() {
    document.getElementById("v51-network-pill")?.classList.add("v52-network-pill");
  }

  // =====================================================
  // 8) SETTINGS ICON DIFFERENTIATION
  // =====================================================

  function differentiateSettings() {
    document.querySelectorAll("#page-profil button, #page-profil .px-card").forEach((row) => {
      const text = C.normalize(row.textContent);
      const icon = row.querySelector(":scope > span, .px-feature-icon, .px-card-icon");
      if (!icon) return;
      if (text.startsWith("sauvegarde") && !icon.dataset.v52Icon) {
        icon.dataset.v52Icon = "backup";
        icon.textContent = "💾";
      } else if (text.startsWith("cloud") && !icon.dataset.v52Icon) {
        icon.dataset.v52Icon = "cloud";
        icon.textContent = "🔄";
      }
    });
  }

  // =====================================================
  // 9) SUBTLE TOP FADE WHILE SCROLLING
  // =====================================================

  function topFade() {
    let fade = document.getElementById("v52-top-fade");
    if (!fade) {
      fade = document.createElement("div");
      fade.id = "v52-top-fade";
      fade.setAttribute("aria-hidden", "true");
      document.body.appendChild(fade);
    }
    fade.classList.toggle("visible", window.scrollY > 90);
  }

  function renderAll() {
    markFab();
    polishToday();
    polishNutrition();
    progressWeekRange();
    polishCalendar();
    polishWeightGraph();
    polishHealth();
    patchFoodSearch();
    markNetworkPill();
    differentiateSettings();
    topFade();
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    // If HealthKit is already known blocked, stop misleading actions.
    if (["v5-health-authorize", "v5-health-sync", "v5-health-write-weight"].includes(button.id)) {
      const display = C.healthDisplayState(healthState() || {});
      if (display.kind === "blocked") {
        event.preventDefault();
        event.stopImmediatePropagation();
        polishHealth();
      }
    }
  }, true);

  window.addEventListener("scroll", topFade, { passive: true });
  window.addEventListener("online", schedule);
  window.addEventListener("offline", schedule);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") schedule();
  });

  renderAll();
  setTimeout(renderAll, 500);
  setTimeout(renderAll, 1500);

  window.WellnessFinalV52 = {
    version: VERSION,
    refresh: renderAll,
    markHealthBlocked,
  };
})();
