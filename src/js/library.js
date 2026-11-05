/* ---------------------------------------------------------------
   Smart21 ElectroLab — personal library: recent projects and your own templates
   Stored in the browser/app storage (localStorage). Templates can be exported to
   a "pack" file and imported on another computer (handy for teachers and classes).
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const Lib = {}; S21.Library = Lib;
  const RK = 's21lab-recent', TK = 's21lab-templates', MAX_RECENT = 8, PACK = 'smart21-electrolab-pack';
  const store = () => { try { return root.localStorage || null; } catch (_) { return null; } };
  const load = k => { const s = store(); if (!s) return []; try { const v = JSON.parse(s.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
  const put = (k, v) => { const s = store(); if (!s) return false; try { s.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } };
  const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const valid = json => { try { const d = typeof json === 'string' ? JSON.parse(json) : json; return !!(d && d.app === 'smart21-electrolab' && d.circuit); } catch (_) { return false; } };
  const partCount = json => { try { return JSON.parse(json).circuit.parts.length; } catch (_) { return 0; } };
  Lib.valid = valid; Lib.partCount = partCount;

  /* ---------- recent ---------- */
  Lib.recent = () => load(RK);
  Lib.addRecent = function (title, json) {
    if (!valid(json) || !partCount(json)) return false;                      // an empty canvas is not worth remembering
    title = String(title || 'Untitled circuit').replace(/\.(s21lab|json)$/i, '').slice(0, 60);
    let list = load(RK).filter(r => r.title !== title);
    list.unshift({ id: uid(), title, when: Date.now(), parts: partCount(json), data: json });
    list = list.slice(0, MAX_RECENT);
    while (list.length && !put(RK, list)) list.pop();                         // storage full: drop the oldest until it fits
    return list.length > 0;
  };
  Lib.removeRecent = id => put(RK, load(RK).filter(r => r.id !== id));
  Lib.clearRecent = () => put(RK, []);

  /* ---------- my templates ---------- */
  Lib.templates = () => load(TK);
  Lib.addTemplate = function (title, desc, json) {
    if (!valid(json)) return { ok: false, error: 'That is not a Smart21 ElectroLab project.' };
    if (!partCount(json)) return { ok: false, error: 'The canvas is empty: build something first.' };
    title = String(title || '').trim().slice(0, 60) || 'My template';
    const list = load(TK).filter(t => t.title.toLowerCase() !== title.toLowerCase());       // same name = replace
    const t = { id: uid(), title, desc: String(desc || '').trim().slice(0, 300), when: Date.now(), parts: partCount(json), data: json };
    list.unshift(t);
    if (!put(TK, list)) return { ok: false, error: 'Storage is full. Delete some templates and try again.' };
    return { ok: true, template: t, replaced: list.length < load(TK).length + 0 };
  };
  Lib.removeTemplate = id => put(TK, load(TK).filter(t => t.id !== id));
  Lib.renameTemplate = (id, title) => { const l = load(TK), t = l.find(x => x.id === id); if (!t) return false; t.title = String(title || t.title).slice(0, 60); return put(TK, l); };

  /* ---------- class packs (teachers) ---------- */
  Lib.exportPack = function (ids) {
    const list = load(TK).filter(t => !ids || ids.indexOf(t.id) >= 0);
    return JSON.stringify({ app: PACK, version: 1, exported: new Date().toISOString(), templates: list.map(t => ({ title: t.title, desc: t.desc, data: t.data })) }, null, 1);
  };
  Lib.importPack = function (text) {
    let d; try { d = JSON.parse(text); } catch (_) { return { ok: false, error: 'That file is not a valid template pack.' }; }
    if (!d || d.app !== PACK || !Array.isArray(d.templates)) return { ok: false, error: 'That file is not a Smart21 ElectroLab template pack.' };
    let added = 0, skipped = 0;
    for (const t of d.templates) { const r = t && valid(t.data) ? Lib.addTemplate(t.title, t.desc, t.data) : { ok: false }; if (r.ok) added++; else skipped++; }
    return { ok: true, added, skipped };
  };

  Lib.ago = function (ms) {
    const s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago';
    return Math.round(s / 86400) + ' d ago';
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Lib;
})(typeof window !== 'undefined' ? window : globalThis);
