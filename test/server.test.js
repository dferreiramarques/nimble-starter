'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../server.js');

const listen = app => new Promise(ok => { const s = app.listen(0, () => ok({ base: `http://127.0.0.1:${s.address().port}`, close: () => new Promise(r => s.close(r)) })); });

// A stand-in for Google's OAuth endpoints, so the whole sign-in loop is tested without Google.
function fakeGoogle() {
  const tokOf = claims => 'x.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.y';
  const idTok = tokOf({ sub: 'u1', email: 'a@b.c', name: 'A B', given_name: 'A', picture: 'p' });
  const state = { revoked: [], mode: 'ok', scope: 'openid email https://www.googleapis.com/auth/drive.appdata', refresh: true };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', d => (body += d));
    req.on('end', () => {
      const p = Object.fromEntries(new URLSearchParams(body));
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/revoke') { state.revoked.push(p.token); return res.end('{}'); }
      if (p.grant_type === 'authorization_code') {
        if (p.client_secret !== 'SECRET' || p.code !== 'CODE1') { res.writeHead(400); return res.end('{"error":"invalid_grant"}'); }
        return res.end(JSON.stringify({ access_token: 'AT1', expires_in: 3599, scope: state.scope, id_token: idTok, ...(state.refresh ? { refresh_token: 'RT1' } : {}) }));
      }
      if (state.mode === 'revoked' || p.refresh_token !== 'RT1') { res.writeHead(400); return res.end('{"error":"invalid_grant"}'); }
      if (state.mode === 'down') { res.writeHead(503); return res.end('{}'); }
      res.end(JSON.stringify({ access_token: 'AT2', expires_in: 3599, scope: state.scope, id_token: idTok }));
    });
  });
  return new Promise(res => server.listen(0, () => res({ state, port: server.address().port, close: () => new Promise(r => server.close(r)) })));
}

test('sign-in: login redirect, code exchange, refresh, logout', async () => {
  const g = await fakeGoogle();
  const env = { APP_ID: 'demo', GOOGLE_CLIENT_ID: 'CID', GOOGLE_CLIENT_SECRET: 'SECRET', COOKIE_SECRET: 'cookie-secret',
    GOOGLE_AUTH_URL: `http://127.0.0.1:${g.port}/auth`, GOOGLE_TOKEN_URL: `http://127.0.0.1:${g.port}/token`, GOOGLE_REVOKE_URL: `http://127.0.0.1:${g.port}/revoke` };
  const s = await listen(createApp({ env }));
  const jar = {};
  const cookies = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  const eat = r => (r.headers.getSetCookie?.() || []).forEach(c => { const [kv] = c.split(';'); const i = kv.indexOf('='); if (/Max-Age=0/i.test(c)) delete jar[kv.slice(0, i)]; else jar[kv.slice(0, i)] = kv.slice(i + 1); });
  const call = async (p, o = {}) => { const r = await fetch(s.base + p, { redirect: 'manual', ...o, headers: { cookie: cookies(), ...(o.headers || {}) } }); eat(r); return r; };
  const ORIGIN = { Origin: s.base };
  try {
    assert.equal((await (await fetch(s.base + '/api/config')).json()).signIn, true);
    assert.equal((await call('/auth/refresh', { method: 'POST', headers: ORIGIN })).status, 401, 'no session yet');

    let r = await call('/auth/login');
    const loc = new URL(r.headers.get('location'));
    assert.equal(r.status, 302);
    assert.equal(loc.searchParams.get('access_type'), 'offline');
    assert.equal(loc.searchParams.get('redirect_uri'), `${s.base}/auth/callback`);
    assert.ok(loc.searchParams.get('scope').includes('drive.appdata'));
    assert.ok(jar.demo_state, 'CSRF state cookie uses the APP_ID prefix');

    r = await call('/auth/callback?code=CODE1&state=WRONG');
    assert.match(r.headers.get('location'), /auth_error=state/);
    assert.ok(!jar.demo_rt);

    r = await call('/auth/login'); const st = new URL(r.headers.get('location')).searchParams.get('state');
    r = await call(`/auth/callback?code=CODE1&state=${st}`);
    assert.equal(r.headers.get('location'), '/app');
    assert.ok(jar.demo_rt && !jar.demo_state);
    assert.ok(!Buffer.from(jar.demo_rt, 'base64url').toString().includes('RT1'), 'the refresh token is not readable in the cookie');

    r = await call('/auth/refresh', { method: 'POST', headers: ORIGIN });
    const b = await r.json();
    assert.equal(r.status, 200);
    assert.equal(b.access_token, 'AT2');
    assert.equal(b.user.email, 'a@b.c');
    assert.equal(r.headers.get('cache-control'), 'no-store');

    assert.equal((await call('/auth/refresh', { method: 'POST', headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await call('/auth/refresh', { method: 'POST' })).status, 403);

    g.state.mode = 'down';
    r = await call('/auth/refresh', { method: 'POST', headers: ORIGIN });
    assert.equal(r.status, 502); assert.ok(jar.demo_rt, 'a Google outage keeps the session');
    g.state.mode = 'revoked';
    r = await call('/auth/refresh', { method: 'POST', headers: ORIGIN });
    assert.equal(r.status, 401); assert.ok(!jar.demo_rt, 'a revoked grant clears the cookie');
    g.state.mode = 'ok';

    g.state.scope = 'openid email'; r = await call('/auth/login'); const st2 = new URL(r.headers.get('location')).searchParams.get('state');
    r = await call(`/auth/callback?code=CODE1&state=${st2}`);
    assert.match(r.headers.get('location'), /auth_error=scope/, 'refusing to continue without Drive access');
    g.state.scope = 'openid email https://www.googleapis.com/auth/drive.appdata'; g.state.refresh = false;
    r = await call('/auth/login'); const st3 = new URL(r.headers.get('location')).searchParams.get('state');
    r = await call(`/auth/callback?code=CODE1&state=${st3}`);
    assert.match(r.headers.get('location'), /auth_error=no_refresh/);
    g.state.refresh = true;

    r = await call('/auth/login'); const st4 = new URL(r.headers.get('location')).searchParams.get('state');
    await call(`/auth/callback?code=CODE1&state=${st4}`);
    r = await call('/auth/logout', { method: 'POST', headers: ORIGIN });
    assert.equal(r.status, 204);
    assert.ok(!jar.demo_rt && g.state.revoked.includes('RT1'), 'logout clears the cookie and revokes the token at Google');
  } finally { await s.close(); await g.close(); }
});

test('sign-in endpoints say so when Google is not configured', async () => {
  const s = await listen(createApp({ env: {} }));
  try {
    assert.equal((await (await fetch(s.base + '/api/config')).json()).signIn, false);
    assert.equal((await fetch(s.base + '/auth/login', { redirect: 'manual' })).status, 503);
    assert.equal((await fetch(s.base + '/auth/refresh', { method: 'POST', headers: { Origin: s.base } })).status, 503);
  } finally { await s.close(); }
});

test('pages, healthz and security headers', async () => {
  const s = await listen(createApp({ env: {} }));
  try {
    assert.deepEqual(await (await fetch(s.base + '/healthz')).json(), { ok: true });
    for (const p of ['/', '/app', '/privacy', '/terms']) assert.equal((await fetch(s.base + p)).status, 200, p);
    const r = await fetch(s.base + '/');
    const csp = r.headers.get('content-security-policy');
    assert.match(csp, /script-src 'self';/);
    assert.doesNotMatch(csp, /unsafe-inline/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-powered-by'), null);
  } finally { await s.close(); }
});

test('pages have no inline scripts, styles or handlers (the CSP forbids them)', () => {
  const dir = path.join(__dirname, '..', 'public');
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, f + ': inline script');
    assert.doesNotMatch(html, /\sstyle="/, f + ': inline style');
    assert.doesNotMatch(html, /\son[a-z]+="/, f + ': inline handler');
  }
});

test('themes only change colours: no non-colour property inside a [data-theme] block', () => {
  const colourOnly = css => {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, body] of clean.matchAll(/\[data-theme[^{]*\{([^}]*)\}/g)) {
      for (const d of body.split(';').map(x => x.trim()).filter(Boolean)) assert.match(d, /^(--[a-z0-9-]+|color-scheme)\s*:/, 'non-colour in a theme block: ' + d);
    }
  };
  colourOnly(fs.readFileSync(path.join(__dirname, '..', 'public', 'nimble', 'tokens.css'), 'utf8'));
  colourOnly(fs.readFileSync(path.join(__dirname, '..', 'public', 'app.css'), 'utf8'));
});

test('PWA: a manifest that makes the app installable, linked from both pages (no service worker by design)', async () => {
  const s = await listen(createApp({ env: {} }));
  try {
    const r = await fetch(s.base + '/manifest.webmanifest');
    assert.equal(r.status, 200);
    const m = await r.json();
    assert.equal(m.display, 'standalone');
    assert.equal(m.start_url, '/app');
    assert.ok(m.icons.length >= 1 && m.name);
    assert.match(await (await fetch(s.base + '/app')).text(), /data-install/, 'icon-only install button in the app');
    for (const p of ['/', '/app']) assert.match(await (await fetch(s.base + p)).text(), /rel="manifest" href="\/manifest\.webmanifest"/);
  } finally { await s.close(); }
});
