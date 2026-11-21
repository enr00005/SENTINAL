// ===== SENTINAL backend (Google Apps Script) =====
// Tabs used (created automatically): "Users" and "SOS Incidents"
//
// SECRETS ARE NOT STORED IN THIS FILE.
// In Apps Script open Project Settings > Script Properties > Add script property:
//   SHEET_ID      required  Google Sheet ID (the long text in the sheet's URL)
//   SECRET        required  device key, must match SECRET in the ESP32 sketch
//   APP_SECRET    required  key used by the mobile web app (different from SECRET)
//   SALT          required  password-hash salt. If you already have accounts, use your OLD salt value,
//                           otherwise existing passwords stop working. New setup: any long random text.
//   POLICE_EMAIL  optional  extra email that receives every new alert
//   APP_URL       optional  link put in the trip reminder email
// Then run checkConfig() once to confirm everything is set.

const DASHBOARD_FILE = 'Index';            // name of the police dashboard HTML file (without .html)
const INCIDENT_SHEET = 'SOS Incidents';

const USER_HEAD = ['Watch ID', 'Name', 'Email', 'Password Hash', 'Created', 'Last Login', 'Alerts Sent'];
// Incident columns: 0 id, 1 time, 2 device (watch id), 3 detail, 4 status, 5 acknowledged at, 6 type, 7 hidden,
//                   8 latitude, 9 longitude, 10 location updated
const INCIDENT_HEAD = ['Incident', 'Time', 'Device', 'Message', 'Status', 'Acknowledged At', 'Type', 'Hidden',
                       'Latitude', 'Longitude', 'Location Updated'];

// Location used by the dashboard's "SEND TEST SOS" button so you can see the map without a GPS fix.
// Change these two numbers to a place near you (right-click a spot in Google Maps to copy its coordinates).
const TEST_LAT = 20.5937;
const TEST_LNG = 78.9629;
const SESSION_SECONDS = 6 * 60 * 60;
const TYPES = ['SOS', 'Medical', 'Fire', 'Security', 'Accident', 'Other'];
let MAIL_ERROR = '';   // filled by sendMail_ when an email could not be sent

// ---------- configuration (read from Script Properties) ----------
const CFG_CACHE_ = {};
function cfg_(key, optional) {
  if (!(key in CFG_CACHE_)) {
    CFG_CACHE_[key] = PropertiesService.getScriptProperties().getProperty(key) || '';
  }
  if (!CFG_CACHE_[key] && !optional) throw new Error('Server is not configured (missing ' + key + ').');
  return CFG_CACHE_[key];
}

// Run once from the editor: tells you which properties are set (never prints their values).
function checkConfig() {
  ['SHEET_ID', 'SECRET', 'APP_SECRET', 'SALT'].forEach(function (k) {
    Logger.log(k + ': ' + (cfg_(k, true) ? 'set' : 'MISSING (required)'));
  });
  ['POLICE_EMAIL', 'APP_URL'].forEach(function (k) {
    Logger.log(k + ': ' + (cfg_(k, true) ? 'set' : 'not set (optional)'));
  });
}

// Run once from the editor: creates the tabs and grants permissions.
function setup() {
  sheet_('Users', USER_HEAD);
  sheet_(INCIDENT_SHEET, INCIDENT_HEAD);
}

// Opening the /exec link shows the police dashboard
function doGet() {
  return HtmlService.createHtmlOutputFromFile(DASHBOARD_FILE)
    .setTitle('SENTINAL Police Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Called by the ESP32 (account page + smartwatch)
function doPost(e) {
  let out;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const req = JSON.parse(e.postData.contents);
    const isDevice = req.secret === cfg_('SECRET');
    if (!isDevice && req.secret !== cfg_('APP_SECRET')) throw new Error('Unauthorized');
    const pl = req.payload || {};
    if (!isDevice && (pl.action === 'alert' || pl.action === 'watchStatus')) throw new Error('Unauthorized');
    out = route_(pl);
  } catch (err) {
    out = { success: false, message: String(err.message || err) };
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function route_(p) {
  switch (p.action) {
    case 'register':     return register_(p);
    case 'login':        return login_(p);
    case 'dashboard':    return dashboard_(p);
    case 'report':       return report_(p);
    case 'deleteReport': return deleteReport_(p);
    case 'alert':        return alert_(p);        // touch sensor on the watch
    case 'watchStatus':  return watchStatus_(p);  // watch asks: did police acknowledge?
    case 'journeyStart':
    case 'journeyPing':
    case 'journeyExtend':
    case 'journeyArrive':
    case 'journeySOS':   return journeyRoute_(p); // SafeWalk.gs
    case 'trip': return tripRoute_(p);
    case 'logout':
      CacheService.getScriptCache().remove('t_' + p.token);
      return { success: true };
    default: throw new Error('Unknown action');
  }
}

// ---------- accounts ----------
function register_(p) {
  const name = clean_(p.name, 60);
  const email = String(p.email || '').trim().toLowerCase();
  const password = String(p.password || '');

  if (!name) throw new Error('Please enter your name.');
  if (!/^[^\s@=+\-][^\s@]*@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email.');
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');

  const sh = sheet_('Users', USER_HEAD);
  const rows = sh.getDataRange().getValues();
  const ids = {};
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][2]).toLowerCase() === email) throw new Error('That email is already registered. Log in instead.');
    ids[rows[i][0]] = true;
  }

  let id;
  do {
    id = 'SNL-W-' + Utilities.getUuid().replace(/-/g, '').substr(0, 12).toUpperCase();
  } while (ids[id]);

  const now = new Date().toISOString();
  sh.appendRow([id, name, email, hash_(email, password), now, now, 0]);
  const row = sh.getLastRow();
  return { success: true, token: newToken_(id), user: profile_(sh.getRange(row, 1, 1, 7).getValues()[0]) };
}

function login_(p) {
  const email = String(p.email || '').trim().toLowerCase();
  const password = String(p.password || '');
  const sh = sheet_('Users', USER_HEAD);
  const rows = sh.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][2]).toLowerCase() === email && rows[i][3] === hash_(email, password)) {
      rows[i][5] = new Date().toISOString();
      sh.getRange(i + 1, 6).setValue(rows[i][5]);
      return { success: true, token: newToken_(rows[i][0]), user: profile_(rows[i]) };
    }
  }
  throw new Error('Invalid email or password.');
}

function dashboard_(p) {
  return { success: true, user: profile_(userFromToken_(p.token).vals) };
}

// ---------- alerts ----------
// Report sent from the account page
function report_(p) {
  const found = userFromToken_(p.token);
  const type = TYPES.indexOf(p.type) >= 0 ? p.type : 'Other';
  raise_(found, type, clean_(p.message, 200));
  return { success: true, user: profile_(found.vals), mailed: !MAIL_ERROR, mailError: MAIL_ERROR };
}

// Alert sent by the smartwatch touch sensor
function alert_(p) {
  const found = userByWatchId_(String(p.watchId || ''));
  const id = raise_(found, 'SOS', 'Touch alert from smartwatch', parseLoc_(p));
  return { success: true, incidentId: id, reports: found.vals[6], mailed: !MAIL_ERROR, mailError: MAIL_ERROR };
}

// The watch checks whether police acknowledged its alert
function watchStatus_(p) {
  const sh = sheet_(INCIDENT_SHEET, INCIDENT_HEAD);
  const rows = sh.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === p.incidentId && rows[i][2] === p.watchId) {
      const status = rows[i][4];
      const loc = parseLoc_(p);                       // live GPS position from the watch
      if (loc && status !== 'CANCELLED') sh.getRange(i + 1, 9, 1, 3).setValues([[loc.lat, loc.lng, loc.time]]);
      return { success: true, status: status };
    }
  }
  return { success: true, status: 'UNKNOWN' };
}

// User deletes an alert from their dashboard.
// If police have not acknowledged it yet, it is marked CANCELLED so they know it was withdrawn.
function deleteReport_(p) {
  const found = userFromToken_(p.token);
  const sh = sheet_(INCIDENT_SHEET, INCIDENT_HEAD);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === p.id && rows[i][2] === found.vals[0]) {
      if (rows[i][4] === 'ACTIVE') sh.getRange(i + 1, 5).setValue('CANCELLED');
      sh.getRange(i + 1, 8).setValue('YES');
      return { success: true, user: profile_(found.vals) };
    }
  }
  throw new Error('Alert not found.');
}

function raise_(found, type, detail, loc) {
  const id = addIncident_(found.vals[0], type, detail, loc);
  found.vals[6] = Number(found.vals[6] || 0) + 1;
  sheet_('Users', USER_HEAD).getRange(found.row, 7).setValue(found.vals[6]);
  mailAlert_(found.vals, id, type, loc);
  return id;
}

function addIncident_(deviceId, type, detail, loc) {
  const id = 'INC-' + Utilities.getUuid().replace(/-/g, '').substr(0, 8).toUpperCase();
  sheet_(INCIDENT_SHEET, INCIDENT_HEAD).appendRow([
    id, new Date().toISOString(), deviceId, clean_(detail, 250), 'ACTIVE', '', type, '',
    loc ? loc.lat : '', loc ? loc.lng : '', loc ? loc.time : ''
  ]);
  return id;
}

// Valid GPS coordinates from a request, or null
function parseLoc_(p) {
  if (p.lat === undefined || p.lat === null || p.lat === '') return null;
  const lat = Number(p.lat), lng = Number(p.lng);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  const age = Math.max(0, Number(p.locAge) || 0);
  return { lat: lat, lng: lng, time: new Date(Date.now() - age * 1000).toISOString() };
}

// ---------- police dashboard (called by Index.html through google.script.run) ----------
function getIncidents() {
  const names = {};
  sheet_('Users', USER_HEAD).getDataRange().getValues().slice(1).forEach(function (r) { names[r[0]] = r[1]; });

  const rows = sheet_(INCIDENT_SHEET, INCIDENT_HEAD).getDataRange().getValues();
  const out = [];
  for (let i = rows.length - 1; i >= 1 && out.length < 200; i--) {   // newest first
    const type = rows[i][6];
    const detail = rows[i][3];
    out.push({
      id: rows[i][0],
      timestamp: iso_(rows[i][1]),
      deviceId: rows[i][2],
      userName: names[rows[i][2]] || '',
      message: type ? type + (detail ? ': ' + detail : '') : detail,
      status: rows[i][4],
      lat: rows[i][8] === '' || rows[i][8] === undefined ? null : Number(rows[i][8]),
      lng: rows[i][9] === '' || rows[i][9] === undefined ? null : Number(rows[i][9]),
      locTime: iso_(rows[i][10])
    });
  }
  return out;
}

function createTestIncident() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    addIncident_('TEST-WATCH', 'TEST', 'Test SOS from simulator',
      { lat: TEST_LAT, lng: TEST_LNG, time: new Date().toISOString() });
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function acknowledgeIncident(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_(INCIDENT_SHEET, INCIDENT_HEAD);
    const rows = sh.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) {
        if (rows[i][4] === 'CANCELLED') return { success: false };
        const wasActive = rows[i][4] === 'ACTIVE';
        sh.getRange(i + 1, 5, 1, 2).setValues([['ACKNOWLEDGED', new Date().toISOString()]]);
        if (wasActive) mailAcknowledged_(rows[i][2], rows[i][0]);
        return { success: true };
      }
    }
    return { success: false };
  } finally {
    lock.releaseLock();
  }
}

// ---------- helpers ----------
function sheet_(name, head) {
  const ss = SpreadsheetApp.openById(cfg_('SHEET_ID'));
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0 || sh.getLastColumn() < head.length) {   // also upgrades older tabs
    sh.getRange(1, 1, 1, head.length).setValues([head]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function iso_(v) {
  return v instanceof Date ? v.toISOString() : String(v || '');
}

function hash_(email, password) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, cfg_('SALT') + email + password);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function newToken_(watchId) {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('t_' + token, watchId, SESSION_SECONDS);
  return token;
}

function userByWatchId_(id) {
  const rows = sheet_('Users', USER_HEAD).getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) return { row: i + 1, vals: rows[i] };
  }
  throw new Error('Unknown watch. Log in on the watch hub again.');
}

function userFromToken_(token) {
  const id = token ? CacheService.getScriptCache().get('t_' + token) : null;
  if (!id) throw new Error('Session expired. Please log in again.');
  return userByWatchId_(id);
}

function profile_(v) {
  const watchId = v[0];
  const rows = sheet_(INCIDENT_SHEET, INCIDENT_HEAD).getDataRange().getValues();
  const recent = [];
  for (let i = rows.length - 1; i >= 1 && recent.length < 10; i--) {
    if (rows[i][2] === watchId && rows[i][7] !== 'YES') {
      recent.push({
        id: rows[i][0],
        time: iso_(rows[i][1]),
        type: rows[i][6] || 'Alert',
        message: rows[i][3],
        status: rows[i][4],
        ackAt: iso_(rows[i][5]),
        loc: rows[i][8] !== '' && rows[i][8] !== undefined
      });
    }
  }
  return {
    watchId: watchId,
    name: v[1],
    email: v[2],
    created: iso_(v[4]),
    lastLogin: iso_(v[5]),
    reports: Number(v[6] || 0),
    recent: recent
  };
}

// ---------- email notifications (arrive as a Gmail notification on the phone) ----------
function sendMail_(to, subject, body) {
  try {
    if (!to) throw new Error('no email address');
    MailApp.sendEmail(to, subject, body);
  } catch (e) {
    MAIL_ERROR = String(e.message || e).substr(0, 160);
    console.error('Mail failed: ' + MAIL_ERROR);   // never block an alert because email failed
  }
}

function mailAlert_(user, incidentId, type, loc) {
  const when = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd MMM yyyy, HH:mm:ss');
  const where = loc ? 'Location: https://www.google.com/maps?q=' + loc.lat + ',' + loc.lng : 'Location: not available yet (no GPS fix)';
  sendMail_(user[2], 'SENTINAL: your alert was received',
    'Hello ' + user[1] + ',\n\nYour ' + type + ' alert (' + incidentId + ') reached the SENTINAL police dashboard at ' + when + '.\n' +
    where + '\n\nYou will get another message when police acknowledge it.\n\n- SENTINAL');
  const policeEmail = cfg_('POLICE_EMAIL', true);
  if (policeEmail) {
    sendMail_(policeEmail, 'SENTINAL EMERGENCY: ' + user[1] + ' (' + type + ')',
      'User: ' + user[1] + '\nWatch: ' + user[0] + '\nIncident: ' + incidentId + '\nTime: ' + when + '\n' + where);
  }
}

function mailAcknowledged_(watchId, incidentId) {
  const rows = sheet_('Users', USER_HEAD).getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === watchId) {
      sendMail_(rows[i][2], 'SENTINAL: police acknowledged your alert',
        'Hello ' + rows[i][1] + ',\n\nPolice have acknowledged your alert (' + incidentId + '). Help is on the way.\n\n- SENTINAL');
      return;
    }
  }
}

// Run once in the editor after pasting this file: sends a test email to you and asks for mail permission.
function testEmail() {
  const me = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail(me, 'SENTINAL test', 'If you can read this, email alerts work.');
  Logger.log('Test email sent to ' + me + '. Remaining daily quota: ' + MailApp.getRemainingDailyQuota());
}

// trims, limits length, and stops spreadsheet formula injection
function clean_(s, max) {
  s = String(s || '').replace(/[\r\n\t]+/g, ' ').trim().substr(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
