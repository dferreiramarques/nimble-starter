'use strict';
// The app shell: sign-in gate, user menu, sync chip, help, and a tiny demo (a list of notes).
// Replace the "demo" part with your product; keep the shell and the Drive.change(doc) call after every edit.
(function () {
  var $ = function (s) { return document.querySelector(s); };
  // DOM builder: text always goes in as text (never innerHTML), so user-written text can't inject markup
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) { if (k === 'text') n.textContent = props[k]; else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), props[k]); else n.setAttribute(k, props[k]); });
    (kids || []).forEach(function (c) { n.append(c); });
    return n;
  }

  var doc = { notes: [] };

  // ── sync chip ──
  var chip = $('#sync');
  Drive.onStatus(function (state, text) {
    // the kit's .sync chip knows: (default) synced, saving, offline, error
    chip.hidden = false; chip.dataset.state = { syncing: 'saving', pending: 'offline', conflict: 'error', signedout: 'error' }[state] || state; chip.textContent = text;
    if (state === 'conflict') askConflict();
  });
  function askConflict() {
    NimbleUI.confirm({
      title: 'Changed in another tab or device',
      message: 'Drive has a newer copy than the one you started from. Keep what you see here (overwrites the newer copy) or load the newer copy (drops your latest edits)?',
      confirmLabel: 'Keep mine', cancelLabel: 'Load the newer copy'
    }).then(function (keepMine) {
      Drive.resolve(!!keepMine).then(function (d) { if (!keepMine) { doc = d || { notes: [] }; render(); } });
    });
  }

  // ── gate / user ──
  function showGate(msg) { $('#gate').hidden = false; $('#main').hidden = true; $('#user').hidden = true; chip.hidden = true; if (msg) $('#gate-msg').textContent = msg; }
  function showApp(u) {
    $('#gate').hidden = true; $('#main').hidden = false; $('#user').hidden = false;
    $('#user-name').textContent = (u && (u.given_name || u.name || u.email)) || '';
    $('#user-email').textContent = (u && u.email) || '';
    if (u && u.picture) $('#user-avatar').src = u.picture; else $('#user-avatar').hidden = true;
  }
  $('#btn-signout').addEventListener('click', function () { Drive.signOut().then(function () { showGate(); }); });

  var authError = new URLSearchParams(location.search).get('auth_error');
  var AUTH_MSG = { state: 'Sign-in was interrupted. Try again.', exchange: 'Google did not complete the sign-in. Try again.', scope: 'The app needs access to its private Drive folder. Try again and allow it.', no_refresh: 'Google did not allow a long-lived session. Try again.' };

  // ── help ──
  $('#btn-help').addEventListener('click', function () {
    NimbleUI.confirm({ title: 'How it works', message: 'Your data is saved to a private folder in your own Google Drive; this site keeps no copy. It keeps working offline and syncs when you are back. The chip at the top shows the state.', confirmLabel: 'Got it', cancelLabel: '' });
  });

  // ── demo: notes ──
  function render() {
    var box = $('#notes'); box.replaceChildren();
    doc.notes.forEach(function (n) {
      box.append(el('div', { class: 'listrow' }, [
        el('div', { class: 'listrow__main' }, [el('div', { class: 'listrow__title', text: n.text })]),
        el('button', { class: 'btn btn--text btn--sm', text: 'Delete', 'aria-label': 'Delete note', onclick: function () { doc.notes = doc.notes.filter(function (x) { return x.id !== n.id; }); changed(); } })
      ]));
    });
    $('#empty').hidden = doc.notes.length > 0;
  }
  function changed() { render(); Drive.change(doc); }
  $('#note-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = $('#note-text').value.trim(); if (!t) return;
    doc.notes.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: t });
    $('#note-text').value = ''; changed();
  });

  // ── start ──
  fetch('/api/config').then(function (r) { return r.json(); }).then(function (c) {
    if (!c.signIn) return showGate('Sign-in is not configured on this server.');
    Drive.load().then(function (d) {
      doc = d && Array.isArray(d.notes) ? d : { notes: [] };
      showApp(Drive.user()); render();
    }).catch(function (e) { showGate(e.auth ? (authError ? AUTH_MSG[authError] || 'Sign-in failed.' : '') : 'Couldn’t reach Google Drive. Check your connection and reload. Nothing was changed.'); });
  });
})();
