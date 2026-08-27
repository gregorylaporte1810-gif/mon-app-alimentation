const CACHE = "wellness-4.1.0";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./core-utils.js",
  "./hardening-core.js",
  "./hardening.js",
  "./data-foods.js",
  "./cloud.js",
  "./app.js",
  "./features.js",
  "./wellness2.js",
  "./ux-shell.js",
  "./native-bridge.js",
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
      .catch(() => caches.match(event.request).then(hit => hit || caches.match("./index.html")))
  );
});
