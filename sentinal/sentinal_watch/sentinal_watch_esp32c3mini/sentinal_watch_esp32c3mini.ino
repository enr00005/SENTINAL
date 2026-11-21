#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Preferences.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <TinyGPSPlus.h>      // Library Manager: "TinyGPSPlus" by Mikal Hart

// ================== SENTINAL smartwatch hub (ESP32-C3 Mini) ==================
// OLED (SH1106, I2C): SDA/SCL -> your board's I2C pins, VCC -> 3V3, GND -> GND
// Touch sensor (TTP223): OUT -> GPIO3, VCC -> 3V3, GND -> GND
// GPS (NEO-6M): module TX -> GPIO4, module RX -> GPIO5 (optional), VCC -> 3V3, GND -> GND
#define SDA_PIN -1         // -1 = use the board's default I2C pins (same as the simple OLED test sketch)
#define SCL_PIN -1         // or set real GPIO numbers found with the I2C scanner
#define OLED_ADDR 0x3C     // 0x3D is tried automatically if 0x3C is not found
#define TOUCH_PIN 3
#define GPS_RX_PIN 4       // ESP32 pin that receives from the GPS module's TX
#define GPS_TX_PIN 5       // ESP32 pin that sends to the GPS module's RX
#define GPS_BAUD 9600
#define COOLDOWN_MS 8000   // minimum time between two touch alerts

// ---------- Hotspot the phones connect to ----------
const char* AP_SSID = "SENTINAL";
const char* AP_PASS = "sentinal123";

// ---------- Internet for the ESP32 (phone hotspot or home Wi-Fi, 2.4 GHz) ----------
const char* HOME_SSID = "YOUR SSID";
const char* HOME_PASS = "YOUR_PWD";

// ---------- Google Apps Script web app ----------
const char* SCRIPT_URL = "ADD YOUR URL";
// Must match SECRET in Code.gs exactly
const char* SECRET = "ADD_YOR_KEY";

WebServer server(80);

const char webpage[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SENTINAL Watch</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{--bg:#08111f;--card:#14263d;--deep:#0d1b2e;--accent:#38d6d0;--text:#e8f1fa;--muted:#8fa6bd;--danger:#ff5d6c;--line:#24405f}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;justify-content:center;padding:20px;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.45}
.wrap{width:100%;max-width:440px}
h1{margin:6px 0 2px;font-size:1.7rem;letter-spacing:.04em;color:var(--accent)}
.sub{margin:0 0 18px;color:var(--muted)}
.card{background:var(--card);border-radius:16px;padding:22px;margin-bottom:14px}
.tabs{display:flex;gap:6px;background:var(--deep);padding:4px;border-radius:10px;margin-bottom:16px}
.tabs button{flex:1;padding:10px;border:0;border-radius:8px;background:none;color:var(--muted);font-weight:600;font-size:.95rem;cursor:pointer}
.tabs button.on{background:var(--accent);color:#06222a}
label{display:block;font-size:.85rem;color:var(--muted);margin:12px 0 5px;text-align:left}
input,select{width:100%;padding:12px;border-radius:8px;border:1px solid var(--line);background:var(--deep);color:var(--text);font-size:1rem}
input:focus,select:focus,button:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.pw{position:relative}
.pw button{position:absolute;right:6px;top:6px;padding:6px 10px;width:auto;background:none;color:var(--accent);border:0;font-size:.85rem;cursor:pointer}
.btn{width:100%;margin-top:18px;padding:13px;border:0;border-radius:8px;background:var(--accent);color:#06222a;font-weight:700;font-size:1rem;cursor:pointer}
.btn:disabled{opacity:.6;cursor:wait}
.btn.alert{background:var(--danger);color:#fff}
.btn.ghost{background:none;border:1px solid var(--line);color:var(--text);margin-top:0}
.row{display:flex;gap:10px;margin-top:10px}
.row .btn{margin-top:0}
.msg{min-height:1.3em;margin-top:12px;font-size:.92rem;text-align:left}
.msg.err{color:var(--danger)}.msg.ok{color:var(--accent)}
.count{display:flex;align-items:baseline;gap:12px}
.count b{font-size:3.4rem;line-height:1;color:var(--accent)}
.count span{color:var(--muted)}
.idbox{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--deep);border:1px dashed var(--accent);border-radius:10px;padding:12px 14px;margin-top:10px}
.idbox code{font-size:1.05rem;letter-spacing:.06em;overflow-wrap:anywhere}
.idbox button{background:none;border:0;color:var(--accent);font-weight:600;cursor:pointer}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;font-size:.85rem;color:var(--muted)}
.meta div b{display:block;color:var(--text);font-weight:500;margin-top:2px}
h3{margin:0 0 4px;font-size:1.05rem}
ul{list-style:none;margin:10px 0 0;padding:0}
li{padding:10px 0;border-top:1px solid var(--line);font-size:.92rem}
li small{display:block;color:var(--muted)}
.banner{background:#1fbd86;color:#06221a;font-weight:700;border-radius:12px;padding:14px;margin-bottom:14px}
.top{display:flex;justify-content:space-between;gap:8px;align-items:center}
.badge{font-size:.75rem;padding:3px 8px;border-radius:99px;background:#304766;white-space:nowrap}
.badge.ACKNOWLEDGED{background:#1fbd86;color:#06221a}
.badge.CANCELLED{background:#5a3340}
.del{margin-top:8px;padding:6px 12px;border-radius:6px;border:1px solid var(--danger);background:none;color:var(--danger);cursor:pointer}
.hide{display:none}
</style>
</head>
<body>
<div class="wrap">
<h1>SENTINAL</h1>
<p class="sub">Emergency watch account</p>

<div id="auth" class="card">
  <div class="tabs" role="tablist">
    <button id="tabReg" class="on" type="button">Create account</button>
    <button id="tabLog" type="button">Log in</button>
  </div>

  <form id="regForm">
    <label for="rn">Full name</label>
    <input id="rn" name="name" autocomplete="name" required maxlength="60">
    <label for="re">Email</label>
    <input id="re" name="email" type="email" autocomplete="email" required>
    <label for="rp">Password (8 characters minimum)</label>
    <div class="pw"><input id="rp" name="password" type="password" minlength="8" autocomplete="new-password" required><button type="button" data-eye="rp">Show</button></div>
    <button class="btn" type="submit">Create account</button>
  </form>

  <form id="logForm" class="hide">
    <label for="le">Email</label>
    <input id="le" name="email" type="email" autocomplete="email" required>
    <label for="lp">Password</label>
    <div class="pw"><input id="lp" name="password" type="password" autocomplete="current-password" required><button type="button" data-eye="lp">Show</button></div>
    <button class="btn" type="submit">Log in</button>
  </form>
  <div id="authMsg" class="msg" role="status"></div>
</div>

<div id="dash" class="hide">
  <div id="banner" class="banner hide" role="alert"></div>
  <div class="card">
    <h3 id="hello"></h3>
    <div class="count"><b id="cnt">0</b><span>alerts sent</span></div>
    <div class="idbox"><code id="wid"></code><button id="copy" type="button">Copy ID</button></div>
    <div class="meta">
      <div>Email<b id="mail"></b></div>
      <div>Member since<b id="since"></b></div>
      <div>Last login<b id="last"></b></div>
      <div>Last report<b id="lastRep">None yet</b></div>
    </div>
  </div>

  <div class="card">
    <h3>Send a report</h3>
    <form id="repForm">
      <label for="rt">Type</label>
      <select id="rt"><option>Medical</option><option>Fire</option><option>Security</option><option>Accident</option><option>Other</option></select>
      <label for="rm">Details (optional)</label>
      <input id="rm" maxlength="200" placeholder="Where are you? What happened?">
      <button class="btn alert" type="submit">Send report</button>
    </form>
    <div id="repMsg" class="msg" role="status"></div>
  </div>

  <div class="card">
    <h3>Your alerts</h3>
    <ul id="list"></ul>
  </div>

  <div class="row">
    <button id="refresh" class="btn ghost" type="button">Refresh</button>
    <button id="out" class="btn ghost" type="button">Log out</button>
  </div>
</div>
</div>

<script>
const $=id=>document.getElementById(id);
let token=null,seen={},polling=false;

async function api(p){
  try{
    const r=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
    return await r.json();
  }catch(e){return{success:false,message:'Cannot reach the watch hub. Check your Wi-Fi connection.'};}
}
function say(el,t,ok){el.textContent=t||'';el.className='msg '+(t?(ok?'ok':'err'):'');}
function fmt(s){if(!s)return '-';const d=new Date(s);return isNaN(d)?s:d.toLocaleString([], {dateStyle:'medium',timeStyle:'short'});}
function busy(form,on){const b=form.querySelector('.btn');b.disabled=on;}

function tab(reg){
  $('regForm').classList.toggle('hide',!reg);$('logForm').classList.toggle('hide',reg);
  $('tabReg').classList.toggle('on',reg);$('tabLog').classList.toggle('on',!reg);say($('authMsg'),'');
}
$('tabReg').onclick=()=>tab(true);
$('tabLog').onclick=()=>tab(false);
document.querySelectorAll('[data-eye]').forEach(b=>b.onclick=()=>{
  const i=$(b.dataset.eye);const s=i.type==='password';i.type=s?'text':'password';b.textContent=s?'Hide':'Show';
});

function render(u){
  $('auth').classList.add('hide');$('dash').classList.remove('hide');
  $('hello').textContent='Hello, '+u.name;
  $('cnt').textContent=u.reports;
  $('wid').textContent=u.watchId;
  $('mail').textContent=u.email;
  $('since').textContent=fmt(u.created);
  $('last').textContent=fmt(u.lastLogin);
  $('lastRep').textContent=u.recent.length?fmt(u.recent[0].time):'None yet';
  const ul=$('list');ul.textContent='';
  if(!u.recent.length){const li=document.createElement('li');li.textContent='No alerts yet.';ul.appendChild(li);}
  let fresh=false;
  u.recent.forEach(r=>{
    if(seen[r.id]&&seen[r.id]!=='ACKNOWLEDGED'&&r.status==='ACKNOWLEDGED')fresh=true;
    seen[r.id]=r.status;
    const li=document.createElement('li');
    const top=document.createElement('div');top.className='top';
    const t=document.createElement('span');t.textContent=r.type;
    const b=document.createElement('span');b.className='badge '+r.status;
    b.textContent=r.status==='ACKNOWLEDGED'?'Police acknowledged':(r.status==='CANCELLED'?'Cancelled':'Sent - waiting');
    top.appendChild(t);top.appendChild(b);li.appendChild(top);
    const s=document.createElement('small');s.textContent=fmt(r.time)+(r.message?' - '+r.message:'')+(r.loc?' - location shared':'');
    li.appendChild(s);
    const d=document.createElement('button');d.type='button';d.className='del';d.textContent='Delete';
    d.onclick=()=>delReport(r.id);li.appendChild(d);
    ul.appendChild(li);
  });
  if(fresh)notify('Police have acknowledged your alert. Help is on the way.');
}
function showAuth(){token=null;seen={};try{sessionStorage.removeItem('tok');}catch(e){}
  $('dash').classList.add('hide');$('auth').classList.remove('hide');}
function start(res){
  token=res.token;try{sessionStorage.setItem('tok',token);}catch(e){}
  render(res.user);
}

$('regForm').onsubmit=async function(e){
  e.preventDefault();busy(this,true);say($('authMsg'),'Creating your account...',true);
  const d=Object.fromEntries(new FormData(this));d.action='register';
  const r=await api(d);busy(this,false);
  if(r.success){say($('authMsg'),'');this.reset();start(r);}else say($('authMsg'),r.message);
};
$('logForm').onsubmit=async function(e){
  e.preventDefault();busy(this,true);say($('authMsg'),'Logging in...',true);
  const d=Object.fromEntries(new FormData(this));d.action='login';
  const r=await api(d);busy(this,false);
  if(r.success){say($('authMsg'),'');this.reset();start(r);}else say($('authMsg'),r.message);
};
$('repForm').onsubmit=async function(e){
  e.preventDefault();busy(this,true);say($('repMsg'),'Sending...',true);
  const r=await api({action:'report',token:token,type:$('rt').value,message:$('rm').value});
  busy(this,false);
  if(r.success){$('rm').value='';render(r.user);say($('repMsg'),'Report sent and saved.',true);}
  else{say($('repMsg'),r.message);if(/session/i.test(r.message))showAuth();}
};
$('refresh').onclick=async()=>{
  const r=await api({action:'dashboard',token:token});
  if(r.success)render(r.user);else{say($('authMsg'),r.message);showAuth();}
};
$('out').onclick=async()=>{await api({action:'logout',token:token});showAuth();tab(false);};
$('copy').onclick=async()=>{
  try{await navigator.clipboard.writeText($('wid').textContent);$('copy').textContent='Copied';}
  catch(e){$('copy').textContent='Select and copy';}
  setTimeout(()=>$('copy').textContent='Copy ID',1500);
};

(async()=>{
  let t=null;try{t=sessionStorage.getItem('tok');}catch(e){}
  if(!t)return;token=t;
  const r=await api({action:'dashboard',token:t});
  if(r.success)render(r.user);else showAuth();
})();

function notify(t){
  const b=$('banner');b.textContent=t;b.classList.remove('hide');
  if(navigator.vibrate)navigator.vibrate(200);
  setTimeout(()=>b.classList.add('hide'),12000);
}
async function delReport(id){
  if(!confirm('Delete this alert? If police have not acknowledged it yet, it will be cancelled.'))return;
  const r=await api({action:'deleteReport',token:token,id:id});
  if(r.success){render(r.user);say($('repMsg'),'Alert deleted.',true);}else say($('repMsg'),r.message);
}
setInterval(async()=>{
  if(!token||polling)return;
  polling=true;
  const r=await api({action:'dashboard',token:token});
  polling=false;
  if(r.success)render(r.user);
},6000);
</script>
</body>
</html>
)rawliteral";

// ---------- hardware state ----------
Adafruit_SH1106G display(128, 64, &Wire, -1);
Preferences prefs;
TinyGPSPlus gps;
bool oledOk = false;
bool wasTouched = false;
bool acked = false;            // police acknowledged the active alert
bool haveFix = false;          // at least one GPS fix since power-up
double lastLat = 0, lastLng = 0;
unsigned long lastFixMs = 0;
String linkedId = "";          // Watch ID of the account that logged in on this hub
String linkedName = "";
String activeIncident = "";    // alert being tracked (location is sent until it times out)
unsigned long activeSince = 0, lastPoll = 0, lastAlert = 0, lastDraw = 0;

void show(const String& big, const String& l1 = "", const String& l2 = "", const String& l3 = "") {
  if (!oledOk) return;
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(2);
  display.setCursor(0, 0);
  display.println(big);
  display.setTextSize(1);
  display.setCursor(0, 28);
  display.println(l1);
  display.setCursor(0, 40);
  display.println(l2);
  display.setCursor(0, 52);
  display.println(l3);
  display.display();
}

// Feed the GPS parser; remember the latest valid position
void readGPS() {
  while (Serial1.available()) gps.encode(Serial1.read());
  if (gps.location.isValid() && gps.location.age() < 3000) {
    lastLat = gps.location.lat();
    lastLng = gps.location.lng();
    lastFixMs = millis();
    haveFix = true;
  }
}

// ,"lat":..,"lng":..,"locAge":seconds  (empty until the first fix)
String locationJson() {
  if (!haveFix) return "";
  return String(",\"lat\":") + String(lastLat, 6) + ",\"lng\":" + String(lastLng, 6) +
         ",\"locAge\":" + String((millis() - lastFixMs) / 1000);
}

void idleScreen() {
  String l1 = activeIncident.length() ? (acked ? "Police on the way" : "Alert sent. Waiting...") : "Touch sensor = ALERT";
  String l2 = linkedId.length() ? linkedName.substring(0, 20) : "Log in: 192.168.4.1";
  // NODATA = nothing arrives from the GPS wires, WAIT = module talks but has no fix yet, sN = satellites seen
  String gs = (haveFix && millis() - lastFixMs < 10000) ? "FIX" : (haveFix ? "OLD" : (gps.charsProcessed() < 10 ? "NODATA" : "WAIT"));
  String l3 = String("Net:") + (WiFi.status() == WL_CONNECTED ? "OK" : "OFF") + " GPS:" + gs +
              " s" + (gps.satellites.isValid() ? (int)gps.satellites.value() : 0);
  show("SENTINAL", l1, l2, l3);
  lastDraw = millis();
}

// Reads "key":"value" out of a JSON text without a JSON library
String jsonField(const String& s, const char* key) {
  String k = String("\"") + key + "\":\"";
  int a = s.indexOf(k);
  if (a < 0) return "";
  a += k.length();
  int b = s.indexOf('"', a);
  if (b < 0) return "";
  return s.substring(a, b);
}

// ---------- Talk to Google Apps Script ----------
// Apps Script answers a POST with a 302 redirect, so follow it by hand with a GET.
String callSheet(const String& json, int& status) {
  if (WiFi.status() != WL_CONNECTED) {
    status = 503;
    return "{\"success\":false,\"message\":\"Watch hub has no internet right now. Try again in a moment.\"}";
  }

  String body = "";
  String location = "";
  {
    WiFiClientSecure client;
    client.setInsecure();               // fine for a demo; pin a certificate for production
    HTTPClient http;
    const char* keys[] = {"Location"};
    http.collectHeaders(keys, 1);
    http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
    http.setTimeout(20000);
    http.begin(client, SCRIPT_URL);
    http.addHeader("Content-Type", "application/json");
    status = http.POST(json);
    location = http.header("Location");
    if (status > 0 && status < 300) body = http.getString();
    http.end();
  }

  if ((status == 301 || status == 302 || status == 303 || status == 307) && location.length()) {
    WiFiClientSecure client2;
    client2.setInsecure();
    HTTPClient http2;
    http2.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    http2.setTimeout(20000);
    http2.begin(client2, location);
    status = http2.GET();
    body = http2.getString();
    http2.end();
  }

  Serial.printf("Sheet status: %d, body: %s\n", status, body.substring(0, 150).c_str());

  if (status != 200 || body.length() == 0) {
    status = 502;
    return "{\"success\":false,\"message\":\"The database did not answer. Please try again.\"}";
  }
  return body;
}

String wrap(const String& payload) {
  return String("{\"secret\":\"") + SECRET + "\",\"payload\":" + payload + "}";
}

// ---------- Touch alert ----------
void sendAlert() {
  if (linkedId.length() == 0) {
    show("NO USER", "Log in on your phone", "192.168.4.1");
    delay(2500);
    idleScreen();
    return;
  }

  readGPS();
  show("SENDING...", "Please wait");
  int status = 0;
  String res = callSheet(wrap("{\"action\":\"alert\",\"watchId\":\"" + linkedId + "\"" + locationJson() + "}"), status);

  if (res.indexOf("\"success\":true") >= 0) {
    activeIncident = jsonField(res, "incidentId");
    acked = false;
    activeSince = millis();
    lastPoll = millis();
    show("ALERT SENT", "Police notified", haveFix ? "Location shared" : "No GPS fix yet", "Email sent to you");
    delay(2500);
  } else {
    show("FAILED", "Alert not sent", "Check internet");
    delay(2500);
  }
  idleScreen();
}

// Every 10 s: send the current location and ask whether police acknowledged the alert
void pollStatus() {
  if (activeIncident.length() == 0) return;
  if (millis() - activeSince > 30UL * 60UL * 1000UL) {   // stop tracking after 30 minutes
    activeIncident = "";
    acked = false;
    idleScreen();
    return;
  }
  if (millis() - lastPoll < 10000) return;
  lastPoll = millis();

  int status = 0;
  String res = callSheet(wrap("{\"action\":\"watchStatus\",\"watchId\":\"" + linkedId +
                              "\",\"incidentId\":\"" + activeIncident + "\"" + locationJson() + "}"), status);

  if (res.indexOf("\"status\":\"CANCELLED\"") >= 0) {
    activeIncident = "";
    acked = false;
    idleScreen();
  } else if (!acked && res.indexOf("\"status\":\"ACKNOWLEDGED\"") >= 0) {
    acked = true;
    show("POLICE", "has acknowledged", "Help is on the way");
    delay(3500);
    idleScreen();
  }
}

// ---------- Web server ----------
void handleRoot() {
  server.send_P(200, "text/html", webpage);
}

// Browser sends JSON to /api; we wrap it with the secret and forward it untouched.
void handleApi() {
  String payload = server.arg("plain");
  if (payload.length() == 0 || payload.length() > 1500) {
    server.send(400, "application/json", "{\"success\":false,\"message\":\"Invalid request\"}");
    return;
  }
  int status = 0;
  String result = callSheet(wrap(payload), status);

  // Whoever logs in or registers on this hub becomes the owner of the watch
  bool isAuth = payload.indexOf("\"action\":\"login\"") >= 0 || payload.indexOf("\"action\":\"register\"") >= 0;
  if (isAuth && result.indexOf("\"success\":true") >= 0) {
    String id = jsonField(result, "watchId");
    if (id.length()) {
      linkedId = id;
      linkedName = jsonField(result, "name");
      prefs.putString("wid", linkedId);
      prefs.putString("wname", linkedName);
      activeIncident = "";
      acked = false;
      idleScreen();
    }
  }
  server.send(200, "application/json", result);
}

void setup() {
  Serial.begin(115200);
  randomSeed(esp_random());

  pinMode(TOUCH_PIN, INPUT);
  wasTouched = digitalRead(TOUCH_PIN) == HIGH;   // ignore a touch or pulse that is already there at power-up

  Serial1.setRxBufferSize(1024);
  Serial1.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  if (SDA_PIN < 0) Wire.begin(); else Wire.begin(SDA_PIN, SCL_PIN);
  int sdaPin = SDA_PIN < 0 ? (int)SDA : SDA_PIN;
  int sclPin = SCL_PIN < 0 ? (int)SCL : SCL_PIN;
  Serial.printf("I2C pins: SDA=%d SCL=%d\n", sdaPin, sclPin);
  if (sdaPin == TOUCH_PIN || sclPin == TOUCH_PIN || sdaPin == GPS_RX_PIN || sclPin == GPS_RX_PIN ||
      sdaPin == GPS_TX_PIN || sclPin == GPS_TX_PIN)
    Serial.println("WARNING: the OLED I2C pins clash with the touch/GPS pins. Change TOUCH_PIN, GPS_RX_PIN or GPS_TX_PIN at the top.");
  oledOk = display.begin(OLED_ADDR, true) || display.begin(0x3D, true);   // tries 0x3C then 0x3D
  if (!oledOk) Serial.println("SH1106 not found. Check wiring/address.");
  show("SENTINAL", "Starting...");

  prefs.begin("sentinal", false);
  linkedId = prefs.getString("wid", "");
  linkedName = prefs.getString("wname", "");

  WiFi.mode(WIFI_AP_STA);
  WiFi.setTxPower(WIFI_POWER_8_5dBm);    // helps many C3 Mini boards connect reliably
  WiFi.softAPConfig(IPAddress(192, 168, 4, 1), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));
  WiFi.softAP(AP_SSID, AP_PASS);

  Serial.println("Scanning for Wi-Fi networks (the ESP32 only sees 2.4 GHz)...");
  int found = WiFi.scanNetworks();
  bool hotspotSeen = false;
  for (int i = 0; i < found; i++) {
    Serial.printf("  %s  (channel %d, %d dBm)\n", WiFi.SSID(i).c_str(), WiFi.channel(i), WiFi.RSSI(i));
    if (WiFi.SSID(i) == HOME_SSID) hotspotSeen = true;
  }
  Serial.println(hotspotSeen ? "Your hotspot is visible." : "Your hotspot is NOT visible: set it to 2.4 GHz, check the name, move closer.");
  WiFi.scanDelete();

  WiFi.setAutoReconnect(true);
  WiFi.begin(HOME_SSID, HOME_PASS);
  Serial.print("Connecting to internet Wi-Fi");
  for (int i = 0; i < 30 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    readGPS();
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(" connected, IP: ");
    Serial.println(WiFi.localIP());
  } else {
    // 1 = hotspot not found (name wrong or 5 GHz), 4 = connect failed (usually wrong password), 6 = disconnected
    Serial.printf(" FAILED, status code %d (will keep retrying)\n", (int)WiFi.status());
  }

  server.on("/", HTTP_GET, handleRoot);
  server.on("/api", HTTP_POST, handleApi);
  server.begin();

  Serial.println("SENTINAL HOTSPOT STARTED");
  Serial.println("Join Wi-Fi: SENTINAL");
  Serial.println("Open: http://192.168.4.1");
  idleScreen();
}

void loop() {
  readGPS();
  server.handleClient();

  // GPS health check in the Serial Monitor: chars=0 means a wiring/pin problem, sats=0 means no sky view
  static unsigned long lastGpsLog = 0;
  if (millis() - lastGpsLog > 5000) {
    lastGpsLog = millis();
    Serial.printf("GPS chars=%lu sats=%d fix=%d\n", gps.charsProcessed(),
                  gps.satellites.isValid() ? (int)gps.satellites.value() : 0, haveFix ? 1 : 0);
  }

  // Keep trying to reach the internet hotspot if it is not connected
  static unsigned long lastWifiTry = 0;
  if (WiFi.status() != WL_CONNECTED && millis() - lastWifiTry > 15000) {
    lastWifiTry = millis();
    WiFi.disconnect();
    WiFi.begin(HOME_SSID, HOME_PASS);
  }

  bool touched = digitalRead(TOUCH_PIN) == HIGH;
  if (touched && !wasTouched && millis() - lastAlert > COOLDOWN_MS) {
    lastAlert = millis();
    sendAlert();
  }
  wasTouched = touched;

  pollStatus();

  if (millis() - lastDraw > 3000) idleScreen();
}
