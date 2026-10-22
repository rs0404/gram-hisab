/* Poultry Record — built-in updater.
   Updates are GitHub Releases: each release has update.json, web-<version>.json and the APK attached,
   and phones read them from …/releases/latest/download/.
   update.json looks like:
   { "web": { "version": "1.8.1", "minNative": 9, "bundle": "web-1.8.1.json" },
     "apk": { "versionCode": 9, "versionName": "1.8", "file": "PoultryRecord-1.8.apk", "notes": "…" } }
   Screens/logic (web) update silently; a new APK shows an "Install" banner (Android asks to confirm). */
'use strict';

const DEFAULT_UPDATE_URL = 'https://github.com/rs0404/poultry-record/releases/latest/download/';
let updateInfo = null;      // { apk: {...} } when a newer APK is available
let updateBusy = false;

function updateBase() {
  let u = (db.meta.updateUrl || DEFAULT_UPDATE_URL).trim();
  return u.endsWith('/') ? u : u + '/';
}
function cmpVer(a, b) {
  const x = String(a || '0').split('.').map(n => parseInt(n, 10) || 0), y = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const p = x[i] || 0, q = y[i] || 0; if (p !== q) return p < q ? -1 : 1; }
  return 0;
}
function nativeCode() { try { return HAS_ANDROID ? Android.nativeVersion() : 0; } catch (e) { return 0; } }
function httpGet(url) {
  return new Promise((resolve, reject) => {
    if (HAS_ANDROID) {
      const id = 'g' + Math.random().toString(36).slice(2);
      httpCallbacks[id] = (status, text) => (status >= 200 && status < 300 ? resolve(text) : reject(new Error(status ? 'HTTP ' + status : (text || 'No internet'))));
      Android.http(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), null, id);
    } else fetch(url, { cache: 'no-store' }).then(r => (r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)))).then(resolve, reject);
  });
}

async function checkForUpdates(manual) {
  if (!HAS_ANDROID || updateBusy) { if (manual && !HAS_ANDROID) toast('Updates work inside the Android app'); return; }
  updateBusy = true;
  try {
    const info = JSON.parse(await httpGet(updateBase() + 'update.json'));
    db.meta.lastUpdateCheck = Date.now();
    let msg = 'Poultry Record is up to date ✓';
    // 1) newer APK?
    if (info.apk && Number(info.apk.versionCode) > nativeCode()) {
      updateInfo = { apk: info.apk };
      msg = `App update v${info.apk.versionName} is ready — tap Install`;
    } else updateInfo = null;
    // 2) newer screens that this APK can run?
    if (info.web && cmpVer(info.web.version, APP_VERSION) > 0 && nativeCode() >= Number(info.web.minNative || 0) && info.web.version !== db.meta.skipWeb) {
      const bundle = await httpGet(updateBase() + info.web.bundle);
      const ok = Android.installWeb(bundle);
      if (ok) {
        db.meta.pendingWebUpdate = info.web.version;
        persist(true);
        if (manual || (!sheetOpen() && !listening && !pendingAsk)) { toast(`Updating to v${info.web.version}…`); setTimeout(() => Android.reloadApp(), 900); }
        else msg = `Update v${info.web.version} will start next time you open the app`;
      } else msg = 'Update download failed — try again later';
    }
    persist();
    if (manual) toast(msg);
    render();
  } catch (e) {
    if (manual) toast('Could not check for updates: ' + (e.message || e));
  } finally { updateBusy = false; }
}

window.onApkProgress = pct => {
  if (pct === -1) toast('Update download failed. Check internet and try again.');
  else if (pct === -2) toast('Allow “Install unknown apps” for Poultry Record, then tap Install again.');
  else if (pct === 101) toast('Tap “Update” on the next screen');
  else if (pct >= 0) toast(`Downloading update… ${pct}%`);
};
function installApkUpdate() {
  if (!updateInfo || !updateInfo.apk) return;
  toast('Downloading update…');
  Android.installApk(updateBase() + updateInfo.apk.file);
}

function updateBannerHtml() {
  if (!updateInfo || !updateInfo.apk) return '';
  return `<button class="flag blue" data-act="installApk"><span class="fi">⬆️</span><span>App update v${esc(updateInfo.apk.versionName)} available${updateInfo.apk.notes ? ' — ' + esc(updateInfo.apk.notes) : ''}</span><span class="go">Install</span></button>`;
}
function updatesCardHtml() {
  const nn = (() => { try { return HAS_ANDROID ? Android.nativeVersionName() : '—'; } catch (e) { return '—'; } })();
  const dl = (() => { try { return HAS_ANDROID && Android.usingDownloadedScreens(); } catch (e) { return false; } })();
  return `<h2>Updates</h2>
    <div class="card">
      <div class="summary small">
        <div class="line"><span>Screens version</span><b>v${APP_VERSION}${dl ? ' (downloaded)' : ''}</b></div>
        <div class="line"><span>App (APK) version</span><b>v${esc(nn)}</b></div>
        <div class="line"><span>Last check</span><b>${db.meta.lastUpdateCheck ? new Date(db.meta.lastUpdateCheck).toLocaleString() : '—'}</b></div>
      </div>
      ${updateBannerHtml()}
      <button class="btn big primary" data-act="checkUpdates">⬆️ Check for updates</button>
      <p class="small muted">Updates are checked automatically when the app opens (with internet). Small updates install silently; bigger ones ask you to tap Install.</p>
      <details><summary class="small muted">Advanced</summary>
        <div class="field" style="margin-top:8px"><label>Update link</label><input data-meta="updateUrl" value="${esc(db.meta.updateUrl || '')}" placeholder="${DEFAULT_UPDATE_URL}" autocomplete="off"></div>
      </details>
    </div>`;
}

// start-up: tell Android the screens loaded fine, then look for updates now and every 6 hours
function startUpdater() {
  try {
    if (HAS_ANDROID) {
      Android.appReady();
      const failed = Android.rollbackNote(); // version of downloaded screens that did not start
      if (failed) { db.meta.skipWeb = failed; delete db.meta.pendingWebUpdate; persist(true); setTimeout(() => toast(`Update v${failed} did not start — kept the working version`), 1500); }
    }
  } catch (e) {}
  if (db.meta.pendingWebUpdate && cmpVer(APP_VERSION, db.meta.pendingWebUpdate) >= 0) { toast(`Updated to v${APP_VERSION} ✓`); delete db.meta.pendingWebUpdate; persist(); }
  setTimeout(() => checkForUpdates(false), 4000);
  setInterval(() => { if (!document.hidden) checkForUpdates(false); }, 6 * 3600 * 1000);
}
