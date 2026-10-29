# Editor helper (Cloudflare Worker): film uploads and password sign-in

`upload-worker.js` lets the upload page at `/admin/upload/` send films straight
to Cloudflare Stream and connect them to a project. It keeps the Cloudflare API
token out of the website, and only works for people who can edit the site
(same sign-in as `/admin/`).

It is set up once, by hand, in the Cloudflare dashboard. No secrets go in this repo.

1. **Stream on.** In the Cloudflare dashboard open **Stream** and turn it on (it's a paid add-on, billed per minute stored and watched).
2. **Account ID.** On the dashboard home page, open the menu next to your account name and choose **Copy account ID**. (It's also shown on the Workers & Pages overview.)
3. **API token.** Click your profile icon (top right) → **Profile** → **API Tokens** → **Create Token** → **Create Custom Token**.
   Name it `jonah-george-upload`. Under Permissions pick **Account** · **Stream** · **Edit**. Continue, create it, and copy it. You only see it once.
4. **The Worker.** **Workers & Pages** → **Create** → **Worker** (Hello World) → name it `jonah-george-upload` → **Deploy**.
   Then **Edit code**, replace everything with the contents of `upload-worker.js`, and click **Deploy**.
5. **Settings.** In the Worker open **Settings** → **Variables and Secrets** → **Add**:
   - `CF_ACCOUNT_ID`, type Text, value = the account ID from step 2
   - `CF_API_TOKEN`, type **Secret**, value = the token from step 3

   Then **Deploy**.
6. **Connect the page.** Copy the Worker's address (looks like `https://jonah-george-upload.<your-name>.workers.dev`)
   into `HELPER` near the top of the script in `public/admin/upload/index.html`. The address is not secret.

When the site moves to jonah-george.com, that domain is already allowed (see `ALLOWED_ORIGINS` in the Worker).

## Password sign-in

The same Worker also runs the editor's password sign-in. Whoever types the
password gets a sign-in pass (30 days); the editor sends its GitHub requests
through the Worker, which adds the GitHub key. The key never reaches the browser.

1. **GitHub key.** On GitHub: profile picture → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
   Name `jonah-george-editor`, expiration **No expiration** (or the longest offered),
   Repository access **Only select repositories** → `designkiller2040.github.io`.
   Permissions → Repository: **Contents: Read and write** (Metadata: Read-only is added automatically). Generate and copy it.
2. **Secrets.** In the Worker: **Settings** → **Variables and Secrets** → **Add**:
   - `GITHUB_TOKEN`, type **Secret**, value = the GitHub key from step 1
   - `ADMIN_PASSWORD`, type **Secret**, value = the password (a few random words is good)
3. **Code.** **Edit code**, replace everything with the new `upload-worker.js`, **Deploy**.

To change the password, edit `ADMIN_PASSWORD` and deploy; everyone signed in is signed out.
"GitHub token instead" under the password field still allows signing in with a personal GitHub token.

## Usage tab

`/admin/usage/` shows Stream minutes stored (against the plan) and minutes
watched this month, with any cost on top of the plan. The Worker answers it at
`GET /usage`. Storage comes from `CF_API_TOKEN`; minutes watched need one more
secret, `CF_ANALYTICS_TOKEN`: an API token with **Account** · **Account Analytics** · **Read**.
If the Stream plan includes some watched minutes each month, set the Text
variable `INCLUDED_DELIVERY_MINUTES` to that number (default 0).
