/* ---------------------------------------------------------------
   Smart21 ElectroLab — schematic view: standard circuit symbols for the common parts
   The symbols use the same terminal positions as the realistic drawings, so wires never move.
   Parts without a symbol (boards, displays, big ICs) keep their normal drawing.
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const P = S21.Parts;
  if (!P || !P.PARTS) return;
  const f = n => +n.toFixed(2);
  const zig = (x0, x1) => { const pts = [[x0, 0]]; const n = 6, w = (x1 - x0) / n; for (let i = 0; i < n; i++) pts.push([x0 + w * (i + 0.5), i % 2 ? 8 : -8]); pts.push([x1, 0]); return 'M-40,0 H' + x0 + ' L' + pts.map(p => f(p[0]) + ',' + p[1]).join(' L') + ' H40'; };
  const arrow = (x, y, ang, s) => '<polygon class="sch-f" points="0,0 ' + (-(s || 6)) + ',-3 ' + (-(s || 6)) + ',3" transform="translate(' + x + ',' + y + ') rotate(' + ang + ')"/>';
  const circle = (r, cx, cy) => '<circle cx="' + (cx || 0) + '" cy="' + (cy || 0) + '" r="' + r + '"/>';
  const T = (txt, x, y, anchor) => '<text class="sch-t" x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'middle') + '">' + txt + '</text>';
  const diodeBody = '<path d="M-20,0 H-8 M8,0 H20"/><polygon points="-8,-10 8,0 -8,10"/>';
  const lightArrows = (dir) => (dir > 0 ? '<path d="M-2,-14 l8,-8 M4,-10 l8,-8"/>' + arrow(6, -22, -45, 5) + arrow(12, -18, -45, 5) : '<path d="M8,-22 l-8,8 M14,-18 l-8,8"/>');
  const gateShape = {
    and: '<path d="M-24,-24 H-2 a24,24 0 0 1 0,48 H-24 Z"/>',
    nand: '<path d="M-24,-24 H-4 a24,24 0 0 1 0,48 H-24 Z"/>' + circle(3.5, 24, 0),
    or: '<path d="M-24,-24 Q2,-24 22,0 Q2,24 -24,24 Q-12,0 -24,-24 Z"/>',
    nor: '<path d="M-24,-24 Q0,-24 18,0 Q0,24 -24,24 Q-12,0 -24,-24 Z"/>' + circle(3.5, 21.5, 0),
    xor: '<path d="M-20,-24 Q4,-24 22,0 Q4,24 -20,24 Q-8,0 -20,-24 Z"/><path d="M-26,-24 Q-14,0 -26,24"/>',
    not: '<polygon points="-22,-16 14,0 -22,16"/>' + circle(3.5, 17.5, 0)
  };
  const SYM = {
    resistor: () => '<path d="' + zig(-26, 26) + '"/>',
    pot: () => '<path d="' + zig(-26, 26) + '"/><path d="M0,40 V10"/>' + arrow(0, 9, -90, 6),
    ldr: () => '<path d="' + zig(-26, 26) + '"/>' + circle(18) + '<path d="M-26,-24 l9,9 M-19,-27 l9,9"/>' + arrow(-17, -15, 45, 5) + arrow(-10, -18, 45, 5),
    ntc: () => '<path d="' + zig(-26, 26) + '"/><path d="M-22,14 L22,-14"/>' + T('t°', 0, 22),
    inductor: () => '<path d="M-40,0 H-24 a6,6 0 0 1 12,0 a6,6 0 0 1 12,0 a6,6 0 0 1 12,0 a6,6 0 0 1 12,0 H40"/>',
    capacitor: () => '<path d="M-20,0 H-4 M-4,-12 V12 M4,-12 V12 M4,0 H20"/>',
    led: () => diodeBody + '<path d="M8,-10 V10"/>' + lightArrows(1),
    diode: () => diodeBody + '<path d="M8,-10 V10"/>',
    schottky: () => diodeBody + '<path d="M12,-14 L8,-10 V10 L4,14"/>',
    zener: () => diodeBody + '<path d="M12,-12 L8,-10 V10 L4,12"/>',
    battery: () => '<path d="M0,-40 V-6 M-11,-6 H11 M0,6 V40"/><path d="M-6,6 H6" style="stroke-width:4"/>' + T('+', 14, -10, 'start'),
    acsource: () => '<path d="M0,-40 V-15 M0,15 V40"/>' + circle(15) + '<path d="M-9,0 q4.5,-9 9,0 t9,0"/>',
    vcc: c => '<path d="M0,0 V-12 M-9,-12 H9"/>' + T(String(P.fmt ? P.fmt(c.props.volts, 'V') : ''), 0, -17),
    ground: () => '<path d="M0,0 V8 M-11,8 H11 M-7,13 H7 M-3,18 H3"/>',
    npn: () => '<path d="M-20,0 H-4 M-4,-14 V14 M-4,-6 L20,-20 M-4,6 L20,20"/>' + arrow(18, 19, 40, 7) + circle(23, 4, 0).replace('<circle', '<circle class="sch-thin"'),
    pnp: () => '<path d="M-20,0 H-4 M-4,-14 V14 M-4,-6 L20,-20 M-4,6 L20,20"/>' + arrow(2, 3, 220, 7) + circle(23, 4, 0).replace('<circle', '<circle class="sch-thin"'),
    mosfet: () => '<path d="M-20,0 H-8 M-8,-12 V12 M-2,-14 V-6 M-2,-3 V3 M-2,6 V14 M-2,-10 H20 V-20 M-2,10 H20 V20 M-2,0 H8 V10"/>' + arrow(-1, 0, 180, 6),
    switch: c => '<path d="M-40,0 H-18 M18,0 H40"/>' + circle(2.5, -18, 0) + circle(2.5, 18, 0) + (c.props.closed ? '<path d="M-18,0 L18,0"/>' : '<path d="M-18,0 L16,-15"/>'),
    button: c => '<path d="M-40,0 H-14 M14,0 H40"/>' + circle(2.5, -14, 0) + circle(2.5, 14, 0) + '<path d="M-14,' + (c.rt && c.rt.pressed ? -1 : -9) + ' H14 M0,' + (c.rt && c.rt.pressed ? -1 : -9) + ' V-20 M-6,-20 H6"/>',
    buzzer: () => '<path d="M-20,0 H-14 M14,0 H20"/>' + circle(14) + T('BZ', 0, 4) + T('+', -9, -6),
    motor: () => '<path d="M-40,0 H-16 M16,0 H40"/>' + circle(16) + T('M', 0, 5),
    voltmeter: () => '<path d="M-40,0 H-16 M16,0 H40"/>' + circle(16) + T('V', 0, 5),
    ammeter: () => '<path d="M-40,0 H-16 M16,0 H40"/>' + circle(16) + T('A', 0, 5),
    lamp: () => '<path d="M-40,0 H-16 M16,0 H40"/>' + circle(16) + '<path d="M-11,-11 L11,11 M11,-11 L-11,11"/>',
    fuse: () => '<path d="M-40,0 H-24 M24,0 H40"/><rect x="-24" y="-7" width="48" height="14"/><path d="M-24,0 H24"/>',
    scr: () => '<path d="M0,-40 V-10 M0,10 V40"/><polygon points="-10,-10 10,-10 0,10"/><path d="M-11,10 H11 M-30,20 H-14 L0,10"/>',
    opamp: () => '<polygon points="-28,-32 -28,32 30,0"/><path d="M-40,-20 H-28 M-40,20 H-28 M30,0 H40 M0,-40 V-16.5 M0,40 V16.5"/>' + T('+', -22, -16, 'start') + T('−', -22, 24, 'start'),
    gate: c => {
      const t = (c.props && c.props.type) || 'and', key = gateShape[t] ? t : 'and', out = (key === 'nand' || key === 'nor' || key === 'not') ? 28 : 22;
      const inputs = key === 'not' ? '<path d="M-40,-20 H-30 V0 H-22"/>' : '<path d="M-40,-20 H-24 M-40,20 H-24"/>';
      return gateShape[key] + inputs + '<path d="M' + out + ',0 H40"/>';
    },
    transformer: () => '<path d="M-40,-20 H-14 M-40,20 H-14 M40,-20 H14 M40,20 H14"/><path d="M-14,-20 a5,5 0 0 1 0,10 a5,5 0 0 1 0,10 a5,5 0 0 1 0,10 a5,5 0 0 1 0,10"/><path d="M14,-20 a5,5 0 0 0 0,10 a5,5 0 0 0 0,10 a5,5 0 0 0 0,10 a5,5 0 0 0 0,10"/><path d="M-3,-22 V22 M3,-22 V22"/>' + circle(1.8, -22, -26).replace('<circle', '<circle class="sch-dotf"') + circle(1.8, 22, -26).replace('<circle', '<circle class="sch-dotf"'),
    relay: () => '<path d="M-40,-20 H-20 V-14 M-40,20 H-20 V14"/><rect x="-28" y="-14" width="16" height="28"/><path class="sch-dash" d="M-12,0 H14"/>' +
      '<path d="M40,0 H30 L36,16"/>' + circle(2.2, 40, -20) + circle(2.2, 40, 20) + '<path d="M40,-20 H40 M40,20 H40"/>'
  };
  P.SCHEM = SYM; P.schematic = false;
  const rotUp = (c, inner) => '<g transform="rotate(' + (-(c.rot || 0)) + ')">' + inner + '</g>';
  // → { svg, sch } : the drawing for a part in the current view
  P.partSvg = function (c, circuit) {
    const d = P.PARTS[c.type];
    if (!P.schematic || !SYM[c.type]) return { svg: d.svg(c), sch: false };
    let ref = ''; try { ref = S21.Analysis && S21.Analysis.refName ? S21.Analysis.refName(circuit, c) : ''; } catch (_) {}
    const val = d.label ? String(d.label(c) || '') : '';
    const noText = c.type === 'ground';
    const text = noText ? '' : rotUp(c, '<text class="sch-ref" x="0" y="-26" text-anchor="middle">' + ref + (val ? ' ' + val : '') + '</text>');
    return { svg: '<g class="sch">' + SYM[c.type](c) + '</g>' + text, sch: true };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SYM;
})(typeof window !== 'undefined' ? window : globalThis);
