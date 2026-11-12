// Service worker. The build step (vite.config.ts → pwaPrecache) stamps the version and the precache file list below.
// - install: cache every file of this build (app code, content, figures) so the installed app works fully offline
// - navigations + content manifest: network first (fresh when online), cache fallback
// - everything else: cache first (files are content-hashed)
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `cglprep-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // add in small batches; one failed file must not break the install
    for (let i = 0; i < PRECACHE.length; i += 20) await Promise.all(PRECACHE.slice(i, i + 20).map((u) => c.add(u).catch(() => {})));
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('cglprep-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// the page asks the waiting worker to take over when the student taps "Update"
self.addEventListener('message', (e) => { if (e.data === 'skip-waiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Supabase etc. go straight to the network
  const networkFirst = req.mode === 'navigate' || url.pathname === '/content/manifest.json';
  if (networkFirst) {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r.ok) { const c = await caches.open(CACHE); c.put(req.mode === 'navigate' ? '/' : req, r.clone()); }
        return r;
      } catch {
        return (await caches.match(req.mode === 'navigate' ? '/' : req, { ignoreSearch: true, ignoreVary: true })) || Response.error();
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true, ignoreVary: true });
    if (hit) return hit;
    const r = await fetch(req);
    if (r.ok) { const c = await caches.open(CACHE); c.put(req, r.clone()); }
    return r;
  })());
});
