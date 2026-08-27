(() => {
  "use strict";

  const VERSION = "5.3.2";

  function closeBarcodeThenOpenPortion(food) {
    if (!food) return false;

    try { w2StopBarcodeCamera?.(); } catch {}

    const barcodeOverlay = document.getElementById("w2-barcode-overlay");
    if (barcodeOverlay) {
      try { megaCloseOverlay(barcodeOverlay); }
      catch {
        barcodeOverlay.classList.remove("ouverte");
        barcodeOverlay.setAttribute("aria-hidden", "true");
      }
    }

    setTimeout(() => {
      try { w2OpenPortion(food); } catch {}
    }, 40);

    return true;
  }

  window.WellnessBarcodeFlowV532 = {
    version: VERSION,
    closeBarcodeThenOpenPortion,
  };
})();
