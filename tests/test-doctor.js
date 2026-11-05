global.S21 = {};
require('../src/js/sim/solver.js'); require('../src/js/arduino/interp.js');
const P = require('../src/js/sim/parts.js'); require('../src/js/sim/runtime.js'); const Ex = require('../src/js/examples.js'); require('../src/js/analysis.js'); const D = require('../src/js/doctor.js');
let fails = 0; function check(n, c, x) { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  ' + x)); }
const SK = Ex.list.find(e => e.sketch !== undefined && /blink/i.test(e.id)).id;
const ids = f => f.map(x => x.id).join(' ');
const has = (f, re) => f.some(x => re.test(x.id));
const mk = () => { const c = P.newCircuit(); return { c, add: (t, x, y, r, pr) => P.addPart(c, t, x, y, r, pr), w: (a, at, b, bt) => P.addWire(c, { p: a.id, t: at }, { p: b.id, t: bt }) }; };

// ---- no false alarms on anything we ship
{
  let noisy = [];
  for (const e of Ex.list) { const l = Ex.load(e.id), f = D.analyze(l.circuit).filter(x => x.sev === 'error' || x.sev === 'warn'); const r = D.analyzeRun(l.circuit, l.sketch || '', { ms: 1200 }).filter(x => x.sev === 'error'); if (f.length || r.length) noisy.push(e.id + ': ' + f.concat(r).map(x => x.id).join(','));
  }
  check('no errors or warnings on any shipped example (' + Ex.list.length + ')', noisy.length === 0, '\n   ' + noisy.join('\n   '));
}
// ---- LED straight on the battery
{ const { c, add, w } = mk(); const b = add('battery', 0, 0, 0, { volts: 9 }), g = add('ground', 0, 40, 0), l = add('led', 100, 0, 0, { color: 'red' }); w(b, '+', l, 'a'); w(l, 'k', b, '-');
  const f = D.analyze(c); check('LED across a battery: "LED without a resistor"', has(f, /^led-nores/) && f[0].sev === 'error', ids(f)); }
// ---- LED with a resistor is fine; reversed LED is caught by running
{ const { c, add, w } = mk(); const b = add('battery', 0, 0, 0, { volts: 9 }), g = add('ground', 0, 40, 0), r = add('resistor', 100, 0, 0, { ohms: 470 }), l = add('led', 200, 0, 0, { color: 'red' });
  w(b, '+', r, 'a'); w(r, 'b', l, 'a'); w(l, 'k', b, '-'); check('LED with a resistor: no static errors', D.analyze(c).filter(x => x.sev !== 'tip').length === 0, ids(D.analyze(c)));
  check('LED with a resistor lights: no run findings', D.analyzeRun(c, '').filter(x => x.sev !== 'tip').length === 0, ids(D.analyzeRun(c, '')));
  c.wires = []; w(b, '+', r, 'a'); w(r, 'b', l, 'k'); w(l, 'a', b, '-'); const f = D.analyzeRun(c, ''); check('reversed LED: "wrong way round" (found by running)', has(f, /^led-rev/), ids(f));
  c.wires = []; w(b, '+', r, 'a'); w(r, 'b', l, 'a'); w(l, 'k', b, '-'); r.props.ohms = 10000; check('1 MΩ resistor: LED very dim tip', has(D.analyzeRun(c, ''), /^led-dim/), ids(D.analyzeRun(c, ''))); }
// ---- open ends
{ const { c, add, w } = mk(); const b = add('battery', 0, 0, 0, { volts: 9 }), g = add('ground', 0, 40, 0), r = add('resistor', 100, 0, 0, { ohms: 470 }), l = add('led', 200, 0, 0, {}); w(b, '+', r, 'a'); w(r, 'b', l, 'a');
  const f = D.analyze(c); check('LED cathode not wired: "Unconnected terminal"', f.some(x => /^open-/.test(x.id) && x.parts[0] === l.id), ids(f)); }
// ---- shorts
{ const { c, add, w } = mk(); const b = add('battery', 0, 0, 0, { volts: 9 }), g = add('ground', 0, 40, 0); w(b, '+', g, 'g');
  check('battery + wired to ground: short circuit', has(D.analyze(c), /^short-/), ids(D.analyze(c))); }
{ const { c, add, w } = mk(); const b = add('battery', 0, 0, 0, {}), s = add('switch', 100, 0, 0, {}); w(b, '+', s, 'a'); w(s, 'b', b, '-');
  check('switch straight across a battery: warns it can short the supply', has(D.analyze(c), /^short-sw/), ids(D.analyze(c))); }
// ---- Arduino
{ const l = Ex.load('traffic'); const ard = l.circuit.parts.find(p => p.type === 'arduino'); const m = P.addPart(l.circuit, 'motor', 600, 100, 0, {}); P.addWire(l.circuit, { p: ard.id, t: 'D4' }, { p: m.id, t: 'a' });
  const f = D.analyze(l.circuit); check('motor wired to an Arduino pin: error', has(f, /^pin-motor/), ids(f));
  const l2 = Ex.load('traffic'), a2 = l2.circuit.parts.find(p => p.type === 'arduino'), b2 = P.addPart(l2.circuit, 'battery', 600, 100, 0, { volts: 12 }); P.addWire(l2.circuit, { p: a2.id, t: 'D4' }, { p: b2.id, t: '+' });
  check('12 V into a pin: over-voltage error', has(D.analyze(l2.circuit), /^overvolt/)); }
{ const l = Ex.load(SK); const f = D.analyzeRun(l.circuit, l.sketch.replace(/pinMode\([^)]*\);/g, '')); check('forgot pinMode: the sketch warning is surfaced', f.some(x => /^log-/.test(x.id)), ids(f)); }
{ const l = Ex.load(SK); const f = D.analyzeRun(l.circuit, l.sketch.replace('void loop()', 'void loop() {')); check('sketch compile error is surfaced with its line', f.some(x => x.id === 'sketch-compile' && x.line > 0), ids(f)); }
// ---- coils, transistors
{ const l = Ex.load('relay-lamp'); const d = l.circuit.parts.find(p => p.type === 'diode'); l.circuit.parts.splice(l.circuit.parts.indexOf(d), 1); l.circuit.wires = l.circuit.wires.filter(w => w.a.p !== d.id && w.b.p !== d.id);
  P.addWire(l.circuit, { p: l.circuit.parts.find(p => p.type === 'npn').id, t: 'c' }, { p: l.circuit.parts.find(p => p.type === 'relay').id, t: 'c2' });
  const f = D.analyze(l.circuit); check('relay without a diode: flyback warning', has(f, /^flyback/), ids(f)); }
{ const { c, add, w } = mk(); const b = add('battery', 0, 0, 0, { volts: 5 }), g = add('ground', 0, 40, 0), q = add('npn', 100, 0, 0, {}); w(b, '+', q, 'b');
  check('base wired straight to a supply: error', has(D.analyze(c), /^base-direct/), ids(D.analyze(c))); }
// ---- op-amp, 595
{ const l = Ex.load('opamp-gain'); const oa = l.circuit.parts.find(p => p.type === 'opamp'); l.circuit.wires = l.circuit.wires.filter(w => !(w.a.p === oa.id && w.a.t === 'vp') && !(w.b.p === oa.id && w.b.t === 'vp'));
  const f = D.analyze(l.circuit).concat(D.analyzeRun(l.circuit, '', { ms: 200 })); check('op-amp with no supply: flagged', f.some(x => x.parts.includes(oa.id) && x.sev !== 'tip'), ids(f)); }
{ const l = Ex.load('shift-register'); const ic = l.circuit.parts.find(p => p.type === 'hc595'); l.circuit.wires = l.circuit.wires.filter(w => !((w.a.p === ic.id && w.a.t === 'SRCLR') || (w.b.p === ic.id && w.b.t === 'SRCLR')));
  const vs = l.circuit.parts.find(p => p.id === 'vs2'); const f = D.analyze(l.circuit); check('595 /SRCLR floating: tip', has(f, /^595-clr/) || f.some(x => /^open-/.test(x.id)), ids(f)); }
{ const { c, add, w } = mk(); const b = add('battery', 0, 0, 0, { volts: 12 }), g = add('ground', 0, 40, 0), z = add('zener', 100, 0, 0, { vz: 5.1 }); w(b, '+', z, 'k'); w(z, 'a', b, '-');
  check('Zener straight across a supply: error', has(D.analyze(c), /^zener-nores/), ids(D.analyze(c))); }
{ const { c, add, w } = mk(); const b = add('battery', 0, 0, 0, {}), r = add('resistor', 100, 0, 0, {}); w(b, '+', r, 'a'); w(r, 'b', b, '-');
  check('no ground symbol: gentle tip only', D.analyze(c).some(x => x.id === 'no-gnd' && x.sev === 'tip') && !D.analyze(c).some(x => x.sev === 'error'), ids(D.analyze(c))); }
check('an empty canvas has no findings', D.analyze(P.newCircuit()).length === 0);
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll doctor tests passed'); process.exit(fails ? 1 : 0);
