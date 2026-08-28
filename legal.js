(() => {
  "use strict";

  const VERSION = "5.6.0";
  const REPO = "https://github.com/gregorylaporte1810-gif/mon-app-alimentation";

  function markLiveRegions() {
    const selectors = [
      '[id^="message-"]',
      '[id$="-message"]',
      '#w2-barcode-result',
      '#w2-backup-message',
      '#w2-cloud-message',
      '#w2-photo-message',
      '#mega-reminder-message',
    ].join(',');
    document.querySelectorAll(selectors).forEach((element) => {
      if (!element.hasAttribute("role")) element.setAttribute("role", "status");
      if (!element.hasAttribute("aria-live")) element.setAttribute("aria-live", "polite");
      if (!element.hasAttribute("aria-atomic")) element.setAttribute("aria-atomic", "true");
    });
  }

  function syncNavigationState() {
    document.querySelectorAll(".navigation-principale .nav-bouton[data-page]").forEach((button) => {
      const page = document.getElementById(`page-${button.dataset.page}`);
      const current = button.classList.contains("active") || page?.classList.contains("active");
      if (current) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function installAllergyDisclaimer() {
    const grid = document.getElementById("w2-allergy-grid");
    if (!grid || document.getElementById("w56-allergy-note")) return;
    const note = document.createElement("p");
    note.id = "w56-allergy-note";
    note.className = "w56-allergy-note";
    note.textContent = "Allergies : les filtres Wellness sont indicatifs et basés sur les informations disponibles. En cas d’allergie, vérifie toujours l’étiquette et les traces éventuelles du produit.";
    grid.insertAdjacentElement("afterend", note);
  }

  function installLegalCard() {
    const page = document.getElementById("page-profil");
    if (!page || document.getElementById("w56-legal-card")) return;
    const card = document.createElement("section");
    card.id = "w56-legal-card";
    card.className = "carte w56-legal-card";
    card.setAttribute("aria-labelledby", "w56-legal-title");
    card.innerHTML = `
      <p class="sur-titre">Transparence</p>
      <h2 id="w56-legal-title">Confidentialité & sources</h2>
      <p>Wellness fonctionne localement par défaut. Le cloud Supabase, l’analyse photo et Apple Santé sont optionnels. Wellness ne contient ni publicité ni télémétrie publicitaire.</p>
      <p><strong>Ciqual :</strong> Anses. 2025. Table de composition nutritionnelle des aliments Ciqual.</p>
      <p><strong>Open Food Facts :</strong> données communautaires réutilisées sous Open Database License (ODbL) ; leur exactitude n’est pas garantie.</p>
      <div class="w56-legal-links">
        <a href="${REPO}/blob/main/PRIVACY.md" target="_blank" rel="noopener noreferrer">Politique de confidentialité</a>
        <a href="${REPO}/blob/main/THIRD_PARTY_NOTICES.md" target="_blank" rel="noopener noreferrer">Sources & licences</a>
        <a href="https://ciqual.anses.fr/" target="_blank" rel="noopener noreferrer">Anses Ciqual</a>
        <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener noreferrer">Open Food Facts</a>
      </div>
      <small>Wellness ${VERSION} · outil de suivi général, non dispositif médical.</small>
    `;
    page.appendChild(card);
  }

  function install() {
    markLiveRegions();
    syncNavigationState();
    installAllergyDisclaimer();
    installLegalCard();

    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === "attributes" && mutation.attributeName === "class")) {
        syncNavigationState();
      }
      if (mutations.some((mutation) => mutation.type === "childList")) markLiveRegions();
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();

  window.WellnessLegal = { version: VERSION, syncNavigationState, markLiveRegions };
})();
