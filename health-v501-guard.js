(() => {
  "use strict";

  const cap = window.Capacitor;
  const READ_TYPES = [
    "steps", "distance", "calories", "weight", "sleep",
    "restingHeartRate", "heartRateVariability", "vo2Max", "workouts"
  ];

  let applying = false;
  let lastState = null;

  function plugin() {
    return cap?.Plugins?.Health || null;
  }

  function isIosNative() {
    if (!cap) return false;
    const platform = cap.getPlatform?.();
    return (typeof cap.isNativePlatform === "function"
      ? cap.isNativePlatform()
      : platform === "ios") && platform === "ios";
  }

  function isMissingEntitlementError(error) {
    const text = String(error?.message || error || "").toLowerCase();
    return text.includes("com.apple.developer.healthkit") ||
      (text.includes("healthkit") && text.includes("entitlement")) ||
      text.includes("missing entitlement");
  }

  async function capabilityState() {
    const Health = plugin();
    if (!isIosNative() || !Health) {
      return { ok: false, kind: "unavailable", message: "HealthKit n'est pas disponible dans cette installation." };
    }

    try {
      const availability = await Health.isAvailable?.();
      if (availability?.available === false) {
        return { ok: false, kind: "unavailable", message: "HealthKit n'est pas disponible sur cet appareil." };
      }
    } catch (error) {
      return { ok: false, kind: "unavailable", message: error?.message || "HealthKit indisponible." };
    }

    try {
      // Cette méthode touche HealthKit assez tôt pour révéler un entitlement
      // manquant, sans ouvrir la feuille d'autorisation iOS.
      await Health.checkAuthorization?.({ read: READ_TYPES, write: ["weight"] });
      return { ok: true, kind: "ready" };
    } catch (error) {
      if (isMissingEntitlementError(error)) {
        return {
          ok: false,
          kind: "entitlement",
          message: "L'app installée ne possède plus l'entitlement HealthKit requis."
        };
      }
      // Une erreur d'autorisation classique ne signifie pas que l'entitlement
      // manque : on laisse alors le bouton Autoriser fonctionner.
      return { ok: true, kind: "ready", warning: error?.message || "" };
    }
  }

  function accountHealthState() {
    try {
      const a = obtenirCompteActif?.();
      return a?.v5?.health || null;
    } catch {
      return null;
    }
  }

  function removeFalseSyncTimestamp() {
    const h = accountHealthState();
    if (!h) return;
    if (h.last && !h.last.steps && !h.last.sleepHours && !h.last.weight &&
        !h.last.restingHeartRate && !h.last.activeCalories && !h.last.workouts) {
      delete h.last.syncedAt;
      h.entitlementBlocked = true;
      try { sauvegarderEtatApplication?.(); } catch {}
    }
  }

  function styleBlocked(card) {
    const badge = card.querySelector(".v5-health-head em");
    if (badge) {
      badge.textContent = "Bloqué par signature";
      badge.classList.add("v501-health-blocked-badge");
    }

    const intro = card.querySelector(":scope > p");
    if (intro) {
      intro.innerHTML =
        "Apple Santé est bien intégrée à Wellness, mais la version installée a perdu l'autorisation système <code>HealthKit</code> pendant la re-signature. " +
        "Le reste de Wellness fonctionne normalement.";
    }

    ["v5-health-authorize", "v5-health-sync", "v5-health-write-weight"].forEach((id) => {
      const button = document.getElementById(id);
      if (!button) return;
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    });

    const auto = document.getElementById("v5-health-auto");
    if (auto) {
      auto.checked = false;
      auto.disabled = true;
    }

    const status = document.getElementById("v5-health-status");
    if (status) {
      status.dataset.kind = "error";
      status.innerHTML =
        "⚠️ HealthKit non actif dans la signature installée. " +
        "<span class=\"v501-health-note\">Le bouton « Synchroniser » ne doit pas afficher de faux succès tant que ce point n'est pas résolu.</span>";
    }

    if (!card.querySelector(".v501-health-explain")) {
      const info = document.createElement("div");
      info.className = "v501-health-explain";
      info.innerHTML = `
        <strong>Pourquoi ?</strong>
        <span>AltStore/AltServer re-signe l'IPA et la version actuelle ne préserve pas encore correctement la capability HealthKit.</span>
        <small>La fonctionnalité restera prête dans Wellness pour le jour où le sideloader préservera cette capability, ou si l'app est installée avec une signature qui la conserve.</small>`;
      const autoLabel = card.querySelector(".v5-health-auto");
      autoLabel?.insertAdjacentElement("afterend", info);
    }
  }

  function styleReady(card) {
    card.querySelector(".v501-health-explain")?.remove();
    const badge = card.querySelector(".v5-health-head em");
    badge?.classList.remove("v501-health-blocked-badge");
    ["v5-health-authorize", "v5-health-sync", "v5-health-write-weight"].forEach((id) => {
      const button = document.getElementById(id);
      if (!button) return;
      button.disabled = false;
      button.removeAttribute("aria-disabled");
    });
    const auto = document.getElementById("v5-health-auto");
    if (auto) auto.disabled = false;
  }

  async function applyState() {
    if (applying) return;
    const card = document.getElementById("v5-health-card");
    if (!card) return;

    applying = true;
    try {
      const state = await capabilityState();
      lastState = state;
      if (state.kind === "entitlement") {
        removeFalseSyncTimestamp();
        styleBlocked(card);
      } else if (state.ok) {
        styleReady(card);
      }
    } finally {
      applying = false;
    }
  }

  // Bloque les anciennes actions V5.0 avant leurs listeners si l'entitlement
  // est absent. Cela évite le faux "Dernière synchro" observé en V5.0.
  document.addEventListener("click", async (event) => {
    const action = event.target.closest(
      "#v5-health-authorize, #v5-health-sync, #v5-health-write-weight"
    );
    if (!action) return;

    const state = lastState?.kind === "entitlement"
      ? lastState
      : await capabilityState();

    if (state.kind !== "entitlement") return;

    event.preventDefault();
    event.stopImmediatePropagation();
    await applyState();
  }, true);

  document.addEventListener("change", async (event) => {
    if (event.target?.id !== "v5-health-auto") return;
    const state = lastState?.kind === "entitlement"
      ? lastState
      : await capabilityState();
    if (state.kind !== "entitlement") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.target.checked = false;
    await applyState();
  }, true);

  const observer = new MutationObserver(() => {
    if (!applying && document.getElementById("v5-health-card")) {
      clearTimeout(observer._timer);
      observer._timer = setTimeout(applyState, 80);
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(applyState, 200);
  setTimeout(applyState, 1000);

  window.WellnessHealthGuardV501 = {
    version: "5.0.1",
    check: capabilityState,
    refresh: applyState,
  };
})();
