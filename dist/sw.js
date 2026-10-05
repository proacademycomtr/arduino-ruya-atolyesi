/* Arduino Rüya Atölyesi — Service Worker (dist/ içinde çalışır)
   Strateji:
   - App shell (index.html) + manifest + icon: network-first, çevrimdışına cache fallback
   - Google Fonts: cache-first (statik, sürümlü URL'ler)
   - Diğer isteklere dokunmaz
   CACHE_NAME sürüm etiketi build.py tarafından her derlemede güncellenir. */
const CACHE_NAME = "arduino-ruya-atolyesi-v4.2.0";
// v4.0.0: config.js API adresini taşır; çevrimdışı kullanımda da doğru
// adresin bilinmesi için uygulama kabuğuna dahil edildi. build.py her
// derlemede bu dosyayı üretir, dolayısıyla addAll asla 404 ile düşmez.
const APP_SHELL = ["./", "./index.html", "./config.js", "./manifest.json", "./icon.svg"];

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
