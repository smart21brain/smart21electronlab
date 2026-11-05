global.S21 = {};
require('../src/js/sim/solver.js'); require('../src/js/arduino/interp.js');
const P = require('../src/js/sim/parts.js'); const Runtime = require('../src/js/sim/runtime.js'); const Ex = require('../src/js/examples.js');
let fails = 0;
function check(n, c, x) { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  ' + x : '')); }
const sample = (rt, ms, step, fn) => { const out = []; for (let t = 0; t < ms; t += step) { rt.advance(step); out.push(fn()); } return out; };
function ex(id, setup) {
  const e = Ex.load(id); let serial = '', cons = [];
  const rt = new Runtime(e.circuit, { onSerial: s => serial += s, onConsole: (l, m) => cons.push(l + ': ' + m) });
  if (e.sketch) { const r = rt.loadSketch(e.sketch); if (!r.ok) throw new Error(id + ' sketch: ' + r.error.message); }
  if (setup) setup(e, rt);
  return { e, rt, get serial() { return serial; }, cons };
}
const part = (e, type, k = 0) => e.circuit.parts.filter(p => p.type === type)[k];

// 1 LED basic
{ const t = ex('led-basic'); t.rt.advance(50); const l = part(t.e, 'led'); check('led-basic: ~15 mA through the LED', Math.abs(l.rt.i * 1000 - 15) < 1.5, (l.rt.i * 1000).toFixed(2) + ' mA'); }
// 2 divider
{ const t = ex('divider'); t.rt.advance(10); const v = t.rt.nodeVoltage(t.e.probes[0]); check('divider: middle node = 6 V', Math.abs(v - 6) < 0.05, v.toFixed(3)); }
// 3 RC
{ const t = ex('rc'); const sw = part(t.e, 'switch'); sw.props.closed = true; t.rt.rebuild(); t.rt.advance(1000);
  const v = t.rt.nodeVoltage(t.e.probes[0]); check('rc: ~3.16 V after one time constant', Math.abs(v - 3.16) < 0.1, v.toFixed(3)); }
// 4 NPN
{ const t = ex('npn'); const sw = part(t.e, 'switch'); const l = part(t.e, 'led');
  t.rt.advance(20); const off = l.rt.i; sw.props.closed = true; t.rt.rebuild(); t.rt.advance(20);
  check('npn: LED off with switch open, on when closed', Math.abs(off) < 1e-6 && l.rt.i > 0.005, 'off=' + off.toExponential(1) + ' on=' + (l.rt.i * 1000).toFixed(2) + ' mA'); }
// 5 Blink
{ const t = ex('blink'); const l = part(t.e, 'led'); const s = sample(t.rt, 4000, 50, () => (l.rt.ia > 0.005 ? 1 : 0));
  const trans = s.filter((v, i) => i && v !== s[i - 1]).length;
  check('blink: LED toggles about every second', trans >= 3 && trans <= 5, 'transitions=' + trans + ' pattern=' + s.filter((_, i) => i % 10 === 0).join('')); }
// 6 Button
{ const t = ex('button'); const l = part(t.e, 'led'), b = part(t.e, 'button');
  t.rt.advance(100); const a = l.rt.ia; b.rt.pressed = true; t.rt.rebuild(); t.rt.advance(300); const bb = l.rt.ia;
  check('button: LED off, then on while pressed', a < 1e-4 && bb > 0.005, 'a=' + a.toExponential(1) + ' b=' + (bb * 1000).toFixed(1) + ' mA'); check('button: serial message', /Button pressed/.test(t.serial), JSON.stringify(t.serial.slice(0, 40))); }
// 6b One-button toggle: each press flips, holding does not retrigger
{ const t = ex('toggle'); const l = part(t.e, 'led'), b = part(t.e, 'button');
  const press = ms => { b.rt.pressed = true; t.rt.rebuild(); t.rt.advance(ms); b.rt.pressed = false; t.rt.rebuild(); t.rt.advance(150); };
  t.rt.advance(100); const s0 = l.rt.ia < 1e-4;
  press(1500); const s1 = l.rt.ia > 0.005;          // long hold -> flips exactly once
  press(100); const s2 = l.rt.ia < 1e-4;             // second press -> off
  press(100); const s3 = l.rt.ia > 0.005;            // third press -> on
  check('toggle: off, on (held 1.5 s = one flip), off, on', s0 && s1 && s2 && s3, [s0, s1, s2, s3].join(','));
  check('toggle: serial reports each flip once', t.serial === 'LED is ON\nLED is OFF\nLED is ON\n', JSON.stringify(t.serial)); }
// 7 Fade
{ const t = ex('fade'); const l = part(t.e, 'led'), pot = part(t.e, 'pot'); pot.props.pos = 10; t.rt.rebuild(); t.rt.advance(400); const lo = l.rt.ia;
  pot.props.pos = 100; t.rt.rebuild(); t.rt.advance(400); const hi = l.rt.ia;
  check('fade: brighter at higher knob', hi > lo * 2 && hi > 0.005, 'lo=' + (lo * 1000).toFixed(2) + ' mA hi=' + (hi * 1000).toFixed(2) + ' mA'); check('fade: serial shows raw value', /raw=\d+/.test(t.serial), JSON.stringify(t.serial.slice(0, 40))); }
// 8 LDR
{ const t = ex('ldr'); const l = part(t.e, 'led'), ldr = part(t.e, 'ldr'); ldr.props.light = 90; t.rt.rebuild(); t.rt.advance(500); const bright = l.rt.ia;
  ldr.props.light = 5; t.rt.rebuild(); t.rt.advance(500); const dark = l.rt.ia;
  check('ldr: LED on only when dark', bright < 1e-4 && dark > 0.005, 'bright=' + bright.toExponential(1) + ' dark=' + (dark * 1000).toFixed(1) + ' mA'); }
// 9 Traffic
{ const t = ex('traffic'); const leds = t.e.circuit.parts.filter(p => p.type === 'led'); t.rt.advance(100);
  check('traffic: red on first', leds[0].rt.ia > 0.005 && leds[1].rt.ia < 1e-4 && leds[2].rt.ia < 1e-4);
  t.rt.advance(3100); check('traffic: then green', leds[2].rt.ia > 0.005 && leds[0].rt.ia < 1e-4); }
// 10 Melody
{ const t = ex('melody'); const bz = part(t.e, 'buzzer'); let seen = new Set(); for (let i = 0; i < 40; i++) { t.rt.advance(50); if (t.rt.buzzFreq) seen.add(t.rt.buzzFreq); }
  check('melody: buzzer plays different notes', seen.size >= 3, [...seen].join(',')); }
// 11 Hysteresis night light
{ const t = ex('hysteresis'); const l = part(t.e, 'led'), ldr = part(t.e, 'ldr');
  const at = L => { ldr.props.light = L; t.rt.rebuild(); t.rt.advance(450); return l.rt.ia > 0.005; };
  const bright = at(90), dark = at(25), mid1 = at(60), bright2 = at(85), mid2 = at(60);
  check('hysteresis: off, ON in dark, STAYS on in the middle, off when bright, STAYS off in the middle', !bright && dark && mid1 && !bright2 && !mid2, [bright, dark, mid1, bright2, mid2].join(',')); }
// 12 Transistor driver with separate supply
{ const t = ex('driver'); const bz = part(t.e, 'buzzer'); const seen = []; for (let i = 0; i < 25; i++) { t.rt.advance(50); seen.push(!!bz.rt.sounding); }
  const on = seen.filter(Boolean).length, off = seen.length - on;
  const pinI = Math.abs(t.rt.ard.pinEls[8].i);
  check('driver: buzzer beeps (~200 ms on / 800 ms off)', on >= 2 && on <= 8 && off >= 14, 'on=' + on + ' off=' + off);
  check('driver: Arduino pin only supplies the small base current', pinI < 0.01, (pinI * 1000).toFixed(2) + ' mA (max seen at end)'); }
// 12b Without the common ground the driver cannot work
{ const t = ex('driver'); const gb = t.e.circuit.parts.find(p => p.id && p.type === 'ground' && p.x === 480); t.e.circuit.parts = t.e.circuit.parts.filter(p => p !== gb); t.rt.rebuild();
  const bz = part(t.e, 'buzzer'); let any = false; for (let i = 0; i < 25; i++) { t.rt.advance(50); any = any || !!bz.rt.sounding; }
  check('driver: removing the common ground silences the buzzer', !any); }
// 13 RC low-pass filter gain at 100 Hz and 1 kHz
{ const gain = f => { const t = ex('rcfilter'); const ac = part(t.e, 'acsource'); ac.props.freq = f; t.rt.rebuild(); t.rt.advance(400);
    let vi = 0, vo = 0; const [pi, po] = t.e.probes; for (let k = 0; k < 150; k++) { t.rt.advance(1000 / f / 7.3); vi = Math.max(vi, t.rt.nodeVoltage(pi)); vo = Math.max(vo, t.rt.nodeVoltage(po)); } return vo / vi; };
  const g100 = gain(100), g1000 = gain(1000);
  check('rcfilter: gain at cutoff (100 Hz) ≈ 0.71', Math.abs(g100 - 0.71) < 0.07, g100.toFixed(3));
  check('rcfilter: gain at 1 kHz ≈ 0.1 (attenuated)', g1000 < 0.15 && g1000 > 0.07, g1000.toFixed(3)); }
// 14 RL: voltage across R ramps with tau = L/R = 1 ms
{ const t = ex('rl'); const [pi, po] = t.e.probes; t.rt.advance(0.3);              // just after the first rising edge
  const early = t.rt.nodeVoltage(po); t.rt.advance(4);                                // settled before the falling edge
  const late = t.rt.nodeVoltage(po);
  check('rl: resistor voltage starts near 0 and settles near 5 V', early < 1.6 && late > 4.5, early.toFixed(2) + ' V -> ' + late.toFixed(2) + ' V'); }
// 15 DC motor speed ramps with PWM through the transistor
{ const t = ex('motor-pwm'); const m = part(t.e, 'motor'); t.rt.advance(300); const w0 = m.rt.omega; t.rt.advance(3300); const w1 = m.rt.omega;
  check('motor-pwm: starts slow, reaches full speed at the top of the ramp', w0 < 0.2 && w1 > 0.85, w0.toFixed(2) + ' -> ' + w1.toFixed(2) + ' (' + m.rt.rpm + ' rpm)');
  const pinI = Math.abs(t.rt.ard.pinEls[9].i); check('motor-pwm: Arduino pin only drives the transistor base', pinI < 0.008, (pinI * 1000).toFixed(2) + ' mA'); }
// 16 Servo sweep: angle covers 0..180, pulses are 1-2.4 ms every 20 ms, power matters
{ const t = ex('servo-sweep'); const sv = part(t.e, 'servo'); let mn = 999, mx = -1; for (let i = 0; i < 130; i++) { t.rt.advance(50); mn = Math.min(mn, sv.rt.angle); mx = Math.max(mx, sv.rt.angle); }
  check('servo-sweep: arm sweeps the full range', mn < 20 && mx > 160, mn.toFixed(0) + '..' + mx.toFixed(0) + '°  status=' + sv.rt.status);
  let hi = 0, n = 0; for (let k = 0; k < 400; k++) { t.rt.advance(0.25); hi += t.rt.sim.v[t.rt.ard.nodes[9]] > 2.5 ? 1 : 0; n++; }
  const duty = hi / n; check('servo-sweep: control pulse duty is 2.7–12% (a 20 ms frame)', duty > 0.02 && duty < 0.13, (duty * 100).toFixed(1) + '%');
  const t2 = ex('servo-sweep'); t2.e.circuit.parts = t2.e.circuit.parts.filter(p => p.type !== 'battery'); t2.rt.rebuild(); t2.rt.advance(500);
  check('servo-sweep: without the 5 V supply the servo does not move', /No power/.test(part(t2.e, 'servo').rt.status) && part(t2.e, 'servo').rt.angle === 90, part(t2.e, 'servo').rt.status); }
// 17 Servo follows the knob
{ const t = ex('servo-pot'); const sv = part(t.e, 'servo'), pot = part(t.e, 'pot'); const at = pos => { pot.props.pos = pos; t.rt.rebuild(); t.rt.advance(1200); return sv.rt.angle; };
  const lo = at(0), hi = at(100), mid = at(50); check('servo-pot: knob 0% / 100% / 50% -> ~0° / ~180° / ~90°', lo < 8 && hi > 172 && Math.abs(mid - 90) < 8, [lo, hi, mid].map(x => x.toFixed(0)).join(' / ')); }
// 18 LCD text + wiring diagnosis
{ const t = ex('lcd-hello'); const lcd = part(t.e, 'lcd16x2'); t.rt.advance(2500);
  const L = lcd.rt.obj && lcd.rt.obj.lines;
  check('lcd-hello: row 1 shows the greeting', L && L[0] === 'Hello, Smart21!' + ' '.repeat(1), JSON.stringify(L && L[0]));
  check('lcd-hello: row 2 shows a running counter', L && /^\d+ s running/.test(L[1]), JSON.stringify(L && L[1]));
  const t2 = ex('lcd-hello'); t2.e.circuit.wires = t2.e.circuit.wires.filter(w => !(w.b.t === 'RS')); t2.rt.rebuild(); t2.rt.advance(300);
  const l2 = part(t2.e, 'lcd16x2'); check('lcd-hello: missing RS wire is diagnosed', !l2.rt.obj && /RS should connect to pin D12/.test(l2.rt.status), l2.rt.status);
  const t3 = ex('lcd-hello'); const l3 = part(t3.e, 'lcd16x2'); l3.props.simple = false; t3.rt.rebuild(); t3.rt.advance(300);
  check('lcd-hello: with simplified power OFF and no power wires, it explains the power problem', !l3.rt.obj && /No power/.test(l3.rt.status), l3.rt.status);
  const t4 = ex('lcd-hello', null); }
{ const e = Ex.load('lcd-hello'); const rt = new Runtime(e.circuit, {}); const r = rt.loadSketch(e.sketch.replace('lcd.begin(16, 2);', '')); rt.advance(300);
  const lcd = part(e, 'lcd16x2'); lcd.rt.status; check('lcd: forgetting lcd.begin() leaves the display uninitialised', rt.interp.libObjects.find(o => o.__lib === 'LCD').inited === false); }
// 19 LCD voltmeter
{ const t = ex('lcd-volts'); t.rt.advance(600); const L = part(t.e, 'lcd16x2').rt.obj.lines;
  check('lcd-volts: shows 2.00 V for a 40% knob', L[0].startsWith('Voltage on A0:') && /^2\.00 V/.test(L[1]), JSON.stringify(L)); }
// 20 Seven segment counter
{ const t = ex('sevenseg'); const sg = part(t.e, 'sevenseg'); t.rt.advance(300); const d0 = sg.rt.seg.slice();
  t.rt.advance(700); const d1 = sg.rt.seg.slice();
  const lit = a => a.map(v => (v > 0.5 ? 1 : 0)).join('');
  check('sevenseg: digit 0 lights a-f, not g/dp', lit(d0) === '11111100', lit(d0)); check('sevenseg: digit 1 lights only b and c', lit(d1) === '01100000', lit(d1)); }
// 21 Meters
{ const t = ex('meters'); t.rt.advance(50); const am = part(t.e, 'ammeter'), vm = part(t.e, 'voltmeter');
  check('meters: ammeter reads 3 mA, voltmeter reads 6 V', Math.abs(am.rt.i - 0.003) < 0.0001 && Math.abs(vm.rt.v - 6) < 0.05, (am.rt.i * 1000).toFixed(3) + ' mA, ' + vm.rt.v.toFixed(3) + ' V'); }
// 22 TMP36 thermometer on the LCD
{ const t = ex('temp-lcd'); const T = part(t.e, 'tmp36'), lcd = part(t.e, 'lcd16x2');
  const at = d => { T.props.temp = d; t.rt.rebuild(); t.rt.advance(500); return lcd.rt.obj && lcd.rt.obj.lines[1].trim(); };
  const a = at(25), b = at(40), c = at(-10);
  const num = s => parseFloat(s);
  check('temp-lcd: LCD follows the sensor (25, 40, -10 °C)', Math.abs(num(a) - 25) < 0.7 && Math.abs(num(b) - 40) < 0.7 && Math.abs(num(c) + 10) < 0.7, [a, b, c].join(' | '));
  const t2 = ex('temp-lcd'); t2.e.circuit.parts = t2.e.circuit.parts.filter(p => p.type !== 'vcc'); t2.rt.rebuild(); t2.rt.advance(500);
  check('temp-lcd: without its supply the sensor reads nonsense (-50 °C)', parseFloat(part(t2.e, 'lcd16x2').rt.obj.lines[1]) < -45, part(t2.e, 'lcd16x2').rt.obj.lines[1].trim()); }
// 23 HC-SR04 ultrasonic distance through pulseIn
{ const dist = d => { const t = ex('ultrasonic'); part(t.e, 'hcsr04').props.distance = d; t.rt.rebuild(); t.rt.advance(1000); const lines = t.serial.trim().split('\n'); return lines[lines.length - 1]; };
  const d10 = dist(10), d100 = dist(100), far = dist(450);
  check('ultrasonic: prints 10 cm and 100 cm correctly', /Distance: (9|10) cm/.test(d10) && /Distance: (99|100) cm/.test(d100), d10 + ' | ' + d100);
  check('ultrasonic: out of range (450 cm) gives "no echo"', far === 'no echo', far);
  const t = ex('ultrasonic'); t.e.circuit.parts = t.e.circuit.parts.filter(p => p.type !== 'vcc'); t.rt.rebuild(); t.rt.advance(1000);
  check('ultrasonic: unpowered sensor gives "no echo"', /no echo/.test(t.serial), JSON.stringify(t.serial.slice(0, 30)));
  const t3 = ex('ultrasonic', (e, rt) => {}); const bad = t3.e.circuit; const src = Ex.load('ultrasonic').sketch.replace('delayMicroseconds(10);', 'delayMicroseconds(5);');
  const rt3 = new Runtime(bad, { onSerial: s => (t3._s = (t3._s || '') + s) }); rt3.loadSketch(src); rt3.advance(800);
  check('ultrasonic: a trigger pulse shorter than 10 µs is ignored (no echo)', /no echo/.test(t3._s || ''), JSON.stringify((t3._s || '').slice(0, 30)));
  const t4 = ex('ultrasonic'); let hi = 0, n = 0; for (let k = 0; k < 4000; k++) { t4.rt.advance(0.25); hi += t4.rt.sim.v[t4.rt.ard.nodes[9]] > 2.5 ? 1 : 0; n++; }
  const echoMs = hi * 0.25 / (1000 / 300) ; check('ultrasonic: ECHO pin physically goes HIGH (visible on the scope)', hi > 0, 'high samples=' + hi); }
// 24 555 astable: frequency and duty cycle match the formula
{ const t = ex('555-blink'); t.rt.advance(500); let prev = false, rises = 0, hi = 0, n = 0, start = t.rt.vt; const ic = part(t.e, 'ic555');
  for (let k = 0; k < 4000; k++) { t.rt.advance(1); const on = t.rt.sim.v[t.rt.nl.nodeOf(ic.id, 'OUT')] > 2.5; if (on && !prev) rises++; prev = on; hi += on ? 1 : 0; n++; }
  const f = rises / ((t.rt.vt - start) / 1000), duty = hi / n, fWant = 1.44 / ((1000 + 20000) * 10e-6), dWant = 11000 / 21000;
  check('555: frequency ≈ 6.9 Hz (1.44 ÷ ((R1+2R2)C))', Math.abs(f - fWant) / fWant < 0.08, f.toFixed(2) + ' Hz (formula ' + fWant.toFixed(2) + ')');
  check('555: duty cycle ≈ 52% ((R1+R2) ÷ (R1+2R2))', Math.abs(duty - dWant) < 0.06, (duty * 100).toFixed(1) + '% (formula ' + (dWant * 100).toFixed(1) + '%)');
  const led = part(t.e, 'led'); let lit = 0, dark = 0; for (let k = 0; k < 300; k++) { t.rt.advance(10); if (led.rt.ia > 0.003) lit++; else dark++; }
  check('555: the LED really blinks', lit > 50 && dark > 50, 'lit=' + lit + ' dark=' + dark);
  const c = part(t.e, 'capacitor'); let mn = 9, mx = -9; for (let k = 0; k < 600; k++) { t.rt.advance(1); mn = Math.min(mn, c.rt.vc); mx = Math.max(mx, c.rt.vc); }
  check('555: capacitor swings between ⅓ and ⅔ of Vcc (1.67–3.33 V)', mn > 1.5 && mn < 1.85 && mx > 3.15 && mx < 3.5, mn.toFixed(2) + ' – ' + mx.toFixed(2) + ' V'); }
// 25 Logic gates: full truth tables
{ const t = ex('logic-gate'); const sw1 = part(t.e, 'switch', 0), sw2 = part(t.e, 'switch', 1), led = part(t.e, 'led'), gate = part(t.e, 'gate');
  const tables = { and: [0, 0, 0, 1], or: [0, 1, 1, 1], nand: [1, 1, 1, 0], nor: [1, 0, 0, 0], xor: [0, 1, 1, 0], not: [1, 1, 0, 0] };   // order: (A,B) = 00, 01, 10, 11   (NOT uses A only)
  for (const [type, want] of Object.entries(tables)) {
    gate.props.type = type; const got = [];
    for (const [a, b] of [[0, 0], [0, 1], [1, 0], [1, 1]]) { sw1.props.closed = !!a; sw2.props.closed = !!b; t.rt.rebuild(); t.rt.advance(30); got.push(led.rt.ia > 0.004 ? 1 : 0); }
    check('gate ' + type.toUpperCase() + ' truth table', got.join('') === want.join(''), 'got ' + got.join('') + ' want ' + want.join('')); } }
// LED without resistor burns
{ const c = P.newCircuit(); const b = P.addPart(c, 'battery', 100, 100, 0, { volts: 9 }); const l = P.addPart(c, 'led', 200, 100, 90);
  P.addWire(c, { p: b.id, t: '+' }, { p: l.id, t: 'a' }); P.addWire(c, { p: l.id, t: 'k' }, { p: b.id, t: '-' });
  const rt = new Runtime(c); rt.advance(100); check('LED without resistor burns out', !!l.rt.burnt && rt.alerts.some(a => /burned/.test(a.msg)), rt.alerts.map(a => a.msg).join('|').slice(0, 80)); }
// Short circuit alert
{ const c = P.newCircuit(); const b = P.addPart(c, 'battery', 100, 100, 0, { volts: 9 }); P.addWire(c, { p: b.id, t: '+' }, { p: b.id, t: '-' });
  const rt = new Runtime(c); rt.advance(10); check('short circuit alert', rt.alerts.some(a => /Short circuit/.test(a.msg))); }
// All sketches compile
for (const e of Ex.list) if (e.sketch) { const r = require('../src/js/arduino/interp.js').compile(e.sketch); check('compiles: ' + e.id, r.ok && r.warnings.length === 0, r.ok ? '' : r.error.message); }
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll example tests passed'); process.exit(fails ? 1 : 0);
