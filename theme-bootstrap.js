(() => {
  "use strict";
  const cleTheme = "wellnessTheme";
  const mode = localStorage.getItem(cleTheme) || "dark";
  const systemeSombre = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = mode === "system" ? (systemeSombre ? "dark" : "light") : mode;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themeMode = mode;
})();
