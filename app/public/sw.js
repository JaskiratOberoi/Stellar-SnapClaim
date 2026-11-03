/* SnapClaim service worker.
 *
 * Two jobs: make the site installable as a home-screen app, and tell the
 * page when a new build has been deployed so it can offer an Update button.
 * The build stamp below is written at image build time; a changed stamp
 * is what makes the browser treat the worker as new. Hashed bundles under
 * /_expo/ are kept in a cache named after the stamp; everything else goes
 * to the network, so pages and API calls are never stale.
 */
const BUILD = '__BUILD__';
const CACHE = `snapclaim-${BUILD}`;

self.addEventListener('install', () => {
  // Wait in the background until the page asks; the first worker has no page to wait for.
  if (!self.registration.active) self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('snapclaim-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/_expo/')) return;
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(event.request).then(
        (hit) =>
          hit ||
          fetch(event.request).then((res) => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          }),
      ),
    ),
  );
});
