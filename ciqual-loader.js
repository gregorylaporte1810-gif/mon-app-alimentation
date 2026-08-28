(() => {
  "use strict";

  let loadPromise = null;

  function loadCiqual() {
    if (Array.isArray(window.CIQUAL_FOODS) && window.CIQUAL_FOODS.length) {
      return Promise.resolve(window.CIQUAL_FOODS);
    }

    if (loadPromise) return loadPromise;

    const baseFoods = Array.isArray(window.WELLNESS_FOODS)
      ? window.WELLNESS_FOODS
      : [];

    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");

      script.src = "data-foods-ciqual.js";
      script.async = true;
      script.dataset.ciqualLoader = "true";

      script.onload = () => {
        const ciqualFoods = Array.isArray(window.CIQUAL_FOODS)
          ? window.CIQUAL_FOODS
          : [];

        const foodKey = (food) =>
          String(food?.name || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();

        const existingKeys = new Set(baseFoods.map(foodKey));

        for (const food of ciqualFoods) {
          const key = foodKey(food);

          if (!key || existingKeys.has(key)) continue;

          baseFoods.push(food);
          existingKeys.add(key);
        }

        /*
         * On restaure volontairement la référence du tableau initial :
         * les modules déjà chargés voient alors immédiatement les
         * nouveaux aliments Ciqual.
         */
        window.WELLNESS_FOODS = baseFoods;

        window.dispatchEvent(
          new CustomEvent("wellness:ciqual-ready", {
            detail: {
              count: ciqualFoods.length,
            },
          }),
        );

        /*
         * Si une recherche est déjà saisie pendant le téléchargement,
         * on la relance une fois Ciqual disponible.
         */
        for (const selector of ["#w2-food-query", "#w2-modal-food-query"]) {
          const input = document.querySelector(selector);

          if (input?.value.trim()) {
            input.dispatchEvent(
              new Event("input", {
                bubbles: true,
              }),
            );
          }
        }

        resolve(ciqualFoods);
      };
      script.onerror = () => {
        loadPromise = null;
        reject(new Error("Impossible de charger la base Ciqual."));
      };

      document.head.appendChild(script);
    });

    return loadPromise;
  }

  function loadFromUserIntent() {
    loadCiqual().catch((error) => {
      console.warn("[Wellness Ciqual]", error);
    });
  }

  function install() {
    const selectors = [
      "#w2-food-query",
      "#w2-modal-food-query",
      "#w2-open-food-search",
      "#w2-food-search-button",
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!element) continue;

      element.addEventListener("focus", loadFromUserIntent, {
        once: true,
      });

      element.addEventListener("pointerdown", loadFromUserIntent, {
        once: true,
      });

      element.addEventListener("input", loadFromUserIntent, {
        once: true,
      });
    }
  }

  window.WellnessCiqual = {
    load: loadCiqual,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, {
      once: true,
    });
  } else {
    install();
  }
})();
