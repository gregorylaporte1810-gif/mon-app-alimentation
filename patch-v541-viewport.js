(() => {
  "use strict";

  // V5.4.1
  // L'ancien correctif V5.3 utilisait CSS `zoom` quand iOS exposait
  // un viewport anormalement large. Sur certains iPhone cela pouvait
  // justement créer une page miniature ou une bande vide à droite.
  //
  // On revient à la stratégie iOS normale : device-width + scale 1,
  // sans laisser un élément trop large forcer Safari à rétrécir la page.

  function normalizeViewport() {
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "width=device-width, initial-scale=1.0, minimum-scale=1.0, viewport-fit=cover, shrink-to-fit=no"
      );
    }

    const html = document.documentElement;
    html.classList.remove("v53-mobile-viewport-repair");
    html.style.removeProperty("--v53-device-width");
    html.style.removeProperty("--v53-mobile-scale");
  }

  normalizeViewport();

  let timer = 0;
  const delayed = () => {
    clearTimeout(timer);
    timer = setTimeout(normalizeViewport, 80);
  };

  window.addEventListener("pageshow", delayed);
  window.addEventListener("orientationchange", delayed);
  window.addEventListener("resize", delayed);
})();
