// Password sign-in: with a password, the editor gets a sign-in pass
// ("jg1.…") instead of a GitHub key. GitHub doesn't know that pass, so
// requests that carry it go to the editor helper (a Cloudflare Worker), which
// checks it and sends them on to GitHub with the real key. Requests signed in
// with a GitHub key go straight to GitHub as before.
// Load this first, before the editor and the other admin scripts.
(() => {
  const GITHUB = 'https://api.github.com/';
  const HELPER = 'https://jonah-george-upload.jonahmgeorge.workers.dev';
  const realFetch = window.fetch.bind(window);
  const isPass = (auth) => /^(Bearer|token)\s+jg1\./i.test(auth ?? '');

  window.JG_HELPER = HELPER;

  window.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.startsWith(GITHUB)) return realFetch(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!isPass(headers.get('Authorization'))) return realFetch(input, init);
    const to = `${HELPER}/github/${url.slice(GITHUB.length)}`;
    if (!(input instanceof Request)) return realFetch(to, init);
    const body = ['GET', 'HEAD'].includes(input.method) ? undefined : await input.arrayBuffer();
    return realFetch(to, { method: input.method, headers: input.headers, body, ...init });
  };
})();
