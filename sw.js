const CACHE = "wellness-5.4.0";
const ASSETS = [
  "./",
  "./index.html",
  "./theme-bootstrap.js",
  "./style.css",
  "./core-utils.js",
  "./hardening-core.js",
  "./hardening.js",
  "./data-foods.js",
  "./data-foods-ciqual.js",
  "./food-units-core.js",
  "./food-v42.js",
  "./daily-ux-core-v43.js",
  "./daily-ux-v43.js",
  "./smart-v44-core.js",
  "./smart-v44.js",
  "./cloud.js",
  "./app.js",
  "./features.js",
  "./wellness2.js",
  "./ux-shell.js",
  "./native-bridge.js",
  "./health-v5.js",
  "./health-v501-guard.js",
  "./polish-v51-core.js",
  "./polish-v51.js",
  "./final-v52-core.js",
  "./final-v52.js",
  "./viewport-v53.js",
  "./ux-v53-core.js",
  "./ux-v53.js",
  "./barcode-v532.js",
  "./barcode-v534.js",
  "./ota-updater.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
));

self.addEventListener("activate", event => event.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        const hit = await caches.match(event.request);
        if (hit) return hit;

        if (event.request.mode === "navigate") {
          return (await caches.match("./index.html")) ||
            new Response("Wellness hors ligne", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
        }

        return new Response("", { status: 504, statusText: "Offline resource unavailable" });
      })
  );
});
