(() => {
  "use strict";

  const VERSION = "5.3.4";

  function closeBarcodeBehindPortion() {
    const barcode = document.getElementById("w2-barcode-overlay");
    const portion = document.getElementById("w2-portion-overlay");

    if (!barcode) return false;

    try {
      w2StopBarcodeCamera?.();
    } catch {}

    try {
      megaCloseOverlay(barcode);
    } catch {
      barcode.classList.remove("ouverte");
      barcode.setAttribute("aria-hidden", "true");
    }

    // Si "Choisir la quantité" vient juste d'ouvrir la fenêtre de portion,
    // on s'assure qu'elle reste bien la seule modale active.
    if (portion?.classList.contains("ouverte")) {
      portion.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-ouverte");
    }

    return true;
  }

  // Compatible avec l'ancien flux encore visible sur certains iPhone :
  // le bouton possède son propre listener qui ouvre la quantité.
  // On laisse ce listener travailler, puis on ferme immédiatement
  // la fenêtre Code-barres située derrière.
  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("#w2-add-barcode-product");
    if (!button) return;

    setTimeout(() => {
      closeBarcodeBehindPortion();
    }, 0);
  });

  window.WellnessBarcodeButtonCloseV534 = {
    version: VERSION,
    closeBarcodeBehindPortion,
  };
})();
