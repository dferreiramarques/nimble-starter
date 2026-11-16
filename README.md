# nimble-starter

A starting point for a **Monco.io nimble app**: a small hosted web app where people sign in with Google and keep their data **in their own Google Drive**. The server stores nothing.

It gives you, working and tested from the first commit:

- **Express server** with a strict Content-Security-Policy, security headers, `/healthz`, and no database
- **Google sign-in** with a long-lived session (the refresh token is sealed in an encrypted, httpOnly cookie; the server keeps nothing)
- **Safe Drive sync** of one JSON document in the user's private app folder, with the rules that matter (no save after a failed load, conflict detection, offline retry, per-account cache)
- **nimbleUI** (the Monco.io design system): tokens, components, theme toggle (dark/light change only colour), attribute-driven behaviours
- **App shell**: sign-in gate, account menu, sync chip, "?" help, and a tiny demo (a list of notes) to replace
- **Product page** (`/`), **privacy** and **terms** pages, and the app at `/app`
- **Tests** that run without Google: the whole sign-in loop against a fake Google, and the sync rules against a fake Drive

## Start a new app

1. On GitHub, click **Use this template** (or copy this folder).
2. Fill in the placeholders once:

   ```bash
   node scripts/init.mjs "My App" --accent indigo --tagline "One sentence about what it does."
   ```

   `--accent` is `emerald`, `rose`, `indigo`, `amber` or `violet`; `--id` sets the short id used for cookie names (default: the name in lower case).
   It also draws the app icons (`public/icons/*.png`) and the favicon in the accent colour; replace them with your own artwork when you have it.
3. Create a Google OAuth client (see **Google setup**) and copy `.env.example` to `.env` with your values.
4. Run it:

   ```bash
   npm install
   npm run dev      # http://localhost:3000
   npm test
   ```
5. Write the sections of `public/privacy.html` and `public/terms.html` (they are marked, and should be reviewed by someone qualified), replace the demo in `public/js/app.js`, and replace the product-page copy in `public/index.html`.

## Google setup

In Google Cloud Console:

1. Create a project, enable the **Google Drive API**.
2. **OAuth consent screen**: add the scope `.../auth/drive.appdata` (private app folder only). Add your privacy and terms URLs.
3. **Credentials → OAuth client ID → Web application.** Authorized redirect URI: `<your site>/auth/callback` (for local development `http://localhost:3000/auth/callback`).
4. Put the client id and secret in `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) and a long random `COOKIE_SECRET`.

## Deploy

Any Node host works (Railway, Render, Fly…): start command `npm start`, set the variables from `.env.example` in the host's settings (never commit them), set `PUBLIC_URL` to your address and add the same address to the Google redirect URIs. There is no volume or database to provision.

## How it is organised

```
server.js            wiring: CSP, routes (/auth, /app, static)
src/auth.js          Google sign-in session (the only server logic)
public/index.html    product page            public/app.html + js/app.js   the app
public/js/drive.js   session + safe Drive sync of one JSON document
public/nimble/       the nimbleUI kit (copy; change it in the kit repo)
public/app.css       app-specific styles only
test/                server + sign-in (fake Google), sync rules (fake Drive)
scripts/init.mjs     fills in the placeholders of a fresh copy
docs/ARCHITECTURE.md the rules and why
```

The overview, in pictures: [the starter page](https://dferreiramarques.github.io/nimbleui-design-system/start.html). Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before changing the server or the sync: it lists the rules the tests protect.

## Keeping the design system current

`public/nimble/` is a copy of the [nimbleUI kit](https://github.com/dferreiramarques/nimbleui-design-system). Never edit it by hand: change the kit, then copy `src/tokens.css`, `components.css`, `theme.js` and `behaviors.js` over, or let the kit's `sync-apps` GitHub Action open the pull request (add this repo to its list in `tools/apps.json` and `.github/workflows/sync-apps.yml`).

## License

MIT.
