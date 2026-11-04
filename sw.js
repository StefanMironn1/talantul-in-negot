// Service worker: aplicația merge și fără internet, iar la fiecare deschidere ia versiunea nouă de pe server.
const CACHE = "talantul-v9";
const CORE = ["./", "index.html", "css/app.css", "js/config.js", "js/engine.js", "js/app.js", "js/data/bank_sam.js", "js/data/bank_nt.js", "js/data/bank_extra.js", "js/data/verses.js", "js/data/apocalipsa.js", "js/data/ghid_meta.js", "manifest.webmanifest", "icons/icon-192.png", "img/logo-mark.svg", "img/agape-full.svg", "img/agape-full-dark.svg"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {})); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // Supabase etc. merg direct
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, {ignoreSearch: true}).then(r => r || caches.match("index.html"))));
});
