/*
 * Helper for the site editor (/admin/), run as a Cloudflare Worker.
 *
 * Password sign-in: the editor saves changes through GitHub, which needs a
 * GitHub key. The key lives here as a secret, never in the browser. Someone
 * who types the right password gets a sign-in pass (valid 30 days), and the
 * editor sends its GitHub requests through /github/, where this Worker swaps
 * the pass for the real key. Changing the password signs everyone out.
 *
 * Film uploads: the upload page sends films straight to Cloudflare Stream. It
 * can't hold the Cloudflare API token itself (anyone could read it), so it asks
 * this Worker for a one-time upload address instead. The Worker only hands one
 * out to people who can edit the site: a sign-in pass, or a GitHub sign-in with
 * write access to the site's repository.
 *
 * Set up in the Cloudflare dashboard (see cloudflare/README.md):
 *   Secret    CF_API_TOKEN    API token with "Stream: Edit" permission
 *   Variable  CF_ACCOUNT_ID   your Cloudflare account ID
 *   Secret    ADMIN_PASSWORD  the editor's password
 *   Secret    GITHUB_TOKEN    GitHub key with write access to the site's repository
 * Optional variables (defaults below): GITHUB_REPO, ALLOWED_ORIGINS, MAX_MINUTES.
 *
 * Routes:
 *   POST /login       { password } -> { token, expires }: a sign-in pass
 *   *    /github/...  GitHub's API (api.github.com/...), for a sign-in pass
 *   POST /upload      tus "create upload" request; answers with Location = Cloudflare's upload address
 *   GET  /video/<id>  whether a video has finished processing
 */

const DEFAULTS = {
  GITHUB_REPO: 'designkiller2040/designkiller2040.github.io',
  ALLOWED_ORIGINS: 'https://designkiller2040.github.io,https://jonah-george.com,https://www.jonah-george.com',
  // Longest film accepted, in minutes. Caps what one upload can cost.
  MAX_MINUTES: '60',
};

// Sign-in passes look like "jg1.<expiry>.<signature>"; the editor pages
// recognise the prefix and send GitHub requests here instead of to GitHub.
const PASS = 'jg1';
const PASS_DAYS = 30;

export default {
  async fetch(request, env) {
    const conf = { ...DEFAULTS, ...env };
    const origin = request.headers.get('Origin') ?? '';
    const allowed = conf.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        request.headers.get('Access-Control-Request-Headers') ?? 'Authorization, Content-Type, Tus-Resumable, Upload-Length, Upload-Metadata',
      'Access-Control-Expose-Headers': '*, Location, Stream-Media-Id',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    const reply = (status, body, headers = {}) =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json', ...headers },
      });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!allowed.includes(origin)) return reply(403, { error: 'This page is not allowed to use the editor helper.' });

    const url = new URL(request.url);
    const token = (request.headers.get('Authorization') ?? '').replace(/^(Bearer|token)\s+/i, '');

    if (url.pathname === '/login' || url.pathname.startsWith('/github/')) {
      if (!conf.ADMIN_PASSWORD || !conf.GITHUB_TOKEN) return reply(500, { error: 'Password sign-in is not set up yet (ADMIN_PASSWORD and GITHUB_TOKEN).' });
    }

    if (request.method === 'POST' && url.pathname === '/login') {
      const { password } = await request.json().catch(() => ({}));
      if (typeof password !== 'string' || !(await same(password, conf.ADMIN_PASSWORD))) {
        await new Promise((r) => setTimeout(r, 1500)); // slows down guessing
        return reply(401, { error: 'Wrong password.' });
      }
      const expires = Date.now() + PASS_DAYS * 24 * 60 * 60 * 1000;
      return reply(200, { token: `${PASS}.${expires}.${await sign(expires, conf)}`, expires });
    }

    if (url.pathname.startsWith('/github/')) {
      if (!(await validPass(token, conf))) return reply(401, { message: 'Bad credentials', error: 'Signed out. Sign in again at /admin/.' });
      const headers = new Headers(request.headers);
      for (const h of ['Host', 'Origin', 'Referer', 'Cookie']) headers.delete(h);
      for (const h of [...headers.keys()]) if (h.startsWith('cf-') || h.startsWith('x-forwarded')) headers.delete(h);
      headers.set('Authorization', `Bearer ${conf.GITHUB_TOKEN}`);
      headers.set('User-Agent', 'jonah-george-editor');
      const res = await fetch(`https://api.github.com/${url.pathname.slice('/github/'.length)}${url.search}`, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      });
      const out = new Headers(res.headers);
      for (const h of [...out.keys()]) if (h.startsWith('access-control-')) out.delete(h);
      for (const [h, v] of Object.entries(cors)) out.set(h, v);
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
    }

    if (!conf.CF_API_TOKEN || !conf.CF_ACCOUNT_ID) return reply(500, { error: 'Upload helper is missing its Cloudflare settings.' });
    if (!(await validPass(token, conf)) && !(await canEditSite(token, conf.GITHUB_REPO))) {
      return reply(401, { error: 'Sign in to /admin/ with an account that can edit the site, then try again.' });
    }

    const stream = `https://api.cloudflare.com/client/v4/accounts/${conf.CF_ACCOUNT_ID}/stream`;
    const auth = { Authorization: `Bearer ${conf.CF_API_TOKEN}` };

    if (request.method === 'POST' && url.pathname === '/upload') {
      const length = request.headers.get('Upload-Length');
      if (!length) return reply(400, { error: 'Missing file size.' });
      // Keep the film's name from the page, and add the length cap.
      const meta = (request.headers.get('Upload-Metadata') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.startsWith('name '));
      meta.push(`maxDurationSeconds ${btoa(String(Number(conf.MAX_MINUTES) * 60))}`);

      const res = await fetch(`${stream}?direct_user=true`, {
        method: 'POST',
        headers: { ...auth, 'Tus-Resumable': '1.0.0', 'Upload-Length': length, 'Upload-Metadata': meta.join(',') },
      });
      const location = res.headers.get('Location');
      if (!res.ok || !location) {
        return reply(502, { error: `Cloudflare refused the upload (${res.status}).`, detail: await res.text() });
      }
      return reply(201, undefined, {
        Location: location,
        'Stream-Media-Id': res.headers.get('stream-media-id') ?? '',
        'Tus-Resumable': '1.0.0',
      });
    }

    const video = url.pathname.match(/^\/video\/([0-9a-f]{32})$/i);
    if (request.method === 'GET' && video) {
      const res = await fetch(`${stream}/${video[1]}`, { headers: auth });
      if (!res.ok) return reply(res.status, { error: 'Video not found.' });
      const { result } = await res.json();
      return reply(200, {
        ready: !!result.readyToStream,
        state: result.status?.state ?? '',
        percent: Number(result.status?.pctComplete ?? 0),
        error: result.status?.errorReasonText ?? '',
        // Shown on the film's card in the project editor.
        name: result.meta?.name ?? '',
        size: result.size ?? null,
        uploaded: result.uploaded ?? null,
        duration: result.duration ?? 0,
      });
    }

    return reply(404, { error: 'Not found.' });
  },
};

/** True when the GitHub token belongs to someone with write access to the site's repository. */
async function canEditSite(token, repo) {
  if (!token) return false;
  const res = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'jonah-george-upload' },
  });
  if (!res.ok) return false;
  const data = await res.json();
  return !!data.permissions?.push;
}

/** The sign-in pass's signature: depends on the expiry date, the password and the GitHub key, so changing either signs everyone out. */
async function sign(expires, conf) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(conf.GITHUB_TOKEN), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${PASS}.${expires}.${conf.ADMIN_PASSWORD}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** True for an unexpired sign-in pass made by /login. */
async function validPass(token, conf) {
  const [prefix, expires, sig] = token.split('.');
  if (prefix !== PASS || !sig || !conf.ADMIN_PASSWORD || !conf.GITHUB_TOKEN) return false;
  if (!(Number(expires) > Date.now())) return false;
  return same(sig, await sign(Number(expires), conf));
}

/** Compares two strings in constant time (by their hashes), so timing doesn't give the password away. */
async function same(a, b) {
  const hash = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [x, y] = await Promise.all([hash(a), hash(b)]);
  return x.every((v, i) => v === y[i]);
}
