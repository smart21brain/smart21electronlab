/* ---------------------------------------------------------------
   Smart21 ElectroLab — serial plotter (like Arduino IDE ▸ Tools ▸ Serial Plotter)
   Reads the numbers the sketch prints: "12", "12 40 7", "12,40,7" or "temp:21.5,light:300".
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const Plot = {}; S21.Plotter = Plot;
  const COLORS = ['#2fe27a', '#ffd92e', '#ff6b7a', '#7cc7ff', '#c79bff', '#ff9f43', '#4de3d1', '#e8e8e8'];
  const NUM = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

  // text → { labels: [...], rows: [[v0, v1, …], …] }  (at most the last `max` rows, at most 8 columns)
  Plot.parse = function (text, max) {
    max = max || 400; const rows = [], labels = [];
    for (const raw of String(text).split('\n')) {
      const line = raw.trim(); if (!line || line[0] === '»') continue;           // » marks what the user typed
      const vals = [], names = [];
      for (const tok of line.split(/[\s,;]+/)) {
        if (!tok) continue; const m = tok.indexOf(':') > 0 ? [tok.slice(0, tok.indexOf(':')), tok.slice(tok.indexOf(':') + 1)] : [null, tok];
        if (NUM.test(m[1])) { vals.push(parseFloat(m[1])); names.push(m[0]); }
      }
      if (!vals.length || vals.length > 8) continue;
      names.forEach((nm, i) => { if (nm) labels[i] = nm; });
      rows.push(vals);
    }
    const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
    return { labels: Array.from({ length: cols }, (_, i) => labels[i] || 'v' + (i + 1)), rows: rows.slice(-max) };
  };
  Plot.range = function (rows) {
    let lo = Infinity, hi = -Infinity; for (const r of rows) for (const v of r) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (!isFinite(lo)) return { lo: 0, hi: 1 }; if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.08; return { lo: lo - pad, hi: hi + pad };
  };
  Plot.draw = function (cv, data) {
    const dpr = root.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const padL = 52, padB = 18, padT = 8, pw = w - padL - 10, ph = h - padB - padT;
    g.font = '11px ui-monospace, monospace'; g.lineWidth = 1;
    if (!data.rows.length) { g.fillStyle = '#7d8f86'; g.fillText('Print numbers with Serial.println(value); (or Serial.print(a); Serial.print(","); Serial.println(b);) and they are plotted here.', padL, padT + 20); return null; }
    const { lo, hi } = Plot.range(data.rows), Y = v => padT + ph - (v - lo) / (hi - lo) * ph, n = data.rows.length, X = i => padL + (n <= 1 ? 0 : i / (n - 1)) * pw;
    for (let i = 0; i <= 5; i++) { const v = lo + (hi - lo) * i / 5, y = Y(v); g.strokeStyle = '#25312b'; g.beginPath(); g.moveTo(padL, y); g.lineTo(padL + pw, y); g.stroke(); g.fillStyle = '#7d8f86'; g.fillText(Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2), 4, y + 4); }
    for (let c = 0; c < data.labels.length; c++) {
      g.strokeStyle = COLORS[c % COLORS.length]; g.lineWidth = 2; g.beginPath(); let started = false;
      data.rows.forEach((r, i) => { if (r[c] === undefined) return; const x = X(i), y = Y(r[c]); if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y); });
      g.stroke();
    }
    return { lo, hi };
  };
  Plot.legend = function (data) {
    const last = data.rows[data.rows.length - 1] || [];
    return data.labels.map((l, i) => '<span><i style="background:' + COLORS[i % COLORS.length] + '"></i>' + l.replace(/[<>&]/g, '') + (last[i] !== undefined ? ' = ' + (Math.abs(last[i]) >= 100 ? last[i].toFixed(0) : +last[i].toFixed(3)) : '') + '</span>').join('');
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Plot;
})(typeof window !== 'undefined' ? window : globalThis);
