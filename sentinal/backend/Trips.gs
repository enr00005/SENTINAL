// ===== SENTINAL SafeWalk: scheduled trips (add-on) =====
// In Apps Script: click "+" > Script, name it Trips, paste this whole file.
// Make sure route_() in Code.gs has the line:   case 'trip': return tripRoute_(p);
// Then run installTrips() once and Deploy > Manage deployments > Edit > New version.
//
// APP_URL (the link put in the reminder email) now lives in Script Properties,
// see the header of Code.gs. It is optional.

const TRIPS_SHEET = 'Trips';
const TRIPS_HEAD = ['Trip', 'Watch ID', 'Start At', 'Minutes', 'Note', 'Status', 'Created', 'Reminded'];
// cols: 0 id, 1 watch id, 2 start (ms), 3 expected minutes, 4 note, 5 status, 6 created (ms), 7 reminded
// status: SCHEDULED, STARTED, CANCELLED, EXPIRED
const TRIP_EXPIRE_MS = 30 * 60 * 1000;                      // trip disappears 30 min after its start time
const TRIP_MAX_AHEAD_MS = 30 * 24 * 3600 * 1000;            // up to 30 days ahead
const TRIP_MAX_PENDING = 10;                                // per person

// Run once from the editor: creates the Trips tab and a 1-minute reminder timer.
function installTrips() {
  sheet_(TRIPS_SHEET, TRIPS_HEAD);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'checkTrips') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('checkTrips').timeBased().everyMinutes(1).create();
}

function tripRoute_(p) {
  const u = userFromToken_(p.token);
  switch (p.op) {
    case 'add':     return tAdd_(u, p);
    case 'list':    return tList_(u);
    case 'cancel':  return tSet_(u, p.tripId, 'CANCELLED');
    case 'started': return tSet_(u, p.tripId, 'STARTED');
  }
  throw new Error('Unknown trip action');
}

function tAdd_(u, p) {
  const wid = u.vals[0];
  const at = Number(p.startAt), now = Date.now();
  if (!isFinite(at)) throw new Error('Please choose a date and time.');
  if (at < now - 60000) throw new Error('Pick a time in the future.');
  if (at > now + TRIP_MAX_AHEAD_MS) throw new Error('You can plan up to 30 days ahead.');
  const minutes = Math.min(720, Math.max(1, Number(p.minutes) || 20));

  const sh = sheet_(TRIPS_SHEET, TRIPS_HEAD);
  const rows = sh.getDataRange().getValues();
  let pending = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === wid && rows[i][5] === 'SCHEDULED' && Number(rows[i][2]) > now - TRIP_EXPIRE_MS) pending++;
  }
  if (pending >= TRIP_MAX_PENDING) throw new Error('You already have ' + TRIP_MAX_PENDING + ' planned trips. Cancel one first.');

  const id = 'TRP-' + Utilities.getUuid().replace(/-/g, '').substr(0, 8).toUpperCase();
  sh.appendRow([id, wid, at, minutes, clean_(p.note, 60), 'SCHEDULED', now, '']);
  return tList_(u);
}

function tList_(u) {
  const wid = u.vals[0], now = Date.now();
  const rows = sheet_(TRIPS_SHEET, TRIPS_HEAD).getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r[1] === wid && r[5] === 'SCHEDULED' && Number(r[2]) > now - TRIP_EXPIRE_MS) {
      out.push({ id: r[0], startAt: Number(r[2]), minutes: Number(r[3]), note: r[4] || '' });
    }
  }
  out.sort(function (a, b) { return a.startAt - b.startAt; });
  return { success: true, trips: out.slice(0, TRIP_MAX_PENDING) };
}

function tSet_(u, tripId, status) {
  const sh = sheet_(TRIPS_SHEET, TRIPS_HEAD);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === tripId && rows[i][1] === u.vals[0]) {
      if (rows[i][5] === 'SCHEDULED') sh.getRange(i + 1, 6).setValue(status);
      return tList_(u);
    }
  }
  throw new Error('Trip not found.');
}

// Runs every minute (timer trigger): email a reminder when a trip's start time arrives.
function checkTrips() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_(TRIPS_SHEET, TRIPS_HEAD);
    const rows = sh.getDataRange().getValues();
    const now = Date.now();
    let users = null;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (r[5] !== 'SCHEDULED') continue;
      const at = Number(r[2]);
      if (now >= at && r[7] !== 'YES') {
        if (!users) users = usersByWatch_();
        if (users[r[1]]) mailTripDue_(users[r[1]], r);
        sh.getRange(i + 1, 8).setValue('YES');
      }
      if (now > at + TRIP_EXPIRE_MS) sh.getRange(i + 1, 6).setValue('EXPIRED');
    }
  } finally {
    lock.releaseLock();
  }
}

function usersByWatch_() {
  const map = {};
  sheet_('Users', USER_HEAD).getDataRange().getValues().slice(1).forEach(function (r) {
    map[r[0]] = { name: r[1], email: r[2] };
  });
  return map;
}

function mailTripDue_(user, r) {
  const when = Utilities.formatDate(new Date(Number(r[2])), Session.getScriptTimeZone(), 'dd MMM, HH:mm');
  const appUrl = cfg_('APP_URL', true);
  sendMail_(user.email, 'SENTINAL SafeWalk: time to start your trip',
    'Hello ' + user.name + ',\n\nYour planned trip' + (r[4] ? ' to ' + r[4] : '') + ' was set for ' + when + '.\n' +
    'Open SafeWalk and tap "Start now" so police can follow your journey:\n' + (appUrl || '(open the SafeWalk app)') +
    '\n\nTracking only begins when you start it.\n\n- SENTINAL');
}
