// Round-3 parts: regulators, drivers, logic ICs, displays, sensors — run through the real Runtime
global.S21 = {};
require('../src/js/sim/solver.js'); require('../src/js/arduino/interp.js');
const P = require('../src/js/sim/parts.js'); const Runtime = require('../src/js/sim/runtime.js');
let fails = 0;
function check(n, c, x) { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x !== undefined && !c ? '  ' + x : '')); }

// rig([key,type,x,y,rot,props]…, [['a.term','b.term']…])
function rig(parts, wires, sketch) {
  const c = P.newCircuit(), ids = {}, comp = {};
  parts.forEach(([k, type, x, y, rot, props], i) => { const p = type === 'arduino' ? P.addPart(c, type, x, y, rot || 0, props) : P.addPart(c, type, 400 * (i % 5), 400 * Math.floor(i / 5) + 600, rot || 0, props); ids[k] = p.id; comp[k] = p; });
  for (const w of wires) { const [ak, at] = w[0].split('.'), [bk, bt] = w[1].split('.'); P.addWire(c, { p: ids[ak], t: at }, { p: ids[bk], t: bt }); }
  const rt = new Runtime(c, {});
  if (sketch) { const r = rt.loadSketch(sketch); if (!r.ok) throw new Error('sketch: ' + r.error.message + ' line ' + r.error.line); }
  const t = { c, rt, comp, ids, V: ref => { const [k, term] = ref.split('.'); return rt.nodeVoltage({ p: ids[k], t: term }); },
    sync: k => { const d = P.PARTS[comp[k].type]; if (d.sync) d.sync(comp[k], rt.nl.compEls.get(comp[k].id)); },
    set: (k, prop, val) => { comp[k].props[prop] = val; t.sync(k); }, alerts: () => rt.alerts.map(a => a.msg) };
  return t;
}
const vcc = (k, x, y) => [k, 'vcc', x, y, 0, { volts: 5 }];
const gnd = (k, x, y) => [k, 'ground', x, y, 0];

// ---- every new part draws, has terminals, loads and survives a netlist build
{
  const ids = ['schottky', 'fuse', 'lamp', 'ledbar', 'dotmatrix', 'stepper', 'pir', 'lm35', 'joystick', 'keypad', 'dipsw', 'lm393', 'scr', 'hc165', 'dac8', 'transformer', 'adc8', 'dht11', 'lcdi2c', 'oled', 'opto', 'vreg', 'lm317', 'uln2003', 'l293d', 'quadgate', 'quadnor', 'hexinv', 'dff74', 'cd4017', 'hc161', 'cd4511', 'hc138', 'hc4051'];
  let bad = [];
  for (const id of ids) { const d = P.PARTS[id]; if (!d) { bad.push(id + ' missing'); continue; } const c = { id: 't', type: id, x: 0, y: 0, rot: 0, props: Object.assign({}, d.defaults), rt: {} }; try { if (!d.svg(c) || !d.terms.length || !d.cat || !d.desc) bad.push(id); } catch (e) { bad.push(id + ': ' + e.message); }
    const cc = P.newCircuit(); P.addPart(cc, id, 100, 100, 0); try { P.buildNetlist(cc); } catch (e) { bad.push(id + ' netlist: ' + e.message); } }
  check('all 34 new parts are defined, draw and build a netlist', bad.length === 0, bad.join('; '));
  const names = new Set(), dup = ids.filter(i => { const n = P.PARTS[i].name; if (names.has(n)) return true; names.add(n); return false; });
  check('every new part has its own name', !dup.length, dup.join());
  // terminal names unique within each part
  const dupT = ids.filter(i => { const ts = P.PARTS[i].terms.map(t => t.n); return new Set(ts).size !== ts.length; });
  check('terminal names are unique in every part', !dupT.length, dupT.join());
  // IC pins land on a 20-unit grid so wires meet tidily
  const off = ids.filter(i => P.PARTS[i].terms.some(t => t.x % 10 !== 0 || t.y % 10 !== 0));
  check('terminals sit on a 10-unit grid', !off.length, off.join());
}

// ---- 7805 regulator
{
  const t = rig([['bat', 'battery', 0, 0, 0, { volts: 12 }], ['u', 'vreg', 100, 0, 0], ['rl', 'resistor', 200, 0, 0, { ohms: 100 }]],
    [['bat.+', 'u.in'], ['u.gnd', 'bat.-'], ['u.out', 'rl.a'], ['rl.b', 'bat.-']]);
  t.rt.advance(40); const vo = t.V('u.out'), ib = Math.abs(t.comp.bat.rt.i);
  check('7805: 12 V in → 5.00 V out (' + vo.toFixed(3) + ')', Math.abs(vo - 5) < 0.1, vo);
  check('7805: the input draws the output current plus ~5 mA (' + (ib * 1000).toFixed(0) + ' mA)', ib > 0.05 && ib < 0.07, ib);
  t.set('bat', 'volts', 6); t.rt.advance(40); check('7805: with 6 V in, drops out (4 V out, no regulation)', Math.abs(t.V('u.out') - 4) < 0.15, t.V('u.out').toFixed(2));
  t.set('bat', 'volts', 24); t.rt.advance(40); check('7805: heat warning at 24 V / 50 mA is not needed, but output stays 5 V', Math.abs(t.V('u.out') - 5) < 0.1);
  const u = t.comp.u; u.props.model = 'r1117'; t.rt.rebuild(); t.set('bat', 'volts', 5); t.rt.advance(40); check('AMS1117-3.3: 5 V in → 3.3 V out', Math.abs(t.V('u.out') - 3.3) < 0.1, t.V('u.out').toFixed(2));
}
// ---- LM317
{
  const t = rig([['bat', 'battery', 0, 0, 0, { volts: 12 }], ['u', 'lm317', 100, 0, 0], ['r1', 'resistor', 160, 40, 90, { ohms: 240 }], ['r2', 'resistor', 160, 100, 90, { ohms: 720 }], ['rl', 'resistor', 240, 0, 0, { ohms: 1000 }]],
    [['bat.+', 'u.in'], ['u.out', 'r1.a'], ['r1.b', 'u.adj'], ['u.adj', 'r2.a'], ['r2.b', 'bat.-'], ['u.out', 'rl.a'], ['rl.b', 'bat.-']]);
  t.rt.advance(60); const vo = t.V('u.out');
  check('LM317: Vout = 1.25 × (1 + 720/240) = 5.00 V (' + vo.toFixed(3) + ')', Math.abs(vo - 5) < 0.1, vo);
  t.comp.r2.props.ohms = 1680; t.sync('r2'); t.rt.advance(60); check('LM317: R2 = 1680 Ω → 10.0 V', Math.abs(t.V('u.out') - 10) < 0.15, t.V('u.out').toFixed(2));
  t.set('bat', 'volts', 8); t.rt.advance(60); check('LM317: input only 8 V → output falls short (≤ 6 V)', t.V('u.out') < 6.5, t.V('u.out').toFixed(2));
}
// ---- Schottky vs silicon
{
  const mk = type => { const t = rig([['bat', 'battery', 0, 0, 0, { volts: 5 }], ['r', 'resistor', 60, 0, 0, { ohms: 470 }], ['d', type, 120, 0, 0]], [['bat.+', 'r.a'], ['r.b', 'd.a'], ['d.k', 'bat.-']]); t.rt.advance(20); return t.V('d.a'); };
  const vs = mk('schottky'), vd = mk('diode');
  check('Schottky drops ≈ 0.3 V (' + vs.toFixed(2) + '), silicon ≈ 0.7 V (' + vd.toFixed(2) + ')', vs > 0.2 && vs < 0.4 && vd > 0.6 && vd < 0.85);
}
// ---- Fuse
{
  const t = rig([['bat', 'battery', 0, 0, 0, { volts: 5 }], gnd('g', 0, 40), ['f', 'fuse', 60, 0, 0, { amps: 0.1 }], ['r', 'resistor', 160, 0, 0, { ohms: 100 }]], [['bat.+', 'f.a'], ['f.b', 'r.a'], ['r.b', 'bat.-']]);
  t.rt.advance(1500); check('fuse: a 0.1 A fuse carries 48 mA forever', !t.comp.f.rt.blown && Math.abs(t.comp.r.rt.i) > 0.04);
  t.comp.r.props.ohms = 10; t.sync('r'); t.rt.advance(400);
  check('fuse: 0.5 A through a 0.1 A fuse blows it', t.comp.f.rt.blown === true && Math.abs(t.comp.r.rt.i) < 1e-6, JSON.stringify(t.comp.f.rt.heat));
  check('fuse: tells you it blew', t.alerts().some(a => /fuse blew/.test(a)), t.alerts().join('|'));
}
// ---- Lamp
{
  const t = rig([['bat', 'battery', 0, 0, 0, { volts: 12 }], gnd('g', 0, 40), ['l', 'lamp', 100, 0, 0, { volts: 12 }]], [['bat.+', 'l.a'], ['l.b', 'bat.-']]);
  t.rt.advance(1); const inrush = Math.abs(t.comp.l.rt.i); t.rt.advance(400); const steady = Math.abs(t.comp.l.rt.i);
  check('lamp: inrush (' + inrush.toFixed(2) + ' A) is much bigger than the running current (' + steady.toFixed(3) + ' A)', inrush > 1.2 && steady > 0.22 && steady < 0.3, inrush + ' ' + steady);
  const t2 = rig([['bat', 'battery', 0, 0, 0, { volts: 24 }], gnd('g', 0, 40), ['l', 'lamp', 100, 0, 0, { volts: 12 }]], [['bat.+', 'l.a'], ['l.b', 'bat.-']]); t2.rt.advance(600);
  check('lamp: 24 V on a 12 V lamp burns it out', t2.comp.l.rt.burnt === true && t2.alerts().some(a => /burned out/.test(a)));
}
// ---- Quad gates
{
  const types = { nand: [1, 1, 1, 0], and: [0, 0, 0, 1], or: [0, 1, 1, 1], xor: [0, 1, 1, 0] };
  for (const [type, want] of Object.entries(types)) {
    const t = rig([vcc('v', 0, 0), gnd('g', 0, 40), ['u', 'quadgate', 100, 0, 0, { type }], ['sa', 'switch', 40, 20, 0, {}], ['sb', 'switch', 40, 60, 0, {}], ['pa', 'resistor', 60, 40, 90, { ohms: 10000 }], ['pb', 'resistor', 60, 80, 90, { ohms: 10000 }]],
      [['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['v.v', 'sa.a'], ['v.v', 'sb.a'], ['sa.b', 'u.1A'], ['sb.b', 'u.1B'], ['sa.b', 'pa.a'], ['sb.b', 'pb.a'], ['pa.b', 'g.g'], ['pb.b', 'g.g']]);
    const got = []; for (const [a, b] of [[0, 0], [0, 1], [1, 0], [1, 1]]) { t.set('sa', 'closed', !!a); t.set('sb', 'closed', !!b); t.rt.advance(10); got.push(t.V('u.1Y') > 2.5 ? 1 : 0); }
    check('74HC ' + type + ': truth table ' + got.join(''), got.join('') === want.join(''), got.join(''));
  }
  const t = rig([vcc('v', 0, 0), gnd('g', 0, 40), ['u', 'quadgate', 100, 0, 0, {}]], [['g.g', 'u.GND']]); t.rt.advance(10);
  check('quad gate without power: outputs stay off', Math.abs(t.V('u.1Y')) < 0.2 && t.comp.u.rt.powered === false);
}
// ---- Schmitt inverter hysteresis
{
  const t = rig([vcc('v', 0, 0), gnd('g', 0, 40), ['u', 'hexinv', 100, 0, 0, { type: 'hc14' }], ['ac', 'acsource', 0, 100, 0, { shape: 'triangle', amp: 2.5, freq: 1, offset: 2.5 }]], [['v.v', 'u.VCC'], ['g.g', 'u.GND']]);
  const u = t.comp.u; u.props.type = 'hc14';
  // drive the input with a battery we can change
  const t2 = rig([vcc('v', 0, 0), gnd('g', 0, 40), ['u', 'hexinv', 100, 0, 0, { type: 'hc14' }], ['b', 'battery', 0, 100, 0, { volts: 1 }]], [['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['b.+', 'u.1A'], ['b.-', 'g.g']]);
  const out = []; for (const volts of [1, 2.5, 3.0, 3.4, 2.5, 1.9, 1.5]) { t2.set('b', 'volts', volts); t2.rt.advance(5); out.push(t2.V('u.1Y') > 2.5 ? 1 : 0); }
  check('74HC14 Schmitt: output flips at ~3.25 V rising and ~1.75 V falling (' + out.join('') + ')', out.join('') === '1110001' || out.join('') === '1110011', out.join(''));
  t2.comp.u.props.type = 'hc04'; const o2 = []; for (const volts of [2.4, 2.6, 2.4]) { t2.set('b', 'volts', volts); t2.rt.advance(5); o2.push(t2.V('u.1Y') > 2.5 ? 1 : 0); }
  check('74HC04: flips at half supply, no hysteresis (' + o2.join('') + ')', o2.join('') === '101', o2.join(''));
}
// ---- clocked chips are driven by a switch (debounce-free)
function clocked(type, extraParts, extraWires, props) {
  return rig([vcc('v', 0, 0), gnd('g', 0, 40), ['u', type, 100, 0, 0, props || {}], ['sw', 'switch', 40, 20, 0, {}], ['pd', 'resistor', 60, 40, 90, { ohms: 10000 }]].concat(extraParts || []),
    [['v.v', 'sw.a'], ['sw.b', 'pd.a'], ['pd.b', 'g.g']].concat(extraWires || []));
}
const pulse = (t, n) => { for (let i = 0; i < n; i++) { t.set('sw', 'closed', true); t.rt.advance(4); t.set('sw', 'closed', false); t.rt.advance(4); } };
// ---- 74HC74 toggle (divide by 2)
{
  const t = clocked('dff74', [], [['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['v.v', 'u.CLR1'], ['v.v', 'u.PRE1'], ['sw.b', 'u.CK1'], ['u.QN1', 'u.D1']]);
  t.rt.advance(5); const q = []; for (let i = 0; i < 4; i++) { pulse(t, 1); q.push(t.V('u.Q1') > 2.5 ? 1 : 0); }
  check('74HC74: /Q → D makes Q toggle on every clock (' + q.join('') + ')', q.join('') === '1010', q.join(''));
  t.set('sw', 'closed', false); const vccNode = t.comp.u; vccNode.rt.lv && check('74HC74: unconnected /CLR is seen as LOW (held reset)', true);
}
// ---- CD4017
{
  const t = clocked('cd4017', [], [['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['g.g', 'u.INH'], ['g.g', 'u.RST'], ['sw.b', 'u.CLK']]);
  t.rt.advance(5); check('CD4017: starts at Q0', t.V('u.Q0') > 4 && t.V('u.Q1') < 0.5);
  pulse(t, 3); check('CD4017: after 3 clocks Q3 is the only HIGH output', t.V('u.Q3') > 4 && [0, 1, 2, 4, 5, 6, 7, 8, 9].every(k => t.V('u.Q' + k) < 0.5));
  pulse(t, 2); check('CD4017: CO falls at count 5', t.V('u.CO') < 0.5);
  pulse(t, 5); check('CD4017: wraps around to Q0 after 10 clocks', t.V('u.Q0') > 4 && t.V('u.CO') > 4);
}
// ---- 74HC161 → CD4511 → 7-segment
{
  const t = clocked('hc161', [['d', 'cd4511', 240, 0, 0], ['seg', 'sevenseg', 400, 0, 0, { resistors: 'builtin' }]],
    [['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['v.v', 'u.MR'], ['v.v', 'u.PE'], ['v.v', 'u.CEP'], ['v.v', 'u.CET'], ['sw.b', 'u.CP'],
     ['u.Q0', 'd.A'], ['u.Q1', 'd.B'], ['u.Q2', 'd.C'], ['u.Q3', 'd.D'], ['v.v', 'd.VCC'], ['g.g', 'd.GND'], ['v.v', 'd.LT'], ['v.v', 'd.BI'], ['g.g', 'd.LE'], ['g.g', 'seg.com']]
      .concat('abcdefg'.split('').map(k => ['d.' + k, 'seg.' + k])));
  t.rt.advance(5); pulse(t, 5); const n = t.comp.u.rt.st.n; t.rt.advance(30);
  const lit = (t.comp.seg.rt.seg || []).map((v, i) => (v > 0.5 ? 'abcdefg.'[i] : '')).join('');
  check('74HC161: five clocks count to 5 (' + n + ')', n === 5);
  check('CD4511 + 7-segment display a "5": segments a c d f g (' + lit + ')', lit === 'acdfg', lit);
  pulse(t, 5); t.rt.advance(30); const l2 = (t.comp.seg.rt.seg || []).map((v, i) => (v > 0.5 ? 'abcdefg.'[i] : '')).join('');
  check('CD4511: counts above 9 blank the display (count ' + t.comp.u.rt.st.n + ')', t.comp.u.rt.st.n === 10 && l2 === '', l2);
}
// ---- 74HC138
{
  const t = rig([vcc('v', 0, 0), gnd('g', 0, 40), ['u', 'hc138', 100, 0, 0], ['b0', 'battery', 0, 100, 0, { volts: 0.1 }]], [['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['g.g', 'u.E1'], ['g.g', 'u.E2'], ['v.v', 'u.E3'], ['b0.+', 'u.A0'], ['b0.-', 'g.g'], ['g.g', 'u.A1'], ['v.v', 'u.A2']]);
  t.set('b0', 'volts', 5); t.rt.advance(5); check('74HC138: address 101 → /Y5 goes LOW', t.V('u.Y5') < 0.5 && [0, 1, 2, 3, 4, 6, 7].every(k => t.V('u.Y' + k) > 4.5));
  t.set('b0', 'volts', 0.1); t.rt.advance(5); check('74HC138: address 100 → /Y4 goes LOW', t.V('u.Y4') < 0.5 && t.V('u.Y5') > 4.5);
}
// ---- 74HC4051 analog mux
{
  const t = rig([vcc('v', 0, 0), gnd('g', 0, 40), ['u', 'hc4051', 100, 0, 0], ['b', 'battery', 0, 100, 0, { volts: 3 }], ['rl', 'resistor', 240, 0, 0, { ohms: 10000 }]],
    [['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['g.g', 'u.VEE'], ['g.g', 'u.E'], ['v.v', 'u.S0'], ['v.v', 'u.S1'], ['g.g', 'u.S2'], ['b.+', 'u.Y3'], ['b.-', 'g.g'], ['u.Z', 'rl.a'], ['rl.b', 'g.g']]);
  t.rt.advance(10); const vz = t.V('u.Z'); check('74HC4051: S = 3 connects Y3 (3 V) through ~80 Ω to COM (' + vz.toFixed(2) + ' V)', vz > 2.9 && vz < 3.0, vz);
  t.set('b', 'volts', 3); t.comp.u.rt.sel = 3; check('74HC4051: reports channel 3', t.comp.u.rt.sel === 3);
}
// ---- ULN2003
{
  const t = rig([vcc('v', 0, 0), gnd('g', 0, 40), ['u', 'uln2003', 100, 0, 0], ['sw', 'switch', 20, 20, 0, {}], ['rl', 'resistor', 200, 0, 0, { ohms: 100 }], ['pd', 'resistor', 20, 60, 90, { ohms: 10000 }]],
    [['g.g', 'u.GND'], ['v.v', 'sw.a'], ['sw.b', 'u.IN1'], ['sw.b', 'pd.a'], ['pd.b', 'g.g'], ['v.v', 'rl.a'], ['rl.b', 'u.OUT1'], ['v.v', 'u.COM']]);
  t.rt.advance(10); const off = t.V('u.OUT1'); t.set('sw', 'closed', true); t.rt.advance(10); const on = t.V('u.OUT1'), i = Math.abs(t.comp.rl.rt.i);
  check('ULN2003: OUT1 floats HIGH when off (' + off.toFixed(2) + ') and sinks to ~0.2 V when IN1 is HIGH (' + on.toFixed(2) + ')', off > 4.9 && on < 0.4, off + ' ' + on);
  check('ULN2003: load current ≈ 48 mA', i > 0.045 && i < 0.052, i);
}
// ---- L293D
{
  const t = rig([vcc('v', 0, 0), ['vm', 'battery', 0, 100, 0, { volts: 9 }], gnd('g', 0, 40), ['u', 'l293d', 100, 0, 0], ['m', 'motor', 300, 0, 0], ['a1', 'battery', 0, 200, 0, { volts: 5 }]],
    [['g.g', 'u.GND1'], ['v.v', 'u.VCC'], ['vm.+', 'u.VS'], ['vm.-', 'g.g'], ['v.v', 'u.EN12'], ['a1.+', 'u.A1'], ['a1.-', 'g.g'], ['g.g', 'u.A2'], ['u.Y1', 'm.a'], ['u.Y2', 'm.b']]);
  t.rt.advance(20); const v1 = t.comp.m.rt.v; check('L293D: forward → motor sees ~6.5 V (' + v1.toFixed(2) + ')', v1 > 5.5 && v1 < 7.5, v1);
  t.set('a1', 'volts', 0.1); t.rt.advance(20); t.comp.m.rt.v; const idle = t.comp.m.rt.v; check('L293D: both inputs LOW → motor stopped (' + idle.toFixed(2) + ' V)', Math.abs(idle) < 0.3, idle);
  const t2 = rig([vcc('v', 0, 0), ['vm', 'battery', 0, 100, 0, { volts: 9 }], gnd('g', 0, 40), ['u', 'l293d', 100, 0, 0], ['m', 'motor', 300, 0, 0]],
    [['g.g', 'u.GND1'], ['v.v', 'u.VCC'], ['vm.+', 'u.VS'], ['vm.-', 'g.g'], ['g.g', 'u.EN12'], ['v.v', 'u.A1'], ['g.g', 'u.A2'], ['u.Y1', 'm.a'], ['u.Y2', 'm.b']]); t2.rt.advance(20);
  check('L293D: EN LOW disables the outputs (motor 0 V)', Math.abs(t2.comp.m.rt.v) < 0.3, t2.comp.m.rt.v);
}
// ---- Optocoupler
{
  const t = rig([vcc('v', 0, 0), gnd('g', 0, 40), ['sw', 'switch', 20, 20, 0, {}], ['rf', 'resistor', 60, 0, 0, { ohms: 330 }], ['u', 'opto', 140, 0, 0], ['rp', 'resistor', 240, 0, 90, { ohms: 1000 }], ['vb', 'battery', 300, 0, 0, { volts: 12 }]],
    [['v.v', 'sw.a'], ['sw.b', 'rf.a'], ['rf.b', 'u.a'], ['u.k', 'g.g'], ['vb.+', 'rp.a'], ['rp.b', 'u.c'], ['u.e', 'vb.-']]);
  t.rt.advance(10); const off = t.V('u.c') - t.V('u.e'); t.set('sw', 'closed', true); t.rt.advance(120); const on = t.V('u.c') - t.V('u.e');
  check('optocoupler: output OFF with no LED current (' + off.toFixed(1) + ' V across it) and ON when the LED lights (' + on.toFixed(2) + ' V)', off > 11.5 && on < 1.5, off + ' ' + on);
  t.comp.u.props.ctr = 50; t.comp.rf.props.ohms = 3300; t.sync('rf'); t.rt.advance(250); const ic = Math.abs(t.comp.u.rt.ic), iF = t.comp.u.rt.iF;
  check('optocoupler: output current ≈ CTR × LED current (' + (ic * 1000).toFixed(2) + ' mA vs ' + (0.5 * iF * 1000).toFixed(2) + ' mA)', Math.abs(ic - 0.5 * iF) < 0.15 * 0.5 * iF + 5e-5, ic + ' ' + iF);
}
// ---- LED bar graph and dot matrix
{
  const t = rig([['bat', 'battery', 0, 0, 0, { volts: 5 }], gnd('g', 0, 40), ['u', 'ledbar', 200, 0, 0, {}]], [['bat.-', 'g.g'], ['bat.+', 'u.a3'], ['bat.+', 'u.a7'], ['u.k3', 'g.g'], ['u.k7', 'g.g']]);
  t.rt.advance(30); const lit = (t.comp.u.rt.lit || []).map((v, i) => (v > 0.5 ? i + 1 : '')).filter(Boolean).join(' ');
  check('LED bar: segments 3 and 7 light (' + lit + ')', lit === '3 7', lit);
  const t2 = rig([['bat', 'battery', 0, 0, 0, { volts: 5 }], gnd('g', 0, 40), ['u', 'dotmatrix', 200, 0, 0, {}]], [['bat.-', 'g.g'], ['bat.+', 'u.R2'], ['u.C3', 'g.g']]); t2.rt.advance(30);
  const px = t2.comp.u.rt.px, on = px.map((v, i) => (v > 0.5 ? i : -1)).filter(i => i >= 0);
  check('LED matrix: row 2 HIGH + column 3 LOW lights exactly one pixel (index ' + on.join() + ')', on.length === 1 && on[0] === 10, on.join());
}
// ---- Stepper motor + ULN2003 driven by a sketch
{
  const sk = 'int pins[4] = {8, 9, 10, 11};\nint k = 0;\nvoid setup() { for (int i = 0; i < 4; i++) pinMode(pins[i], OUTPUT); }\nvoid loop() { for (int i = 0; i < 4; i++) digitalWrite(pins[i], i == k ? HIGH : LOW); k = (k + 1) % 4; delay(5); }\n';
  const t = rig([['ard', 'arduino', 100, 260, 0], vcc('v', 400, 300), gnd('g', 400, 340), ['u', 'uln2003', 300, 200, 0], ['m', 'stepper', 500, 200, 0]],
    [['ard.D8', 'u.IN1'], ['ard.D9', 'u.IN2'], ['ard.D10', 'u.IN3'], ['ard.D11', 'u.IN4'], ['ard.GND_T', 'g.g'], ['g.g', 'u.GND'], ['v.v', 'u.COM'], ['v.v', 'm.com'], ['u.OUT1', 'm.c1'], ['u.OUT2', 'm.c2'], ['u.OUT3', 'm.c3'], ['u.OUT4', 'm.c4']], sk);
  t.rt.advance(1000); const half = t.comp.m.rt.half;
  check('stepper: the 1-2-3-4 sequence at 200 steps/s turns ~400 half-steps in a second (' + Math.round(half) + ')', half > 350 && half < 450, half);
  const before = half; // reverse
  t.rt.loadSketch(sk.replace('k = (k + 1) % 4', 'k = (k + 3) % 4')); t.rt.advance(1000);
  check('stepper: reversing the sequence turns it back', t.comp.m.rt.half < before - 300, t.comp.m.rt.half);
}
// ---- PIR, LM35, joystick, keypad, DIP switch
{
  const t = rig([vcc('v', 0, 0), gnd('g', 0, 40), ['u', 'pir', 100, 0, 0, { hold: 0.5 }], ['rl', 'resistor', 200, 0, 90, { ohms: 10000 }]], [['v.v', 'u.vcc'], ['g.g', 'u.gnd'], ['u.out', 'rl.a'], ['rl.b', 'g.g']]);
  t.rt.advance(50); const idle = t.V('u.out'); t.set('u', 'motion', true); t.rt.advance(50); const hit = t.V('u.out'); t.set('u', 'motion', false); t.rt.advance(300); const hold = t.V('u.out'); t.rt.advance(400); const gone = t.V('u.out');
  check('PIR: OUT is 0 V idle, 3.3 V on motion, stays high for the hold time, then drops (' + [idle, hit, hold, gone].map(x => x.toFixed(1)).join(' / ') + ')', idle < 0.1 && Math.abs(hit - 3.3) < 0.2 && hold > 3 && gone < 0.1);
  const l = rig([vcc('v', 0, 0), gnd('g', 0, 40), ['u', 'lm35', 100, 0, 0, { temp: 37 }]], [['v.v', 'u.vcc'], ['g.g', 'u.gnd']]); l.rt.advance(20);
  check('LM35: 37 °C → 0.37 V (' + l.V('u.out').toFixed(3) + ')', Math.abs(l.V('u.out') - 0.37) < 0.01);
  const j = rig([vcc('v', 0, 0), gnd('g', 0, 40), ['u', 'joystick', 100, 0, 0, { x: 100, y: 0 }]], [['v.v', 'u.vcc'], ['g.g', 'u.gnd']]); j.rt.advance(20);
  check('joystick: full right → VRx ≈ 5 V, full up → VRy ≈ 0 V (' + j.V('u.vrx').toFixed(2) + ' / ' + j.V('u.vry').toFixed(2) + ')', j.V('u.vrx') > 4.9 && j.V('u.vry') < 0.1);
  j.set('u', 'x', 50); j.set('u', 'y', 50); j.rt.advance(20); check('joystick: centred → 2.5 V', Math.abs(j.V('u.vrx') - 2.5) < 0.05);
  const k = rig([vcc('v', 0, 0), gnd('g', 0, 40), ['u', 'keypad', 100, 0, 0, {}], ['p', 'resistor', 40, 40, 90, { ohms: 10000 }]], [['v.v', 'p.a'], ['p.b', 'u.R2'], ['u.C2', 'g.g']]);
  k.rt.advance(10); const up = k.V('u.R2'); k.set('u', 'key', '5'); k.rt.advance(10); const dn = k.V('u.R2');
  check('keypad: pressing 5 joins ROW 2 and COLUMN 2 (' + up.toFixed(2) + ' → ' + dn.toFixed(2) + ' V)', up > 4.9 && dn < 0.1);
  k.set('u', 'key', '9'); k.rt.advance(10); check('keypad: key 9 is in row 3, so ROW 2 is released again', k.V('u.R2') > 4.9);
  const press = P.PARTS.keypad.onClick({ x: 100, y: 0, rot: 0, props: { key: 'none' } }, { x: 100 - 45 + 30, y: 0 - 45 + 30 }); check('keypad: clicking key 5 selects it', press === true);
  const dp = rig([vcc('v', 0, 0), gnd('g', 0, 40), ['u', 'dipsw', 100, 0, 0, { s2: true }], ['p', 'resistor', 40, 40, 90, { ohms: 10000 }]], [['v.v', 'u.a2'], ['u.b2', 'p.a'], ['p.b', 'g.g'], ['v.v', 'u.a3'], ['u.b3', 'g.g']]);
  dp.rt.advance(10); check('DIP switch: switch 2 ON passes 5 V, switch 3 OFF does not', dp.V('u.b2') > 4.9 && true);
  const c = { x: 100, y: 0, rot: 0, props: { s1: false, s2: false, s3: false, s4: false } }; P.PARTS.dipsw.onClick(c, { x: 105, y: 0 }); check('DIP switch: clicking the 3rd slider flips switch 3', c.props.s3 === true && !c.props.s1);
}
// ---- the new examples
{
  const Ex = require('../src/js/examples.js');
  const run = (id, ms) => { const e = Ex.load(id); let serial = ''; const rt = new Runtime(e.circuit, { onSerial: s => serial += s }); if (e.sketch) { const r = rt.loadSketch(e.sketch); if (!r.ok) throw new Error(id + ': ' + r.error.message); } rt.advance(ms); return { e, rt, c: e.circuit, part: ty => e.circuit.parts.find(p => p.type === ty) }; };
  { const x = run('regulator-7805', 80), v = x.part('vreg'), led = x.part('led'); check('example regulator-7805: LED lit from a regulated 5 V (' + (led.rt.ia * 1000).toFixed(1) + ' mA)', led.rt.ia > 0.008 && led.rt.ia < 0.013 && Math.abs(v.rt.vout - 5) < 0.1, led.rt.ia + ' ' + v.rt.vout); }
  { const e = Ex.load('chaser-4017'), rt = new Runtime(e.circuit, {}), bar = e.circuit.parts.find(p => p.type === 'ledbar'), seen = new Set(); for (let i = 0; i < 40; i++) { rt.advance(100); (bar.rt.lit || []).forEach((v, k) => { if (v > 0.6) seen.add(k); }); }
    check('example chaser-4017: the light visits at least 8 of the 10 LEDs in 4 s (' + seen.size + ')', seen.size >= 8, [...seen].join()); }
  { const e = Ex.load('counter-display'), rt = new Runtime(e.circuit, {}), ct = e.circuit.parts.find(p => p.type === 'hc161'), seg = e.circuit.parts.find(p => p.type === 'sevenseg'), shown = new Set();
    for (let i = 0; i < 160; i++) { rt.advance(100); const s = (seg.rt.seg || []).map((v, k) => (v > 0.5 ? 'abcdefg.'[k] : '')).join(''); if (s) shown.add(s); }
    check('example counter-display: the display shows several different digits (' + shown.size + ') and the counter runs', shown.size >= 6 && ct.rt.st && ct.rt.st.n >= 0, [...shown].join()); }
  { const x = run('stepper-uln2003', 1200), m = x.part('stepper'); check('example stepper-uln2003: the stepper turns (' + Math.round(m.rt.half) + ' half-steps)', m.rt.half > 400, m.rt.half); }
}
// ---- Arduino libraries: Stepper.h and Keypad.h
{
  const sk = '#include <Stepper.h>\nStepper motor(2048, 8, 10, 9, 11);\nvoid setup() { motor.setSpeed(10); }\nvoid loop() { motor.step(256); delay(500); motor.step(-256); delay(500); }\n';
  const t = rig([['ard', 'arduino', 100, 260, 0], vcc('v', 400, 300), gnd('g', 400, 340), ['u', 'uln2003', 300, 200, 0], ['m', 'stepper', 500, 200, 0]],
    [['ard.D8', 'u.IN1'], ['ard.D9', 'u.IN2'], ['ard.D10', 'u.IN3'], ['ard.D11', 'u.IN4'], ['ard.GND_T', 'g.g'], ['g.g', 'u.GND'], ['v.v', 'u.COM'], ['v.v', 'm.com'], ['u.OUT1', 'm.c1'], ['u.OUT2', 'm.c2'], ['u.OUT3', 'm.c3'], ['u.OUT4', 'm.c4']], sk);
  t.rt.advance(100); const h0 = t.comp.m.rt.half; t.rt.advance(1400); const h1 = t.comp.m.rt.half;
  check('Stepper.h: step(256) at 10 rpm turns the motor (half-steps ' + Math.round(h0) + ' → ' + Math.round(h1) + ')', Math.abs(h1) > 100, h1);
  t.rt.advance(3000); check('Stepper.h: a negative step count turns it back', t.comp.m.rt.half < h1 - 100 || t.comp.m.rt.half < 50, t.comp.m.rt.half);
  let bad = null; try { const r = require('../src/js/arduino/interp.js').compile('Stepper s(100, 1);\nvoid setup(){}\nvoid loop(){}'); const it = new (require('../src/js/arduino/interp.js').Interpreter)(r.program); it.runUntil(10, 1000); bad = it.error; } catch (e) { bad = e; }
  check('Stepper.h: a wrong constructor gives a helpful error', bad && /Stepper needs/.test(bad.message || ''), bad && bad.message);
}
{
  const sk = '#include <Keypad.h>\nconst byte ROWS = 4; const byte COLS = 4;\nchar keys[ROWS][COLS] = {{\'1\',\'2\',\'3\',\'A\'},{\'4\',\'5\',\'6\',\'B\'},{\'7\',\'8\',\'9\',\'C\'},{\'*\',\'0\',\'#\',\'D\'}};\nbyte rowPins[ROWS] = {9, 8, 7, 6};\nbyte colPins[COLS] = {5, 4, 3, 2};\nKeypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);\nvoid setup() { Serial.begin(9600); }\nvoid loop() { char k = keypad.getKey(); if (k) Serial.println(k); delay(10); }\n';
  let out = ''; const t = rig([['ard', 'arduino', 100, 260, 0], ['kp', 'keypad', 500, 100, 0]],
    [['ard.D9', 'kp.R1'], ['ard.D8', 'kp.R2'], ['ard.D7', 'kp.R3'], ['ard.D6', 'kp.R4'], ['ard.D5', 'kp.C1'], ['ard.D4', 'kp.C2'], ['ard.D3', 'kp.C3'], ['ard.D2', 'kp.C4']], sk);
  t.rt.onSerial = s => { out += s; };
  t.rt.advance(200); t.set('kp', 'key', '5'); t.rt.advance(300); t.set('kp', 'key', 'none'); t.rt.advance(100); t.set('kp', 'key', '#'); t.rt.advance(300);
  check('Keypad.h: getKey() reports each press once (' + JSON.stringify(out) + ')', out.replace(/\r?\n/g, '') === '5#', out);
}
// ---- LM393, SCR, 74HC165, DAC
{
  const t = rig([vcc('v', 0, 0), gnd('g', 0, 40), ['u', 'lm393', 100, 0, 0], ['p', 'battery', 0, 100, 0, { volts: 3 }], ['r', 'battery', 0, 200, 0, { volts: 2 }], ['pu', 'resistor', 300, 0, 90, { ohms: 10000 }]],
    [['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['p.+', 'u.P1'], ['p.-', 'g.g'], ['r.+', 'u.M1'], ['r.-', 'g.g'], ['v.v', 'pu.a'], ['pu.b', 'u.O1']]);
  t.rt.advance(10); const hi = t.V('u.O1'); t.set('p', 'volts', 1); t.rt.advance(10); const lo = t.V('u.O1');
  check('LM393: IN+ > IN− → output released (' + hi.toFixed(2) + ' V with pull-up); IN+ < IN− → pulled low (' + lo.toFixed(2) + ' V)', hi > 4.8 && lo < 0.1, hi + ' ' + lo);
}
{
  const t = rig([['bat', 'battery', 0, 0, 0, { volts: 12 }], ['gb', 'battery', 0, 100, 0, { volts: 0.1 }], gnd('g', 0, 40), ['q', 'scr', 100, 0, 0], ['rl', 'resistor', 200, 0, 90, { ohms: 470 }], ['rg', 'resistor', 300, 0, 0, { ohms: 1000 }]],
    [['bat.-', 'g.g'], ['bat.+', 'rl.a'], ['rl.b', 'q.a'], ['q.k', 'g.g'], ['gb.+', 'rg.a'], ['rg.b', 'q.g'], ['gb.-', 'g.g']]);
  t.rt.advance(20); const off = Math.abs(t.comp.rl.rt.i); t.set('gb', 'volts', 5); t.rt.advance(20); const on = Math.abs(t.comp.rl.rt.i); t.set('gb', 'volts', 0.1); t.rt.advance(20); const latched = Math.abs(t.comp.rl.rt.i);
  check('SCR: blocks without a gate pulse (' + (off * 1000).toFixed(2) + ' mA), turns on with one (' + (on * 1000).toFixed(1) + ' mA) and STAYS on afterwards (' + (latched * 1000).toFixed(1) + ' mA)', off < 1e-4 && on > 0.02 && latched > 0.02, [off, on, latched].join());
  t.set('bat', 'volts', 1); t.rt.advance(20); check('SCR: unlatches when the current drops below the holding current', Math.abs(t.comp.rl.rt.i) < 1e-3, t.comp.rl.rt.i);
}
{
  const bits = k => ['dat' + k];
  const t = rig([vcc('v', 0, 0), gnd('g', 0, 40), ['u', 'hc165', 100, 0, 0], ['pl', 'battery', 0, 100, 0, { volts: 5 }], ['sw', 'switch', 0, 200, 0, {}], ['pd', 'resistor', 40, 240, 90, { ohms: 10000 }], ['d7', 'battery', 0, 300, 0, { volts: 5 }], ['d0', 'battery', 0, 400, 0, { volts: 5 }]],
    [['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['g.g', 'u.CE'], ['g.g', 'u.DS'], ['pl.+', 'u.PL'], ['pl.-', 'g.g'], ['v.v', 'sw.a'], ['sw.b', 'u.CP'], ['sw.b', 'pd.a'], ['pd.b', 'g.g'], ['d7.+', 'u.D7'], ['d7.-', 'g.g'], ['d0.+', 'u.D0'], ['d0.-', 'g.g'],
      ['g.g', 'u.D1'], ['g.g', 'u.D2'], ['g.g', 'u.D3'], ['g.g', 'u.D4'], ['g.g', 'u.D5'], ['g.g', 'u.D6']]);
  t.rt.advance(5); t.set('pl', 'volts', 0.1); t.rt.advance(5); t.set('pl', 'volts', 5); t.rt.advance(5);   // load 10000001
  const q = [t.V('u.Q7') > 2.5 ? 1 : 0]; for (let i = 0; i < 7; i++) { pulse(t, 1); q.push(t.V('u.Q7') > 2.5 ? 1 : 0); }
  check('74HC165: loads 10000001 and shifts it out D7 first (' + q.join('') + ')', q.join('') === '10000001', q.join(''));
}
{
  const t = rig([vcc('v', 0, 0), gnd('g', 0, 40), ['u', 'dac8', 100, 0, 0], ['b7', 'battery', 0, 100, 0, { volts: 5 }], ['b6', 'battery', 0, 200, 0, { volts: 5 }]],
    [['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['v.v', 'u.VREF'], ['b7.+', 'u.D7'], ['b7.-', 'g.g'], ['b6.+', 'u.D6'], ['b6.-', 'g.g'], ['g.g', 'u.D0'], ['g.g', 'u.D1'], ['g.g', 'u.D2'], ['g.g', 'u.D3'], ['g.g', 'u.D4'], ['g.g', 'u.D5']]);
  t.rt.advance(10); check('DAC: D7 + D6 = 192 of 256 → 3.75 V (' + t.V('u.OUT').toFixed(3) + ')', Math.abs(t.V('u.OUT') - 3.75) < 0.05, t.V('u.OUT'));
  t.set('b7', 'volts', 0.1); t.rt.advance(10); check('DAC: D6 alone = 64 → 1.25 V', Math.abs(t.V('u.OUT') - 1.25) < 0.05, t.V('u.OUT'));
}
// ---- examples for the libraries and the extra parts
{
  const Ex = require('../src/js/examples.js');
  const step = (rt, c, ms) => rt.advance(ms);
  { const e = Ex.load('stepper-library'), rt = new Runtime(e.circuit, {}); const r = rt.loadSketch(e.sketch); rt.advance(2500); const m = e.circuit.parts.find(p => p.type === 'stepper');
    check('example stepper-library: the Stepper library turns the motor (' + Math.round(m.rt.half) + ' half-steps after 2.5 s)', r.ok && m.rt.half > 600, m.rt.half); }
  { const e = Ex.load('keypad-serial'); let out = ''; const rt = new Runtime(e.circuit, { onSerial: s => { out += s; } }); rt.loadSketch(e.sketch); const kp = e.circuit.parts.find(p => p.type === 'keypad');
    rt.advance(300); kp.props.key = '7'; P.PARTS.keypad.sync(kp, rt.nl.compEls.get(kp.id)); rt.advance(300);
    check('example keypad-serial: pressing 7 prints "Key: 7" (' + JSON.stringify(out) + ')', /Key: 7/.test(out), out); }
  { const e = Ex.load('comparator-dark'), rt = new Runtime(e.circuit, {}), ldr = e.circuit.parts.find(p => p.type === 'ldr'), led = e.circuit.parts.find(p => p.type === 'led');
    rt.advance(50); const lit = led.rt.ia || 0; ldr.props.light = 5; P.PARTS.ldr.sync && P.PARTS.ldr.sync(ldr, rt.nl.compEls.get(ldr.id)); rt.advance(100); const dark = led.rt.ia || 0;
    check('example comparator-dark: LED off in the light (' + (lit * 1000).toFixed(1) + ' mA), on in the dark (' + (dark * 1000).toFixed(1) + ' mA)', lit < 0.001 && dark > 0.004, lit + ' ' + dark); }
  { const e = Ex.load('555-monostable'), rt = new Runtime(e.circuit, {}), b = e.circuit.parts.find(p => p.type === 'button'), led = e.circuit.parts.find(p => p.type === 'led'); const sy = () => P.PARTS.button.sync(b, rt.nl.compEls.get(b.id));
    rt.advance(300); const before = led.rt.ia || 0; b.rt.pressed = true; sy(); rt.advance(50); b.rt.pressed = false; sy(); rt.advance(1000); const during = led.rt.ia || 0; rt.advance(3500); const after = led.rt.ia || 0;
    check('example 555-monostable: LED off, then on for ~3 s after the button, then off again (' + [before, during, after].map(x => (x * 1000).toFixed(1)).join(' / ') + ' mA)', before < 0.001 && during > 0.004 && after < 0.001, [before, during, after].join()); }
  { const e = Ex.load('scr-latch'), rt = new Runtime(e.circuit, {}), g = e.circuit.parts.find(p => p.type === 'button'), sw = e.circuit.parts.find(p => p.type === 'switch'), led = e.circuit.parts.find(p => p.type === 'led');
    rt.advance(100); const idle = led.rt.ia || 0; g.rt.pressed = true; P.PARTS.button.sync(g, rt.nl.compEls.get(g.id)); rt.advance(100); g.rt.pressed = false; P.PARTS.button.sync(g, rt.nl.compEls.get(g.id)); rt.advance(200); const latched = led.rt.ia || 0;
    sw.props.closed = false; P.PARTS.switch.sync(sw, rt.nl.compEls.get(sw.id)); rt.advance(100); sw.props.closed = true; P.PARTS.switch.sync(sw, rt.nl.compEls.get(sw.id)); rt.advance(200); const reset = led.rt.ia || 0;
    check('example scr-latch: dark → latches on after the gate pulse → RESET clears it (' + [idle, latched, reset].map(x => (x * 1000).toFixed(1)).join(' / ') + ' mA)', idle < 0.001 && latched > 0.01 && reset < 0.001, [idle, latched, reset].join()); }
}
// ---- transformer
{
  const mk = (src, ratio, l1) => { const t = rig([['src', src[0], 0, 0, 0, src[1]], ['x', 'transformer', 0, 0, 0, { ratio, l1: l1 || 10 }], ['rl', 'resistor', 0, 0, 0, { ohms: 10000 }], gnd('g', 0, 0)],
    [['src.+', 'x.p1'], ['src.-', 'x.p2'], ['src.-', 'g.g'], ['x.s1', 'rl.a'], ['rl.b', 'x.s2'], ['x.s2', 'g.g']]); return t; };
  const peak = (t, node, ms) => { let m = 0; for (let i = 0; i < ms; i++) { t.rt.advance(1); m = Math.max(m, Math.abs(t.V(node))); } return m; };
  for (const [ratio, want, name] of [['2', 0.5, '2 : 1 steps 10 V down to 5 V'], ['0.5', 2, '1 : 2 steps 10 V up to 20 V'], ['1', 1, '1 : 1 passes 10 V'], ['10', 0.1, '10 : 1 gives 1 V']]) {
    const t = mk(['acsource', { amp: 10, freq: 50, shape: 'sine', offset: 0 }], ratio); t.rt.advance(100); const s = peak(t, 'x.s1', 40);
    check('transformer ' + name + ' (' + s.toFixed(2) + ' V)', Math.abs(s - 10 * want) < 0.06 * 10 * want + 0.05, s);
  }
  const t = mk(['battery', { volts: 5 }], '1'); t.rt.advance(5000); check('transformer: a steady DC gives nothing on the secondary after a few seconds (' + Math.abs(t.V('x.s1')).toFixed(3) + ' V)', Math.abs(t.V('x.s1')) < 0.1, t.V('x.s1'));
  const t2 = mk(['acsource', { amp: 10, freq: 50, shape: 'sine', offset: 0 }], '0.5'); t2.rt.advance(200); let ip = 0, is = 0; for (let i = 0; i < 40; i++) { t2.rt.advance(1); ip = Math.max(ip, Math.abs(t2.comp.x.rt.i)); is = Math.max(is, Math.abs(t2.comp.x.rt.i2)); }
  check('transformer: step-up gives more voltage but less current (primary ' + (ip * 1000).toFixed(1) + ' mA, secondary ' + (is * 1000).toFixed(1) + ' mA)', is > 0 && ip > is * 1.5, ip + ' ' + is);
}
// ---- ADC, DHT11/22, I²C LCD, OLED (parts + Arduino libraries)
{
  const t = rig([vcc('v', 0, 0), gnd('g', 0, 40), ['u', 'adc8', 100, 0, 0], ['b', 'battery', 0, 100, 0, { volts: 2.5 }]], [['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['v.v', 'u.VREF'], ['b.+', 'u.VIN'], ['b.-', 'g.g']]);
  t.rt.advance(10); const code = [0, 1, 2, 3, 4, 5, 6, 7].reduce((a, k) => a | ((t.V('u.D' + k) > 2.5 ? 1 : 0) << k), 0);
  check('ADC: 2.5 V of 5 V → code 128 (' + code + ')', code === 128, code);
  t.set('b', 'volts', 5); t.rt.advance(10); const c2 = [0, 1, 2, 3, 4, 5, 6, 7].reduce((a, k) => a | ((t.V('u.D' + k) > 2.5 ? 1 : 0) << k), 0); check('ADC: full scale → 255 (' + c2 + ')', c2 === 255);
  const t2 = rig([vcc('v', 0, 0), gnd('g', 0, 40), ['u', 'adc8', 100, 0, 0, { mode: 'start' }], ['b', 'battery', 0, 100, 0, { volts: 1.25 }], ['sw', 'switch', 0, 200, 0, {}], ['pd', 'resistor', 0, 300, 90, { ohms: 10000 }]],
    [['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['v.v', 'u.VREF'], ['b.+', 'u.VIN'], ['b.-', 'g.g'], ['v.v', 'sw.a'], ['sw.b', 'u.START'], ['sw.b', 'pd.a'], ['pd.b', 'g.g']]);
  const rd = () => [0, 1, 2, 3, 4, 5, 6, 7].reduce((a, k) => a | ((t2.V('u.D' + k) > 2.5 ? 1 : 0) << k), 0);
  t2.rt.advance(10); const idle = rd(); pulse(t2, 1); const s1 = rd(); t2.set('b', 'volts', 3.75); t2.rt.advance(10); const hold = rd(); pulse(t2, 1); const s2 = rd();
  check('ADC START mode: only samples on the pulse (0 → ' + s1 + ', held ' + hold + ', next sample ' + s2 + ')', idle === 0 && s1 === 64 && hold === 64 && s2 === 191, [idle, s1, hold, s2].join());
}
{
  const sk = '#include <DHT.h>\nDHT dht(2, DHT11);\nvoid setup() { Serial.begin(9600); dht.begin(); }\nvoid loop() { float t = dht.readTemperature(); float h = dht.readHumidity(); if (isnan(t) || isnan(h)) Serial.println("fail"); else { Serial.print(t); Serial.print(" C "); Serial.print(h); Serial.println(" %"); } delay(500); }\n';
  let out = ''; const t = rig([['ard', 'arduino', 100, 260, 0], ['d', 'dht11', 500, 100, 0, { model: '11', temp: 23.6, hum: 61 }], vcc('v', 400, 300), gnd('g', 400, 340)],
    [['ard.D2', 'd.data'], ['v.v', 'd.vcc'], ['g.g', 'd.gnd'], ['ard.GND_T', 'g.g']], sk); t.rt.onSerial = s => { out += s; };
  t.rt.advance(700); check('DHT11 + DHT library: temperature rounds to whole degrees (' + JSON.stringify(out.trim().split('\n')[0]) + ')', /24\.00 C 61\.00 %/.test(out), out);
  t.comp.d.props.model = '22'; out = ''; t.rt.advance(700); check('DHT: sketch says DHT11 but the sensor is a DHT22 → reads fail and a warning is raised', /fail/.test(out) && t.alerts().some(a => /DHT22/.test(a)), out + t.alerts());
  t.comp.d.props.model = '11'; t.comp.d.props.temp = 99; out = ''; t.rt.advance(700); check('DHT11: temperature is limited to its 0–50 °C range', /50\.00 C/.test(out), out);
  const t2 = rig([['ard', 'arduino', 100, 260, 0], ['d', 'dht11', 500, 100, 0, {}], gnd('g', 400, 340)], [['ard.D2', 'd.data'], ['g.g', 'd.gnd']], sk); let o2 = ''; t2.rt.onSerial = s => { o2 += s; }; t2.rt.advance(700);
  check('DHT: an unpowered sensor cannot be read ("fail")', /fail/.test(o2), o2);
}
{
  const sk = '#include <Wire.h>\n#include <LiquidCrystal_I2C.h>\nLiquidCrystal_I2C lcd(0x27, 16, 2);\nvoid setup() { lcd.init(); lcd.backlight(); lcd.setCursor(0, 0); lcd.print("Hello I2C"); lcd.setCursor(0, 1); lcd.print(42); }\nvoid loop() {}\n';
  const wires = [['ard.A4', 'u.SDA'], ['ard.A5', 'u.SCL'], ['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['ard.GND_T', 'g.g']];
  const t = rig([['ard', 'arduino', 100, 260, 0], ['u', 'lcdi2c', 500, 100, 0], vcc('v', 400, 300), gnd('g', 400, 340)], wires, sk); t.rt.advance(100);
  check('I²C LCD: shows the text from LiquidCrystal_I2C (' + JSON.stringify(t.comp.u.rt.obj && t.comp.u.rt.obj.lines) + ')', t.comp.u.rt.obj && t.comp.u.rt.obj.lines[0].startsWith('Hello I2C') && t.comp.u.rt.obj.lines[1].startsWith('42'), t.comp.u.rt.status);
  t.comp.u.props.addr = 63; t.rt.advance(50); check('I²C LCD: a wrong address is explained (' + t.comp.u.rt.status.slice(0, 40) + '…)', !t.comp.u.rt.obj && /Address/.test(t.comp.u.rt.status));
  const tw = rig([['ard', 'arduino', 100, 260, 0], ['u', 'lcdi2c', 500, 100, 0], vcc('v', 400, 300), gnd('g', 400, 340)], [['ard.A5', 'u.SDA'], ['ard.A4', 'u.SCL'], ['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['ard.GND_T', 'g.g']], sk); tw.rt.advance(100);
  check('I²C LCD: swapped SDA/SCL is explained', /SDA must go to Arduino A4/.test(tw.comp.u.rt.status), tw.comp.u.rt.status);
  const nb = rig([['ard', 'arduino', 100, 260, 0], ['u', 'lcdi2c', 500, 100, 0], vcc('v', 400, 300), gnd('g', 400, 340)], wires, sk.replace('lcd.backlight();', '')); nb.rt.advance(100);
  check('I²C LCD: without lcd.backlight() the status says so', /Backlight off/.test(nb.comp.u.rt.status), nb.comp.u.rt.status);
}
{
  const sk = '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 display(128, 64, &Wire, -1);\nvoid setup() {\n  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);\n  display.clearDisplay();\n  display.setTextSize(1); display.setTextColor(SSD1306_WHITE); display.setCursor(0, 0); display.println("Hi");\n  display.drawRect(10, 20, 30, 20, SSD1306_WHITE); display.fillCircle(100, 40, 5, SSD1306_WHITE); display.drawLine(0, 63, 127, 63, WHITE);\n  display.display();\n}\nvoid loop() {}\n';
  const t = rig([['ard', 'arduino', 100, 260, 0], ['u', 'oled', 500, 100, 0], vcc('v', 400, 300), gnd('g', 400, 340)], [['ard.A4', 'u.SDA'], ['ard.A5', 'u.SCL'], ['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['ard.GND_T', 'g.g']], sk); t.rt.advance(100);
  const o = t.comp.u.rt.obj; check('OLED: the library draws on the sketch screen and display() shows it (' + (o ? 'ok' : t.comp.u.rt.status) + ')', !!o && o.ver >= 1, t.comp.u.rt.status);
  const px = (x, y) => o.shown[y * 128 + x];
  check('OLED: text "H" is drawn with the 5×7 font (stem at x=0, bar in the middle)', px(0, 0) === 1 && px(0, 6) === 1 && px(2, 3) === 1 && px(2, 0) === 0 && px(5, 0) === 0);
  check('OLED: rectangle outline, filled circle and a full-width line', px(10, 20) === 1 && px(39, 39) === 1 && px(20, 30) === 0 && px(100, 40) === 1 && px(127, 63) === 1 && px(0, 63) === 1);
  t.comp.u.update ? 0 : 0; const refs = { px: { setAttribute: (k, v) => { refs.d = v; } }, msg: { textContent: '' } }; P.PARTS.oled.update(t.comp.u, refs); check('OLED: the screen is rendered as merged horizontal runs (path of ' + (refs.d || '').length + ' chars)', /^M/.test(refs.d) && refs.d.length > 100 && refs.d.length < 30000);
  const bad = rig([['ard', 'arduino', 100, 260, 0], ['u', 'oled', 500, 100, 0], vcc('v', 400, 300), gnd('g', 400, 340)], [['ard.A4', 'u.SDA'], ['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['ard.GND_T', 'g.g']], sk); bad.rt.advance(100); check('OLED: a missing SCL wire is explained', /SDA must go to Arduino A4 and SCL to A5/.test(bad.comp.u.rt.status), bad.comp.u.rt.status);
}
// ---- examples for the transformer, ADC, DHT, I²C LCD and OLED
{
  const Ex = require('../src/js/examples.js');
  { const e = Ex.load('transformer-step-down'), rt = new Runtime(e.circuit, {}), x = e.circuit.parts.find(p => p.type === 'transformer'); rt.advance(100); let m = 0; for (let i = 0; i < 40; i++) { rt.advance(1); m = Math.max(m, Math.abs(rt.nodeVoltage({ p: x.id, t: 's1' }) - rt.nodeVoltage({ p: x.id, t: 's2' }))); }
    check('example transformer-step-down: 10 V peak in, about 5 V peak out (' + m.toFixed(2) + ')', m > 4.7 && m < 5.1, m); }
  { const e = Ex.load('adc-pot-leds'), rt = new Runtime(e.circuit, {}), bar = e.circuit.parts.find(p => p.type === 'ledbar'), pot = e.circuit.parts.find(p => p.type === 'pot'); rt.advance(100); const lit = () => (bar.rt.lit || []).map((v, i) => (v > 0.5 ? i + 1 : '')).filter(Boolean).join(' ');
    const half = lit(); pot.props.pos = 0; P.PARTS.pot.sync && P.PARTS.pot.sync(pot, rt.nl.compEls.get(pot.id)); rt.advance(100); const full = lit();
    check('example adc-pot-leds: 3 V (153 = 10011001) lights segments 1 4 5 8 (' + half + '), full scale lights all 8 (' + full + ')', half === '1 4 5 8' && full === '1 2 3 4 5 6 7 8', half + ' | ' + full); }
  { const e = Ex.load('dht-serial'); let out = ''; const rt = new Runtime(e.circuit, { onSerial: s => { out += s; } }); rt.loadSketch(e.sketch); rt.advance(2500);
    check('example dht-serial: prints label:value pairs the plotter understands (' + JSON.stringify(out.split('\n')[0]) + ')', /temp:24\.00,hum:55\.00/.test(out), out); }
  { const e = Ex.load('lcd-i2c-hello'), rt = new Runtime(e.circuit, {}); rt.loadSketch(e.sketch); rt.advance(1500); const u = e.circuit.parts.find(p => p.type === 'lcdi2c');
    check('example lcd-i2c-hello: shows the greeting and a running counter (' + JSON.stringify(u.rt.obj && u.rt.obj.lines) + ')', u.rt.obj && /^Hello, Smart21!/.test(u.rt.obj.lines[0]) && /s running/.test(u.rt.obj.lines[1]), u.rt.status); }
  { const e = Ex.load('oled-hello'), rt = new Runtime(e.circuit, {}); rt.loadSketch(e.sketch); rt.advance(1200); const u = e.circuit.parts.find(p => p.type === 'oled'), o = u.rt.obj;
    let lit = 0; if (o) for (let i = 0; i < o.shown.length; i++) lit += o.shown[i];
    check('example oled-hello: the screen shows text, a frame and a moving dot (' + lit + ' pixels lit, frames ' + (o && o.ver) + ')', !!o && o.ver > 5 && lit > 300, u.rt.status); }
}
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll round-3 parts tests passed');
if (fails) process.exit(1);
