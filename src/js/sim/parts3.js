/* ---------------------------------------------------------------
   Smart21 ElectroLab — parts, round 3
   Power & drivers: 78xx regulator, LM317, ULN2003, L293D, optocoupler.
   Digital ICs: quad gates (74HC00/08/32/86/02), hex inverter (74HC04/14),
     74HC74, CD4017, 74HC161, CD4511, 74HC138, 74HC4051.
   Devices: Schottky diode, fuse, lamp, LED bar graph, 8×8 LED matrix,
     stepper motor, PIR, LM35, joystick, 4×4 keypad, DIP switch.
   Loaded after parts2.js (it registers itself in S21.Parts).
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const P = S21.Parts;
  if (!P || !P.def) return;
  const { def, lbl, fmt, diodeIs, PARTS, LED_COLORS } = P;
  if (PARTS.schottky) return;                    // already registered
  const ON = '#2fe27a', OFF = '#31403a';

  /* ======================= DIP chip layout helpers ======================= */
  // pins: [{ n, num, side:'L'|'R', s (short text), t (tooltip) }]; left pins run top→bottom 1…N/2, right pins bottom→top.
  function dipLayout(pins) {
    const L = pins.filter(p => p.side === 'L').sort((a, b) => a.num - b.num), R = pins.filter(p => p.side === 'R').sort((a, b) => b.num - a.num);
    const n = Math.max(L.length, R.length), y0 = -(n - 1) * 10, terms = [], pos = {};
    L.forEach((p, i) => { const y = y0 + i * 20; terms.push({ n: p.n, x: -40, y, label: p.num + ' ' + (p.t || p.s || p.n), group: p.group }); pos[p.n] = { x: -40, y, side: -1, p }; });
    R.forEach((p, i) => { const y = y0 + i * 20; terms.push({ n: p.n, x: 40, y, label: p.num + ' ' + (p.t || p.s || p.n), group: p.group }); pos[p.n] = { x: 40, y, side: 1, p }; });
    terms.forEach(t => { if (!t.group) delete t.group; });
    return { terms, pos, y0, n, top: y0 - 12, h: (n - 1) * 20 + 24 };
  }
  function dipSvg(lay, title, sub, outs, ledRefs) {
    let s = '<rect class="ic-body" x="-30" y="' + lay.top + '" width="60" height="' + lay.h + '" rx="4"/><path class="ic-notch" d="M-8,' + lay.top + ' A8,8 0 0 0 8,' + lay.top + '"/>';
    const cy = lay.top + lay.h / 2 - ((title.length + (sub ? 1 : 0)) * 8) + 8;
    title.forEach((t, i) => { s += '<text class="ic-t" x="0" y="' + (cy + i * 15) + '" text-anchor="middle">' + t + '</text>'; });
    if (sub) s += '<text class="ic-t2" x="0" y="' + (cy + title.length * 15) + '" text-anchor="middle">' + sub + '</text>';
    for (const k of Object.keys(lay.pos)) {
      const q = lay.pos[k], left = q.side < 0;
      s += '<line class="lead" x1="' + q.x + '" y1="' + q.y + '" x2="' + (left ? -30 : 30) + '" y2="' + q.y + '"/><text class="ic-pin" x="' + (left ? -26 : 26) + '" y="' + (q.y + 3) + '" text-anchor="' + (left ? 'start' : 'end') + '">' + (q.p.s || k) + '</text>';
      if (ledRefs && outs && outs.indexOf(k) >= 0) s += '<circle data-ref="o_' + k + '" class="ic-led" cx="' + (left ? -35 : 35) + '" cy="' + (q.y - 4) + '" r="2.6"/>';
    }
    return s;
  }
  const boundsOf = lay => [-50, lay.top - 8, 100, lay.h + 16];

  /* ======================= generic clocked / logic IC builder ======================= */
  // spec: { id, name, cat, desc, pins, title(c)|[..], sub, vcc, gnd, minV, inputs:[names], outs:[names], rs,
  //         init(c) -> state, event(c, st, sig, lvl, prev, x), comb(c, st, x) -> {pin: 0|1|null}, live(c) -> rows }
  //   x = { lv (logic levels), volt(sig) (volts above GND), vcc }
  function mkIC(s) {
    const lay = dipLayout(s.pins), VCC = s.vcc || 'VCC', GND = s.gnd || 'GND';
    const d = {
      name: s.name, cat: s.cat || 'Digital ICs', bounds: boundsOf(lay), defaults: s.defaults || {}, props: s.props || [], desc: s.desc, terms: lay.terms, required: [VCC, GND],
      label: () => '',
      svg: c => dipSvg(lay, typeof s.title === 'function' ? s.title(c) : s.title, s.sub, s.outs, true),
      elements: (c, N) => {
        c.rt.n = {}; for (const t of lay.terms) c.rt.n[t.n] = N(t.n);
        c.rt.st = null; c.rt.lv = null;
        return s.outs.map(k => ({ type: 'V', a: c.rt.n[k], b: c.rt.n[GND], v: 0, rs: s.rs || 60, en: false }));
      },
      tick: (c, els, t, rtm) => {
        const r = c.rt, n = r.n; if (!n) return;
        const v = rtm.sim.v, g = v[n[GND]] || 0, vcc = (v[n[VCC]] || 0) - g, th = vcc / 2;
        if (vcc < (s.minV || 2.5)) { r.powered = false; r.st = null; r.lv = null; r.out = {}; for (const e of els) e.en = false; return; }
        const x = { vcc, volt: sig => (v[n[sig]] || 0) - g, lv: null };
        if (!r.st) {
          r.st = s.init ? s.init(c) : {}; r.lv = {}; for (const sig of s.inputs) r.lv[sig] = x.volt(sig) > th ? 1 : 0;
        }
        r.powered = true; x.lv = r.lv;
        const ev = [];
        for (const sig of s.inputs) {
          const tr = rtm.transFor ? rtm.transFor(n[sig]) : null;
          if (tr && tr.length) for (const q of tr) ev.push({ t: q.t, sig, lvl: q.level });
          else { const lvl = x.volt(sig) > th ? 1 : 0; if (lvl !== r.lv[sig]) ev.push({ t: Infinity, sig, lvl }); }
        }
        ev.sort((a, b) => a.t - b.t);
        for (const q of ev) { const prev = r.lv[q.sig]; r.lv[q.sig] = q.lvl; if (s.event) s.event(c, r.st, q.sig, q.lvl, prev, x); }
        const out = s.comb(c, r.st, x) || {}; r.out = out;
        s.outs.forEach((k, i) => { const o = out[k]; if (o === null || o === undefined) els[i].en = false; else { els[i].en = true; els[i].v = (s.analog && s.analog.indexOf(k) >= 0) ? o : (o ? vcc : 0); } });
      },
      update: (c, refs) => { for (const k of s.outs) if (refs['o_' + k]) refs['o_' + k].setAttribute('fill', c.rt.powered && c.rt.out && c.rt.out[k] ? ON : OFF); },
      read: (c, els) => { c.rt.i = els[0] ? els[0].i : 0; c.rt.v = els[0] ? els[0].vd : 0; },
      check: (c, els, rtm) => { s.outs.forEach((k, i) => { if (els[i].en && Math.abs(els[i].i) > (s.imax || 0.035)) rtm.alert('icl' + c.id + k, s.name.split(' ')[0] + ' output ' + k + ' is supplying ' + (Math.abs(els[i].i) * 1000).toFixed(0) + ' mA. The limit is about ' + ((s.imax || 0.035) * 1000).toFixed(0) + ' mA per output: use a bigger resistor or a transistor.', 'warn'); }); },
      live: c => { const r = c.rt, rows = [['Powered', r.powered ? 'yes' : 'NO: needs ' + VCC + ' and ' + GND]]; if (r.powered && s.live) rows.push(...s.live(c)); return rows; }
    };
    def(s.id, d); PARTS[s.id].lay = lay; return d;
  }
  const bit = (lv, k) => lv[k] ? 1 : 0;

  /* ======================= Quad 2-input gates ======================= */
  const QG_TYPES = { nand: ['00', 'NAND'], and: ['08', 'AND'], or: ['32', 'OR'], xor: ['86', 'XOR'] };
  function quadGate(id, name, types, pinout, defType) {
    const pins = [], outs = [], inputs = [];
    pinout.forEach((q, i) => { const side = i < 7 ? 'L' : 'R'; pins.push({ n: q[0], num: i + 1, side, s: q[0], t: q[1] }); if (/Y$/.test(q[0])) outs.push(q[0]); else if (!/^(GND|VCC)$/.test(q[0])) inputs.push(q[0]); });
    return mkIC({
      id, name, desc: 'Four 2-input gates in one 14-pin chip. Pick the chip in the inspector: ' + Object.keys(types).map(k => '74HC' + types[k][0] + ' = ' + types[k][1]).join(', ') + '. Each gate has inputs A, B and output Y. Inputs read HIGH above half the supply; unused inputs should be tied to GND or VCC (a floating input reads LOW here). Needs power on VCC and GND.',
      pins, inputs, outs, defaults: { type: defType }, props: [{ key: 'type', label: 'Chip', type: 'select', options: Object.keys(types).map(k => ({ v: k, l: '74HC' + types[k][0] + ' — quad ' + types[k][1] })) }],
      title: c => ['74HC', types[c.props.type] ? types[c.props.type][0] : types[defType][0]], sub: 'QUAD GATE',
      comb: (c, st, x) => { const o = {}, t = c.props.type; for (let k = 1; k <= 4; k++) o[k + 'Y'] = P.gateFn(t, bit(x.lv, k + 'A'), bit(x.lv, k + 'B')); return o; },
      live: c => [['Gate 1', 'Y = ' + (c.rt.out['1Y'] ? 'HIGH' : 'low')], ['Gate 2', 'Y = ' + (c.rt.out['2Y'] ? 'HIGH' : 'low')], ['Gate 3', 'Y = ' + (c.rt.out['3Y'] ? 'HIGH' : 'low')], ['Gate 4', 'Y = ' + (c.rt.out['4Y'] ? 'HIGH' : 'low')]]
    });
  }
  quadGate('quadgate', '74HC00 / 08 / 32 / 86 quad gate', QG_TYPES,
    [['1A', '1A'], ['1B', '1B'], ['1Y', '1Y output'], ['2A', '2A'], ['2B', '2B'], ['2Y', '2Y output'], ['GND', 'GND'], ['3Y', '3Y output'], ['3A', '3A'], ['3B', '3B'], ['4Y', '4Y output'], ['4A', '4A'], ['4B', '4B'], ['VCC', 'VCC']], 'nand');
  quadGate('quadnor', '74HC02 quad NOR', { nor: ['02', 'NOR'] },
    [['1Y', '1Y output'], ['1A', '1A'], ['1B', '1B'], ['2Y', '2Y output'], ['2A', '2A'], ['2B', '2B'], ['GND', 'GND'], ['3A', '3A'], ['3B', '3B'], ['3Y', '3Y output'], ['4A', '4A'], ['4B', '4B'], ['4Y', '4Y output'], ['VCC', 'VCC']], 'nor');
  PARTS.quadnor.props = [];                       // a single chip: nothing to choose

  /* ======================= Hex inverter 74HC04 / 74HC14 ======================= */
  {
    const pin = [['1A', 'L'], ['1Y', 'L'], ['2A', 'L'], ['2Y', 'L'], ['3A', 'L'], ['3Y', 'L'], ['GND', 'L'], ['4Y', 'R'], ['4A', 'R'], ['5Y', 'R'], ['5A', 'R'], ['6Y', 'R'], ['6A', 'R'], ['VCC', 'R']];
    const pins = pin.map((q, i) => ({ n: q[0], num: i + 1, side: q[1], s: q[0], t: q[0] + (/Y$/.test(q[0]) ? ' output' : '') }));
    mkIC({
      id: 'hexinv', name: '74HC04 / 74HC14 hex inverter',
      desc: 'Six NOT gates. The 74HC04 flips at half the supply. The 74HC14 has Schmitt-trigger inputs: it switches HIGH→LOW at about 65% of VCC and LOW→HIGH at about 35%, so slow or noisy signals give a clean output. Add one resistor and one capacitor to a 74HC14 and you have an oscillator. Unused inputs should be tied to GND or VCC.',
      pins, inputs: ['1A', '2A', '3A', '4A', '5A', '6A'], outs: ['1Y', '2Y', '3Y', '4Y', '5Y', '6Y'],
      defaults: { type: 'hc04' }, props: [{ key: 'type', label: 'Chip', type: 'select', options: [{ v: 'hc04', l: '74HC04 — normal inputs' }, { v: 'hc14', l: '74HC14 — Schmitt-trigger inputs' }] }],
      title: c => ['74HC', c.props.type === 'hc14' ? '14' : '04'], sub: 'HEX NOT',
      init: () => ({ a: [0, 0, 0, 0, 0, 0] }),
      comb: (c, st, x) => {
        const o = {};
        for (let k = 1; k <= 6; k++) {
          const vin = x.volt(k + 'A');
          if (c.props.type === 'hc14') { if (vin > 0.65 * x.vcc) st.a[k - 1] = 1; else if (vin < 0.35 * x.vcc) st.a[k - 1] = 0; }
          else st.a[k - 1] = vin > x.vcc / 2 ? 1 : 0;
          o[k + 'Y'] = st.a[k - 1] ? 0 : 1;
        }
        return o;
      },
      live: c => [['Outputs 1–6', [1, 2, 3, 4, 5, 6].map(k => (c.rt.out[k + 'Y'] ? 'H' : 'L')).join(' ')]]
    });
  }

  /* ======================= 74HC74 dual D flip-flop ======================= */
  mkIC({
    id: 'dff74', name: '74HC74 dual D flip-flop',
    desc: 'Two flip-flops that remember one bit each. On the RISING edge of CLK the output Q copies the D input. /PRE (active LOW) forces Q = 1 and /CLR (active LOW) forces Q = 0 at any time: tie them to VCC when you do not use them, or the flip-flop is held in its reset state. Wire /Q back to D and the flip-flop divides the clock frequency by 2.',
    pins: [['CLR1', 1, 'L', '/CLR', '/1CLR (active LOW, tie to VCC)'], ['D1', 2, 'L', '1D', '1D data'], ['CK1', 3, 'L', '1CLK', '1CLK clock (rising edge)'], ['PRE1', 4, 'L', '/PRE', '/1PRE (active LOW, tie to VCC)'], ['Q1', 5, 'L', '1Q', '1Q output'], ['QN1', 6, 'L', '/1Q', '/1Q inverted output'], ['GND', 7, 'L', 'GND', 'GND'],
      ['QN2', 8, 'R', '/2Q', '/2Q inverted output'], ['Q2', 9, 'R', '2Q', '2Q output'], ['PRE2', 10, 'R', '/PRE', '/2PRE (active LOW, tie to VCC)'], ['CK2', 11, 'R', '2CLK', '2CLK clock (rising edge)'], ['D2', 12, 'R', '2D', '2D data'], ['CLR2', 13, 'R', '/CLR', '/2CLR (active LOW, tie to VCC)'], ['VCC', 14, 'R', 'VCC', 'VCC']]
      .map(q => ({ n: q[0], num: q[1], side: q[2], s: q[3], t: q[4] })),
    title: ['74HC', '74'], sub: 'D FLIP-FLOP', inputs: ['CLR1', 'D1', 'CK1', 'PRE1', 'CLR2', 'D2', 'CK2', 'PRE2'], outs: ['Q1', 'QN1', 'Q2', 'QN2'],
    init: () => ({ q: [0, 0] }),
    event: (c, st, sig, lvl, prev, x) => { const m = /^CK([12])$/.exec(sig); if (!m || !lvl || prev) return; const k = +m[1]; if (x.lv['CLR' + k] && x.lv['PRE' + k]) st.q[k - 1] = x.lv['D' + k] ? 1 : 0; },
    comb: (c, st, x) => {
      const o = {};
      for (let k = 1; k <= 2; k++) {
        const clr = x.lv['CLR' + k], pre = x.lv['PRE' + k];
        if (!clr && !pre) { o['Q' + k] = 1; o['QN' + k] = 1; continue; }
        if (!clr) st.q[k - 1] = 0; else if (!pre) st.q[k - 1] = 1;
        o['Q' + k] = st.q[k - 1]; o['QN' + k] = st.q[k - 1] ? 0 : 1;
      }
      return o;
    },
    live: c => { const rows = [['1Q / 2Q', (c.rt.out.Q1 ? 'HIGH' : 'low') + ' / ' + (c.rt.out.Q2 ? 'HIGH' : 'low')]]; const l = c.rt.lv || {}; if (!l.CLR1 || !l.PRE1 || !l.CLR2 || !l.PRE2) rows.push(['Tip', '/CLR or /PRE reads LOW: tie unused ones to VCC']); return rows; }
  });

  /* ======================= CD4017 decade counter ======================= */
  mkIC({
    id: 'cd4017', name: 'CD4017 decade counter', cat: 'Digital ICs', rs: 150, imax: 0.01, minV: 3,
    desc: 'A counter with 10 outputs: only ONE of Q0–Q9 is HIGH at a time, and it moves to the next output on every rising edge of CLK. RESET (HIGH) jumps back to Q0. INH (HIGH) freezes the count: tie it to GND. CO is HIGH for counts 0–4 and LOW for 5–9 (a clock ÷10). Pair it with a 555 for a running-light chaser! Outputs drive about 10 mA: use a resistor with every LED. Works from 3–15 V.',
    pins: [['Q5', 1, 'L', 'Q5'], ['Q1', 2, 'L', 'Q1'], ['Q0', 3, 'L', 'Q0'], ['Q2', 4, 'L', 'Q2'], ['Q6', 5, 'L', 'Q6'], ['Q7', 6, 'L', 'Q7'], ['Q3', 7, 'L', 'Q3'], ['GND', 8, 'L', 'GND'],
      ['Q8', 9, 'R', 'Q8'], ['Q4', 10, 'R', 'Q4'], ['Q9', 11, 'R', 'Q9'], ['CO', 12, 'R', 'CO', 'CARRY OUT (HIGH for counts 0–4)'], ['INH', 13, 'R', 'INH', 'CLOCK INHIBIT (HIGH = stop; tie to GND)'], ['CLK', 14, 'R', 'CLK', 'CLOCK (rising edge)'], ['RST', 15, 'R', 'RST', 'RESET (HIGH = back to Q0)'], ['VCC', 16, 'R', 'VDD', 'VDD (3–15 V)']]
      .map(q => ({ n: q[0], num: q[1], side: q[2], s: q[3], t: q[4] })),
    title: ['CD', '4017'], sub: 'DECADE CTR', inputs: ['CLK', 'INH', 'RST'], outs: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'CO'],
    init: () => ({ n: 0 }),
    event: (c, st, sig, lvl, prev, x) => { if (sig === 'CLK' && lvl && !prev && !x.lv.INH && !x.lv.RST) st.n = (st.n + 1) % 10; if (sig === 'RST' && lvl) st.n = 0; },
    comb: (c, st, x) => { if (x.lv.RST) st.n = 0; const o = {}; for (let k = 0; k < 10; k++) o['Q' + k] = st.n === k ? 1 : 0; o.CO = st.n < 5 ? 1 : 0; return o; },
    live: c => [['Active output', 'Q' + c.rt.st.n], ['RESET', c.rt.lv.RST ? 'HIGH (held at Q0)' : 'low'], ['INH', c.rt.lv.INH ? 'HIGH (frozen)' : 'low']]
  });

  /* ======================= 74HC161 4-bit binary counter ======================= */
  mkIC({
    id: 'hc161', name: '74HC161 4-bit counter',
    desc: 'Counts 0–15 in binary on Q0–Q3 at every rising edge of CP. /MR (LOW) clears it to 0. /PE (LOW) loads P0–P3 on the next clock, so you can start from any number. Counting needs CEP and CET both HIGH: tie them, and /MR and /PE, to VCC when unused. TC goes HIGH when the count is 15 (use it to chain counters). Connect Q0–Q3 to the CD4511 and you get a decimal display driver, or to LEDs to see binary.',
    pins: [['MR', 1, 'L', '/MR', '/MR clear (active LOW, tie to VCC)'], ['CP', 2, 'L', 'CP', 'CP clock (rising edge)'], ['P0', 3, 'L', 'P0', 'P0 parallel data'], ['P1', 4, 'L', 'P1', 'P1 parallel data'], ['P2', 5, 'L', 'P2', 'P2 parallel data'], ['P3', 6, 'L', 'P3', 'P3 parallel data'], ['CEP', 7, 'L', 'CEP', 'CEP count enable (tie to VCC)'], ['GND', 8, 'L', 'GND', 'GND'],
      ['PE', 9, 'R', '/PE', '/PE parallel load (active LOW, tie to VCC)'], ['CET', 10, 'R', 'CET', 'CET count enable (tie to VCC)'], ['Q3', 11, 'R', 'Q3', 'Q3 (value 8)'], ['Q2', 12, 'R', 'Q2', 'Q2 (value 4)'], ['Q1', 13, 'R', 'Q1', 'Q1 (value 2)'], ['Q0', 14, 'R', 'Q0', 'Q0 (value 1)'], ['TC', 15, 'R', 'TC', 'TC terminal count (HIGH at 15)'], ['VCC', 16, 'R', 'VCC', 'VCC']]
      .map(q => ({ n: q[0], num: q[1], side: q[2], s: q[3], t: q[4] })),
    title: ['74HC', '161'], sub: '4-BIT COUNTER', inputs: ['MR', 'CP', 'P0', 'P1', 'P2', 'P3', 'CEP', 'PE', 'CET'], outs: ['Q0', 'Q1', 'Q2', 'Q3', 'TC'],
    init: () => ({ n: 0 }),
    event: (c, st, sig, lvl, prev, x) => {
      if (sig !== 'CP' || !lvl || prev || !x.lv.MR) return;
      if (!x.lv.PE) st.n = (x.lv.P0 ? 1 : 0) | (x.lv.P1 ? 2 : 0) | (x.lv.P2 ? 4 : 0) | (x.lv.P3 ? 8 : 0);
      else if (x.lv.CEP && x.lv.CET) st.n = (st.n + 1) & 15;
    },
    comb: (c, st, x) => { if (!x.lv.MR) st.n = 0; return { Q0: st.n & 1, Q1: (st.n >> 1) & 1, Q2: (st.n >> 2) & 1, Q3: (st.n >> 3) & 1, TC: x.lv.CET && st.n === 15 ? 1 : 0 }; },
    live: c => { const l = c.rt.lv, rows = [['Count', c.rt.st.n + '  (' + c.rt.st.n.toString(2).padStart(4, '0') + ')']]; if (!l.MR) rows.push(['/MR', 'LOW: held cleared. Tie to VCC!']); if (!l.CEP || !l.CET) rows.push(['CEP / CET', 'a LOW enable stops counting. Tie to VCC!']); if (!l.PE) rows.push(['/PE', 'LOW: loads P0–P3 on every clock. Tie to VCC!']); return rows; }
  });

  /* ======================= CD4511 BCD → 7-segment decoder ======================= */
  const SEG_BCD = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
  mkIC({
    id: 'cd4511', name: 'CD4511 BCD to 7-segment decoder', rs: 80, imax: 0.025, minV: 3,
    desc: 'Turns a 4-bit number (A = 1, B = 2, C = 4, D = 8) into the segment pattern for a COMMON-CATHODE 7-segment display. Connect outputs a–g to the display segments (with resistors) and the display COM to GND. Numbers above 9 blank the display. /LT (LOW) lights every segment (lamp test), /BI (LOW) blanks the display, LE (HIGH) freezes the shown digit. Tie /LT and /BI to VDD and LE to GND for normal use. Works from 3–15 V.',
    pins: [['B', 1, 'L', 'B', 'B input (value 2)'], ['C', 2, 'L', 'C', 'C input (value 4)'], ['LT', 3, 'L', '/LT', '/LT lamp test (active LOW, tie to VDD)'], ['BI', 4, 'L', '/BI', '/BI blanking (active LOW, tie to VDD)'], ['LE', 5, 'L', 'LE', 'LE latch enable (HIGH freezes, tie to GND)'], ['D', 6, 'L', 'D', 'D input (value 8)'], ['A', 7, 'L', 'A', 'A input (value 1)'], ['GND', 8, 'L', 'GND', 'VSS (GND)'],
      ['e', 9, 'R', 'e', 'segment e'], ['d', 10, 'R', 'd', 'segment d'], ['c', 11, 'R', 'c', 'segment c'], ['b', 12, 'R', 'b', 'segment b'], ['a', 13, 'R', 'a', 'segment a'], ['g', 14, 'R', 'g', 'segment g'], ['f', 15, 'R', 'f', 'segment f'], ['VCC', 16, 'R', 'VDD', 'VDD (3–15 V)']]
      .map(q => ({ n: q[0], num: q[1], side: q[2], s: q[3], t: q[4] })),
    title: ['CD', '4511'], sub: 'BCD→7SEG', inputs: ['A', 'B', 'C', 'D', 'LT', 'BI', 'LE'], outs: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    init: () => ({ hold: 0 }),
    comb: (c, st, x) => {
      const val = (x.lv.A ? 1 : 0) | (x.lv.B ? 2 : 0) | (x.lv.C ? 4 : 0) | (x.lv.D ? 8 : 0);
      if (!x.lv.LE) st.hold = val;
      const o = {}, segs = !x.lv.LT ? 'abcdefg' : !x.lv.BI ? '' : (st.hold < 10 ? SEG_BCD[st.hold] : '');
      st.digit = !x.lv.LT ? '8 (lamp test)' : !x.lv.BI ? 'blank' : st.hold < 10 ? String(st.hold) : 'blank (>9)';
      for (const k of 'abcdefg') o[k] = segs.indexOf(k) >= 0 ? 1 : 0; return o;
    },
    live: c => { const l = c.rt.lv, rows = [['Shows', c.rt.st.digit || '–']]; if (!l.LT) rows.push(['/LT', 'LOW: lamp test (all on)']); if (!l.BI) rows.push(['/BI', 'LOW: display blanked. Tie to VDD!']); return rows; }
  });

  /* ======================= 74HC138 3-to-8 decoder ======================= */
  mkIC({
    id: 'hc138', name: '74HC138 3-to-8 decoder',
    desc: 'Three address inputs (A0 = 1, A1 = 2, A2 = 4) select ONE of eight outputs. The selected output goes LOW and all others stay HIGH (active-low outputs). The chip only works when /E1 and /E2 are LOW and E3 is HIGH: tie /E1 and /E2 to GND and E3 to VCC for always-on. Use it to choose one device out of many with only 3 Arduino pins.',
    pins: [['A0', 1, 'L', 'A0', 'A0 address bit (value 1)'], ['A1', 2, 'L', 'A1', 'A1 address bit (value 2)'], ['A2', 3, 'L', 'A2', 'A2 address bit (value 4)'], ['E1', 4, 'L', '/E1', '/E1 enable (active LOW, tie to GND)'], ['E2', 5, 'L', '/E2', '/E2 enable (active LOW, tie to GND)'], ['E3', 6, 'L', 'E3', 'E3 enable (active HIGH, tie to VCC)'], ['Y7', 7, 'L', '/Y7', '/Y7 output'], ['GND', 8, 'L', 'GND', 'GND'],
      ['Y6', 9, 'R', '/Y6', '/Y6 output'], ['Y5', 10, 'R', '/Y5', '/Y5 output'], ['Y4', 11, 'R', '/Y4', '/Y4 output'], ['Y3', 12, 'R', '/Y3', '/Y3 output'], ['Y2', 13, 'R', '/Y2', '/Y2 output'], ['Y1', 14, 'R', '/Y1', '/Y1 output'], ['Y0', 15, 'R', '/Y0', '/Y0 output'], ['VCC', 16, 'R', 'VCC', 'VCC']]
      .map(q => ({ n: q[0], num: q[1], side: q[2], s: q[3], t: q[4] })),
    title: ['74HC', '138'], sub: '3→8 DECODER', inputs: ['A0', 'A1', 'A2', 'E1', 'E2', 'E3'], outs: ['Y0', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7'],
    comb: (c, st, x) => {
      const en = !x.lv.E1 && !x.lv.E2 && x.lv.E3, a = (x.lv.A0 ? 1 : 0) | (x.lv.A1 ? 2 : 0) | (x.lv.A2 ? 4 : 0), o = {};
      st.sel = en ? a : -1; for (let k = 0; k < 8; k++) o['Y' + k] = en && a === k ? 0 : 1; return o;
    },
    live: c => [['Selected output', c.rt.st.sel < 0 ? 'none (chip disabled: check /E1, /E2 and E3)' : '/Y' + c.rt.st.sel + ' is LOW']]
  });

  /* ======================= 74HC4051 analog multiplexer ======================= */
  {
    const pins = [['Y4', 1, 'L'], ['Y6', 2, 'L'], ['Z', 3, 'L', 'COM', 'COM (common in/out)'], ['Y7', 4, 'L'], ['Y5', 5, 'L'], ['E', 6, 'L', '/E', '/E enable (active LOW, tie to GND)'], ['VEE', 7, 'L', 'VEE', 'VEE (tie to GND)'], ['GND', 8, 'L'],
      ['S2', 9, 'R', 'S2', 'S2 select (value 4)'], ['S1', 10, 'R', 'S1', 'S1 select (value 2)'], ['S0', 11, 'R', 'S0', 'S0 select (value 1)'], ['Y3', 12, 'R'], ['Y0', 13, 'R'], ['Y1', 14, 'R'], ['Y2', 15, 'R'], ['VCC', 16, 'R']]
      .map(q => ({ n: q[0], num: q[1], side: q[2], s: q[3] || q[0], t: q[4] || (/^Y/.test(q[0]) ? q[0] + ' channel' : q[0]) }));
    const lay = dipLayout(pins), chans = [0, 1, 2, 3, 4, 5, 6, 7];
    def('hc4051', {
      name: '74HC4051 analog multiplexer', cat: 'Analog ICs', bounds: boundsOf(lay), defaults: {}, required: ['VCC', 'GND', 'Z'],
      desc: 'An 8-way analog switch: S0–S2 (S0 = 1, S1 = 2, S2 = 4) choose which of the channels Y0–Y7 is connected to COM through about 80 Ω. Signals pass in BOTH directions and can be analog voltages: read 8 sensors with one Arduino analog pin, or send one signal to 8 places. Tie /E and VEE to GND; the signals must stay between GND and VCC.',
      terms: lay.terms, label: () => '',
      svg: c => dipSvg(lay, ['74HC', '4051'], '8:1 ANALOG MUX', [], false) + chans.map(k => '<circle data-ref="o_Y' + k + '" class="ic-led" cx="' + (lay.pos['Y' + k].side * 35) + '" cy="' + (lay.pos['Y' + k].y - 4) + '" r="2.6"/>').join(''),
      elements: (c, N) => { c.rt.n = {}; for (const t of lay.terms) c.rt.n[t.n] = N(t.n); return chans.map(k => ({ type: 'R', a: c.rt.n.Z, b: c.rt.n['Y' + k], r: 1e9 })); },
      tick: (c, els, t, rtm) => {
        const r = c.rt, n = r.n; if (!n) return; const v = rtm.sim.v, g = v[n.GND] || 0, vcc = (v[n.VCC] || 0) - g, th = vcc / 2;
        if (vcc < 2.5) { r.powered = false; r.sel = -1; for (const e of els) e.r = 1e9; return; }
        r.powered = true; const dis = (v[n.E] - g) > th; r.sel = dis ? -1 : (((v[n.S0] - g) > th ? 1 : 0) | (((v[n.S1] - g) > th ? 1 : 0) << 1) | (((v[n.S2] - g) > th ? 1 : 0) << 2));
        els.forEach((e, k) => { e.r = r.sel === k ? 80 : 1e9; });
      },
      update: (c, refs) => { for (let k = 0; k < 8; k++) if (refs['o_Y' + k]) refs['o_Y' + k].setAttribute('fill', c.rt.sel === k ? ON : OFF); },
      read: (c, els) => { c.rt.i = els[0].i; c.rt.v = els[0].vd; },
      live: c => [['Powered', c.rt.powered ? 'yes' : 'NO: needs VCC and GND'], ['COM connected to', c.rt.sel < 0 ? (c.rt.powered ? 'nothing (/E is HIGH: tie it to GND)' : '–') : 'Y' + c.rt.sel]]
    });
  }

  /* ======================= ULN2003 Darlington driver ======================= */
  {
    const pins = [].concat([1, 2, 3, 4, 5, 6, 7].map(k => ({ n: 'IN' + k, num: k, side: 'L', s: 'IN' + k, t: 'IN' + k + ' input (HIGH ≈ 2 V or more switches OUT' + k + ' on)' })), [{ n: 'GND', num: 8, side: 'L', s: 'GND', t: 'GND (emitters)' }, { n: 'COM', num: 9, side: 'R', s: 'COM', t: 'COM (flyback diodes: connect to the load supply +)' }],
      [7, 6, 5, 4, 3, 2, 1].map((k, i) => ({ n: 'OUT' + k, num: 10 + i, side: 'R', s: 'OUT' + k, t: 'OUT' + k + ' (open collector: sinks current to GND)' })));
    const lay = dipLayout(pins), CH = [1, 2, 3, 4, 5, 6, 7];
    def('uln2003', {
      name: 'ULN2003 driver (7 × 500 mA)', cat: 'Drivers & power ICs', bounds: boundsOf(lay), defaults: {}, required: ['GND'],
      desc: 'Seven Darlington transistors in one chip: a small signal on INx (about 2 V or more) switches OUTx to GND and lets up to 500 mA flow through your load (relays, stepper motors, lamps, motors). The load goes between the supply + and OUTx. Connect GND to ground, and COM to the load supply + so the built-in flyback diodes protect against inductive spikes. Its Arduino-friendly inputs need no resistors.',
      terms: lay.terms, label: () => '',
      svg: c => dipSvg(lay, ['ULN', '2003'], 'DRIVER', [], false) + CH.map(k => '<circle data-ref="o_' + k + '" class="ic-led" cx="35" cy="' + (lay.pos['OUT' + k].y - 4) + '" r="2.6"/>').join(''),
      elements: (c, N) => {
        c.rt.n = {}; for (const t of lay.terms) c.rt.n[t.n] = N(t.n); const n = c.rt.n, out = [];
        for (const k of CH) out.push({ type: 'R', a: n['OUT' + k], b: n.GND, r: 1e9 });
        for (const k of CH) out.push({ type: 'D', a: n['OUT' + k], b: n.COM, is: 1e-9, n: 1.75 });
        return out;
      },
      tick: (c, els, t, rtm) => {
        const r = c.rt, n = r.n; if (!n) return; const v = rtm.sim.v, g = v[n.GND] || 0; r.on = r.on || [];
        CH.forEach((k, i) => { const on = (v[n['IN' + k]] - g) > 2.0; r.on[i] = on; els[i].r = on ? 3.5 : 1e9; });
      },
      update: (c, refs) => { CH.forEach((k, i) => { if (refs['o_' + k]) refs['o_' + k].setAttribute('fill', c.rt.on && c.rt.on[i] ? ON : OFF); }); },
      read: (c, els) => { c.rt.ich = CH.map((k, i) => els[i].i); c.rt.i = els[0].i; c.rt.v = els[0].vd; },
      check: (c, els, rtm) => { CH.forEach((k, i) => { if (Math.abs(els[i].i) > 0.5) rtm.alert('uln' + c.id + k, 'ULN2003 output ' + k + ' carries ' + (Math.abs(els[i].i) * 1000).toFixed(0) + ' mA: the limit is 500 mA per channel.', 'warn'); }); },
      live: c => [['Channels ON', (c.rt.on || []).map((o, i) => (o ? i + 1 : '')).filter(Boolean).join(', ') || 'none'], ['Currents (mA)', (c.rt.ich || []).map(x => Math.abs(x * 1000).toFixed(0)).join(' ')]]
    });
  }

  /* ======================= L293D dual H-bridge motor driver ======================= */
  {
    const pins = [['EN12', 1, 'L', 'EN1,2', 'EN1,2 enable channels 1 & 2 (PWM here for speed)'], ['A1', 2, 'L', '1A', '1A input'], ['Y1', 3, 'L', '1Y', '1Y output (to motor)'], ['GND1', 4, 'L', 'GND', 'GND', 'g'], ['GND2', 5, 'L', 'GND', 'GND', 'g'], ['Y2', 6, 'L', '2Y', '2Y output (to motor)'], ['A2', 7, 'L', '2A', '2A input'], ['VS', 8, 'L', 'VS', 'VS motor supply (4.5–36 V)'],
      ['EN34', 9, 'R', 'EN3,4', 'EN3,4 enable channels 3 & 4'], ['A3', 10, 'R', '3A', '3A input'], ['Y3', 11, 'R', '3Y', '3Y output (to motor)'], ['GND3', 12, 'R', 'GND', 'GND', 'g'], ['GND4', 13, 'R', 'GND', 'GND', 'g'], ['Y4', 14, 'R', '4Y', '4Y output (to motor)'], ['A4', 15, 'R', '4A', '4A input'], ['VCC', 16, 'R', 'VCC', 'VCC1 logic supply (5 V)']]
      .map(q => ({ n: q[0], num: q[1], side: q[2], s: q[3], t: q[4], group: q[5] }));
    const lay = dipLayout(pins), CH = [1, 2, 3, 4];
    def('l293d', {
      name: 'L293D motor driver (H-bridge)', cat: 'Drivers & power ICs', bounds: boundsOf(lay), defaults: {}, required: ['VCC', 'VS', 'GND1'],
      desc: 'Two H-bridges: it drives TWO DC motors in both directions (up to 600 mA each). Put a motor between 1Y and 2Y: 1A HIGH + 2A LOW spins it one way, the opposite spins it the other way, both equal = brake. Use the EN pin with analogWrite() to change speed. VCC (5 V) powers the logic and VS powers the motors (up to 36 V). Outputs reach about VS − 1.4 V; internal diodes protect against motor spikes. All four GND pins are joined.',
      terms: lay.terms, label: () => '',
      svg: c => dipSvg(lay, ['L293D'], 'H-BRIDGE', [], false) + CH.map(k => '<circle data-ref="o_' + k + '" class="ic-led" cx="' + (lay.pos['Y' + k].side * 35) + '" cy="' + (lay.pos['Y' + k].y - 4) + '" r="2.6"/>').join(''),
      elements: (c, N) => {
        c.rt.n = {}; for (const t of lay.terms) c.rt.n[t.n] = N(t.n); const n = c.rt.n, out = [];
        for (const k of CH) out.push({ type: 'V', a: n['Y' + k], b: n.GND1, v: 0, rs: 1.5, en: false });
        for (const k of CH) out.push({ type: 'D', a: n['Y' + k], b: n.VS, is: 1e-9, n: 1.75 }, { type: 'D', a: n.GND1, b: n['Y' + k], is: 1e-9, n: 1.75 });
        return out;
      },
      tick: (c, els, t, rtm) => {
        const r = c.rt, n = r.n; if (!n) return; const v = rtm.sim.v, g = v[n.GND1] || 0, vcc = (v[n.VCC] || 0) - g, vs = (v[n.VS] || 0) - g;
        r.powered = vcc >= 4.0 && vs >= 4.5; r.drive = r.drive || [];
        CH.forEach((k, i) => {
          const en = (v[n[k <= 2 ? 'EN12' : 'EN34']] - g) > 2.3, a = (v[n['A' + k]] - g) > 2.3;
          r.drive[i] = r.powered && en ? (a ? 1 : 0) : -1;
          els[i].en = r.drive[i] >= 0; els[i].v = a ? Math.max(0, vs - 1.4) : 0.9;
        });
      },
      update: (c, refs) => { CH.forEach((k, i) => { if (refs['o_' + k]) refs['o_' + k].setAttribute('fill', c.rt.drive && c.rt.drive[i] === 1 ? ON : (c.rt.drive && c.rt.drive[i] === 0 ? '#f5b942' : OFF)); }); },
      read: (c, els) => { c.rt.i = els[0].i; c.rt.v = els[0].vd; },
      check: (c, els, rtm) => { CH.forEach((k, i) => { if (els[i].en && Math.abs(els[i].i) > 0.6) rtm.alert('l293' + c.id + k, 'L293D output ' + k + 'Y carries ' + (Math.abs(els[i].i) * 1000).toFixed(0) + ' mA: the limit is 600 mA per channel.', 'warn'); }); },
      live: c => [['Powered', c.rt.powered ? 'yes' : 'NO: VCC needs 5 V and VS 4.5 V or more'], ['Outputs 1Y…4Y', (c.rt.drive || []).map(d => (d < 0 ? 'off' : d ? 'HIGH' : 'LOW')).join(' / ')]]
    });
  }

  /* ======================= Optocoupler (PC817 / 4N35) ======================= */
  def('opto', {
    name: 'Optocoupler (PC817)', cat: 'Drivers & power ICs', bounds: [-50, -36, 100, 72], defaults: { ctr: 100 },
    desc: 'Passes a signal between two circuits with NO electrical connection: an LED inside shines on a phototransistor. Current through the LED (pins 1→2, needs a resistor!) lets the transistor conduct between COLLECTOR and EMITTER: the output current is about CTR × LED current. Use it to read mains-side or high-voltage signals safely, or to switch a load from a separate supply.',
    props: [{ key: 'ctr', label: 'Current transfer ratio', type: 'select', options: [{ v: 50, l: '50 % (4N35-like)' }, { v: 100, l: '100 % (typical PC817)' }, { v: 200, l: '200 % (PC817 grade C)' }, { v: 400, l: '400 % (high gain)' }] }],
    terms: [{ n: 'a', x: -40, y: -20, label: '1 anode (LED +)' }, { n: 'k', x: -40, y: 20, label: '2 cathode (LED −)' }, { n: 'c', x: 40, y: -20, label: '4 collector' }, { n: 'e', x: 40, y: 20, label: '3 emitter' }],
    label: () => '',
    svg: c => '<rect class="ic-body" x="-30" y="-36" width="60" height="72" rx="4"/><path class="ic-notch" d="M-8,-36 A8,8 0 0 0 8,-36"/>' +
      '<line class="lead" x1="-40" y1="-20" x2="-22" y2="-20"/><line class="lead" x1="-40" y1="20" x2="-22" y2="20"/><polyline class="lead" points="-22,-20 -22,-8" fill="none"/><polyline class="lead" points="-22,20 -22,8" fill="none"/>' +
      '<path class="dio-tri" d="M-30,-8 L-14,-8 L-22,6 Z"/><line class="lead thick" x1="-30" y1="6" x2="-14" y2="6"/>' +
      '<path d="M-6,-6 L4,-10 M-6,2 L4,-2" stroke="#f5b942" stroke-width="1.5" fill="none"/><circle data-ref="led" class="ic-led" cx="-6" cy="-14" r="3"/>' +
      '<line class="lead thick" x1="10" y1="-10" x2="10" y2="10"/><polyline class="lead" points="10,-5 22,-12 22,-20" fill="none"/><polyline class="lead" points="10,5 22,12 22,20" fill="none"/><line class="lead" x1="22" y1="-20" x2="40" y2="-20"/><line class="lead" x1="22" y1="20" x2="40" y2="20"/>' +
      '<text class="ic-pin" x="0" y="31" text-anchor="middle">PC817</text>',
    elements: (c, N) => [{ type: 'D', a: N('a'), b: N('k'), is: diodeIs(1.2, 2), n: 2 }, { type: 'R', a: N('c'), b: N('e'), r: 1e9 }],
    tick: (c, els) => {
      const r = c.rt, iF = Math.max(0, els[0].i || 0), icmax = iF * (+c.props.ctr || 100) / 100; r.iF = iF;
      if (icmax < 1e-6) { els[1].r = 1e9; r.sat = false; return; }
      const vce = Math.max(0.2, Math.abs(els[1].vd || 0)), target = Math.min(1e9, Math.max(6, vce / icmax)), cur = els[1].r;
      els[1].r = Math.exp(0.5 * Math.log(Math.min(cur, 1e9)) + 0.5 * Math.log(target)); r.sat = els[1].r < 30;
    },
    update: (c, refs) => { if (refs.led) refs.led.setAttribute('fill', (c.rt.iF || 0) > 0.0005 ? ON : OFF); },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; c.rt.ic = els[1].i; c.rt.vce = els[1].vd; },
    check: (c, els, rtm) => { if (els[0].i > 0.06) rtm.alert('opto' + c.id, 'The optocoupler LED carries ' + (els[0].i * 1000).toFixed(0) + ' mA. The limit is about 50 mA: add a series resistor (330 Ω–1 kΩ).', 'warn'); },
    live: c => [['LED current', fmt(c.rt.iF || 0, 'A')], ['Output current', fmt(Math.abs(c.rt.ic || 0), 'A')], ['Output', (c.rt.iF || 0) < 1e-4 ? 'OFF' : c.rt.sat ? 'ON (saturated)' : 'ON (limited by LED current × CTR)']]
  });

  /* ======================= 78xx / LDO voltage regulators ======================= */
  const REGS = {
    r7805: { name: '7805 (5 V)', vo: 5, drop: 2.0 }, r7809: { name: '7809 (9 V)', vo: 9, drop: 2.0 }, r7812: { name: '7812 (12 V)', vo: 12, drop: 2.0 },
    r1117: { name: 'AMS1117-3.3 (3.3 V, low dropout)', vo: 3.3, drop: 1.1 }, r7833: { name: 'LM1117-5 (5 V, low dropout)', vo: 5, drop: 1.2 }
  };
  def('vreg', {
    name: 'Voltage regulator (7805 …)', cat: 'Drivers & power ICs', bounds: [-50, -34, 100, 78], defaults: { model: 'r7805' },
    desc: 'Turns a higher, wobbly DC voltage into a steady one. The 7805 gives 5 V as long as the input is at least ~7 V (the “dropout”). Put a capacitor (0.1–10 µF) at the input and output. It wastes the difference as heat: P = (Vin − Vout) × I, so 12 V → 5 V at 0.5 A is 3.5 W of heat. Limit about 1 A.',
    props: [{ key: 'model', label: 'Regulator', type: 'select', options: Object.keys(REGS).map(k => ({ v: k, l: REGS[k].name })) }],
    terms: [{ n: 'in', x: -40, y: 0, label: 'IN (input)' }, { n: 'gnd', x: 0, y: 40, label: 'GND (common)' }, { n: 'out', x: 40, y: 0, label: 'OUT (regulated output)' }],
    label: () => '',
    svg: c => '<line class="lead" x1="-40" y1="0" x2="-28" y2="0"/><line class="lead" x1="28" y1="0" x2="40" y2="0"/><line class="lead" x1="0" y1="24" x2="0" y2="40"/>' +
      '<rect class="ic-body" x="-28" y="-26" width="56" height="50" rx="4"/><rect x="-28" y="-30" width="56" height="8" rx="2" fill="#7b838a"/><circle cx="0" cy="-26" r="2.6" fill="#1b2420"/>' +
      '<text class="ic-t" x="0" y="-2" text-anchor="middle">' + ((REGS[c.props.model] || REGS.r7805).name.split(' ')[0]) + '</text><text class="ic-t2" x="0" y="12" text-anchor="middle">' + fmt((REGS[c.props.model] || REGS.r7805).vo, 'V') + '</text>' +
      '<text class="ic-pin" x="-24" y="-12">IN</text><text class="ic-pin" x="24" y="-12" text-anchor="end">OUT</text><text class="ic-pin" x="0" y="21" text-anchor="middle">GND</text>',
    elements: (c, N) => { c.rt.n = { in: N('in'), gnd: N('gnd'), out: N('out') }; return [{ type: 'V', a: N('out'), b: N('gnd'), v: 0, rs: 0.3, en: true }, { type: 'R', a: N('in'), b: N('gnd'), r: 4000 }]; },   // the second element is the input current (= output current + 5 mA)
    tick: (c, els, t, rtm) => {
      const r = c.rt, n = r.n; if (!n) return; const m = REGS[c.props.model] || REGS.r7805, v = rtm.sim.v, vin = (v[n.in] || 0) - (v[n.gnd] || 0);
      r.vin = vin; r.vset = m.vo; r.reg = vin >= m.vo + m.drop; els[0].v = vin <= 0.5 ? 0 : Math.max(0, Math.min(m.vo, vin - m.drop));
      els[1].r = vin > 0.5 ? Math.max(2, vin / (Math.abs(els[0].i || 0) + 0.005)) : 1e9;     // a linear regulator draws as much from its input as it delivers
    },
    read: (c, els) => { c.rt.iout = -els[0].i; c.rt.vout = els[0].vd; c.rt.i = els[0].i; c.rt.v = els[0].vd; },
    check: (c, els, rtm) => {
      const r = c.rt, io = Math.abs(els[0].i), heat = (r.vin - r.vout) * io;
      if (io > 1.1) rtm.alert('regi' + c.id, 'The regulator supplies ' + io.toFixed(2) + ' A. A 78xx is limited to about 1 A: it would shut down in a real circuit.', 'warn');
      else if (heat > 2.5) rtm.alert('regh' + c.id, 'The regulator wastes ' + heat.toFixed(1) + ' W as heat ((Vin − Vout) × I). Without a heatsink it will overheat: lower the input voltage or the current.', 'warn');
    },
    live: c => [['Input', fmt(c.rt.vin || 0, 'V')], ['Output', fmt(c.rt.vout || 0, 'V')], ['Output current', fmt(Math.abs(c.rt.iout || 0), 'A')], ['Heat', fmt(Math.max(0, ((c.rt.vin || 0) - (c.rt.vout || 0)) * Math.abs(c.rt.iout || 0)), 'W')], ['Regulating', c.rt.reg ? 'yes' : 'NO: input too low (needs ' + fmt((REGS[c.props.model] || REGS.r7805).vo + (REGS[c.props.model] || REGS.r7805).drop, 'V') + ')']]
  });
  PARTS.vreg.models = REGS;

  /* ======================= LM317 adjustable regulator ======================= */
  def('lm317', {
    name: 'LM317 adjustable regulator', cat: 'Drivers & power ICs', bounds: [-50, -34, 100, 78], defaults: {},
    desc: 'OUT stays exactly 1.25 V above ADJ. Put R1 (about 240 Ω) between OUT and ADJ, and R2 between ADJ and GND: Vout = 1.25 × (1 + R2 ÷ R1). A 5 kΩ potentiometer as R2 makes an adjustable 1.25–30 V supply. The input must be at least 3 V higher than the output. Needs about 10 mA minimum load (R1 provides it).',
    terms: [{ n: 'in', x: -40, y: 0, label: 'IN (input, ≥ Vout + 3 V)' }, { n: 'adj', x: 0, y: 40, label: 'ADJ (adjust)' }, { n: 'out', x: 40, y: 0, label: 'OUT (output)' }],
    label: () => '',
    svg: c => '<line class="lead" x1="-40" y1="0" x2="-28" y2="0"/><line class="lead" x1="28" y1="0" x2="40" y2="0"/><line class="lead" x1="0" y1="24" x2="0" y2="40"/>' +
      '<rect class="ic-body" x="-28" y="-26" width="56" height="50" rx="4"/><rect x="-28" y="-30" width="56" height="8" rx="2" fill="#7b838a"/><circle cx="0" cy="-26" r="2.6" fill="#1b2420"/>' +
      '<text class="ic-t" x="0" y="-2" text-anchor="middle">LM317</text><text class="ic-t2" x="0" y="12" text-anchor="middle">ADJ REG</text>' +
      '<text class="ic-pin" x="-24" y="-12">IN</text><text class="ic-pin" x="24" y="-12" text-anchor="end">OUT</text><text class="ic-pin" x="0" y="21" text-anchor="middle">ADJ</text>',
    // error amplifier: OUT is forced to sit 1.25 V above ADJ (op-amp with a 1.25 V offset source in its feedback path)
    elements: (c, N) => { const m = N.alloc(); c.rt.n = { in: N('in'), adj: N('adj'), out: N('out') };
      return [{ type: 'OA', p: N('adj'), n: m, o: N('out'), vp: N('in'), vn: 0, gain: 1e5, ro: 0.3, mlo: 0.05, mhi: 2.0 }, { type: 'V', a: N('out'), b: m, v: 1.25, rs: 1 }, { type: 'R', a: N('in'), b: 0, r: 1e9 }]; },
    tick: (c, els, t, rtm) => { const n = c.rt.n; if (!n) return; const v = rtm.sim.v, vin = v[n.in] || 0; c.rt.vin = vin; c.rt.reg = els[0].state === 'lin'; els[2].r = vin > 0.5 ? Math.max(2, vin / (Math.abs(els[0].i || 0) + 0.005)) : 1e9; },
    read: (c, els) => { c.rt.iout = els[0].i; c.rt.i = els[0].i; c.rt.v = els[0].vo; c.rt.vout = els[0].vo; },
    check: (c, els, rtm) => { if (Math.abs(els[0].i) > 1.6) rtm.alert('l317' + c.id, 'The LM317 supplies ' + Math.abs(els[0].i).toFixed(2) + ' A. The limit is about 1.5 A.', 'warn'); },
    live: c => [['Input', fmt(c.rt.vin || 0, 'V')], ['Output', fmt(c.rt.vout || 0, 'V')], ['Output current', fmt(Math.abs(c.rt.iout || 0), 'A')], ['Regulating', c.rt.reg ? 'yes' : 'NO: needs ADJ wired (R1, R2) and the input 3 V above OUT']]
  });

  /* ======================= Schottky diode ======================= */
  def('schottky', {
    name: 'Schottky diode (1N5819)', cat: 'Semiconductors', defaults: {},
    desc: 'A diode that drops only about 0.3 V instead of 0.7 V, and switches very fast. Used for reverse-polarity protection, power supplies with little waste, and as flyback diodes. Current flows anode → cathode (the bar).',
    terms: [{ n: 'a', x: -20, y: 0, label: 'anode' }, { n: 'k', x: 20, y: 0, label: 'cathode (bar)' }],
    label: () => '1N5819',
    svg: c => '<line class="lead" x1="-20" y1="0" x2="20" y2="0"/><path class="dio-tri" d="M-8,-10 L8,0 L-8,10 Z"/><polyline class="lead thick" points="4,-14 8,-10 8,10 12,14" fill="none"/>' + lbl(c, '1N5819', 0, -18),
    elements: (c, N) => [{ type: 'D', a: N('a'), b: N('k'), is: diodeIs(0.28, 1.05), n: 1.05 }],
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; }
  });

  /* ======================= Fuse ======================= */
  def('fuse', {
    name: 'Fuse', cat: 'Power', bounds: [-50, -22, 100, 44], defaults: { amps: 0.5 },
    desc: 'A deliberate weak link: if the current goes far above its rating the thin wire inside melts and opens the circuit before wires or parts burn. A fuse only blows once. Press Stop and Run to fit a new one. Place it in series with the supply, rated just above the normal current.',
    props: [{ key: 'amps', label: 'Rating', type: 'select', options: [0.1, 0.25, 0.5, 1, 2, 5].map(a => ({ v: a, l: a + ' A' })) }],
    terms: [{ n: 'a', x: -40, y: 0, label: 'end A' }, { n: 'b', x: 40, y: 0, label: 'end B' }],
    label: () => '',
    svg: c => '<line class="lead" x1="-40" y1="0" x2="-26" y2="0"/><line class="lead" x1="26" y1="0" x2="40" y2="0"/><rect x="-26" y="-9" width="52" height="18" rx="6" fill="#bfe3e8" fill-opacity="0.35" stroke="#8fa" stroke-width="1.2"/><rect x="-28" y="-9" width="8" height="18" rx="2" fill="#b7b7b7"/><rect x="20" y="-9" width="8" height="18" rx="2" fill="#b7b7b7"/>' +
      '<polyline data-ref="wire" class="lead" points="-20,0 -10,-4 0,4 10,-4 20,0" fill="none"/><text data-ref="blown" class="ic-pin" x="0" y="3" text-anchor="middle" fill="#ff5a5a" opacity="0">BLOWN</text>' + lbl(c, c.props.amps + ' A', 0, -14),
    elements: (c, N) => [{ type: 'R', a: N('a'), b: N('b'), r: 0.1 }],
    sync: (c, els) => { els[0].r = c.rt.blown ? 1e9 : 0.1; },
    tick: (c, els, t) => {
      const r = c.rt, dt = r.tl === undefined ? 0 : Math.max(0, Math.min(5, t - r.tl)); r.tl = t; if (r.blown) return;
      const k = Math.abs(els[0].i || 0) / c.props.amps; r.heat = Math.max(0, (r.heat || 0) + (k * k - 1.7) * dt);
      if (r.heat > 150) { r.blown = true; els[0].r = 1e9; }
    },
    update: (c, refs) => { if (refs.wire) refs.wire.setAttribute('visibility', c.rt.blown ? 'hidden' : 'visible'); if (refs.blown) refs.blown.setAttribute('opacity', c.rt.blown ? 1 : 0); },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = c.rt.blown ? 0 : els[0].i; },
    check: (c, els, rtm) => { if (c.rt.blown) rtm.alert('fuse' + c.id, 'The ' + c.props.amps + ' A fuse blew: too much current flowed (there is probably a short circuit or too big a load). Fix the fault, then press Stop and Run to fit a new fuse.', 'error'); },
    live: c => [['State', c.rt.blown ? 'BLOWN (open)' : 'intact'], ['Current', fmt(Math.abs(c.rt.i || 0), 'A') + ' of ' + c.props.amps + ' A'], ['Heating', Math.min(100, Math.round((c.rt.heat || 0) / 1.5)) + ' %']]
  });

  /* ======================= Incandescent lamp ======================= */
  def('lamp', {
    name: 'Lamp (filament bulb)', cat: 'Display & motion', bounds: [-40, -34, 80, 68], defaults: { volts: 12 },
    desc: 'A filament bulb. Its resistance is about 10 times lower when cold, so it draws a big “inrush” current at switch-on and then settles as the filament heats up and glows. Choose the rating that matches your supply: more than about 30 % over the rating burns it out.',
    props: [{ key: 'volts', label: 'Rated voltage', type: 'select', options: [3, 6, 12, 24].map(v => ({ v, l: v + ' V (' + fmt(v * 0.25, 'W') + ')' })) }],
    terms: [{ n: 'a', x: -40, y: 0, label: 'terminal A' }, { n: 'b', x: 40, y: 0, label: 'terminal B' }],
    label: () => '',
    svg: c => '<line class="lead" x1="-40" y1="0" x2="-20" y2="0"/><line class="lead" x1="20" y1="0" x2="40" y2="0"/><circle data-ref="glow" r="34" fill="#ffd45a" opacity="0"/><circle class="led-dome" r="20" fill="#ffffff" fill-opacity="0.12" stroke="#9aa"/>' +
      '<path data-ref="fil" d="M-14,10 L-14,-2 L-7,6 L0,-6 L7,6 L14,-2 L14,10" fill="none" stroke="#9a9a8a" stroke-width="1.6"/><line class="lead" x1="-20" y1="0" x2="-14" y2="10"/><line class="lead" x1="20" y1="0" x2="14" y2="10"/>' + lbl(c, c.props.volts + ' V', 0, -26),
    elements: (c, N) => [{ type: 'R', a: N('a'), b: N('b'), r: c.props.volts / 0.25 / 10 }],
    sync: (c, els) => { const rh = c.props.volts / 0.25; els[0].r = c.rt.burnt ? 1e9 : rh / 10 + (rh - rh / 10) * Math.min(1, c.rt.temp || 0); },
    tick: (c, els, t) => {
      const r = c.rt, dt = r.tl === undefined ? 0 : Math.max(0, Math.min(5, t - r.tl)); r.tl = t; if (r.burnt) return;
      const rh = c.props.volts / 0.25, pr = c.props.volts * 0.25, p = Math.abs((els[0].vd || 0) * (els[0].i || 0));
      r.temp = (r.temp || 0) + (Math.min(2.2, p / pr) - (r.temp || 0)) * (1 - Math.exp(-dt / 40)); els[0].r = rh / 10 + (rh - rh / 10) * Math.min(1.25, r.temp);
      if (Math.abs(els[0].vd) > c.props.volts * 1.3) { r.over = (r.over || 0) + dt; if (r.over > 150) { r.burnt = true; els[0].r = 1e9; } } else r.over = Math.max(0, (r.over || 0) - dt);
    },
    update: (c, refs) => {
      const b = c.rt.burnt ? 0 : Math.min(1, Math.pow(Math.max(0, (c.rt.temp || 0)), 1.6));
      if (refs.glow) refs.glow.setAttribute('opacity', (b * 0.85).toFixed(3));
      if (refs.fil) refs.fil.setAttribute('stroke', c.rt.burnt ? '#444' : 'rgb(' + Math.round(150 + 105 * b) + ',' + Math.round(150 + 60 * b) + ',' + Math.round(130 - 60 * b) + ')');
    },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; c.rt.r = els[0].r; },
    check: (c, els, rtm) => { if (c.rt.burnt) rtm.alert('lamp' + c.id, 'The lamp burned out: it got more than 130 % of its rated ' + c.props.volts + ' V. Use a lower supply voltage, a resistor, or a lamp with a higher rating.', 'error'); },
    live: c => [['State', c.rt.burnt ? 'BURNT OUT' : (c.rt.temp || 0) > 0.5 ? 'glowing' : 'cold / dim'], ['Voltage', fmt(Math.abs(c.rt.v || 0), 'V')], ['Current', fmt(Math.abs(c.rt.i || 0), 'A')], ['Resistance', fmt(c.rt.r || 0, 'Ω') + ' (cold ≈ ' + fmt(c.props.volts / 2.5, 'Ω') + ')']]
  });

  /* ======================= LED bar graph ======================= */
  const BAR_COL = { red: LED_COLORS.red, yellow: LED_COLORS.yellow, green: LED_COLORS.green, blue: LED_COLORS.blue };
  const barX = i => -90 + i * 20;
  def('ledbar', {
    name: 'LED bar graph (10 LEDs)', cat: 'Display & motion', bounds: [-110, -48, 220, 96], z: 4, defaults: { color: 'green', resistors: 'builtin' },
    desc: 'Ten LEDs in a row, as used in level meters. Anodes (A1–A10) are along the bottom, cathodes (K1–K10) along the top: to light segment n connect Kn to GND and give An a HIGH. With “built-in resistors” each segment already has 220 Ω; turn it off to add your own. Drive it from Arduino pins, from a CD4017 (running light), or from an analog level.',
    props: [{ key: 'color', label: 'Colour', type: 'select', options: Object.keys(BAR_COL).map(k => ({ v: k, l: k[0].toUpperCase() + k.slice(1) })) }, { key: 'resistors', label: 'Series resistors', type: 'select', options: [{ v: 'builtin', l: 'Built in (220 Ω per segment)' }, { v: 'none', l: 'None (add your own!)' }] }],
    terms: [].concat(Array.from({ length: 10 }, (_, i) => ({ n: 'a' + (i + 1), x: barX(i), y: 40, label: 'anode ' + (i + 1) })), Array.from({ length: 10 }, (_, i) => ({ n: 'k' + (i + 1), x: barX(i), y: -40, label: 'cathode ' + (i + 1) }))),
    label: () => '',
    svg: c => {
      const col = BAR_COL[c.props.color] || BAR_COL.green; let s = '<rect class="seg-body" x="-104" y="-28" width="208" height="56" rx="5"/>';
      for (let i = 0; i < 10; i++) {
        s += '<line class="lead" x1="' + barX(i) + '" y1="40" x2="' + barX(i) + '" y2="28"/><line class="lead" x1="' + barX(i) + '" y1="-40" x2="' + barX(i) + '" y2="-28"/>' +
          '<rect data-ref="b' + i + '" x="' + (barX(i) - 7) + '" y="-18" width="14" height="36" rx="2" fill="' + col.rgb + '" fill-opacity="0.15" stroke="' + col.rgb + '" stroke-opacity="0.5"/>' +
          '<text class="lcd-pin" x="' + barX(i) + '" y="24" text-anchor="middle" font-size="6" style="fill:#cdd">' + (i + 1) + '</text>';
      }
      return s;
    },
    elements: (c, N) => {
      const col = BAR_COL[c.props.color] || BAR_COL.green, out = [];
      for (let i = 1; i <= 10; i++) {
        if (c.props.resistors === 'builtin') { const m = N.alloc(); out.push({ type: 'R', a: N('a' + i), b: m, r: 220 }, { type: 'D', a: m, b: N('k' + i), is: diodeIs(col.vf, 2), n: 2 }); }
        else out.push({ type: 'D', a: N('a' + i), b: N('k' + i), is: diodeIs(col.vf, 2), n: 2 });
      }
      return out;
    },
    tick: (c, els, t) => {
      const r = c.rt, dt = r.tl === undefined ? 0 : Math.max(0, t - r.tl); r.tl = t; r.lit = r.lit || new Array(10).fill(0); const a = 1 - Math.exp(-dt / 3), ds = els.filter(e => e.type === 'D');
      for (let k = 0; k < 10; k++) { const i = ds[k] ? Math.abs(ds[k].i) : 0; r.lit[k] += (Math.min(1, i / 0.012) - r.lit[k]) * a; if (i > 0.04) r.over = true; }
    },
    update: (c, refs) => { const col = BAR_COL[c.props.color] || BAR_COL.green; for (let k = 0; k < 10; k++) if (refs['b' + k]) { const b = (c.rt.lit && c.rt.lit[k]) || 0; refs['b' + k].setAttribute('fill-opacity', (0.15 + 0.85 * b).toFixed(2)); refs['b' + k].setAttribute('stroke-opacity', (0.5 + 0.5 * b).toFixed(2)); } },
    read: () => {},
    check: (c, els, rtm) => { if (c.props.resistors === 'none' && c.rt.over) rtm.alert('bar' + c.id, 'A bar-graph segment carries more than 40 mA: add a resistor (about 220 Ω) in series with every segment.', 'warn'); },
    live: c => [['Segments lit', (c.rt.lit || []).map((v, i) => (v > 0.5 ? i + 1 : '')).filter(Boolean).join(' ') || 'none']]
  });

  /* ======================= 8×8 LED matrix ======================= */
  const MX = 20, mxX = i => -70 + i * MX, mxY = j => -70 + j * MX;
  def('dotmatrix', {
    name: '8×8 LED matrix', cat: 'Display & motion', bounds: [-100, -100, 200, 200], z: 4, defaults: { color: 'red' },
    desc: 'Sixty-four LEDs in a grid. ROW pins are the anodes (+), COLUMN pins are the cathodes (−): the LED at (row, column) lights when its ROW is HIGH and its COLUMN is LOW. Light one row at a time very quickly (multiplexing) and your eye sees the whole picture. Each column has a built-in 220 Ω resistor. Write 64 pixels using only 16 pins.',
    props: [{ key: 'color', label: 'Colour', type: 'select', options: ['red', 'green', 'yellow', 'blue'].map(k => ({ v: k, l: k[0].toUpperCase() + k.slice(1) })) }],
    terms: [].concat(Array.from({ length: 8 }, (_, j) => ({ n: 'R' + (j + 1), x: -90, y: mxY(j), label: 'row ' + (j + 1) + ' (anode +)' })), Array.from({ length: 8 }, (_, i) => ({ n: 'C' + (i + 1), x: mxX(i), y: 90, label: 'column ' + (i + 1) + ' (cathode −)' }))),
    label: () => '',
    svg: c => {
      const col = LED_COLORS[c.props.color] || LED_COLORS.red; let s = '<rect class="seg-body" x="-80" y="-80" width="160" height="160" rx="6"/>';
      for (let j = 0; j < 8; j++) s += '<line class="lead" x1="-90" y1="' + mxY(j) + '" x2="-80" y2="' + mxY(j) + '"/><text class="lcd-pin" x="-74" y="' + (mxY(j) + 2) + '" font-size="6" style="fill:#cdd">R' + (j + 1) + '</text>';
      for (let i = 0; i < 8; i++) s += '<line class="lead" x1="' + mxX(i) + '" y1="80" x2="' + mxX(i) + '" y2="90"/><text class="lcd-pin" x="' + mxX(i) + '" y="76" text-anchor="middle" font-size="6" style="fill:#cdd">C' + (i + 1) + '</text>';
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) s += '<circle data-ref="m' + j + '_' + i + '" cx="' + mxX(i) + '" cy="' + mxY(j) + '" r="6.5" fill="' + col.rgb + '" fill-opacity="0.12" stroke="#222" stroke-width="0.6"/>';
      return s;
    },
    elements: (c, N) => {
      const col = LED_COLORS[c.props.color] || LED_COLORS.red, out = [], inner = [];
      for (let i = 0; i < 8; i++) { const m = N.alloc(); inner.push(m); out.push({ type: 'R', a: m, b: N('C' + (i + 1)), r: 220 }); }
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) out.push({ type: 'D', a: N('R' + (j + 1)), b: inner[i], is: diodeIs(col.vf, 2), n: 2 });
      return out;
    },
    tick: (c, els, t) => {
      const r = c.rt, dt = r.tl === undefined ? 0 : Math.max(0, t - r.tl); r.tl = t; r.px = r.px || new Array(64).fill(0); const a = 1 - Math.exp(-dt / 4);
      for (let k = 0; k < 64; k++) { const e = els[8 + k], i = e ? Math.abs(e.i) : 0; r.px[k] += (Math.min(1, i / 0.012) - r.px[k]) * a; }
    },
    update: (c, refs) => { const px = c.rt.px; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const el = refs['m' + j + '_' + i]; if (el) el.setAttribute('fill-opacity', (0.12 + 0.88 * ((px && px[j * 8 + i]) || 0)).toFixed(2)); } },
    sync: () => {}, read: () => {},
    live: c => [['Pixels lit', String((c.rt.px || []).filter(v => v > 0.5).length)]]
  });

  /* ======================= Stepper motor (28BYJ-48) ======================= */
  def('stepper', {
    name: 'Stepper motor (28BYJ-48)', cat: 'Display & motion', bounds: [-60, -52, 120, 120], defaults: {},
    desc: 'A motor that turns in tiny exact STEPS instead of spinning freely. Four coils (IN1–IN4) are energised in a sequence and the magnet rotor follows. Connect COM (the red wire) to 5 V and drive each coil end to ground, using a ULN2003 (a pin cannot supply 80 mA). Energise the coils in order 1-2-3-4 to turn one way, 4-3-2-1 for the other. A 2-coils-at-a-time sequence has more torque; one-at-a-time is simplest. One full turn of the shaft takes 4096 half-steps.',
    terms: [{ n: 'com', x: 0, y: 60, label: 'COM (red wire, to +5 V)' }, { n: 'c1', x: -40, y: 60, label: 'coil 1 (blue)' }, { n: 'c2', x: -20, y: 60, label: 'coil 2 (pink)' }, { n: 'c3', x: 20, y: 60, label: 'coil 3 (yellow)' }, { n: 'c4', x: 40, y: 60, label: 'coil 4 (orange)' }],
    label: () => '',
    svg: c => '<circle class="motor-body" r="44"/><circle r="30" fill="#1d2623" stroke="#3b4b45"/>' +
      ['c1', 'c2', 'c3', 'c4'].map((k, i) => { const a = i * 90 * Math.PI / 180, x = Math.cos(a) * 22, y = -Math.sin(a) * 22; return '<circle data-ref="k' + (i + 1) + '" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="7" fill="#b9792a" fill-opacity="0.35"/><text class="ic-pin" x="' + (Math.cos(a) * 37).toFixed(1) + '" y="' + (-Math.sin(a) * 37 + 3).toFixed(1) + '" text-anchor="middle" font-size="6">' + (i + 1) + '</text>'; }).join('') +
      '<g data-ref="rot"><rect x="-14" y="-5" width="14" height="10" fill="#d94a4a"/><rect x="0" y="-5" width="14" height="10" fill="#e8e8e8"/></g><circle r="4" fill="#222"/>' +
      '<line data-ref="shaft" x1="0" y1="0" x2="0" y2="-12" stroke="#f5b942" stroke-width="2.5" stroke-linecap="round"/>' +
      [-40, -20, 0, 20, 40].map((x, i) => '<line class="lead" x1="' + x + '" y1="44" x2="' + x + '" y2="60"/><text class="ic-pin" x="' + x + '" y="55" text-anchor="middle" font-size="6">' + (i === 2 ? 'COM' : 'IN' + (i < 2 ? i + 1 : i)) + '</text>').join(''),
    elements: (c, N) => ['c1', 'c2', 'c3', 'c4'].map(k => ({ type: 'R', a: N('com'), b: N(k), r: 60 })),
    tick: (c, els, t) => {
      const r = c.rt, dt = r.tl === undefined ? 0 : Math.max(0, Math.min(5, t - r.tl)); r.tl = t; r.phi = r.phi || 0; r.half = r.half || 0;
      let fx = 0, fy = 0; els.forEach((e, i) => { const a = i * Math.PI / 2, cur = Math.max(0, e.i || 0); fx += cur * Math.cos(a); fy += cur * Math.sin(a); });
      r.coil = els.map(e => (e.i || 0) > 0.02); r.field = Math.hypot(fx, fy);
      if (r.field > 0.02 && dt > 0) {
        const tgt = Math.atan2(fy, fx) * 180 / Math.PI; let diff = ((tgt - r.phi) % 360 + 540) % 360 - 180;
        const move = Math.max(-30 * dt, Math.min(30 * dt, diff * (1 - Math.exp(-dt / 2)))); r.phi += move; r.half = r.phi / 45;
      }
    },
    update: (c, refs) => {
      const r = c.rt; if (refs.rot) refs.rot.setAttribute('transform', 'rotate(' + (-(r.phi || 0)).toFixed(1) + ')');
      if (refs.shaft) refs.shaft.setAttribute('transform', 'rotate(' + ((r.half || 0) * 360 / 4096).toFixed(2) + ')');
      for (let i = 0; i < 4; i++) if (refs['k' + (i + 1)]) refs['k' + (i + 1)].setAttribute('fill-opacity', r.coil && r.coil[i] ? 0.95 : 0.35);
    },
    read: (c, els) => { c.rt.i = els.reduce((s, e) => s + Math.abs(e.i), 0); c.rt.v = els[0].vd; },
    live: c => [['Coils energised', (c.rt.coil || []).map((o, i) => (o ? i + 1 : '')).filter(Boolean).join(' + ') || 'none'], ['Half-steps taken', String(Math.round(c.rt.half || 0))], ['Shaft turns', ((c.rt.half || 0) / 4096).toFixed(3)], ['Supply current', fmt(c.rt.i || 0, 'A')]]
  });

  /* ======================= PIR motion sensor ======================= */
  def('pir', {
    name: 'PIR motion sensor (HC-SR501)', cat: 'Sensors', bounds: [-34, -34, 68, 100], clickable: true, defaults: { motion: false, hold: 2 },
    desc: 'Detects moving warm bodies (people). OUT goes HIGH (3.3 V) when it sees movement and stays HIGH for the “hold time” afterwards. It needs 5 V on VCC (4.5–20 V). CLICK the sensor to simulate somebody walking past (click again to stop). Connect OUT to an Arduino input.',
    props: [{ key: 'motion', label: 'Motion in front', type: 'toggle', live: true }, { key: 'hold', label: 'Hold time', type: 'select', options: [{ v: 0.5, l: '0.5 s' }, { v: 2, l: '2 s' }, { v: 5, l: '5 s' }] }],
    terms: [{ n: 'vcc', x: -20, y: 60, label: 'VCC (4.5–20 V)' }, { n: 'out', x: 0, y: 60, label: 'OUT (3.3 V when motion)' }, { n: 'gnd', x: 20, y: 60, label: 'GND' }],
    label: () => '',
    svg: c => '<line class="lead" x1="-20" y1="44" x2="-20" y2="60"/><line class="lead" x1="0" y1="44" x2="0" y2="60"/><line class="lead" x1="20" y1="44" x2="20" y2="60"/>' +
      '<rect x="-30" y="-8" width="60" height="52" rx="4" fill="#1c6b4a" stroke="#0e3d2a"/><circle cx="0" cy="-8" r="22" fill="#f3f1e8" stroke="#bbb"/><circle data-ref="dome" cx="0" cy="-8" r="14" fill="#e6e2d0" stroke="#aaa"/>' +
      '<text class="ic-pin" x="-20" y="40" text-anchor="middle" font-size="6">VCC</text><text class="ic-pin" x="0" y="40" text-anchor="middle" font-size="6">OUT</text><text class="ic-pin" x="20" y="40" text-anchor="middle" font-size="6">GND</text>' +
      '<circle data-ref="led" class="ic-led" cx="22" cy="-28" r="3"/>' + lbl(c, 'PIR', 0, -36),
    elements: (c, N) => { c.rt.n = { vcc: N('vcc'), out: N('out'), gnd: N('gnd') }; return [{ type: 'V', a: N('out'), b: N('gnd'), v: 0, rs: 100, en: true }, { type: 'R', a: N('vcc'), b: N('gnd'), r: 3000 }]; },
    tick: (c, els, t, rtm) => {
      const r = c.rt, n = r.n; if (!n) return; const v = rtm.sim.v; r.powered = (v[n.vcc] - v[n.gnd]) >= 4.5;
      if (c.props.motion) r.until = t + c.props.hold * 1000; r.hi = r.powered && t < (r.until || 0); els[0].v = r.hi ? 3.3 : 0;
    },
    onClick: c => { c.props.motion = !c.props.motion; return true; },
    update: (c, refs) => { if (refs.led) refs.led.setAttribute('fill', c.rt.hi ? ON : OFF); if (refs.dome) refs.dome.setAttribute('fill', c.props.motion ? '#ffd27a' : '#e6e2d0'); },
    read: (c, els) => { c.rt.i = els[0].i; c.rt.v = els[0].vd; },
    live: c => [['Powered', c.rt.powered ? 'yes' : 'NO: VCC needs 5 V'], ['Motion', c.props.motion ? 'detected' : 'none'], ['OUT', c.rt.hi ? 'HIGH (3.3 V)' : 'low']]
  });

  /* ======================= LM35 temperature sensor ======================= */
  def('lm35', {
    name: 'Temperature sensor (LM35)', cat: 'Sensors', bounds: [-30, -30, 60, 80], defaults: { temp: 25 },
    desc: 'Analog temperature sensor with a very simple rule: output = 10 mV per °C (25 °C = 0.25 V). No offset to subtract: tempC = volts × 100. It needs 4–30 V on +Vs and, powered from a single supply, reads 2 °C and above. Use the slider to change the temperature.',
    props: [{ key: 'temp', label: 'Temperature', type: 'range', unit: ' °C', min: 2, max: 150, step: 1, live: true }],
    terms: [{ n: 'vcc', x: -20, y: 40, label: '+Vs (4–30 V)' }, { n: 'out', x: 0, y: 40, label: 'Vout (10 mV / °C)' }, { n: 'gnd', x: 20, y: 40, label: 'GND' }],
    label: () => '',
    svg: c => '<line class="lead" x1="-20" y1="28" x2="-20" y2="40"/><line class="lead" x1="0" y1="28" x2="0" y2="40"/><line class="lead" x1="20" y1="28" x2="20" y2="40"/>' +
      '<path class="to92" d="M-24,28 L-24,-2 A24,24 0 0 1 24,-2 L24,28 Z"/><text class="to92-t" x="0" y="8" text-anchor="middle">LM35</text><text data-ref="val" class="to92-v" x="0" y="22" text-anchor="middle">' + c.props.temp + '°C</text><rect data-ref="heat" class="heat" x="-18" y="-16" width="36" height="5" rx="2"/>',
    elements: (c, N) => { c.rt.n = { vcc: N('vcc'), gnd: N('gnd'), out: N('out') }; return [{ type: 'V', a: N('out'), b: N('gnd'), v: 0.01 * c.props.temp, rs: 100 }]; },
    sync: (c, els) => { els[0].v = 0.01 * c.props.temp; },
    tick: (c, els, t, rtm) => { const n = c.rt.n; if (!n) return; const v = rtm.sim.v, p = (v[n.vcc] - v[n.gnd]) >= 4; c.rt.powered = p; els[0].v = p ? 0.01 * c.props.temp : 0; },
    update: (c, refs) => { if (refs.val) refs.val.textContent = c.props.temp + '°C'; if (refs.heat) { const k = Math.max(0, Math.min(1, c.props.temp / 150)); refs.heat.setAttribute('fill', 'hsl(' + (220 - 220 * k).toFixed(0) + ',85%,55%)'); } },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; },
    live: c => [['Temperature', c.props.temp + ' °C'], ['Output', fmt(c.rt.v || 0, 'V')], ['Powered', c.rt.powered ? 'yes' : 'NO: +Vs needs 5 V']]
  });

  /* ======================= Analog joystick ======================= */
  def('joystick', {
    name: 'Joystick module', cat: 'Sensors', bounds: [-50, -50, 100, 130], clickable: true, defaults: { x: 50, y: 50, pressed: false },
    desc: 'Two potentiometers (left–right and up–down) plus a push button, like a game controller. VRx and VRy are analog voltages between 0 V and 5 V: about 2.5 V in the middle. SW is pulled to GND when you press the stick: use INPUT_PULLUP on that pin. Use the sliders for the position; CLICK the module to press the button.',
    props: [{ key: 'x', label: 'Left ← → Right', type: 'range', unit: '%', min: 0, max: 100, step: 1, live: true }, { key: 'y', label: 'Up ↑ ↓ Down', type: 'range', unit: '%', min: 0, max: 100, step: 1, live: true }, { key: 'pressed', label: 'Button pressed', type: 'toggle', live: true }],
    terms: [{ n: 'gnd', x: -40, y: 70, label: 'GND' }, { n: 'vcc', x: -20, y: 70, label: '+5V' }, { n: 'vrx', x: 0, y: 70, label: 'VRx (horizontal)' }, { n: 'vry', x: 20, y: 70, label: 'VRy (vertical)' }, { n: 'sw', x: 40, y: 70, label: 'SW (button, LOW when pressed)' }],
    label: () => '',
    svg: c => '<rect x="-46" y="-46" width="92" height="106" rx="6" fill="#1b2a44" stroke="#0e1626"/><circle cx="0" cy="-8" r="30" fill="#0f1726" stroke="#34445f"/>' +
      '<circle data-ref="stick" cx="' + ((c.props.x - 50) * 0.4).toFixed(1) + '" cy="' + (-8 + (c.props.y - 50) * 0.4).toFixed(1) + '" r="14" fill="#2b3342" stroke="#6b7a96" stroke-width="2"/>' +
      [-40, -20, 0, 20, 40].map((x, i) => '<line class="lead" x1="' + x + '" y1="58" x2="' + x + '" y2="70"/><text class="ic-pin" x="' + x + '" y="55" text-anchor="middle" font-size="6">' + ['GND', '5V', 'VRx', 'VRy', 'SW'][i] + '</text>').join(''),
    elements: (c, N) => [{ type: 'R', a: N('vcc'), b: N('vrx'), r: 5000 }, { type: 'R', a: N('vrx'), b: N('gnd'), r: 5000 }, { type: 'R', a: N('vcc'), b: N('vry'), r: 5000 }, { type: 'R', a: N('vry'), b: N('gnd'), r: 5000 }, { type: 'R', a: N('sw'), b: N('gnd'), r: 1e9 }],
    sync: (c, els) => { const x = c.props.x / 100, y = c.props.y / 100; els[0].r = 10000 * (1 - x) + 1; els[1].r = 10000 * x + 1; els[2].r = 10000 * (1 - y) + 1; els[3].r = 10000 * y + 1; els[4].r = c.props.pressed ? 0.05 : 1e9; },
    onClick: c => { c.props.pressed = !c.props.pressed; return true; },
    update: (c, refs) => { if (refs.stick) { refs.stick.setAttribute('cx', ((c.props.x - 50) * 0.4).toFixed(1)); refs.stick.setAttribute('cy', (-8 + (c.props.y - 50) * 0.4).toFixed(1)); refs.stick.setAttribute('fill', c.props.pressed ? '#d94a4a' : '#2b3342'); } },
    read: (c, els) => { c.rt.vx = els[1].vd; c.rt.vy = els[3].vd; c.rt.v = els[0].vd + els[1].vd; c.rt.i = els[0].i; },
    live: c => [['VRx', fmt(c.rt.vx || 0, 'V')], ['VRy', fmt(c.rt.vy || 0, 'V')], ['Button', c.props.pressed ? 'PRESSED (SW = LOW)' : 'released']]
  });

  /* ======================= 4×4 keypad ======================= */
  const KEYS = ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D'];
  const kpX = i => -45 + i * 30, kpY = j => -45 + j * 30;
  def('keypad', {
    name: 'Keypad 4×4', cat: 'Switches & output', bounds: [-70, -70, 140, 150], clickable: true, defaults: { key: 'none' },
    desc: 'Sixteen buttons wired as a grid with only 8 pins: pressing a key connects its ROW pin to its COLUMN pin. To read it, make the column pins outputs (one LOW at a time) and the row pins INPUT_PULLUP, then see which row goes LOW. CLICK a key to press it; click it again to release.',
    props: [{ key: 'key', label: 'Key pressed', type: 'select', options: [{ v: 'none', l: 'none' }].concat(KEYS.map(k => ({ v: k, l: k }))) }],
    terms: [1, 2, 3, 4].map((r, j) => ({ n: 'R' + r, x: -70 + j * 20, y: 80, label: 'row ' + r })).concat([1, 2, 3, 4].map((cl, i) => ({ n: 'C' + cl, x: 10 + i * 20, y: 80, label: 'column ' + cl }))),
    label: () => '',
    svg: c => {
      let s = '<rect x="-64" y="-64" width="128" height="132" rx="6" fill="#2a2f36" stroke="#14171b"/>';
      KEYS.forEach((k, n) => { const i = n % 4, j = (n / 4) | 0, on = c.props.key === k; s += '<rect data-ref="k' + n + '" x="' + (kpX(i) - 12) + '" y="' + (kpY(j) - 12) + '" width="24" height="24" rx="4" fill="' + (on ? '#d94a4a' : '#dfe3e6') + '" stroke="#555"/><text x="' + kpX(i) + '" y="' + (kpY(j) + 4) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#1b2420">' + k + '</text>'; });
      for (let t = 0; t < 8; t++) { const x = -70 + t * 20; s += '<line class="lead" x1="' + x + '" y1="68" x2="' + x + '" y2="80"/><text class="ic-pin" x="' + x + '" y="77" text-anchor="middle" font-size="6">' + (t < 4 ? 'R' + (t + 1) : 'C' + (t - 3)) + '</text>'; }
      return s;
    },
    elements: (c, N) => { const out = []; for (let j = 1; j <= 4; j++) for (let i = 1; i <= 4; i++) out.push({ type: 'R', a: N('R' + j), b: N('C' + i), r: 1e9 }); return out; },
    sync: (c, els) => { const n = KEYS.indexOf(c.props.key); els.forEach((e, k) => { e.r = k === n ? 40 : 1e9; }); },
    onClick: (c, pt) => {
      const l = P.rotPt(pt.x - c.x, pt.y - c.y, -c.rot), i = Math.round((l[0] + 45) / 30), j = Math.round((l[1] + 45) / 30);
      if (i < 0 || i > 3 || j < 0 || j > 3 || Math.abs(l[0] - kpX(i)) > 14 || Math.abs(l[1] - kpY(j)) > 14) return false;
      const k = KEYS[j * 4 + i]; c.props.key = c.props.key === k ? 'none' : k; return true;
    },
    update: (c, refs) => { KEYS.forEach((k, n) => { if (refs['k' + n]) refs['k' + n].setAttribute('fill', c.props.key === k ? '#d94a4a' : '#dfe3e6'); }); },
    read: () => {},
    live: c => [['Key held', c.props.key === 'none' ? 'none' : c.props.key], ['Connects', c.props.key === 'none' ? '–' : 'ROW ' + (1 + ((KEYS.indexOf(c.props.key) / 4) | 0)) + ' ↔ COLUMN ' + (1 + KEYS.indexOf(c.props.key) % 4)]]
  });

  PARTS.keypad.KEYS = KEYS;

  /* ======================= DIP switch (4 positions) ======================= */
  def('dipsw', {
    name: 'DIP switch (4 positions)', cat: 'Switches & output', bounds: [-50, -54, 100, 94], clickable: true, defaults: { s1: false, s2: false, s3: false, s4: false },
    desc: 'Four tiny independent slide switches in one package. Each connects its left pin to its right pin when ON. CLICK a slider to flip it. Handy for setting a binary number, an address or a configuration.',
    props: [1, 2, 3, 4].map(k => ({ key: 's' + k, label: 'Switch ' + k + ' ON', type: 'toggle', live: true })),
    terms: [].concat([1, 2, 3, 4].map(k => ({ n: 'a' + k, x: -40, y: -40 + (k - 1) * 20, label: 'switch ' + k + ' left' })), [1, 2, 3, 4].map(k => ({ n: 'b' + k, x: 40, y: -40 + (k - 1) * 20, label: 'switch ' + k + ' right' }))),
    label: () => '',
    svg: c => {
      let s = '<rect x="-30" y="-50" width="60" height="84" rx="4" fill="#b32d2d" stroke="#6b1a1a"/>';
      for (let k = 1; k <= 4; k++) { const y = -40 + (k - 1) * 20, on = c.props['s' + k]; s += '<line class="lead" x1="-40" y1="' + y + '" x2="-30" y2="' + y + '"/><line class="lead" x1="30" y1="' + y + '" x2="40" y2="' + y + '"/><rect x="-18" y="' + (y - 6) + '" width="36" height="12" rx="2" fill="#7c1f1f"/><rect data-ref="t' + k + '" x="' + (on ? 2 : -18) + '" y="' + (y - 6) + '" width="16" height="12" rx="2" fill="' + (on ? '#f3f3f3' : '#cfcfcf') + '" stroke="#555"/><text class="ic-pin" x="-24" y="' + (y + 2) + '" text-anchor="middle" font-size="6">' + k + '</text>'; }
      return s + '<text class="ic-pin" x="0" y="30" text-anchor="middle" font-size="7">ON →</text>';
    },
    elements: (c, N) => [1, 2, 3, 4].map(k => ({ type: 'R', a: N('a' + k), b: N('b' + k), r: 1e9 })),
    sync: (c, els) => { els.forEach((e, i) => { e.r = c.props['s' + (i + 1)] ? 0.05 : 1e9; }); },
    onClick: (c, pt) => {
      const l = P.rotPt(pt.x - c.x, pt.y - c.y, -c.rot), k = Math.round((l[1] + 40) / 20) + 1; if (k < 1 || k > 4 || Math.abs(l[0]) > 30) return false;
      c.props['s' + k] = !c.props['s' + k]; return true;
    },
    update: (c, refs) => { for (let k = 1; k <= 4; k++) if (refs['t' + k]) { const on = c.props['s' + k]; refs['t' + k].setAttribute('x', on ? 2 : -18); refs['t' + k].setAttribute('fill', on ? '#f3f3f3' : '#cfcfcf'); } },
    read: () => {},
    live: c => [['Switches ON', [1, 2, 3, 4].filter(k => c.props['s' + k]).join(', ') || 'none'], ['Binary (1 = LSB)', [4, 3, 2, 1].map(k => (c.props['s' + k] ? 1 : 0)).join('')]]
  });


  /* ======================= Round 3b: LM393, SCR, 74HC165, 8-bit DAC ======================= */
  // ---- LM393 dual comparator (open-collector outputs)
  {
    const pins = [['O1', 1, 'L', 'OUT1', 'OUT1 (open collector: needs a pull-up resistor)'], ['M1', 2, 'L', 'IN1−', 'IN1− (inverting input)'], ['P1', 3, 'L', 'IN1+', 'IN1+ (non-inverting input)'], ['GND', 4, 'L', 'GND', 'GND'],
      ['P2', 5, 'R', 'IN2+', 'IN2+ (non-inverting input)'], ['M2', 6, 'R', 'IN2−', 'IN2− (inverting input)'], ['O2', 7, 'R', 'OUT2', 'OUT2 (open collector: needs a pull-up resistor)'], ['VCC', 8, 'R', 'VCC', 'VCC (2–36 V)']].map(q => ({ n: q[0], num: q[1], side: q[2], s: q[3], t: q[4] }));
    const lay = dipLayout(pins);
    def('lm393', {
      name: 'LM393 comparator (dual)', cat: 'Analog ICs', bounds: boundsOf(lay), defaults: {}, required: ['VCC', 'GND'],
      desc: 'Two comparators. When IN+ is HIGHER than IN− the output transistor is OFF (the output floats: a pull-up resistor makes it HIGH); when IN+ is LOWER than IN− the output is pulled to GND. The outputs are “open collector”: always add a pull-up resistor (about 10 kΩ) from OUT to VCC. Perfect for light or temperature detectors. Add a resistor from OUT back to IN+ to make a Schmitt trigger.',
      terms: lay.terms, label: () => '',
      svg: c => dipSvg(lay, ['LM393'], 'COMPARATOR', [], false) + ['O1', 'O2'].map(k => '<circle data-ref="o_' + k + '" class="ic-led" cx="' + (lay.pos[k].side * 35) + '" cy="' + (lay.pos[k].y - 4) + '" r="2.6"/>').join(''),
      elements: (c, N) => { c.rt.n = {}; for (const t of lay.terms) c.rt.n[t.n] = N(t.n); return [{ type: 'R', a: c.rt.n.O1, b: c.rt.n.GND, r: 1e9 }, { type: 'R', a: c.rt.n.O2, b: c.rt.n.GND, r: 1e9 }]; },
      tick: (c, els, t, rtm) => {
        const r = c.rt, n = r.n; if (!n) return; const v = rtm.sim.v, g = v[n.GND] || 0; r.powered = (v[n.VCC] - g) >= 2; r.low = [false, false];
        [1, 2].forEach((k, i) => { const low = r.powered && ((v[n['P' + k]] - g) < (v[n['M' + k]] - g) - 0.001); r.low[i] = low; els[i].r = low ? 40 : 1e9; });
      },
      update: (c, refs) => { ['O1', 'O2'].forEach((k, i) => { if (refs['o_' + k]) refs['o_' + k].setAttribute('fill', c.rt.low && c.rt.low[i] ? '#f5b942' : OFF); }); },
      read: (c, els) => { c.rt.i = els[0].i; c.rt.v = els[0].vd; },
      live: c => [['Powered', c.rt.powered ? 'yes' : 'NO: needs VCC and GND'], ['Comparator 1', c.rt.low && c.rt.low[0] ? 'IN+ < IN−: output pulled LOW' : 'IN+ > IN−: output released (HIGH with pull-up)'], ['Comparator 2', c.rt.low && c.rt.low[1] ? 'IN+ < IN−: output pulled LOW' : 'IN+ > IN−: output released (HIGH with pull-up)']]
    });
  }

  // ---- SCR (thyristor)
  def('scr', {
    name: 'SCR thyristor (2N5060)', cat: 'Semiconductors', bounds: [-30, -34, 60, 80], defaults: {},
    desc: 'A diode you can switch ON with a pulse. A brief current into the GATE turns it on; it then keeps conducting from ANODE to CATHODE by itself, even after the gate pulse stops, until the current falls below about 5 mA (the “holding current”). Use it for latching alarms and power control. The gate needs about 0.3 mA or more, through a resistor.',
    terms: [{ n: 'a', x: 0, y: -40, label: 'anode (+)' }, { n: 'k', x: 0, y: 40, label: 'cathode (−)' }, { n: 'g', x: -30, y: 20, label: 'gate' }],
    label: () => '',
    svg: c => '<line class="lead" x1="0" y1="-40" x2="0" y2="-10"/><line class="lead" x1="0" y1="10" x2="0" y2="40"/><path class="dio-tri" d="M-10,-10 L10,-10 L0,10 Z"/><line class="lead thick" x1="-11" y1="10" x2="11" y2="10"/><polyline class="lead" points="-30,20 -14,20 0,10" fill="none"/>' +
      '<text class="ic-pin" x="8" y="-22" font-size="7">A</text><text class="ic-pin" x="8" y="32" font-size="7">K</text><text class="ic-pin" x="-26" y="14" font-size="7">G</text><circle data-ref="led" class="ic-led" cx="16" cy="0" r="3"/>' + lbl(c, 'SCR', 24, 4),
    elements: (c, N) => [{ type: 'D', a: N('a'), b: N('k'), is: diodeIs(0.95, 2), n: 2, off: true }, { type: 'D', a: N('g'), b: N('k'), is: diodeIs(0.75, 2), n: 2 }],
    tick: (c, els) => {
      const r = c.rt, ig = Math.max(0, els[1].i || 0), ia = els[0].i || 0;
      if (!r.on && ig > 0.0003) r.on = true; else if (r.on && ia < 0.005) r.on = false;
      els[0].off = !r.on;
    },
    update: (c, refs) => { if (refs.led) refs.led.setAttribute('fill', c.rt.on ? ON : OFF); },
    read: (c, els) => { c.rt.i = els[0].i; c.rt.v = els[0].vd; c.rt.ig = els[1].i; },
    live: c => [['State', c.rt.on ? 'ON (latched)' : 'OFF (blocking)'], ['Anode current', fmt(Math.abs(c.rt.i || 0), 'A')], ['Gate current', fmt(Math.abs(c.rt.ig || 0), 'A')]]
  });

  // ---- 74HC165 parallel-in / serial-out shift register
  mkIC({
    id: 'hc165', name: '74HC165 parallel-in shift register',
    desc: 'Reads 8 inputs with 2–3 Arduino pins (the opposite of the 74HC595). Pulse /PL LOW to capture D0–D7 into the register. Then, with /CE LOW, each rising edge of CP moves the data along and the next bit appears on Q7 (D7 first, D0 last). Read Q7 with digitalRead() after each pulse (or shiftIn()). Tie /CE to GND, DS to GND and /PL to VCC when not using them. Use it to read 8 buttons or the DIP switch.',
    pins: [['PL', 1, 'L', '/PL', '/PL parallel load (LOW = capture D0–D7)'], ['CP', 2, 'L', 'CP', 'CP shift clock (rising edge)'], ['D4', 3, 'L', 'D4', 'D4 parallel input'], ['D5', 4, 'L', 'D5', 'D5 parallel input'], ['D6', 5, 'L', 'D6', 'D6 parallel input'], ['D7', 6, 'L', 'D7', 'D7 parallel input (first out)'], ['QN7', 7, 'L', '/Q7', '/Q7 inverted serial output'], ['GND', 8, 'L', 'GND', 'GND'],
      ['Q7', 9, 'R', 'Q7', 'Q7 serial output'], ['DS', 10, 'R', 'DS', 'DS serial data in (for daisy-chaining)'], ['D0', 11, 'R', 'D0', 'D0 parallel input (last out)'], ['D1', 12, 'R', 'D1', 'D1 parallel input'], ['D2', 13, 'R', 'D2', 'D2 parallel input'], ['D3', 14, 'R', 'D3', 'D3 parallel input'], ['CE', 15, 'R', '/CE', '/CE clock enable (active LOW, tie to GND)'], ['VCC', 16, 'R', 'VCC', 'VCC']]
      .map(q => ({ n: q[0], num: q[1], side: q[2], s: q[3], t: q[4] })),
    title: ['74HC', '165'], sub: 'PISO SHIFT', inputs: ['PL', 'CP', 'CE', 'DS', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'], outs: ['Q7', 'QN7'],
    init: () => ({ sr: 0 }),
    event: (c, st, sig, lvl, prev, x) => { if (sig === 'CP' && lvl && !prev && x.lv.PL && !x.lv.CE) st.sr = ((st.sr << 1) | (x.lv.DS ? 1 : 0)) & 255; },
    comb: (c, st, x) => { if (!x.lv.PL) st.sr = [0, 1, 2, 3, 4, 5, 6, 7].reduce((a, k) => a | ((x.lv['D' + k] ? 1 : 0) << k), 0); const q = (st.sr >> 7) & 1; return { Q7: q, QN7: q ? 0 : 1 }; },
    live: c => { const l = c.rt.lv, rows = [['Register D7…D0', c.rt.st.sr.toString(2).padStart(8, '0')], ['Q7', c.rt.out.Q7 ? 'HIGH' : 'low']]; if (!l.PL) rows.push(['/PL', 'LOW: loading D0–D7 continuously']); if (l.CE) rows.push(['/CE', 'HIGH: clock disabled. Tie to GND!']); return rows; }
  });

  // ---- 8-bit DAC
  mkIC({
    id: 'dac8', name: '8-bit DAC (R-2R)', cat: 'Analog ICs', rs: 100, analog: ['OUT'], imax: 0.01,
    desc: 'Digital-to-analog converter: turns an 8-bit number on D0–D7 (D7 = 128 … D0 = 1) into a voltage: OUT = VREF × number ÷ 256. Drive D0–D7 from 8 Arduino pins (or a 74HC595) and write a waveform with code. Connect VREF to 5 V for a 0–5 V range. The output is weak (a few mA): buffer it with an op-amp for loads.',
    pins: [0, 1, 2, 3, 4, 5, 6, 7].map(k => ({ n: 'D' + k, num: k + 1, side: 'L', s: 'D' + k, t: 'D' + k + ' data bit (value ' + (1 << k) + ')' })).concat([
      { n: 'VCC', num: 16, side: 'R', s: 'VCC', t: 'VCC' }, { n: 'VREF', num: 15, side: 'R', s: 'VREF', t: 'VREF reference voltage (full scale)' }, { n: 'OUT', num: 14, side: 'R', s: 'OUT', t: 'OUT analog output' }, { n: 'GND', num: 13, side: 'R', s: 'GND', t: 'GND' }]),
    title: ['DAC', '8-BIT'], sub: 'R-2R', inputs: ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'], outs: ['OUT'],
    comb: (c, st, x) => { const code = [0, 1, 2, 3, 4, 5, 6, 7].reduce((a, k) => a | ((x.lv['D' + k] ? 1 : 0) << k), 0), vref = Math.min(x.vcc, Math.max(0, x.volt('VREF'))); st.code = code; st.vout = vref * code / 256; return { OUT: st.vout }; },
    live: c => [['Input number', c.rt.st.code + ' (' + c.rt.st.code.toString(2).padStart(8, '0') + ')'], ['Output', fmt(c.rt.st.vout, 'V')]]
  });

  /* ======================= Round 3c: transformer ======================= */
  const XF_RATIOS = { '1': ['1 : 1', 1], '2': ['2 : 1 (step down)', 2], '4': ['4 : 1 (step down)', 4], '10': ['10 : 1 (step down)', 10], '0.5': ['1 : 2 (step up)', 0.5], '0.1': ['1 : 10 (step up)', 0.1] };
  def('transformer', {
    name: 'Transformer', cat: 'Power', bounds: [-50, -40, 100, 80], defaults: { ratio: '2', l1: 10 },
    desc: 'Two coils on one iron core. An AC voltage on the PRIMARY (left) appears on the SECONDARY (right) multiplied by the secondary ÷ primary turns: a 2 : 1 transformer halves the voltage, a 1 : 2 doubles it. It only works with AC (a steady DC gives nothing on the secondary). The two sides are NOT connected to each other, so connect one secondary pin to ground yourself. Dots mark the pins that swing together. Power out can never exceed power in: a step-up transformer gives less current.',
    props: [{ key: 'ratio', label: 'Turns ratio (primary : secondary)', type: 'select', options: Object.keys(XF_RATIOS).map(k => ({ v: k, l: XF_RATIOS[k][0] })) },
      { key: 'l1', label: 'Primary inductance', type: 'select', options: [{ v: 1, l: '1 H (small)' }, { v: 10, l: '10 H (typical)' }, { v: 100, l: '100 H (large)' }] }],
    terms: [{ n: 'p1', x: -40, y: -20, label: 'primary 1 (dot)' }, { n: 'p2', x: -40, y: 20, label: 'primary 2' }, { n: 's1', x: 40, y: -20, label: 'secondary 1 (dot)' }, { n: 's2', x: 40, y: 20, label: 'secondary 2' }],
    label: () => '',
    svg: c => '<path class="lead" d="M-40,-20 H-22 M-40,20 H-22 M40,-20 H22 M40,20 H22"/>' +
      '<path class="coil" d="M-22,-20 a5,5 0 0 1 0,10 a5,5 0 0 1 0,10 a5,5 0 0 1 0,10 a5,5 0 0 1 0,10" fill="none" transform="translate(0,0)"/><path class="coil" d="M22,-20 a5,5 0 0 0 0,10 a5,5 0 0 0 0,10 a5,5 0 0 0 0,10 a5,5 0 0 0 0,10" fill="none"/>' +
      '<line class="lead thick" x1="-3" y1="-24" x2="-3" y2="24"/><line class="lead thick" x1="3" y1="-24" x2="3" y2="24"/><circle cx="-30" cy="-26" r="2" fill="#f5b942"/><circle cx="30" cy="-26" r="2" fill="#f5b942"/>' +
      '<text class="ic-pin" x="0" y="38" text-anchor="middle" font-size="8">' + ((XF_RATIOS[c.props.ratio] || XF_RATIOS['1'])[0].split(' ')[0] + ' : ' + (XF_RATIOS[c.props.ratio] || XF_RATIOS['1'])[0].split(' ')[2]) + '</text>',
    // the windings have a little wire resistance (DCR): without it a DC source would push the primary current up forever
    elements: (c, N) => {
      const n = (XF_RATIOS[c.props.ratio] || XF_RATIOS['1'])[1], l1 = +c.props.l1 || 10, rp = 6 * Math.sqrt(l1), rs = rp / (n * n), ip = N.alloc(), is = N.alloc();
      return [{ type: 'T', a1: ip, b1: N('p2'), a2: is, b2: N('s2'), l1, l2: l1 / (n * n), k: 0.99, i01: c.rt.ip1 || 0, i02: c.rt.ip2 || 0 }, { type: 'R', a: N('p1'), b: ip, r: rp }, { type: 'R', a: N('s1'), b: is, r: Math.max(0.05, rs) }];
    },
    read: (c, els) => { const e = els[0]; c.rt.v = e.v1 + els[1].vd; c.rt.i = e.i1; c.rt.v2 = e.v2 + els[2].vd; c.rt.i2 = e.i2; c.rt.ip1 = e.i1; c.rt.ip2 = e.i2; },
    live: c => [['Primary', fmt(c.rt.v || 0, 'V') + '  ' + fmt(c.rt.i || 0, 'A')], ['Secondary', fmt(c.rt.v2 || 0, 'V') + '  ' + fmt(c.rt.i2 || 0, 'A')], ['Ratio', 'primary : secondary = ' + (XF_RATIOS[c.props.ratio] || XF_RATIOS['1'])[0]]]
  });

  /* ======================= Round 3d: ADC, DHT11/22, I²C LCD, OLED ======================= */
  // ---- 8-bit ADC
  mkIC({
    id: 'adc8', name: '8-bit ADC (parallel)', cat: 'Analog ICs',
    defaults: { mode: 'cont' }, props: [{ key: 'mode', label: 'Conversion', type: 'select', options: [{ v: 'cont', l: 'Continuous (always converting)' }, { v: 'start', l: 'One conversion per START pulse' }] }],
    desc: 'Analog-to-digital converter: measures the voltage on VIN and shows it as an 8-bit number on D0–D7: code = VIN ÷ VREF × 255 (0 V = 0, VREF = 255). Connect VREF to the supply (or leave it open to use VCC). In “continuous” mode the number follows the input all the time; in “START pulse” mode it only samples when START goes HIGH, and EOC (end of conversion) is LOW while START is HIGH. Read the 8 bits with an Arduino, or light 8 LEDs to see the binary number.',
    pins: [['VIN', 1, 'L', 'VIN', 'VIN analog input'], ['VREF', 2, 'L', 'VREF', 'VREF reference (full scale); open = use VCC'], ['START', 3, 'L', 'START', 'START (rising edge samples, in START-pulse mode)'], ['EOC', 4, 'L', 'EOC', 'EOC end of conversion (HIGH = result ready)'], ['D7', 5, 'L', 'D7', 'D7 (MSB, value 128)'], ['D6', 6, 'L', 'D6', 'D6 (64)'], ['GND', 7, 'L', 'GND', 'GND'],
      ['D0', 8, 'R', 'D0', 'D0 (LSB, value 1)'], ['D1', 9, 'R', 'D1', 'D1 (2)'], ['D2', 10, 'R', 'D2', 'D2 (4)'], ['D3', 11, 'R', 'D3', 'D3 (8)'], ['D4', 12, 'R', 'D4', 'D4 (16)'], ['D5', 13, 'R', 'D5', 'D5 (32)'], ['VCC', 14, 'R', 'VCC', 'VCC (4.5–6 V)']].map(q => ({ n: q[0], num: q[1], side: q[2], s: q[3], t: q[4] })),
    title: ['ADC', '8-BIT'], sub: 'PARALLEL', inputs: ['START'], outs: ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'EOC'], minV: 3, imax: 0.025,
    init: () => ({ code: 0, vin: 0 }),
    event: (c, st, sig, lvl, prev, x) => { if (sig === 'START' && lvl && !prev) { const vref = x.volt('VREF') > 0.1 ? Math.min(x.vcc, x.volt('VREF')) : x.vcc; st.code = Math.max(0, Math.min(255, Math.round(x.volt('VIN') / vref * 255))); } },
    comb: (c, st, x) => {
      const vref = x.volt('VREF') > 0.1 ? Math.min(x.vcc, x.volt('VREF')) : x.vcc; st.vin = x.volt('VIN'); st.vref = vref;
      if (c.props.mode !== 'start') st.code = Math.max(0, Math.min(255, Math.round(st.vin / vref * 255)));
      const o = {}; for (let k = 0; k < 8; k++) o['D' + k] = (st.code >> k) & 1; o.EOC = c.props.mode === 'start' && x.lv.START ? 0 : 1; return o;
    },
    live: c => [['Input', fmt(c.rt.st.vin, 'V') + ' of ' + fmt(c.rt.st.vref, 'V')], ['Code', c.rt.st.code + '  (' + c.rt.st.code.toString(2).padStart(8, '0') + ')']]
  });

  // ---- DHT11 / DHT22
  def('dht11', {
    name: 'Temperature & humidity (DHT11 / DHT22)', cat: 'Sensors', bounds: [-34, -42, 68, 96], defaults: { model: '11', temp: 24, hum: 55 },
    desc: 'Measures temperature AND humidity and sends them over ONE data wire. Read it from the Arduino with the DHT library: DHT dht(2, DHT11); dht.begin(); then dht.readTemperature() (°C) and dht.readHumidity() (%). The DHT11 is whole numbers (0–50 °C, 20–90 %); the DHT22 is more accurate (one decimal, −40…80 °C, 0–100 %). The model in the sketch must match the sensor. Use the sliders to change the room. Wait 2 seconds between reads, as in real life.',
    props: [{ key: 'model', label: 'Sensor model', type: 'select', options: [{ v: '11', l: 'DHT11 (whole numbers)' }, { v: '22', l: 'DHT22 / AM2302 (more accurate)' }] },
      { key: 'temp', label: 'Temperature', type: 'range', unit: ' °C', min: -20, max: 80, step: 0.5, live: true }, { key: 'hum', label: 'Humidity', type: 'range', unit: ' %', min: 0, max: 100, step: 1, live: true }],
    terms: [{ n: 'vcc', x: -20, y: 60, label: 'VCC (3–5.5 V)' }, { n: 'data', x: 0, y: 60, label: 'DATA (single wire to the Arduino)' }, { n: 'gnd', x: 20, y: 60, label: 'GND' }],
    label: () => '',
    svg: c => '<line class="lead" x1="-20" y1="44" x2="-20" y2="60"/><line class="lead" x1="0" y1="44" x2="0" y2="60"/><line class="lead" x1="20" y1="44" x2="20" y2="60"/>' +
      '<rect x="-30" y="-40" width="60" height="84" rx="4" fill="' + (c.props.model === '22' ? '#e8e6df' : '#3f8fd2') + '" stroke="#222"/>' + Array.from({ length: 8 }, (_, i) => '<rect x="-20" y="' + (-32 + i * 6) + '" width="40" height="3" rx="1.5" fill="#0006"/>').join('') +
      '<text data-ref="val" class="ic-t" x="0" y="30" text-anchor="middle" font-size="9" fill="' + (c.props.model === '22' ? '#222' : '#fff') + '"></text><text class="ic-pin" x="0" y="40" text-anchor="middle" font-size="6" fill="' + (c.props.model === '22' ? '#222' : '#fff') + '">DHT' + (c.props.model === '22' ? '22' : '11') + '</text>',
    elements: (c, N) => { c.rt.n = { vcc: N('vcc'), data: N('data'), gnd: N('gnd') }; return [{ type: 'R', a: N('vcc'), b: N('gnd'), r: 5000 }]; },
    tick: (c, els, t, rtm) => { const n = c.rt.n; if (!n) return; const v = rtm.sim.v; c.rt.powered = (v[n.vcc] - v[n.gnd]) >= 3; },
    update: (c, refs) => { if (refs.val) refs.val.textContent = c.props.temp + '°C ' + c.props.hum + '%'; },
    read: (c, els) => { c.rt.i = els[0].i; c.rt.v = els[0].vd; },
    live: c => [['Powered', c.rt.powered ? 'yes' : 'NO: VCC needs 3–5 V'], ['Temperature', c.props.temp + ' °C'], ['Humidity', c.props.hum + ' %']]
  });

  // ---- I²C LCD (PCF8574 backpack) and SSD1306 OLED: shared wiring check
  const i2cWired = (c, rtm) => { const n = c.rt.n; return rtm.ard && rtm.ard.nodes[18] !== undefined && rtm.ard.nodes[19] !== undefined && n.SDA === rtm.ard.nodes[18] && n.SCL === rtm.ard.nodes[19]; };
  def('lcdi2c', {
    name: 'I²C LCD (16×2 / 20×4)', cat: 'Display & motion', bounds: [-104, -52, 208, 120], z: 4, defaults: { size: '16x2', addr: 39 },
    desc: 'A character LCD with a small I²C “backpack”, so it needs only FOUR wires: GND, VCC (5 V), SDA to Arduino A4 and SCL to Arduino A5. Use the LiquidCrystal_I2C library: LiquidCrystal_I2C lcd(0x27, 16, 2); lcd.init(); lcd.backlight(); lcd.print("Hello"). The address in the sketch must match the module (0x27 or 0x3F). Without lcd.backlight() the text is too dark to read.',
    props: [{ key: 'size', label: 'Size', type: 'select', options: [{ v: '16x2', l: '16 × 2' }, { v: '20x4', l: '20 × 4' }] }, { key: 'addr', label: 'I²C address', type: 'select', options: [{ v: 39, l: '0x27' }, { v: 63, l: '0x3F' }] }],
    terms: [{ n: 'GND', x: -30, y: 60, label: 'GND' }, { n: 'VCC', x: -10, y: 60, label: 'VCC (5 V)' }, { n: 'SDA', x: 10, y: 60, label: 'SDA (to Arduino A4)' }, { n: 'SCL', x: 30, y: 60, label: 'SCL (to Arduino A5)' }],
    label: () => '',
    svg: c => { const big = c.props.size === '20x4', rows = big ? 4 : 2; let s = '<rect class="lcd-pcb" x="-100" y="-48" width="200" height="104" rx="6"/><rect class="lcd-bezel" x="-88" y="-38" width="176" height="' + (big ? 84 : 64) + '" rx="3"/><rect data-ref="screen" class="lcd-screen" x="-82" y="-32" width="164" height="' + (big ? 72 : 52) + '"/>';
      for (let r = 0; r < rows; r++) s += '<text data-ref="row' + r + '" class="lcd-text" x="-76" y="' + (-18 + r * (big ? 17 : 24)) + '" xml:space="preserve" textLength="152" lengthAdjust="spacingAndGlyphs" style="font-size:' + (big ? 13 : 17) + 'px"></text>';
      s += '<rect class="hdr" x="-42" y="52" width="92" height="10" rx="1"/>'; ['GND', 'VCC', 'SDA', 'SCL'].forEach((n, i) => { s += '<text class="lcd-pin" x="' + (-30 + i * 20) + '" y="50" text-anchor="middle">' + n + '</text><line class="lead" x1="' + (-30 + i * 20) + '" y1="56" x2="' + (-30 + i * 20) + '" y2="60"/>'; });
      return s + '<text data-ref="msg" class="lcd-msg" x="0" y="-4" text-anchor="middle"></text>'; },
    elements: (c, N) => { c.rt.n = { GND: N('GND'), VCC: N('VCC'), SDA: N('SDA'), SCL: N('SCL') }; return []; },
    tick: (c, els, t, rtm) => {
      const r = c.rt, n = r.n; if (!n) return; const v = rtm.sim.v, objs = rtm.interp ? rtm.interp.libObjects.filter(o => o.__lib === 'LCD' && o.i2c) : [];
      r.powered = (v[n.VCC] - v[n.GND]) > 4 && Math.abs(v[n.GND]) < 0.3; let status = '', chosen = null;
      if (!objs.length) status = 'No LiquidCrystal_I2C object in the sketch yet.';
      else if (!r.powered) status = 'No power: connect VCC to 5 V and GND to ground.';
      else if (!i2cWired(c, rtm)) status = 'Wiring: SDA must go to Arduino A4 and SCL to A5.';
      else { chosen = objs.find(o => o.addr === +c.props.addr); if (!chosen) status = 'Address: the sketch uses 0x' + objs[0].addr.toString(16).toUpperCase() + ' but this module is 0x' + (+c.props.addr).toString(16).toUpperCase() + '. Change one of them.'; }
      r.obj = chosen; r.status = chosen ? (chosen.backlight ? 'OK' : 'Backlight off: add lcd.backlight(); in setup().') : status;
    },
    update: (c, refs) => {
      const o = c.rt.obj, nb = s => s.replace(/ /g, '\u00a0'), rows = c.props.size === '20x4' ? 4 : 2;
      if (refs.screen) { refs.screen.classList.toggle('on', !!o && !!o.backlight); }
      for (let r = 0; r < rows; r++) if (refs['row' + r]) refs['row' + r].textContent = o && o.display && o.backlight ? nb((o.lines[r] || '').padEnd(rows === 4 ? 20 : 16, ' ').slice(0, rows === 4 ? 20 : 16)) : '';
      if (refs.msg) refs.msg.textContent = '';
    },
    read: () => {},
    live: c => [['Powered', c.rt.powered ? 'yes' : 'NO'], ['Status', c.rt.status || 'run the sketch']]
  });

  def('oled', {
    name: 'OLED 128×64 (SSD1306, I²C)', cat: 'Display & motion', bounds: [-110, -64, 220, 150], z: 4, defaults: {},
    desc: 'A small, sharp black-and-white graphic screen with 128 × 64 pixels and four I²C wires: GND, VCC, SDA to Arduino A4 and SCL to A5. Use the Adafruit_SSD1306 library: Adafruit_SSD1306 display(128, 64, &Wire, -1); display.begin(SSD1306_SWITCHCAPVCC, 0x3C); then clearDisplay(), setTextSize(), setCursor(), println(), drawPixel / drawLine / drawRect / fillRect / drawCircle, and finally display() to show what you drew.',
    terms: [{ n: 'GND', x: -30, y: 90, label: 'GND' }, { n: 'VCC', x: -10, y: 90, label: 'VCC (3.3–5 V)' }, { n: 'SCL', x: 10, y: 90, label: 'SCL (to Arduino A5)' }, { n: 'SDA', x: 30, y: 90, label: 'SDA (to Arduino A4)' }],
    label: () => '',
    svg: c => '<rect x="-110" y="-64" width="220" height="140" rx="6" fill="#16306b" stroke="#0b1a3d"/><rect x="-98" y="-52" width="196" height="100" rx="3" fill="#050505" stroke="#222"/>' +
      '<g transform="translate(-96,-48)"><path data-ref="px" d="" fill="#8fd8ff"/></g><text data-ref="msg" class="lcd-msg" x="0" y="0" text-anchor="middle" fill="#9fb0a8" style="font-size:9px"></text>' +
      '<rect class="hdr" x="-42" y="76" width="92" height="10" rx="1"/>' + ['GND', 'VCC', 'SCL', 'SDA'].map((n, i) => '<text class="lcd-pin" x="' + (-30 + i * 20) + '" y="72" text-anchor="middle">' + n + '</text><line class="lead" x1="' + (-30 + i * 20) + '" y1="82" x2="' + (-30 + i * 20) + '" y2="90"/>').join(''),
    elements: (c, N) => { c.rt.n = { GND: N('GND'), VCC: N('VCC'), SDA: N('SDA'), SCL: N('SCL') }; return []; },
    tick: (c, els, t, rtm) => {
      const r = c.rt, n = r.n; if (!n) return; const v = rtm.sim.v, objs = rtm.interp ? rtm.interp.libObjects.filter(o => o.__lib === 'OLED') : [];
      r.powered = (v[n.VCC] - v[n.GND]) > 2.8 && Math.abs(v[n.GND]) < 0.3; let status = '', chosen = null;
      if (!objs.length) status = 'No Adafruit_SSD1306 object in the sketch yet.';
      else if (!r.powered) status = 'No power: connect VCC and GND.';
      else if (!i2cWired(c, rtm)) status = 'Wiring: SDA must go to Arduino A4 and SCL to A5.';
      else { chosen = objs[0]; if (!chosen.inited) status = 'Call display.begin(SSD1306_SWITCHCAPVCC, 0x3C) in setup().'; }
      r.obj = chosen && chosen.inited ? chosen : null; r.status = r.obj ? 'OK' : status;
    },
    update: (c, refs) => {
      const o = c.rt.obj, r = c.rt;
      if (refs.msg) refs.msg.textContent = o ? '' : (r.status || '');
      if (!refs.px) return; const key = o ? o.ver + ':' + (o.invert ? 1 : 0) : 'off';
      if (r.drawn === key) return; r.drawn = key;
      if (!o) { refs.px.setAttribute('d', ''); return; }
      const W = o.w, H = o.h, k = 1.5, inv = o.invert; let d = '';
      for (let y = 0; y < H; y++) { let x = 0; while (x < W) { const on = (o.shown[y * W + x] ? 1 : 0) ^ (inv ? 1 : 0); if (!on) { x++; continue; } let x2 = x; while (x2 < W && ((o.shown[y * W + x2] ? 1 : 0) ^ (inv ? 1 : 0))) x2++; d += 'M' + (x * k) + ',' + (y * k) + 'h' + ((x2 - x) * k) + 'v' + k + 'h-' + ((x2 - x) * k) + 'z'; x = x2; } }
      refs.px.setAttribute('d', d);
    },
    read: () => {},
    live: c => [['Powered', c.rt.powered ? 'yes' : 'NO'], ['Status', c.rt.status || 'run the sketch']]
  });
})(typeof window !== 'undefined' ? window : globalThis);
