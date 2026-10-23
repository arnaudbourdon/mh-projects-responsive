// Service worker : met en cache la coquille de l'appli (HTML, JS, CSS, polices, icônes)
// pour l'ouvrir hors ligne. Les données ne passent jamais par ce cache : les appels
// à api.github.com sont ignorés ici, et les fichiers de données sont gardés par l'appli
// dans IndexedDB.
const CACHE = 'mhp-shell-v1';
// Racine de l'appli (« / » sur Cloudflare, « /mh-projects-responsive/ » sur GitHub Pages).
const ROOT = new URL(self.registration.scope).pathname;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // Vérification de nouvelle version (lib/update.ts) : toujours le réseau, jamais en cache.
  if (url.pathname.endsWith('/index.html')) return;

  // Pages : réseau d'abord, sans le cache HTTP du navigateur (GitHub Pages garde la page
  // 10 min : l'iPhone rouvrait l'ancienne version), sinon dernière page connue.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(ROOT, copy));
          }
          return res;
        })
        .catch(() => caches.match(ROOT)),
    );
    return;
  }

  // Scripts, styles, polices, icônes (noms versionnés par le build) : cache d'abord.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
