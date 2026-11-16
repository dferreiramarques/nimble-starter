# Architecture and rules

The shape of a nimble app, and the rules that keep it simple and safe. Each rule is protected by a test; if a change needs to break one, discuss it first.

## The idea

```
Browser ── pages + /auth/* ──▶ Server (Express, stores nothing)
   │                               │
   │                               └─ exchanges Google codes/refresh tokens, nothing else
   └── Drive API (with a 1-hour access token) ──▶ the user's own Google Drive
```

- The **server is stateless.** No database, no files for user data, no tokens kept. Its only secrets are environment variables.
- The **user's data is a file** (`data.json`) in the app's private folder (`appDataFolder`) of their Google Drive. The browser reads and writes it directly with an access token.
- The **session** is a Google refresh token sealed (AES-256-GCM) in an httpOnly, same-site cookie in the user's browser. `/auth/refresh` turns it into a fresh 1-hour access token. If the user revokes access at Google, the next refresh fails with `invalid_grant` and the cookie is cleared.

## Server rules (`server.js`, `src/auth.js`)

1. **Stay stateless and secret-light.** The only secrets are `GOOGLE_CLIENT_SECRET` and `COOKIE_SECRET` (env vars). Do not add a database or write user data to disk without a deliberate decision.
2. **No inline scripts or `style=""`.** The CSP is `script-src 'self'`. Setting CSS custom properties from JS (`style.setProperty`) is fine. If a page needs another host, add it to `connect-src` on purpose.
3. **State-changing auth calls must come from this very site** (the `Origin` check on `/auth/refresh` and `/auth/logout`) and are rate limited.
4. **Ask for the least scope.** The default is `drive.appdata`. Add `drive.file` only if the app must create files the user can share.
5. **A failed sign-in leaves a reason**, not a silent loop: the callback redirects to `/app?auth_error=<code>` and the app explains it.

## Sync rules (`public/js/drive.js`)

1. **Never save after a failed or ambiguous load.** The app is read-only until `Drive.load()` succeeded.
2. **Never overwrite a newer Drive copy silently.** If Drive changed since we loaded, report a `conflict` and let the user choose (keep mine or load theirs).
3. **Offline edits are kept and retried.** Edits stay marked as unsaved (in `localStorage`), are retried with backoff and on the `online` event, and survive a reload.
4. **A different Google account never inherits another's data.** The local cache is keyed by the account.
5. **Edits made during a save stay unsaved** (the save only clears the flag if the document did not change meanwhile).

Your app calls `Drive.change(doc)` after every edit and reacts to `Drive.onStatus`. Everything else is the module's job.

## UI rules

1. **Dark and light change only colour.** Colours live in tokens per theme; sizes, spacing, radii and shadow geometry are defined once. Never put non-colour properties inside `[data-theme]` blocks. A test checks the kit's tokens and your `app.css`.
2. **User-written text is text.** Build DOM with `textContent` or the `el()` helper in `app.js`; `innerHTML` only for static icon markup.
3. **Phones:** keep the top bar to the essentials and move the rest into the account menu (see the kit's `docs/BREAKPOINTS.md`). Check at 375px with no horizontal scroll.
4. **Use the kit's behaviours** (`data-sortable`, `data-menu-toggle`, `NimbleUI.dialog`, `NimbleUI.toast`, `NimbleUI.confirm`) instead of writing new drag, menu or dialog code.

## Checklist for a new app

- [ ] `node scripts/init.mjs` run; privacy and terms written and reviewed
- [ ] Google OAuth client created; redirect URI added for local and production
- [ ] `.env` set locally; variables set on the host; `PUBLIC_URL` set
- [ ] Demo replaced; `Drive.change(doc)` called after every edit
- [ ] `npm test` green; app checked at 375px and in both themes
- [ ] Kit sync added to the kit's `apps.json` and workflow

## Adding a second document or sharing

The starter keeps **one** JSON document per user. If your app needs several files, or sharing between users, build on the same rules: one file per document in `appDataFolder` (or a public copy with `drive.file` for sharing, which must be revoked when the owner deletes or makes it private), and keep the "no save after a failed load" rule for each file.
