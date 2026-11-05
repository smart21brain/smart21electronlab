/* ---------------------------------------------------------------
   Smart21 ElectroLab — lab tools (UI)
   Modals and menus, DC sweep / frequency response dialogs with
   plots, image / parts list / SPICE export, voltage-coloured wires,
   autosave and session restore.
   --------------------------------------------------------------- */
(function () {
  'use strict';
  const S21 = window.S21, P = S21.Parts;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (v, u) => P.fmt(v, u);
  const Tools = {};
  S21.Tools = Tools;
  const lab = () => S21.Lab, circuit = () => S21.Lab.editor.circuit;

  /* ===================== modal + popup menu ===================== */
  Tools.modal = function (o) {
    const back = document.createElement('div'); back.className = 'modal-back';
    back.innerHTML = '<div class="modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"><div class="modal-head"><h2>' + esc(o.title) + '</h2><button class="btn icon modal-x" aria-label="Close">✕</button></div><div class="modal-body"></div><div class="modal-foot"></div></div>';
    const body = $('.modal-body', back), foot = $('.modal-foot', back);
    if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
    const api = { el: back, body, foot, close() { document.removeEventListener('keydown', onKey, true); back.remove(); o.onClose && o.onClose(); } };
    for (const a of o.actions || []) { const b = document.createElement('button'); b.className = 'btn' + (a.primary ? ' primary' : ''); b.textContent = a.label; b.onclick = () => a.onClick(api, b); foot.appendChild(b); }
    if (!(o.actions || []).length) foot.style.display = 'none';
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); api.close(); } };
    document.addEventListener('keydown', onKey, true);
    back.addEventListener('mousedown', e => { if (e.target === back) api.close(); });
    $('.modal-x', back).onclick = api.close;
    document.body.appendChild(back);
    const first = body.querySelector('input,select,button'); if (first && !o.noFocus) setTimeout(() => first.focus(), 30);
    return api;
  };
  Tools.menu = function (anchor, items) {
    $$('.popmenu').forEach(m => m.remove());
    const m = document.createElement('div'); m.className = 'popmenu';
    for (const it of items) {
      if (it === '-') { m.appendChild(Object.assign(document.createElement('div'), { className: 'sep' })); continue; }
      const b = document.createElement('button'); b.innerHTML = '<b>' + esc(it.label) + '</b>' + (it.hint ? '<small>' + esc(it.hint) + '</small>' : '');
      b.onclick = () => { m.remove(); it.onClick(); }; m.appendChild(b);
    }
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect(); m.style.left = Math.min(r.left, innerWidth - m.offsetWidth - 8) + 'px'; m.style.top = (r.bottom + 4) + 'px';
    const off = e => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off, true); } };
    setTimeout(() => document.addEventListener('mousedown', off, true), 0);
  };

  /* ===================== saving files ===================== */
  Tools.saveFile = async function (name, data, encoding) {
    if (window.s21 && window.s21.saveFile) { const r = await window.s21.saveFile({ name, data, encoding }); if (r && r.ok) lab().toast('Saved ' + r.name, ''); else if (r && r.error) lab().toast(r.error, 'error'); return r && r.ok; }
    const bin = encoding === 'base64' ? Uint8Array.from(atob(data), c => c.charCodeAt(0)) : data;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bin])); a.download = name; document.body.appendChild(a); a.click(); a.remove(); return true;
  };
  Tools.copyText = async text => { try { await navigator.clipboard.writeText(text); lab().toast('Copied to the clipboard', ''); } catch (_) { lab().toast('Could not copy: select the text and press Ctrl+C.', 'warn'); } };

  /* ===================== static circuit rendering (thumbnails, PNG export) ===================== */
  const NS = 'http://www.w3.org/2000/svg';
  const snap = v => Math.round(v / 20) * 20;
  function routePts(circ, w) {
    const a = P.termPos(circ, w.a), b = P.termPos(circ, w.b); if (!a || !b) return null;
    let o, v;
    if (w.m) { o = w.m.o; v = w.m.v; } else if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) { o = 'h'; v = snap((a.x + b.x) / 2); } else { o = 'v'; v = snap((a.y + b.y) / 2); }
    return o === 'h' ? [[a.x, a.y], [v, a.y], [v, b.y], [b.x, b.y]] : [[a.x, a.y], [a.x, v], [b.x, v], [b.x, b.y]];
  }
  // Builds a standalone <svg> element for a circuit. Must be attached to the document for getBBox().
  Tools.renderCircuit = function (circ, opts) {
    opts = opts || {};
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('xmlns', NS);
    const world = document.createElementNS(NS, 'g'); svg.appendChild(world);
    const wl = document.createElementNS(NS, 'g'), pl = document.createElementNS(NS, 'g');
    world.appendChild(pl); world.appendChild(wl);
    const parts = circ.parts.slice().sort((a, b) => (P.PARTS[a.type].z ?? 5) - (P.PARTS[b.type].z ?? 5));
    for (const c of parts) {
      const d = P.PARTS[c.type], g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'comp comp-' + c.type); g.setAttribute('transform', 'translate(' + c.x + ',' + c.y + ') rotate(' + (c.rot || 0) + ')');
      let terms = ''; if (!d.noPins && !opts.noPins) for (const t of d.terms) terms += '<circle class="term" cx="' + t.x + '" cy="' + t.y + '" r="3.6"/>';
      const saveRt = c.rt; if (!opts.live) c.rt = {};
      const ps = P.partSvg ? P.partSvg(c, circ) : { svg: d.svg(c), sch: false };
      g.innerHTML = ps.svg + terms;
      const refs = {}; g.querySelectorAll('[data-ref]').forEach(n => { refs[n.getAttribute('data-ref')] = n; });
      if (d.update && opts.live !== false && !ps.sch) { try { d.update(c, refs); } catch (_) {} }
      c.rt = saveRt;
      pl.appendChild(g);
    }
    for (const w of circ.wires) {
      const pts = routePts(circ, w); if (!pts) continue;
      const p = document.createElementNS(NS, 'path'); p.setAttribute('d', pts.map((q, i) => (i ? 'L' : 'M') + q[0] + ',' + q[1]).join(' '));
      p.setAttribute('class', 'wire-line'); p.setAttribute('stroke', (opts.wireColor && opts.wireColor(w)) || w.color || '#7b8791'); wl.appendChild(p);
    }
    return { svg, world };
  };
  function bboxOf(world) { const b = world.getBBox(); return b.width ? b : { x: 0, y: 0, width: 200, height: 100 }; }
  const INLINE_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'display', 'visibility', 'filter'];
  function inlineStyles(svg) {
    for (const n of svg.querySelectorAll('*')) {
      const cs = getComputedStyle(n); let st = '';
      for (const p of INLINE_PROPS) { const v = cs.getPropertyValue(p); if (v) st += p + ':' + v + ';'; }
      n.setAttribute('style', st);
      n.removeAttribute('class');
    }
  }
  // returns { svgText, width, height } with all styles inlined (so it renders anywhere)
  Tools.circuitSvgText = function (circ, o) {
    o = o || {};
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-99999px;top:0;width:1px;height:1px;overflow:hidden;visibility:hidden';
    document.body.appendChild(host);
    try {
      const { svg, world } = Tools.renderCircuit(circ, o); host.appendChild(svg);
      const b = bboxOf(world), pad = o.pad === undefined ? 30 : o.pad, W = Math.ceil(b.width + pad * 2), H = Math.ceil(b.height + pad * 2);
      svg.setAttribute('viewBox', (b.x - pad) + ' ' + (b.y - pad) + ' ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
      inlineStyles(svg);
      if (o.background) { const r = document.createElementNS(NS, 'rect'); r.setAttribute('x', b.x - pad); r.setAttribute('y', b.y - pad); r.setAttribute('width', W); r.setAttribute('height', H); r.setAttribute('fill', o.background); svg.insertBefore(r, svg.firstChild); }
      return { svgText: new XMLSerializer().serializeToString(svg), width: W, height: H };
    } finally { host.remove(); }
  };
  Tools.svgToPng = function (svgText, w, h, scale) {
    return new Promise((res, rej) => {
      const img = new Image(); img.onload = () => {
        const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
        const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/png').split(',')[1]);
      }; img.onerror = () => rej(new Error('The image could not be rendered.'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
    });
  };
  Tools.thumb = function (circ, w, h) {       // small preview as an <svg> string
    try {
      const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-99999px;top:0;width:1px;height:1px;overflow:hidden;visibility:hidden'; document.body.appendChild(host);
      const { svg, world } = Tools.renderCircuit(circ, { noPins: true, live: false }); host.appendChild(svg);
      const b = bboxOf(world), pad = 20; svg.setAttribute('viewBox', (b.x - pad) + ' ' + (b.y - pad) + ' ' + (b.width + pad * 2) + ' ' + (b.height + pad * 2));
      svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%'); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet'); svg.removeAttribute('xmlns');
      const html = svg.outerHTML; host.remove(); return html;
    } catch (e) { return ''; }
  };

  /* ===================== image export ===================== */
  Tools.exportImage = function () {
    const circ = circuit(); if (!circ.parts.length) { lab().toast('The canvas is empty: nothing to export.', 'warn'); return; }
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const m = Tools.modal({
      title: 'Export circuit as an image',
      body: '<div class="form-grid"><label>Background<select id="ximBg"><option value="white">White (for documents)</option><option value="dark"' + (dark ? ' selected' : '') + '>Dark</option><option value="none">Transparent</option></select></label>' +
        '<label>Size<select id="ximScale"><option value="1">Normal (1×)</option><option value="2" selected>Sharp (2×)</option><option value="4">Poster (4×)</option></select></label></div>' +
        '<label class="chk"><input type="checkbox" id="ximVolt"' + (Tools.wireColors ? ' checked' : '') + '> Colour the wires by voltage (while running)</label>' +
        '<div class="ximPrev" id="ximPrev"></div><p class="soft">The picture shows the circuit exactly as it is now, including glowing LEDs while the simulation runs.</p>',
      actions: [{ label: 'Cancel', onClick: a => a.close() }, { label: 'Save PNG…', primary: true, onClick: save }]
    });
    const opts = () => ({ background: { white: '#ffffff', dark: '#0f1713', none: null }[$('#ximBg', m.el).value], wireColor: $('#ximVolt', m.el).checked ? wireColorFn() : null, live: true });
    const prev = () => { try { const r = Tools.circuitSvgText(circ, opts()); $('#ximPrev', m.el).innerHTML = r.svgText.replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"'); } catch (e) { $('#ximPrev', m.el).textContent = 'Preview not available.'; } };
    $$('select,input', m.el).forEach(x => x.onchange = prev); prev();
    async function save(a) {
      try {
        const r = Tools.circuitSvgText(circ, opts()), b64 = await Tools.svgToPng(r.svgText, r.width, r.height, +$('#ximScale', m.el).value);
        if (await Tools.saveFile('circuit.png', b64, 'base64')) { S21.Stats.mark('exports', 'png'); S21.Stats.bump('exportsTotal'); a.close(); }
      } catch (e) { lab().toast('Export failed: ' + e.message, 'error'); }
    }
  };

  /* ===================== parts list + SPICE ===================== */
  Tools.partsList = function () {
    const circ = circuit(); const rows = S21.Export.partsList(circ);
    if (!rows.length) { lab().toast('There are no parts yet.', 'warn'); return; }
    const total = rows.reduce((a, r) => a + r.qty, 0);
    const body = '<table class="bom"><thead><tr><th>Qty</th><th>Reference</th><th>Part</th><th>Value</th><th>Notes</th></tr></thead><tbody>' +
      rows.map(r => '<tr><td>' + r.qty + '</td><td class="mono">' + esc(r.refs.join(', ')) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.value) + '</td><td class="soft">' + esc(r.note) + '</td></tr>').join('') + '</tbody></table><p class="soft">' + total + ' parts, ' + rows.length + ' different. Ground symbols are not listed.</p>';
    Tools.modal({
      title: 'Parts list', wide: true, body,
      actions: [{ label: 'Copy', onClick: () => Tools.copyText(S21.Export.partsCsv(circ)) }, { label: 'Save CSV…', primary: true, onClick: async () => { if (await Tools.saveFile('parts-list.csv', S21.Export.partsCsv(circ))) { S21.Stats.mark('exports', 'bom'); S21.Stats.bump('exportsTotal'); } } }]
    });
    S21.Stats.mark('exports', 'bomView');
  };
  Tools.spice = function () {
    const circ = circuit(); if (!circ.parts.length) { lab().toast('There are no parts yet.', 'warn'); return; }
    const text = S21.Export.spiceNetlist(circ, { title: 'Smart21 ElectroLab circuit' });
    Tools.modal({
      title: 'SPICE netlist', wide: true,
      body: '<p class="soft">Open this in LTspice, ngspice or any SPICE simulator. Nets are called N001… and node 0 is ground.</p><pre class="netlist" tabindex="0">' + esc(text) + '</pre>',
      actions: [{ label: 'Copy', onClick: () => Tools.copyText(text) }, { label: 'Save .cir…', primary: true, onClick: async () => { if (await Tools.saveFile('circuit.cir', text)) { S21.Stats.mark('exports', 'spice'); S21.Stats.bump('exportsTotal'); } } }]
    });
  };

  /* ===================== plots ===================== */
  const COLORS = ['#2fbf8a', '#f5b942', '#9a82ff', '#ff6b7a', '#4cc9f0', '#ff9f5a'];
  function niceTicks(lo, hi, n) {
    if (!(hi > lo)) { hi = lo + 1; }
    const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p, step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p, out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(+v.toPrecision(12));
    return { ticks: out, lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step };
  }
  // o: { x[], series:[{label,y[],color}], logX, xLabel, yLabel, yUnit, xUnit, vlines:[{x,label}], hlines:[{y,label}], height }
  Tools.plot = function (host, o) {
    host.innerHTML = '<canvas></canvas><div class="plot-tip" hidden></div>';
    const cv = $('canvas', host), tip = $('.plot-tip', host); cv.style.height = (o.height || 240) + 'px';
    const cs = getComputedStyle(document.documentElement), col = n => cs.getPropertyValue(n).trim();
    function draw(cur) {
      const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 600, H = cv.clientHeight || 240;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const L = 64, R = 14, T = 12, B = 38, pw = W - L - R, ph = H - T - B;
      const xs = o.x, lx = v => o.logX ? Math.log10(v) : v;
      let x0 = lx(xs[0]), x1 = lx(xs[xs.length - 1]);
      let ymin = Infinity, ymax = -Infinity; for (const s of o.series) for (const v of s.y) if (isFinite(v)) { ymin = Math.min(ymin, v); ymax = Math.max(ymax, v); }
      if (!isFinite(ymin)) { ymin = 0; ymax = 1; } if (ymax - ymin < 1e-12) { ymin -= 0.5; ymax += 0.5; }
      const padY = (ymax - ymin) * 0.06, yt = niceTicks(ymin - padY, ymax + padY, 5);
      const px = v => L + (lx(v) - x0) / (x1 - x0 || 1) * pw, py = v => T + ph - (v - yt.lo) / (yt.hi - yt.lo) * ph;
      g.font = '11px ' + (cs.getPropertyValue('--mono') || 'monospace'); g.textBaseline = 'middle';
      g.strokeStyle = col('--line'); g.fillStyle = col('--soft'); g.lineWidth = 1;
      g.textAlign = 'right'; for (const t of yt.ticks) { const y = py(t); g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.fillText(fmt(t, o.yUnit || ''), L - 6, y); }
      g.textAlign = 'center';
      if (o.logX) { const d0 = Math.ceil(x0 - 1e-9), d1 = Math.floor(x1 + 1e-9); for (let d = d0; d <= d1; d++) { const x = L + (d - x0) / (x1 - x0) * pw; g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); g.fillText(fmt(Math.pow(10, d), o.xUnit || ''), x, T + ph + 14); } }
      else { const xt = niceTicks(Math.min(xs[0], xs[xs.length - 1]), Math.max(xs[0], xs[xs.length - 1]), 6); for (const t of xt.ticks) { const x = px(t); g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); g.fillText(fmt(t, o.xUnit || ''), x, T + ph + 14); } }
      g.fillStyle = col('--text'); g.textAlign = 'center'; g.fillText(o.xLabel || '', L + pw / 2, H - 8);
      g.save(); g.translate(13, T + ph / 2); g.rotate(-Math.PI / 2); g.fillText(o.yLabel || '', 0, 0); g.restore();
      g.strokeStyle = col('--soft'); g.strokeRect(L, T, pw, ph);
      g.save(); g.beginPath(); g.rect(L, T, pw, ph); g.clip();
      g.setLineDash([5, 4]); g.strokeStyle = col('--warn'); g.fillStyle = col('--warn'); g.textAlign = 'left';
      for (const h of o.hlines || []) { const y = py(h.y); g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.fillText(h.label || '', L + 6, y - 8); }
      for (const v of o.vlines || []) { const x = px(v.x); g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); g.fillText(v.label || '', x + 6, T + 12); }
      g.setLineDash([]); g.lineWidth = 2.2; g.lineJoin = 'round';
      o.series.forEach((s, k) => { g.strokeStyle = s.color || COLORS[k % COLORS.length]; g.beginPath(); let pen = false; s.y.forEach((v, i) => { if (!isFinite(v)) { pen = false; return; } const x = px(xs[i]), y = py(v); if (pen) g.lineTo(x, y); else { g.moveTo(x, y); pen = true; } }); g.stroke(); });
      g.restore();
      if (cur !== undefined) {
        const i = cur, x = px(xs[i]); g.strokeStyle = col('--soft'); g.lineWidth = 1; g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke();
        o.series.forEach((s, k) => { if (!isFinite(s.y[i])) return; g.fillStyle = s.color || COLORS[k % COLORS.length]; g.beginPath(); g.arc(x, py(s.y[i]), 4, 0, 7); g.fill(); });
      }
      draw.geom = { L, pw, x0, x1 };
    }
    draw();
    cv.onmousemove = e => {
      const r = cv.getBoundingClientRect(), g = draw.geom, fx = (e.clientX - r.left - g.L) / g.pw; if (fx < 0 || fx > 1) { tip.hidden = true; draw(); return; }
      const target = g.x0 + fx * (g.x1 - g.x0); let best = 0, bd = 1e99;
      o.x.forEach((v, i) => { const d = Math.abs((o.logX ? Math.log10(v) : v) - target); if (d < bd) { bd = d; best = i; } });
      draw(best);
      tip.hidden = false; tip.style.left = Math.min(e.clientX - r.left + 12, r.width - 180) + 'px'; tip.style.top = '8px';
      tip.innerHTML = '<b>' + fmt(o.x[best], o.xUnit || '') + '</b>' + o.series.map((s, k) => '<div><i style="background:' + (s.color || COLORS[k % COLORS.length]) + '"></i>' + esc(s.label) + ': ' + fmt(s.y[best], s.unit || o.yUnit || '') + '</div>').join('');
    };
    cv.onmouseleave = () => { tip.hidden = true; draw(); };
    const ro = new ResizeObserver(() => draw()); ro.observe(cv);
    return { redraw: draw };
  };
  const legend = series => '<div class="plot-legend">' + series.map((s, k) => '<span><i style="background:' + (s.color || COLORS[k % COLORS.length]) + '"></i>' + esc(s.label) + '</span>').join('') + '</div>';

  /* ===================== DC sweep dialog ===================== */
  Tools.dcSweep = function () {
    const circ = circuit(); if (!circ.parts.length) { lab().toast('Build or load a circuit first.', 'warn'); return; }
    const A = S21.Analysis, targets = A.sweepTargets(circ), mp = A.measurePoints(circ);
    if (!targets.length) { lab().toast('None of the parts has a value that can be swept.', 'warn'); return; }
    const pref = targets.findIndex(t => t.key === 'volts'); const sel0 = pref >= 0 ? pref : 0;
    const optT = targets.map((t, i) => '<option value="' + i + '"' + (i === sel0 ? ' selected' : '') + '>' + esc(t.ref + ' · ' + t.label + (t.unit ? ' (' + t.unit + ')' : '')) + '</option>').join('');
    const probes = (lab().probes || []).map(p => p.p + '.' + p.t);
    const optM = '<optgroup label="Voltages">' + mp.volts.map((m, i) => '<option value="v' + i + '"' + (probes.includes(m.ref.p + '.' + m.ref.t) ? ' selected' : '') + '>' + esc(m.label) + '</option>').join('') + '</optgroup>' +
      '<optgroup label="Currents">' + mp.amps.map((m, i) => '<option value="i' + i + '">' + esc(m.label) + '</option>').join('') + '</optgroup>';
    const body = '<p class="soft">Change one value in small steps and plot what happens. The sweep runs on a copy: your circuit is not touched. Capacitors act as open circuits and inductors as shorts (DC).</p>' +
      '<div class="form-grid"><label>Sweep this<select id="dcT">' + optT + '</select></label><label>From<input id="dcFrom" type="number" step="any"></label><label>To<input id="dcTo" type="number" step="any"></label><label>Points<input id="dcN" type="number" min="5" max="400" value="101"></label></div>' +
      '<label class="lbl">Measure (hold Ctrl to pick several)<select id="dcM" multiple size="6">' + optM + '</select></label><div id="dcOut"></div>';
    let last = null;
    const m = Tools.modal({ title: 'DC sweep', wide: true, body, actions: [{ label: 'Copy CSV', onClick: () => last && Tools.copyText(A.toCsv(last.res, last.xName)) }, { label: 'Save CSV…', onClick: () => last && Tools.saveFile('dc-sweep.csv', A.toCsv(last.res, last.xName)) }, { label: 'Run sweep', primary: true, onClick: run }] });
    const setRange = () => {
      const t = targets[+$('#dcT', m.el).value]; let a, b;
      if (t.key === 'volts') { a = 0; b = t.value; } else if (t.min !== undefined && t.max !== undefined) { a = t.min; b = t.max; } else { a = +(t.value / 10).toPrecision(3); b = +(t.value * 2).toPrecision(3); }
      $('#dcFrom', m.el).value = a; $('#dcTo', m.el).value = b;
    };
    $('#dcT', m.el).onchange = setRange; setRange();
    if (!$$('#dcM option:checked', m.el).length) { const o = $$('#dcM option', m.el).find(x => x.value[0] === 'i') || $('#dcM option', m.el); if (o) o.selected = true; }
    function run() {
      const t = targets[+$('#dcT', m.el).value], sel = $$('#dcM option:checked', m.el).map(o => o.value);
      if (!sel.length) { lab().toast('Pick at least one thing to measure.', 'warn'); return; }
      const outputs = sel.map(v => v[0] === 'v' ? mp.volts[+v.slice(1)] : mp.amps[+v.slice(1)]);
      const out = $('#dcOut', m.el); out.innerHTML = '<p class="soft">Calculating…</p>';
      setTimeout(() => {
        try {
          const res = A.dcSweep(circ, { partId: t.partId, key: t.key, from: +$('#dcFrom', m.el).value, to: +$('#dcTo', m.el).value, points: +$('#dcN', m.el).value, outputs });
          last = { res, xName: t.ref + ' ' + t.label + (t.unit ? ' (' + t.unit + ')' : '') };
          out.innerHTML = ''; const groups = {}; res.series.forEach((s, k) => { s.color = COLORS[k % COLORS.length]; (groups[s.unit] = groups[s.unit] || []).push(s); });
          for (const unit of Object.keys(groups)) { const d = document.createElement('div'); d.className = 'plot-box'; out.appendChild(d); const host = document.createElement('div'); d.appendChild(host); d.insertAdjacentHTML('beforeend', legend(groups[unit])); Tools.plot(host, { x: res.x, series: groups[unit], xLabel: last.xName, xUnit: t.unit, yLabel: unit === 'V' ? 'Voltage' : 'Current', yUnit: unit, height: 230 }); }
          if (!res.converged) out.insertAdjacentHTML('beforeend', '<p class="warn-note">Some points did not fully converge: the curve may have small errors.</p>');
          S21.Stats.mark('analysis', 'dc'); S21.Stats.bump('analysisRuns');
        } catch (e) { out.innerHTML = '<p class="warn-note">' + esc(e.message) + '</p>'; }
      }, 30);
    }
  };

  /* ===================== frequency response dialog ===================== */
  Tools.freqResponse = function () {
    const circ = circuit(), A = S21.Analysis, srcs = circ.parts.filter(p => p.type === 'acsource');
    if (!srcs.length) { Tools.modal({ title: 'Frequency response', body: '<p>This analysis needs a <b>function generator (AC source)</b> in the circuit: it provides the input signal.</p><p class="soft">Add one from the Sources palette, connect it to your filter or amplifier, then come back. The “RC low-pass filter (AC)” example is ready to use.</p>', actions: [{ label: 'Open the RC filter example', primary: true, onClick: a => { a.close(); lab().loadExample('rcfilter'); } }] }); return; }
    const refs = A.refMap(circ), mp = A.measurePoints(circ);
    const probes = (lab().probes || []).filter(p => !srcs.some(s => s.id === p.p)).map(p => p.p + '.' + p.t);
    const optS = srcs.map(s => '<option value="' + s.id + '">' + esc(refs[s.id]) + '</option>').join('');
    let defIdx = mp.volts.findIndex(m => probes.includes(m.ref.p + '.' + m.ref.t)); if (defIdx < 0) defIdx = mp.volts.findIndex(m => !srcs.some(s => s.id === m.ref.p) && !['battery', 'vcc'].includes(P.PARTS[circ.parts.find(p => p.id === m.ref.p).type] && circ.parts.find(p => p.id === m.ref.p).type)); if (defIdx < 0) defIdx = 0;
    const optO = mp.volts.map((m, i) => '<option value="' + i + '"' + (i === defIdx ? ' selected' : '') + '>' + esc(m.label) + '</option>').join('');
    const body = '<p class="soft">The simulator drives the circuit with a small sine wave at many frequencies and measures how big and how late the output is, compared with the input.</p>' +
      '<div class="form-grid"><label>Signal source<select id="acS">' + optS + '</select></label><label>Output point<select id="acO">' + optO + '</select></label>' +
      '<label>From (Hz)<input id="acF0" type="number" value="1" min="0.1" step="any"></label><label>To (Hz)<input id="acF1" type="number" value="100000" max="1000000" step="any"></label>' +
      '<label>Points<input id="acN" type="number" value="50" min="10" max="200"></label><label>Test amplitude (V)<input id="acA" type="number" value="0.1" min="0.001" max="5" step="any"></label></div><div id="acOut"></div>';
    let last = null;
    const m = Tools.modal({ title: 'Frequency response (Bode plot)', wide: true, body, actions: [{ label: 'Copy CSV', onClick: () => last && Tools.copyText(A.toCsv(last)) }, { label: 'Save CSV…', onClick: () => last && Tools.saveFile('frequency-response.csv', A.toCsv(last)) }, { label: 'Run analysis', primary: true, onClick: run }] });
    function run() {
      const out = $('#acOut', m.el), f0 = +$('#acF0', m.el).value, f1 = +$('#acF1', m.el).value;
      if (!(f0 > 0 && f1 > f0)) { out.innerHTML = '<p class="warn-note">“To” must be larger than “From”, and both above 0.</p>'; return; }
      out.innerHTML = '<p class="soft">Calculating…</p>';
      setTimeout(() => {
        try {
          const res = A.acSweep(circ, { srcId: $('#acS', m.el).value, outRef: mp.volts[+$('#acO', m.el).value].ref, fStart: f0, fStop: f1, points: +$('#acN', m.el).value, amp: +$('#acA', m.el).value });
          last = res; out.innerHTML = '';
          const vl = []; if (res.fcHigh) vl.push({ x: res.fcHigh, label: '−3 dB at ' + fmt(res.fcHigh, 'Hz') }); if (res.fcLow) vl.push({ x: res.fcLow, label: '−3 dB at ' + fmt(res.fcLow, 'Hz') });
          const d1 = document.createElement('div'); d1.className = 'plot-box'; out.appendChild(d1);
          Tools.plot(d1, { x: res.freq, series: [{ label: 'Gain', y: res.mag, unit: 'dB', color: COLORS[0] }], logX: true, xLabel: 'Frequency', xUnit: 'Hz', yLabel: 'Gain (dB)', yUnit: 'dB', vlines: vl, hlines: [{ y: res.peakDb - 3.0103, label: '−3 dB' }], height: 220 });
          const d2 = document.createElement('div'); d2.className = 'plot-box'; out.appendChild(d2);
          Tools.plot(d2, { x: res.freq, series: [{ label: 'Phase', y: res.phase, unit: '°', color: COLORS[1] }], logX: true, xLabel: 'Frequency', xUnit: 'Hz', yLabel: 'Phase (°)', yUnit: '°', vlines: vl, height: 200 });
          let sum = 'Peak gain <b>' + res.peakDb.toFixed(1) + ' dB</b> (×' + Math.pow(10, res.peakDb / 20).toFixed(2) + ') at ' + fmt(res.peakFreq, 'Hz') + '. ';
          if (res.fcHigh && !res.fcLow) sum += 'Low-pass behaviour: the gain falls 3 dB at <b>' + fmt(res.fcHigh, 'Hz') + '</b>.';
          else if (res.fcLow && !res.fcHigh) sum += 'High-pass behaviour: the gain is 3 dB down at <b>' + fmt(res.fcLow, 'Hz') + '</b>.';
          else if (res.fcLow && res.fcHigh) sum += 'Band-pass between <b>' + fmt(res.fcLow, 'Hz') + '</b> and <b>' + fmt(res.fcHigh, 'Hz') + '</b> (−3 dB points).';
          else sum += 'The gain stays within 3 dB over this range: no cut-off found.';
          out.insertAdjacentHTML('beforeend', '<p class="bode-sum">' + sum + '</p>');
          if (!res.converged) out.insertAdjacentHTML('beforeend', '<p class="warn-note">The solver had trouble converging; try a smaller amplitude.</p>');
          S21.Stats.mark('analysis', 'ac'); S21.Stats.bump('analysisRuns');
        } catch (e) { out.innerHTML = '<p class="warn-note">' + esc(e.message) + '</p>'; }
      }, 30);
    }
  };

  /* ===================== voltage-coloured wires ===================== */
  Tools.wireColors = false;
  function hue(v, vmax) {
    if (v < -0.05) return 'hsl(285,75%,' + (62 - Math.min(20, Math.abs(v) / vmax * 20)) + '%)';
    const t = Math.max(0, Math.min(1, v / vmax)); return 'hsl(' + Math.round(222 - 222 * t) + ',85%,' + (t > .35 && t < .7 ? 48 : 55) + '%)';
  }
  let vmaxCache = 5, nodeCache = null;
  function wireColorFn() {
    const rt = lab().rt; if (!rt) return null;
    return w => { const n = rt.nl.nodeOf(w.a.p, w.a.t); return hue(rt.sim.v[n] || 0, vmaxCache); };
  }
  function ensureLegend() {
    let lg = $('#vLegend'); if (lg) return lg;
    lg = document.createElement('div'); lg.id = 'vLegend'; lg.className = 'vlegend'; lg.hidden = true;
    lg.innerHTML = '<span id="vlMin">0 V</span><i></i><span id="vlMax">5 V</span>'; $('.canvas-wrap').appendChild(lg); return lg;
  }
  Tools.setWireColors = function (on) {
    Tools.wireColors = !!on; $('#btnWireV').classList.toggle('active', Tools.wireColors); ensureLegend().hidden = !Tools.wireColors || !lab().rt;
    if (!on && lab().editor) lab().editor.renderWires();
    if (on && !lab().rt) lab().toast('Wire colours show live voltages: press Run to see them.', '', 4000);
    if (on) S21.Stats.mark('feat', 'wireColors');
  };
  function colourWires() {
    const L = lab(), rt = L.rt, lg = ensureLegend();
    if (!Tools.wireColors || !rt) { lg.hidden = true; return; }
    let mx = 1; const v = rt.sim.v; for (let i = 1; i < v.length; i++) mx = Math.max(mx, v[i]);
    vmaxCache = vmaxCache + (mx - vmaxCache) * 0.25; if (mx > vmaxCache) vmaxCache = mx;
    lg.hidden = false; $('#vlMax').textContent = fmt(vmaxCache, 'V'); lg.querySelector('i').style.background = 'linear-gradient(90deg,' + [0, .25, .5, .75, 1].map(t => hue(vmaxCache * t, vmaxCache)).join(',') + ')';
    const byId = {}; for (const w of L.editor.circuit.wires) byId[w.id] = w;
    for (const g of $$('#canvas .wire')) {
      const w = byId[g.getAttribute('data-wire')]; if (!w) continue;
      const c = hue(v[rt.nl.nodeOf(w.a.p, w.a.t)] || 0, vmaxCache);
      for (const n of g.children) { if (n.classList.contains('wire-line')) n.setAttribute('stroke', c); else if (n.classList.contains('wire-end')) n.setAttribute('fill', c); }
    }
  }

  /* ===================== autosave / restore ===================== */
  const AKEY = 's21lab-autosave';
  let lastSaved = '', autosaveOn = false, pendingRestore = null;
  function stamp(t) { const d = new Date(t); return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0'); }
  function saveNow() {
    if (!autosaveOn || !lab().editor) return;
    let json; try { json = lab().serializeProject(); } catch (_) { return; }
    if (json === lastSaved) return;
    const circ = circuit(); if (!circ.parts.length) return;
    try { localStorage.setItem(AKEY, JSON.stringify({ t: Date.now(), project: json })); lastSaved = json; const s = $('#autoState'); if (s) s.textContent = 'Autosaved ' + stamp(Date.now()); } catch (_) {}
  }
  Tools.autosaveStart = function () {
    let stored = null; try { stored = JSON.parse(localStorage.getItem(AKEY) || 'null'); } catch (_) {}
    const cur = lab().serializeProject();
    if (stored && stored.project && stored.project !== cur) {
      let n = 0; try { n = JSON.parse(stored.project).circuit.parts.length; } catch (_) {}
      if (n > 0) { pendingRestore = stored; showRestoreBar(stored, n); }
    }
    if (!pendingRestore) { autosaveOn = true; lastSaved = stored ? stored.project : ''; }
    setInterval(saveNow, 4000); window.addEventListener('beforeunload', saveNow);
  };
  function showRestoreBar(st, n) {
    const bar = document.createElement('div'); bar.className = 'restore-bar';
    bar.innerHTML = '<span>↻ Your last session was autosaved at <b>' + stamp(st.t) + '</b> (' + n + ' parts).</span><button class="btn primary" id="rbYes">Restore it</button><button class="btn" id="rbNo">Start fresh</button>';
    $('.canvas-wrap').appendChild(bar);
    $('#rbYes', bar).onclick = () => { lab().loadProject(st.project); pendingRestore = null; autosaveOn = true; bar.remove(); lab().toast('Session restored.', ''); };
    $('#rbNo', bar).onclick = () => { pendingRestore = null; autosaveOn = true; lastSaved = ''; bar.remove(); };
  }
  Tools.restoreLast = function () { let st = null; try { st = JSON.parse(localStorage.getItem(AKEY) || 'null'); } catch (_) {} if (!st) { lab().toast('There is no autosaved session yet.', 'warn'); return; } lab().loadProject(st.project); };

  /* ===================== project menu / EEPROM ===================== */
  Tools.projectMenu = function (anchor) {
    const used = lab().eeprom ? lab().eeprom.reduce((a, b) => a + (b !== 255 ? 1 : 0), 0) : 0;
    Tools.menu(anchor, [
      { label: 'Export as image (PNG)…', hint: 'for reports and worksheets', onClick: Tools.exportImage },
      { label: 'Circuit report (PDF)…', hint: 'picture, parts list, notes, sketch', onClick: () => S21.Report.open() },
      { label: 'Parts list…', hint: 'bill of materials, CSV', onClick: Tools.partsList },
      { label: 'SPICE netlist…', hint: 'LTspice / ngspice', onClick: Tools.spice }, '-',
      { label: 'Restore last autosave', onClick: Tools.restoreLast },
      { label: 'Erase EEPROM (' + used + ' bytes used)', onClick: () => { if (lab().eeprom) { lab().eeprom.fill(255); lab().toast('EEPROM erased: every cell is 255 again.', ''); } } }
    ]);
  };
  Tools.analysisMenu = function (anchor) {
    Tools.menu(anchor, [{ label: 'DC sweep…', hint: 'vary a value, plot a voltage or current', onClick: Tools.dcSweep }, { label: 'Frequency response…', hint: 'Bode plot: gain and phase', onClick: Tools.freqResponse }]);
  };

  /* ===================== feature tracking for achievements ===================== */
  let lastTick = 0;
  Tools.tick = function (ts) {
    if (Tools.wireColors) colourWires();
    if (ts - lastTick < 700) return; lastTick = ts;
    const L = lab(), St = S21.Stats; if (!L.rt) return;
    const circ = L.editor.circuit;
    for (const c of circ.parts) {
      St.mark('parts', c.type);
      if (c.type === 'led' && (c.rt.ia || 0) > 0.004) St.feat('ledLit');
      if ((c.type === 'led' || c.type === 'rgbled') && c.rt.burnt && (c.rt.burnt === true || (Array.isArray(c.rt.burnt) && c.rt.burnt.some(Boolean)))) St.feat('burnt');
      if (c.type === 'relay' && c.rt.on) St.feat('relay');
      if (c.type === 'multimeter' && c.rt.reading !== undefined && c.rt.reading !== 0) St.feat('meter');
      if (c.type === 'hc595' && c.rt.latch) St.feat('shiftReg');
      if (c.type === 'opamp' && c.rt.state === 'lin') St.feat('opamp');
    }
    if (L.rt.interp && !L.rt.interp.error) {
      St.feat('sketch');
      const src = L.sketch || '';
      if (/EEPROM\./.test(src) || /EEPROM\[/.test(src)) St.feat('eeprom');
      if (/attachInterrupt/.test(src) && L.rt.interp.isrs && (L.rt.interp.isrs[0] || L.rt.interp.isrs[1])) St.feat('interrupt');
      if (/\bstruct\b/.test(src)) St.feat('struct');
    }
    if (L.serialBuf) St.feat('serial');
    if (L.probes && L.probes.length) St.feat('probe');
    St.bump('simSeconds', 0.7);
  };
  Tools.onStart = () => { S21.Stats.bump('runs'); };
  Tools.onExample = id => { S21.Stats.mark('examples', id); };


  /* ===================== circuit doctor ===================== */
  let docTimer = 0, docStatic = [], docPrevErrors = new Set(), docToasted = '';
  const ICON = { error: '⛔', warn: '⚠️', tip: '💡' };
  function updatePill(list) {
    const pill = $('#docPill'); if (!pill) return;
    const n = { error: 0, warn: 0, tip: 0 }; list.forEach(f => n[f.sev]++);
    const worst = n.error ? 'error' : n.warn ? 'warn' : n.tip ? 'tip' : 'ok';
    pill.hidden = !circuit().parts.length; pill.className = 'pill ' + worst; pill.textContent = worst === 'ok' ? '✓' : String(n.error + n.warn + n.tip);
    pill.parentElement.title = worst === 'ok' ? 'No problems found' : n.error + ' errors, ' + n.warn + ' warnings, ' + n.tip + ' tips: click for details';
    // a fixed error earns progress
    const errs = new Set(list.filter(f => f.sev === 'error').map(f => f.id));
    for (const id of docPrevErrors) if (!errs.has(id) && circuit().parts.length) S21.Stats.feat('fixedBug');
    docPrevErrors = errs;
  }
  function refreshStatic() { try { docStatic = S21.Doctor.analyze(circuit()); } catch (e) { docStatic = []; } updatePill(docStatic); }
  Tools.onChanged = function (kind) { if (kind !== 'topology') return; clearTimeout(docTimer); docTimer = setTimeout(refreshStatic, 700); };
  Tools.runCheck = function () {
    refreshStatic(); const errs = docStatic.filter(f => f.sev === 'error'); const key = errs.map(f => f.id).join();
    if (errs.length && key !== docToasted) { docToasted = key; lab().toast('Circuit check: ' + errs[0].title + '. ' + errs[0].text.split('. ')[0] + '. (Click Check for details)', 'warn', 7000); }
  };
  function flashPart(id) {
    const g = $('#canvas [data-comp="' + id + '"]'); if (!g) return;
    lab().editor.select({ kind: 'part', id }); g.classList.remove('flash'); void g.getBoundingClientRect(); g.classList.add('flash'); setTimeout(() => g.classList.remove('flash'), 2600);
  }
  Tools.doctor = function () {
    const body = document.createElement('div'); body.innerHTML = '<p class="soft">Looking at your circuit…</p>';
    const m = Tools.modal({ title: 'Circuit check', wide: true, body, actions: [{ label: 'Check again', onClick: () => go() }, { label: 'Close', primary: true, onClick: a => a.close() }] });
    function go() {
      body.innerHTML = '<p class="soft">Looking at your circuit and running it for a moment…</p>';
      setTimeout(() => {
        const st = S21.Doctor.analyze(circuit()); let dyn = [];
        try { dyn = S21.Doctor.analyzeRun(circuit(), lab().sketch || ''); } catch (e) { dyn = []; }
        const seen = new Set(), all = st.concat(dyn).filter(f => !seen.has(f.id) && seen.add(f.id)).sort((a, b) => S21.Doctor.SEV[a.sev] - S21.Doctor.SEV[b.sev]);
        docStatic = all; updatePill(all);
        S21.Stats.bump('doctorRuns'); S21.Stats.feat('doctor');
        if (!circuit().parts.length) { body.innerHTML = '<div class="doc-ok"><div class="big">🧩</div><p>The canvas is empty. Add some parts, then run the check.</p></div>'; return; }
        if (!all.length) { body.innerHTML = '<div class="doc-ok"><div class="big">✅</div><h3>No problems found</h3><p class="soft">Wiring looks sensible and nothing went wrong while the circuit ran. (The checker finds common mistakes, not every possible one.)</p></div>'; return; }
        body.innerHTML = '<div class="doc-list">' + all.map((f, i) => '<div class="doc-item ' + f.sev + '"><span class="di-ic">' + ICON[f.sev] + '</span><div><b>' + esc(f.title) + '</b><p>' + esc(f.text) + '</p></div>' + (f.parts.length ? '<button class="btn small" data-i="' + i + '">Show me</button>' : '') + '</div>').join('') + '</div>';
        $$('button[data-i]', body).forEach(b => b.onclick = () => { const f = all[+b.dataset.i]; m.close(); flashPart(f.parts[0]); });
      }, 40);
    }
    go();
  };

  /* ===================== wiring into the toolbar ===================== */
  Tools.init = function () {
    $('#btnAnalysis').onclick = e => Tools.analysisMenu(e.currentTarget);
    $('#btnProject').onclick = e => Tools.projectMenu(e.currentTarget);
    $('#btnWireV').onclick = () => Tools.setWireColors(!Tools.wireColors);
    $('#btnCheck').onclick = Tools.doctor;
    setTimeout(refreshStatic, 900);
    ensureLegend();
    setTimeout(Tools.autosaveStart, 600);
  };
})();
