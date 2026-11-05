/* ---------------------------------------------------------------
   Smart21 ElectroLab — parts library + netlist builder
   Each part describes: terminals, how it looks (SVG), how it behaves
   in the solver (elements/sync/read) and which properties the
   inspector can edit.
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const GRID = 20;
  const NS = 'http://www.w3.org/2000/svg';

  /* ---------- helpers ---------- */
  function rotPt(x, y, rot) {
    switch (((rot % 360) + 360) % 360) {
      case 90: return [-y, x];
      case 180: return [-x, -y];
      case 270: return [y, -x];
      default: return [x, y];
    }
  }
  const PREFIX = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9 };
  function parseEng(str) {
    const m = /^\s*([0-9]*\.?[0-9]+(?:e[-+]?\d+)?)\s*([pnuµmkKMG]?)\s*(?:Ω|ohms?|F|V|A|H|Hz)?\s*$/i.exec(String(str).replace(',', '.'));
    if (!m) return NaN;
    let mult = PREFIX[m[2]] || 1;
    if (m[2] === 'M' && /m/.test(str) && !/M/.test(str)) mult = 1e-3;
    return parseFloat(m[1]) * mult;
  }
  function fmt(v, unit) {
    unit = unit || '';
    if (!isFinite(v)) return '—';
    const a = Math.abs(v);
    let p = '', d = 1;
    if (a === 0) return '0 ' + unit;
    if (a >= 1e9) { p = 'G'; d = 1e9; } else if (a >= 1e6) { p = 'M'; d = 1e6; } else if (a >= 1e3) { p = 'k'; d = 1e3; }
    else if (a >= 1) { d = 1; } else if (a >= 1e-3) { p = 'm'; d = 1e-3; } else if (a >= 1e-6) { p = 'µ'; d = 1e-6; }
    else if (a >= 1e-9) { p = 'n'; d = 1e-9; } else { p = 'p'; d = 1e-12; }
    const x = v / d;
    const s = Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2);
    return (s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s) + ' ' + p + unit;
  }
  const BAND = ['#161616', '#7b4a1d', '#d62d20', '#f28c28', '#f2d62c', '#2e9e4a', '#2f6fd6', '#8a4bd6', '#8a8a8a', '#f0f0f0'];
  function resistorBands(ohms) {
    let v = Math.max(ohms, 0.1);
    let exp = Math.floor(Math.log10(v)) - 1;
    let d = Math.round(v / Math.pow(10, exp));
    if (d >= 100) { d = Math.round(d / 10); exp++; }
    const mult = exp >= 0 ? BAND[Math.min(exp, 9)] : (exp === -1 ? '#d4af37' : '#c0c0c0');
    return [BAND[Math.floor(d / 10) % 10], BAND[d % 10], mult, '#d4af37'];
  }
  const LED_COLORS = {
    red: { vf: 1.9, rgb: '#ff3b3b' }, orange: { vf: 2.0, rgb: '#ff9a2e' }, yellow: { vf: 2.05, rgb: '#ffd92e' },
    green: { vf: 2.2, rgb: '#2fe27a' }, blue: { vf: 3.0, rgb: '#3b82ff' }, white: { vf: 3.1, rgb: '#f4f7ff' }
  };
  function diodeIs(vf, n) { const nvt = n * 0.025852; return 0.01 / (Math.exp(vf / nvt) - 1); }

  // counter-rotated text so labels stay upright
  function lbl(c, text, x, y, cls) {
    return '<g transform="rotate(' + (-c.rot) + ')"><text class="' + (cls || 'plabel') + '" x="' + x + '" y="' + y + '" text-anchor="middle">' + esc(text) + '</text></g>';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }

  const PARTS = {};
  const ORDER = [];
  function def(id, d) { d.id = id; d.props = d.props || []; d.defaults = d.defaults || {}; PARTS[id] = d; ORDER.push(id); }

  /* ======================= POWER ======================= */
  def('battery', {
    name: 'Battery', cat: 'Power', desc: 'DC voltage source. The long terminal is positive (+).',
    terms: [{ n: '+', x: 0, y: -40 }, { n: '-', x: 0, y: 40 }],
    defaults: { volts: 9 },
    props: [{ key: 'volts', label: 'Voltage', type: 'eng', unit: 'V', min: 0.1, max: 48 }],
    label: c => fmt(c.props.volts, 'V'),
    svg: c => '<line class="lead" x1="0" y1="-40" x2="0" y2="-24"/><line class="lead" x1="0" y1="24" x2="0" y2="40"/>' +
      '<rect class="bat-body" x="-18" y="-24" width="36" height="48" rx="5"/><rect class="bat-cap" x="-18" y="-24" width="36" height="12" rx="5"/>' +
      '<text class="bat-sign" x="0" y="-14" text-anchor="middle">+</text><text class="bat-sign" x="0" y="20" text-anchor="middle">−</text>' +
      lbl(c, fmt(c.props.volts, 'V'), 0, 4, 'bat-val'),
    elements: (c, N) => [{ type: 'V', a: N('+'), b: N('-'), v: c.props.volts, rs: 0.1 }],
    sync: (c, els) => { els[0].v = c.props.volts; },
    read: (c, els) => { c.rt.i = els[0].i; c.rt.v = els[0].vd; }
  });

  def('ground', {
    name: 'Ground', cat: 'Power', desc: '0 V reference. All voltages are measured relative to ground.',
    terms: [{ n: 'g', x: 0, y: 0 }], ground: ['g'], defaults: {},
    svg: c => '<line class="lead" x1="0" y1="0" x2="0" y2="10"/><line class="lead thick" x1="-12" y1="10" x2="12" y2="10"/><line class="lead thick" x1="-8" y1="15" x2="8" y2="15"/><line class="lead thick" x1="-4" y1="20" x2="4" y2="20"/>',
    elements: () => []
  });

  /* ======================= PASSIVE ======================= */
  def('resistor', {
    name: 'Resistor', cat: 'Passive', desc: 'Limits current. V = I × R. Colour bands show the value.',
    terms: [{ n: 'a', x: -40, y: 0 }, { n: 'b', x: 40, y: 0 }],
    defaults: { ohms: 220 },
    props: [{ key: 'ohms', label: 'Resistance', type: 'eng', unit: 'Ω', min: 0.1, max: 1e8 }],
    label: c => fmt(c.props.ohms, 'Ω'),
    svg: c => {
      const b = resistorBands(c.props.ohms);
      return '<line class="lead" x1="-40" y1="0" x2="-22" y2="0"/><line class="lead" x1="22" y1="0" x2="40" y2="0"/>' +
        '<rect class="rbody" x="-22" y="-8" width="44" height="16" rx="7"/>' +
        '<rect x="-15" y="-8" width="4" height="16" fill="' + b[0] + '"/><rect x="-8" y="-8" width="4" height="16" fill="' + b[1] + '"/>' +
        '<rect x="-1" y="-8" width="4" height="16" fill="' + b[2] + '"/><rect x="11" y="-8" width="4" height="16" fill="' + b[3] + '"/>' +
        lbl(c, fmt(c.props.ohms, 'Ω'), 0, -14);
    },
    elements: (c, N) => [{ type: 'R', a: N('a'), b: N('b'), r: c.props.ohms }],
    sync: (c, els) => { els[0].r = c.props.ohms; },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; }
  });

  def('pot', {
    name: 'Potentiometer', cat: 'Passive', desc: 'Variable resistor / voltage divider. Scroll the mouse wheel over it, or use the slider.',
    terms: [{ n: 'a', x: -40, y: 0 }, { n: 'b', x: 40, y: 0 }, { n: 'w', x: 0, y: 40, label: 'wiper' }],
    defaults: { ohms: 10000, pos: 50 },
    props: [{ key: 'ohms', label: 'Total resistance', type: 'eng', unit: 'Ω', min: 100, max: 1e7 },
            { key: 'pos', label: 'Knob position', type: 'range', unit: '%', min: 0, max: 100, step: 1, live: true }],
    label: c => fmt(c.props.ohms, 'Ω'),
    svg: c => {
      const ang = -135 + c.props.pos * 2.7;
      return '<line class="lead" x1="-40" y1="0" x2="-22" y2="0"/><line class="lead" x1="22" y1="0" x2="40" y2="0"/><line class="lead" x1="0" y1="22" x2="0" y2="40"/>' +
        '<circle class="pot-body" r="22"/><circle class="pot-knob" r="14"/>' +
        '<line data-ref="ptr" class="pot-ptr" x1="0" y1="0" x2="0" y2="-12" transform="rotate(' + ang + ')"/>' +
        lbl(c, fmt(c.props.ohms, 'Ω'), 0, -28);
    },
    elements: (c, N) => [{ type: 'R', a: N('a'), b: N('w'), r: 1000 }, { type: 'R', a: N('w'), b: N('b'), r: 1000 }],
    sync: (c, els) => { const p = c.props.pos / 100; els[0].r = c.props.ohms * p + 1; els[1].r = c.props.ohms * (1 - p) + 1; },
    update: (c, refs) => { if (refs.ptr) refs.ptr.setAttribute('transform', 'rotate(' + (-135 + c.props.pos * 2.7) + ')'); },
    read: (c, els) => { c.rt.v = els[0].vd + els[1].vd; c.rt.i = els[0].i; c.rt.vw = els[1].vd; }
  });

  def('ldr', {
    name: 'Light sensor (LDR)', cat: 'Passive', desc: 'Resistance drops as light increases. Use the slider to change the light level.',
    terms: [{ n: 'a', x: -40, y: 0 }, { n: 'b', x: 40, y: 0 }],
    defaults: { light: 50 },
    props: [{ key: 'light', label: 'Light level', type: 'range', unit: '%', min: 0, max: 100, step: 1, live: true }],
    label: c => 'LDR',
    svg: c => '<line class="lead" x1="-40" y1="0" x2="-14" y2="0"/><line class="lead" x1="14" y1="0" x2="40" y2="0"/>' +
      '<circle class="ldr-body" r="15"/><path class="ldr-zig" d="M-9,-4 h6 l2,8 l3,-12 l3,8 l2,-4 h6" fill="none"/>' +
      '<g data-ref="rays" opacity="' + (0.15 + c.props.light / 120) + '"><path class="ldr-ray" d="M-22,-24 l8,6 M-14,-28 l6,8 M-30,-16 l8,4"/></g>' + lbl(c, 'LDR', 0, 30),
    elements: (c, N) => [{ type: 'R', a: N('a'), b: N('b'), r: 5000 }],
    sync: (c, els) => { const L = c.props.light / 100; els[0].r = 300 + 100000 * (1 - L) * (1 - L); },
    update: (c, refs) => { if (refs.rays) refs.rays.setAttribute('opacity', 0.15 + c.props.light / 120); },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; c.rt.r = els[0].r; }
  });

  def('inductor', {
    name: 'Inductor', cat: 'Passive', desc: 'A coil that opposes changes in current: V = L × dI/dt. In an RL circuit the current rises with time constant τ = L ÷ R.',
    terms: [{ n: 'a', x: -40, y: 0 }, { n: 'b', x: 40, y: 0 }],
    defaults: { henries: 0.1 },
    props: [{ key: 'henries', label: 'Inductance', type: 'eng', unit: 'H', min: 1e-5, max: 10 }],
    label: c => fmt(c.props.henries, 'H'),
    svg: c => '<line class="lead" x1="-40" y1="0" x2="-24" y2="0"/><line class="lead" x1="24" y1="0" x2="40" y2="0"/>' +
      '<path class="coil" d="M-24,0 a6,7 0 0 1 12,0 a6,7 0 0 1 12,0 a6,7 0 0 1 12,0 a6,7 0 0 1 12,0" fill="none"/>' + lbl(c, fmt(c.props.henries, 'H'), 0, -16),
    elements: (c, N) => [{ type: 'L', a: N('a'), b: N('b'), l: c.props.henries, i0: c.rt.il || 0 }],
    sync: (c, els) => { els[0].l = c.props.henries; },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; c.rt.il = els[0].i; }
  });

  def('capacitor', {
    name: 'Capacitor', cat: 'Passive', desc: 'Stores charge. Charges through a resistor with time constant τ = R × C.',
    terms: [{ n: 'a', x: -20, y: 0 }, { n: 'b', x: 20, y: 0 }],
    defaults: { farads: 100e-6 },
    props: [{ key: 'farads', label: 'Capacitance', type: 'eng', unit: 'F', min: 1e-12, max: 1 }],
    label: c => fmt(c.props.farads, 'F'),
    svg: c => '<line class="lead" x1="-20" y1="0" x2="-4" y2="0"/><line class="lead" x1="4" y1="0" x2="20" y2="0"/>' +
      '<line class="lead thick" x1="-4" y1="-14" x2="-4" y2="14"/><line class="lead thick" x1="4" y1="-14" x2="4" y2="14"/>' +
      '<rect class="cap-bar-bg" x="-12" y="18" width="24" height="4" rx="2"/><rect data-ref="charge" class="cap-bar" x="-12" y="18" width="0" height="4" rx="2"/>' +
      lbl(c, fmt(c.props.farads, 'F'), 0, -20),
    elements: (c, N) => [{ type: 'C', a: N('a'), b: N('b'), c: c.props.farads, v0: c.rt.vc || 0 }],
    sync: (c, els) => { els[0].c = c.props.farads; },
    update: (c, refs) => { if (refs.charge) refs.charge.setAttribute('width', Math.max(0, Math.min(24, Math.abs(c.rt.vc || 0) / (c.rt.vmax || 5) * 24))); },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.vc = els[0].vd; c.rt.i = els[0].i; if (Math.abs(c.rt.vc) > (c.rt.vmax || 5)) c.rt.vmax = Math.abs(c.rt.vc); }
  });

  /* ======================= SEMICONDUCTORS ======================= */
  def('led', {
    name: 'LED', cat: 'Semiconductors', desc: 'Light-emitting diode. Current flows anode (+) → cathode (−). ALWAYS use a resistor, or it burns out!',
    terms: [{ n: 'a', x: -20, y: 0, label: 'anode +' }, { n: 'k', x: 20, y: 0, label: 'cathode −' }],
    defaults: { color: 'red' },
    props: [{ key: 'color', label: 'Colour', type: 'select', options: Object.keys(LED_COLORS).map(k => ({ v: k, l: k[0].toUpperCase() + k.slice(1) })) }],
    label: c => '',
    svg: c => {
      const col = LED_COLORS[c.props.color] || LED_COLORS.red;
      return '<line class="lead" x1="-20" y1="0" x2="-9" y2="0"/><line class="lead" x1="9" y1="0" x2="20" y2="0"/>' +
        '<circle data-ref="glow" r="30" fill="url(#glow-' + c.props.color + ')" opacity="0"/>' +
        '<circle data-ref="dome" class="led-dome" r="10" fill="' + col.rgb + '" fill-opacity="0.28" stroke="' + col.rgb + '"/>' +
        '<line class="led-flat" x1="8" y1="-8" x2="8" y2="8"/><text class="led-plus" x="-5" y="3" text-anchor="middle">+</text>' +
        '<g data-ref="burnt" opacity="0"><path d="M-7,-7 L7,7 M7,-7 L-7,7" class="burnt-x"/></g>';
    },
    elements: (c, N) => { const col = LED_COLORS[c.props.color] || LED_COLORS.red; return [{ type: 'D', a: N('a'), b: N('k'), is: diodeIs(col.vf, 2), n: 2, off: !!c.rt.burnt }]; },
    sync: (c, els) => { els[0].off = !!c.rt.burnt; },
    update: (c, refs) => {
      const i = c.rt.ia || 0, col = LED_COLORS[c.props.color] || LED_COLORS.red;
      const br = c.rt.burnt ? 0 : Math.min(1, Math.pow(i / 0.015, 0.7));
      if (refs.glow) refs.glow.setAttribute('opacity', br.toFixed(3));
      if (refs.dome) { refs.dome.setAttribute('fill-opacity', (0.28 + 0.72 * br).toFixed(3)); if (c.rt.burnt) refs.dome.setAttribute('fill', '#444'); else refs.dome.setAttribute('fill', col.rgb); }
      if (refs.burnt) refs.burnt.setAttribute('opacity', c.rt.burnt ? 1 : 0);
    },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; }
  });

  def('diode', {
    name: 'Diode', cat: 'Semiconductors', desc: 'Lets current flow one way only (anode → cathode). Drops about 0.7 V.',
    terms: [{ n: 'a', x: -20, y: 0, label: 'anode' }, { n: 'k', x: 20, y: 0, label: 'cathode (bar)' }],
    label: c => '1N4007',
    svg: c => '<line class="lead" x1="-20" y1="0" x2="20" y2="0"/><path class="dio-tri" d="M-8,-10 L8,0 L-8,10 Z"/><line class="lead thick" x1="8" y1="-10" x2="8" y2="10"/>' + lbl(c, '1N4007', 0, -16),
    elements: (c, N) => [{ type: 'D', a: N('a'), b: N('k'), is: 1e-9, n: 1.75 }],
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; }
  });

  def('npn', {
    name: 'NPN transistor', cat: 'Semiconductors', desc: 'A small base current controls a much larger collector current (switch or amplifier).',
    terms: [{ n: 'c', x: 20, y: -20, label: 'collector' }, { n: 'b', x: -20, y: 0, label: 'base' }, { n: 'e', x: 20, y: 20, label: 'emitter' }],
    defaults: { beta: 100 },
    props: [{ key: 'beta', label: 'Gain (β)', type: 'number', min: 10, max: 500, step: 10 }],
    label: c => '',
    svg: c => '<circle class="q-ring" cx="4" cy="0" r="20"/><line class="lead" x1="-20" y1="0" x2="-5" y2="0"/><line class="lead thick" x1="-5" y1="-11" x2="-5" y2="11"/>' +
      '<polyline class="lead" points="-5,-6 20,-14 20,-20" fill="none"/><polyline class="lead" points="-5,6 20,14 20,20" fill="none"/>' +
      '<path class="q-arrow" d="M14,12 L6,10 L10,5 Z"/>' + lbl(c, 'NPN', -4, -26),
    elements: (c, N) => [{ type: 'Q', c: N('c'), b: N('b'), e: N('e'), is: 1e-14, bf: c.props.beta || 100, br: 2 }],
    sync: (c, els) => { els[0].bf = c.props.beta || 100; },
    read: (c, els) => { c.rt.ic = els[0].ic; c.rt.ib = els[0].ib; c.rt.vce = els[0].vce; c.rt.vbe = els[0].vbe; c.rt.i = els[0].ic; c.rt.v = els[0].vce; }
  });

  /* ======================= SWITCHES & OUTPUT ======================= */
  def('switch', {
    name: 'Toggle switch', cat: 'Switches & output', desc: 'Click it to open / close the circuit.',
    terms: [{ n: 'a', x: -40, y: 0 }, { n: 'b', x: 40, y: 0 }],
    defaults: { closed: false },
    clickable: true,
    props: [{ key: 'closed', label: 'Closed (ON)', type: 'toggle', live: true }],
    label: c => (c.props.closed ? 'ON' : 'OFF'),
    svg: c => '<line class="lead" x1="-40" y1="0" x2="-22" y2="0"/><line class="lead" x1="22" y1="0" x2="40" y2="0"/>' +
      '<rect class="sw-body" x="-24" y="-9" width="48" height="18" rx="5"/><circle class="sw-dot" cx="-16" cy="0" r="2.6"/><circle class="sw-dot" cx="16" cy="0" r="2.6"/>' +
      '<line data-ref="lever" class="sw-lever" x1="-16" y1="0" x2="' + (c.props.closed ? 16 : 12) + '" y2="' + (c.props.closed ? 0 : -14) + '"/>' + lbl(c, c.props.closed ? 'ON' : 'OFF', 0, 22),
    elements: (c, N) => [{ type: 'R', a: N('a'), b: N('b'), r: 0.01 }],
    sync: (c, els) => { els[0].r = c.props.closed ? 0.01 : 1e9; },
    update: (c, refs) => { if (refs.lever) { refs.lever.setAttribute('x2', c.props.closed ? 16 : 12); refs.lever.setAttribute('y2', c.props.closed ? 0 : -14); } },
    onClick: c => { c.props.closed = !c.props.closed; return true; },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; }
  });

  def('button', {
    name: 'Push button', cat: 'Switches & output', desc: 'Connected only while you hold the mouse button down on it.',
    terms: [{ n: 'a', x: -40, y: 0 }, { n: 'b', x: 40, y: 0 }],
    defaults: {}, momentary: true,
    label: c => '',
    svg: c => '<line class="lead" x1="-40" y1="0" x2="-14" y2="0"/><line class="lead" x1="14" y1="0" x2="40" y2="0"/>' +
      '<rect class="btn-body" x="-16" y="-16" width="32" height="32" rx="5"/><circle data-ref="cap" class="btn-cap" r="9"/>' + lbl(c, 'BTN', 0, 28),
    elements: (c, N) => [{ type: 'R', a: N('a'), b: N('b'), r: 1e9 }],
    sync: (c, els) => { els[0].r = c.rt.pressed ? 0.05 : 1e9; },
    update: (c, refs) => { if (refs.cap) refs.cap.setAttribute('r', c.rt.pressed ? 7 : 9); if (refs.cap) refs.cap.classList.toggle('pressed', !!c.rt.pressed); },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; }
  });

  def('buzzer', {
    name: 'Buzzer', cat: 'Switches & output', desc: 'Makes sound when powered. Active = beeps at fixed pitch; Passive = plays the tone() frequency.',
    terms: [{ n: '+', x: -20, y: 0 }, { n: '-', x: 20, y: 0 }],
    defaults: { kind: 'active' },
    props: [{ key: 'kind', label: 'Type', type: 'select', options: [{ v: 'active', l: 'Active (built-in tone)' }, { v: 'passive', l: 'Passive (needs tone())' }] }],
    label: c => '',
    svg: c => '<line class="lead" x1="-20" y1="0" x2="-11" y2="0"/><line class="lead" x1="11" y1="0" x2="20" y2="0"/>' +
      '<circle class="bz-body" r="12"/><circle class="bz-hole" r="3"/><text class="led-plus" x="-7" y="-4" text-anchor="middle">+</text>' +
      '<g data-ref="waves" opacity="0"><path class="bz-wave" d="M14,-10 q6,10 0,20 M19,-14 q9,14 0,28" fill="none"/></g>',
    elements: (c, N) => [{ type: 'R', a: N('+'), b: N('-'), r: c.props.kind === 'passive' ? 500 : 250 }],
    sync: (c, els) => { els[0].r = c.props.kind === 'passive' ? 500 : 250; },
    update: (c, refs) => { if (refs.waves) refs.waves.setAttribute('opacity', c.rt.sounding ? 1 : 0); },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; c.rt.sounding = Math.abs(els[0].vd) > 2.2 && els[0].vd > 0; }
  });

  function acValue(p, tMs) {
    const ph = ((tMs / 1000) * p.freq) % 1;
    let w;
    if (p.shape === 'square') w = ph < 0.5 ? 1 : -1;
    else if (p.shape === 'triangle') w = ph < 0.25 ? ph * 4 : ph < 0.75 ? 2 - ph * 4 : ph * 4 - 4;
    else w = Math.sin(2 * Math.PI * ph);
    return p.offset + p.amp * w;
  }
  def('acsource', {
    name: 'AC signal source', cat: 'Power', desc: 'A function generator: sine, square or triangle wave. Use the scope to see the waveform (Shift+click the + pin). Max 1 kHz in this simulator.',
    terms: [{ n: '+', x: 0, y: -40 }, { n: '-', x: 0, y: 40 }],
    defaults: { amp: 5, freq: 100, offset: 0, shape: 'sine' },
    props: [{ key: 'amp', label: 'Amplitude (peak)', type: 'eng', unit: 'V', min: 0.01, max: 24 },
            { key: 'freq', label: 'Frequency', type: 'eng', unit: 'Hz', min: 0.1, max: 1000 },
            { key: 'offset', label: 'DC offset', type: 'number', min: -24, max: 24, step: 0.5 },
            { key: 'shape', label: 'Waveform', type: 'select', options: [{ v: 'sine', l: 'Sine' }, { v: 'square', l: 'Square' }, { v: 'triangle', l: 'Triangle' }] }],
    label: c => fmt(c.props.freq, 'Hz'),
    svg: c => {
      const sh = c.props.shape === 'square' ? 'M-9,4 v-8 h9 v8 h9' : c.props.shape === 'triangle' ? 'M-10,3 l5,-7 l10,7 l5,-7' : 'M-11,0 q5.5,-11 11,0 t11,0';
      return '<line class="lead" x1="0" y1="-40" x2="0" y2="-20"/><line class="lead" x1="0" y1="20" x2="0" y2="40"/>' +
        '<circle class="ac-body" r="20"/><path class="ac-wave" d="' + sh + '" fill="none"/><text class="led-plus" x="0" y="-9" text-anchor="middle" style="font-size:8px">+</text>' +
        lbl(c, c.props.amp + 'V ' + fmt(c.props.freq, 'Hz'), 56, 4, 'plabel');
    },
    elements: (c, N) => [{ type: 'V', a: N('+'), b: N('-'), v: acValue(c.props, 0), rs: 0.1 }],
    sync: (c, els) => { els[0].v = acValue(c.props, c.rt.tms || 0); },
    tick: (c, els, tMs) => { c.rt.tms = tMs; els[0].v = acValue(c.props, tMs); },
    read: (c, els) => { c.rt.i = els[0].i; c.rt.v = els[0].vd; }
  });

  /* ======================= DISPLAY, MOTION & METERS ======================= */
  def('vcc', {
    name: '5 V supply', cat: 'Power', desc: 'A fixed supply symbol (like a battery + referenced to ground). Needs a Ground symbol somewhere in the circuit.',
    terms: [{ n: 'v', x: 0, y: 0 }], defaults: { volts: 5 },
    props: [{ key: 'volts', label: 'Voltage', type: 'eng', unit: 'V', min: 0.1, max: 48 }],
    label: c => fmt(c.props.volts, 'V'),
    svg: c => { const u = rotPt(0, -1, c.rot);   // the label goes beyond the bar, in the symbol's own direction
      return '<line class="lead" x1="0" y1="0" x2="0" y2="-12"/><line class="lead thick" x1="-11" y1="-12" x2="11" y2="-12"/>' + lbl(c, fmt(c.props.volts, 'V'), u[0] * 24, u[1] * 22 + 4); },
    elements: (c, N) => [{ type: 'V', a: N('v'), b: 0, v: c.props.volts, rs: 0.1 }],
    sync: (c, els) => { els[0].v = c.props.volts; },
    read: (c, els) => { c.rt.i = els[0].i; c.rt.v = els[0].vd; }
  });

  def('motor', {
    name: 'DC motor', cat: 'Display & motion', desc: 'Spins when about 1 V or more is across it; faster with more voltage; reverses if you swap the leads. A pin cannot drive it directly: use a transistor.',
    terms: [{ n: 'a', x: -40, y: 0 }, { n: 'b', x: 40, y: 0 }], defaults: {},
    label: c => '',
    svg: c => '<line class="lead" x1="-40" y1="0" x2="-24" y2="0"/><line class="lead" x1="24" y1="0" x2="40" y2="0"/><circle class="motor-body" r="24"/>' +
      '<g data-ref="rotor"><line class="motor-spoke" x1="-15" y1="0" x2="15" y2="0"/><line class="motor-spoke" x1="-7.5" y1="-13" x2="7.5" y2="13"/><line class="motor-spoke" x1="-7.5" y1="13" x2="7.5" y2="-13"/></g><circle class="motor-hub" r="4"/>' + lbl(c, 'M', 0, -30),
    elements: (c, N) => [{ type: 'R', a: N('a'), b: N('b'), r: 25 }],
    tick: (c, els, t) => {
      const rt = c.rt, dt = rt.tl === undefined ? 0 : Math.max(0, t - rt.tl); rt.tl = t;
      const v = els[0].vd || 0, target = Math.sign(v) * Math.min(1.4, Math.max(0, (Math.abs(v) - 0.8) / 4.2));
      rt.omega = (rt.omega || 0) + (target - (rt.omega || 0)) * (1 - Math.exp(-dt / 150));
      rt.deg = ((rt.deg || 0) + rt.omega * 2.16 * dt) % 360;
    },
    update: (c, refs) => { if (refs.rotor) refs.rotor.setAttribute('transform', 'rotate(' + (c.rt.deg || 0).toFixed(1) + ')'); },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; c.rt.rpm = Math.round((c.rt.omega || 0) * 3000); }
  });

  def('servo', {
    name: 'Servo motor', cat: 'Display & motion', bounds: [-45, -45, 135, 90], defaults: {},
    desc: 'Moves its arm to the angle (0–180°) set by Servo.write(). Needs 5 V + GND and a control signal from a pin used with Servo.attach().',
    terms: [{ n: 'gnd', x: -40, y: -20, label: 'GND (brown)' }, { n: 'vcc', x: -40, y: 0, label: '5V (red)' }, { n: 'sig', x: -40, y: 20, label: 'signal (orange)' }],
    label: c => '',
    svg: c => {
      const a = c.rt && c.rt.angle !== undefined ? c.rt.angle : 90;
      return '<line class="lead" x1="-40" y1="-20" x2="-26" y2="-20" style="stroke:#8b5a2b"/><line class="lead" x1="-40" y1="0" x2="-26" y2="0" style="stroke:#d94a4a"/><line class="lead" x1="-40" y1="20" x2="-26" y2="20" style="stroke:#f28c28"/>' +
        '<rect class="servo-body" x="-26" y="-30" width="62" height="60" rx="5"/><rect class="servo-ear" x="-34" y="-8" width="10" height="16" rx="2"/>' +
        '<text class="servo-txt" x="-16" y="4">SERVO</text><g transform="translate(36,0)"><path class="servo-arc" d="M0,38 A38,38 0 0 0 0,-38" fill="none"/><g data-ref="horn" transform="rotate(' + (-a) + ')"><line class="servo-horn" x1="0" y1="0" x2="0" y2="36"/><circle class="servo-tip" cx="0" cy="36" r="4"/></g><circle class="motor-hub" r="6"/></g>';
    },
    elements: (c, N) => { c.rt.n = { vcc: N('vcc'), gnd: N('gnd'), sig: N('sig') }; return [{ type: 'R', a: N('vcc'), b: N('gnd'), r: 300 }]; },
    tick: (c, els, t, rtm) => {
      const r = c.rt, dt = r.tl === undefined ? 0 : Math.max(0, t - r.tl); r.tl = t; if (!r.n || !rtm.ard) return;
      const v = rtm.sim.v, powered = v[r.n.vcc] - v[r.n.gnd] > 3.5;
      let target = null;
      for (let p = 0; p < 20; p++) if (r.n.sig !== 0 && rtm.ard.nodes[p] === r.n.sig && rtm.pins[p].servo !== null) target = rtm.pins[p].servo;
      if (r.angle === undefined) r.angle = 90;
      if (powered && target !== null) { const diff = target - r.angle, step = 0.6 * dt; r.angle += Math.max(-step, Math.min(step, diff)); r.moving = Math.abs(diff) > 0.5; } else r.moving = false;
      els[0].r = r.moving ? 40 : 300;
      r.status = !powered ? 'No power: connect red (5V) and brown (GND).' : target === null ? 'No control signal: wire the orange pin to the pin used in servo.attach().' : 'OK';
    },
    update: (c, refs) => { if (refs.horn) refs.horn.setAttribute('transform', 'rotate(' + (-(c.rt.angle !== undefined ? c.rt.angle : 90)).toFixed(1) + ')'); },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; }
  });

  const LCD_SIGS = ['VSS', 'VDD', 'V0', 'RS', 'RW', 'E', 'D4', 'D5', 'D6', 'D7', 'A', 'K'];
  def('lcd16x2', {
    name: 'LCD 16×2', cat: 'Display & motion', bounds: [-175, -58, 350, 128], z: 4,
    desc: 'Character display for LiquidCrystal(rs, en, d4, d5, d6, d7). Wire RS, E and D4–D7 to the pins in your sketch. “Simplified power” ties VSS, VDD, V0, RW and the backlight for you.',
    defaults: { simple: true },
    props: [{ key: 'simple', label: 'Simplified power (VSS/VDD/V0/RW/backlight tied for me)', type: 'toggle' }],
    terms: LCD_SIGS.map((n, i) => ({ n, x: -110 + i * 20, y: 64, label: n === 'RS' ? 'RS (register select)' : n === 'E' ? 'E (enable)' : n === 'VSS' ? 'VSS (GND)' : n === 'VDD' ? 'VDD (+5V)' : n === 'V0' ? 'V0 (contrast)' : n })),
    label: c => '',
    svg: c => {
      let s = '<rect class="lcd-pcb" x="-170" y="-54" width="340" height="112" rx="6"/><rect class="lcd-bezel" x="-150" y="-38" width="300" height="72" rx="3"/><rect data-ref="screen" class="lcd-screen" x="-142" y="-32" width="284" height="60"/>' +
        '<text data-ref="row0" class="lcd-text" x="-132" y="-6" xml:space="preserve" textLength="264" lengthAdjust="spacingAndGlyphs"></text><text data-ref="row1" class="lcd-text" x="-132" y="22" xml:space="preserve" textLength="264" lengthAdjust="spacingAndGlyphs"></text>' +
        '<rect class="hdr" x="-122" y="58" width="244" height="12" rx="1"/>';
      LCD_SIGS.forEach((n, i) => { s += '<text class="lcd-pin" x="' + (-110 + i * 20) + '" y="53" text-anchor="middle">' + n + '</text>'; });
      return s + '<text data-ref="msg" class="lcd-msg" x="0" y="-8" text-anchor="middle"></text>';
    },
    elements: (c, N) => { c.rt.n = {}; for (const s of LCD_SIGS) c.rt.n[s] = N(s); return []; },
    tick: (c, els, t, rtm) => {
      const r = c.rt; if (!r.n) return;
      const lcds = rtm.interp ? rtm.interp.libObjects.filter(o => o.__lib === 'LCD' && !o.i2c) : [];
      const v = rtm.sim.v; let status = lcds.length ? '' : 'No LiquidCrystal object in the sketch yet.', chosen = null;
      const need = [['rs', 'RS'], ['en', 'E'], ['d4', 'D4'], ['d5', 'D5'], ['d6', 'D6'], ['d7', 'D7']];
      for (const o of lcds) {
        const bad = [];
        for (const [k, term] of need) { const pin = o.pins[k], pn = rtm.ard && rtm.ard.nodes[pin]; if (pn === undefined || pn !== r.n[term]) bad.push(term + ' should connect to pin ' + (pin < 14 ? 'D' + pin : 'A' + (pin - 14))); }
        if (!bad.length) { chosen = o; break; }
        status = 'Wiring: ' + bad.join('; ') + '.';
      }
      let powered = true;
      if (!c.props.simple) {
        powered = v[r.n.VDD] - v[r.n.VSS] > 4 && Math.abs(v[r.n.VSS]) < 0.3;
        if (chosen && !powered) { status = 'No power: wire VDD to 5 V and VSS to GND (and V0 to GND or a pot for contrast, RW to GND, A to 5 V through a resistor, K to GND).'; chosen = null; }
        else if (chosen && v[r.n.V0] > 2.5) { status = 'Contrast: V0 is high, so the text is invisible. Connect V0 to GND or a potentiometer.'; chosen = null; }
      }
      r.obj = chosen; r.status = chosen ? 'OK' : status;
    },
    update: (c, refs) => {
      const o = c.rt.obj, nb = s => s.replace(/ /g, '\u00a0');
      const running = !!c.rt.status;
      if (refs.screen) refs.screen.classList.toggle('on', !!o || (running && c.rt.status !== 'No power'));
      if (refs.row0) refs.row0.textContent = o ? (o.display ? nb(o.inited ? o.lines[0] : '\u2588'.repeat(16)) : '') : '';
      if (refs.row1) refs.row1.textContent = o ? (o.display ? nb(o.inited ? (o.lines[1] || '') : ' '.repeat(16)) : '') : '';
      if (refs.msg) refs.msg.textContent = '';
    },
    read: () => {}
  });

  const SEG_TERMS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'];
  const SEG_SHAPES = {
    a: '-26,-40 26,-40 20,-33 -20,-33', b: '28,-38 28,-4 21,-9 21,-31', c: '28,4 28,38 21,31 21,9', d: '-26,40 26,40 20,33 -20,33',
    e: '-28,4 -28,38 -21,31 -21,9', f: '-28,-38 -28,-4 -21,-9 -21,-31', g: '-24,0 -18,-4 18,-4 24,0 18,4 -18,4'
  };
  def('sevenseg', {
    name: '7-segment display', cat: 'Display & motion', bounds: [-70, -62, 140, 135], z: 4,
    desc: 'Common-cathode digit: connect each segment pin (a–g, dp) to an output pin and COM to GND. With “built-in resistors” each segment already has 220 Ω; turn it off to add your own.',
    defaults: { resistors: 'builtin' },
    props: [{ key: 'resistors', label: 'Series resistors', type: 'select', options: [{ v: 'builtin', l: 'Built in (220 Ω per segment)' }, { v: 'none', l: 'None (add your own!)' }] }],
    terms: SEG_TERMS.concat(['com']).map((n, i) => ({ n, x: -80 + i * 20, y: 64, label: n === 'com' ? 'COM (cathode, to GND)' : 'segment ' + n })),
    label: c => '',
    svg: c => {
      let s = '<rect class="seg-body" x="-62" y="-56" width="124" height="112" rx="6"/>';
      for (const k of Object.keys(SEG_SHAPES)) s += '<polygon data-ref="s_' + k + '" class="seg" fill-opacity="0.12" points="' + SEG_SHAPES[k] + '"/>';
      s += '<circle data-ref="s_dp" class="seg" fill-opacity="0.12" cx="40" cy="38" r="4.5"/><rect class="hdr" x="-90" y="58" width="180" height="12" rx="1"/>';
      SEG_TERMS.concat(['com']).forEach((n, i) => { s += '<text class="lcd-pin" x="' + (-80 + i * 20) + '" y="52" text-anchor="middle" style="fill:#cdd">' + n + '</text>'; });
      return s;
    },
    elements: (c, N) => {
      const out = [], com = N('com');
      for (const sg of SEG_TERMS) {
        const a = N(sg);
        if (c.props.resistors === 'builtin') { const mid = N.alloc(); out.push({ type: 'R', a, b: mid, r: 220 }, { type: 'D', a: mid, b: com, is: diodeIs(1.9, 2), n: 2 }); }
        else out.push({ type: 'D', a, b: com, is: diodeIs(1.9, 2), n: 2 });
      }
      return out;
    },
    tick: (c, els, t) => {
      const r = c.rt, dt = r.tl === undefined ? 0 : Math.max(0, t - r.tl); r.tl = t;
      r.seg = r.seg || new Array(8).fill(0); const a = 1 - Math.exp(-dt / 3), ds = els.filter(e => e.type === 'D');
      for (let k = 0; k < 8; k++) { const i = ds[k] ? Math.abs(ds[k].i) : 0; r.seg[k] += (Math.min(1, i / 0.012) - r.seg[k]) * a; if (i > 0.04) r.over = true; }
    },
    update: (c, refs) => { SEG_TERMS.forEach((k, i) => { const b = (c.rt.seg && c.rt.seg[i]) || 0; if (refs['s_' + k]) refs['s_' + k].setAttribute('fill-opacity', (0.12 + 0.88 * b).toFixed(2)); }); },
    read: () => {}
  });

  def('voltmeter', {
    name: 'Voltmeter', cat: 'Instruments', desc: 'Measures the voltage between its two leads (A minus B). Connect it in PARALLEL with the part you want to measure. Very high resistance (10 MΩ).',
    terms: [{ n: 'a', x: -40, y: 0, label: 'red probe (+)' }, { n: 'b', x: 40, y: 0, label: 'black probe (−)' }], defaults: {},
    label: c => '',
    svg: c => '<line class="lead" x1="-40" y1="0" x2="-26" y2="0"/><line class="lead" x1="26" y1="0" x2="40" y2="0"/><rect class="meter-body" x="-26" y="-18" width="52" height="36" rx="6"/><rect class="meter-lcd" x="-21" y="-13" width="42" height="14" rx="2"/><text data-ref="val" class="meter-val" x="0" y="-2.5" text-anchor="middle">-- V</text><text class="meter-lbl" x="0" y="13" text-anchor="middle">VOLTMETER</text>',
    elements: (c, N) => [{ type: 'R', a: N('a'), b: N('b'), r: 1e7 }],
    update: (c, refs) => { if (refs.val) refs.val.textContent = c.rt.v === undefined ? '-- V' : fmt(c.rt.v, 'V').replace(' ', ''); },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; }
  });
  def('ammeter', {
    name: 'Ammeter', cat: 'Instruments', desc: 'Measures current flowing from A to B. Connect it IN SERIES (break the circuit and put the meter in the gap). Almost no resistance (0.05 Ω).',
    terms: [{ n: 'a', x: -40, y: 0, label: 'current in (+)' }, { n: 'b', x: 40, y: 0, label: 'current out (−)' }], defaults: {},
    label: c => '',
    svg: c => '<line class="lead" x1="-40" y1="0" x2="-26" y2="0"/><line class="lead" x1="26" y1="0" x2="40" y2="0"/><rect class="meter-body" x="-26" y="-18" width="52" height="36" rx="6"/><rect class="meter-lcd" x="-21" y="-13" width="42" height="14" rx="2"/><text data-ref="val" class="meter-val" x="0" y="-2.5" text-anchor="middle">-- A</text><text class="meter-lbl" x="0" y="13" text-anchor="middle">AMMETER</text>',
    elements: (c, N) => [{ type: 'R', a: N('a'), b: N('b'), r: 0.05 }],
    update: (c, refs) => { if (refs.val) refs.val.textContent = c.rt.i === undefined ? '-- A' : fmt(c.rt.i, 'A').replace(' ', ''); },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; }
  });

  const ic555Terms = [{ n: 'GND', x: -40, y: -40 }, { n: 'TRIG', x: -40, y: -20 }, { n: 'OUT', x: -40, y: 0 }, { n: 'RESET', x: -40, y: 20 }, { n: 'VCC', x: 40, y: -40 }, { n: 'DIS', x: 40, y: -20 }, { n: 'THR', x: 40, y: 0 }, { n: 'CTRL', x: 40, y: 20 }];
  /* ======================= SENSORS ======================= */
  def('tmp36', {
    name: 'Temperature sensor (TMP36)', cat: 'Sensors', bounds: [-30, -30, 60, 80], defaults: { temp: 25 },
    desc: 'Analog temperature sensor: output = 0.5 V + 10 mV per °C (so 25 °C = 0.75 V). Needs 2.7–5.5 V on the left leg when facing the flat side, GND on the right. Use the slider to change the temperature.',
    props: [{ key: 'temp', label: 'Temperature', type: 'range', unit: ' °C', min: -40, max: 125, step: 1, live: true }],
    terms: [{ n: 'vcc', x: -20, y: 40, label: '+Vs (2.7–5.5 V)' }, { n: 'out', x: 0, y: 40, label: 'Vout' }, { n: 'gnd', x: 20, y: 40, label: 'GND' }],
    label: c => '',
    svg: c => '<line class="lead" x1="-20" y1="28" x2="-20" y2="40"/><line class="lead" x1="0" y1="28" x2="0" y2="40"/><line class="lead" x1="20" y1="28" x2="20" y2="40"/>' +
      '<path class="to92" d="M-24,28 L-24,-2 A24,24 0 0 1 24,-2 L24,28 Z"/><text class="to92-t" x="0" y="8" text-anchor="middle">TMP36</text>' +
      '<text data-ref="val" class="to92-v" x="0" y="22" text-anchor="middle">' + c.props.temp + '°C</text><rect data-ref="heat" class="heat" x="-18" y="-16" width="36" height="5" rx="2"/>',
    elements: (c, N) => { c.rt.n = { vcc: N('vcc'), gnd: N('gnd'), out: N('out') }; return [{ type: 'V', a: N('out'), b: N('gnd'), v: 0.5 + 0.01 * c.props.temp, rs: 50 }]; },
    sync: (c, els) => { els[0].v = 0.5 + 0.01 * c.props.temp; },
    tick: (c, els, t, rtm) => { const n = c.rt.n; if (!n) return; const v = rtm.sim.v; els[0].v = v[n.vcc] - v[n.gnd] >= 2.7 ? 0.5 + 0.01 * c.props.temp : 0; c.rt.powered = v[n.vcc] - v[n.gnd] >= 2.7; },
    update: (c, refs) => {
      if (refs.val) refs.val.textContent = c.props.temp + '°C';
      if (refs.heat) { const k = Math.max(0, Math.min(1, (c.props.temp + 40) / 165)); refs.heat.setAttribute('fill', 'hsl(' + (220 - 220 * k).toFixed(0) + ',85%,55%)'); }
    },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; }
  });

  def('hcsr04', {
    name: 'Ultrasonic sensor (HC-SR04)', cat: 'Sensors', bounds: [-62, -46, 124, 96], defaults: { distance: 50 },
    desc: 'Measures distance with sound. A 10 µs pulse on TRIG starts a burst; ECHO then goes HIGH for 58 µs per cm. Read it with pulseIn(ECHO, HIGH). Needs 5 V and GND.',
    props: [{ key: 'distance', label: 'Object distance', type: 'range', unit: ' cm', min: 1, max: 450, step: 1, live: true }],
    terms: [{ n: 'vcc', x: -40, y: 40, label: 'VCC (5 V)' }, { n: 'trig', x: -20, y: 40, label: 'TRIG (input)' }, { n: 'echo', x: 0, y: 40, label: 'ECHO (output)' }, { n: 'gnd', x: 20, y: 40, label: 'GND' }],
    label: c => '',
    svg: c => '<rect class="us-pcb" x="-60" y="-44" width="120" height="76" rx="5"/><circle class="us-eye" cx="-30" cy="-12" r="19"/><circle class="us-eye" cx="30" cy="-12" r="19"/><circle class="us-in" cx="-30" cy="-12" r="11"/><circle class="us-in" cx="30" cy="-12" r="11"/>' +
      '<text class="us-txt" x="0" y="-8" text-anchor="middle">HC-SR04</text><rect class="hdr" x="-48" y="32" width="76" height="12" rx="1"/>' +
      '<text class="lcd-pin" x="-40" y="26" text-anchor="middle">VCC</text><text class="lcd-pin" x="-20" y="26" text-anchor="middle">TRIG</text><text class="lcd-pin" x="0" y="26" text-anchor="middle">ECHO</text><text class="lcd-pin" x="20" y="26" text-anchor="middle">GND</text>' +
      '<g data-ref="wave" opacity="0"><path class="us-wave" d="M-30,-36 q-8,-6 0,-12 M-30,-42 q-14,-6 0,-18" fill="none"/></g>',
    elements: (c, N) => { c.rt.n = { vcc: N('vcc'), trig: N('trig'), echo: N('echo'), gnd: N('gnd') }; return [{ type: 'V', a: N('echo'), b: 0, v: 0, rs: 50 }]; },
    tick: (c, els, t, rtm) => {
      const r = c.rt, n = r.n; if (!n) return; const v = rtm.sim.v;
      r.powered = v[n.vcc] - v[n.gnd] > 4;
      const high = r.powered && r.echo && t >= r.echo.t0 && t < r.echo.t1;
      els[0].v = high ? 5 : 0; r.echoHigh = !!high;
    },
    update: (c, refs) => { if (refs.wave) refs.wave.setAttribute('opacity', c.rt.echoHigh ? 1 : 0); },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; }
  });

  /* ======================= DIGITAL ICs ======================= */
  def('ic555', {
    name: '555 timer', cat: 'Digital ICs', bounds: [-50, -60, 100, 100], defaults: {},
    desc: 'The classic timer chip. In astable mode (R1, R2, C) it makes a square wave: f ≈ 1.44 ÷ ((R1 + 2·R2) × C). It sets OUT HIGH when TRIG < ⅓ Vcc and LOW when THR > ⅔ Vcc; DIS discharges the capacitor while OUT is LOW. (CMOS-style output swing; CTRL is not modelled.)',
    terms: [{ n: 'GND', x: -40, y: -40, label: '1 GND' }, { n: 'TRIG', x: -40, y: -20, label: '2 TRIG (< ⅓ Vcc sets OUT high)' }, { n: 'OUT', x: -40, y: 0, label: '3 OUT' }, { n: 'RESET', x: -40, y: 20, label: '4 RESET (low = off, tie to Vcc)' },
            { n: 'VCC', x: 40, y: -40, label: '8 VCC' }, { n: 'DIS', x: 40, y: -20, label: '7 DISCHARGE' }, { n: 'THR', x: 40, y: 0, label: '6 THRESHOLD (> ⅔ Vcc resets OUT)' }, { n: 'CTRL', x: 40, y: 20, label: '5 CONTROL (optional 10 nF to GND)' }],
    label: c => '',
    svg: c => {
      let s = '<rect class="ic-body" x="-30" y="-52" width="60" height="84" rx="4"/><path class="ic-notch" d="M-8,-52 A8,8 0 0 0 8,-52"/><text class="ic-t" x="0" y="-8" text-anchor="middle">555</text><text class="ic-t2" x="0" y="6" text-anchor="middle">TIMER</text>';
      for (const t of ic555Terms) { const left = t.x < 0; s += '<line class="lead" x1="' + t.x + '" y1="' + t.y + '" x2="' + (left ? -30 : 30) + '" y2="' + t.y + '"/><text class="ic-pin" x="' + (left ? -26 : 26) + '" y="' + (t.y + 3) + '" text-anchor="' + (left ? 'start' : 'end') + '">' + t.n + '</text>'; }
      return s + '<circle data-ref="led" class="ic-led" cx="22" cy="-46" r="3"/>';
    },
    elements: (c, N) => { c.rt.n = {}; for (const t of ic555Terms) c.rt.n[t.n] = N(t.n); const n = c.rt.n;
      return [{ type: 'V', a: n.OUT, b: n.GND, v: 0, rs: 25, en: true }, { type: 'R', a: n.DIS, b: n.GND, r: 1e9 }]; },
    tick: (c, els, t, rtm) => {
      const r = c.rt, n = r.n; if (!n) return; const v = rtm.sim.v, vcc = v[n.VCC] - v[n.GND];
      if (vcc < 3.5) { r.q = 0; r.powered = false; els[0].v = 0; els[1].r = 1e9; return; }
      r.powered = true; const g = v[n.GND], trig = v[n.TRIG] - g, thr = v[n.THR] - g, rst = v[n.RESET] - g;
      if (r.q === undefined) r.q = 0;
      if (rst < 0.7) r.q = 0; else if (trig < vcc / 3) r.q = 1; else if (thr > 2 * vcc / 3) r.q = 0;
      els[0].v = r.q ? vcc - 0.1 : 0; els[1].r = r.q ? 1e9 : 20;
    },
    update: (c, refs) => { if (refs.led) refs.led.setAttribute('fill', c.rt.q ? '#2fe27a' : '#31403a'); },
    read: (c, els) => { c.rt.i = els[0].i; c.rt.v = els[0].vd; }
  });

  const GATE_NAMES = { and: 'AND', or: 'OR', not: 'NOT', nand: 'NAND', nor: 'NOR', xor: 'XOR' };
  function gateFn(type, a, b) {
    switch (type) { case 'and': return a & b; case 'or': return a | b; case 'not': return a ? 0 : 1; case 'nand': return (a & b) ? 0 : 1; case 'nor': return (a | b) ? 0 : 1; default: return a ^ b; }
  }
  def('gate', {
    name: 'Logic gate', cat: 'Digital ICs', bounds: [-45, -30, 90, 60], defaults: { type: 'and' },
    desc: 'AND, OR, NOT, NAND, NOR or XOR. Inputs read HIGH above 2.5 V; the output drives 5 V or 0 V. Power is assumed. NOT uses input A only. Unconnected inputs read LOW.',
    props: [{ key: 'type', label: 'Gate type', type: 'select', options: Object.keys(GATE_NAMES).map(k => ({ v: k, l: GATE_NAMES[k] })) }],
    terms: [{ n: 'A', x: -40, y: -20, label: 'input A' }, { n: 'B', x: -40, y: 20, label: 'input B' }, { n: 'Y', x: 40, y: 0, label: 'output Y' }],
    label: c => GATE_NAMES[c.props.type],
    svg: c => {
      const t = c.props.type, bub = (t === 'nand' || t === 'nor' || t === 'not');
      let body;
      if (t === 'and' || t === 'nand') body = '<path class="gate-body" d="M-24,-18 H0 A18,18 0 0 1 0,18 H-24 Z"/>';
      else if (t === 'not') body = '<path class="gate-body" d="M-22,-16 L16,0 L-22,16 Z"/>';
      else body = '<path class="gate-body" d="M-26,-18 H-6 Q14,-18 22,0 Q14,18 -6,18 H-26 Q-16,0 -26,-18 Z"/>' + (t === 'xor' ? '<path class="gate-arc" d="M-32,-18 Q-22,0 -32,18" fill="none"/>' : '');
      const tip = t === 'and' || t === 'nand' ? 18 : t === 'not' ? 16 : 22, outX = bub ? tip + 7 : tip;
      let s = body + (bub ? '<circle class="gate-bub" cx="' + (tip + 3.5) + '" cy="0" r="3.5"/>' : '') + '<line class="lead" x1="' + outX + '" y1="0" x2="40" y2="0"/>';
      if (t === 'not') s += '<polyline class="lead" points="-40,-20 -32,-20 -32,0 -22,0" fill="none"/>';
      else s += '<line class="lead" x1="-40" y1="-20" x2="-22" y2="-20"/><line class="lead" x1="-40" y1="20" x2="-22" y2="20"/>';
      return s + lbl(c, GATE_NAMES[t], 0, 32) + '<circle data-ref="yled" class="ic-led" cx="30" cy="-10" r="3"/>';
    },
    elements: (c, N) => { c.rt.n = { A: N('A'), B: N('B'), Y: N('Y') }; return [{ type: 'V', a: N('Y'), b: 0, v: 0, rs: 50 }]; },
    tick: (c, els, t, rtm) => {
      const n = c.rt.n; if (!n) return; const v = rtm.sim.v, a = v[n.A] > 2.5 ? 1 : 0, b = v[n.B] > 2.5 ? 1 : 0;
      const y = gateFn(c.props.type, a, b); els[0].v = y ? 5 : 0; c.rt.a = a; c.rt.b = b; c.rt.y = y;
    },
    update: (c, refs) => { if (refs.yled) refs.yled.setAttribute('fill', c.rt.y ? '#2fe27a' : '#31403a'); },
    read: (c, els) => { c.rt.i = els[0].i; c.rt.v = els[0].vd; }
  });

  /* ======================= BOARDS ======================= */
  // Arduino Uno: origin is the top-left corner of the board
  const ARD_PINS = (function () {
    const t = [];
    const top = [['GND_T', 40, 'GND'], ['D13', 60, '13'], ['D12', 80, '12'], ['D11', 100, '~11'], ['D10', 120, '~10'], ['D9', 140, '~9'], ['D8', 160, '8'],
      ['D7', 200, '7'], ['D6', 220, '~6'], ['D5', 240, '~5'], ['D4', 260, '4'], ['D3', 280, '~3'], ['D2', 300, '2'], ['D1', 320, 'TX1'], ['D0', 340, 'RX0']];
    const bot = [['3V3', 100, '3V3'], ['5V', 120, '5V'], ['GND_B1', 140, 'GND'], ['GND_B2', 160, 'GND'], ['VIN', 180, 'VIN'],
      ['A0', 220, 'A0'], ['A1', 240, 'A1'], ['A2', 260, 'A2'], ['A3', 280, 'A3'], ['A4', 300, 'A4'], ['A5', 320, 'A5']];
    top.forEach(p => t.push({ n: p[0], x: p[1], y: 20, label: p[2], side: 'top' }));
    bot.forEach(p => t.push({ n: p[0], x: p[1], y: 200, label: p[2], side: 'bot' }));
    return t;
  })();
  def('arduino', {
    name: 'Arduino Uno', cat: 'Boards', single: true, z: 2, desc: 'The microcontroller board. Write a sketch in the Code tab and it runs on the virtual ATmega328P.',
    terms: ARD_PINS, ground: ['GND_T', 'GND_B1', 'GND_B2'], defaults: {}, noRotate: false,
    bounds: [-20, 0, 400, 220],
    label: c => '',
    svg: c => {
      let s = '<rect class="usb" x="-22" y="58" width="52" height="46" rx="3"/><rect class="jack" x="-16" y="146" width="48" height="40" rx="3"/>' +
        '<rect class="ard-body" x="0" y="0" width="380" height="220" rx="12"/>' +
        '<rect class="hdr" x="30" y="11" width="320" height="18" rx="2"/><rect class="hdr" x="90" y="191" width="100" height="18" rx="2"/><rect class="hdr" x="210" y="191" width="120" height="18" rx="2"/>' +
        '<rect class="ard-chip" x="170" y="88" width="130" height="38" rx="3"/><text class="ard-chip-t" x="235" y="111" text-anchor="middle">ATmega328P</text>' +
        '<text class="ard-title" x="250" y="76" text-anchor="middle">ARDUINO UNO</text>' +
        '<rect class="rst" x="52" y="88" width="22" height="22" rx="4"/><text class="ard-sm" x="63" y="124" text-anchor="middle">RESET</text>' +
        '<rect data-ref="led13" class="onled" x="110" y="50" width="12" height="7" rx="2" fill="#ffb020" fill-opacity="0.18"/><text class="ard-sm" x="116" y="66" text-anchor="middle">L</text>' +
        '<rect class="onled" x="136" y="50" width="12" height="7" rx="2" fill="#2fe27a"/><text class="ard-sm" x="142" y="66" text-anchor="middle">ON</text>' +
        '<circle data-ref="glow13" cx="116" cy="53" r="22" fill="url(#glow-orange)" opacity="0"/>';
      for (const p of ARD_PINS) {
        const ty = p.side === 'top' ? 40 : 180;
        s += '<text class="ard-pin" x="' + p.x + '" y="' + ty + '" text-anchor="middle">' + esc(p.label) + '</text>';
      }
      s += '<text class="ard-sm" x="150" y="206" text-anchor="middle" opacity="0">.</text>';
      return s;
    },
    elements: (c, N, ctx) => {
      const els = [];
      ctx.ard = { comp: c, pinEls: [], nodes: [] };
      els.push({ type: 'V', a: N('5V'), b: 0, v: 5, rs: 0.1 });
      els.push({ type: 'V', a: N('3V3'), b: 0, v: 3.3, rs: 0.1 });
      els.push({ type: 'V', a: N('VIN'), b: 0, v: 5, rs: 0.5 });
      for (let p = 0; p < 20; p++) {
        const name = p < 14 ? 'D' + p : 'A' + (p - 14);
        const a = N(name);
        const el = { type: 'V', a, b: 0, v: 0, rs: 25, en: false, pin: p };
        ctx.ard.pinEls[p] = el; ctx.ard.nodes[p] = a;
        els.push(el);
      }
      return els;
    },
    update: (c, refs) => {
      const on = c.rt.led13 || 0;
      if (refs.led13) refs.led13.setAttribute('fill-opacity', (0.18 + 0.82 * on).toFixed(2));
      if (refs.glow13) refs.glow13.setAttribute('opacity', on.toFixed(2));
    },
    read: () => {}
  });

  // Half-size solderless breadboard
  const BB = (function () {
    const terms = [], holes = [];
    const rows = 'abcdefghij';
    for (let col = 1; col <= 30; col++) {
      const x = 40 + (col - 1) * 20;
      for (let r = 0; r < 10; r++) {
        const y = r < 5 ? 100 + r * 20 : 240 + (r - 5) * 20;
        const g = r < 5 ? 'c' + col + 't' : 'c' + col + 'b';
        terms.push({ n: col + rows[r], x, y, g, hole: true });
        holes.push([x, y]);
      }
    }
    const rails = [['T+', 20], ['T-', 40], ['B+', 380], ['B-', 400]];
    for (const [nm, y] of rails) {
      for (let i = 0; i < 25; i++) {
        const x = 60 + i * 20 + Math.floor(i / 5) * 0;
        terms.push({ n: nm + (i + 1), x, y, g: 'r' + nm, hole: true });
        holes.push([x, y]);
      }
    }
    let d = '';
    for (const [x, y] of holes) d += 'M' + x + ',' + y + 'h0.1';
    return { terms, d };
  })();
  def('breadboard', {
    name: 'Breadboard', cat: 'Boards', z: 0, desc: 'Holes in the same column strip (a–e or f–j) are connected. The two rails run the whole length. Components snap into holes.',
    terms: BB.terms, defaults: {}, bounds: [0, 0, 640, 420], noPins: true,
    label: c => '',
    svg: c => {
      let s = '<rect class="bb-body" x="0" y="0" width="640" height="420" rx="8"/><rect class="bb-chan" x="20" y="205" width="600" height="25"/>' +
        '<line class="bb-rail-p" x1="45" y1="12" x2="595" y2="12"/><line class="bb-rail-m" x1="45" y1="48" x2="595" y2="48"/>' +
        '<line class="bb-rail-p" x1="45" y1="372" x2="595" y2="372"/><line class="bb-rail-m" x1="45" y1="408" x2="595" y2="408"/>';
      s += '<path class="bb-holes" d="' + BB.d + '"/>';
      for (let col = 1; col <= 30; col += (col === 1 ? 4 : 5)) s += '<text class="bb-num" x="' + (40 + (col - 1) * 20) + '" y="92" text-anchor="middle">' + col + '</text>';
      'abcde'.split('').forEach((ch, i) => { s += '<text class="bb-num" x="22" y="' + (104 + i * 20) + '" text-anchor="middle">' + ch + '</text>'; });
      'fghij'.split('').forEach((ch, i) => { s += '<text class="bb-num" x="22" y="' + (244 + i * 20) + '" text-anchor="middle">' + ch + '</text>'; });
      return s;
    },
    elements: () => []
  });

  /* ======================= circuit model ======================= */
  let idCounter = 1;
  function uid(prefix) { return prefix + (idCounter++); }
  function resetIds(circuit) {
    let max = 0;
    for (const p of circuit.parts) max = Math.max(max, parseInt(String(p.id).replace(/\D/g, ''), 10) || 0);
    for (const w of circuit.wires) max = Math.max(max, parseInt(String(w.id).replace(/\D/g, ''), 10) || 0);
    idCounter = max + 1;
  }
  function newCircuit() { return { parts: [], wires: [] }; }
  function addPart(circuit, type, x, y, rot, props) {
    const d = PARTS[type];
    const comp = { id: uid('p'), type, x, y, rot: rot || 0, props: Object.assign({}, d.defaults, props || {}) };
    comp.rt = {};
    circuit.parts.push(comp);
    return comp;
  }
  function addWire(circuit, a, b) { const w = { id: uid('w'), a, b }; circuit.wires.push(w); return w; }
  function getTerms(comp) {
    const key = comp.x + ',' + comp.y + ',' + comp.rot;
    if (comp._tpk === key) return comp._tp;
    const d = PARTS[comp.type];
    comp._tp = d.terms.map(t => { const r = rotPt(t.x, t.y, comp.rot); return { name: t.n, x: comp.x + r[0], y: comp.y + r[1], group: t.g, hole: t.hole, label: t.label }; });
    comp._tpk = key;
    return comp._tp;
  }
  function termPos(circuit, ref) {
    const comp = circuit.parts.find(p => p.id === ref.p);
    if (!comp) return null;
    const t = getTerms(comp).find(q => q.name === ref.t);
    return t ? { x: t.x, y: t.y } : null;
  }
  function cleanWires(circuit) {
    const ids = new Set(circuit.parts.map(p => p.id));
    circuit.wires = circuit.wires.filter(w => ids.has(w.a.p) && ids.has(w.b.p) && termPos(circuit, w.a) && termPos(circuit, w.b));
  }
  function serialize(circuit) {
    return { parts: circuit.parts.map(p => ({ id: p.id, type: p.type, x: p.x, y: p.y, rot: p.rot, props: p.props })), wires: circuit.wires.map(w => ({ id: w.id, a: w.a, b: w.b, m: w.m, color: w.color })) };
  }
  function deserialize(data) {
    const c = newCircuit();
    for (const p of (data.parts || [])) if (PARTS[p.type]) c.parts.push({ id: p.id, type: p.type, x: p.x, y: p.y, rot: p.rot || 0, props: Object.assign({}, PARTS[p.type].defaults, p.props || {}), rt: {} });
    c.wires = (data.wires || []).map(w => ({ id: w.id, a: w.a, b: w.b, m: w.m, color: w.color }));
    resetIds(c); cleanWires(c);
    return c;
  }

  /* ======================= netlist ======================= */
  function buildNetlist(circuit) {
    const uf = new Map();
    const find = k => {
      if (!uf.has(k)) uf.set(k, k);
      let r = k; while (uf.get(r) !== r) r = uf.get(r);
      let c = k; while (uf.get(c) !== r) { const nx = uf.get(c); uf.set(c, r); c = nx; }
      return r;
    };
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) uf.set(ra, rb); };
    const key = (p, t) => p + ':' + t;
    const posMap = new Map(), grpMap = new Map();
    for (const comp of circuit.parts) {
      for (const t of getTerms(comp)) {
        const k = key(comp.id, t.name); find(k);
        const pk = Math.round(t.x) + ',' + Math.round(t.y);
        if (posMap.has(pk)) union(posMap.get(pk), k); else posMap.set(pk, k);
        if (t.group) { const gk = comp.id + '|' + t.group; if (grpMap.has(gk)) union(grpMap.get(gk), k); else grpMap.set(gk, k); }
      }
    }
    for (const w of circuit.wires) union(key(w.a.p, w.a.t), key(w.b.p, w.b.t));

    const GND = '__gnd__'; find(GND);
    let hasGround = false;
    for (const comp of circuit.parts) {
      const d = PARTS[comp.type];
      if (d.ground) { hasGround = true; for (const t of d.ground) union(key(comp.id, t), GND); }
    }
    let autoGround = false;
    if (!hasGround) {
      const bat = circuit.parts.find(p => p.type === 'battery') || circuit.parts.find(p => p.type === 'acsource');
      if (bat) { union(key(bat.id, '-'), GND); autoGround = true; }
    }
    const nodeIdx = new Map(); let next = 1;
    const gndRoot = find(GND);
    const N = comp => {
      const f = name => {
        const r = find(key(comp.id, name));
        if (r === gndRoot) return 0;
        if (!nodeIdx.has(r)) nodeIdx.set(r, next++);
        return nodeIdx.get(r);
      };
      f.alloc = () => next++;                      // private internal node (e.g. a built-in series resistor)
      return f;
    };
    const elements = [], compEls = new Map(), ctx = { ard: null };
    for (const comp of circuit.parts) {
      const d = PARTS[comp.type];
      comp.rt = comp.rt || {};
      const els = d.elements(comp, N(comp), ctx) || [];
      for (const e of els) e.comp = comp.id;
      compEls.set(comp.id, els);
      elements.push(...els);
      if (d.sync) d.sync(comp, els);
    }
    const nodeOf = (p, t) => N({ id: p })(t);
    return { nodeCount: next, elements, compEls, ctx, autoGround, nodeOf, hasArduino: !!ctx.ard };
  }

  S21.Parts = { PARTS, ORDER, GRID, NS, LED_COLORS, acValue, gateFn, rotPt, parseEng, fmt, esc, resistorBands, def, lbl, diodeIs,
    newCircuit, addPart, addWire, getTerms, termPos, cleanWires, serialize, deserialize, resetIds, buildNetlist, uid };
  if (typeof module !== 'undefined' && module.exports) { module.exports = S21.Parts; require('./parts2.js'); require('./parts3.js'); }
})(typeof window !== 'undefined' ? window : globalThis);
