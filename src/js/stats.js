/* ---------------------------------------------------------------
   Smart21 ElectroLab — usage statistics kept on this computer
   (feeds the home dashboard, achievements and the certificate).
   Nothing is ever sent anywhere.
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const KEY = 's21lab-stats';
  let data = { counters: {}, sets: {}, feats: {}, days: [], name: '', unlocked: {} };
  try { const raw = root.localStorage && root.localStorage.getItem(KEY); if (raw) data = Object.assign(data, JSON.parse(raw)); } catch (_) {}
  let timer = 0;
  const save = () => { clearTimeout(timer); timer = setTimeout(() => { try { root.localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) {} }, 300); };
  const listeners = [];
  const changed = () => { save(); listeners.forEach(f => { try { f(); } catch (_) {} }); };
  const today = () => new Date().toISOString().slice(0, 10);
  if (!data.days.includes(today())) { data.days.push(today()); data.days = data.days.slice(-400); save(); }

  const Stats = {
    get data() { return data; },
    bump(k, n) { data.counters[k] = (data.counters[k] || 0) + (n === undefined ? 1 : n); changed(); },
    count(k) { return data.counters[k] || 0; },
    mark(group, key) { const s = data.sets[group] = data.sets[group] || {}; if (!s[key]) { s[key] = 1; changed(); return true; } return false; },
    has(group, key) { return !!(data.sets[group] && data.sets[group][key]); },
    size(group) { return Object.keys(data.sets[group] || {}).length; },
    feat(k) { if (!data.feats[k]) { data.feats[k] = Date.now(); changed(); return true; } return false; },
    hasFeat(k) { return !!data.feats[k]; },
    setName(n) { data.name = String(n || '').slice(0, 60); changed(); },
    get name() { return data.name || ''; },
    unlock(id) { if (data.unlocked[id]) return false; data.unlocked[id] = Date.now(); changed(); return true; },
    onChange(f) { listeners.push(f); },
    reset() { data = { counters: {}, sets: {}, feats: {}, days: [today()], name: data.name, unlocked: {} }; changed(); }
  };
  S21.Stats = Stats;
  if (typeof module !== 'undefined' && module.exports) module.exports = Stats;
})(typeof window !== 'undefined' ? window : globalThis);
