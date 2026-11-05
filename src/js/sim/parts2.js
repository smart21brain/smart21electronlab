/* ---------------------------------------------------------------
   Smart21 ElectroLab — parts, round 2
   Op-amp, PNP transistor, MOSFET, Zener diode, NTC thermistor,
   relay, RGB LED and the 74HC595 shift register.
   Loaded after parts.js (it registers itself in S21.Parts).
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const P = S21.Parts;
  if (!P || !P.def) return;
  const { def, lbl, fmt, diodeIs, PARTS } = P;
  if (PARTS.opamp) return;                       // already registered

  /* ======================= ANALOG IC: op-amp ======================= */
  const OA_RAILS = {
    lm358: { name: 'LM358 (single supply)', mlo: 0.05, mhi: 1.5, note: 'output swings from about 0 V up to V+ − 1.5 V' },
    rr: { name: 'Rail-to-rail (MCP6002)', mlo: 0.05, mhi: 0.05, note: 'output swings almost the full supply' },
    lm741: { name: 'Classic (LM741, ±supply)', mlo: 2, mhi: 2, note: 'output stops about 2 V short of each rail' }
  };
  def('opamp', {
    name: 'Op-amp', cat: 'Analog ICs', bounds: [-44, -44, 88, 88], defaults: { rail: 'lm358' },
    desc: 'Operational amplifier: the output tries to make V(IN+) − V(IN−) ≈ 0 through feedback, or swings to a rail when there is no feedback (comparator). It needs power on V+ and V−: connect V− to ground for single-supply use. Gain 100 000, output limited to the supply range.',
    props: [{ key: 'rail', label: 'Model', type: 'select', options: Object.keys(OA_RAILS).map(k => ({ v: k, l: OA_RAILS[k].name })) }],
    terms: [{ n: 'p', x: -40, y: -20, label: 'IN+ (non-inverting)' }, { n: 'n', x: -40, y: 20, label: 'IN− (inverting)' }, { n: 'o', x: 40, y: 0, label: 'OUT' },
            { n: 'vp', x: 0, y: -40, label: 'V+ (positive supply)' }, { n: 'vn', x: 0, y: 40, label: 'V− (negative supply / ground)' }],
    label: c => '',
    svg: c => '<line class="lead" x1="-40" y1="-20" x2="-28" y2="-20"/><line class="lead" x1="-40" y1="20" x2="-28" y2="20"/><line class="lead" x1="32" y1="0" x2="40" y2="0"/>' +
      '<line class="lead" x1="0" y1="-40" x2="0" y2="-19"/><line class="lead" x1="0" y1="40" x2="0" y2="19"/>' +
      '<path class="gate-body" d="M-28,-36 L32,0 L-28,36 Z"/><text class="led-plus" x="-21" y="-16" text-anchor="middle">+</text><text class="led-plus" x="-21" y="24" text-anchor="middle">−</text>' +
      '<text class="ic-pin" x="7" y="-24">V+</text><text class="ic-pin" x="7" y="32">V−</text>' +
      '<circle data-ref="st" class="ic-led" cx="18" cy="-9" r="3"/>' + lbl(c, 'op-amp', -2, 52),
    elements: (c, N) => { c.rt.n = { p: N('p'), n: N('n'), o: N('o'), vp: N('vp'), vn: N('vn') }; const r = OA_RAILS[c.props.rail] || OA_RAILS.lm358;
      return [{ type: 'OA', p: N('p'), n: N('n'), o: N('o'), vp: N('vp'), vn: N('vn'), gain: 1e5, ro: 50, mlo: r.mlo, mhi: r.mhi }]; },
    sync: (c, els) => { const r = OA_RAILS[c.props.rail] || OA_RAILS.lm358; els[0].mlo = r.mlo; els[0].mhi = r.mhi; },
    update: (c, refs) => { if (refs.st) refs.st.setAttribute('fill', c.rt.state === 'lin' ? '#2fe27a' : (c.rt.state === 'H' || c.rt.state === 'L') ? '#f5b942' : '#31403a'); },
    read: (c, els) => { c.rt.state = els[0].state; c.rt.vd = els[0].vd; c.rt.vo = els[0].vo; c.rt.i = els[0].i; c.rt.v = els[0].vo; },
    check: (c, els, rtm) => { if (Math.abs(els[0].i) > 0.04) rtm.alert('oaload' + c.id, 'An op-amp output is supplying ' + (Math.abs(els[0].i) * 1000).toFixed(0) + ' mA. Real op-amps manage about 20 mA: add a bigger series resistor or a transistor buffer.', 'warn'); }
  });
  PARTS.opamp.rails = OA_RAILS;

  /* ======================= PNP transistor ======================= */
  def('pnp', {
    name: 'PNP transistor', cat: 'Semiconductors', desc: 'The mirror image of the NPN: it turns ON when the base is pulled about 0.7 V BELOW the emitter. Used as a “high-side” switch with the emitter on the positive rail.',
    terms: [{ n: 'c', x: 20, y: -20, label: 'collector' }, { n: 'b', x: -20, y: 0, label: 'base' }, { n: 'e', x: 20, y: 20, label: 'emitter' }],
    defaults: { beta: 100 },
    props: [{ key: 'beta', label: 'Gain (β)', type: 'number', min: 10, max: 500, step: 10 }],
    label: c => '',
    svg: c => '<circle class="q-ring" cx="4" cy="0" r="20"/><line class="lead" x1="-20" y1="0" x2="-5" y2="0"/><line class="lead thick" x1="-5" y1="-11" x2="-5" y2="11"/>' +
      '<polyline class="lead" points="-5,-6 20,-14 20,-20" fill="none"/><polyline class="lead" points="-5,6 20,14 20,20" fill="none"/>' +
      '<path class="q-arrow" d="M0,7.6 L5.03,13.4 L7.47,5.8 Z"/>' + lbl(c, 'PNP', -4, -26),
    elements: (c, N) => [{ type: 'Q', c: N('c'), b: N('b'), e: N('e'), is: 1e-14, bf: c.props.beta || 100, br: 2, pol: -1 }],
    sync: (c, els) => { els[0].bf = c.props.beta || 100; },
    read: (c, els) => { c.rt.ic = -els[0].ic; c.rt.ib = -els[0].ib; c.rt.vce = els[0].vce; c.rt.vbe = els[0].vbe; c.rt.i = -els[0].ic; c.rt.v = els[0].vce; }
  });

  /* ======================= MOSFET ======================= */
  const MOS_MODELS = {
    logic: { name: 'Logic-level power (IRLZ44N-like)', vth: 1.8, kp: 10, pmax: 20, note: 'fully ON with 5 V on the gate' },
    std: { name: 'Standard power (IRF540-like)', vth: 3.8, kp: 4, pmax: 20, note: 'needs 10 V on the gate: weak at 5 V' },
    small: { name: 'Small signal (2N7000-like)', vth: 2.1, kp: 0.15, pmax: 0.25, note: 'switches up to ~200 mA' }
  };
  def('mosfet', {
    name: 'MOSFET', cat: 'Semiconductors', desc: 'A voltage-controlled switch: almost no gate current. N-channel: the load goes between + and DRAIN, SOURCE to ground; it turns ON when the gate is above the threshold voltage (Vth). P-channel is the high-side opposite. A built-in body diode conducts source → drain (N) so it also catches inductive kicks.',
    terms: [{ n: 'd', x: 20, y: -20, label: 'drain' }, { n: 'g', x: -20, y: 0, label: 'gate' }, { n: 's', x: 20, y: 20, label: 'source' }],
    defaults: { channel: 'n', model: 'logic' },
    props: [{ key: 'channel', label: 'Channel', type: 'select', options: [{ v: 'n', l: 'N-channel' }, { v: 'p', l: 'P-channel' }] },
            { key: 'model', label: 'Model', type: 'select', options: Object.keys(MOS_MODELS).map(k => ({ v: k, l: MOS_MODELS[k].name })) }],
    label: c => '',
    svg: c => {
      const n = c.props.channel !== 'p';
      return '<circle class="q-ring" cx="4" cy="0" r="20"/><line class="lead" x1="-20" y1="0" x2="-7" y2="0"/><line class="lead thick" x1="-7" y1="-12" x2="-7" y2="12"/>' +
        '<line class="lead thick" x1="-2" y1="-14" x2="-2" y2="-7"/><line class="lead thick" x1="-2" y1="-4" x2="-2" y2="4"/><line class="lead thick" x1="-2" y1="7" x2="-2" y2="14"/>' +
        '<polyline class="lead" points="-2,-11 20,-11 20,-20" fill="none"/><polyline class="lead" points="-2,11 20,11 20,20" fill="none"/><polyline class="lead" points="-2,0 10,0 10,11" fill="none"/>' +
        '<path class="q-arrow" d="' + (n ? 'M-2,0 L4,-3 L4,3 Z' : 'M9,0 L3,-3 L3,3 Z') + '"/>' + lbl(c, n ? 'N-MOS' : 'P-MOS', -4, -26);
    },
    elements: (c, N) => {
      const m = MOS_MODELS[c.props.model] || MOS_MODELS.logic, n = c.props.channel !== 'p';
      const dioIs = 1e-9;
      return [{ type: 'M', d: N('d'), g: N('g'), s: N('s'), kp: m.kp, vth: m.vth, lam: 0.02, pol: n ? 1 : -1 },
              n ? { type: 'D', a: N('s'), b: N('d'), is: dioIs, n: 1.75 } : { type: 'D', a: N('d'), b: N('s'), is: dioIs, n: 1.75 }];
    },
    sync: (c, els) => { const m = MOS_MODELS[c.props.model] || MOS_MODELS.logic; els[0].kp = m.kp; els[0].vth = m.vth; },
    read: (c, els) => { const m = els[0]; c.rt.id = m.i + (els[1].i * (c.props.channel === 'p' ? 1 : -1)); c.rt.i = c.rt.id; c.rt.vgs = (c.props.channel === 'p' ? -1 : 1) * m.vgs; c.rt.vds = m.vds; c.rt.v = m.vds; c.rt.on = m.on; },
    check: (c, els, rtm) => { const m = MOS_MODELS[c.props.model] || MOS_MODELS.logic; if (Math.abs(c.rt.id || 0) > m.pmax) rtm.alert('mosi' + c.id, 'A MOSFET carries ' + Math.abs(c.rt.id).toFixed(1) + ' A, more than this model can handle (' + m.pmax + ' A). Use a bigger MOSFET or a larger load resistance.', 'warn'); }
  });
  PARTS.mosfet.models = MOS_MODELS;

  /* ======================= Zener diode ======================= */
  const ISZ = 1e-12, VTH = 0.025852;
  const zenerBv = vz => vz - VTH * Math.log(5e-3 / ISZ);       // reverse knee so that the diode holds vz at 5 mA
  def('zener', {
    name: 'Zener diode', cat: 'Semiconductors', desc: 'Conducts forward like a diode (0.7 V), but in REVERSE it also conducts once the voltage reaches its Zener voltage and then holds that voltage steady. Put it in reverse across the load, with a series resistor to limit the current: a simple voltage regulator.',
    terms: [{ n: 'a', x: -20, y: 0, label: 'anode' }, { n: 'k', x: 20, y: 0, label: 'cathode (bar)' }],
    defaults: { vz: 5.1 },
    props: [{ key: 'vz', label: 'Zener voltage', type: 'eng', unit: 'V', min: 1.8, max: 75 }],
    label: c => fmt(c.props.vz, 'V'),
    svg: c => '<line class="lead" x1="-20" y1="0" x2="20" y2="0"/><path class="dio-tri" d="M-8,-10 L8,0 L-8,10 Z"/><polyline class="lead thick" points="4,-13 8,-10 8,10 12,13" fill="none"/>' + lbl(c, fmt(c.props.vz, 'V') + ' Zener', 0, -18),
    elements: (c, N) => [{ type: 'D', a: N('a'), b: N('k'), is: 1e-10, n: 1.7, bv: zenerBv(c.props.vz), isz: ISZ }],
    sync: (c, els) => { els[0].bv = zenerBv(c.props.vz); },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; },
    check: (c, els, rtm) => { if (Math.abs(els[0].vd * els[0].i) > 0.5) rtm.alert('zp' + c.id, 'A Zener diode is dissipating ' + Math.abs(els[0].vd * els[0].i).toFixed(2) + ' W; a small one is rated for about 0.5 W. Increase the series resistor.', 'warn'); }
  });

  /* ======================= NTC thermistor ======================= */
  const ntcR = p => p.r25 * Math.exp(p.beta * (1 / (p.temp + 273.15) - 1 / 298.15));
  def('ntc', {
    name: 'Thermistor (NTC)', cat: 'Sensors', desc: 'A resistor whose resistance FALLS as it gets hotter: R = R25 · e^(β·(1/T − 1/298 K)). Use it in a voltage divider and read the middle with analogRead(). The slider sets the temperature.',
    terms: [{ n: 'a', x: -40, y: 0 }, { n: 'b', x: 40, y: 0 }],
    defaults: { r25: 10000, beta: 3950, temp: 25 },
    props: [{ key: 'r25', label: 'Resistance at 25 °C', type: 'eng', unit: 'Ω', min: 100, max: 1e6 },
            { key: 'beta', label: 'Beta (β)', type: 'number', min: 2000, max: 6000, step: 50 },
            { key: 'temp', label: 'Temperature', type: 'range', unit: ' °C', min: -20, max: 150, step: 1, live: true }],
    label: c => '',
    svg: c => '<line class="lead" x1="-40" y1="0" x2="-22" y2="0"/><line class="lead" x1="22" y1="0" x2="40" y2="0"/><rect class="rbody" x="-22" y="-8" width="44" height="16" rx="3"/>' +
      '<polyline class="lead" points="-16,14 -10,14 14,-14" fill="none"/><rect data-ref="heat" class="heat" x="-18" y="11" width="36" height="4" rx="2" opacity="0"/>' + lbl(c, 'NTC ' + c.props.temp + '°C', 0, -14),
    elements: (c, N) => [{ type: 'R', a: N('a'), b: N('b'), r: ntcR(c.props) }],
    sync: (c, els) => { els[0].r = ntcR(c.props); },
    update: (c, refs) => { if (refs.heat) { const k = Math.max(0, Math.min(1, (c.props.temp + 20) / 170)); refs.heat.setAttribute('opacity', 1); refs.heat.setAttribute('fill', 'hsl(' + (220 - 220 * k).toFixed(0) + ',85%,55%)'); } },
    read: (c, els) => { c.rt.v = els[0].vd; c.rt.i = els[0].i; c.rt.r = els[0].r; }
  });
  PARTS.ntc.resistance = ntcR;

  /* ======================= Relay ======================= */
  const relayCoilR = v => v * v / 0.4;                           // a 0.4 W coil
  def('relay', {
    name: 'Relay (SPDT)', cat: 'Switches & output', bounds: [-50, -42, 100, 84],
    desc: 'An electrically operated switch. Current in the COIL makes a magnet that moves the contact: COM connects to NC (normally closed) at rest and to NO (normally open) when the coil is energised. The coil is an inductor, so switching it off creates a voltage spike: put a diode across it (cathode to +).',
    defaults: { volts: 5 },
    props: [{ key: 'volts', label: 'Coil voltage', type: 'select', options: [{ v: 5, l: '5 V coil' }, { v: 9, l: '9 V coil' }, { v: 12, l: '12 V coil' }, { v: 24, l: '24 V coil' }] }],
    terms: [{ n: 'c1', x: -40, y: -20, label: 'coil 1' }, { n: 'c2', x: -40, y: 20, label: 'coil 2' }, { n: 'no', x: 40, y: -20, label: 'NO (normally open)' }, { n: 'com', x: 40, y: 0, label: 'COM (common)' }, { n: 'nc', x: 40, y: 20, label: 'NC (normally closed)' }],
    label: c => '',
    svg: c => '<rect class="ic-body" x="-30" y="-36" width="60" height="72" rx="4"/>' +
      '<line class="lead" x1="-40" y1="-20" x2="-30" y2="-20"/><line class="lead" x1="-40" y1="20" x2="-30" y2="20"/>' +
      '<polyline class="lead" points="-30,-20 -22,-20 -22,-14 -14,-11 -22,-8 -14,-5 -22,-2 -14,1 -22,4 -14,7 -22,10 -22,20 -30,20" fill="none"/>' +
      '<line class="lead" x1="40" y1="-20" x2="26" y2="-20"/><line class="lead" x1="40" y1="20" x2="26" y2="20"/><line class="lead" x1="40" y1="0" x2="12" y2="0"/>' +
      '<circle class="gate-bub" cx="26" cy="-20" r="2.5"/><circle class="gate-bub" cx="26" cy="20" r="2.5"/><line data-ref="lever" class="lead thick" x1="12" y1="0" x2="26" y2="18"/>' +
      '<text class="ic-pin" x="-4" y="-26" text-anchor="middle">' + c.props.volts + 'V</text><circle data-ref="led" class="ic-led" cx="-4" cy="28" r="3"/>' + lbl(c, 'RELAY', 0, 52),
    elements: (c, N) => {
      const m = N.alloc(), r = relayCoilR(+c.props.volts);
      c.rt.n = { c1: N('c1'), c2: N('c2') };
      return [{ type: 'L', a: N('c1'), b: m, l: 0.15 }, { type: 'R', a: m, b: N('c2'), r }, { type: 'R', a: N('com'), b: N('no'), r: 1e9 }, { type: 'R', a: N('com'), b: N('nc'), r: 0.05 }];
    },
    sync: (c, els) => { els[1].r = relayCoilR(+c.props.volts); },
    tick: (c, els) => {
      const r = c.rt, ic = Math.abs(els[0].i || 0), rc = relayCoilR(+c.props.volts), vn = +c.props.volts;
      if (!r.on && ic >= 0.75 * vn / rc) r.on = true; else if (r.on && ic <= 0.25 * vn / rc) r.on = false;
      els[2].r = r.on ? 0.05 : 1e9; els[3].r = r.on ? 1e9 : 0.05;
    },
    update: (c, refs) => {
      if (refs.lever) { refs.lever.setAttribute('x2', 26); refs.lever.setAttribute('y2', c.rt.on ? -18 : 18); }
      if (refs.led) refs.led.setAttribute('fill', c.rt.on ? '#2fe27a' : '#31403a');
    },
    read: (c, els) => { c.rt.icoil = els[0].i; c.rt.v = els[0].vd + els[1].vd; c.rt.i = els[0].i; c.rt.vL = els[0].vd; },
    watch: (c, els) => { const v = Math.abs(els[0].vd); if (v > (c.rt.kick || 0)) c.rt.kick = v; },
    check: (c, els, rtm) => { if ((c.rt.kick || 0) > 40) rtm.alert('kick' + c.id, 'Inductive kick! Switching the relay coil off produced a ' + (c.rt.kick).toFixed(0) + ' V spike. Put a diode across the coil (cathode towards +) to absorb it.', 'warn'); }
  });
  PARTS.relay.coilR = relayCoilR;
  // the plain inductor gets the same warning
  if (PARTS.inductor) PARTS.inductor.watch = (c, els) => { const v = Math.abs(els[0].vd); if (v > (c.rt.kick || 0)) c.rt.kick = v; };
  if (PARTS.inductor) PARTS.inductor.check = (c, els, rtm) => { if ((c.rt.kick || 0) > 40) rtm.alert('kick' + c.id, 'Inductive kick! The inductor produced a ' + c.rt.kick.toFixed(0) + ' V spike when its current was interrupted. A diode across it would absorb it.', 'warn'); };

  /* ======================= RGB LED ======================= */
  const RGB_VF = [2.0, 3.0, 3.1], RGB_HEX = ['#ff3b3b', '#2fe27a', '#3b82ff'];
  def('rgbled', {
    name: 'RGB LED', cat: 'Display & motion', bounds: [-40, -34, 80, 68],
    desc: 'Three LEDs (red, green, blue) in one package that share one pin. Common cathode: the shared pin goes to ground and each colour pin gets its own resistor. Common anode: the shared pin goes to +. Mix colours with analogWrite(). Each colour needs a resistor.',
    defaults: { common: 'cathode' },
    props: [{ key: 'common', label: 'Shared pin', type: 'select', options: [{ v: 'cathode', l: 'Common cathode (−)' }, { v: 'anode', l: 'Common anode (+)' }] }],
    terms: [{ n: 'r', x: -20, y: -20, label: 'R (red)' }, { n: 'g', x: -20, y: 0, label: 'G (green)' }, { n: 'b', x: -20, y: 20, label: 'B (blue)' }, { n: 'com', x: 20, y: 0, label: 'common' }],
    label: c => '',
    svg: c => '<circle data-ref="glow" r="34" fill="#fff" opacity="0"/><path class="lead" d="M-20,-20 H-12 L-7,-8 M-20,0 H-14 M-20,20 H-12 L-7,8 M20,0 H14" fill="none"/>' +
      '<circle data-ref="dome" class="led-dome" r="14" fill="#ffffff" fill-opacity="0.18" stroke="#9aa"/>' +
      '<text class="ic-pin" x="-30" y="-17" fill="' + RGB_HEX[0] + '" text-anchor="middle">R</text><text class="ic-pin" x="-30" y="3" fill="' + RGB_HEX[1] + '" text-anchor="middle">G</text><text class="ic-pin" x="-30" y="23" fill="' + RGB_HEX[2] + '" text-anchor="middle">B</text>' +
      '<text class="led-plus" x="7" y="-5" text-anchor="middle">' + (c.props.common === 'anode' ? '+' : '−') + '</text>' + lbl(c, 'RGB', 0, 32),
    elements: (c, N) => {
      const ca = c.props.common === 'anode', out = [];
      ['r', 'g', 'b'].forEach((k, i) => out.push({ type: 'D', a: ca ? N('com') : N(k), b: ca ? N(k) : N('com'), is: diodeIs(RGB_VF[i], 2), n: 2, off: !!(c.rt.burnt && c.rt.burnt[i]) }));
      return out;
    },
    sync: (c, els) => { els.forEach((e, i) => { e.off = !!(c.rt.burnt && c.rt.burnt[i]); }); },
    update: (c, refs) => {
      const ia = c.rt.ia || [0, 0, 0], br = ia.map((x, i) => (c.rt.burnt && c.rt.burnt[i]) ? 0 : Math.min(1, Math.pow(x / 0.015, 0.7)));
      const m = Math.max(br[0], br[1], br[2]);
      const col = m > 0.02 ? 'rgb(' + br.map(b => Math.round(40 + 215 * b)).join(',') + ')' : '#ffffff';
      if (refs.dome) { refs.dome.setAttribute('fill', col); refs.dome.setAttribute('fill-opacity', (0.18 + 0.82 * m).toFixed(3)); }
      if (refs.glow) { refs.glow.setAttribute('fill', col); refs.glow.setAttribute('opacity', (m * 0.75).toFixed(3)); }
    },
    read: (c, els) => { c.rt.i = els[0].i + els[1].i + els[2].i; c.rt.iCh = [els[0].i, els[1].i, els[2].i]; c.rt.v = els[0].vd; }
  });
  PARTS.rgbled.vf = RGB_VF;

  /* ======================= 74HC595 shift register ======================= */
  const HC_L = [['SER', -80, 'SER (14) serial data in'], ['SRCLK', -60, 'SRCLK (11) shift clock: data moves on the rising edge'], ['RCLK', -40, 'RCLK (12) latch: copies the shift register to the outputs on the rising edge'],
                ['OE', -20, '/OE (13) output enable, active LOW (connect to GND)'], ['SRCLR', 0, '/SRCLR (10) clear, active LOW (connect to VCC)'], ['QH2', 20, "QH' (9) serial out, for daisy-chaining"],
                ['VCC', 40, 'VCC (16) 2–6 V'], ['GND', 60, 'GND (8)']];
  const HC_OUT = 'ABCDEFGH'.split('');
  const hcTerms = [];
  HC_L.forEach(t => hcTerms.push({ n: t[0], x: -40, y: t[1], label: t[2] }));
  HC_OUT.forEach((k, i) => hcTerms.push({ n: 'Q' + k, x: 40, y: -80 + i * 20, label: 'Q' + k + ' (output ' + i + ')' }));
  const hcNames = { SER: 'SER', SRCLK: 'SRCLK', RCLK: 'RCLK', OE: '/OE', SRCLR: '/SRCLR', QH2: "QH'", VCC: 'VCC', GND: 'GND' };
  def('hc595', {
    name: '74HC595 shift register', cat: 'Digital ICs', bounds: [-50, -100, 100, 180], defaults: {},
    desc: 'Turns 3 Arduino pins into 8 outputs. Send 8 bits on SER, pulsing SRCLK after each bit (shiftOut() does this), then pulse RCLK to show them on QA–QH. Tie /OE to GND and /SRCLR to VCC. Outputs drive about 20 mA each. Needs power on VCC and GND.',
    terms: hcTerms,
    label: c => '',
    svg: c => {
      let s = '<rect class="ic-body" x="-30" y="-92" width="60" height="164" rx="4"/><path class="ic-notch" d="M-8,-92 A8,8 0 0 0 8,-92"/><text class="ic-t" x="0" y="-24" text-anchor="middle">74HC</text><text class="ic-t" x="0" y="-8" text-anchor="middle">595</text><text class="ic-t2" x="0" y="8" text-anchor="middle">SHIFT REG</text>';
      HC_L.forEach(t => { s += '<line class="lead" x1="-40" y1="' + t[1] + '" x2="-30" y2="' + t[1] + '"/><text class="ic-pin" x="-26" y="' + (t[1] + 3) + '" text-anchor="start">' + hcNames[t[0]] + '</text>'; });
      HC_OUT.forEach((k, i) => { const y = -80 + i * 20; s += '<line class="lead" x1="30" y1="' + y + '" x2="40" y2="' + y + '"/><text class="ic-pin" x="10" y="' + (y + 3) + '" text-anchor="end">Q' + k + '</text><circle data-ref="q' + i + '" class="ic-led" cx="22" cy="' + y + '" r="3"/>'; });
      return s;
    },
    elements: (c, N) => {
      c.rt.n = {}; for (const t of hcTerms) c.rt.n[t.n] = N(t.n);
      const n = c.rt.n, els = [];
      HC_OUT.forEach(k => els.push({ type: 'V', a: n['Q' + k], b: n.GND, v: 0, rs: 60, en: false }));
      els.push({ type: 'V', a: n.QH2, b: n.GND, v: 0, rs: 60, en: false });
      return els;
    },
    tick: (c, els, t, rtm) => {
      const r = c.rt, n = r.n; if (!n) return;
      const v = rtm.sim.v, gnd = v[n.GND], vcc = v[n.VCC] - gnd, th = vcc / 2;
      if (r.sr === undefined) { r.sr = 0; r.latch = 0; r.lv = { SER: 0, SRCLK: 0, RCLK: 0 }; }
      if (vcc < 2.5) { r.powered = false; r.sr = 0; r.latch = 0; for (const e of els) e.en = false; return; }
      r.powered = true;
      // gather every edge of the three signals during this physics step, in time order
      const ev = [];
      for (const sig of ['SER', 'SRCLK', 'RCLK']) {
        const tr = rtm.transFor ? rtm.transFor(n[sig]) : null;
        if (tr && tr.length) for (const x of tr) ev.push({ t: x.t, sig, lvl: x.level });
        else { const lvl = (v[n[sig]] - gnd) > th ? 1 : 0; if (lvl !== r.lv[sig]) ev.push({ t: Infinity, sig, lvl }); }
      }
      ev.sort((a, b) => a.t - b.t);
      r.clear = (v[n.SRCLR] - gnd) < th;
      for (const x of ev) {
        if (x.sig === 'SER') r.lv.SER = x.lvl;
        else if (x.sig === 'SRCLK') { if (x.lvl && !r.lv.SRCLK) { if (r.clear) r.sr = 0; else r.sr = ((r.sr << 1) | r.lv.SER) & 0xFF; } r.lv.SRCLK = x.lvl; }
        else { if (x.lvl && !r.lv.RCLK) r.latch = r.sr; r.lv.RCLK = x.lvl; }
      }
      if (r.clear) r.sr = 0;
      r.oe = (v[n.OE] - gnd) > th;
      for (let i = 0; i < 8; i++) { els[i].en = !r.oe; els[i].v = ((r.latch >> i) & 1) ? vcc : 0; }
      els[8].en = true; els[8].v = ((r.sr >> 7) & 1) ? vcc : 0;
    },
    update: (c, refs) => { for (let i = 0; i < 8; i++) if (refs['q' + i]) refs['q' + i].setAttribute('fill', (!c.rt.oe && c.rt.powered && ((c.rt.latch >> i) & 1)) ? '#2fe27a' : '#31403a'); },
    read: (c, els) => { c.rt.i = els[0].i; c.rt.v = els[0].vd; },
    check: (c, els, rtm) => { for (let i = 0; i < 8; i++) if (els[i].en && Math.abs(els[i].i) > 0.035) rtm.alert('hcl' + c.id + i, 'Output Q' + HC_OUT[i] + ' of the 74HC595 is supplying ' + (Math.abs(els[i].i) * 1000).toFixed(0) + ' mA. The limit is about 35 mA per output: use a larger resistor.', 'warn'); }
  });

  /* ======================= Multimeter ======================= */
  const DMM_MODES = [['dcv', 'DC volts (V=)', 'V='], ['acv', 'AC volts RMS (V~)', 'V~'], ['dca', 'DC amps (A=)', 'A='], ['ohm', 'Resistance (Ω)', 'Ω'], ['cont', 'Continuity (beep)', '•))']];
  const DMM_ANG = [-72, -36, 0, 36, 72];
  const dmmText = (c) => {
    const r = c.rt, m = c.props.mode;
    if (r.fuse) return 'FUSE';
    if (r.reading === undefined) return '----';
    if (m === 'ohm' || m === 'cont') return r.reading === Infinity ? 'OL' : fmt(r.reading, 'Ω').replace(' ', '');
    const neg = m === 'acv' ? '' : '';
    return neg + fmt(r.reading, m === 'dca' ? 'A' : 'V').replace(' ', '');
  };
  def('multimeter', {
    name: 'Multimeter', cat: 'Instruments', bounds: [-50, -70, 100, 140], clickable: true,
    onClick: c => { const i = DMM_MODES.findIndex(m => m[0] === c.props.mode); c.props.mode = DMM_MODES[(i + 1) % DMM_MODES.length][0]; if (c.rt) { c.rt.reading = undefined; } return true; },
    desc: 'A handheld meter with one dial. CLICK the meter (or use the Mode list) to turn the dial: DC volts, AC volts (RMS), DC amps, resistance, continuity. Volts: probes ACROSS a part. Amps: probes IN SERIES, in the gap of the circuit; across a supply it blows its 10 A fuse. Resistance and continuity: switch the circuit power OFF and measure the part on its own.',
    defaults: { mode: 'dcv' },
    props: [{ key: 'mode', label: 'Dial', type: 'select', options: DMM_MODES.map(m => ({ v: m[0], l: m[1] })) }],
    terms: [{ n: 'red', x: -20, y: 60, label: 'red probe (VΩA)' }, { n: 'black', x: 20, y: 60, label: 'black probe (COM)' }],
    label: c => '',
    svg: c => {
      const i = Math.max(0, DMM_MODES.findIndex(m => m[0] === c.props.mode)), a = DMM_ANG[i];
      let lab = ''; DMM_MODES.forEach((m, k) => { const t = DMM_ANG[k] * Math.PI / 180; lab += '<text class="ic-pin" x="' + (Math.sin(t) * 31).toFixed(1) + '" y="' + (12 - Math.cos(t) * 31 + 2).toFixed(1) + '" text-anchor="middle" font-size="7"' + (k === i ? ' font-weight="800"' : '') + '>' + m[2] + '</text>'; });
      return '<rect class="meter-body" x="-40" y="-64" width="80" height="116" rx="9"/><rect class="meter-lcd" x="-33" y="-57" width="66" height="26" rx="3"/>' +
        '<text data-ref="val" class="meter-val" x="0" y="-39" text-anchor="middle" font-size="13">----</text><text data-ref="unit" class="ic-pin" x="-30" y="-50" font-size="7" fill="#2b3a10">' + DMM_MODES[i][2] + '</text>' +
        '<circle cx="0" cy="12" r="19" fill="#2d3834" stroke="#111" stroke-width="1.5"/><line data-ref="ptr" x1="0" y1="12" x2="0" y2="-3" stroke="#f5f5f5" stroke-width="3" stroke-linecap="round" transform="rotate(' + a + ' 0 12)"/>' + lab +
        '<line class="lead" x1="-20" y1="52" x2="-20" y2="60"/><line class="lead" x1="20" y1="52" x2="20" y2="60"/><circle cx="-20" cy="46" r="5" fill="#d94a4a" stroke="#7e1c1c"/><circle cx="20" cy="46" r="5" fill="#1b1f1d" stroke="#000"/>' +
        '<text class="ic-pin" x="-20" y="38" text-anchor="middle" font-size="6">VΩA</text><text class="ic-pin" x="20" y="38" text-anchor="middle" font-size="6">COM</text>';
    },
    elements: (c, N) => { c.rt.n = { red: N('red'), black: N('black') }; return [{ type: 'R', a: N('red'), b: N('black'), r: 1e7 }, { type: 'V', a: N('red'), b: N('black'), v: 2, rs: 1000, en: false }]; },
    tick: (c, els, t, rtm) => {
      const r = c.rt, m = c.props.mode, n = r.n; if (!n) return;
      const ohm = m === 'ohm' || m === 'cont';
      els[1].en = ohm && !r.fuse; els[1].v = 2;
      els[0].r = r.fuse ? 1e12 : m === 'dca' ? 0.1 : ohm ? 1e12 : 1e7;
      const vt = rtm.sim.v[n.red] - rtm.sim.v[n.black], dt = Math.min(50, Math.max(0, t - (r.lt === undefined ? t : r.lt))); r.lt = t;
      r.ms = (r.ms === undefined ? vt * vt : r.ms) + (vt * vt - (r.ms === undefined ? vt * vt : r.ms)) * Math.min(1, dt / 50);
    },
    read: (c, els) => {
      const r = c.rt, m = c.props.mode; r.i = els[0].i; r.v = els[0].vd;
      if (r.fuse) { r.reading = undefined; return; }
      if (m === 'dcv') r.reading = els[0].vd;
      else if (m === 'acv') r.reading = Math.sqrt(Math.max(0, r.ms || 0));
      else if (m === 'dca') { r.reading = els[0].i; if (Math.abs(els[0].i) > 10) r.fuse = true; }
      else { const vt = els[0].vd, vs = 2; r.reading = vt >= vs * 0.985 ? Infinity : vt <= 0 ? 0 : Math.min(Infinity, 1000 * vt / (vs - vt)); if (r.reading > 5e6) r.reading = Infinity; r.beep = m === 'cont' && r.reading < 50; }
    },
    update: (c, refs) => {
      if (refs.val) refs.val.textContent = dmmText(c) + (c.props.mode === 'cont' && c.rt.beep ? ' ♪' : '');
      if (refs.unit) refs.unit.textContent = (DMM_MODES.find(m => m[0] === c.props.mode) || DMM_MODES[0])[2];
    },
    check: (c, els, rtm) => { if (c.rt.fuse) rtm.alert('fuse' + c.id, 'The multimeter fuse blew: more than 10 A flowed through the amps range. In amps mode the meter must sit IN SERIES with the load, never across a supply. Press Stop and Run to fit a new fuse.', 'error'); }
  });
  PARTS.multimeter.modes = DMM_MODES;
})(typeof window !== 'undefined' ? window : globalThis);
