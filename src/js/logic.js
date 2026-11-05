/* ---------------------------------------------------------------
   Smart21 ElectroLab — logic analyzer (timing diagram) for the probes
   Pure helpers (edges, bus values, VCD export) + the canvas drawing.
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const Logic = {}; S21.Logic = Logic;
  const COLORS = ['#2fe27a', '#ffd92e', '#ff6b7a', '#7cc7ff', '#c79bff', '#ff9f43', '#4de3d1', '#e8e8e8'];
  Logic.COLORS = COLORS;

  // threshold: half of the highest voltage seen on any channel (2.5 V for 5 V logic, 1.65 V for 3.3 V logic)
  Logic.threshold = function (chans, t0, t1) {
    let mx = 0;
    for (const ch of chans) for (let i = ch.t.length - 1; i >= 0 && ch.t[i] >= t0; i--) { if (ch.t[i] <= t1 && ch.v[i] > mx) mx = ch.v[i]; }
    return mx < 1 ? 1.65 : mx / 2;
  };
  // level of the channel at time t (0/1); uses hysteresis-free comparison against th
  Logic.levelAt = function (ch, t, th) { for (let i = ch.t.length - 1; i >= 0; i--) if (ch.t[i] <= t) return ch.v[i] > th ? 1 : 0; return 0; };
  // [[t, level], …] for t0 ≤ t ≤ t1: the first entry is the level at t0, the rest are the changes
  Logic.edges = function (ch, th, t0, t1) {
    const out = [[t0, Logic.levelAt(ch, t0, th)]];
    for (let i = 0; i < ch.t.length; i++) {
      const t = ch.t[i]; if (t <= t0) continue; if (t > t1) break;
      const lvl = ch.v[i] > th ? 1 : 0; if (lvl !== out[out.length - 1][1]) out.push([t, lvl]);
    }
    return out;
  };
  // value of the channels read as a binary number (channel 0 = bit 0) at each moment something changes
  Logic.busSegments = function (chans, th, t0, t1) {
    const per = chans.map(ch => Logic.edges(ch, th, t0, t1)), times = new Set([t0]);
    per.forEach(e => e.forEach(x => times.add(x[0])));
    const ts = Array.from(times).sort((a, b) => a - b), segs = [];
    for (let k = 0; k < ts.length; k++) {
      let v = 0; per.forEach((e, bit) => { let l = e[0][1]; for (const x of e) { if (x[0] <= ts[k]) l = x[1]; else break; } v |= l << bit; });
      const end = k + 1 < ts.length ? ts[k + 1] : t1;
      if (segs.length && segs[segs.length - 1].v === v) segs[segs.length - 1].t1 = end; else segs.push({ t0: ts[k], t1: end, v });
    }
    return segs;
  };
  // Value Change Dump for GTKWave / Sigrok PulseView (1 µs resolution)
  Logic.toVCD = function (chans, names, th) {
    const ids = chans.map((c, i) => String.fromCharCode(33 + i)), lines = ['$date ' + new Date().toISOString() + ' $end', '$version Smart21 ElectroLab $end', '$timescale 1 us $end', '$scope module circuit $end'];
    chans.forEach((c, i) => lines.push('$var wire 1 ' + ids[i] + ' ' + String(names[i] || 'ch' + i).replace(/[^A-Za-z0-9_.\[\]]/g, '_') + ' $end'));
    lines.push('$upscope $end', '$enddefinitions $end');
    const ev = [];
    chans.forEach((ch, i) => { let last = -1; for (let k = 0; k < ch.t.length; k++) { const l = ch.v[k] > th ? 1 : 0; if (l !== last) { ev.push([Math.round(ch.t[k] * 1000), i, l]); last = l; } } });
    ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let cur = null; for (const e of ev) { if (e[0] !== cur) { lines.push('#' + e[0]); cur = e[0]; } lines.push(e[2] + ids[e[1]]); }
    return lines.join('\n') + '\n';
  };

  /* ---------- canvas ---------- */
  // opts: { chans, names, tNow, win (ms), cursors [t…], bus (bool) }
  Logic.draw = function (cv, o) {
    const dpr = root.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const chans = o.chans || [], padL = 86, padT = 6, padB = 20, pw = w - padL - 10, n = Math.max(1, chans.length + (o.bus && chans.length > 1 ? 1 : 0)), lane = (h - padT - padB) / n;
    const tEnd = o.tNow, tStart = tEnd - o.win, X = t => padL + (t - tStart) / o.win * pw;
    g.font = '11px ui-monospace, monospace'; g.lineWidth = 1; g.strokeStyle = '#25312b'; g.fillStyle = '#7d8f86';
    for (let i = 0; i <= 10; i++) { const x = padL + pw * i / 10; g.beginPath(); g.moveTo(x, padT); g.lineTo(x, h - padB); g.stroke(); const tt = tStart + o.win * i / 10; g.fillText(o.win >= 1000 ? (tt / 1000).toFixed(2) + 's' : tt.toFixed(o.win < 50 ? 1 : 0) + 'ms', x - 14, h - 5); }
    if (!chans.length) { g.fillStyle = '#7d8f86'; g.fillText('Shift+click pins on the canvas to add up to 8 signals, then press Run.', padL + 8, padT + 22); return null; }
    const th = Logic.threshold(chans, tStart, tEnd);
    chans.forEach((ch, k) => {
      const y0 = padT + k * lane, yH = y0 + lane * 0.2, yL = y0 + lane * 0.8, col = COLORS[k % COLORS.length];
      g.strokeStyle = '#1b2621'; g.beginPath(); g.moveTo(0, y0 + lane); g.lineTo(w, y0 + lane); g.stroke();
      g.fillStyle = col; g.fillText(String(o.names[k] || 'ch' + k).slice(0, 12), 6, y0 + lane / 2 + 4);
      const e = Logic.edges(ch, th, tStart, tEnd); g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
      let lvl = e[0][1]; g.moveTo(X(tStart), lvl ? yH : yL);
      for (let i = 1; i < e.length; i++) { g.lineTo(X(e[i][0]), lvl ? yH : yL); lvl = e[i][1]; g.lineTo(X(e[i][0]), lvl ? yH : yL); }
      g.lineTo(X(tEnd), lvl ? yH : yL); g.stroke(); g.lineWidth = 1;
    });
    if (o.bus && chans.length > 1) {
      const y0 = padT + chans.length * lane, mid = y0 + lane / 2; g.fillStyle = '#9fb0a8'; g.fillText('bus (ch0=LSB)', 6, mid + 4);
      for (const s of Logic.busSegments(chans, th, tStart, tEnd)) {
        const xa = X(s.t0), xb = X(s.t1); g.strokeStyle = '#3d4f47'; g.beginPath(); g.rect(xa + 1, y0 + lane * 0.2, Math.max(1, xb - xa - 2), lane * 0.6); g.stroke();
        if (xb - xa > 34) { g.fillStyle = '#e8f1ec'; g.fillText('0x' + s.v.toString(16).toUpperCase() + ' (' + s.v + ')', xa + 5, mid + 4); }
      }
    }
    g.setLineDash([4, 3]); (o.cursors || []).forEach((t, i) => { if (t < tStart || t > tEnd) return; const x = X(t); g.strokeStyle = i ? '#ff6b7a' : '#7cc7ff'; g.beginPath(); g.moveTo(x, padT); g.lineTo(x, h - padB); g.stroke(); g.fillStyle = i ? '#ff6b7a' : '#7cc7ff'; g.fillText('AB'[i], x + 3, padT + 10); }); g.setLineDash([]);
    return { tStart, win: o.win, padL, pw, th };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Logic;
})(typeof window !== 'undefined' ? window : globalThis);
