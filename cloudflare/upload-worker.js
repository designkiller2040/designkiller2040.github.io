/*
 * Upload helper for the site editor (/admin/upload/), run as a Cloudflare Worker.
 *
 * The upload page sends films straight to Cloudflare Stream. It can't hold the
 * Cloudflare API token itself (anyone could read it), so it asks this Worker
 * for a one-time upload address instead. The Worker only hands one out to
 * people who can edit the site: it checks that their GitHub sign-in (the same
 * token they use for /admin/) has write access to the site's repository.
 *
 * Set up in the Cloudflare dashboard (see cloudflare/README.md):
 *   Secret    CF_API_TOKEN   API token with "Stream: Edit" permission
 *   Variable  CF_ACCOUNT_ID  your Cloudflare account ID
 * Optional variables (defaults below): GITHUB_REPO, ALLOWED_ORIGINS, MAX_MINUTES.
 *
 * Routes:
 *   POST /upload      tus "create upload" request; answers with Location = Cloudflare's upload address
 *   GET  /video/<id>  whether a video has finished processing
 */

const DEFAULTS = {
  GITHUB_REPO: 'designkiller2040/designkiller2040.github.io',
  ALLOWED_ORIGINS: 'https://designkiller2040.github.io,https://jonah-george.com,https://www.jonah-george.com',
  // Longest film accepted, in minutes. Caps what one upload can cost.
  MAX_MINUTES: '60',
};

export default {
  async fetch(request, env) {
    const conf = { ...DEFAULTS, ...env };
    const origin = request.headers.get('Origin') ?? '';
    const allowed = conf.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Tus-Resumable, Upload-Length, Upload-Metadata',
      'Access-Control-Expose-Headers': 'Location, Stream-Media-Id',
      Vary: 'Origin',
    };
    const reply = (status, body, headers = {}) =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json', ...headers },
      });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!allowed.includes(origin)) return reply(403, { error: 'This page is not allowed to upload.' });
    if (!conf.CF_API_TOKEN || !conf.CF_ACCOUNT_ID) return reply(500, { error: 'Upload helper is missing its Cloudflare settings.' });

    const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!(await canEditSite(token, conf.GITHUB_REPO))) {
      return reply(401, { error: 'Sign in to /admin/ with an account that can edit the site, then try again.' });
    }

    const url = new URL(request.url);
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
