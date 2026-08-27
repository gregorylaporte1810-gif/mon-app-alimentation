(() => {
  "use strict";

  const C = window.WellnessUsabilityCoreV53;
  const U = window.WellnessFoodUnits;
  if (!C) {
    console.error("[Wellness 5.3] ux-v53-core.js absent.");
    return;
  }

  const VERSION = "5.3.5";
  let observerTimer = 0;

  // =====================================================
  // PAS — LE TOTAL DU JOUR DEVIENT MODIFIABLE
  // =====================================================

  function stepsAccount() {
    try { return obtenirCompteActif(); } catch { return null; }
  }

  function ensureStepsEditor() {
    let overlay = document.getElementById("v53-steps-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "v53-steps-overlay";
    overlay.className = "modal-simple-overlay w2-bottom-sheet";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <section class="modal-simple v53-steps-sheet" role="dialog" aria-modal="true" aria-labelledby="v53-steps-title">
        <div class="modal-simple-header">
          <div>
            <p class="sur-titre">Pas du jour</p>
            <h2 id="v53-steps-title">👟 Corriger mes pas</h2>
          </div>
          <button type="button" class="fermer-modal-simple" id="v53-steps-close" aria-label="Fermer">✕</button>
        </div>
        <div class="modal-simple-contenu">
          <p class="v53-steps-help">Le total actuel est affiché ci-dessous. Utilise les raccourcis ou touche le champ seulement si tu veux saisir une valeur précise.</p>
          <label for="v53-steps-total">Total de pas aujourd'hui</label>
          <input id="v53-steps-total" type="number" min="0" step="1" inputmode="numeric" placeholder="Ex : 7250">
          <div class="v53-step-shortcuts">
            <button type="button" data-v53-step="-1000">− 1 000</button>
            <button type="button" data-v53-step="500">+ 500</button>
            <button type="button" data-v53-step="1000">+ 1 000</button>
            <button type="button" data-v53-step="5000">+ 5 000</button>
          </div>
          <p class="mega-inline-message" id="v53-steps-message"></p>
        </div>
        <div class="modal-simple-footer">
          <button type="button" class="bouton-secondaire" id="v53-steps-cancel">Annuler</button>
          <button type="button" id="v53-steps-save">Enregistrer le total</button>
        </div>
      </section>`;
    document.body.appendChild(overlay);

    const close = () => {
      try { megaCloseOverlay(overlay); }
      catch {
        overlay.classList.remove("ouverte");
        overlay.setAttribute("aria-hidden", "true");
      }
    };

    document.getElementById("v53-steps-close")?.addEventListener("click", close);
    document.getElementById("v53-steps-cancel")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });

    overlay.querySelectorAll("[data-v53-step]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = document.getElementById("v53-steps-total");
        const current = C.sanitizeSteps(input?.value) ?? 0;
        const delta = Number(button.dataset.v53Step) || 0;
        if (input) input.value = String(Math.max(0, current + delta));
      });
    });

    document.getElementById("v53-steps-save")?.addEventListener("click", () => {
      const input = document.getElementById("v53-steps-total");
      const message = document.getElementById("v53-steps-message");
      const value = C.sanitizeSteps(input?.value);

      if (value == null) {
        if (message) message.textContent = "⚠️ Saisis un nombre de pas valide.";
        return;
      }

      const account = stepsAccount();
      if (!account) return;

      account.pasEffectues = value;
      try { sauvegarderEtatApplication(); } catch {}
      try { sauvegarderProgressionDuJour(); } catch {}
      try { rafraichirApplication(); } catch {}
      try { w2Haptic(18); } catch {}
      close();
    });

    return overlay;
  }

  function openStepsEditor() {
    const account = stepsAccount();
    if (!account) return;

    const quick = document.getElementById("w2-quick-overlay");
    if (quick) {
      try { megaCloseOverlay(quick); } catch {}
    }

    const overlay = ensureStepsEditor();
    const input = document.getElementById("v53-steps-total");
    const message = document.getElementById("v53-steps-message");
    if (input) input.value = String(Math.max(0, Number(account.pasEffectues) || 0));
    if (message) message.textContent = "";

    try { megaOpenOverlay(overlay); }
    catch {
      overlay.classList.add("ouverte");
      overlay.setAttribute("aria-hidden", "false");
    }

    // V5.3.5 : ne pas forcer le focus sur iPhone.
    // Le clavier ne s'ouvre plus automatiquement et toute la fenêtre
    // reste visible. L'utilisateur touche le champ uniquement s'il
    // veut saisir le total au clavier.
    setTimeout(() => {
      input?.blur?.();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur?.();
      }
      document.querySelector(".v53-steps-sheet")?.scrollTo?.({ top: 0, behavior: "instant" });
    }, 80);
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest(
      '[data-ux-action="steps"], [data-w2-quick="steps"], #ouvrir-modal-pas'
    );
    if (!trigger) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    openStepsEditor();
  }, true);

  // Rend le bouton premium explicite pour VoiceOver / accessibilité.
  function markStepButtons() {
    document.querySelectorAll('[data-ux-action="steps"]').forEach((button) => {
      button.setAttribute("aria-label", "Pas du jour, toucher pour modifier le total");
      button.title = "Modifier les pas du jour";
    });
  }

  // =====================================================
  // LIQUIDES — mL / cL / L SANS PASSER PAR LES GRAMMES
  // =====================================================

  function syncLiquidObjects() {
    if (!U) return;

    [window.WELLNESS_FOODS, window.CIQUAL_FOODS].forEach((list) => {
      if (!Array.isArray(list)) return;
      list.forEach((food) => {
        if (C.isLiquid(food)) {
          food.liquid = true;
        }
      });
    });
  }

  function syncPortionInput() {
    const select = document.getElementById("w2-portion-unit");
    const input = document.getElementById("w2-portion-grams");
    if (!select || !input) return;

    const c = C.stepConstraints(select.value);
    input.min = String(c.min);
    input.max = String(c.max);
    input.step = String(c.step);

    const labels = { ml: "mL", cl: "cL", l: "L", g: "g", kg: "kg", unit: "unité" };
    [...select.options].forEach((option) => {
      option.textContent = labels[option.value] || option.textContent;
    });
  }

  document.addEventListener("change", (event) => {
    if (event.target?.id === "w2-portion-unit") {
      syncPortionInput();
    }
  });

  // =====================================================
  // AJOUT D'UN ALIMENT — FERME TOUTE LA FENÊTRE APRÈS VALIDATION
  // =====================================================

  function closeFoodParentsIfJournalChanged(beforeCount) {
    let afterCount = beforeCount;
    try { afterCount = obtenirCompteActif()?.journalCalories?.length || 0; } catch {}

    if (afterCount <= beforeCount) return;

    ["w2-portion-overlay", "w2-food-overlay", "w2-barcode-overlay"].forEach((id) => {
      const overlay = document.getElementById(id);
      if (!overlay) return;
      try { megaCloseOverlay(overlay); }
      catch {
        overlay.classList.remove("ouverte");
        overlay.setAttribute("aria-hidden", "true");
      }
    });

    document.activeElement?.blur?.();
  }

  const originalAddSelectedFood =
    typeof window.w2AddSelectedFood === "function"
      ? window.w2AddSelectedFood
      : (typeof w2AddSelectedFood === "function" ? w2AddSelectedFood : null);

  if (originalAddSelectedFood && !originalAddSelectedFood.__v53) {
    const wrapped = function wellness53AddSelectedFood(...args) {
      let before = 0;
      try { before = obtenirCompteActif()?.journalCalories?.length || 0; } catch {}
      const result = originalAddSelectedFood.apply(this, args);
      setTimeout(() => closeFoodParentsIfJournalChanged(before), 0);
      return result;
    };
    wrapped.__v53 = true;

    try { window.w2AddSelectedFood = wrapped; } catch {}
    try { w2AddSelectedFood = wrapped; } catch {}
  }

  // Le listener V4.2 est en capture et appelle la fonction globale : on garde
  // aussi une garde post-clic pour les navigateurs où l'affectation de fonction
  // globale n'est pas reflétée sur window.
  document.getElementById("w2-add-portion")?.addEventListener("click", () => {
    let before = 0;
    try { before = obtenirCompteActif()?.journalCalories?.length || 0; } catch {}
    setTimeout(() => closeFoodParentsIfJournalChanged(Math.max(0, before - 1)), 50);
  });


  // =====================================================
  // DOUBLE-TAP — EMPÊCHE LE ZOOM ACCIDENTEL
  // Le pincement à deux doigts reste disponible.
  // =====================================================

  let lastTouchEnd = 0;

  document.addEventListener("touchend", (event) => {
    if (event.changedTouches?.length !== 1) return;

    const now = Date.now();
    const elapsed = now - lastTouchEnd;
    lastTouchEnd = now;

    if (elapsed > 0 && elapsed < 320) {
      event.preventDefault();
    }
  }, { passive: false });

  // =====================================================
  // REFRESH
  // =====================================================

  function refresh() {
    markStepButtons();
    syncLiquidObjects();
    syncPortionInput();
  }

  const observer = new MutationObserver(() => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(refresh, 100);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  refresh();
  setTimeout(refresh, 400);

  window.WellnessUsabilityV53 = {
    version: VERSION,
    openStepsEditor,
    refresh,
  };
})();
