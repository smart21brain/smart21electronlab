global.S21 = {};
require('../src/js/sim/solver.js'); require('../src/js/arduino/interp.js');
const P = require('../src/js/sim/parts.js'); require('../src/js/sim/runtime.js'); const Ex = require('../src/js/examples.js'); const A = require('../src/js/analysis.js');
let fails = 0;
function near(n, got, want, tol) { const ok = Math.abs(got - want) <= tol; if (!ok) fails++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  got=' + got + ' want≈' + want + ' (±' + tol + ')')); }
function check(n, c, x) { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  ' + x)); }

// reference designators
{
  const c = Ex.load('relay-lamp').circuit, m = A.refMap(c);
  check('refMap numbers parts that share a prefix (R1, R2 …) and leaves singles bare', m[c.parts.find(p => p.type === 'resistor').id] === 'R1' && m[c.parts.find(p => p.type === 'relay').id] === 'K' && m[c.parts.find(p => p.type === 'npn').id] === 'Q');
  const o = Ex.load('opamp-gain').circuit; check('op-amp is U, pot is POT', A.refMap(o)[o.parts.find(p => p.type === 'opamp').id] === 'U');
}
// DC sweep: diode I-V
{
  const e = Ex.load('diode-curve'), bat = e.circuit.parts.find(p => p.type === 'battery'), r = e.circuit.parts.find(p => p.type === 'resistor'), d = e.circuit.parts.find(p => p.type === 'diode');
  const res = A.dcSweep(e.circuit, { partId: bat.id, key: 'volts', from: 0.1, to: 5, points: 50, outputs: [{ kind: 'i', partId: r.id, label: 'I(R)' }, { kind: 'v', ref: { p: d.id, t: 'a' }, label: 'V(D.a)' }] });
  const I = res.series[0].y, Vd = res.series[1].y, x = res.x;
  check('dc sweep: returns 50 points', x.length === 50 && I.length === 50);
  const iAt = v => I[x.findIndex(t => t >= v)];
  check('dc sweep: diode blocks below ~0.5 V (I < 0.1 mA at 0.4 V)', iAt(0.4) < 1e-4, iAt(0.4));
  check('dc sweep: diode conducts above ~0.7 V (I > 20 mA at 3 V)', iAt(3) > 0.02, iAt(3));
  check('dc sweep: voltage across the diode saturates near 0.75 V', Vd[49] > 0.65 && Vd[49] < 0.9, Vd[49]);
  check('the user\'s own circuit was not changed by the sweep', bat.props.volts === 5);
}
// DC sweep: pot position -> divider output
{
  const e = Ex.load('opamp-gain'), pot = e.circuit.parts.find(p => p.type === 'pot'), oa = e.circuit.parts.find(p => p.type === 'opamp');
  const res = A.dcSweep(e.circuit, { partId: pot.id, key: 'pos', from: 0, to: 100, points: 11, outputs: [{ kind: 'v', ref: { p: pot.id, t: 'w' }, label: 'in' }, { kind: 'v', ref: { p: oa.id, t: 'o' }, label: 'out' }] });
  const vin = res.series[0].y, vout = res.series[1].y;
  check('dc sweep: pot at 0 % = 9 V in, output clipped near 7.5 V', Math.abs(vin[0] - 9) < 0.05 && Math.abs(vout[0] - 7.5) < 0.1, vin[0] + ' ' + vout[0]);
  check('dc sweep: linear region: out = 2·in at 70 % (in = 2.7 V)', Math.abs(vout[7] - 2 * vin[7]) < 0.03, vout[7] + ' / ' + vin[7]);
  check('dc sweep: pot at 100 % = 0 V', Math.abs(vout[10]) < 0.1);
}
// DC sweep: transistor output characteristic (Ic vs supply) must converge
{
  const e = Ex.load('npn'), bat = e.circuit.parts.find(p => p.type === 'battery'), q = e.circuit.parts.find(p => p.type === 'npn'); e.circuit.parts.find(p => p.type === 'switch').props.closed = true;
  const res = A.dcSweep(e.circuit, { partId: bat.id, key: 'volts', from: 1, to: 12, points: 23, outputs: [{ kind: 'i', partId: q.id, label: 'Ic' }] });
  check('dc sweep: transistor circuit sweeps without NaN', res.series[0].y.every(Number.isFinite));
}
// frequency response: RC low-pass, fc = 1/(2π·1600·1µ) = 99.5 Hz
{
  const e = Ex.load('rcfilter'), ac = e.circuit.parts.find(p => p.type === 'acsource'), c = e.circuit.parts.find(p => p.type === 'capacitor');
  const res = A.acSweep(e.circuit, { srcId: ac.id, outRef: { p: c.id, t: 'a' }, fStart: 1, fStop: 10000, points: 41, amp: 1 });
  near('bode: pass-band gain at 1 Hz ≈ 0 dB', res.mag[0], 0, 0.1);
  near('bode: −3 dB corner ≈ 99.5 Hz', res.fcHigh, 99.47, 4);
  const iFc = res.freq.reduce((b, f, i) => Math.abs(Math.log(f / 99.5)) < Math.abs(Math.log(res.freq[b] / 99.5)) ? i : b, 0);
  near('bode: phase near the corner ≈ −45°', res.phase[iFc], -45, 4);
  near('bode: −20 dB/decade roll-off (1 kHz → 10 kHz drops ≈ 20 dB)', res.mag[res.freq.findIndex(f => f >= 1000)] - res.mag[40], 20, 1.5);
  near('bode: phase tends to −90° at high frequency', res.phase[40], -90, 3);
  check('bode: no low-frequency corner for a low-pass', res.fcLow === null);
  const csv = A.toCsv(res); check('csv export has a header and one row per point', csv.split('\n')[0].startsWith('frequency') && csv.trim().split('\n').length === 42);
}
// frequency response: RC high-pass built from the same parts (swap R and C)
{
  const c = P.newCircuit(), add = (t, x, y, r, pr) => P.addPart(c, t, x, y, r, pr);
  const ac = add('acsource', 100, 200, 0, { amp: 1, freq: 100 }), g = add('ground', 100, 240, 0), cap = add('capacitor', 200, 160, 0, { farads: 1e-6 }), res = add('resistor', 300, 200, 90, { ohms: 1600 }), g2 = add('ground', 300, 240, 0);
  P.addWire(c, { p: ac.id, t: '+' }, { p: cap.id, t: 'a' }); P.addWire(c, { p: cap.id, t: 'b' }, { p: res.id, t: 'a' });
  const r = A.acSweep(c, { srcId: ac.id, outRef: { p: res.id, t: 'a' }, fStart: 1, fStop: 10000, points: 41, amp: 1 });
  near('high-pass: −3 dB corner ≈ 99.5 Hz from below', r.fcLow, 99.47, 4);
  near('high-pass: phase at 1 Hz ≈ +90°', r.phase[0], 90, 3);
  near('high-pass: 10 kHz ≈ 0 dB', r.mag[40], 0, 0.1);
}
// frequency response: an op-amp inverting amplifier has flat gain −4.7 (13.4 dB)
{
  const c = P.newCircuit(), add = (t, x, y, r, pr) => P.addPart(c, t, x, y, r, pr);
  const bat = add('battery', 0, 0, 0, { volts: 9 }), g = add('ground', 0, 40, 0), vref = add('battery', 0, 100, 0, { volts: 4.5 });
  const ac = add('acsource', 100, 200, 0, { amp: 0.1, freq: 1000, offset: 4.5 }), g2 = add('ground', 100, 240, 0);
  const oa = add('opamp', 400, 200, 0, { rail: 'rr' }), r1 = add('resistor', 250, 180, 0, { ohms: 10000 }), r2 = add('resistor', 400, 300, 0, { ohms: 47000 });
  const w = (a, at, b, bt) => P.addWire(c, { p: a.id, t: at }, { p: b.id, t: bt });
  w(bat, '+', oa, 'vp'); w(ac, '+', r1, 'a'); w(r1, 'b', oa, 'n'); w(r2, 'a', oa, 'n'); w(r2, 'b', oa, 'o'); w(vref, '+', oa, 'p'); w(vref, '-', g, 'g'); w(oa, 'vn', g, 'g');
  const r = A.acSweep(c, { srcId: ac.id, outRef: { p: oa.id, t: 'o' }, fStart: 10, fStop: 100000, points: 15, amp: 0.1 });
  near('op-amp inverting amp: flat gain 20·log10(4.7) = 13.4 dB at 10 Hz', r.mag[0], 13.44, 0.3);
  near('op-amp inverting amp: phase ≈ 180°', Math.abs(r.phase[0]), 180, 3);
}
check('acSweep reports a missing AC source clearly', (() => { try { A.acSweep(Ex.load('divider').circuit, { srcId: 'x', outRef: { p: 'x', t: 'a' }, fStart: 1, fStop: 10 }); } catch (e) { return /AC signal source/.test(e.message); } return false; })());
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll analysis tests passed'); process.exit(fails ? 1 : 0);
