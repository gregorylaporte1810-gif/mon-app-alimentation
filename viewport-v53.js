(() => {
  "use strict";

  function compute() {
    const ua = navigator.userAgent || "";
    const sw = Number(window.screen?.width) || 0;
    const sh = Number(window.screen?.height) || 0;
    const iw = Number(window.innerWidth) || 0;
    const ih = Number(window.innerHeight) || 0;

    const phoneLike =
      /iPhone|iPod/i.test(ua) ||
      (/Macintosh/i.test(ua) && Math.min(sw, sh) <= 520);

    const deviceWidth = Math.max(1, Math.min(sw, sh));
    const portrait = ih >= iw;
    const ratio = deviceWidth > 0 ? iw / deviceWidth : 1;

    const active =
      phoneLike &&
      portrait &&
      deviceWidth <= 520 &&
      iw >= 460 &&
      ratio >= 1.18;

    const html = document.documentElement;

    if (!active) {
      html.classList.remove("v53-mobile-viewport-repair");
      html.style.removeProperty("--v53-device-width");
      html.style.removeProperty("--v53-mobile-scale");
      return;
    }

    html.classList.add("v53-mobile-viewport-repair");
    html.style.setProperty("--v53-device-width", `${deviceWidth}px`);
    html.style.setProperty("--v53-mobile-scale", String(Math.min(2.85, ratio)));
  }

  compute();

  let timer = 0;
  const delayed = () => {
    clearTimeout(timer);
    timer = setTimeout(compute, 120);
  };

  window.addEventListener("pageshow", delayed);
  window.addEventListener("orientationchange", delayed);
  window.addEventListener("resize", delayed);
})();
