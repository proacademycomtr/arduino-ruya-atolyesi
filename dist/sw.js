/* Arduino Rüya Atölyesi — Service Worker (dist/ içinde çalışır)
   Strateji:
   - App shell (index.html) + manifest + icon: network-first, çevrimdışına cache fallback
   - Google Fonts: cache-first (statik, sürümlü URL'ler)
   - Diğer isteklere dokunmaz
   CACHE_NAME sürüm etiketi build.py tarafından her derlemede güncellenir. */
const CACHE_NAME = "arduino-ruya-atolyesi-v2.20.0";
const APP_SHELL = ["./", "./index.html", "./manifest.json", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  // Google Fonts → cache-first
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.match(event.request).then((hit) =>
        hit || fetch(event.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return res;
        })
      )
    );
    return;
  }

  // Kendi kaynaklarımız → network-first, offline'da cache
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request).then((res) => {
        // Başarılı yanıtı cache'e koy (app shell güncel kalsın)
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      }).catch(() =>
        caches.match(event.request).then((hit) => hit || caches.match("./index.html"))
      )
    );
  }
});
