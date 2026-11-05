/* ---------------------------------------------------------------
   Smart21 ElectroLab — circuit canvas editor (SVG)
   Drag parts, draw wires, snap to the breadboard grid, undo/redo.
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const P = S21.Parts, NS = P.NS, GRID = P.GRID;
  const WIRE_COLORS = ['#e5484d', '#3b82f6', '#f5a524', '#2fbf8a', '#9a82ff', '#e8eaed', '#ff7ac6'];
  const snap = v => Math.round(v / GRID) * GRID;
  const el = (name, attrs, parent) => { const n = document.createElementNS(NS, name); for (const k in attrs || {}) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };

  class Editor {
    constructor(svg, host) {
      this.svg = svg; this.host = host || {};
      this.circuit = P.newCircuit();
      this.view = { x: 60, y: 40, k: 1 };
      this.sel = null; this.multi = new Set(); this.clip = null; this.pasteN = 0; this.undoStack = []; this.redoStack = [];
      this.drag = null; this.spaceDown = false;
      this.buildDom();
      this.bind();
    }

    /* ---------- DOM ---------- */
    buildDom() {
      const svg = this.svg; svg.innerHTML = '';
      const defs = el('defs', {}, svg);
      for (const [name, c] of Object.entries(P.LED_COLORS)) {
        const g = el('radialGradient', { id: 'glow-' + name }, defs);
        el('stop', { offset: '0%', 'stop-color': c.rgb, 'stop-opacity': '0.95' }, g);
        el('stop', { offset: '35%', 'stop-color': c.rgb, 'stop-opacity': '0.45' }, g);
        el('stop', { offset: '100%', 'stop-color': c.rgb, 'stop-opacity': '0' }, g);
      }
      const pat = el('pattern', { id: 'gridpat', width: GRID, height: GRID, patternUnits: 'userSpaceOnUse' }, defs);
      el('circle', { cx: 1, cy: 1, r: 1, class: 'grid-dot' }, pat);
      this.world = el('g', { id: 'world' }, svg);
      el('rect', { x: -4000, y: -4000, width: 8000, height: 8000, fill: 'url(#gridpat)', class: 'grid-bg' }, this.world);
      this.layerParts = el('g', {}, this.world);
      this.layerWires = el('g', {}, this.world);
      this.layerTop = el('g', {}, this.world);   // terminals of parts that sit on the breadboard stay clickable
      this.layerOver = el('g', { class: 'overlay' }, this.world);
      this.hoverRing = el('circle', { r: 8, class: 'hover-ring', visibility: 'hidden' }, this.layerOver);
      this.preview = el('path', { class: 'wire-preview', visibility: 'hidden' }, this.layerOver);
      this.handle = el('circle', { r: 6, class: 'wire-handle', visibility: 'hidden' }, this.layerOver);
      this.applyView();
    }
    applyView() { this.world.setAttribute('transform', 'translate(' + this.view.x + ',' + this.view.y + ') scale(' + this.view.k + ')'); }
    toWorld(e) {
      const r = this.svg.getBoundingClientRect();
      return { x: (e.clientX - r.left - this.view.x) / this.view.k, y: (e.clientY - r.top - this.view.y) / this.view.k };
    }

    /* ---------- circuit ---------- */
    setCircuit(c, keepSel) {
      this.circuit = c; if (!keepSel) this.sel = null; this.multi.clear();
      this.render(); this.host.selected && this.host.selected(this.sel);
    }
    snapshot() { return JSON.stringify(P.serialize(this.circuit)); }
    pushUndo() { this.undoStack.push(this.snapshot()); if (this.undoStack.length > 100) this.undoStack.shift(); this.redoStack.length = 0; }
    restore(str) { const c = P.deserialize(JSON.parse(str)); this.setCircuit(c); this.host.changed && this.host.changed('topology'); }
    undo() { if (!this.undoStack.length) return; this.redoStack.push(this.snapshot()); this.restore(this.undoStack.pop()); }
    redo() { if (!this.redoStack.length) return; this.undoStack.push(this.snapshot()); this.restore(this.redoStack.pop()); }

    render() {
      this.layerParts.innerHTML = ''; this.layerWires.innerHTML = ''; this.layerTop.innerHTML = '';
      const parts = this.circuit.parts.slice().sort((a, b) => (P.PARTS[a.type].z ?? 5) - (P.PARTS[b.type].z ?? 5));
      for (const c of parts) this.renderPart(c);
      this.renderWires();
    }
    renderPart(c) {
      const d = P.PARTS[c.type];
      if (c._g && c._g.parentNode) c._g.parentNode.removeChild(c._g);
      if (c._tg && c._tg.parentNode) c._tg.parentNode.removeChild(c._tg);
      const g = el('g', { class: 'comp comp-' + c.type + ((this.sel && this.sel.id === c.id) || this.multi.has(c.id) ? ' selected' : ''), 'data-comp': c.id, transform: 'translate(' + c.x + ',' + c.y + ') rotate(' + c.rot + ')' });
      let hit = '';
      if (!d.bounds) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const t of d.terms) { x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y); x1 = Math.max(x1, t.x); y1 = Math.max(y1, t.y); }
        hit = '<rect class="hit" x="' + (x0 - 12) + '" y="' + (y0 - 12) + '" width="' + (x1 - x0 + 24) + '" height="' + (y1 - y0 + 24) + '"/>';
      }
      let terms = '';
      if (!d.noPins) for (const t of d.terms) terms += '<circle class="term' + (d.ground && d.ground.includes(t.n) ? ' gnd' : '') + '" cx="' + t.x + '" cy="' + t.y + '" r="3.6"/>';
      const ps = P.partSvg ? P.partSvg(c, this.circuit) : { svg: d.svg(c), sch: false };
      g.innerHTML = hit + ps.svg + terms; c._sch = ps.sch;
      c._refs = {}; g.querySelectorAll('[data-ref]').forEach(n => { c._refs[n.getAttribute('data-ref')] = n; });
      c._g = g;
      this.layerParts.appendChild(g);
      if (d.update && !c._sch) d.update(c, c._refs);
    }
    wireRoute(w) {
      const a = P.termPos(this.circuit, w.a), b = P.termPos(this.circuit, w.b);
      if (!a || !b) return null;
      let o, v;
      if (w.m) { o = w.m.o; v = w.m.v; }
      else if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) { o = 'h'; v = snap((a.x + b.x) / 2); }
      else { o = 'v'; v = snap((a.y + b.y) / 2); }
      const pts = o === 'h' ? [[a.x, a.y], [v, a.y], [v, b.y], [b.x, b.y]] : [[a.x, a.y], [a.x, v], [b.x, v], [b.x, b.y]];
      const out = [pts[0]];
      for (let i = 1; i < pts.length; i++) if (pts[i][0] !== out[out.length - 1][0] || pts[i][1] !== out[out.length - 1][1]) out.push(pts[i]);
      return { pts: out, o, v, a, b };
    }
    renderWires() {
      this.layerWires.innerHTML = '';
      for (const w of this.circuit.wires) {
        const r = this.wireRoute(w); if (!r) continue;
        if (!w.color) w.color = WIRE_COLORS[(parseInt(String(w.id).replace(/\D/g, ''), 10) || 0) % WIRE_COLORS.length];
        const d = r.pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(' ');
        const g = el('g', { class: 'wire' + (this.sel && this.sel.id === w.id ? ' selected' : ''), 'data-wire': w.id }, this.layerWires);
        el('path', { d, class: 'wire-hit' }, g);
        el('path', { d, class: 'wire-line', stroke: w.color }, g);
        el('circle', { cx: r.a.x, cy: r.a.y, r: 3, fill: w.color, class: 'wire-end' }, g);
        el('circle', { cx: r.b.x, cy: r.b.y, r: 3, fill: w.color, class: 'wire-end' }, g);
      }
      this.updateHandle();
    }
    updateHandle() {
      const w = this.sel && this.sel.kind === 'wire' ? this.circuit.wires.find(x => x.id === this.sel.id) : null;
      const r = w && this.wireRoute(w);
      if (!r) { this.handle.setAttribute('visibility', 'hidden'); return; }
      const hx = r.o === 'h' ? r.v : (r.a.x + r.b.x) / 2, hy = r.o === 'h' ? (r.a.y + r.b.y) / 2 : r.v;
      this.handle.setAttribute('cx', hx); this.handle.setAttribute('cy', hy); this.handle.setAttribute('visibility', 'visible');
      this.handleInfo = { w, o: r.o };
    }
    refreshLive() {
      for (const c of this.circuit.parts) { const d = P.PARTS[c.type]; if (d.update && c._refs && !c._sch) d.update(c, c._refs); }
    }

    /* ---------- selection / editing ---------- */
    selectMulti(ids) {
      this.multi = new Set(ids);
      this.sel = ids.length > 1 ? { kind: 'multi', ids: [...ids] } : ids.length === 1 ? { kind: 'part', id: ids[0] } : null;
      if (ids.length === 1) this.multi.clear();
      this.layerParts.querySelectorAll('.comp').forEach(g => g.classList.toggle('selected', ids.includes(g.getAttribute('data-comp'))));
      this.layerWires.querySelectorAll('.wire').forEach(g => g.classList.remove('selected'));
      this.updateHandle(); this.host.selected && this.host.selected(this.sel);
    }
    select(sel) {
      if (!sel || sel.kind !== 'multi') this.multi.clear();
      this.sel = sel;
      this.layerParts.querySelectorAll('.comp').forEach(g => g.classList.toggle('selected', (!!sel && sel.kind === 'part' && g.getAttribute('data-comp') === sel.id) || this.multi.has(g.getAttribute('data-comp'))));
      this.layerWires.querySelectorAll('.wire').forEach(g => g.classList.toggle('selected', !!sel && sel.kind === 'wire' && g.getAttribute('data-wire') === sel.id));
      this.updateHandle();
      this.host.selected && this.host.selected(sel);
    }
    getSelPart() { return this.sel && this.sel.kind === 'part' ? this.circuit.parts.find(p => p.id === this.sel.id) : null; }
    addPart(type, x, y, rot) {
      const d = P.PARTS[type];
      if (d.single && this.circuit.parts.some(p => p.type === type)) { this.host.toast && this.host.toast('Only one ' + d.name + ' is allowed in a circuit.', 'warn'); return null; }
      this.pushUndo();
      const c = P.addPart(this.circuit, type, snap(x), snap(y), rot || 0);
      this.renderPart(c); this.select({ kind: 'part', id: c.id });
      this.host.changed && this.host.changed('topology');
      return c;
    }
    deleteSelection() {
      if (!this.sel) return;
      this.pushUndo();
      if (this.sel.kind === 'multi') {
        const ids = new Set(this.sel.ids);
        this.circuit.parts = this.circuit.parts.filter(p => !ids.has(p.id));
        this.circuit.wires = this.circuit.wires.filter(w => !ids.has(w.a.p) && !ids.has(w.b.p));
        this.multi.clear();
      } else if (this.sel.kind === 'part') {
        const id = this.sel.id;
        this.circuit.parts = this.circuit.parts.filter(p => p.id !== id);
        this.circuit.wires = this.circuit.wires.filter(w => w.a.p !== id && w.b.p !== id);
      } else this.circuit.wires = this.circuit.wires.filter(w => w.id !== this.sel.id);
      this.sel = null; this.render(); this.host.selected && this.host.selected(null); this.host.changed && this.host.changed('topology');
    }
    rotateSelection() {
      const c = this.getSelPart(); if (!c) return;
      this.pushUndo(); c.rot = (c.rot + 90) % 360; c.rt = c.rt || {};
      this.circuit.wires.forEach(w => { if (w.a.p === c.id || w.b.p === c.id) delete w.m; });
      this.renderPart(c); this.renderWires(); this.host.changed && this.host.changed('topology');
    }
    selectedIds() { return this.sel && this.sel.kind === 'multi' ? [...this.sel.ids] : (this.sel && this.sel.kind === 'part' ? [this.sel.id] : []); }
    copySelection() {
      const ids = new Set(this.selectedIds()); if (!ids.size) return false;
      const data = P.serialize(this.circuit);
      this.clip = { parts: data.parts.filter(p => ids.has(p.id)), wires: data.wires.filter(w => ids.has(w.a.p) && ids.has(w.b.p)) };
      this.pasteN = 0; this.host.toast && this.host.toast('Copied ' + ids.size + ' part' + (ids.size > 1 ? 's' : '') + ' (Ctrl+V to paste).');
      return true;
    }
    paste() {
      if (!this.clip || !this.clip.parts.length) return false;
      this.pushUndo(); this.pasteN++; const off = 40 * this.pasteN, map = {}, made = [];
      for (const p of this.clip.parts) {
        const d = P.PARTS[p.type];
        if (d.single && this.circuit.parts.some(q => q.type === p.type)) { this.host.toast && this.host.toast('Skipped the ' + d.name + ': only one is allowed.', 'warn'); continue; }
        const c = P.addPart(this.circuit, p.type, p.x + off, p.y + off, p.rot, JSON.parse(JSON.stringify(p.props))); map[p.id] = c.id; made.push(c.id);
      }
      for (const w of this.clip.wires) if (map[w.a.p] && map[w.b.p]) { const n = P.addWire(this.circuit, { p: map[w.a.p], t: w.a.t }, { p: map[w.b.p], t: w.b.t }); if (w.m) n.m = { o: w.m.o, v: w.m.v + off }; }
      this.render(); this.selectMulti(made); this.host.changed && this.host.changed('topology'); return true;
    }
    selectAll() { this.selectMulti(this.circuit.parts.filter(p => !P.PARTS[p.type].noPins).map(p => p.id)); }
    duplicateSelection() {
      if (this.sel && this.sel.kind === 'multi') { if (this.copySelection()) this.paste(); return; }
      const c = this.getSelPart(); if (!c) return;
      const d = P.PARTS[c.type]; if (d.single) { this.host.toast && this.host.toast('Only one ' + d.name + ' is allowed.', 'warn'); return; }
      this.pushUndo();
      const n = P.addPart(this.circuit, c.type, c.x + 40, c.y + 40, c.rot, JSON.parse(JSON.stringify(c.props)));
      this.renderPart(n); this.select({ kind: 'part', id: n.id }); this.host.changed && this.host.changed('topology');
    }
    updatePartProps(c, rerender) {
      if (rerender) { this.renderPart(c); this.select(this.sel); }
      this.host.changed && this.host.changed('props');
    }
    fit() {
      const r = this.svg.getBoundingClientRect();
      // Canvas is hidden (e.g. app just launched on Home): remember to fit as soon as it is visible
      if (r.width < 50 || r.height < 50) { this.needsFit = true; return; }
      this.needsFit = false; this.autoFit = true;
      if (!this.circuit.parts.length) { this.view = { x: 60, y: 40, k: 1 }; this.applyView(); return; }
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const c of this.circuit.parts) {
        const d = P.PARTS[c.type];
        const pts = d.bounds ? [[d.bounds[0], d.bounds[1]], [d.bounds[0] + d.bounds[2], d.bounds[1] + d.bounds[3]]] : d.terms.map(t => [t.x, t.y]);
        for (const p of pts) { const q = P.rotPt(p[0], p[1], c.rot); x0 = Math.min(x0, c.x + q[0] - 24); y0 = Math.min(y0, c.y + q[1] - 24); x1 = Math.max(x1, c.x + q[0] + 24); y1 = Math.max(y1, c.y + q[1] + 24); }
      }
      const top = this.padTop || 0, H = r.height - top;
      const k = Math.max(0.35, Math.min(2.2, Math.min(r.width / (x1 - x0), H / (y1 - y0)) * 0.94));
      this.view = { k, x: (r.width - (x1 - x0) * k) / 2 - x0 * k, y: top + (H - (y1 - y0) * k) / 2 - y0 * k };
      this.applyView();
    }

    /* ---------- hit testing ---------- */
    hitTerminal(pt, comp, allowHoles) {
      const R = 10 / this.view.k + 2;
      let best = null, bd = R;
      for (const c of this.circuit.parts) {
        const d = P.PARTS[c.type]; if (d.noPins) continue;
        for (const t of P.getTerms(c)) { const dist = Math.hypot(t.x - pt.x, t.y - pt.y); if (dist < bd) { bd = dist; best = { p: c.id, t: t.name, x: t.x, y: t.y, comp: c }; } }
      }
      if (best) return best;
      if (allowHoles || (comp && P.PARTS[comp.type].noPins)) {
        const R2 = 8 / this.view.k + 1; bd = R2;
        for (const c of this.circuit.parts) {
          if (!P.PARTS[c.type].noPins) continue;
          for (const t of P.getTerms(c)) { const dist = Math.hypot(t.x - pt.x, t.y - pt.y); if (dist < bd) { bd = dist; best = { p: c.id, t: t.name, x: t.x, y: t.y, comp: c, hole: true }; } }
        }
      }
      return best;
    }

    // What is under the pointer? Parts win over wires; wires win over the breadboard.
    pick(e) {
      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      let part = null, bb = null, wire = null;
      for (const n of stack) {
        const cg = n.closest && n.closest('[data-comp]');
        if (cg) {
          const c = this.circuit.parts.find(p => p.id === cg.getAttribute('data-comp'));
          if (c) { if (P.PARTS[c.type].noPins) bb = bb || c; else part = part || c; }
        }
        const wg = n.closest && n.closest('[data-wire]');
        if (wg && !wire) wire = wg.getAttribute('data-wire');
      }
      return { part, bb, wire };
    }

    /* ---------- events ---------- */
    bind() {
      const svg = this.svg;
      svg.addEventListener('pointerdown', e => { this.autoFit = false; this.onDown(e); });
      // keep the project centred and large while the canvas is first shown / resized, until the user touches the view
      if (window.ResizeObserver) new ResizeObserver(() => { if (this.needsFit || this.autoFit) this.fit(); }).observe(svg);
      svg.addEventListener('pointermove', e => this.onMove(e));
      svg.addEventListener('pointerup', e => this.onUp(e));
      svg.addEventListener('pointercancel', e => this.onUp(e));
      svg.addEventListener('wheel', e => this.onWheel(e), { passive: false });
      svg.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
      svg.addEventListener('drop', e => {
        e.preventDefault();
        const t = e.dataTransfer.getData('text/plain');
        if (t.startsWith('part:')) { const pt = this.toWorld(e); this.addPart(t.slice(5), pt.x, pt.y); }
      });
      svg.addEventListener('contextmenu', e => e.preventDefault());
    }
    onDown(e) {
      this.svg.focus && this.svg.focus();
      const pt = this.toWorld(e);
      if (e.button === 1 || e.button === 2 || (e.button === 0 && this.spaceDown)) { this.startPan(e); return; }
      if (e.button !== 0) return;
      // wire mid-handle
      if (this.sel && this.sel.kind === 'wire' && this.handleInfo && e.target === this.handle) {
        this.pushUndo(); this.drag = { mode: 'handle' }; this.svg.setPointerCapture(e.pointerId); return;
      }
      const pk = this.pick(e), comp = pk.part;
      const term = this.hitTerminal(pt, pk.part || pk.bb, false);
      if (term) {
        if (e.shiftKey) { this.host.onProbe && this.host.onProbe({ p: term.p, t: term.t }); return; }
        this.drag = { mode: 'wire', from: term }; this.svg.setPointerCapture(e.pointerId);
        this.preview.setAttribute('visibility', 'visible'); this.updatePreview(pt); return;
      }
      if (comp && e.shiftKey) {
        const cur = new Set(this.selectedIds()); cur.has(comp.id) ? cur.delete(comp.id) : cur.add(comp.id); this.selectMulti([...cur]); return;
      }
      if (comp) {
        const d = P.PARTS[comp.type];
        const grouped = this.multi.size > 1 && this.multi.has(comp.id);
        if (!grouped) this.select({ kind: 'part', id: comp.id });
        this.drag = { mode: 'move', comp, ox: pt.x - comp.x, oy: pt.y - comp.y, moved: false, sx: e.clientX, sy: e.clientY };
        if (grouped) this.drag.group = [...this.multi].map(id => this.circuit.parts.find(p => p.id === id)).filter(Boolean).map(p => ({ comp: p, x: p.x, y: p.y, px: pt.x, py: pt.y }));
        if (d.momentary) { comp.rt.pressed = true; this.host.changed && this.host.changed('live'); this.renderLive(comp); }
        this.svg.setPointerCapture(e.pointerId); return;
      }
      if (pk.wire) { this.select({ kind: 'wire', id: pk.wire }); return; }
      if (pk.bb) {
        this.select({ kind: 'part', id: pk.bb.id });
        const c = pk.bb; this.drag = { mode: 'move', comp: c, ox: pt.x - c.x, oy: pt.y - c.y, moved: false, sx: e.clientX, sy: e.clientY };
        this.svg.setPointerCapture(e.pointerId); return;
      }
      if (e.shiftKey) {
        this.drag = { mode: 'marquee', x0: pt.x, y0: pt.y }; this.svg.setPointerCapture(e.pointerId);
        if (!this.marq) this.marq = el('rect', { class: 'marquee' }, this.layerOver);
        this.marq.setAttribute('visibility', 'visible'); this.updateMarquee(pt); return;
      }
      this.select(null);
      this.startPan(e);
    }
    updateMarquee(pt) {
      const d = this.drag, x = Math.min(d.x0, pt.x), y = Math.min(d.y0, pt.y), w = Math.abs(pt.x - d.x0), h = Math.abs(pt.y - d.y0);
      d.rect = { x, y, w, h }; this.marq.setAttribute('x', x); this.marq.setAttribute('y', y); this.marq.setAttribute('width', w); this.marq.setAttribute('height', h);
    }
    renderLive(c) { const d = P.PARTS[c.type]; if (d.update && c._refs) d.update(c, c._refs); }
    startPan(e) { this.drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: this.view.x, vy: this.view.y }; this.svg.setPointerCapture(e.pointerId); this.svg.classList.add('panning'); }
    updatePreview(pt) {
      const f = this.drag.from;
      const end = this.hitTerminal(pt, null, true);
      const b = end || pt;
      const o = Math.abs(b.x - f.x) >= Math.abs(b.y - f.y);
      const mx = snap((f.x + b.x) / 2), my = snap((f.y + b.y) / 2);
      const pts = o ? [[f.x, f.y], [mx, f.y], [mx, b.y], [b.x, b.y]] : [[f.x, f.y], [f.x, my], [b.x, my], [b.x, b.y]];
      this.preview.setAttribute('d', pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(' '));
      this.showRing(end);
    }
    showRing(t) {
      if (t) { this.hoverRing.setAttribute('cx', t.x); this.hoverRing.setAttribute('cy', t.y); this.hoverRing.setAttribute('visibility', 'visible'); }
      else this.hoverRing.setAttribute('visibility', 'hidden');
    }
    onMove(e) {
      const pt = this.toWorld(e);
      const d = this.drag;
      if (!d) {
        const pk = this.pick(e);
        const t = this.hitTerminal(pt, pk.part || pk.bb, false);
        this.showRing(t);
        this.host.onHover && this.host.onHover(t ? { p: t.p, t: t.t, label: this.termLabel(t) } : null, e);
        return;
      }
      if (d.mode === 'pan') { this.view.x = d.vx + (e.clientX - d.sx); this.view.y = d.vy + (e.clientY - d.sy); this.applyView(); }
      else if (d.mode === 'marquee') this.updateMarquee(pt);
      else if (d.mode === 'wire') this.updatePreview(pt);
      else if (d.mode === 'handle') {
        const w = this.handleInfo.w, v = snap(this.handleInfo.o === 'h' ? pt.x : pt.y);
        w.m = { o: this.handleInfo.o, v }; this.renderWires();
      } else if (d.mode === 'move') {
        if (!d.moved) { if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return; d.moved = true; this.pushUndo(); if (d.comp.rt.pressed) { d.comp.rt.pressed = false; this.renderLive(d.comp); } }
        if (d.group) {
          const gx = snap(pt.x - d.group[0].px), gy = snap(pt.y - d.group[0].py);
          for (const m of d.group) { m.comp.x = m.x + gx; m.comp.y = m.y + gy; m.comp._g.setAttribute('transform', 'translate(' + m.comp.x + ',' + m.comp.y + ') rotate(' + m.comp.rot + ')'); }
          this.renderWires(); return;
        }
        const nx = snap(pt.x - d.ox), ny = snap(pt.y - d.oy);
        if (nx !== d.comp.x || ny !== d.comp.y) {
          d.comp.x = nx; d.comp.y = ny;
          d.comp._g.setAttribute('transform', 'translate(' + nx + ',' + ny + ') rotate(' + d.comp.rot + ')');
          this.renderWires();
        }
      }
    }
    termLabel(t) { const d = P.PARTS[t.comp.type]; const def = d.terms.find(x => x.n === t.t); return d.name + ' · ' + (def && def.label ? def.label : t.t); }
    onUp(e) {
      const d = this.drag; if (!d) return;
      this.drag = null; this.svg.classList.remove('panning');
      try { this.svg.releasePointerCapture(e.pointerId); } catch (_) {}
      if (d.mode === 'marquee') {
        this.marq.setAttribute('visibility', 'hidden'); const r = d.rect, ids = [];
        if (r && (r.w > 4 || r.h > 4)) for (const c of this.circuit.parts) {
          const def = P.PARTS[c.type], inside = (x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
          if (def.noPins ? inside(c.x, c.y) : (inside(c.x, c.y) || P.getTerms(c).some(t => inside(t.x, t.y)))) ids.push(c.id);
        }
        this.selectMulti(ids); return;
      }
      if (d.mode === 'wire') {
        this.preview.setAttribute('visibility', 'hidden'); this.showRing(null);
        const end = this.hitTerminal(this.toWorld(e), null, true);
        if (end && !(end.p === d.from.p && end.t === d.from.t)) {
          const dup = this.circuit.wires.some(w => (w.a.p === d.from.p && w.a.t === d.from.t && w.b.p === end.p && w.b.t === end.t) || (w.b.p === d.from.p && w.b.t === d.from.t && w.a.p === end.p && w.a.t === end.t));
          if (!dup) {
            this.pushUndo();
            const w = P.addWire(this.circuit, { p: d.from.p, t: d.from.t }, { p: end.p, t: end.t });
            this.renderWires(); this.select({ kind: 'wire', id: w.id });
            this.host.changed && this.host.changed('topology');
          }
        }
      } else if (d.mode === 'handle') { this.host.changed && this.host.changed('topology'); }
      else if (d.mode === 'move') {
        const pd = P.PARTS[d.comp.type];
        if (pd.momentary && d.comp.rt.pressed) { d.comp.rt.pressed = false; this.renderLive(d.comp); this.host.changed && this.host.changed('live'); }
        if (d.moved) { this.host.changed && this.host.changed('topology'); }
        else if (pd.clickable && pd.onClick) { if (pd.onClick(d.comp, this.toWorld(e))) { this.renderPart(d.comp); this.select(this.sel); this.host.changed && this.host.changed('props'); } }
      }
    }
    onWheel(e) {
      e.preventDefault(); this.autoFit = false;
      const cg = e.target.closest && e.target.closest('[data-comp]');
      const comp = cg ? this.circuit.parts.find(p => p.id === cg.getAttribute('data-comp')) : null;
      if (comp && (comp.type === 'pot' || comp.type === 'ldr') && !e.ctrlKey) {
        const key = comp.type === 'pot' ? 'pos' : 'light';
        comp.props[key] = Math.max(0, Math.min(100, comp.props[key] + (e.deltaY < 0 ? 5 : -5)));
        this.renderLive(comp); this.host.changed && this.host.changed('props'); this.host.selected && this.host.selected(this.sel);
        return;
      }
      const r = this.svg.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      const k0 = this.view.k, k1 = Math.max(0.25, Math.min(3, k0 * Math.exp(-e.deltaY * 0.0015)));
      this.view.x = mx - (mx - this.view.x) * (k1 / k0); this.view.y = my - (my - this.view.y) * (k1 / k0); this.view.k = k1;
      this.applyView();
    }
    onKey(e) {
      const tag = (e.target.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return false;
      if (e.type === 'keyup') { if (e.code === 'Space') { this.spaceDown = false; return true; } return false; }
      if (e.code === 'Space') { this.spaceDown = true; return true; }
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.shiftKey ? this.redo() : this.undo(); return true; }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { this.redo(); return true; }
      if ((e.ctrlKey || e.metaKey) && k === 'd') { this.duplicateSelection(); return true; }
      if ((e.ctrlKey || e.metaKey) && k === 'c') { return this.copySelection(); }
      if ((e.ctrlKey || e.metaKey) && k === 'v') { return this.paste(); }
      if ((e.ctrlKey || e.metaKey) && k === 'a') { this.selectAll(); return true; }
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      if (k === 'delete' || k === 'backspace') { this.deleteSelection(); return true; }
      if (k === 'r') { this.rotateSelection(); return true; }
      if (k === 'escape') { this.select(null); return true; }
      if (k === 'f') { this.fit(); return true; }
      return false;
    }
  }

  S21.Editor = Editor;
})(typeof window !== 'undefined' ? window : globalThis);
