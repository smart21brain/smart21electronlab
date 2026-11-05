/* ---------------------------------------------------------------
   Smart21 ElectroLab — Circuit Lab controller (UI + run loop)
   --------------------------------------------------------------- */
(function () {
  'use strict';
  const S21 = window.S21, P = S21.Parts, PARTS = P.PARTS, fmt = P.fmt;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const DEFAULT_SKETCH = S21.Examples.list.find(e => e.id === 'blink').sketch;

  const Lab = {
    editor: null, rt: null, running: false, paused: false, speed: 1, sketch: DEFAULT_SKETCH,
    serialBuf: '', serialDirty: false, consoleLines: [], unseen: 0, probes: [], sound: false, audio: null,
    lastTs: 0, lastUi: 0, hoverRef: null, projectName: 'Untitled'
  };
  S21.Lab = Lab;

  /* ===================== toast / console ===================== */
  function toast(msg, level, ms) {
    const host = $('#toasts'), t = document.createElement('div'); t.className = 'toast ' + (level || ''); t.textContent = msg; t.title = 'Click to dismiss';
    t.onclick = () => t.remove(); host.appendChild(t);
    while (host.children.length > 3) host.firstChild.remove();
    setTimeout(() => t.remove(), ms || 5200);
  }
  Lab.toast = toast;
  function log(level, msg, line) {
    Lab.consoleLines.push({ level, msg, line });
    if (Lab.consoleLines.length > 300) Lab.consoleLines.shift();
    const d = document.createElement('div'); d.className = level;
    d.textContent = (line ? '[line ' + line + '] ' : '') + msg;
    $('#consoleOut').appendChild(d); $('#consoleOut').scrollTop = 1e9;
    if (!$('#pane-console').classList.contains('on') && level !== 'info' && level !== 'ok') { Lab.unseen++; const b = $('#consoleBadge'); b.hidden = false; b.textContent = Lab.unseen; }
  }

  /* ===================== palette ===================== */
  const CATS = ['Power', 'Passive', 'Semiconductors', 'Analog ICs', 'Drivers & power ICs', 'Switches & output', 'Display & motion', 'Sensors', 'Digital ICs', 'Instruments', 'Boards'];
  function thumb(type) {
    const d = PARTS[type]; const c = { id: 't', type, x: 0, y: 0, rot: 0, props: Object.assign({}, d.defaults), rt: {} };
    const vb = d.bounds ? d.bounds.join(' ') : '-50 -34 100 68';
    return '<svg class="thumb" viewBox="' + vb + '" preserveAspectRatio="xMidYMid meet">' + d.svg(c) + '</svg>';
  }
  function buildPalette(filter) {
    const list = $('#palList'); list.innerHTML = '';
    filter = (filter || '').toLowerCase();
    for (const cat of CATS) {
      const items = P.ORDER.filter(id => PARTS[id].cat === cat && (!filter || (PARTS[id].name + ' ' + PARTS[id].desc).toLowerCase().includes(filter)));
      if (!items.length) continue;
      const h = document.createElement('div'); h.className = 'pal-cat'; h.textContent = cat; list.appendChild(h);
      for (const id of items) {
        const b = document.createElement('button'); b.className = 'pal-item'; b.dataset.type = id; b.draggable = true; b.title = PARTS[id].desc;
        b.innerHTML = thumb(id) + '<span>' + PARTS[id].name + '</span>';
        b.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', 'part:' + id); e.dataTransfer.effectAllowed = 'copy'; });
        b.addEventListener('click', () => {
          const r = Lab.editor.svg.getBoundingClientRect();
          const pt = Lab.editor.toWorld({ clientX: r.left + r.width / 2 + (Math.random() - .5) * 120, clientY: r.top + r.height / 2 + (Math.random() - .5) * 120 });
          const g = S21.Guide && S21.Guide.placementFor && S21.Guide.placementFor(id);
          if (g) { const c = Lab.editor.addPart(id, g.x, g.y, g.rot); if (c && g.props && Object.keys(g.props).length) { Object.assign(c.props, g.props); Lab.editor.renderPart(c); Lab.editor.select({ kind: 'part', id: c.id }); Lab.changed('props'); } }
          else Lab.editor.addPart(id, pt.x, pt.y);
          hideHint();
        });
        list.appendChild(b);
      }
    }
  }
  function hideHint() { $('#canvasHint').style.display = Lab.editor.circuit.parts.length ? 'none' : ''; }

  /* ===================== sketch editor ===================== */
  const KW = new Set('if else for while do switch case default break continue return const static volatile unsigned signed true false HIGH LOW INPUT OUTPUT INPUT_PULLUP LED_BUILTIN NULL'.split(' '));
  const TY = new Set('void int long short byte char bool boolean float double word String uint8_t uint16_t uint32_t int8_t int16_t int32_t size_t'.split(' '));
  const FN = new Set('pinMode digitalWrite digitalRead analogRead analogWrite delay delayMicroseconds millis micros tone noTone map constrain min max abs sq sqrt pow sin cos tan random randomSeed bitRead bitWrite bitSet bitClear lowByte highByte sizeof setup loop begin print println available read parseInt'.split(' '));
  function esc(s) { return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
  function highlight(src) {
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(^[ \t]*#\w+[^\n]*)|\b(0x[0-9a-fA-F]+|0b[01]+|\d+\.?\d*(?:[eE][-+]?\d+)?)\b|\b([A-Za-z_]\w*)\b/gm;
    let out = '', last = 0, m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index)); last = re.lastIndex;
      const t = m[0];
      if (m[1]) out += '<span class="tk-c">' + esc(t) + '</span>';
      else if (m[2]) out += '<span class="tk-s">' + esc(t) + '</span>';
      else if (m[3]) out += '<span class="tk-m">' + esc(t) + '</span>';
      else if (m[4]) out += '<span class="tk-n">' + t + '</span>';
      else if (KW.has(t)) out += '<span class="tk-k">' + t + '</span>';
      else if (TY.has(t)) out += '<span class="tk-t">' + t + '</span>';
      else if (FN.has(t)) out += '<span class="tk-f">' + t + '</span>';
      else if (/^(Serial|A[0-5])$/.test(t)) out += '<span class="tk-p">' + t + '</span>';
      else out += t;
    }
    return out + esc(src.slice(last)) + '\n';
  }
  function initCode() {
    const ta = $('#codeTa'), hl = $('#codeHl'), gut = $('#gutter');
    const refresh = () => {
      Lab.sketch = ta.value; hl.innerHTML = highlight(ta.value);
      const n = ta.value.split('\n').length;
      gut.innerHTML = Array.from({ length: n }, (_, i) => '<div data-l="' + (i + 1) + '"' + (Lab.errLine === i + 1 ? ' class="errline"' : '') + '>' + (i + 1) + '</div>').join('');
      syncScroll();
    };
    const syncScroll = () => { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; gut.scrollTop = ta.scrollTop; };
    ta.addEventListener('input', () => { Lab.errLine = 0; refresh(); });
    ta.addEventListener('scroll', syncScroll);
    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault(); const s = ta.selectionStart, en = ta.selectionEnd;
        ta.setRangeText('  ', s, en, 'end'); ta.dispatchEvent(new Event('input'));
      } else if (e.key === 'Enter') {
        const s = ta.selectionStart, before = ta.value.slice(0, s), lineStart = before.lastIndexOf('\n') + 1;
        const line = before.slice(lineStart), indent = (/^\s*/.exec(line) || [''])[0] + (/\{\s*$/.test(line) ? '  ' : '');
        e.preventDefault(); ta.setRangeText('\n' + indent, s, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input'));
      }
    });
    Lab.setSketch = (code) => { ta.value = code; Lab.errLine = 0; refresh(); };
    Lab.refreshCode = refresh;
    Lab.setSketch(Lab.sketch);
    $('#btnCompile').addEventListener('click', () => { showTab('console'); Lab.verify(); });
  }
  Lab.verify = function () {
    const r = S21.Arduino.compile(Lab.sketch);
    if (!r.ok) { Lab.errLine = r.error.line; Lab.refreshCode(); log('error', r.error.message, r.error.line); toast('Sketch error on line ' + r.error.line + ': ' + r.error.message, 'error'); return false; }
    Lab.errLine = 0; Lab.refreshCode();
    log('ok', 'Sketch OK — compiled for the virtual Arduino Uno.');
    r.warnings.forEach(w => log('warn', w.msg, w.line));
    return true;
  };

  /* ===================== tabs ===================== */
  function showTab(name) {
    $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
    $$('.pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + name));
    if (name === 'console') { Lab.unseen = 0; $('#consoleBadge').hidden = true; }
    if (name === 'scope') drawScope();
    if (name === 'logic') drawLogic();
    if (name === 'plotter') drawPlot();
  }
  Lab.showTab = showTab;
  /* logic analyzer + serial plotter (see logic.js, plotter.js) */
  Lab.logicView = null;
  function drawLogic() {
    const cv = $('#logicCv'); if (!cv || !cv.offsetParent) return;
    const chans = Lab.rt ? Lab.rt.scope : [];
    Lab.logicView = S21.Logic.draw(cv, { chans, names: chans.map(c => probeLabel(c.ref)), tNow: Lab.rt ? Lab.rt.vt : 0, win: +$('#logicWin').value, cursors: Lab.cursors, bus: $('#logicBus').checked });
    const th = Lab.logicView ? Lab.logicView.th : 0;
    if (chans.length) $('#logicInfo').textContent = 'Threshold ' + fmt(th, 'V') + ' · ' + chans.length + ' signal(s) · click to place cursors A and B' + (Lab.cursors.length === 2 ? ' · Δt = ' + fmt(Math.abs(Lab.cursors[1] - Lab.cursors[0]) / 1000, 's') : '');
  }
  function drawPlot() {
    const cv = $('#plotCv'); if (!cv || !cv.offsetParent) return;
    const data = S21.Plotter.parse(Lab.serialBuf); S21.Plotter.draw(cv, data); $('#plotLegend').innerHTML = S21.Plotter.legend(data);
  }

  /* ===================== inspector ===================== */
  function refName(comp) { return S21.Analysis.refName(Lab.editor.circuit, comp); }
  function renderInspector(sel) {
    const box = $('#inspector');
    const ed = Lab.editor;
    if (!sel) {
      const c = ed.circuit;
      box.innerHTML = '<h3>Inspector</h3><p class="desc">Select a part to edit its values and see live voltage and current while the simulation runs.</p>' +
        '<div class="meter"><div class="meter-row"><span>Parts</span><b>' + c.parts.filter(p => p.type !== 'breadboard').length + '</b></div><div class="meter-row"><span>Wires</span><b>' + c.wires.length + '</b></div></div>' +
        '<div class="note"><b>Quick tips</b><ul><li>Drag from a pin to another pin to make a wire.</li><li><kbd>R</kbd> rotates, <kbd>Del</kbd> deletes, <kbd>F</kbd> fits the view.</li><li>Hover a pin to read its voltage.</li><li>Parts dropped on the breadboard connect through its holes.</li><li>Hold <kbd>Space</kbd> and drag (or right-drag) to pan; scroll to zoom.</li><li><kbd>Shift</kbd>+drag selects several parts; <kbd>Ctrl</kbd>+<kbd>C</kbd>/<kbd>V</kbd> copies and pastes them.</li></ul></div>';
      return;
    }
    if (sel.kind === 'multi') {
      box.innerHTML = '<h3>' + sel.ids.length + ' parts selected</h3><p class="desc">Drag any selected part to move them all together. Wires between selected parts are copied too.</p>' +
        '<div class="row" style="flex-wrap:wrap"><button class="btn" id="insCopy"><svg class="ic"><use href="#i-copy"/></svg>Copy</button><button class="btn" id="insPaste">Paste</button><button class="btn" id="insDelMulti"><svg class="ic"><use href="#i-trash"/></svg>Delete</button></div>' +
        '<div class="note"><b>Selecting</b><ul><li><kbd>Shift</kbd>+drag on empty canvas draws a selection box.</li><li><kbd>Shift</kbd>+click adds or removes a part.</li><li><kbd>Ctrl</kbd>+<kbd>A</kbd> selects all, <kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>V</kbd> copy and paste.</li></ul></div>';
      $('#insCopy').onclick = () => ed.copySelection(); $('#insPaste').onclick = () => ed.paste(); $('#insDelMulti').onclick = () => ed.deleteSelection(); return;
    }
    if (sel.kind === 'wire') {
      box.innerHTML = '<h3>Wire</h3><p class="desc">Drag the white handle to change its route. Press Delete to remove it.</p><button class="btn" id="insDelWire"><svg class="ic"><use href="#i-trash"/></svg>Delete wire</button>';
      $('#insDelWire').onclick = () => ed.deleteSelection(); return;
    }
    const c = ed.getSelPart(); if (!c) { box.innerHTML = ''; return; }
    const d = PARTS[c.type];
    let h = '<h3>' + d.name + ' <span class="soft mono" style="font-size:.8rem">' + refName(c) + '</span> <button class="btn sm ds-btn" id="insDs" title="Datasheet: pinout, limits and settings" aria-label="Datasheet">?</button></h3><p class="desc">' + d.desc + '</p>';
    for (const f of d.props) {
      const v = c.props[f.key], id = 'prop-' + f.key;
      if (f.type === 'eng') h += '<label class="field">' + f.label + '<input id="' + id + '" type="text" value="' + fmt(v, f.unit).replace(/ /g, '') + '" data-key="' + f.key + '"></label>';
      else if (f.type === 'number') h += '<label class="field">' + f.label + '<input id="' + id + '" type="number" min="' + f.min + '" max="' + f.max + '" step="' + (f.step || 1) + '" value="' + v + '" data-key="' + f.key + '"></label>';
      else if (f.type === 'range') h += '<label class="field"><span class="rv"><span>' + f.label + '</span><span id="rv-' + f.key + '">' + v + (f.unit || '') + '</span></span><input id="' + id + '" type="range" min="' + f.min + '" max="' + f.max + '" step="' + (f.step || 1) + '" value="' + v + '" data-key="' + f.key + '"></label>';
      else if (f.type === 'select') h += '<label class="field">' + f.label + '<select id="' + id + '" data-key="' + f.key + '">' + f.options.map(o => '<option value="' + o.v + '"' + (o.v === v ? ' selected' : '') + '>' + o.l + '</option>').join('') + '</select></label>';
      else if (f.type === 'toggle') h += '<label class="field" style="flex-direction:row;align-items:center;gap:.5rem"><input id="' + id + '" type="checkbox" data-key="' + f.key + '"' + (v ? ' checked' : '') + '>' + f.label + '</label>';
    }
    h += '<div class="meter" id="liveBox"></div><div id="liveNote"></div>';
    box.innerHTML = h;
    { const ds = $('#insDs'); if (ds) ds.onclick = () => S21.Datasheet.open(c.type); }
    $$('[data-key]', box).forEach(inp => {
      const key = inp.dataset.key, f = d.props.find(p => p.key === key);
      const apply = (val, rerender, topo) => { c.props[key] = val; ed.pushUndo && 0; ed.updatePartProps(c, rerender); if (topo) Lab.changed('topology'); };
      if (f.type === 'range') inp.addEventListener('input', () => { c.props[key] = +inp.value; $('#rv-' + key).textContent = inp.value + (f.unit || ''); ed.renderLive(c); Lab.changed('props'); });
      else inp.addEventListener('change', () => {
        let val;
        if (f.type === 'eng') { val = P.parseEng(inp.value); if (!(val >= f.min && val <= f.max)) { toast('Please enter a value between ' + fmt(f.min, f.unit) + ' and ' + fmt(f.max, f.unit) + ' (for example 4.7k).', 'warn'); inp.value = fmt(c.props[key], f.unit).replace(/ /g, ''); return; } }
        else if (f.type === 'number') val = Math.max(f.min, Math.min(f.max, +inp.value));
        else if (f.type === 'toggle') val = inp.checked; else val = inp.value;
        ed.pushUndo(); apply(val, true, f.type === 'select');
      });
    });
    updateLive();
  }
  function liveRows(c) {
    const rt = c.rt || {}, rows = [], run = !!Lab.rt;
    if (!run) return null;
    const p = (rt.v || 0) * (rt.i || 0);
    if (P.PARTS[c.type] && P.PARTS[c.type].live) return P.PARTS[c.type].live(c);        // round-3 parts describe their own live rows
    switch (c.type) {
      case 'led': rows.push(['Voltage', fmt(rt.v, 'V')], ['Current', fmt(rt.ia || 0, 'A')], ['Power', fmt(Math.abs(p), 'W')]); break;
      case 'resistor': rows.push(['Voltage', fmt(rt.v, 'V')], ['Current', fmt(rt.i, 'A')], ['Power', fmt(Math.abs(p), 'W')]); break;
      case 'battery': rows.push(['Output current', fmt(rt.i, 'A')], ['Power delivered', fmt(Math.abs((rt.i || 0) * c.props.volts), 'W')]); break;
      case 'capacitor': rows.push(['Voltage', fmt(rt.vc || 0, 'V')], ['Current', fmt(rt.i, 'A')], ['Stored energy', fmt(0.5 * c.props.farads * (rt.vc || 0) ** 2, 'J')]); break;
      case 'pot': rows.push(['Wiper voltage', fmt(rt.vw, 'V')], ['Current', fmt(rt.i, 'A')]); break;
      case 'ldr': rows.push(['Resistance', fmt(rt.r, 'Ω')], ['Voltage', fmt(rt.v, 'V')], ['Current', fmt(rt.i, 'A')]); break;
      case 'npn': { const mode = Math.abs(rt.ic || 0) < 1e-6 ? 'Cutoff (off)' : (rt.vce < 0.3 ? 'Saturation (switch ON)' : 'Active (amplifying)'); rows.push(['Mode', mode], ['Base current', fmt(rt.ib, 'A')], ['Collector current', fmt(rt.ic, 'A')], ['Vbe', fmt(rt.vbe, 'V')], ['Vce', fmt(rt.vce, 'V')]); break; }
      case 'inductor': rows.push(['Voltage', fmt(rt.v, 'V')], ['Current', fmt(rt.i, 'A')], ['Stored energy', fmt(0.5 * c.props.henries * (rt.i || 0) ** 2, 'J')]); break;
      case 'acsource': rows.push(['Output now', fmt(rt.v, 'V')], ['Current', fmt(rt.i, 'A')], ['Period', fmt(1 / c.props.freq, 's')]); break;
      case 'motor': rows.push(['Speed', (rt.rpm || 0) + ' rpm'], ['Voltage', fmt(rt.v, 'V')], ['Current', fmt(rt.i, 'A')], ['Power', fmt(Math.abs(p), 'W')]); break;
      case 'servo': rows.push(['Arm angle', (rt.angle !== undefined ? rt.angle : 90).toFixed(0) + '°'], ['Supply current', fmt(rt.i, 'A')]); break;
      case 'lcd16x2': rows.push(['Status', rt.status === 'OK' ? 'Showing text ✓' : 'Not showing']); break;
      case 'sevenseg': rows.push(['Segments lit', (rt.seg || []).map((v, i) => (v > 0.5 ? 'abcdefg.'[i] : '')).join('') || 'none']); break;
      case 'multimeter': { const md = (S21.Parts.PARTS.multimeter.modes.find(m => m[0] === c.props.mode) || [])[1]; rows.push(['Dial', md], ['Reading', rt.fuse ? 'FUSE BLOWN' : rt.reading === Infinity ? 'OL (open / too large)' : rt.reading === undefined ? '----' : fmt(rt.reading, c.props.mode === 'dca' ? 'A' : c.props.mode === 'ohm' || c.props.mode === 'cont' ? 'Ω' : 'V')]); break; }
      case 'voltmeter': rows.push(['Reading', fmt(rt.v, 'V')]); break;
      case 'ammeter': rows.push(['Reading', fmt(rt.i, 'A')]); break;
      case 'vcc': rows.push(['Current supplied', fmt(rt.i, 'A')]); break;
      case 'tmp36': rows.push(['Temperature', c.props.temp + ' °C'], ['Output', fmt(rt.v, 'V')], ['Powered', rt.powered ? 'yes' : 'NO']); break;
      case 'hcsr04': rows.push(['Distance', c.props.distance + ' cm'], ['Powered', rt.powered ? 'yes' : 'NO'], ['ECHO', rt.echoHigh ? 'HIGH' : 'low']); break;
      case 'ic555': rows.push(['Powered', rt.powered ? 'yes' : 'NO'], ['OUT', rt.q ? 'HIGH' : 'LOW']); break;
      case 'gate': rows.push(['Input A', rt.a ? 'HIGH' : 'low'], ['Input B', rt.b ? 'HIGH' : 'low'], ['Output Y', rt.y ? 'HIGH' : 'low']); break;
      case 'pnp': { const mode = Math.abs(rt.ic || 0) < 1e-6 ? 'Cutoff (off)' : (Math.abs(rt.vce) < 0.3 ? 'Saturation (switch ON)' : 'Active (amplifying)'); rows.push(['Mode', mode], ['Base current (out)', fmt(rt.ib, 'A')], ['Collector current (out)', fmt(rt.ic, 'A')], ['Emitter–collector', fmt(Math.abs(rt.vce), 'V')]); break; }
      case 'mosfet': rows.push(['Channel', rt.on ? 'ON (above threshold)' : 'OFF'], ['Gate voltage (Vgs)', fmt(rt.vgs, 'V')], ['Drain–source', fmt(rt.vds, 'V')], ['Drain current', fmt(rt.id, 'A')]); break;
      case 'zener': { const reg = rt.v < -(c.props.vz - 0.6); rows.push(['Voltage (anode − cathode)', fmt(rt.v, 'V')], ['Current', fmt(rt.i, 'A')], ['State', rt.v > 0.5 ? 'Forward (like a normal diode)' : reg ? 'Regulating at ' + fmt(Math.abs(rt.v), 'V') : 'Blocking']); break; }
      case 'ntc': rows.push(['Temperature', c.props.temp + ' °C'], ['Resistance', fmt(rt.r, 'Ω')], ['Voltage', fmt(rt.v, 'V')], ['Current', fmt(rt.i, 'A')]); break;
      case 'relay': rows.push(['Coil', rt.on ? 'ENERGISED' : 'off'], ['Coil current', fmt(Math.abs(rt.icoil || 0), 'A')], ['COM connects to', rt.on ? 'NO' : 'NC']); break;
      case 'rgbled': { const ia = rt.ia || [0, 0, 0]; rows.push(['Red', fmt(ia[0], 'A')], ['Green', fmt(ia[1], 'A')], ['Blue', fmt(ia[2], 'A')]); break; }
      case 'opamp': rows.push(['State', rt.state === 'lin' ? 'Linear (feedback working)' : rt.state === 'H' ? 'Saturated HIGH' : rt.state === 'L' ? 'Saturated LOW' : 'No power'], ['IN+ − IN−', fmt(rt.vd || 0, 'V')], ['Output', fmt(rt.vo || 0, 'V')], ['Output current', fmt(rt.i, 'A')]); break;
      case 'hc595': { const q = rt.latch || 0; rows.push(['Powered', rt.powered ? 'yes' : 'NO'], ['Outputs QH…QA', q.toString(2).padStart(8, '0')], ['Shift register', (rt.sr || 0).toString(2).padStart(8, '0')], ['/OE', rt.oe ? 'HIGH (outputs off)' : 'low (outputs on)']); if (rt.clear) rows.push(['/SRCLR', 'LOW: register held cleared. Tie it to VCC!']); break; }
      case 'arduino': return null;
      default: rows.push(['Voltage', fmt(rt.v, 'V')], ['Current', fmt(rt.i, 'A')]);
    }
    return rows;
  }
  function updateLive() {
    const c = Lab.editor.getSelPart(); const box = $('#liveBox'); if (!c || !box) return;
    if (c.type === 'arduino') {
      if (!Lab.rt) { box.innerHTML = '<div class="meter-row"><span>Run the simulation to see pin states.</span></div>'; return; }
      let h = '';
      for (let p = 0; p < 20; p++) {
        const st = Lab.rt.pins[p], v = Lab.rt.sim.v[Lab.rt.ard.nodes[p]] || 0, name = p < 14 ? 'D' + p : 'A' + (p - 14);
        const mode = st.mode === 1 ? (st.pwm !== null ? 'PWM ' + st.pwm : st.tone ? 'TONE ' + st.tone : 'OUT ' + (st.out ? 'HIGH' : 'LOW')) : st.mode === 2 ? 'PULLUP' : 'IN';
        if (st.mode !== 0 || Math.abs(v) > 0.05) h += '<div class="meter-row"><span>' + name + ' <small>' + mode + '</small></span><b>' + v.toFixed(2) + ' V</b></div>';
      }
      box.innerHTML = h || '<div class="meter-row"><span>All pins idle (0 V).</span></div>'; return;
    }
    const rows = liveRows(c);
    if (!rows) { box.innerHTML = '<div class="meter-row"><span>Run the simulation to see live values.</span></div>'; $('#liveNote').innerHTML = ''; return; }
    let h = rows.map(r => '<div class="meter-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
    let note = '';
    if (c.type === 'led') {
      const br = Math.min(1, (c.rt.ia || 0) / 0.02); h += '<div class="ledbar"><i style="width:' + (br * 100).toFixed(0) + '%"></i></div>';
      if (c.rt.burnt) note = '<div class="note warn"><b>This LED is burnt out.</b> It had too much current. Add a resistor in series (try 220 Ω–470 Ω), then press Stop and Run again.</div>';
      else if ((c.rt.ia || 0) > 0.022) note = '<div class="note warn">Over 20 mA. Most small LEDs are rated for about 20 mA. A larger series resistor is safer.</div>';
      else if ((c.rt.ia || 0) > 0.0005) note = '<div class="note">Brightness grows with current. Rule of thumb: R = (V<sub>supply</sub> − V<sub>LED</sub>) ÷ I.</div>';
    } else if (c.type === 'resistor' && Math.abs(c.rt.i || 0) > 1e-9) note = '<div class="note">Ohm’s law: V ÷ I = ' + fmt(Math.abs(c.rt.v / c.rt.i), 'Ω') + '</div>';
    else if (c.type === 'capacitor') note = '<div class="note">Time constant τ = R × C. After 5τ a capacitor is ~99% charged.</div>';
    else if (c.type === 'servo' && c.rt.status && c.rt.status !== 'OK') note = '<div class="note warn"><b>Servo not moving.</b> ' + c.rt.status + '</div>';
    else if (c.type === 'servo') note = '<div class="note">The signal is a pulse every 20 ms: 1 ms ≈ 0°, 1.5 ms ≈ 90°, 2 ms ≈ 180°. Shift+click the signal wire’s Arduino pin to see it on the Scope.</div>';
    else if (c.type === 'lcd16x2') note = c.rt.status === 'OK' ? '<div class="note">Showing the output of your LiquidCrystal object. Remember <code>lcd.begin(16, 2)</code> in setup().</div>' : '<div class="note warn"><b>Display is blank.</b> ' + (c.rt.status || 'Press Run.') + '</div>';
    else if (c.type === 'motor') note = '<div class="note">' + ((c.rt.v || 0) !== 0 && Math.abs(c.rt.i || 0) > 0.06 && !Lab.rt.ard ? '' : 'A motor needs far more current than a pin can give: switch it with a transistor. Reverse the leads to reverse the direction.') + '</div>';
    else if (c.type === 'sevenseg' && c.props.resistors === 'none' && c.rt.over) note = '<div class="note warn">A segment carries more than 40 mA: add a resistor (about 220 Ω) in series with every segment.</div>';
    else if (c.type === 'tmp36') note = '<div class="note">Vout = 0.5 V + 0.01 V × T. In code: <code>tempC = (volts − 0.5) × 100</code>. ' + (c.rt.powered ? '' : '<b>Not powered:</b> connect +Vs to 5 V and GND to ground.') + '</div>';
    else if (c.type === 'hcsr04') note = '<div class="note">' + (c.rt.powered ? 'Echo time = distance × 58 µs/cm. Probe TRIG and ECHO on the Scope to see the pulses.' : '<b>Not powered:</b> VCC needs 5 V and GND needs ground, otherwise pulseIn() times out.') + '</div>';
    else if (c.type === 'ic555') note = '<div class="note">Astable: f ≈ 1.44 ÷ ((R1 + 2·R2)·C), duty = (R1+R2) ÷ (R1+2·R2). RESET must be tied HIGH. ' + (c.rt.powered ? '' : '<b>Not powered.</b>') + '</div>';
    else if (c.type === 'gate') note = '<div class="note">Change the gate type above and fill in the truth table. Unconnected inputs read LOW.</div>';
    else if (c.type === 'multimeter') note = '<div class="note"><b>Click the meter</b> to turn its dial. <b>Volts:</b> red probe on the + side, black on the − side, across the part. <b>Amps:</b> in series only. <b>Ω / continuity:</b> power OFF, part on its own.</div>';
    else if (c.type === 'voltmeter') note = '<div class="note">Put a voltmeter <b>across</b> the part (parallel). Red probe on the more positive side gives a positive reading.</div>';
    else if (c.type === 'ammeter') note = '<div class="note">Put an ammeter <b>in series</b>: break the circuit and place it in the gap. Never connect it across a battery.</div>';
    else if (c.type === 'inductor') note = '<div class="note">An inductor resists changes in current. In series with R, the current rises with τ = L ÷ R.</div>';
    else if (c.type === 'acsource') note = '<div class="note">Shift+click the + pin to see this waveform on the Scope. Try a 10–50 ms window.</div>';
    $('#liveBox').innerHTML = h; $('#liveNote').innerHTML = note;
  }

  /* ===================== hover readout / probes ===================== */
  function onHover(t) {
    const hi = $('#hoverInfo');
    Lab.hoverRef = t;
    if (!t) { hi.hidden = true; return; }
    hi.hidden = false; updateHover();
  }
  function updateHover() {
    const t = Lab.hoverRef, hi = $('#hoverInfo'); if (!t || hi.hidden) return;
    const v = Lab.rt ? Lab.rt.nodeVoltage(t) : null;
    hi.innerHTML = t.label + (v !== null ? ' &nbsp; <b>' + fmt(v, 'V') + '</b>' : ' &nbsp; <span class="soft">(run to measure)</span>') + '<br><span class="soft small">Shift+click to show on the scope</span>';
  }
  function addProbe(ref) {
    Lab.probes.push(ref); if (Lab.probes.length > 8) Lab.probes.shift();
    if (Lab.rt) { Lab.rt.clearProbes(); Lab.probes.forEach(p => Lab.rt.addProbe(p)); }
    showTab('scope'); toast('Probe added. Start the simulation to watch the voltage over time.');
  }
  const PROBE_COLORS = ['#2fe27a', '#ffd92e', '#ff6b7a', '#7cc7ff', '#c79bff', '#ff9f43', '#4de3d1', '#e8e8e8'];
  function probeLabel(ref) {
    const c = Lab.editor.circuit.parts.find(p => p.id === ref.p); if (!c) return '?';
    return refName(c) + '.' + ref.t;
  }
  function scopeStats(ch, t0, t1) {
    let mx = -1e9, mn = 1e9, sum = 0, n = 0, first = -1;
    for (let i = ch.t.length - 1; i >= 0 && ch.t[i] >= t0; i--) { if (ch.t[i] > t1) continue; const v = ch.v[i]; if (v > mx) mx = v; if (v < mn) mn = v; sum += v; n++; first = i; }
    if (!n) return null;
    const mid = (mx + mn) / 2, hyst = Math.max(0.05, (mx - mn) * 0.1); let state = null, crossings = [];
    for (let i = Math.max(0, first); i < ch.t.length && ch.t[i] <= t1; i++) {
      const v = ch.v[i]; if (state === null) { state = v > mid; continue; }
      if (!state && v > mid + hyst) { state = true; crossings.push(ch.t[i]); } else if (state && v < mid - hyst) state = false;
    }
    let f = null; if (mx - mn > 0.1 && crossings.length >= 2) f = (crossings.length - 1) / ((crossings[crossings.length - 1] - crossings[0]) / 1000);
    return { max: mx, min: mn, vpp: mx - mn, avg: sum / n, f, crossings };
  }
  function valueAt(ch, t) { for (let i = ch.t.length - 1; i >= 0; i--) if (ch.t[i] <= t) return ch.v[i]; return 0; }
  Lab.cursors = [];
  function drawScope() {
    const cv = $('#scopeCv'); if (!cv.offsetParent) return;
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const padL = 44, padB = 20, pw = w - padL - 10, ph = h - padB - 10;
    const chans = Lab.rt ? Lab.rt.scope : [];
    const win = +$('#scopeWin').value, tNow = Lab.rt ? Lab.rt.vt : 0;
    let tStart = tNow - win, triggered = false;
    if ($('#scopeTrig').value === 'rise' && chans.length) {
      const st = scopeStats(chans[0], tNow - win * 3, tNow);
      if (st) { const cr = st.crossings.filter(t => t <= tNow - win * 0.9); if (cr.length) { tStart = cr[cr.length - 1] - win * 0.1; triggered = true; } }
    }
    const tEnd = tStart + win; Lab.scopeView = { tStart, win, padL, pw };
    let vmin = 0, vmax = 5;
    for (const ch of chans) for (let i = ch.t.length - 1; i >= 0 && ch.t[i] >= tStart; i--) { if (ch.t[i] > tEnd) continue; vmax = Math.max(vmax, ch.v[i]); vmin = Math.min(vmin, ch.v[i]); }
    vmax = Math.ceil(vmax); if (vmin < 0) vmin = Math.floor(vmin);
    const X = t => padL + (t - tStart) / win * pw, Y = v => 6 + ph - (v - vmin) / (vmax - vmin) * ph;
    g.strokeStyle = '#25312b'; g.fillStyle = '#7d8f86'; g.font = '11px ui-monospace, monospace'; g.lineWidth = 1;
    for (let i = 0; i <= 5; i++) { const v = vmin + (vmax - vmin) * i / 5, y = Y(v); g.beginPath(); g.moveTo(padL, y); g.lineTo(padL + pw, y); g.stroke(); g.fillText(v.toFixed(1) + 'V', 4, y + 4); }
    for (let i = 0; i <= 10; i++) { const x = padL + pw * i / 10; g.beginPath(); g.moveTo(x, 6); g.lineTo(x, 6 + ph); g.stroke(); const tt = (tStart + win * i / 10); g.fillText(win >= 1000 ? (tt / 1000).toFixed(2) + 's' : tt.toFixed(0) + 'ms', x - 14, h - 4); }
    if (triggered) { g.fillStyle = '#f5b942'; g.fillText('TRIG ▲', w - 62, 16); g.strokeStyle = '#f5b94266'; g.beginPath(); g.moveTo(X(tStart + win * 0.1), 6); g.lineTo(X(tStart + win * 0.1), 6 + ph); g.stroke(); }
    let legend = '';
    chans.forEach((ch, k) => {
      g.strokeStyle = PROBE_COLORS[k % PROBE_COLORS.length]; g.lineWidth = 2; g.beginPath(); let first = true;
      const step = Math.max(1, Math.floor(ch.t.length / 3000));
      for (let i = 0; i < ch.t.length; i += step) { if (ch.t[i] < tStart || ch.t[i] > tEnd) continue; const x = X(ch.t[i]), y = Y(ch.v[i]); if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y); }
      g.stroke();
      const st = scopeStats(ch, tStart, tEnd);
      legend += '<span><i style="background:' + PROBE_COLORS[k % PROBE_COLORS.length] + '"></i>' + probeLabel(ch.ref) + ' = ' + fmt(Lab.rt.sim.v[ch.node] || 0, 'V') + (st ? ' <small>Vpp ' + fmt(st.vpp, 'V') + ' · avg ' + fmt(st.avg, 'V') + (st.f ? ' · ' + fmt(st.f, 'Hz') : '') + '</small>' : '') + '</span>';
    });
    // cursors
    let curInfo = '';
    Lab.cursors.forEach((t, i) => {
      if (t < tStart || t > tEnd) return; const x = X(t);
      g.strokeStyle = i ? '#ff6b7a' : '#7cc7ff'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(x, 6); g.lineTo(x, 6 + ph); g.stroke(); g.setLineDash([]);
      g.fillStyle = i ? '#ff6b7a' : '#7cc7ff'; g.fillText('AB'[i], x + 3, 16);
    });
    if (Lab.cursors.length) {
      curInfo = Lab.cursors.map((t, i) => 'AB'[i] + ': ' + (t / 1000).toFixed(4) + ' s' + chans.map((ch, k) => ' ' + fmt(valueAt(ch, t), 'V')).join('')).join('  |  ');
      if (Lab.cursors.length === 2) { const dt = Math.abs(Lab.cursors[1] - Lab.cursors[0]); curInfo += '  |  Δt = ' + fmt(dt / 1000, 's') + (dt > 0 ? ' (1/Δt = ' + fmt(1000 / dt, 'Hz') + ')' : ''); }
    } else curInfo = 'Click the scope to place cursors A and B (pause first for a still picture).';
    if (!chans.length) { g.fillStyle = '#7d8f86'; g.fillText(Lab.probes.length ? 'Press Run to start recording.' : 'Shift+click any pin on the canvas to add a probe (up to 8).', padL + 12, 28); }
    $('#scopeLegend').innerHTML = legend; $('#scopeCursorInfo').textContent = curInfo;
  }

  /* ===================== run loop ===================== */
  function setState(s) {
    const dot = $('#runDot'); dot.className = 'dot' + (s === 'run' ? ' run' : s === 'pause' ? ' pause' : '');
    $('#simState').textContent = s === 'run' ? 'Running' : s === 'pause' ? 'Paused' : 'Stopped';
    $('#btnRun').disabled = s === 'run'; $('#btnPause').disabled = s !== 'run'; $('#btnStop').disabled = s === 'stop';
    $('#btnRun').querySelector('span').textContent = s === 'pause' ? 'Resume' : 'Run';
  }
  function hasArduino() { return Lab.editor.circuit.parts.some(p => p.type === 'arduino'); }
  Lab.eeprom = new Uint8Array(1024).fill(255);
  Lab.start = function () {
    if (Lab.running) return;
    if (Lab.paused && Lab.rt) { Lab.running = true; Lab.paused = false; setState('run'); Lab.lastTs = performance.now(); requestAnimationFrame(frame); return; }
    if (!Lab.editor.circuit.parts.length) { toast('The canvas is empty. Load an example or add some parts first.', 'warn'); return; }
    Lab.serialBuf = ''; $('#serialOut').textContent = ''; Lab.errLine = 0; Lab.refreshCode();
    Lab.rt = new S21.Runtime(Lab.editor.circuit, {
      onSerial: s => { Lab.serialBuf += s; if (Lab.serialBuf.length > 30000) Lab.serialBuf = Lab.serialBuf.slice(-20000); Lab.serialDirty = true; },
      onConsole: (lvl, msg, line) => { log(lvl, msg, line); if (lvl === 'error') { Lab.errLine = line || 0; Lab.refreshCode(); toast(msg, 'error'); } },
      eeprom: Lab.eeprom
    });
    Lab.probes.forEach(p => Lab.rt.addProbe(p));
    if (hasArduino()) {
      const r = Lab.rt.loadSketch(Lab.sketch);
      if (!r.ok) { Lab.errLine = r.error.line; Lab.refreshCode(); log('error', r.error.message, r.error.line); showTab('console'); toast('Fix the sketch first — line ' + r.error.line + ': ' + r.error.message, 'error'); Lab.rt = null; return; }
      r.warnings.forEach(w => log('warn', w.msg, w.line));
      log('ok', 'Sketch uploaded to the virtual Arduino Uno. Running…');
    }
    Lab.running = true; Lab.paused = false; setState('run'); ensureAudio(); Lab.lastTs = performance.now(); requestAnimationFrame(frame);
    if (S21.Tools) S21.Tools.onStart();
    if (S21.Tools && S21.Tools.runCheck) S21.Tools.runCheck();
  };
  Lab.pause = function () { if (!Lab.running) return; Lab.running = false; Lab.paused = true; setState('pause'); silence(); };
  Lab.stop = function () {
    Lab.running = false; Lab.paused = false; silence(); Lab.cursors = [];
    if (Lab.rt) { Lab.rt.reset(); Lab.rt = null; }
    Lab.editor.circuit.parts.forEach(c => { c.rt = {}; }); Lab.editor.refreshLive();
    setState('stop'); $('#simTime').textContent = 't = 0.000 s'; updateLive(); drawScope(); updateHover();
  };
  Lab.changed = function (kind) {
    hideHint();
    if (kind === 'topology' || kind === 'props' || kind === 'live') {
      if (Lab.rt) {
        if (kind === 'topology') { Lab.rt.rebuild(); }
        else for (const c of Lab.editor.circuit.parts) { const d = PARTS[c.type]; if (d.sync) d.sync(c, Lab.rt.nl.compEls.get(c.id)); }
      }
    }
    if (kind === 'topology') renderInspectorSoon();
    if (S21.Tools && S21.Tools.onChanged) S21.Tools.onChanged(kind);
    if (S21.Guide && S21.Guide.onChanged) S21.Guide.onChanged(kind);
  };
  let inspTimer = 0;
  function renderInspectorSoon() { clearTimeout(inspTimer); inspTimer = setTimeout(() => renderInspector(Lab.editor.sel), 0); }

  function frame(ts) {
    if (!Lab.running) return;
    const dt = Math.min(50, ts - Lab.lastTs); Lab.lastTs = ts;
    try { Lab.rt.advance(dt * Lab.speed); } catch (e) { console.error(e); Lab.stop(); toast('Simulation error: ' + e.message, 'error'); return; }
    Lab.editor.refreshLive();
    if (S21.Tools) S21.Tools.tick(ts);
    updateSound();
    if (ts - Lab.lastUi > 90) {
      Lab.lastUi = ts;
      $('#simTime').textContent = 't = ' + (Lab.rt.vt / 1000).toFixed(3) + ' s';
      updateLive(); updateHover();
      if (Lab.serialDirty) { const o = $('#serialOut'), near = o.scrollTop + o.clientHeight > o.scrollHeight - 30; o.textContent = Lab.serialBuf; if (near) o.scrollTop = o.scrollHeight; Lab.serialDirty = false; }
      if ($('#pane-scope').classList.contains('on')) drawScope();
      if ($('#pane-logic').classList.contains('on')) drawLogic();
      if ($('#pane-plotter').classList.contains('on')) drawPlot();
      for (const a of Lab.rt.takeAlerts()) { if (a.level !== 'info') toast(a.msg, a.level === 'error' ? 'error' : 'warn', 8000); log(a.level === 'info' ? 'info' : a.level, a.msg); }
    }
    requestAnimationFrame(frame);
  }

  /* ===================== sound ===================== */
  function ensureAudio() {
    if (!Lab.sound || Lab.audio) return;
    try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = 'square'; gain.gain.value = 0; osc.connect(gain).connect(ctx.destination); osc.start(); Lab.audio = { ctx, osc, gain }; } catch (e) { /* no audio */ }
  }
  function updateSound() {
    if (!Lab.audio) return; const f = Lab.sound && Lab.rt ? Lab.rt.buzzFreq || 0 : 0;
    if (f > 0) { Lab.audio.osc.frequency.setTargetAtTime(f, Lab.audio.ctx.currentTime, 0.005); Lab.audio.gain.gain.setTargetAtTime(0.04, Lab.audio.ctx.currentTime, 0.01); } else Lab.audio.gain.gain.setTargetAtTime(0, Lab.audio.ctx.currentTime, 0.01);
  }
  function silence() { if (Lab.audio) Lab.audio.gain.gain.setTargetAtTime(0, Lab.audio.ctx.currentTime, 0.01); }
  function setSound(on) {
    Lab.sound = on; $('#btnSound').innerHTML = '<svg class="ic"><use href="#' + (on ? 'i-sound' : 'i-mute') + '"/></svg>'; $('#btnSound').classList.toggle('active', on);
    const cb = $('#setSound'); if (cb) cb.checked = on; if (on) ensureAudio(); else silence();
  }
  Lab.setSound = setSound;

  /* ===================== projects / examples ===================== */
  Lab.eepromSparse = () => { const o = []; Lab.eeprom.forEach((v, i) => { if (v !== 255) o.push([i, v]); }); return o; };
  Lab.serializeProject = () => JSON.stringify({ app: 'smart21-electrolab', version: 2, circuit: P.serialize(Lab.editor.circuit), sketch: Lab.sketch, probes: Lab.probes, eeprom: Lab.eepromSparse() }, null, 1);
  Lab.loadProject = function (json) {
    let data; try { data = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { toast('That file is not a valid project.', 'error'); return false; }
    if (!data || data.app !== 'smart21-electrolab') { toast('That file is not a Smart21 ElectroLab project.', 'error'); return false; }
    Lab.stop(); Lab.editor.pushUndo();
    Lab.editor.setCircuit(P.deserialize(data.circuit)); Lab.probes = data.probes || []; Lab.setSketch(data.sketch || DEFAULT_SKETCH);
    Lab.eeprom.fill(255); (data.eeprom || []).forEach(([a, v]) => { if (a >= 0 && a < 1024) Lab.eeprom[a] = v & 255; });
    Lab.editor.fit(); hideHint(); renderInspector(null); drawScope(); return true;
  };
  Lab.newProject = function () { Lab.eeprom.fill(255); Lab.stop(); Lab.editor.pushUndo(); Lab.editor.setCircuit(P.newCircuit()); Lab.probes = []; Lab.setSketch(DEFAULT_SKETCH); hideHint(); renderInspector(null); drawScope(); };
  Lab.loadExample = function (id) {
    const ex = S21.Examples.load(id); if (!ex) return;
    const meta = S21.Examples.list.find(e => e.id === id);
    $('#toasts').innerHTML = ''; Lab.eeprom.fill(255); Lab.stop(); Lab.editor.pushUndo(); Lab.editor.setCircuit(ex.circuit); Lab.probes = ex.probes;
    $('#scopeWin').value = ex.scope;
    if (ex.sketch) { Lab.setSketch(ex.sketch); showTab('code'); }
    Lab.editor.fit(); hideHint(); renderInspector(null); drawScope();
    toast(meta.title + ' — ' + meta.blurb + (ex.sketch ? ' Press Run.' : ' Press Run, then select parts to see live values.'), '', 8000);
    if (ex.probes.length) showTab('scope');
    if (S21.Lessons && S21.Lessons.markVisited) S21.Lessons.markVisited(id);
    if (S21.Tools) S21.Tools.onExample(id);
  };
  Lab.loadStarter = function (st) {
    $('#toasts').innerHTML = ''; Lab.eeprom.fill(255); Lab.stop(); Lab.editor.pushUndo(); Lab.editor.setCircuit(st.circuit); Lab.probes = st.probes || [];
    if (st.sketch !== null && st.sketch !== undefined) { Lab.setSketch(st.sketch); showTab('code'); }
    $('#scopeWin').value = st.scope || '200';
    Lab.editor.fit(); hideHint(); renderInspector(null); drawScope();
  };
  Lab.exportSketch = async function () {
    const code = Lab.sketch;
    if (window.s21 && window.s21.exportSketch) { const r = await window.s21.exportSketch(code); if (r && r.ok) toast('Saved ' + r.name + ' — open it in the Arduino IDE.', ''); }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' })); a.download = 'sketch.ino'; a.click(); }
  };
  Lab.importSketch = async function () {
    const apply = text => { if (typeof text === 'string') { Lab.setSketch(text); showTab('code'); toast('Sketch imported. Libraries (Servo, LiquidCrystal…) are not supported yet.', ''); } };
    if (window.s21 && window.s21.importSketch) { const r = await window.s21.importSketch(); if (r && r.ok) apply(r.data); else if (r && r.error) toast(r.error, 'error'); }
    else { const i = document.createElement('input'); i.type = 'file'; i.accept = '.ino,.txt,.cpp'; i.onchange = () => { const f = i.files[0]; if (f) f.text().then(apply); }; i.click(); }
  };
  async function saveProject() {
    const json = Lab.serializeProject();
    if (window.s21 && window.s21.saveProject) { const r = await window.s21.saveProject(json); if (r && r.ok) { toast('Saved ' + r.name, ''); S21.Library.addRecent(r.name, json); } }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = 'circuit.s21lab'; a.click(); S21.Library.addRecent('circuit', json); }
  }
  async function openProject() {
    if (window.s21 && window.s21.openProject) { const r = await window.s21.openProject(); if (r && r.ok) { Lab.loadProject(r.data); S21.Library.addRecent(r.name || 'Opened circuit', r.data); } }
    else { const i = document.createElement('input'); i.type = 'file'; i.accept = '.s21lab,.json'; i.onchange = () => { const f = i.files[0]; if (f) f.text().then(t => { Lab.loadProject(t); S21.Library.addRecent(f.name, t); }); }; i.click(); }
  }
  Lab.saveProject = saveProject; Lab.openProject = openProject;
  Lab.saveAsTemplate = function () {
    if (!Lab.editor.circuit.parts.length) { toast('Build a circuit first, then save it as a template.', 'warn'); return; }
    S21.Tools.modal({
      title: 'Save as template',
      body: '<p>Your circuit (with its Arduino code) will appear in <b>My templates</b> when you choose <b>New circuit</b>.</p><label>Template name<input id="tplName" type="text" maxlength="60" placeholder="e.g. Night light"></label><label style="margin-top:.6rem">Short description (optional)<input id="tplDesc" type="text" maxlength="300" placeholder="What does it do?"></label>',
      actions: [{ label: 'Save template', primary: true, onClick: api => {
        const name = api.body.querySelector('#tplName').value.trim(); if (!name) { api.body.querySelector('#tplName').focus(); return; }
        const r = S21.Library.addTemplate(name, api.body.querySelector('#tplDesc').value, Lab.serializeProject());
        if (r.ok) { api.close(); toast('Template “' + name + '” saved. Find it under New circuit ▸ My templates.', ''); } else toast(r.error, 'warn');
      } }]
    });
  };

  /* ===================== context for the AI tutor ===================== */
  Lab.describeCircuit = function () {
    const ed = Lab.editor, c = ed.circuit;
    if (!c.parts.length) return 'The canvas is empty.';
    const nl = P.buildNetlist(c), nets = new Map(), lines = [];
    for (const p of c.parts) {
      if (p.type === 'breadboard') continue;
      const pr = Object.entries(p.props).map(([k, v]) => k + '=' + v).join(', ');
      lines.push(refName(p) + ' = ' + PARTS[p.type].name + (pr ? ' (' + pr + ')' : ''));
      if (PARTS[p.type].noPins) continue;
      for (const t of PARTS[p.type].terms) { const n = nl.nodeOf(p.id, t.n); if (!nets.has(n)) nets.set(n, []); nets.get(n).push(refName(p) + '.' + t.n); }
    }
    const netLines = [];
    for (const [n, list] of nets) { const l = list.filter(x => !/^UNO\.(D|A)\d+$/.test(x) || list.length > 1); if (list.length > 1 || /^UNO\./.test(list[0])) netLines.push((n === 0 ? 'GROUND' : 'Net' + n) + ': ' + list.join(', ')); }
    let out = 'Parts:\n' + lines.join('\n') + '\n\nConnections (pins on the same net are joined):\n' + netLines.slice(0, 60).join('\n');
    if (nl.autoGround) out += '\n(No ground symbol: battery − is treated as 0 V.)';
    if (Lab.rt) {
      const live = c.parts.filter(p => ['led', 'resistor', 'npn', 'capacitor'].includes(p.type)).map(p => refName(p) + ': V=' + fmt(p.rt.v || 0, 'V') + ', I=' + fmt(p.type === 'led' ? p.rt.ia || 0 : p.rt.i || 0, 'A') + (p.rt.burnt ? ' (BURNT OUT)' : ''));
      out += '\n\nLive simulation values (t=' + (Lab.rt.vt / 1000).toFixed(2) + ' s):\n' + live.join('\n');
    } else out += '\n\n(The simulation is not running.)';
    if (hasArduino()) out += '\n\nArduino sketch:\n```cpp\n' + Lab.sketch + '\n```';
    return out;
  };

  /* ===================== init ===================== */
  Lab.init = function () {
    const svg = $('#canvas');
    Lab.editor = new S21.Editor(svg, { changed: k => Lab.changed(k), selected: s => { renderInspector(s); }, toast, onHover, onProbe: addProbe });
    buildPalette(); initCode(); renderInspector(null);
    $('#palSearch').addEventListener('input', e => buildPalette(e.target.value));
    $$('.tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
    $('#btnRun').onclick = Lab.start; $('#btnPause').onclick = Lab.pause; $('#btnStop').onclick = Lab.stop;
    $('#speed').onchange = e => { Lab.speed = +e.target.value; };
    $('#btnSound').onclick = () => setSound(!Lab.sound);
    $('#btnUndo').onclick = () => Lab.editor.undo(); $('#btnRedo').onclick = () => Lab.editor.redo();
    $('#btnRotate').onclick = () => Lab.editor.rotateSelection(); $('#btnDup').onclick = () => Lab.editor.duplicateSelection();
    $('#btnDel').onclick = () => Lab.editor.deleteSelection(); $('#btnFit').onclick = () => Lab.editor.fit();
    $('#btnExport').onclick = Lab.exportSketch; $('#btnImport').onclick = Lab.importSketch;
    Lab.setSchematic = function (on) {
      P.schematic = !!on; try { localStorage.setItem('s21lab-schem', on ? '1' : '0'); } catch (_) {}
      $('#btnSchem').classList.toggle('on', !!on); $('#canvas').classList.toggle('schem', !!on);
      Lab.editor.render(); Lab.editor.refreshLive && Lab.editor.refreshLive();
    };
    $('#btnSchem').onclick = () => Lab.setSchematic(!P.schematic);
    $('#btnTrouble').onclick = () => S21.Trouble.openList();
    if (window.s21 && window.s21.onOpenProject) {                       // a .s21lab file was double-clicked
      const openIt = r => { if (!r || !r.data) return; S21.App.show('lab'); Lab.loadProject(r.data); S21.Library.addRecent(r.name, r.data); };
      window.s21.onOpenProject(openIt); window.s21.takePendingOpen().then(openIt);
    }
    try { if (localStorage.getItem('s21lab-schem') === '1') Lab.setSchematic(true); } catch (_) {}
    $('#btnNew').onclick = () => S21.Onboarding.newCircuit(); $('#btnTpl').onclick = () => Lab.saveAsTemplate(); $('#btnOpen').onclick = openProject; $('#btnSave').onclick = saveProject;
    const sel = $('#exSelect');
    S21.Examples.list.forEach(e => { const o = document.createElement('option'); o.value = e.id; o.textContent = e.title; sel.appendChild(o); });
    sel.onchange = () => { if (sel.value) Lab.loadExample(sel.value); sel.value = ''; };
    $('#scopeWin').onchange = drawScope; $('#scopeTrig').onchange = drawScope;
    $('#scopeCv').addEventListener('click', e => {
      const v = Lab.scopeView; if (!v) return; const r = e.target.getBoundingClientRect(), x = e.clientX - r.left;
      if (x < v.padL || x > v.padL + v.pw) return; const t = v.tStart + (x - v.padL) / v.pw * v.win;
      if (Lab.cursors.length >= 2) Lab.cursors = []; Lab.cursors.push(t); drawScope();
    }); $('#scopeClear').onclick = () => { Lab.probes = []; Lab.cursors = []; if (Lab.rt) Lab.rt.clearProbes(); drawScope(); };
    $('#serialClear').onclick = () => { Lab.serialBuf = ''; $('#serialOut').textContent = ''; };
    const send = () => { const i = $('#serialIn'); if (Lab.rt && i.value !== '') { Lab.rt.sendSerial(i.value + '\n'); Lab.serialBuf += '» ' + i.value + '\n'; Lab.serialDirty = true; i.value = ''; } else if (!Lab.rt) toast('Run the simulation first.', 'warn'); };
    $('#serialSend').onclick = send; $('#serialIn').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    $('#serialBaud').textContent = '9600 baud';
    window.addEventListener('resize', () => drawScope());
    new ResizeObserver(() => { drawScope(); drawLogic(); drawPlot(); }).observe($('#pane-scope'));
    $('#logicWin').onchange = drawLogic; $('#logicBus').onchange = drawLogic;
    $('#logicClear').onclick = () => { Lab.probes = []; Lab.cursors = []; if (Lab.rt) Lab.rt.clearProbes(); drawLogic(); drawScope(); };
    $('#logicCv').addEventListener('click', e => { const v = Lab.logicView; if (!v) return; const r = e.target.getBoundingClientRect(), x = e.clientX - r.left; if (x < v.padL || x > v.padL + v.pw) return; const t = v.tStart + (x - v.padL) / v.pw * v.win; Lab.cursors = Lab.cursors.length >= 2 ? [t] : Lab.cursors.concat([t]); drawLogic(); drawScope(); });
    $('#logicVcd').onclick = () => {
      const chans = Lab.rt ? Lab.rt.scope : []; if (!chans.length || !chans[0].t.length) { toast('Add signals with Shift+click and press Run first.', 'warn'); return; }
      const th = S21.Logic.threshold(chans, 0, Lab.rt.vt), a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([S21.Logic.toVCD(chans, chans.map(c => probeLabel(c.ref)), th)], { type: 'text/plain' })); a.download = 'signals.vcd'; a.click();
    };
    $('#plotClear').onclick = () => { Lab.serialBuf = ''; $('#serialOut').textContent = ''; drawPlot(); };
    document.addEventListener('keydown', e => {
      if (!$('#view-lab').classList.contains('on')) return;
      if (e.key === 'F5') { e.preventDefault(); Lab.running ? Lab.pause() : Lab.start(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !window.s21) { e.preventDefault(); S21.Onboarding.newCircuit(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveProject(); return; }
      if (Lab.editor.onKey(e)) e.preventDefault();
    });
    document.addEventListener('keyup', e => { if ($('#view-lab').classList.contains('on')) Lab.editor.onKey(e); });
    // start with the Blink example so the app is alive on first launch
    Lab.loadExample('blink');
    setState('stop');
  };
})();
