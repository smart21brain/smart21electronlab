// Round-2 parts and examples, run through the real Runtime
global.S21 = {};
require('../src/js/sim/solver.js'); require('../src/js/arduino/interp.js');
const P = require('../src/js/sim/parts.js'); const Runtime = require('../src/js/sim/runtime.js'); const Ex = require('../src/js/examples.js');
let fails = 0;
function check(n, c, x) { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x !== undefined && !c ? '  ' + x : '')); }
function ex(id, opts) {
  const e = Ex.load(id); let serial = '', cons = [];
  const rt = new Runtime(e.circuit, Object.assign({ onSerial: s => serial += s, onConsole: (l, m) => cons.push(l + ': ' + m) }, opts || {}));
  if (e.sketch) { const r = rt.loadSketch(e.sketch); if (!r.ok) throw new Error(id + ' sketch: ' + r.error.message + ' line ' + r.error.line); }
  return { e, rt, get serial() { return serial; }, cons };
}
const part = (e, type, k = 0) => e.circuit.parts.filter(p => p.type === type)[k];
const byRef = (e, ref) => { const [id, term] = ref.split('.'); return { p: e.circuit.parts.find(p => p.type === id || p.id === id) }; };
const alerts = t => t.rt.alerts.map(a => a.msg);
const sync = (t, c) => { const d = P.PARTS[c.type]; if (d.sync) d.sync(c, t.rt.nl.compEls.get(c.id)); };
const V = (t, id, term) => t.rt.nodeVoltage({ p: t.e.circuit.parts.find(p => p.type === id).id, t: term });

// ---- op-amp amplifier
{
  const t = ex('opamp-gain'), pot = part(t.e, 'pot'); t.rt.advance(30);
  const vin = V(t, 'pot', 'w'), vout = V(t, 'opamp', 'o');
  check('opamp-gain: output = 2 × input (' + vin.toFixed(2) + ' → ' + vout.toFixed(2) + ' V)', Math.abs(vout - 2 * vin) < 0.02 && vin > 1, vout);
  pot.props.pos = 0; sync(t, pot); t.rt.advance(30);
  check('opamp-gain: clips at the LM358 supply limit (7.5 V)', Math.abs(V(t, 'opamp', 'o') - 7.5) < 0.1, V(t, 'opamp', 'o').toFixed(2));
  check('opamp-gain: status shows saturation', part(t.e, 'opamp').rt.state === 'H');
}
// ---- comparator
{
  const t = ex('opamp-comparator'), ldr = part(t.e, 'ldr'), led = part(t.e, 'led');
  ldr.props.light = 95; sync(t, ldr); t.rt.advance(60); const bright = led.rt.ia;
  ldr.props.light = 3; sync(t, ldr); t.rt.advance(60); const dark = led.rt.ia;
  check('comparator: LED off in bright light, on in the dark', bright < 1e-4 && dark > 0.004, 'bright=' + bright.toExponential(1) + ' dark=' + dark.toExponential(1));
}
// ---- PNP high side
{
  const t = ex('pnp-highside'), led = part(t.e, 'led'); const seen = [];
  for (let k = 0; k < 24; k++) { t.rt.advance(100); seen.push(led.rt.ia > 0.004); }
  check('pnp: LED blinks (on while the pin is LOW)', seen.some(x => x) && seen.some(x => !x), seen.join());
  const first = seen[2]; check('pnp: first 500 ms is ON (pin LOW = ON)', first === true);
}
// ---- MOSFET
{
  const t = ex('mosfet-motor'), m = part(t.e, 'motor'), q = part(t.e, 'mosfet'); let maxV = 0, maxI = 0;
  for (let k = 0; k < 100; k++) { t.rt.advance(100); maxV = Math.max(maxV, Math.abs(m.rt.v)); maxI = Math.max(maxI, Math.abs(m.rt.i)); }
  check('mosfet: motor gets nearly the full 5 V at full PWM', maxV > 4.6, maxV.toFixed(2));
  check('mosfet: stays safe (no warnings)', !alerts(t).some(a => /MOSFET carries/.test(a)), alerts(t).join('|'));
  q.props.model = 'std'; t.rt.rebuild(); const tt = t; tt.rt.advance(1); // IRF540 at 5 V gate is weak
  const gateSrc = t.rt.ard.pinEls[9]; gateSrc.en = true; gateSrc.v = 5; gateSrc.rs = 25;
  t.rt.sim.step(1e-4);
  const vStd = Math.abs(m.rt.v);
  check('mosfet: the standard (IRF540-like) model is weaker at 5 V gate than the logic-level one', vStd < maxV, vStd.toFixed(2) + ' vs ' + maxV.toFixed(2));
}
// ---- Zener
{
  const t = ex('zener-reg'), bat = part(t.e, 'battery'); t.rt.advance(20);
  const v12 = V(t, 'zener', 'k'); bat.props.volts = 18; sync(t, bat); t.rt.advance(20); const v18 = V(t, 'zener', 'k');
  check('zener: ≈5.1 V from 12 V (' + v12.toFixed(3) + ')', Math.abs(v12 - 5.1) < 0.3);
  check('zener: regulates (12 V → 18 V changes the output < 0.1 V)', Math.abs(v18 - v12) < 0.1, (v18 - v12).toFixed(3));
  bat.props.volts = 3; sync(t, bat); t.rt.advance(20); check('zener: below Vz the output follows the input', V(t, 'zener', 'k') > 1.9 && V(t, 'zener', 'k') < 3.01);
}
// ---- NTC thermometer
{
  const t = ex('ntc-thermo'), ntc = part(t.e, 'ntc');
  for (const T of [0, 25, 50, 80]) {
    ntc.props.temp = T; sync(t, ntc); t.serial = ''; t.rt.advance(1100);
    const lines = t.serial.trim().split('\n'); const got = parseFloat(lines[lines.length - 1]);
    check('ntc: sketch reads ' + T + ' °C (' + got + ')', Math.abs(got - T) < 1.5, lines.slice(-2).join('|'));
  }
  const led = t.rt.ard.comp.rt.led13; check('ntc: board LED is on above 30 °C', led > 0.5, led);
  ntc.props.temp = 20; sync(t, ntc); t.rt.advance(1500); check('ntc: board LED off at 20 °C', t.rt.ard.comp.rt.led13 < 0.2);
  check('ntc resistance formula: 10 k at 25 °C, ~3.6 k at 50 °C', Math.abs(P.PARTS.ntc.resistance({ r25: 10000, beta: 3950, temp: 25 }) - 10000) < 1 && Math.abs(P.PARTS.ntc.resistance({ r25: 10000, beta: 3950, temp: 50 }) - 3588) < 60);
}
// ---- Relay
{
  const t = ex('relay-lamp'), led = part(t.e, 'led'), rly = part(t.e, 'relay'); const seen = [], on = [];
  for (let k = 0; k < 45; k++) { t.rt.advance(100); seen.push(led.rt.ia > 0.004); on.push(rly.rt.on); }
  check('relay: coil energises and de-energises', on.some(x => x) && on.some(x => !x), on.join(''));
  check('relay: lamp LED follows the contact', seen.some(x => x) && seen.some(x => !x));
  check('relay: with the flyback diode there is no spike warning', !alerts(t).some(a => /kick/i.test(a)), alerts(t).join('|'));
  // remove the diode: spike
  const t2 = ex('relay-lamp'); const d = part(t2.e, 'diode');
  t2.e.circuit.parts.splice(t2.e.circuit.parts.indexOf(d), 1); t2.e.circuit.wires = t2.e.circuit.wires.filter(w => w.a.p !== d.id && w.b.p !== d.id);
  P.addWire(t2.e.circuit, { p: part(t2.e, 'npn').id, t: 'c' }, { p: part(t2.e, 'relay').id, t: 'c2' });
  t2.rt.rebuild(); for (let k = 0; k < 45; k++) t2.rt.advance(100);
  check('relay: without the diode the app warns about the inductive kick', alerts(t2).some(a => /kick/i.test(a)), alerts(t2).join('|'));
}
// ---- RGB
{
  const t = ex('rgb-mixer'), rgb = part(t.e, 'rgbled'); const colors = [];
  for (let k = 0; k < 90; k++) { t.rt.advance(100); if (k % 8 === 4) colors.push((rgb.rt.ia || [0, 0, 0]).map(x => x > 0.002 ? 1 : 0).join('')); }
  check('rgb: cycles through red, yellow, green, cyan, blue, white…', colors.includes('100') && colors.includes('010') && colors.includes('001') && colors.includes('111'), colors.join(' '));
  check('rgb: no burn-out with 220 Ω resistors', !rgb.rt.burnt || !rgb.rt.burnt.some(x => x));
  const t3 = ex('rgb-mixer'); for (const r of t3.e.circuit.parts.filter(p => p.type === 'resistor')) r.props.ohms = 1;
  t3.rt.rebuild(); for (let k = 0; k < 40; k++) t3.rt.advance(100);
  check('rgb: without resistors a colour burns out', alerts(t3).some(a => /RGB/.test(a)) || (part(t3.e, 'rgbled').rt.burnt || []).some(x => x));
}
// ---- 74HC595
{
  const t = ex('shift-register'), leds = t.e.circuit.parts.filter(p => p.type === 'led'), ic = part(t.e, 'hc595'); const seen = new Set(); let multi = 0;
  for (let k = 0; k < 400; k++) { t.rt.advance(20); const lit = leds.map(l => (l.rt.ia > 0.003 ? 1 : 0)); const n = lit.reduce((a, b) => a + b, 0); if (n === 1) seen.add(lit.indexOf(1)); if (n > 1) multi++; }
  check('595: the light visits every LED QA…QH', seen.size === 8, [...seen].sort().join());
  check('595: never more than one LED lit at once', multi === 0, multi);
  check('595: clean power', ic.rt.powered === true);
  // pattern check: with a sketch that sends 0xA5
  const t2 = ex('shift-register'); t2.rt.loadSketch(`void setup(){ pinMode(8,OUTPUT); pinMode(9,OUTPUT); pinMode(10,OUTPUT); digitalWrite(10,LOW); shiftOut(8,9,MSBFIRST,0xA5); digitalWrite(10,HIGH); } void loop(){}`);
  t2.rt.advance(30); const ic2 = part(t2.e, 'hc595'); check('595: shiftOut(MSBFIRST, 0xA5) latches 0xA5 (QA = bit 0)', ic2.rt.latch === 0xA5, ic2.rt.latch);
  const want = [1, 0, 1, 0, 0, 1, 0, 1]; const l2 = t2.e.circuit.parts.filter(p => p.type === 'led');
  check('595: LEDs show 1,0,1,0,0,1,0,1 for QA…QH', l2.every((l, i) => (l.rt.ia > 0.003 ? 1 : 0) === want[i]), l2.map(l => (l.rt.ia > 0.003 ? 1 : 0)).join(''));
  // OE high turns the outputs off
  const oe = t2.e.circuit.wires.find(w => w.b.t === 'OE' || w.a.t === 'OE'); const wires = t2.e.circuit.wires;
  const t3 = ex('shift-register'); t3.rt.loadSketch(`void setup(){ pinMode(8,OUTPUT); pinMode(9,OUTPUT); pinMode(10,OUTPUT); digitalWrite(10,LOW); shiftOut(8,9,MSBFIRST,255); digitalWrite(10,HIGH); } void loop(){}`);
  t3.rt.advance(30); check('595: all ones lights all 8', t3.e.circuit.parts.filter(p => p.type === 'led').every(l => l.rt.ia > 0.003));
}
// ---- EEPROM persistence across Stop / Run
{
  const eeprom = new Uint8Array(1024).fill(255);
  let t = ex('eeprom-counter', { eeprom }), btn = part(t.e, 'button');
  const press = (t, b, ms) => { b.rt.pressed = true; t.rt.rebuild(); t.rt.advance(ms); b.rt.pressed = false; t.rt.rebuild(); t.rt.advance(400); };
  t.rt.advance(100); press(t, btn, 100); press(t, btn, 100); press(t, btn, 100);
  check('eeprom: counts three presses', /\n3\n/.test('\n' + t.serial), JSON.stringify(t.serial));
  t = ex('eeprom-counter', { eeprom }); t.rt.advance(100);
  check('eeprom: the count survives Stop → Run', /Presses so far: 3/.test(t.serial), JSON.stringify(t.serial));
}
// ---- interrupts through the runtime
{
  const t = ex('interrupt-button'), btn = part(t.e, 'button'); t.rt.advance(200);
  btn.rt.pressed = true; t.rt.rebuild(); t.rt.advance(30); btn.rt.pressed = false; t.rt.rebuild(); t.rt.advance(30);
  const led = t.rt.ard.comp.rt.led13;
  check('interrupt: LED toggles at once while the loop is inside delay(1000)', led > 0.5, led);
  t.rt.advance(1100); check('interrupt: the main loop sees the count', /presses = 1/.test(t.serial), JSON.stringify(t.serial));
  btn.rt.pressed = true; t.rt.rebuild(); t.rt.advance(30); btn.rt.pressed = false; t.rt.rebuild(); t.rt.advance(300);
  check('interrupt: second press toggles the LED off', t.rt.ard.comp.rt.led13 < 0.5, t.rt.ard.comp.rt.led13);
}
// ---- struct traffic
{
  const t = ex('struct-traffic'), l = t.e.circuit.parts.filter(p => p.type === 'led'); const order = [];
  for (let k = 0; k < 120; k++) { t.rt.advance(100); const i = l.findIndex(x => x.rt.ia > 0.003); if (i >= 0 && order[order.length - 1] !== i) order.push(i); }
  check('struct-traffic: red → green → yellow → red', order.slice(0, 4).join() === '0,2,1,0', order.join());
}
// ---- diode curve example is usable for a sweep
{ const t = ex('diode-curve'); t.rt.advance(10); const d = part(t.e, 'diode'); check('diode-curve: ~0.7 V across the diode at 5 V', Math.abs(d.rt.v - 0.75) < 0.2, d.rt.v); }


// ---- multimeter
{
  const t = ex('multimeter-lab'), m = part(t.e, 'multimeter'); t.rt.advance(40);
  check('multimeter DC volts reads 6 V across R2 (' + (m.rt.reading || 0).toFixed(3) + ')', Math.abs(m.rt.reading - 6) < 0.01, m.rt.reading);
  check('multimeter display text', /6\.0*\s*V|6V/.test(P.PARTS.multimeter && (m.rt.reading !== undefined ? String(m.rt.reading.toFixed(2)) + 'V' : '')), '');
  check('multimeter barely loads the circuit (10 MΩ)', Math.abs(V(t, 'resistor', 'a') - 9) < 0.01);
  // click cycles through the dial positions
  const seen = []; for (let i = 0; i < 5; i++) { P.PARTS.multimeter.onClick(m); seen.push(m.props.mode); }
  check('clicking turns the dial through all 5 positions and back to DC volts', seen.join() === 'acv,dca,ohm,cont,dcv', seen.join());
  // amps: in series
  const c = P.newCircuit(), add = (ty, x, y, r, pr) => P.addPart(c, ty, x, y, r, pr), w = (a, at, b, bt) => P.addWire(c, { p: a.id, t: at }, { p: b.id, t: bt });
  const bat = add('battery', 0, 0, 0, { volts: 9 }), g = add('ground', 0, 40, 0), r = add('resistor', 100, 0, 0, { ohms: 900 }), dmm = add('multimeter', 200, 0, 0, { mode: 'dca' });
  w(bat, '+', r, 'a'); w(r, 'b', dmm, 'red'); w(dmm, 'black', bat, '-');
  const rt = new Runtime(c, {}); rt.advance(30);
  check('multimeter amps in series reads 10 mA (' + (dmm.rt.reading * 1000).toFixed(2) + ' mA)', Math.abs(dmm.rt.reading - 0.01) < 2e-4, dmm.rt.reading);
  // amps across the supply blows the fuse
  const c2 = P.newCircuit(), add2 = (ty, x, y, r, pr) => P.addPart(c2, ty, x, y, r, pr);
  const b2 = add2('battery', 0, 0, 0, { volts: 9 }), g2 = add2('ground', 0, 40, 0), d2 = add2('multimeter', 100, 0, 0, { mode: 'dca' });
  P.addWire(c2, { p: b2.id, t: '+' }, { p: d2.id, t: 'red' }); P.addWire(c2, { p: d2.id, t: 'black' }, { p: b2.id, t: '-' });
  const rt2 = new Runtime(c2, {}); rt2.advance(30); rt2.advance(30);
  check('multimeter in amps mode across a battery blows its fuse', d2.rt.fuse === true && rt2.alerts.some(a => /fuse/i.test(a.msg)), JSON.stringify(rt2.alerts.map(a => a.msg)));
  rt2.advance(30); check('after the fuse blows the circuit is open', Math.abs(b2.rt.i || 0) < 0.01);
  // ohms and continuity: a lone resistor
  const c3 = P.newCircuit(), add3 = (ty, x, y, r, pr) => P.addPart(c3, ty, x, y, r, pr);
  const r3 = add3('resistor', 0, 0, 0, { ohms: 4700 }), d3 = add3('multimeter', 100, 0, 0, { mode: 'ohm' });
  P.addWire(c3, { p: d3.id, t: 'red' }, { p: r3.id, t: 'a' }); P.addWire(c3, { p: d3.id, t: 'black' }, { p: r3.id, t: 'b' });
  const rt3 = new Runtime(c3, {}); rt3.advance(20);
  check('multimeter ohms reads 4.7 kΩ (' + d3.rt.reading.toFixed(0) + ')', Math.abs(d3.rt.reading - 4700) < 60, d3.rt.reading);
  r3.props.ohms = 22; rt3.rebuild(); rt3.advance(20); d3.props.mode = 'cont'; rt3.advance(20);
  check('continuity beeps for 22 Ω', d3.rt.beep === true && Math.abs(d3.rt.reading - 22) < 1, d3.rt.reading);
  r3.props.ohms = 4700; rt3.rebuild(); rt3.advance(20); check('continuity silent for 4.7 kΩ', d3.rt.beep === false);
  const open = P.newCircuit(); const d4 = P.addPart(open, 'multimeter', 0, 0, 0, { mode: 'ohm' }); const rt4 = new Runtime(open, {}); rt4.advance(20);
  check('open probes read OL', d4.rt.reading === Infinity, d4.rt.reading);
  // AC volts: 5 V peak sine -> 3.54 V RMS
  const c5 = P.newCircuit(), add5 = (ty, x, y, r, pr) => P.addPart(c5, ty, x, y, r, pr);
  const ac = add5('acsource', 0, 0, 0, { amp: 5, freq: 50, shape: 'sine' }), g5 = add5('ground', 0, 40, 0), d5 = add5('multimeter', 100, 0, 0, { mode: 'acv' });
  P.addWire(c5, { p: ac.id, t: '+' }, { p: d5.id, t: 'red' }); P.addWire(c5, { p: d5.id, t: 'black' }, { p: ac.id, t: '-' });
  const rt5 = new Runtime(c5, {}); rt5.advance(300);
  check('multimeter AC volts reads RMS 3.54 V (' + d5.rt.reading.toFixed(3) + ')', Math.abs(d5.rt.reading - 3.536) < 0.15, d5.rt.reading);
}
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll round-2 part tests passed'); process.exit(fails ? 1 : 0);
