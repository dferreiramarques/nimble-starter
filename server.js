'use strict';
const path = require('node:path');
const express = require('express');
const { createAuth } = require('./src/auth');

// The server stores NOTHING. Every user's data lives in their own Google Drive (private app folder);
// this process only serves the pages and does the Google sign-in token exchange (src/auth.js).
function createApp(opts = {}) {
  const auth = createAuth(opts);
  const dir = path.join(__dirname, 'public');

  const app = express();
  app.set('trust proxy', 1);                // behind a host's proxy: real client IP, https
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      // No inline scripts or styles anywhere: keep it that way. Add hosts to connect-src deliberately.
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://*.googleusercontent.com; connect-src 'self' https://www.googleapis.com; frame-ancestors 'self'; base-uri 'none'; form-action 'self'"
    });
    next();
  });

  app.get('/healthz', (req, res) => res.json({ ok: true }));
  app.get('/api/config', (req, res) => res.json({ signIn: auth.enabled }));
  app.use('/auth', auth.router);

  app.get('/app', (req, res) => res.sendFile(path.join(dir, 'app.html')));
  app.use(express.static(dir, { index: 'index.html', extensions: ['html'] }));
  app.use((req, res) => res.status(404).sendFile(path.join(dir, 'index.html')));

  if (!auth.enabled) console.warn('Google sign-in is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / COOKIE_SECRET): /app cannot sign anyone in.');
  return app;
}

module.exports = { createApp };

if (require.main === module) {
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => console.log(`{{APP_NAME}} on port ${port}`));
}
