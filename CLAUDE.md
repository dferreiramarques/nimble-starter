# CLAUDE.md

Instructions for Claude Code in a nimble app built from this starter. Read `docs/ARCHITECTURE.md` first: it holds the rules.

## What this is
A small hosted app (Node + Express, vanilla JS, **no build step**) where people sign in with Google and keep their data in their own Google Drive. The server stores nothing.

## Commands
```bash
npm install
npm test                          # must stay green (node:test): sign-in vs a fake Google, sync rules vs a fake Drive, pages/headers, themes
node --env-file=.env server.js    # run locally (see .env.example)
node scripts/init.mjs "Name" --accent indigo --tagline "..."   # once, on a fresh copy of the template
```

## Rules that matter
1. **Dark/light changes only colours.** Colours live in tokens per theme; everything else is defined once in `:root`. Never put non-colour properties inside `[data-theme]` blocks.
2. **User-written text is text.** `textContent` or the `el()` helper; `innerHTML` only for static icon markup.
3. **No inline scripts or inline `style=""`** (the CSP forbids them). Setting CSS custom properties from JS is fine.
4. **The server stays stateless and secret-light.** No database, no user data on disk, no tokens stored. Secrets are env vars only.
5. **Drive sync safety (`public/js/drive.js`):** never save after a failed load; ask before overwriting a newer Drive copy; keep offline edits and retry; per-account cache. Add a test when changing it.
6. **Phones (≤ 700px):** the top bar keeps only the essentials; the rest lives in the account menu. No horizontal scroll at 375px.
7. **Keep it dependency-light** (Express only). Ask before adding a dependency or a database.
8. **Design system = nimbleUI** (github.com/dferreiramarques/nimbleui-design-system). `public/nimble/` is a copy: change the kit there, then copy over; never edit it by hand. `app.css` holds only what is specific to this app.

## Working style
- Commit and push only when asked. Verify UI changes in a real browser (preview pane), in both themes and at 375px.
- When a request is ambiguous and the answer changes the design, ask one short question; otherwise pick the sensible default and say what you chose.
- Don't paste secrets anywhere; they live in the host's variables.
