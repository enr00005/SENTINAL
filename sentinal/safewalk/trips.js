/* SENTINAL SafeWalk - plan a trip for later.
   Adds a "Plan a trip for later" card to the home screen. Self-contained; uses the app's own
   globals (S, api, toast, show). Trips are stored on the server (Trips.gs) so email reminders work
   even when the phone is locked, and cached here so the list shows offline. */
(function () {
  'use strict';
  if (window.SentinalTrips) return;

  var $ = function (id) { return document.getElementById(id); };
  var trips = [], pending = null, lastSync = 0, built = false, notified = {};
  try { notified = JSON.parse(localStorage.getItem('swNotified') || '{}'); } catch (e) {}
  try { trips = JSON.parse(localStorage.getItem('swTrips') || '[]'); } catch (e) { trips = []; }

  var CSS = [
    '#tripCard .th{font-size:1.1rem;font-weight:600}',
    '#tripCard .tq{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}',
    '#tripCard .tq button{width:auto;margin:0;min-height:44px;padding:8px 16px;border-radius:99px;font-size:.95rem;background:var(--s2);color:var(--mu)}',
    '#tripCard .tq button:active{background:var(--teal);color:#05211f}',
    '#tripCard input{margin:0}',
    '#tErr{color:var(--red);font-size:1rem;margin-top:10px;min-height:1em}',
    '#tList{margin-top:6px}',
    '#tList h3{margin:14px 0 8px;font-size:.85rem;letter-spacing:.12em;text-transform:uppercase;color:var(--mu);font-weight:600}',
    '.trip{border:1px solid var(--line);background:var(--s2);border-radius:14px;padding:12px 14px;margin-top:10px}',
    '.trip.due{border-color:var(--amb);box-shadow:0 0 0 1px var(--amb)}',
    '.trip .tt{display:flex;justify-content:space-between;gap:10px;align-items:baseline}',
    '.trip .tt b{overflow-wrap:anywhere}',
    '.trip .eta{font-variant-numeric:tabular-nums;font-weight:700;color:var(--teal);white-space:nowrap}',
    '.trip.due .eta{color:var(--amb)}',
    '.trip .td{color:var(--mu);font-size:.95rem;margin-top:2px}',
    '.trip .tb{display:flex;gap:10px;margin-top:10px}',
    '.trip .tb button{margin:0;min-height:44px;padding:10px;font-size:1rem}',
    '.trip .tb .cx{flex:0 0 auto;width:auto;padding:10px 18px;background:transparent;border:1px solid var(--line);color:var(--tx)}',
    '.tnote{color:var(--mu);font-size:.9rem;margin-top:12px}'
  ].join('\n');

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function localInput(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function err(m) { var e = $('tErr'); if (e) e.textContent = m || ''; }
  function homeVisible() { var h = $('vHome'); return !!h && !h.classList.contains('hide'); }

  function fmtWhen(ms) {
    return new Date(ms).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function fmtLeft(ms) {
    if (ms <= 0) return 'Time to leave!';
    var m = Math.round(ms / 60000);
    if (m < 1) return 'in under a minute';
    if (m < 60) return 'in ' + m + ' min';
    var h = Math.floor(m / 60); m = m % 60;
    if (h < 24) return 'in ' + h + ' h' + (m ? ' ' + m + ' min' : '');
    return 'in ' + Math.floor(h / 24) + ' d ' + (h % 24) + ' h';
  }

  // ---------- UI ----------
  function build() {
    var home = $('vHome');
    if (!home || $('tripCard')) return;
    var st = el('style'); st.textContent = CSS; document.head.appendChild(st);

    var card = el('div', 'card'); card.id = 'tripCard';
    card.innerHTML =
      '<div class="th">Plan a trip for later</div>' +
      '<div class="c" style="text-align:left">Leaving later? Set the time and we’ll remind you by notification and email. Then tap Start now.</div>' +
      '<label for="tWhen">Leaving at</label>' +
      '<input id="tWhen" type="datetime-local">' +
      '<div class="tq" id="tQuick"></div>' +
      '<label for="tMins">Expected travel time (minutes)</label>' +
      '<input id="tMins" type="number" min="1" max="720" value="20" inputmode="numeric">' +
      '<label for="tNote">Destination (optional)</label>' +
      '<input id="tNote" maxlength="60" placeholder="e.g. Hostel gate">' +
      '<button class="go" id="tAdd" type="button">Schedule trip</button>' +
      '<div id="tErr" role="alert"></div>' +
      '<div id="tList"></div>';
    var first = home.querySelector('.card');
    home.insertBefore(card, first ? first.nextSibling : null);

    var w = $('tWhen');
    resetWhen();
    [['In 30 min', 30], ['In 1 hour', 60], ['In 3 hours', 180], ['Tomorrow 8 AM', 'tom']].forEach(function (q) {
      var b = el('button', '', q[0]); b.type = 'button';
      b.onclick = function () {
        var d = new Date();
        if (q[1] === 'tom') { d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); }
        else d = new Date(Date.now() + q[1] * 60000);
        w.value = localInput(d);
      };
      $('tQuick').appendChild(b);
    });

    $('tAdd').onclick = add;
    built = true;
    renderList();
  }

  function resetWhen() {
    var w = $('tWhen'); if (!w) return;
    var d = new Date(Date.now() + 60 * 60000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    w.min = localInput(new Date());
    w.value = localInput(d);
  }

  function setTrips(list) {
    trips = (list || []).slice().sort(function (a, b) { return a.startAt - b.startAt; });
    try { localStorage.setItem('swTrips', JSON.stringify(trips)); } catch (e) {}
    renderList();
  }

  function renderList() {
    var box = $('tList'); if (!box) return;
    box.replaceChildren();
    if (!trips.length) return;
    box.appendChild(el('h3', '', 'Your planned trips'));
    trips.forEach(function (t) {
      var due = Date.now() >= t.startAt;
      var row = el('div', 'trip' + (due ? ' due' : ''));
      var top = el('div', 'tt');
      top.appendChild(el('b', '', t.note || 'Trip'));
      var eta = el('span', 'eta', fmtLeft(t.startAt - Date.now()));
      eta.setAttribute('data-at', t.startAt);
      top.appendChild(eta);
      row.appendChild(top);
      row.appendChild(el('div', 'td', fmtWhen(t.startAt) + '  |  ' + t.minutes + ' min trip'));
      var bt = el('div', 'tb');
      var go = el('button', due ? 'go' : 'ok', 'Start now'); go.type = 'button';
      go.onclick = function () { startTrip(t); };
      var cx = el('button', 'cx', 'Cancel'); cx.type = 'button';
      cx.onclick = function () { cancel(t, cx); };
      bt.appendChild(go); bt.appendChild(cx);
      row.appendChild(bt);
      box.appendChild(row);
    });
    box.appendChild(el('div', 'tnote', 'SafeWalk can’t start by itself in the background. When it’s time, tap Start now.'));
  }

  function tick() {
    var list = document.querySelectorAll('#tList .eta');
    for (var i = 0; i < list.length; i++) {
      var left = Number(list[i].getAttribute('data-at')) - Date.now();
      var txt = fmtLeft(left);
      if (list[i].textContent !== txt) list[i].textContent = txt;
      var row = list[i].closest('.trip');
      if (row) row.classList.toggle('due', left <= 0);
    }
  }

  // ---------- server ----------
  function add() {
    var b = $('tAdd'); err('');
    var v = $('tWhen').value;
    if (!v) { err('Please choose when you will leave.'); return; }
    var at = new Date(v).getTime();
    if (!isFinite(at)) { err('That date and time is not valid.'); return; }
    if (at < Date.now() - 60000) { err('Pick a time in the future.'); return; }
    b.disabled = true;
    if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }
    api('trip', { op: 'add', startAt: at, minutes: $('tMins').value, note: $('tNote').value })
      .then(function (j) {
        setTrips(j.trips); $('tNote').value = ''; resetWhen();
        toast('Trip planned. We’ll remind you.');
      })
      .catch(function (e) { err(e.message); })
      .then(function () { b.disabled = false; });
  }

  function cancel(t, btn) {
    btn.disabled = true;
    api('trip', { op: 'cancel', tripId: t.id })
      .then(function (j) { setTrips(j.trips); toast('Trip cancelled.'); })
      .catch(function (e) { err(e.message); btn.disabled = false; });
  }

  function refresh() {
    if (!S || !S.token) return;
    lastSync = Date.now();
    api('trip', { op: 'list' }).then(function (j) { setTrips(j.trips); }).catch(function () {});
  }

  function startTrip(t) {
    if (S.jid) { toast('Finish your current journey first.'); return; }
    $('mins').value = t.minutes;
    $('note').value = t.note || '';
    var chips = document.querySelectorAll('#chips .chip');
    for (var i = 0; i < chips.length; i++) chips[i].className = 'chip' + (chips[i].textContent === t.minutes + ' min' ? ' on' : '');
    pending = t.id;
    setTimeout(function () { pending = null; }, 30000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    $('start').click();
  }

  // called by the app right after a journey has started successfully
  window.onJourneyStarted = function () {
    if (!pending) return;
    var id = pending; pending = null;
    api('trip', { op: 'started', tripId: id }).then(function (j) { setTrips(j.trips); }).catch(function () {});
  };

  // ---------- reminders while the app is open ----------
  function notifyDue(t) {
    var title = 'Time to start your trip', body = (t.note ? 'To ' + t.note + '. ' : '') + 'Open SafeWalk and tap Start now.';
    toast(title + '. Tap Start now.');
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(function (r) { return r.showNotification(title, { body: body, icon: 'icon-192.png', tag: t.id, requireInteraction: true }); })
          .catch(function () { new Notification(title, { body: body, icon: 'icon-192.png' }); });
      } else new Notification(title, { body: body, icon: 'icon-192.png' });
    } catch (e) {}
  }

  function checkDue() {
    var changed = false;
    trips.forEach(function (t) {
      if (Date.now() >= t.startAt && !notified[t.id] && Date.now() - t.startAt < 30 * 60000) {
        notified[t.id] = 1; changed = true; notifyDue(t);
      }
    });
    if (changed) { try { localStorage.setItem('swNotified', JSON.stringify(notified)); } catch (e) {} }
  }

  // ---------- loop ----------
  var wasHome = false;
  setInterval(function () {
    var loggedIn = !!(window.S && S.token);
    if (!loggedIn) {
      if (trips.length) { trips = []; try { localStorage.removeItem('swTrips'); } catch (e) {} renderList(); }
      wasHome = false; return;
    }
    var home = homeVisible();
    if (home && !built) build();
    if (home && !wasHome) { resetWhen(); refresh(); }
    if (home && Date.now() - lastSync > 30000) refresh();
    wasHome = home;
    if (built) tick();
    checkDue();
  }, 1000);

  window.SentinalTrips = { build: build, refresh: refresh };
})();
