// GAME QUIZ service worker — cache estático, red para Supabase
const CACHE = "gamequiz-v59";
const ASSETS = ["./","./index.html","./css/style.css","./js/config.js","./js/audio.js","./js/fun.js","./js/crossword.js","./js/karsync.js","./js/karaoke.js","./js/impostor.js","./js/draw.js","./js/mojate.js","./js/tv.js","./js/theme.js","./js/app.js","./manifest.json"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;            // Supabase y fuentes: directo a la red
  if (u.pathname.includes("/data/")) {                  // preguntas: red primero, cache de respaldo
    e.respondWith(fetch(e.request).then(r => { const cl = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cl)); return r; }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
