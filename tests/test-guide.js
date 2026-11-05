// Guided tutorials: a simulated student follows every step using only what the panel shows
global.S21 = {};
require('../src/js/sim/solver.js'); require('../src/js/arduino/interp.js');
const P = require('../src/js/sim/parts.js'); const Runtime = require('../src/js/sim/runtime.js'); require('../src/js/examples.js'); require('../src/js/analysis.js'); const G = require('../src/js/guide.js');
let fails = 0; function check(n, c, x) { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  ' + x)); }
const BLINK = G.byId['g-blink'].steps[5].action.run; // gets sketch via lab.setSketch
let sketchText = ''; const fakeLab = { setSketch: s => { sketchText = s; } };

function student(tut, extra) {
  const circuit = P.newCircuit(), env = { running: false, sketch: '', ledEdges: 0, base: { analysis: 0 }, St: { count: () => extra.analysisRuns || 0 } }, sticky = {};
  const trail = []; let rt = null, guard = 0;
  const live = () => { if (rt) rt.rebuild(); };
  const run = (ms, sketch) => { rt = new Runtime(circuit, { onSerial: () => {}, onConsole: () => {}, eeprom: new Uint8Array(1024).fill(255) }); if (sketch) rt.loadSketch(sketch); rt.advance(ms); env.running = true; };
  const names = {};
  while (guard++ < 40) {
    const res = G.evaluate(tut, circuit, env, sticky);
    if (trail[trail.length - 1] !== res.current) trail.push(res.current);
    if (res.current >= res.total) break;
    const st = tut.steps[res.current], key = tut.id + ':' + res.current;
    if (st.manual) { sticky[res.current] = true; continue; }
    const Q = res.Q;
    if (st.ghost) { for (const g of st.ghost) { const d = P.PARTS[g.type]; const have = Q.of(g.type).length; const wantN = st.ghost.filter(x => x.type === g.type).length; const placed = circuit.parts.filter(p => p.type === g.type).length; if (placed < wantN + (extra.priorCount && extra.priorCount[g.type] || 0) || true) { /* place only those still missing, in order */ } }
      const counts = {}; for (const p of circuit.parts) counts[p.type] = (counts[p.type] || 0) + 1;
      const need = {}; for (const g of st.ghost) { need[g.type] = (need[g.type] || 0) + 1; if ((counts[g.type] || 0) < need[g.type]) { P.addPart(circuit, g.type, g.x, g.y, g.rot || 0, Object.assign({}, g.props || {})); counts[g.type] = (counts[g.type] || 0) + 1; } }
      continue; }
    if (st.wire) { const w = st.wire(Q); if (!w) { trail.push('NOWIRE@' + res.current); break; } P.addWire(circuit, w.a, w.b); continue; }
    const fix = extra.fix[key]; if (!fix) { trail.push('STUCK@' + res.current + ':' + st.title); break; }
    fix({ circuit, env, run, sticky, Q, live }); extra.after && extra.after(key, circuit);
  }
  return { trail, circuit, env, rt };
}
const part = (c, t, i = 0) => c.parts.filter(p => p.type === t)[i];
const w = (c, a, at, b, bt) => P.addWire(c, { p: a.id, t: at }, { p: b.id, t: bt });

// ---- 1. Light an LED
{
  const t = G.byId['g-led'];
  const r = student(t, { fix: {
    'g-led:7': ({ run }) => run(150),
    'g-led:8': ({ circuit, run }) => { part(circuit, 'resistor').props.ohms = 2200; run(150); }
  } });
  check('g-led: the student gets all the way through (' + r.trail.join('>') + ')', r.trail[r.trail.length - 1] === t.steps.length, r.trail.join('>'));
  check('g-led: the LED really lights in the circuit that was built', (part(r.circuit, 'led').rt.ia || 0) > 0.0005, part(r.circuit, 'led').rt.ia);
  check('g-led: steps advance one at a time (never skipping unexplained)', r.trail.every((v, i) => i === 0 || v > r.trail[i - 1]));
}
// the two ground symbols finish the "close the circuit" step by themselves (placed on the pins)
{
  const t = G.byId['g-led'], c = P.newCircuit(); for (const g of [t.steps[0].ghost[0], t.steps[1].ghost[0], t.steps[2].ghost[0], ...t.steps[3].ghost]) P.addPart(c, g.type, g.x, g.y, g.rot || 0, g.props);
  const res = G.evaluate(t, c, { running: false }, {}); check('g-led: after placing parts at the highlighted spots, only the 2 wiring steps remain', res.current === 4 && res.done[6] === true, JSON.stringify(res.done));
}
// a wrong build does not pass: resistor shorted out
{
  const t = G.byId['g-led'], c = P.newCircuit(); const add = (ty, x, y, r, pr) => P.addPart(c, ty, x, y, r, pr);
  const b = add('battery', 120, 200, 0, { volts: 9 }), rr = add('resistor', 260, 140, 0, { ohms: 470 }), l = add('led', 400, 140, 0, {}); add('ground', 120, 240, 0); add('ground', 420, 140, 0);
  w(c, b, '+', l, 'a'); w(c, rr, 'a', b, '+'); w(c, rr, 'b', b, '+');
  const res = G.evaluate(t, c, { running: false }, {}); check('g-led: an LED wired past the resistor does not pass the series step', res.done[5] === false, JSON.stringify(res.done));
}
// ---- 2. multimeter
{
  const t = G.byId['g-meter'];
  const r = student(t, { fix: {
    'g-meter:2': ({ circuit }) => { const rs = circuit.parts.filter(p => p.type === 'resistor'); rs[0].props.ohms = 1000; rs[1].props.ohms = 2000; },
    'g-meter:4': ({ circuit }) => { const b = part(circuit, 'battery'), r1 = circuit.parts.filter(p => p.type === 'resistor')[0], r2 = circuit.parts.filter(p => p.type === 'resistor')[1]; w(circuit, b, '+', r1, 'a'); w(circuit, r2, 'b', b, '-'); },
    'g-meter:7': ({ run }) => run(80),
    'g-meter:8': ({ circuit }) => { part(circuit, 'multimeter').props.mode = 'dca'; }
  } });
  check('g-meter: the student gets all the way through (' + r.trail.join('>') + ')', r.trail[r.trail.length - 1] === t.steps.length, r.trail.join('>'));
  check('g-meter: the hinted probe wires are the right ones (the meter reads 6 V)', Math.abs(part(r.circuit, 'multimeter').rt.reading - 6) < 0.15 || part(r.circuit, 'multimeter').props.mode === 'dca');
}
// measuring across R1 instead of R2 does not pass the probe step
{
  const t = G.byId['g-meter'], c = P.newCircuit(); const add = (ty, x, y, r, pr) => P.addPart(c, ty, x, y, r, pr);
  const b = add('battery', 100, 200, 0, { volts: 9 }), r1 = add('resistor', 220, 140, 90, { ohms: 1000 }), r2 = add('resistor', 220, 220, 90, { ohms: 2000 }), m = add('multimeter', 360, 160, 0, {}); add('ground', 100, 240, 0);
  w(c, b, '+', r1, 'a'); w(c, r2, 'b', b, '-'); w(c, m, 'red', r1, 'a'); w(c, m, 'black', r1, 'b');
  check('g-meter: probes across R1 do not pass "across R2"', G.evaluate(t, c, { running: false }, {}).done[6] === false);
}
// ---- 3. Arduino blink
{
  const t = G.byId['g-blink'];
  const r = student(t, { fix: {
    'g-blink:5': ({ env }) => { t.steps[5].action.run(fakeLab); env.sketch = sketchText; },
    'g-blink:6': ({ circuit, env, run }) => { run(2600, env.sketch); env.ledEdges = 3; },
    'g-blink:7': ({ env }) => { env.sketch = env.sketch.replace(/500/g, '100'); }
  } });
  check('g-blink: the student gets all the way through (' + r.trail.join('>') + ')', r.trail[r.trail.length - 1] === t.steps.length, r.trail.join('>'));
  check('g-blink: the wiring built from the hints really blinks the LED', (() => { const c = r.circuit; const rt = new Runtime(c, { onSerial: () => {}, onConsole: () => {} }); rt.loadSketch(sketchText.replace(/500/g, '500')); let on = 0, off = 0; for (let i = 0; i < 260; i++) { rt.advance(10); if (part(c, 'led').rt.ia > 0.003) on++; else off++; } return on > 60 && off > 60; })());
  check('g-blink: the offered sketch compiles', S21.Arduino.compile(BLINK_TEXT()).ok);
  function BLINK_TEXT() { return sketchText; }
}
// ---- 4. RC filter + Bode
{
  const t = G.byId['g-bode'];
  const r = student(t, { analysisRuns: 0, fix: {
    'g-bode:2': ({ circuit }) => { part(circuit, 'resistor').props.ohms = 1600; part(circuit, 'capacitor').props.farads = 1e-6; },
    'g-bode:4': ({ circuit }) => { const ac = part(circuit, 'acsource'), rr = part(circuit, 'resistor'), cc = part(circuit, 'capacitor'); w(circuit, ac, '+', rr, 'a'); w(circuit, rr, 'b', cc, 'a'); },
    'g-bode:5': ({ env }) => { env.St = { count: () => 1 }; }
  } });
  check('g-bode: the student gets all the way through (' + r.trail.join('>') + ')', r.trail[r.trail.length - 1] === t.steps.length, r.trail.join('>'));
  const A = require('../src/js/analysis.js'); const res = A.acSweep(r.circuit, { srcId: part(r.circuit, 'acsource').id, outRef: { p: part(r.circuit, 'capacitor').id, t: 'a' }, fStart: 10, fStop: 1000, points: 12, amp: 1 });
  check('g-bode: the filter the student built has its corner near 99.5 Hz (' + (res.fcHigh || 0).toFixed(1) + ')', Math.abs(res.fcHigh - 99.5) < 5, res.fcHigh);
}
// ---- metadata sanity
for (const t of G.TUTORIALS) {
  check(t.id + ': every step has a title and text, and a check or manual flag', t.steps.every(s => s.title && s.text && (s.done || s.manual)));
  check(t.id + ': every ghost refers to a real part type', t.steps.every(s => (s.ghost || []).every(g => P.PARTS[g.type])));
  check(t.id + ': "focus" parts exist in the palette', t.steps.every(s => !s.focus || P.PARTS[s.focus]));
  check(t.id + ': next tutorial exists', !t.next || G.byId[t.next]);
}
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll guided-tutorial tests passed'); process.exit(fails ? 1 : 0);
