(() => {
  "use strict";

  const VERSION = "5.4.1";
  let scheduled = 0;

  function swapJournalAndMeals() {
    const home = document.querySelector("#page-accueil .px-home-screen");
    const nutrition = document.querySelector("#page-recettes .px-nutrition-screen");
    if (!home || !nutrition) return false;

    const journal =
      document.querySelector("#page-accueil .px-journal-card") ||
      document.querySelector("#page-recettes .px-journal-card");

    const meals =
      document.querySelector("#page-recettes .px-meals-card") ||
      document.querySelector("#page-accueil .px-meals-card");

    if (!journal || !meals) return false;

    const journalAlreadyHome = home.contains(journal);
    const mealsAlreadyNutrition = nutrition.contains(meals);

    if (!journalAlreadyHome || !mealsAlreadyNutrition) {
      const journalParent = journal.parentNode;
      const mealsParent = meals.parentNode;

      if (!journalParent || !mealsParent) return false;

      const journalMarker = document.createComment("wellness-v541-journal");
      const mealsMarker = document.createComment("wellness-v541-meals");

      journal.replaceWith(journalMarker);
      meals.replaceWith(mealsMarker);

      // Le journal prend exactement l'ancienne place de la validation
      // des repas sur Aujourd'hui.
      mealsMarker.replaceWith(journal);

      // La validation des repas prend exactement l'ancienne place
      // du journal dans Nutrition.
      journalMarker.replaceWith(meals);
    }

    journal.classList.add("v541-journal-home");
    meals.classList.add("v541-meals-nutrition");

    const mealTitle = meals.querySelector(".px-section-row strong");
    if (mealTitle) mealTitle.textContent = "🍴 Validation des repas";

    meals.setAttribute("aria-label", "Validation des repas du jour");
    journal.setAttribute("aria-label", "Journal alimentaire du jour");

    return true;
  }

  function markResponsiveContainers() {
    document.querySelector("#page-recettes .px-nutrition-screen")
      ?.classList.add("v541-responsive-nutrition");
    document.querySelector("#page-accueil .px-home-screen")
      ?.classList.add("v541-responsive-home");
  }

  function apply() {
    markResponsiveContainers();
    swapJournalAndMeals();
  }

  function schedule() {
    clearTimeout(scheduled);
    scheduled = setTimeout(apply, 40);
  }

  apply();
  requestAnimationFrame(apply);
  setTimeout(apply, 250);
  setTimeout(apply, 900);

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("pageshow", schedule);
  window.addEventListener("resize", schedule);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") schedule();
  });

  window.WellnessLayoutV541 = {
    version: VERSION,
    refresh: apply,
    swapJournalAndMeals,
  };
})();
