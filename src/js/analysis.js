/* ---------------------------------------------------------------
   Smart21 ElectroLab — analysis tools
   DC sweep (vary one value, plot a voltage or current) and
   frequency response (Bode plot of gain and phase).
   Everything runs on a private copy of the circuit, so the
   student's running simulation is never disturbed.
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const P = () => S21.Parts, PARTS = () => S21.Parts.PARTS;

  /* ---------- reference designators (R1, C2, Q3 …) ---------- */
  const PREFIX = { resistor: 'R', led: 'LED', battery: 'BAT', capacitor: 'C', pot: 'POT', ldr: 'LDR', switch: 'SW', button: 'BTN', npn: 'Q', pnp: 'Q', mosfet: 'Q',
    diode: 'D', zener: 'DZ', buzzer: 'BZ', arduino: 'UNO', ground: 'GND', breadboard: 'BB', inductor: 'L', acsource: 'AC', motor: 'M', servo: 'SV', lcd16x2: 'LCD',
    sevenseg: 'SEG', voltmeter: 'VM', ammeter: 'AM', vcc: 'VCC', tmp36: 'TMP', hcsr04: 'US', ic555: 'U', gate: 'U', opamp: 'U', hc595: 'U', ntc: 'RT', relay: 'K', rgbled: 'RGB', multimeter: 'DMM',
    schottky: 'D', fuse: 'F', lamp: 'LP', ledbar: 'BAR', dotmatrix: 'MX', stepper: 'M', pir: 'PIR', lm35: 'TMP', joystick: 'JS', keypad: 'KP', dipsw: 'DIP', opto: 'U', vreg: 'U', lm317: 'U', uln2003: 'U', l293d: 'U', quadgate: 'U', quadnor: 'U', hexinv: 'U', dff74: 'U', cd4017: 'U', hc161: 'U', cd4511: 'U', hc138: 'U', hc4051: 'U' };
  function refMap(circuit) {
    const groups = {}, map = {};
    for (const p of circuit.parts) { const pre = PREFIX[p.type] || p.type; (groups[pre] = groups[pre] || []).push(p); }
    for (const pre of Object.keys(groups)) groups[pre].forEach((p, i) => { map[p.id] = pre + (groups[pre].length > 1 ? i + 1 : ''); });
    return map;
  }
  const refName = (circuit, comp) => refMap(circuit)[comp.id] || comp.type;

  const clone = circuit => P().deserialize(JSON.parse(JSON.stringify(P().serialize(circuit))));

  /* ---------- what can be swept / measured ---------- */
  function sweepTargets(circuit) {
    const refs = refMap(circuit), out = [];
    for (const c of circuit.parts) {
      const d = PARTS()[c.type];
      for (const f of d.props || []) {
        if (f.type !== 'eng' && f.type !== 'number' && f.type !== 'range') continue;
        out.push({ partId: c.id, key: f.key, ref: refs[c.id], name: d.name, label: f.label, unit: (f.unit || '').trim(), min: f.min, max: f.max, value: c.props[f.key] });
      }
    }
    return out;
  }
  function measurePoints(circuit) {
    const refs = refMap(circuit), volts = [], amps = [];
    for (const c of circuit.parts) {
      const d = PARTS()[c.type];
      if (d.noPins || d.ground || c.type === 'ground') continue;
      for (const t of d.terms) volts.push({ kind: 'v', ref: { p: c.id, t: t.n }, label: refs[c.id] + '.' + t.n });
      if (['resistor', 'led', 'diode', 'zener', 'capacitor', 'inductor', 'battery', 'vcc', 'pot', 'ldr', 'ntc', 'motor', 'buzzer', 'npn', 'pnp', 'mosfet', 'relay', 'rgbled', 'switch'].includes(c.type)) amps.push({ kind: 'i', partId: c.id, label: 'I(' + refs[c.id] + ')' });
    }
    return { volts, amps };
  }

  /* ---------- DC sweep ---------- */
  // spec: { partId, key, from, to, points, outputs: [{kind:'v',ref,label} | {kind:'i',partId,label}] }
  function dcSweep(circuit, spec) {
    const c = clone(circuit);
    const rt = new S21.Runtime(c, {});
    for (const e of rt.nl.elements) { if (e.type === 'C') e.c = 1e-18; if (e.type === 'L') e.l = 1e-9; }     // DC: capacitors open, inductors short
    rt.tickParts = rt.tickParts.filter(p => p.type !== 'acsource');
    const part = c.parts.find(p => p.id === spec.partId); if (!part) throw new Error('The part to sweep no longer exists.');
    const d = PARTS()[part.type], n = Math.max(2, Math.min(400, Math.round(spec.points || 101)));
    const x = [], ys = spec.outputs.map(() => []), leds = c.parts.filter(p => p.type === 'led' || p.type === 'rgbled');
    const read = (o) => {
      if (o.kind === 'v') return rt.nodeVoltage(o.ref);
      const pc = c.parts.find(p => p.id === o.partId); return pc ? (pc.rt.i || 0) : 0;
    };
    for (let i = 0; i < n; i++) {
      const xv = spec.from + (spec.to - spec.from) * i / (n - 1);
      part.props[spec.key] = xv;
      if (d.sync) d.sync(part, rt.nl.compEls.get(part.id));
      rt.advance(i === 0 ? 20 : 6);
      x.push(xv); spec.outputs.forEach((o, k) => ys[k].push(read(o)));
      for (const l of leds) { l.rt.stress = l.type === 'rgbled' ? [0, 0, 0] : 0; }          // a sweep must never "burn" an LED
    }
    return { x, series: spec.outputs.map((o, k) => ({ label: o.label, unit: o.kind === 'v' ? 'V' : 'A', y: ys[k] })), converged: rt.sim.converged };
  }

  /* ---------- frequency response ---------- */
  // spec: { srcId, outRef, outRef2?, fStart, fStop, points, amp }
  function acSweep(circuit, spec) {
    const c = clone(circuit), PP = P();
    const src = c.parts.find(p => p.id === spec.srcId);
    if (!src || src.type !== 'acsource') throw new Error('Add an AC signal source to the circuit first.');
    const nl = PP.buildNetlist(c), sim = new S21.Solver.Sim(nl);
    const el = nl.compEls.get(src.id)[0], off = src.props.offset || 0, amp = spec.amp > 0 ? spec.amp : 0.1;
    const nIp = nl.nodeOf(src.id, '+'), nIn = nl.nodeOf(src.id, '-'), nOut = nl.nodeOf(spec.outRef.p, spec.outRef.t), nOut2 = spec.outRef2 ? nl.nodeOf(spec.outRef2.p, spec.outRef2.t) : 0;
    if (nOut === 0 && nOut2 === 0) throw new Error('The output point is connected to ground only: pick a different point.');
    el.v = off; for (let i = 0; i < 3; i++) sim.step(1000);            // DC operating point (capacitors charged, inductors shorted)
    const nPts = Math.max(5, Math.min(300, Math.round(spec.points || 60)));
    const f0 = spec.fStart, f1 = spec.fStop, N = 100, TWO_PI = 2 * Math.PI;
    const freq = [], mag = [], phase = [];
    let t = 0;
    for (let k = 0; k < nPts; k++) {
      const f = f0 * Math.pow(f1 / f0, k / (nPts - 1)), dt = 1 / (f * N), w = TWO_PI * f, steps = N * 4;
      let prev = null, H = null;
      for (let chunk = 0; chunk < 40; chunk++) {
        let ir = 0, ii = 0, or = 0, oi = 0;
        for (let s = 0; s < steps; s++) {
          t += dt; el.v = off + amp * Math.sin(w * t); sim.step(dt);
          const co = Math.cos(w * t), si = Math.sin(w * t), vi = sim.v[nIp] - sim.v[nIn], vo = sim.v[nOut] - sim.v[nOut2];
          ir += vi * co; ii += vi * si; or += vo * co; oi += vo * si;
        }
        // phasor = (2/N) Σ v·e^(−jωt)  →  (re, im) = (Σ v·cos, −Σ v·sin)
        const a = Math.hypot(ir, ii), b = Math.hypot(or, oi);
        H = { m: a > 1e-12 ? b / a : 0, p: Math.atan2(-oi, or) - Math.atan2(-ii, ir) };
        while (H.p > Math.PI) H.p -= TWO_PI; while (H.p < -Math.PI) H.p += TWO_PI;
        if (prev && Math.abs(H.m - prev.m) <= 0.002 * Math.max(H.m, 1e-9) + 1e-9 && Math.abs(H.p - prev.p) < 0.004) break;
        prev = H;
      }
      freq.push(f); mag.push(20 * Math.log10(Math.max(H.m, 1e-9))); phase.push(H.p * 180 / Math.PI);
    }
    return Object.assign({ freq, mag, phase, amp, converged: sim.converged }, findCutoff(freq, mag));
  }

  function findCutoff(freq, mag) {
    let pk = 0; for (let i = 1; i < mag.length; i++) if (mag[i] > mag[pk]) pk = i;
    const peakDb = mag[pk], tgt = peakDb - 3.0103, lf = Math.log10;
    const cross = (i, j) => Math.pow(10, lf(freq[i]) + (tgt - mag[i]) * (lf(freq[j]) - lf(freq[i])) / (mag[j] - mag[i]));
    let high = null, low = null;
    for (let i = pk; i < mag.length - 1; i++) if (mag[i] > tgt && mag[i + 1] <= tgt) { high = cross(i, i + 1); break; }
    for (let i = pk; i > 0; i--) if (mag[i] > tgt && mag[i - 1] <= tgt) { low = cross(i, i - 1); break; }
    return { peakDb, peakFreq: freq[pk], fcHigh: high, fcLow: low };
  }

  function toCsv(res, xName) {
    if (res.x) return [xName || 'x'].concat(res.series.map(s => s.label + ' (' + s.unit + ')')).join(',') + '\n' + res.x.map((x, i) => [x].concat(res.series.map(s => s.y[i])).join(',')).join('\n') + '\n';
    return 'frequency (Hz),gain (dB),phase (deg)\n' + res.freq.map((f, i) => f + ',' + res.mag[i].toFixed(3) + ',' + res.phase[i].toFixed(2)).join('\n') + '\n';
  }

  S21.Analysis = { PREFIX, refMap, refName, sweepTargets, measurePoints, dcSweep, acSweep, findCutoff, toCsv, clone };
  if (typeof module !== 'undefined' && module.exports) module.exports = S21.Analysis;
})(typeof window !== 'undefined' ? window : globalThis);
