// OMEN's service worker: enough to be installable and to open instantly.
//
// Only the app's own static files are cached (hashed bundles, fonts, icons).
// The page itself is network-first so a new release shows up on the next
// visit, and nothing under /api is ever touched: a balance or a quote must
// never come from a cache.
const CACHE = "omen-shell-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/app")) return;
  const hashed = url.pathname.startsWith("/app/_expo/") || url.pathname.startsWith("/app/assets/");
  if (hashed) {
    // Content-hashed: whatever is cached is right forever.
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }
  if (request.mode === "navigate")
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put("/app", copy));
          }
          return response;
        })
        .catch(() => caches.match("/app").then((hit) => hit || Response.error())),
    );
});
