/* Gram Hisab — moving from the old app ID (com.farm.chickenkhata) to the new one (com.gramhisab.app).
   Android treats a new ID as a different app with its own empty storage, so:
   old app: sync → install new app → copy a setup code;  new app: reads the code → downloads everything from the Google Sheet. */
'use strict';

const OLD_PKG = 'com.farm.chickenkhata';
const SETUP_PREFIX = 'GRAMHISAB-SETUP:';

// The old app's Android part has no packageName() bridge method.
function isOldApp() { return HAS_ANDROID && typeof Android.packageName !== 'function'; }

function setupCode() {
  const m = db.meta;
  const data = { u: m.syncUrl || '', k: m.syncKey || '', n: m.userName || '', l: m.voiceLang || 'en-IN', d: m.deviceName || '' };
  return SETUP_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}
function parseSetup(text) {
  const mm = new RegExp(SETUP_PREFIX + '([A-Za-z0-9+/=]+)').exec(String(text || ''));
  if (!mm) return null;
  try { const d = JSON.parse(decodeURIComponent(escape(atob(mm[1])))); return d && d.u && d.k ? d : null; } catch (e) { return null; }
}

// ---------- old app ----------
function moveBannerHtml() {
  if (!isOldApp()) return '';
  return `<button class="flag red" data-act="openMove"><span class="fi">🚚</span><span><b>Move to the new Gram Hisab app</b> — this old copy will stop getting updates. Takes 1 minute; your data comes along.</span><span class="go">Start</span></button>`;
}
async function openMove() {
  const m = db.meta, pend = Object.keys(m.pending).length;
  const synced = !!m.syncUrl && !pend && !m.syncError;
  let apkFile = null;
  try { apkFile = JSON.parse(await httpGet(updateBase() + 'update.json')).apk.file; } catch (e) {}
  openSheet(`<h2>🚚 Move to the new app</h2>
    <p class="small muted">The new Gram Hisab has a new internal ID, so Android installs it as a separate app. Your records move through your Google Sheet.</p>
    <div class="summary">
      <div class="line"><span><b>1.</b> Everything saved to Google Sheet</span><b>${!m.syncUrl ? '⚠ not set up' : synced ? '✅ done' : `⏳ ${pend} waiting`}</b></div>
      ${m.syncUrl ? (synced ? '' : `<button class="btn green" style="width:100%;margin:6px 0" data-act="moveSync">☁️ Sync now</button>`)
        : `<div class="small" style="padding:6px 0">No Google Sheet is set up. Save a backup file instead, then use <b>Import</b> in the new app (Settings → Phones & sync).</div><button class="btn" style="width:100%;margin-bottom:6px" data-act="exportSync">📤 Save backup file</button>`}
      <div class="line"><span><b>2.</b> Install the new app</span><b></b></div>
      <button class="btn primary" style="width:100%;margin:6px 0" data-act="moveInstall" data-v="${esc(apkFile || '')}" ${apkFile ? '' : 'disabled'}>⬇️ Install new Gram Hisab</button>
      <div class="small muted" style="padding-bottom:6px">If Android asks, allow “Install unknown apps”, then tap Install.</div>
      <div class="line"><span><b>3.</b> Copy your setup code</span><b></b></div>
      ${m.syncUrl ? `<button class="btn" style="width:100%;margin:6px 0" data-act="moveCopy">📋 Copy setup code</button>
        <div class="small muted">In the share menu, tap <b>Copy</b>. (Or long-press the code below and copy it.)</div>
        <textarea readonly style="width:100%;font-size:11px;margin-top:6px;border-radius:10px;border:1px solid var(--line);padding:6px" rows="3">${esc(setupCode())}</textarea>` : '<div class="small muted">(needs the Google Sheet)</div>'}
      <div class="line"><span><b>4.</b> Open the <b>new</b> Gram Hisab</span><b></b></div>
      <div class="small" style="padding:6px 0">It finds the code, asks “Set up from your old app?”, and downloads all your records. Then it offers to remove this old copy.</div>
    </div>
    <button class="btn big ghost" data-act="closeSheet">Later</button>`);
}

// ---------- new app ----------
let setupOffered = false;
function checkClipboardSetup() {
  if (isOldApp() || !HAS_ANDROID || typeof Android.readClipboard !== 'function' || setupOffered) return;
  if (Object.keys(db.records).length && db.meta.syncUrl) return;
  let s = null;
  try { s = parseSetup(Android.readClipboard()); } catch (e) {}
  if (!s) return;
  setupOffered = true;
  ask({ title: 'Set up from your old app?', sub: `Found your setup code${s.n ? ' for ' + s.n : ''}. Your records will be downloaded from your Google Sheet.`,
    buttons: [{ label: '✔ Yes, set up now', value: 'yes', cls: 'green' }, { label: 'No', value: 'no' }],
    onAnswer: a => { if (a === 'yes') applySetup(s); else onboarding(); } });
}
function setupFromText(text) {
  const s = parseSetup(text);
  if (!s) { toast('That is not a Gram Hisab setup code'); return; }
  applySetup(s);
}
async function applySetup(s) {
  const m = db.meta;
  m.syncUrl = s.u; m.syncKey = s.k; m.lastRev = 0; m.syncError = '';
  if (s.n) m.userName = s.n;
  if (s.l) m.voiceLang = s.l;
  if (s.d && (!m.deviceName || /^Phone$|^samsung|^SM-/i.test(m.deviceName))) m.deviceName = s.d;
  persist(true);
  closeSheet();
  toast('Downloading your records…');
  await syncNow(true);
  render();
  if (!m.userName) openUserSwitch(true);
  try { if (HAS_ANDROID && typeof Android.copyText === 'function') Android.copyText(''); } catch (e) {} // clear the code from the clipboard
}
function removeOldBannerHtml() {
  if (isOldApp() || !HAS_ANDROID || typeof Android.isInstalled !== 'function') return '';
  let old = false;
  try { old = Android.isInstalled(OLD_PKG); } catch (e) {}
  if (!old || !Object.keys(db.records).length || !db.meta.syncUrl || Object.keys(db.meta.pending).length) return '';
  return `<button class="flag amber" data-act="removeOld"><span class="fi">🧹</span><span>Your records are here. You can remove the <b>old</b> Gram Hisab copy now.</span><span class="go">Remove</span></button>`;
}
