// ===== SENTINAL SafeWalk backend add-on (v2: route tracking + dashboard feed) =====
// In Apps Script: replace the whole SafeWalk file with this, then run installSafeWalk() once
// (it creates the new "Journey Points" tab) and Deploy > Manage deployments > Edit > New version.
//
// APP_SECRET now lives in Script Properties (see the header of Code.gs), not in this file.

const JOURNEY_SHEET = 'Journeys';
const JOURNEY_HEAD = ['Journey', 'Watch ID', 'Started', 'Expected Arrival', 'Status', 'Lat', 'Lng', 'Loc Time', 'Incident', 'Note'];
// cols: 0 id, 1 watch id, 2 start(ms), 3 expected(ms), 4 status, 5 lat, 6 lng, 7 loc time(ms), 8 incident, 9 note

// Every GPS position of every journey, one row each, so the full route can be drawn
const POINTS_SHEET = 'Journey Points';
const POINTS_HEAD = ['Journey', 'Time (ms)', 'Lat', 'Lng'];
const MAX_ROUTE_POINTS = 400;     // per journey sent to the dashboard / app
const MIN_STEP_M = 8;             // ignore pings that moved less than this (GPS jitter)
const GRACE_MS = 30000;           // wait 30 s after the timer before raising the missed check-in

// Run once from the editor: creates the tabs and a 1-minute timer
// that raises missed-check-in alerts even if the phone is locked or offline.
function installSafeWalk() {
  sheet_(JOURNEY_SHEET, JOURNEY_HEAD);
  sheet_(POINTS_SHEET, POINTS_HEAD);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'checkMissedJourneys') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('checkMissedJourneys').timeBased().everyMinutes(1).create();
}

function journeyRoute_(p) {
  const u = userFromToken_(p.token);
  switch (p.action) {
    case 'journeyStart':  return jStart_(u, p);
    case 'journeyPing':   return jPing_(u, p);
    case 'journeyExtend': return jExtend_(u, p);
    case 'journeyArrive': return jArrive_(u, p);
    case 'journeySOS':    return jSOS_(u, p);
  }
  throw new Error('Unknown action');
}

function findJourney_(sh, id, watchId) {
  const rows = sh.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === id && rows[i][1] === watchId) return { row: i + 1, v: rows[i] };
  }
  throw new Error('Journey not found.');
}

function state_(v, incStatus, route) {
  const out = { success: true, journeyId: v[0], status: v[4], expectedAt: Number(v[3]),
                incidentId: v[8] || '', incidentStatus: incStatus || '' };
  if (route) out.route = route;
  return out;
}

// ---------- route points ----------
function addPoint_(journeyId, lat, lng, whenMs) {
  sheet_(POINTS_SHEET, POINTS_HEAD).appendRow([journeyId, whenMs, lat, lng]);
}

function metres_(a, b, c, d) {                       // haversine distance
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (c - a) * rad, dLng = (d - b) * rad;
  const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Map of journeyId -> [[lat,lng,time],...] for the wanted ids (oldest first, capped)
function routes_(wanted) {
  const out = {};
  const sh = sheet_(POINTS_SHEET, POINTS_HEAD);
  const last = sh.getLastRow();
  if (last < 2) return out;
  const rows = sh.getRange(2, 1, last - 1, 4).getValues();
  for (let i = 0; i < rows.length; i++) {
    const id = rows[i][0];
    if (!wanted[id]) continue;
    (out[id] = out[id] || []).push([Number(rows[i][2]), Number(rows[i][3]), Number(rows[i][1])]);
  }
  Object.keys(out).forEach(function (k) {
    if (out[k].length > MAX_ROUTE_POINTS) out[k] = out[k].slice(out[k].length - MAX_ROUTE_POINTS);
  });
  return out;
}

function jStart_(u, p) {
  const sh = sheet_(JOURNEY_SHEET, JOURNEY_HEAD);
  const wid = u.vals[0];
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {              // only one live journey per person
    if (rows[i][1] === wid && rows[i][4] === 'ACTIVE') sh.getRange(i + 1, 5).setValue('ENDED');
  }
  const minutes = Math.min(720, Math.max(1, Number(p.minutes) || 20));
  const loc = parseLoc_(p);
  const now = Date.now();
  const id = 'JNY-' + Utilities.getUuid().replace(/-/g, '').substr(0, 8).toUpperCase();
  const v = [id, wid, now, now + minutes * 60000, 'ACTIVE',
             loc ? loc.lat : '', loc ? loc.lng : '', loc ? now : '', '', clean_(p.note, 100)];
  sh.appendRow(v);
  if (loc) addPoint_(id, loc.lat, loc.lng, now);
  mailJourneyStart_(u.vals, id, minutes, v[9], loc);   // optional police email
  return state_(v);
}

function jPing_(u, p) {
  const sh = sheet_(JOURNEY_SHEET, JOURNEY_HEAD);
  const j = findJourney_(sh, p.journeyId, u.vals[0]);
  const v = j.v;
  const loc = parseLoc_(p);
  if (loc && ['ACTIVE', 'SOS', 'MISSED'].indexOf(v[4]) >= 0) {
    const moved = v[5] === '' ? 1e9 : metres_(Number(v[5]), Number(v[6]), loc.lat, loc.lng);
    const when = Date.parse(loc.time);
    if (moved >= MIN_STEP_M) addPoint_(v[0], loc.lat, loc.lng, when);   // extend the route
    v[5] = loc.lat; v[6] = loc.lng; v[7] = when;
    sh.getRange(j.row, 6, 1, 3).setValues([[v[5], v[6], v[7]]]);
  }
  if (v[4] === 'ACTIVE' && Date.now() > Number(v[3]) + GRACE_MS) missed_(sh, j.row, v);
  let incStatus = '';
  if (v[8]) incStatus = watchStatus_({ incidentId: v[8], watchId: u.vals[0], lat: p.lat, lng: p.lng, locAge: p.locAge }).status;
  const r = {}; r[v[0]] = true;
  return state_(v, incStatus, (routes_(r)[v[0]] || []));
}

function jExtend_(u, p) {
  const sh = sheet_(JOURNEY_SHEET, JOURNEY_HEAD);
  const j = findJourney_(sh, p.journeyId, u.vals[0]);
  if (j.v[4] !== 'ACTIVE') throw new Error('This journey can no longer be extended.');
  j.v[3] = Number(j.v[3]) + Math.min(120, Math.max(1, Number(p.minutes) || 10)) * 60000;
  sh.getRange(j.row, 4).setValue(j.v[3]);
  return state_(j.v);
}

function jSOS_(u, p) {
  const sh = sheet_(JOURNEY_SHEET, JOURNEY_HEAD);
  let j = null;
  try { j = findJourney_(sh, p.journeyId, u.vals[0]); } catch (e) {}
  let loc = parseLoc_(p);
  if (!loc && j && j.v[5] !== '') loc = { lat: Number(j.v[5]), lng: Number(j.v[6]), time: new Date(Number(j.v[7])).toISOString() };
  const inc = raise_(u, 'SOS', 'SOS pressed during SafeWalk' + (j && j.v[9] ? ' (' + j.v[9] + ')' : ''), loc);
  if (j) {
    sh.getRange(j.row, 5).setValue('SOS');
    sh.getRange(j.row, 9).setValue(inc);
    j.v[4] = 'SOS'; j.v[8] = inc;
    return state_(j.v, 'ACTIVE');
  }
  return { success: true, incidentId: inc };
}

function jArrive_(u, p) {
  const sh = sheet_(JOURNEY_SHEET, JOURNEY_HEAD);
  const j = findJourney_(sh, p.journeyId, u.vals[0]);
  sh.getRange(j.row, 5).setValue('ARRIVED');
  if (j.v[8]) {                                         // withdraw an alert nobody has answered yet
    const is = sheet_(INCIDENT_SHEET, INCIDENT_HEAD);
    const rows = is.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === j.v[8] && rows[i][4] === 'ACTIVE') is.getRange(i + 1, 5).setValue('CANCELLED');
    }
  }
  j.v[4] = 'ARRIVED';
  return state_(j.v);
}

// Raise the missed-check-in incident (caller already holds the lock)
function missed_(sh, row, v) {
  sh.getRange(row, 5).setValue('MISSED');
  v[4] = 'MISSED';
  let found;
  try { found = userByWatchId_(v[1]); } catch (e) { return; }
  const loc = v[5] !== '' ? { lat: Number(v[5]), lng: Number(v[6]), time: new Date(Number(v[7]) || Date.now()).toISOString() } : null;
  const due = Utilities.formatDate(new Date(Number(v[3])), Session.getScriptTimeZone(), 'HH:mm');
  const inc = raise_(found, 'Missed Check-in', 'Did not confirm safe arrival by ' + due + (v[9] ? ' (' + v[9] + ')' : ''), loc);
  sh.getRange(row, 9).setValue(inc);
  v[8] = inc;
}

// Runs every minute (timer trigger)
function checkMissedJourneys() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_(JOURNEY_SHEET, JOURNEY_HEAD);
    const rows = sh.getDataRange().getValues();
    const now = Date.now();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][4] === 'ACTIVE' && now > Number(rows[i][3]) + GRACE_MS) missed_(sh, i + 1, rows[i]);
    }
  } finally {
    lock.releaseLock();
  }
}

// ---------- police dashboard feed (called by Index.html through google.script.run) ----------
// Journeys started in the last 24 h (and any still running), newest first, with their routes.
function getJourneys() {
  const names = {};
  sheet_('Users', USER_HEAD).getDataRange().getValues().slice(1).forEach(function (r) { names[r[0]] = r[1]; });

  const rows = sheet_(JOURNEY_SHEET, JOURNEY_HEAD).getDataRange().getValues();
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const list = [], wanted = {};
  for (let i = rows.length - 1; i >= 1 && list.length < 25; i--) {
    const r = rows[i];
    const live = ['ACTIVE', 'SOS', 'MISSED'].indexOf(r[4]) >= 0;
    if (!live && Number(r[2]) < cutoff) continue;
    wanted[r[0]] = true;
    list.push({
      id: r[0], watchId: r[1], userName: names[r[1]] || '',
      started: Number(r[2]), expected: Number(r[3]), status: r[4],
      lat: r[5] === '' ? null : Number(r[5]), lng: r[6] === '' ? null : Number(r[6]),
      locTime: r[7] === '' ? 0 : Number(r[7]), incident: r[8] || '', note: r[9] || ''
    });
  }
  const rt = routes_(wanted);
  list.forEach(function (j) { j.route = rt[j.id] || []; });
  return list;
}

function mailJourneyStart_(user, journeyId, minutes, note, loc) {
  const policeEmail = cfg_('POLICE_EMAIL', true);
  if (!policeEmail) return;
  const where = loc ? 'Start: https://www.google.com/maps?q=' + loc.lat + ',' + loc.lng : 'Start location: no GPS fix yet';
  sendMail_(policeEmail, 'SENTINAL SafeWalk started: ' + user[1],
    'User: ' + user[1] + '\nWatch: ' + user[0] + '\nJourney: ' + journeyId + '\nExpected in: ' + minutes + ' min' +
    (note ? '\nDestination: ' + note : '') + '\n' + where);
}
