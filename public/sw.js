/*
 * Keeps a saved copy of the hover-preview clips (and project images) in the
 * browser, so after the first visit they show right away, even after a reload.
 *
 * Only files whose address carries a ?v=<fingerprint> are kept. The
 * fingerprint changes whenever the file is replaced, so a new upload is always
 * fetched fresh, and the old copy is thrown away.
 */
const CACHE = 'jg-media-v1';
const KEEP = /^\/(video\/previews|images)\//;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('jg-media-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  ),
);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !KEEP.test(url.pathname) || !url.searchParams.has('v')) return;
  e.respondWith(serve(req, url, e));
});

async function serve(req, url, e) {
  const cache = await caches.open(CACHE);
  const key = url.href;
  const hit = await cache.match(key);
  if (hit) return req.headers.has('range') ? ranged(hit, req.headers.get('range')) : hit;
  // Not saved yet: answer from the network as usual, and save the whole file in the background.
  e.waitUntil(save(cache, url));
  return fetch(req);
}

const saving = new Set();
async function save(cache, url) {
  if (saving.has(url.href)) return;
  saving.add(url.href);
  try {
    const res = await fetch(url.href, { cache: 'no-store' });
    if (res.status !== 200) return;
    await cache.put(url.href, res);
    // Drop older versions of the same file.
    for (const old of await cache.keys()) {
      const o = new URL(old.url);
      if (o.pathname === url.pathname && o.href !== url.href) await cache.delete(old);
    }
  } catch {
    // Offline or blocked: just try again next time.
  } finally {
    saving.delete(url.href);
  }
}

// Videos ask for pieces of the file ("bytes=0-"); cut that piece from the saved copy.
async function ranged(res, range) {
  const blob = await res.blob();
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  const size = blob.size;
  let start = m && m[1] ? Number(m[1]) : 0;
  let end = m && m[2] ? Number(m[2]) : size - 1;
  if (m && !m[1] && m[2]) (start = Math.max(0, size - Number(m[2]))), (end = size - 1);
  end = Math.min(end, size - 1);
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || blob.type || 'video/mp4',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
