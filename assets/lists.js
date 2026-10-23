/* Gram Hisab — edit the app's name lists: chicken types, crops, work types, मल types, mill kinds.
   ✎ rename (records keep the id, so the new name shows everywhere), 🗑 delete when never used,
   otherwise 🙈 hide (gone from new entries, old records still show it) and ↺ restore. */
'use strict';

// fertilizer list is editable too (records store the name, so renaming only affects new entries)
function fertList() { const l = getSet('fertList'); return Array.isArray(l) && l.length ? l : FERTILIZERS; }
const shown = list => list.filter(x => !x.hidden);

function countWhere(fn) { let n = 0; for (const id in db.records) { const r = db.records[id]; if (!r.deleted && r.kind !== 'audit' && fn(r)) n++; } return n; }
const LISTS = {
  breeds: {
    title: '🐔 Chicken types', get: () => breeds(), save: l => saveBreeds(l), name: x => x.name, two: false,
    used: id => countWhere(r => (r.kind === 'lot' && (r.breed === id || (r.mix || []).some(m => m.breed === id))) || ((r.kind === 'sale' || r.kind === 'event') && r.breed === id)),
    add: name => ({ id: normName(name) || rid(), name, live: 0, meat: 0 }), rename: (x, ne) => Object.assign(x, { name: ne })
  },
  crops: {
    title: '🌾 Crops', get: () => cropList(), save: l => setSet('cropList', l), name: x => `${x.ne} · ${x.en}`, two: true,
    used: id => countWhere(r => (r.kind === 'kheti' && (r.crops || []).some(c => c.crop === id)) || (r.kind === 'harvest' && r.crop === id)),
    add: (ne, en) => ({ id: 'c_' + (normName(en || ne).slice(0, 16) || rid()), ne, en: en || ne, group: 'veg' }), rename: (x, ne, en) => Object.assign(x, { ne, en: en || x.en })
  },
  work: {
    title: '👷 Work types', get: () => workTypes(), save: l => setSet('workTypes', l), name: x => `${x.ne} · ${x.en}`, two: true,
    used: id => countWhere(r => r.kind === 'fwork' && r.workType === id),
    add: (ne, en) => ({ id: 'w_' + (normName(en || ne).slice(0, 16) || rid()), ne, en: en || ne }), rename: (x, ne, en) => Object.assign(x, { ne, en: en || x.en })
  },
  fert: {
    title: '🧪 मल types', get: () => fertList(), save: l => setSet('fertList', l), name: x => `${x.ne} · ${x.en}`, two: true,
    used: id => { const x = fertList().find(f => f.id === id); return x ? countWhere(r => r.kind === 'finput' && r.item === x.en) : 0; },
    add: (ne, en) => ({ id: 'f_' + (normName(en || ne).slice(0, 16) || rid()), ne, en: en || ne }), rename: (x, ne, en) => Object.assign(x, { ne, en: en || x.en }),
    note: 'Old entries keep the name they were saved with.'
  },
  mill: {
    title: '⚙️ Mill kinds', get: () => millItems(), save: l => setSet('millItems', l), name: x => `${x.ne} · ${x.en}${x.rate ? ' · ' + money(x.rate) + '/पाथी' : ''}`, two: true,
    used: id => countWhere(r => r.kind === 'mill' && r.item === id),
    add: (ne, en) => ({ id: 'm_' + (normName(en || ne).slice(0, 16) || rid()), ne, en: en || ne, work: /कुट|kut/i.test(ne + en) ? 'kutani' : 'pisani', rate: 0 }), rename: (x, ne, en) => Object.assign(x, { ne, en: en || x.en })
  }
};

function openListEditor(key) {
  const L = LISTS[key], list = L.get();
  const act = list.filter(x => !x.hidden), hid = list.filter(x => x.hidden);
  const row = x => { const n = L.used(x.id); return `<div class="line" style="gap:6px;align-items:center">
      <span style="flex:1;min-width:0">${esc(L.name(x))}<br><span class="small muted">${n ? n + ' record' + (n > 1 ? 's' : '') : 'not used yet'}</span></span>
      ${x.hidden ? `<button class="btn sm ghost" data-act="listRestore" data-k="${key}" data-id="${esc(x.id)}">↺ Restore</button>`
        : `<button class="btn sm ghost" data-act="listRename" data-k="${key}" data-id="${esc(x.id)}">✎</button><button class="btn sm redl" data-act="listDelete" data-k="${key}" data-id="${esc(x.id)}">${n ? '🙈 Hide' : '🗑'}</button>`}</div>`; };
  openSheet(`<h2>${L.title}</h2>
    <div class="summary small">${act.map(row).join('') || '<div class="line"><span class="muted">Empty</span></div>'}</div>
    <button class="btn big green" data-act="listAdd" data-k="${key}">+ Add</button>
    ${hid.length ? `<h3>🙈 Hidden</h3><div class="summary small">${hid.map(row).join('')}</div>` : ''}
    <p class="small muted">✎ renames everywhere. 🗑 deletes a name that was never used; a used one is 🙈 hidden (not offered for new entries, old records keep it) and can be restored. ${L.note || ''}</p>
    <button class="btn big primary" data-act="listDone" data-k="${key}">Done</button>`);
}
function askNames(title, cur, two, done, back) {
  ask({ title, sub: two ? 'Nepali name, then optionally “ / English”, e.g. मकै / Maize' : '', input: { text: true, placeholder: cur || (two ? 'नेपाली / English' : 'Name') },
    onAnswer: t => { const [ne, en] = String(t).split('/').map(s => s.trim()); if (!ne) { back(); return; } done(ne, en || ''); }, onCancel: back });
}
function listClick(act, b) {
  const key = b.dataset.k, id = b.dataset.id, L = LISTS[key];
  if (!L && act.startsWith('list')) return false;
  const back = () => openListEditor(key);
  const upd = fn => { const l = L.get().map(x => Object.assign({}, x)); fn(l); L.save(l); render(); back(); };
  switch (act) {
    case 'listOpen': openListEditor(key); return true;
    case 'listRename': { const x = L.get().find(y => y.id === id);
      askNames(`✎ Rename ${L.two ? x.ne : x.name}`, L.two ? `${x.ne} / ${x.en}` : x.name, L.two, (ne, en) => {
        if (L.get().some(y => y.id !== id && (L.two ? y.ne : y.name).toLowerCase() === ne.toLowerCase())) { toast('That name already exists'); back(); return; }
        upd(l => L.rename(l.find(y => y.id === id), ne, en)); toast('Renamed ✓'); }, back); return true; }
    case 'listDelete': { const x = L.get().find(y => y.id === id), n = L.used(id), nm = L.two ? x.ne : x.name;
      if (L.get().filter(y => !y.hidden).length <= 1) { toast('Keep at least one'); return true; }
      ask({ title: n ? `Hide ${nm}?` : `Delete ${nm}?`, sub: n ? `${n} old record${n > 1 ? 's' : ''} use it — they keep it. It won't be offered for new entries; you can restore it.` : 'It was never used.',
        buttons: [{ label: n ? '🙈 Hide' : '🗑 Delete', value: 'yes', cls: 'red' }, { label: 'Keep', value: 'no' }],
        onAnswer: a => { if (a !== 'yes') { back(); return; } upd(l => { if (n) l.find(y => y.id === id).hidden = true; else l.splice(l.findIndex(y => y.id === id), 1); }); toast(n ? `${nm} hidden` : `${nm} deleted`); }, onCancel: back });
      return true; }
    case 'listRestore': upd(l => { delete l.find(y => y.id === id).hidden; }); toast('Restored ✓'); return true;
    case 'listAdd': askNames('+ Add', '', L.two, (ne, en) => {
        const ex = L.get().find(y => (L.two ? y.ne : y.name).toLowerCase() === ne.toLowerCase());
        if (ex) { if (ex.hidden) { upd(l => { delete l.find(y => y.id === ex.id).hidden; }); toast('It was hidden — restored ✓'); } else { toast('Already there'); back(); } return; }
        const item = L.two ? L.add(ne, en) : L.add(ne.charAt(0).toUpperCase() + ne.slice(1));
        if (L.get().some(y => y.id === item.id)) item.id += '_' + Date.now().toString(36);
        upd(l => l.push(item)); toast(`Added ${ne} ✓`); }, back); return true;
    case 'listDone': closeSheet(); render(); return true;
  }
  return false;
}
