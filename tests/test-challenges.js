global.S21 = {};
require('../src/js/sim/solver.js'); require('../src/js/arduino/interp.js');
const P = require('../src/js/sim/parts.js'); require('../src/js/sim/runtime.js'); require('../src/js/examples.js');
const C = require('../src/js/challenges.js');
let fails = 0;
function check(n, c, x) { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  ' + x : '')); }
const part = (c, type, k = 0) => c.parts.filter(p => p.type === type)[k];
const wire = (c, a, at, b, bt) => P.addWire(c, { p: a.id, t: at }, { p: b.id, t: bt });
const run = (id, circuit, sketch) => C.byId[id].check(circuit, sketch);
const msg = r => r.items.map(i => (i.ok ? '✓' : '✗') + ' ' + i.msg).join(' | ').slice(0, 170);

// starters must NOT pass (except where they genuinely already satisfy) ---------------------------------
for (const ch of C.list) { const st = ch.starter(); const r = ch.check(st.circuit, st.sketch); check('starter does not pass: ' + ch.id, !r.pass, msg(r).slice(0, 90)); }

// reference solutions must pass ------------------------------------------------------------------------
{ const st = C.byId['safe-led'].starter(), c = st.circuit; const r = P.addPart(c, 'resistor', 240, 100, 0, { ohms: 470 });
  wire(c, part(c, 'battery'), '+', r, 'a'); wire(c, r, 'b', part(c, 'led'), 'a'); wire(c, part(c, 'led'), 'k', part(c, 'battery'), '-');
  const res = run('safe-led', c); check('safe-led: 470Ω solution passes', res.pass, msg(res));
  c.parts.find(p => p.type === 'resistor').props.ohms = 10; const bad = run('safe-led', c); check('safe-led: 10Ω (burns the LED) fails', !bad.pass, msg(bad).slice(0, 100)); 
  c.parts.find(p => p.type === 'resistor').props.ohms = 47000; const dim = run('safe-led', c); check('safe-led: 47kΩ (too dim) fails', !dim.pass, msg(dim).slice(0, 100)); }
{ const c = C.byId['divider-3v'].starter().circuit; const [r1, r2] = c.parts.filter(p => p.type === 'resistor'); r1.props.ohms = 2000; r2.props.ohms = 1000; wire(c, part(c, 'battery'), '+', r1, 'a');
  const res = run('divider-3v', c); check('divider-3v: 2k/1k solution passes', res.pass, msg(res)); r1.props.ohms = 1000; const bad = run('divider-3v', c); check('divider-3v: 1k/1k (4.5 V) fails', !bad.pass, msg(bad).slice(0, 100)); }
{ const st = C.byId['blink-2hz'].starter(); const good = st.sketch.replace(/delay\(1000\)/g, 'delay(250)');
  const res = run('blink-2hz', st.circuit, good); check('blink-2hz: delay(250) passes', res.pass, msg(res)); const slow = run('blink-2hz', st.circuit, st.sketch); check('blink-2hz: original 1 Hz fails', !slow.pass, msg(slow).slice(0, 100));
  const broken = run('blink-2hz', st.circuit, 'void setup(){ pinMode(13, OUTPUT) }\nvoid loop(){}'); check('blink-2hz: syntax error is explained', !broken.pass && /line 1/.test(msg(broken)), msg(broken).slice(0, 100)); }
{ const st = C.byId['hold-button'].starter(); const good = `const int BUTTON = 2; const int LED = 13;
void setup(){ pinMode(BUTTON, INPUT_PULLUP); pinMode(LED, OUTPUT); }
void loop(){ digitalWrite(LED, digitalRead(BUTTON) == LOW); }`;
  const res = run('hold-button', st.circuit, good); check('hold-button: correct sketch passes', res.pass, msg(res));
  const tog = run('hold-button', st.circuit, `const int LED = 13; void setup(){ pinMode(LED, OUTPUT); digitalWrite(LED, HIGH); } void loop(){}`); check('hold-button: always-on LED fails', !tog.pass, msg(tog).slice(0, 120)); }
{ const st = C.byId['dim-25'].starter(); const res = run('dim-25', st.circuit, st.sketch.replace('// TODO', 'analogWrite(LED, 64);'));
  check('dim-25: analogWrite(LED, 64) passes', res.pass, msg(res)); const bad = run('dim-25', st.circuit, st.sketch.replace('// TODO', 'analogWrite(LED, 128);')); check('dim-25: 50% fails', !bad.pass, msg(bad).slice(0, 100)); }
{ const c = C.byId['rc-half'].starter().circuit; const r = part(c, 'resistor'), cap = part(c, 'capacitor'); r.props.ohms = 5000; wire(c, part(c, 'battery'), '+', r, 'a'); wire(c, r, 'b', cap, 'a');
  const res = run('rc-half', c); check('rc-half: 5kΩ × 100µF passes', res.pass, msg(res)); r.props.ohms = 20000; const bad = run('rc-half', c); check('rc-half: 2 s time constant fails', !bad.pass, msg(bad).slice(0, 120)); }
{ const c = C.byId['npn-wire'].starter().circuit; const [bat, sw, rb, q, rc, led] = ['battery', 'switch', 'resistor', 'npn', 'resistor', 'led'].map((t, i) => (i === 4 ? c.parts.filter(p => p.type === 'resistor')[1] : part(c, t)));
  wire(c, bat, '+', sw, 'a'); wire(c, sw, 'b', rb, 'a'); wire(c, rb, 'b', q, 'b'); wire(c, bat, '+', rc, 'a'); wire(c, led, 'k', q, 'c');
  const res = run('npn-wire', c); check('npn-wire: correct wiring passes', res.pass, msg(res));
  const c2 = C.byId['npn-wire'].starter().circuit; const p2 = t => part(c2, t); wire(c2, p2('battery'), '+', p2('switch'), 'a'); wire(c2, p2('switch'), 'b', c2.parts.filter(p => p.type === 'resistor')[1], 'a'); wire(c2, p2('battery'), '+', c2.parts.filter(p => p.type === 'resistor')[1], 'a'); wire(c2, p2('led'), 'k', p2('battery'), '-');
  const bad = run('npn-wire', c2); check('npn-wire: switch wired directly into LED path fails', !bad.pass, msg(bad).slice(0, 120)); }
{ const st = C.byId['count-serial'].starter(); const res = run('count-serial', st.circuit, 'void setup(){ Serial.begin(9600); for (int i = 1; i <= 5; i++) Serial.println(i); } void loop(){}');
  check('count-serial: loop in setup passes', res.pass, msg(res)); const forever = run('count-serial', st.circuit, 'int n=1; void setup(){ Serial.begin(9600);} void loop(){ if(n<=9){ Serial.println(n); n++; } delay(10); }'); check('count-serial: counting past 5 fails', !forever.pass, msg(forever).slice(0, 100));
  const silent = run('count-serial', st.circuit, 'void setup(){ for (int i = 1; i <= 5; i++) Serial.println(i); } void loop(){}'); check('count-serial: forgetting Serial.begin gives a helpful message', !silent.pass && /Serial\.begin/.test(msg(silent)), msg(silent).slice(0, 100)); }
{ const st = C.byId['servo-135'].starter(); const good = st.sketch.replace('// TODO: attach the servo to pin 9 and move it', 'myServo.attach(9); myServo.write(135);');
  const res = run('servo-135', st.circuit, good); check('servo-135: attach + write(135) passes', res.pass, msg(res));
  const wrong = run('servo-135', st.circuit, st.sketch.replace('// TODO: attach the servo to pin 9 and move it', 'myServo.attach(9); myServo.write(45);')); check('servo-135: 45° fails with the actual angle', !wrong.pass && /4[0-9]°/.test(msg(wrong)), msg(wrong).slice(0, 110));
  const noAttach = run('servo-135', st.circuit, st.sketch.replace('// TODO: attach the servo to pin 9 and move it', 'myServo.write(135);')); check('servo-135: forgetting attach() is explained', !noAttach.pass && /attach/.test(msg(noAttach)), msg(noAttach).slice(0, 120)); }
{ const st = C.byId['lcd-name'].starter(); const good = st.sketch.replace('  // TODO', '  lcd.begin(16, 2);\n  lcd.print("HELLO");\n  lcd.setCursor(0, 1);\n  lcd.print("SMART21");');
  const res = run('lcd-name', st.circuit, good); check('lcd-name: correct sketch passes', res.pass, msg(res));
  const nb = run('lcd-name', st.circuit, good.replace('lcd.begin(16, 2);', '')); check('lcd-name: missing lcd.begin() is reported', !nb.pass && /begin/.test(msg(nb)), msg(nb).slice(0, 120));
  const same = run('lcd-name', st.circuit, st.sketch.replace('  // TODO', '  lcd.begin(16, 2);\n  lcd.print("HELLO");\n  lcd.print("SMART21");')); check('lcd-name: both words on row 1 fails', !same.pass, msg(same).slice(0, 130)); }
{ const st = C.byId['motor-half'].starter(); const good = st.sketch.replace('  // TODO', '  analogWrite(MOTOR_PIN, 128);');
  const res = run('motor-half', st.circuit, good); check('motor-half: analogWrite(128) passes', res.pass, msg(res));
  const full = run('motor-half', st.circuit, st.sketch.replace('  // TODO', '  digitalWrite(MOTOR_PIN, HIGH);')); check('motor-half: full speed fails', !full.pass, msg(full).slice(0, 110)); }
{ const st = C.byId['seg-five'].starter(); const good = st.sketch.replace('  // TODO', `  for (int i = 0; i < 8; i++) pinMode(segPin[i], OUTPUT);
  digitalWrite(9, HIGH); digitalWrite(7, HIGH); digitalWrite(6, HIGH); digitalWrite(4, HIGH); digitalWrite(3, HIGH);`);
  const res = run('seg-five', st.circuit, good); check('seg-five: a c d f g lit passes', res.pass, msg(res));
  const bad = run('seg-five', st.circuit, st.sketch.replace('  // TODO', `  for (int i = 0; i < 8; i++) { pinMode(segPin[i], OUTPUT); digitalWrite(segPin[i], HIGH); }`)); check('seg-five: all segments (an 8) fails and lists what is lit', !bad.pass && /abcdefg/.test(msg(bad)), msg(bad).slice(0, 110)); }
{ const st = C.byId['temp-alarm'].starter(); const good = st.sketch.replace('  // TODO: read the TMP36 on A0, convert to degrees C, switch the LED', '  float tempC = (analogRead(A0) * 5.0 / 1023.0 - 0.5) * 100.0;\n  digitalWrite(LED, tempC > 30);');
  const res = run('temp-alarm', st.circuit, good); check('temp-alarm: threshold sketch passes', res.pass, msg(res));
  const inv = run('temp-alarm', st.circuit, good.replace('tempC > 30', 'tempC < 30')); check('temp-alarm: inverted logic fails', !inv.pass, msg(inv).slice(0, 110)); }
{ const st = C.byId['dist-warning'].starter(); const good = st.sketch.replace('  // TODO', '  long cm = readCm();\n  digitalWrite(LED, cm > 0 && cm < 20);\n  delay(100);');
  const res = run('dist-warning', st.circuit, good); check('dist-warning: cm>0 && cm<20 passes', res.pass, msg(res));
  const naive = run('dist-warning', st.circuit, st.sketch.replace('  // TODO', '  long cm = readCm();\n  digitalWrite(LED, cm < 20);\n  delay(100);')); check('dist-warning: forgetting that 0 = no echo fails at 450 cm', !naive.pass && /450 cm/.test(msg(naive)), msg(naive).slice(0, 160)); }
{ const st = C.byId['555-2hz'].starter(); const c = st.circuit; const rs = c.parts.filter(p => p.type === 'resistor'); const r2 = rs.find(r => r.props.ohms === 10000); r2.props.ohms = 36000;
  const res = run('555-2hz', c); check('555-2hz: R2 = 36 kΩ passes', res.pass, msg(res)); r2.props.ohms = 18000; const bad = run('555-2hz', c); check('555-2hz: ~4 Hz fails with advice', !bad.pass && /larger/.test(msg(bad)), msg(bad).slice(0, 130)); }
{ const c = C.byId['gate-xor'].starter().circuit; const g = part(c, 'gate'); g.props.type = 'xor'; const res = run('gate-xor', c); check('gate-xor: XOR passes', res.pass, msg(res)); g.props.type = 'or'; const bad = run('gate-xor', c); check('gate-xor: OR fails (both on)', !bad.pass, msg(bad).slice(0, 120)); }

// ---------------- round 2 challenges: reference solutions ----------------
{ const c = C.byId['zener-5v'].starter().circuit; const bat = part(c, 'battery'), z = part(c, 'zener'), rl = part(c, 'resistor'); const rs = P.addPart(c, 'resistor', 160, 100, 0, { ohms: 560 });
  wire(c, bat, '+', rs, 'a'); wire(c, rs, 'b', z, 'k'); wire(c, rs, 'b', rl, 'a');
  const res = run('zener-5v', c); check('zener-5v: 560 Ω series resistor passes', res.pass, msg(res));
  rs.props.ohms = 3300; const weak = run('zener-5v', c); check('zener-5v: 3.3 kΩ fails at 9 V', !weak.pass, msg(weak).slice(0, 140));
  rs.props.ohms = 20; const hot = run('zener-5v', c); check('zener-5v: 20 Ω overheats the Zener', !hot.pass, msg(hot).slice(0, 140)); }
{ const st = C.byId['pnp-4hz'].starter(); const res = run('pnp-4hz', st.circuit, st.sketch.replace(/delay\(500\)/g, 'delay(125)')); check('pnp-4hz: delay(125) passes', res.pass, msg(res)); const slow = run('pnp-4hz', st.circuit, st.sketch); check('pnp-4hz: original 1 Hz fails', !slow.pass, msg(slow).slice(0, 100)); }
{ const c = C.byId['opamp-gain5'].starter().circuit; const rs = c.parts.filter(p => p.type === 'resistor'); const r2 = rs[1]; r2.props.ohms = 40000;
  const res = run('opamp-gain5', c); check('opamp-gain5: R2 = 40 kΩ passes', res.pass, msg(res)); r2.props.ohms = 20000; const bad = run('opamp-gain5', c); check('opamp-gain5: gain 3 fails with the measured gain', !bad.pass && /Gain = 3/.test(msg(bad)), msg(bad).slice(0, 120)); }
{ const st = C.byId['mosfet-half'].starter(); const res = run('mosfet-half', st.circuit, st.sketch.replace('// TODO: PWM on the gate', 'analogWrite(GATE, 128);')); check('mosfet-half: analogWrite(128) passes', res.pass, msg(res));
  const full = run('mosfet-half', st.circuit, st.sketch.replace('// TODO: PWM on the gate', 'analogWrite(GATE, 255);')); check('mosfet-half: full power fails', !full.pass, msg(full).slice(0, 100)); }
{ const st = C.byId['ntc-alarm'].starter(); const good = st.sketch.replace('// TODO: compare and drive the LED', 'digitalWrite(13, raw < 355);'); const res = run('ntc-alarm', st.circuit, good); check('ntc-alarm: raw < 355 passes', res.pass, msg(res));
  const bad = run('ntc-alarm', st.circuit, st.sketch.replace('// TODO: compare and drive the LED', 'digitalWrite(13, raw > 355);')); check('ntc-alarm: inverted comparison fails', !bad.pass, msg(bad).slice(0, 100)); }
{ const st = C.byId['relay-timing'].starter(); const good = `void setup(){ pinMode(7, OUTPUT); } void loop(){ digitalWrite(7, HIGH); delay(3000); digitalWrite(7, LOW); delay(1000); }`; const res = run('relay-timing', st.circuit, good); check('relay-timing: 3 s / 1 s passes', res.pass, msg(res));
  const bad = run('relay-timing', st.circuit, st.sketch); check('relay-timing: 2 s / 2 s fails', !bad.pass, msg(bad).slice(0, 100)); }
{ const st = C.byId['rgb-orange'].starter(); const res = run('rgb-orange', st.circuit, st.sketch.replace('// TODO: set the three colours', 'digitalWrite(RED_PIN, HIGH); analogWrite(GREEN_PIN, 100);')); check('rgb-orange: red full + green 100 passes', res.pass, msg(res));
  const y = run('rgb-orange', st.circuit, st.sketch.replace('// TODO: set the three colours', 'digitalWrite(RED_PIN, HIGH); digitalWrite(GREEN_PIN, HIGH);')); check('rgb-orange: full green (yellow) fails', !y.pass, msg(y).slice(0, 110)); }
{ const st = C.byId['shift-count'].starter(); const res = run('shift-count', st.circuit, st.sketch.replace('// TODO: count', 'static byte n = 0; show(n); n++; delay(500);')); check('shift-count: counting every 500 ms passes', res.pass, msg(res));
  const fast = run('shift-count', st.circuit, st.sketch.replace('// TODO: count', 'static byte n = 0; show(n); n++; delay(100);')); check('shift-count: 100 ms steps fail', !fast.pass, msg(fast).slice(0, 110)); }
{ const st = C.byId['eeprom-keep'].starter();
  const good = st.sketch.replace('// TODO: restore the saved state', 'state = EEPROM.read(0) == 1; digitalWrite(LED, state);').replace('// TODO: toggle, show and save the state', 'state = !state; digitalWrite(LED, state); EEPROM.update(0, state);');
  const res = run('eeprom-keep', st.circuit, good); check('eeprom-keep: save + restore passes', res.pass, msg(res));
  const forget = run('eeprom-keep', st.circuit, st.sketch.replace('// TODO: toggle, show and save the state', 'state = !state; digitalWrite(LED, state);')); check('eeprom-keep: forgetting to save fails', !forget.pass && forget.items.some(i => !i.ok && /not saved/.test(i.msg)), msg(forget).slice(0, 140)); }
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll challenge tests passed'); process.exit(fails ? 1 : 0);
