const { Sim } = require('../src/js/sim/solver.js');
let fails = 0;
function near(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + '  got=' + got.toPrecision(5) + ' want≈' + want + ' (±' + tol + ')');
}
function ledIs(vf, i = 0.01, n = 2) { const nvt = n * 0.025852; return i / (Math.exp(vf / nvt) - 1); }

// 1. voltage divider 9V, 1k + 2k -> 6V mid node
{
  const sim = new Sim({ nodeCount: 3, elements: [
    { type: 'V', a: 1, b: 0, v: 9, rs: 0.1 },
    { type: 'R', a: 1, b: 2, r: 1000 }, { type: 'R', a: 2, b: 0, r: 2000 }] });
  sim.step(0.001);
  near('divider mid-node', sim.v[2], 6 * (1 - 0.1 / 3000), 0.01);
}
// 2. LED + resistor from 9V: ~ (9-Vf)/470
{
  const led = { type: 'D', a: 2, b: 3, is: ledIs(1.9), n: 2 };
  const sim = new Sim({ nodeCount: 4, elements: [
    { type: 'V', a: 1, b: 0, v: 9, rs: 0.1 }, { type: 'R', a: 1, b: 2, r: 470 }, led, { type: 'R', a: 3, b: 0, r: 1e-3 }] });
  for (let i = 0; i < 3; i++) sim.step(0.001);
  near('LED forward voltage', led.vd, 1.9, 0.15);
  near('LED current (mA)', led.i * 1000, (9 - 1.9) / 470 * 1000, 0.6);
  console.log('   newton iterations:', sim.iterations, 'converged:', sim.converged);
}
// 3. RC charging: 5V, 10k, 100uF -> tau = 1 s ; after 1 s V = 5(1-e^-1)=3.16
{
  const cap = { type: 'C', a: 2, b: 0, c: 100e-6 };
  const sim = new Sim({ nodeCount: 3, elements: [
    { type: 'V', a: 1, b: 0, v: 5, rs: 0.1 }, { type: 'R', a: 1, b: 2, r: 10000 }, cap] });
  for (let i = 0; i < 1000; i++) sim.step(0.001);
  near('RC voltage after 1 tau', sim.v[2], 5 * (1 - Math.exp(-1)), 0.03);
}
// 4. NPN switch: 5V, base via 10k from 5V, collector load 1k -> saturated, Vce small
{
  const q = { type: 'Q', c: 3, b: 2, e: 0, is: 1e-14, bf: 100, br: 1 };
  const sim = new Sim({ nodeCount: 4, elements: [
    { type: 'V', a: 1, b: 0, v: 5, rs: 0.1 }, { type: 'R', a: 1, b: 2, r: 10000 },
    { type: 'R', a: 1, b: 3, r: 1000 }, q] });
  for (let i = 0; i < 3; i++) sim.step(0.001);
  near('NPN base voltage', sim.v[2], 0.72, 0.1);
  near('NPN saturated Vce', sim.v[3], 0.1, 0.15);
  console.log('   newton iterations:', sim.iterations, 'converged:', sim.converged);
}
// 5. NPN active region: Ic ~ beta*Ib
{
  const q = { type: 'Q', c: 3, b: 2, e: 0, is: 1e-14, bf: 100, br: 1 };
  const sim = new Sim({ nodeCount: 4, elements: [
    { type: 'V', a: 1, b: 0, v: 9, rs: 0.1 }, { type: 'R', a: 1, b: 2, r: 860000 },
    { type: 'R', a: 1, b: 3, r: 1000 }, q] });
  for (let i = 0; i < 3; i++) sim.step(0.001);
  const ib = (9 - sim.v[2]) / 860000;
  near('NPN Ic ≈ 100·Ib (mA)', (9 - sim.v[3]) / 1000 * 1000, ib * 100 * 1000, 0.4);
}
// 6. Diode blocks in reverse
{
  const d = { type: 'D', a: 2, b: 0, is: 1e-9, n: 1.75 };
  const sim = new Sim({ nodeCount: 3, elements: [
    { type: 'V', a: 1, b: 0, v: -5, rs: 0.1 }, { type: 'R', a: 1, b: 2, r: 1000 }, d] });
  for (let i = 0; i < 3; i++) sim.step(0.001);
  near('reverse diode current ≈ 0 (µA)', Math.abs(d.i) * 1e6, 0, 0.01);
}
// 7. RL: 5V, 100 ohm, 100 mH -> tau = 1 ms, steady current 50 mA, 63% after 1 tau
{
  const L = { type: 'L', a: 2, b: 0, l: 0.1 };
  const sim = new Sim({ nodeCount: 3, elements: [{ type: 'V', a: 1, b: 0, v: 5, rs: 0.1 }, { type: 'R', a: 1, b: 2, r: 100 }, L] });
  for (let i = 0; i < 20; i++) sim.step(0.00005);              // 1 ms in 50 us steps
  near('RL current after 1 tau (mA)', L.i * 1000, 50 * (1 - Math.exp(-1)), 1.6);
  for (let i = 0; i < 400; i++) sim.step(0.00005);
  near('RL steady current (mA)', L.i * 1000, 5 / 100.1 * 1000, 0.6);
}

// ---------------- v1.1 devices ----------------
function run(els, n, steps, dt) { const sim = new Sim({ nodeCount: n, elements: els }); for (let i = 0; i < (steps || 4); i++) sim.step(dt || 0.001); return sim; }
// 8. PNP high-side switch: emitter at 9 V, base pulled to ground through 10k, load 1k to ground
{
  const q = { type: 'Q', c: 3, b: 2, e: 1, is: 1e-14, bf: 100, br: 2, pol: -1 };
  const sim = run([{ type: 'V', a: 1, b: 0, v: 9, rs: 0.1 }, { type: 'R', a: 2, b: 0, r: 10000 }, { type: 'R', a: 3, b: 0, r: 1000 }, q], 4);
  near('PNP saturated: load gets ~Vcc−Vce(sat) (V)', sim.v[3], 9, 0.5);
  near('PNP base current flows OUT of the base (µA)', -q.ib * 1e6, (9 - 0.7) / 10000 * 1e6, 60);
  const off = run([{ type: 'V', a: 1, b: 0, v: 9, rs: 0.1 }, { type: 'V', a: 2, b: 0, v: 9, rs: 0.1 }, { type: 'R', a: 3, b: 0, r: 1000 }, { type: 'Q', c: 3, b: 2, e: 1, is: 1e-14, bf: 100, br: 2, pol: -1 }], 4);
  near('PNP off when base = emitter (load V ≈ 0)', off.v[3], 0, 0.01);
}
// 9. N-MOSFET low-side switch (logic level): gate 5 V, load 10 ohm from 9 V
{
  const m = { type: 'M', d: 2, g: 3, s: 0, kp: 8, vth: 1.8, pol: 1 };
  const sim = run([{ type: 'V', a: 1, b: 0, v: 9, rs: 0.1 }, { type: 'R', a: 1, b: 2, r: 10 }, { type: 'V', a: 3, b: 0, v: 5, rs: 0.1 }, m], 4);
  near('NMOS on: drain ≈ 0 (V)', sim.v[2], 0.3, 0.3);
  near('NMOS on: current ≈ 0.9 A', m.i, 0.9, 0.05);
  const off = run([{ type: 'V', a: 1, b: 0, v: 9, rs: 0.1 }, { type: 'R', a: 1, b: 2, r: 10 }, { type: 'V', a: 3, b: 0, v: 0, rs: 0.1 }, { type: 'M', d: 2, g: 3, s: 0, kp: 8, vth: 1.8, pol: 1 }], 4);
  near('NMOS off: drain = supply (V)', off.v[2], 9, 0.01);
  const half = new Sim({ nodeCount: 4, elements: [{ type: 'V', a: 1, b: 0, v: 9, rs: 0.1 }, { type: 'R', a: 1, b: 2, r: 10 }, { type: 'V', a: 3, b: 0, v: 2.2, rs: 0.1 }, { type: 'M', d: 2, g: 3, s: 0, kp: 8, vth: 1.8, pol: 1 }] });
  for (let i = 0; i < 4; i++) half.step(0.001);
  near('NMOS at Vgs = 2.2 V is in saturation (current from square law, A)', half.els[3].i, 0.5 * 8 * 0.4 * 0.4 * (1 + 0.02 * half.v[2]), 0.08);
}
// 10. P-MOSFET high-side switch: source 9 V, gate 0 V -> on
{
  const m = { type: 'M', d: 2, g: 3, s: 1, kp: 8, vth: 1.8, pol: -1 };
  const sim = run([{ type: 'V', a: 1, b: 0, v: 9, rs: 0.1 }, { type: 'R', a: 2, b: 0, r: 10 }, { type: 'V', a: 3, b: 0, v: 0, rs: 0.1 }, m], 4);
  near('PMOS on: load voltage ≈ supply (V)', sim.v[2], 8.8, 0.4);
  const off = run([{ type: 'V', a: 1, b: 0, v: 9, rs: 0.1 }, { type: 'R', a: 2, b: 0, r: 10 }, { type: 'V', a: 3, b: 0, v: 9, rs: 0.1 }, { type: 'M', d: 2, g: 3, s: 1, kp: 8, vth: 1.8, pol: -1 }], 4);
  near('PMOS off when gate = source (V)', off.v[2], 0, 0.01);
}
// 11. Zener shunt regulator: 12 V -> 470 ohm -> 5.1 V zener
{
  const isz = 1e-12, bv = 5.1 - 0.025852 * Math.log(5e-3 / isz);
  const z = { type: 'D', a: 0, b: 2, is: 1e-10, n: 1.7, bv, isz };
  const sim = run([{ type: 'V', a: 1, b: 0, v: 12, rs: 0.1 }, { type: 'R', a: 1, b: 2, r: 470 }, z], 3, 6);
  near('Zener holds ≈ 5.1 V', sim.v[2], 5.1, 0.3);
  const sim2 = run([{ type: 'V', a: 1, b: 0, v: 20, rs: 0.1 }, { type: 'R', a: 1, b: 2, r: 470 }, { type: 'D', a: 0, b: 2, is: 1e-10, n: 1.7, bv, isz }], 3, 6);
  near('Zener still ≈ 5.1 V with a 20 V supply', sim2.v[2], 5.1, 0.35);
  const sim3 = run([{ type: 'V', a: 1, b: 0, v: 3, rs: 0.1 }, { type: 'R', a: 1, b: 2, r: 470 }, { type: 'D', a: 0, b: 2, is: 1e-10, n: 1.7, bv, isz }], 3, 6);
  near('Zener not conducting at 3 V (node follows supply)', sim3.v[2], 3, 0.01);
  const fwd = run([{ type: 'V', a: 1, b: 0, v: -5, rs: 0.1 }, { type: 'R', a: 1, b: 2, r: 470 }, { type: 'D', a: 0, b: 2, is: 1e-10, n: 1.7, bv, isz }], 3, 6);
  near('Zener forward-biased drops ~0.6-0.8 V', fwd.v[2], -0.7, 0.15);
}
// op-amp helpers: nodes  1 = +9 V rail, 2 = IN+, 3 = IN−, 4 = OUT
const OA = (p, n, o) => ({ type: 'OA', p, n, o, vp: 1, vn: 0, gain: 1e5, ro: 50, mlo: 0.05, mhi: 1.5 });
// 12. voltage follower
{
  const sim = run([{ type: 'V', a: 1, b: 0, v: 9, rs: 0.1 }, { type: 'V', a: 2, b: 0, v: 3.3, rs: 0.1 }, OA(2, 4, 4), { type: 'R', a: 4, b: 0, r: 10000 }], 5);
  near('follower output = input (V)', sim.v[4], 3.3, 0.002);
  const hi = run([{ type: 'V', a: 1, b: 0, v: 9, rs: 0.1 }, { type: 'V', a: 2, b: 0, v: 8.8, rs: 0.1 }, OA(2, 4, 4), { type: 'R', a: 4, b: 0, r: 10000 }], 5);
  near('follower saturates below the rail (9 V − 1.5 V)', hi.v[4], 7.5, 0.05);
}
// 13. non-inverting amplifier gain 1 + 10k/1k = 11, in = 0.5 V -> 5.5 V
{
  const sim = run([{ type: 'V', a: 1, b: 0, v: 9, rs: 0.1 }, { type: 'V', a: 2, b: 0, v: 0.5, rs: 0.1 }, OA(2, 3, 4), { type: 'R', a: 4, b: 3, r: 10000 }, { type: 'R', a: 3, b: 0, r: 1000 }, { type: 'R', a: 4, b: 0, r: 100000 }], 5);
  near('non-inverting amp 0.5 V × 11 (V)', sim.v[4], 5.5, 0.01);
}
// 14. inverting amplifier on ±5 V rails: gain −4.7, in = 1 V -> −4.7 V
{
  const o = { type: 'OA', p: 0, n: 3, o: 4, vp: 1, vn: 5, gain: 1e5, ro: 50, mlo: 0.1, mhi: 0.1 };
  const sim = run([{ type: 'V', a: 1, b: 0, v: 5, rs: 0.1 }, { type: 'V', a: 0, b: 5, v: 5, rs: 0.1 }, { type: 'V', a: 2, b: 0, v: 1, rs: 0.1 }, { type: 'R', a: 2, b: 3, r: 10000 }, { type: 'R', a: 3, b: 4, r: 47000 }, o], 6);
  near('inverting amp 1 V × −4.7 (V)', sim.v[4], -4.7, 0.01);
}
// 15. comparator (open loop): IN+ above IN− -> output high; below -> low
{
  const hi = run([{ type: 'V', a: 1, b: 0, v: 9, rs: 0.1 }, { type: 'V', a: 2, b: 0, v: 2.6, rs: 0.1 }, { type: 'V', a: 3, b: 0, v: 2.5, rs: 0.1 }, OA(2, 3, 4), { type: 'R', a: 4, b: 0, r: 10000 }], 5);
  near('comparator high (V)', hi.v[4], 7.5, 0.05);
  const lo = run([{ type: 'V', a: 1, b: 0, v: 9, rs: 0.1 }, { type: 'V', a: 2, b: 0, v: 2.4, rs: 0.1 }, { type: 'V', a: 3, b: 0, v: 2.5, rs: 0.1 }, OA(2, 3, 4), { type: 'R', a: 4, b: 0, r: 10000 }], 5);
  near('comparator low (V)', lo.v[4], 0.05, 0.05);
  const unp = run([{ type: 'V', a: 2, b: 0, v: 2.6, rs: 0.1 }, { type: 'V', a: 3, b: 0, v: 2.5, rs: 0.1 }, { type: 'R', a: 6, b: 0, r: 1000 }, OA(2, 3, 4), { type: 'R', a: 4, b: 0, r: 10000 }], 7);
  near('unpowered op-amp output ≈ 0 (V)', unp.v[4], 0, 0.01);
}
// 16. Schmitt trigger (positive feedback): hysteresis — state is remembered between thresholds
{
  // IN+ divider from OUT (10k) and a reference of 4.5 V via 10k:  V+ = (Vout + Vref) / 2 ; IN− = signal (node 3, source 8)
  const sg = { type: 'V', a: 3, b: 0, v: 0, rs: 0.1 };
  const sim = new Sim({ nodeCount: 6, elements: [{ type: 'V', a: 1, b: 0, v: 9, rs: 0.1 }, { type: 'V', a: 5, b: 0, v: 4.5, rs: 0.1 }, sg, { type: 'R', a: 4, b: 2, r: 10000 }, { type: 'R', a: 5, b: 2, r: 10000 }, OA(2, 3, 4), { type: 'R', a: 4, b: 0, r: 100000 }] });
  const at = v => { sg.v = v; for (let i = 0; i < 3; i++) sim.step(0.001); return sim.v[4]; };
  at(0);
  near('Schmitt: signal 0 V -> output high (V)', sim.v[4], 7.5, 0.1);
  at(5.5); near('Schmitt: signal 5.5 V (between thresholds ≈ 3 V and 6 V) keeps output high', sim.v[4], 7.5, 0.1);
  at(7); near('Schmitt: signal 7 V flips output low', sim.v[4], 0.05, 0.1);
  at(5.5); near('Schmitt: back at 5.5 V output STAYS low (hysteresis)', sim.v[4], 0.05, 0.1);
  at(2); near('Schmitt: signal 2 V flips output high again', sim.v[4], 7.5, 0.1);
}
// 17. inductive kick is limited, not infinite (relay coil switched off without a flyback diode)
{
  const sw = { type: 'R', a: 1, b: 2, r: 0.01 };
  const sim = new Sim({ nodeCount: 4, elements: [{ type: 'V', a: 1, b: 0, v: 12, rs: 0.1 }, sw, { type: 'L', a: 2, b: 3, l: 0.2 }, { type: 'R', a: 3, b: 0, r: 70 }] });
  for (let i = 0; i < 100; i++) sim.step(0.0002);
  sw.r = 1e9;
  let peak = 0; for (let i = 0; i < 20; i++) { sim.step(0.0002); peak = Math.max(peak, Math.abs(sim.v[2]), Math.abs(sim.v[3])); }
  console.log('   kick peak (V):', peak.toFixed(1), 'converged:', sim.converged);
  near('kick peak stays finite (well below 1 kV)', Math.min(peak, 1000), peak, 1e-9);
  near('and is large (> 30 V) — a real spike', peak > 30 ? 1 : 0, 1, 0);
}
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll solver tests passed');
process.exit(fails ? 1 : 0);
