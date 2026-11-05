/* ---------------------------------------------------------------
   Smart21 ElectroLab — challenge mode
   Each challenge has a starter project and an automatic checker. The
   checker clones the student's circuit + sketch, runs them in a
   separate headless simulation, and measures what really happens.
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const KEY = 's21lab-challenges';
  const P = () => S21.Parts, PARTS = () => S21.Parts.PARTS, fmt = (v, u) => S21.Parts.fmt(v, u);

  /* ---------------- checker toolkit ---------------- */
  function boot(circuit, sketch, opts) {
    const c = P().deserialize(JSON.parse(JSON.stringify(P().serialize(circuit))));
    let serial = '';
    const rt = new S21.Runtime(c, Object.assign({ onSerial: s => { serial += s; }, onConsole: () => {} }, opts || {}));
    const env = { c, rt, items: [], get serial() { return serial; }, compileError: null };
    if (rt.ard) {
      const r = rt.loadSketch(sketch || '');
      if (!r.ok) env.compileError = r.error;
    }
    return env;
  }
  const parts = (env, type) => env.c.parts.filter(p => p.type === type);
  const sync = (env, comp) => { const d = PARTS()[comp.type]; if (d.sync) d.sync(comp, env.rt.nl.compEls.get(comp.id)); };
  const ok = (env, cond, good, bad) => { env.items.push({ ok: !!cond, msg: cond ? good : bad }); return !!cond; };
  const lit = led => (led.rt.ia || 0) > 0.005;
  const result = env => ({ pass: env.items.length > 0 && env.items.every(i => i.ok), items: env.items });
  function needs(env, type, nice) {
    if (parts(env, type).length) return true;
    env.items.push({ ok: false, msg: 'Your circuit needs ' + nice + '.' }); return false;
  }
  function sketchProblem(env) {
    if (env.compileError) { env.items.push({ ok: false, msg: 'The sketch has an error on line ' + env.compileError.line + ': ' + env.compileError.message }); return true; }
    if (env.rt.interp && env.rt.interp.error) { env.items.push({ ok: false, msg: 'Runtime error: ' + env.rt.interp.error.message }); return true; }
    return false;
  }

  /* ---------------- starter helpers ---------------- */
  const build = spec => S21.Examples.build(spec);
  function exampleStarter(id, sketch) { const e = S21.Examples.load(id); return { circuit: e.circuit, probes: e.probes, sketch: sketch !== undefined ? sketch : e.sketch }; }
  function strip(id) { const e = S21.Examples.list.find(x => x.id === id); return build(Object.assign({}, e.spec, { wires: [], probes: [] })); }

  /* ---------------- the challenges ---------------- */
  const LIST = [
    {
      id: 'safe-led', title: 'Light an LED safely', level: 'Beginner',
      task: 'Connect the 9 V battery, an LED and a <b>resistor</b> in one loop so the LED is clearly lit but safe: <b>8 to 20 mA</b>. Use Ohm’s law to choose the resistor, and do not burn the LED.',
      hints: ['R = (V<sub>supply</sub> − V<sub>LED</sub>) ÷ I. A red LED drops about 1.9 V.', 'For 15 mA: (9 − 1.9) ÷ 0.015 ≈ 473 Ω. A 470 Ω resistor is perfect.', 'Wire: battery + → resistor → LED anode (+); LED cathode (−) → battery −.'],
      starter: () => { const b = build({ parts: [['bat', 'battery', 100, 200, 0, { volts: 9 }], ['led', 'led', 340, 160, 90, { color: 'red' }]], wires: [] }); return { circuit: b.circuit, probes: [], sketch: null }; },
      check(circuit) {
        const env = boot(circuit); if (!needs(env, 'led', 'an LED') || !needs(env, 'battery', 'the battery')) return result(env);
        env.rt.advance(120); const led = parts(env, 'led')[0];
        ok(env, !led.rt.burnt, 'The LED survived.', 'The LED burned out: far too much current. Add a bigger resistor in series.');
        ok(env, parts(env, 'resistor').length > 0, 'There is a series resistor.', 'There is no resistor in the circuit.');
        const i = led.rt.burnt ? 0 : led.rt.ia || 0;
        ok(env, i >= 0.008 && i <= 0.02, 'LED current is ' + fmt(i, 'A') + ': in the safe 8–20 mA range.', 'LED current is ' + fmt(i, 'A') + (i < 0.008 ? ': too dim, use a smaller resistor.' : ': too high, use a bigger resistor.'));
        return result(env);
      }
    },
    {
      id: 'divider-3v', title: 'Make exactly 3 volts', level: 'Beginner',
      task: 'From the 9 V battery, build a <b>voltage divider</b> whose middle point (between the two resistors) measures <b>3.0 V (±0.15 V)</b>. Choose the two resistor values and connect everything.',
      hints: ['V<sub>out</sub> = V<sub>in</sub> × R2 ÷ (R1 + R2). You need R2 ÷ (R1 + R2) = 3 ÷ 9 = ⅓.', 'So R1 must be twice R2: for example R1 = 2 kΩ and R2 = 1 kΩ.', 'Battery + → R1 → R2 → ground. Hover the junction while running to read it.'],
      starter: () => { const b = build({ parts: [['bat', 'battery', 100, 200, 0, { volts: 9 }], ['gb', 'ground', 100, 240, 0], ['r1', 'resistor', 240, 120, 90, { ohms: 1000 }], ['r2', 'resistor', 240, 200, 90, { ohms: 1000 }], ['gr', 'ground', 240, 240, 0]], wires: [] }); return { circuit: b.circuit, probes: [], sketch: null }; },
      check(circuit) {
        const env = boot(circuit); if (!needs(env, 'resistor', 'two resistors')) return result(env);
        env.rt.advance(30);
        const count = new Map();
        for (const r of parts(env, 'resistor')) for (const t of ['a', 'b']) { const n = env.rt.nl.nodeOf(r.id, t); if (n) count.set(n, (count.get(n) || 0) + 1); }
        let best = null;
        for (const [n, k] of count) if (k >= 2) { const v = env.rt.sim.v[n]; if (v > 0.2 && v < 8.8 && (!best || Math.abs(v - 3) < Math.abs(best - 3))) best = v; }
        if (best === null) { ok(env, false, '', 'I cannot find a junction where two resistors meet between ground and the battery. Wire battery + → R1 → R2 → ground.'); return result(env); }
        ok(env, Math.abs(best - 3) <= 0.15, 'The middle point measures ' + fmt(best, 'V') + '.', 'The middle point measures ' + fmt(best, 'V') + ', not 3 V. Adjust the resistor ratio (R1 should be 2 × R2).');
        const batI = Math.abs(env.rt.nl.compEls.get(parts(env, 'battery')[0].id)[0].i);
        ok(env, batI < 0.02, 'Battery current is a modest ' + fmt(batI, 'A') + '.', 'Battery current is ' + fmt(batI, 'A') + ': quite high for a divider. Try larger resistors.');
        return result(env);
      }
    },
    {
      id: 'blink-2hz', title: 'Blink at 2 Hz', level: 'Beginner',
      task: 'Change the sketch so the LED blinks <b>twice per second</b> (2 Hz): on for 250 ms, off for 250 ms. The circuit is already wired.',
      hints: ['One blink cycle = on + off = 0.5 s at 2 Hz.', 'Change both delay() values to 250.'],
      starter: () => exampleStarter('blink'),
      check(circuit, sketch) {
        const env = boot(circuit, sketch); if (sketchProblem(env) || !needs(env, 'led', 'an LED') || !needs(env, 'arduino', 'the Arduino')) return result(env);
        const led = parts(env, 'led')[0], edges = []; let prev = false;
        for (let t = 0; t < 4000; t += 10) { env.rt.advance(10); const on = lit(led); if (on && !prev) edges.push(env.rt.vt); prev = on; }
        if (!ok(env, edges.length >= 2, 'The LED blinks.', 'The LED does not blink: check the wiring and that the sketch uses pinMode/digitalWrite.')) return result(env);
        const period = (edges[edges.length - 1] - edges[0]) / (edges.length - 1), f = 1000 / period;
        ok(env, f > 1.8 && f < 2.2, 'It blinks at ' + f.toFixed(2) + ' Hz.', 'It blinks at ' + f.toFixed(2) + ' Hz. You need 2 Hz (a 500 ms cycle).');
        return result(env);
      }
    },
    {
      id: 'hold-button', title: 'Lit only while held', level: 'Beginner',
      task: 'Write the sketch so the LED on pin 13 is <b>on only while the button (pin 2) is held</b> down, and off otherwise. The button connects pin 2 to GND.',
      hints: ['Use <code>pinMode(BUTTON, INPUT_PULLUP)</code>: a pressed button reads <b>LOW</b>.', 'In loop(): <code>digitalWrite(LED, digitalRead(BUTTON) == LOW);</code>'],
      starter: () => exampleStarter('button', `// Challenge: the LED (pin 13) must be ON only while the button (pin 2) is held down.
const int BUTTON = 2;
const int LED = 13;

void setup() {
  // TODO: set up the pins
}

void loop() {
  // TODO: copy the button state to the LED
}
`),
      check(circuit, sketch) {
        const env = boot(circuit, sketch); if (sketchProblem(env) || !needs(env, 'led', 'an LED') || !needs(env, 'button', 'the button')) return result(env);
        const led = parts(env, 'led')[0], btn = parts(env, 'button')[0];
        const phase = (pressed, label, wantOn) => { btn.rt.pressed = pressed; sync(env, btn); env.rt.advance(300); ok(env, lit(led) === wantOn, label + ': LED is ' + (wantOn ? 'on' : 'off') + ' ✓', label + ': the LED should be ' + (wantOn ? 'ON' : 'OFF') + ' but is ' + (lit(led) ? 'on' : 'off') + '.'); };
        env.rt.advance(100); phase(false, 'Button released', false); phase(true, 'Button held', true); phase(false, 'Released again', false); phase(true, 'Held again', true);
        return result(env);
      }
    },
    {
      id: 'dim-25', title: 'Dim to 25%', level: 'Intermediate',
      task: 'The LED is on pin 9. Make it glow at about <b>25% brightness</b> using PWM: a duty cycle of 25% (±3%).',
      hints: ['analogWrite takes 0–255. 25% of 255 is about 64.', '<code>analogWrite(9, 64);</code> in setup() (pinMode is optional for analogWrite).'],
      starter: () => exampleStarter('fade', `// Challenge: make the LED on pin 9 glow at 25% using PWM.
const int LED = 9;

void setup() {
  pinMode(LED, OUTPUT);
  // TODO
}

void loop() {
}
`),
      check(circuit, sketch) {
        const env = boot(circuit, sketch); if (sketchProblem(env) || !needs(env, 'arduino', 'the Arduino')) return result(env);
        env.rt.advance(50);
        let pin = -1; for (let p = 0; p < 14; p++) if (env.rt.pins[p].pwm !== null) pin = p;
        if (!ok(env, pin >= 0, 'A pin uses PWM (analogWrite).', 'No pin is using analogWrite().')) return result(env);
        let hi = 0, n = 0; for (let k = 0; k < 800; k++) { env.rt.advance(0.25); hi += env.rt.sim.v[env.rt.ard.nodes[pin]] > 2.5 ? 1 : 0; n++; }
        const duty = hi / n;
        ok(env, pin === 9, 'It is on pin 9.', 'PWM is on pin ' + pin + ' but the LED is wired to pin 9.');
        ok(env, Math.abs(duty - 0.25) <= 0.03, 'Duty cycle is ' + (duty * 100).toFixed(0) + '%.', 'Duty cycle is ' + (duty * 100).toFixed(0) + '%, not 25%.');
        return result(env);
      }
    },
    {
      id: 'rc-half', title: 'Time constant of half a second', level: 'Intermediate',
      task: 'Wire the battery, resistor and capacitor so the capacitor charges with a time constant <b>τ ≈ 0.5 s</b> (it should reach 63% of the battery voltage after 0.4 – 0.6 s). You may change the resistor and capacitor values.',
      hints: ['τ = R × C. For example 5 kΩ × 100 µF = 0.5 s.', 'Battery + → resistor → capacitor → ground. Use the Scope (Shift+click the capacitor pin) to see the curve.'],
      starter: () => { const b = build({ parts: [['bat', 'battery', 100, 200, 0, { volts: 5 }], ['gb', 'ground', 100, 240, 0], ['r', 'resistor', 240, 160, 0, { ohms: 220 }], ['c', 'capacitor', 340, 200, 90, { farads: 100e-6 }], ['gc', 'ground', 340, 220, 0]], wires: [], probes: ['c.a'] }); return { circuit: b.circuit, probes: b.probes, sketch: null, scope: '5000' }; },
      check(circuit) {
        const env = boot(circuit); if (!needs(env, 'capacitor', 'a capacitor') || !needs(env, 'battery', 'the battery')) return result(env);
        const cap = parts(env, 'capacitor')[0], vb = parts(env, 'battery')[0].props.volts; let t63 = null;
        for (let t = 0; t < 4000; t += 5) { env.rt.advance(5); if (t63 === null && (cap.rt.vc || 0) >= 0.632 * vb) t63 = env.rt.vt; }
        ok(env, (cap.rt.vc || 0) > 0.9 * vb, 'The capacitor charges up to ' + fmt(cap.rt.vc, 'V') + '.', 'The capacitor only reaches ' + fmt(cap.rt.vc || 0, 'V') + ' after 4 s: check the wiring or use a smaller resistor.');
        if (t63 !== null) ok(env, t63 >= 400 && t63 <= 600, 'It reaches 63% after ' + (t63 / 1000).toFixed(2) + ' s (τ ≈ ' + (t63 / 1000).toFixed(2) + ' s).', 'It reaches 63% after ' + (t63 / 1000).toFixed(2) + ' s. You need about 0.5 s: ' + (t63 < 400 ? 'increase R or C.' : 'decrease R or C.'));
        else ok(env, false, '', 'The capacitor never reaches 63% of the battery voltage.');
        return result(env);
      }
    },
    {
      id: 'npn-wire', title: 'Wire the transistor switch', level: 'Intermediate',
      task: 'All the parts are on the canvas but not connected. Wire them so the <b>LED lights when the switch is closed</b>, and the switch carries only the small <b>base current</b> (the LED current flows through the transistor).',
      hints: ['Battery + goes to two places: the switch, and the top of the LED’s resistor.', 'Switch → base resistor → transistor base. LED cathode → transistor collector. Emitter is already grounded.', 'Open the “Transistor as a switch” example to compare.'],
      starter: () => { const b = strip('npn'); return { circuit: b.circuit, probes: [], sketch: null }; },
      check(circuit) {
        const env = boot(circuit); if (!needs(env, 'npn', 'the transistor') || !needs(env, 'switch', 'the switch') || !needs(env, 'led', 'the LED')) return result(env);
        const sw = parts(env, 'switch')[0], led = parts(env, 'led')[0];
        sw.props.closed = false; sync(env, sw); env.rt.advance(60); const off = lit(led);
        sw.props.closed = true; sync(env, sw); env.rt.advance(100);
        const on = lit(led), swI = Math.abs(sw.rt.i || 0), ledI = led.rt.ia || 0;
        ok(env, !off, 'Switch open: the LED is off ✓', 'The LED is lit even with the switch open: it must not bypass the transistor.');
        ok(env, on, 'Switch closed: the LED lights (' + fmt(ledI, 'A') + ') ✓', 'Switch closed, but the LED does not light. Check the wires to the base and collector.');
        if (on) ok(env, swI < 0.003 && swI < ledI / 3, 'The switch only carries ' + fmt(swI, 'A') + ' (the base current) while the LED has ' + fmt(ledI, 'A') + ' ✓', 'The switch carries ' + fmt(swI, 'A') + ': it should only drive the base. The LED current must flow through the transistor.');
        return result(env);
      }
    },
    {
      id: 'count-serial', title: 'Count to five', level: 'Beginner',
      task: 'Write a sketch that prints the numbers <b>1, 2, 3, 4, 5</b> to the Serial monitor, one per line, and then <b>stops</b> printing (no more output after 5).',
      hints: ['Remember Serial.begin(9600) in setup().', 'Use a for loop in setup(): <code>for (int i = 1; i &lt;= 5; i++) Serial.println(i);</code>', 'Leave loop() empty so it does not print again.'],
      starter: () => { const b = build({ parts: [['ard', 'arduino', 100, 260, 0]], wires: [] }); return { circuit: b.circuit, probes: [], sketch: `// Challenge: print 1 2 3 4 5 (one per line), then nothing more.
void setup() {
  // TODO
}

void loop() {
}
` }; },
      check(circuit, sketch) {
        const env = boot(circuit, sketch); if (sketchProblem(env) || !needs(env, 'arduino', 'the Arduino')) return result(env);
        env.rt.advance(2500); if (sketchProblem(env)) return result(env);
        const out = env.serial, want = '1\n2\n3\n4\n5\n';
        if (out === want) ok(env, true, 'Output is exactly 1 2 3 4 5, one per line, and then it stops ✓', '');
        else if (out.startsWith(want)) ok(env, false, '', 'It prints 1 to 5 but keeps printing afterwards. Move the printing into setup() or stop after 5.');
        else if (out === '') ok(env, false, '', 'Nothing was printed. Did you call Serial.begin(9600) and Serial.println()?');
        else ok(env, false, '', 'Output was ' + JSON.stringify(out.slice(0, 40)) + ' but the expected output is ' + JSON.stringify(want) + '.');
        return result(env);
      }
    },
    {
      id: 'servo-135', title: 'Point the servo at 135°', level: 'Intermediate',
      task: 'The servo is wired to pin 9 and powered. Write the sketch so the arm moves to <b>135°</b> and stays there.',
      hints: ['Include the library: <code>#include &lt;Servo.h&gt;</code> and create <code>Servo myServo;</code>.', '<code>myServo.attach(9);</code> in setup(), then <code>myServo.write(135);</code>.'],
      starter: () => exampleStarter('servo-sweep', `// Challenge: move the servo to 135 degrees and keep it there.
#include <Servo.h>

Servo myServo;

void setup() {
  // TODO: attach the servo to pin 9 and move it
}

void loop() {
}
`),
      check(circuit, sketch) {
        const env = boot(circuit, sketch); if (sketchProblem(env) || !needs(env, 'servo', 'the servo')) return result(env);
        const sv = parts(env, 'servo')[0]; env.rt.advance(2200); if (sketchProblem(env)) return result(env);
        const a1 = sv.rt.angle; env.rt.advance(300); const a2 = sv.rt.angle;
        ok(env, sv.rt.status === 'OK', 'The servo is powered and gets a control signal ✓', 'The servo is not working: ' + (sv.rt.status || 'unknown') + (/signal/.test(sv.rt.status || '') ? ' Did you call attach(9)?' : ''));
        ok(env, Math.abs(a2 - 135) <= 3, 'The arm points at ' + a2.toFixed(0) + '° ✓', 'The arm points at ' + (a2 === undefined ? '?' : a2.toFixed(0)) + '°, not 135°.');
        ok(env, Math.abs(a2 - a1) < 1, 'It stays there ✓', 'The arm is still moving: it should hold 135°.');
        return result(env);
      }
    },
    {
      id: 'lcd-name', title: 'Two lines on the LCD', level: 'Intermediate',
      task: 'Show <b>HELLO</b> on the first row and <b>SMART21</b> on the second row of the LCD (capital letters, starting at the left edge). The display is wired for pins 12, 11, 5, 4, 3, 2.',
      hints: ['Create the object: <code>LiquidCrystal lcd(12, 11, 5, 4, 3, 2);</code> and call <code>lcd.begin(16, 2);</code>.', 'Print the first word, then <code>lcd.setCursor(0, 1);</code> before printing the second.'],
      starter: () => exampleStarter('lcd-hello', `// Challenge: row 1 = HELLO, row 2 = SMART21
#include <LiquidCrystal.h>

LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

void setup() {
  // TODO
}

void loop() {
}
`),
      check(circuit, sketch) {
        const env = boot(circuit, sketch); if (sketchProblem(env) || !needs(env, 'lcd16x2', 'the LCD')) return result(env);
        const lcd = parts(env, 'lcd16x2')[0]; env.rt.advance(400); if (sketchProblem(env)) return result(env);
        if (!ok(env, !!lcd.rt.obj, 'The display is wired correctly and shows text ✓', 'The display is blank: ' + (lcd.rt.status || 'check the sketch and wiring.'))) return result(env);
        const o = lcd.rt.obj; ok(env, o.inited, 'lcd.begin() was called ✓', 'Call lcd.begin(16, 2) in setup(): without it the display only shows black boxes.');
        const l0 = (o.lines[0] || '').replace(/\s+$/, ''), l1 = (o.lines[1] || '').replace(/\s+$/, '');
        ok(env, l0 === 'HELLO', 'Row 1 shows “HELLO” ✓', 'Row 1 shows “' + l0 + '” instead of “HELLO”.');
        ok(env, l1 === 'SMART21', 'Row 2 shows “SMART21” ✓', 'Row 2 shows “' + l1 + '” instead of “SMART21”. Use lcd.setCursor(0, 1) before printing.');
        return result(env);
      }
    },
    {
      id: 'motor-half', title: 'Half-speed motor', level: 'Advanced',
      task: 'The motor is driven by a transistor from pin 9. Make it run at <b>about half speed</b> (40–60% of full speed) and keep it there, using PWM.',
      hints: ['Speed follows the average voltage = duty × supply.', '50% duty is <code>analogWrite(9, 128);</code>'],
      starter: () => exampleStarter('motor-pwm', `// Challenge: run the motor at about half speed.
const int MOTOR_PIN = 9;

void setup() {
  pinMode(MOTOR_PIN, OUTPUT);
  // TODO
}

void loop() {
}
`),
      check(circuit, sketch) {
        const env = boot(circuit, sketch); if (sketchProblem(env) || !needs(env, 'motor', 'the motor')) return result(env);
        const m = parts(env, 'motor')[0]; env.rt.advance(2600); if (sketchProblem(env)) return result(env);
        const w = m.rt.omega || 0;
        ok(env, w > 0.05, 'The motor is turning ✓', 'The motor is not turning. Is pin 9 driven (analogWrite or digitalWrite)?');
        if (w > 0.05) ok(env, w >= 0.4 && w <= 0.6, 'Speed is ' + (w * 100).toFixed(0) + '% of full speed ✓', 'Speed is ' + (w * 100).toFixed(0) + '% of full speed; you need 40–60%.');
        return result(env);
      }
    },
    {
      id: 'seg-five', title: 'Show the digit 5', level: 'Intermediate',
      task: 'Make the 7-segment display show a steady <b>5</b> (segments a, c, d, f, g lit; b, e and the decimal point off). Segments a–dp are on pins 9, 8, 7, 6, 5, 4, 3, 2.',
      hints: ['Set the pins as outputs first.', 'Pins: a=9, c=7, d=6, f=4, g=3 → HIGH. b=8, e=5, dp=2 → LOW.', 'Or use the byte <code>0x6D</code> and test each bit like the example does.'],
      starter: () => exampleStarter('sevenseg', `// Challenge: show a steady 5 on the display.
// Segment pins a, b, c, d, e, f, g, dp:
const int segPin[] = {9, 8, 7, 6, 5, 4, 3, 2};

void setup() {
  // TODO
}

void loop() {
}
`),
      check(circuit, sketch) {
        const env = boot(circuit, sketch); if (sketchProblem(env) || !needs(env, 'sevenseg', 'the display')) return result(env);
        const sg = parts(env, 'sevenseg')[0]; env.rt.advance(500); if (sketchProblem(env)) return result(env);
        const lit = (sg.rt.seg || []).map(v => (v > 0.5 ? 1 : 0)).join(''), want = '10110110', names = 'abcdefg.';
        const have = (sg.rt.seg || []).map((v, i) => (v > 0.5 ? names[i] : '')).join('') || 'nothing';
        ok(env, lit === want, 'The display shows a 5 (segments a c d f g) ✓', 'Lit segments: ' + have + '. A 5 needs: a c d f g.');
        return result(env);
      }
    },
    {
      id: 'temp-alarm', title: 'Overheat warning', level: 'Intermediate',
      task: 'A TMP36 is on A0 and an LED on pin 13. Write the sketch so the LED turns <b>on above 30 °C</b> and <b>off at 30 °C or below</b>.',
      hints: ['Convert: <code>float tempC = (analogRead(A0) * 5.0 / 1023.0 - 0.5) * 100.0;</code>', '<code>digitalWrite(LED, tempC > 30);</code> in loop().', 'Remember <code>pinMode(LED, OUTPUT)</code>.'],
      starter: () => {
        const b = build({ parts: [['ard', 'arduino', 100, 260, 0], ['r', 'resistor', 200, 200, 0, { ohms: 220 }], ['led', 'led', 320, 200, 0, { color: 'red' }], ['gl', 'ground', 340, 200, 0],
          ['t', 'tmp36', 320, 540, 180, { temp: 25 }], ['vs', 'vcc', 340, 500, 0], ['gs', 'ground', 300, 500, 180]], wires: [['ard.D13', 'r.a'], ['r.b', 'led.a'], ['ard.A0', 't.out']] });
        return { circuit: b.circuit, probes: [], sketch: `// Challenge: LED on pin 13 ON above 30 degrees C, OFF otherwise.
const int LED = 13;

void setup() {
  pinMode(LED, OUTPUT);
}

void loop() {
  // TODO: read the TMP36 on A0, convert to degrees C, switch the LED
}
` };
      },
      check(circuit, sketch) {
        const env = boot(circuit, sketch); if (sketchProblem(env) || !needs(env, 'tmp36', 'the temperature sensor') || !needs(env, 'led', 'the LED')) return result(env);
        const t = parts(env, 'tmp36')[0], led = parts(env, 'led')[0], at = d => { t.props.temp = d; env.rt.rebuild(); env.rt.advance(450); return lit(led); };
        if (sketchProblem(env)) return result(env);
        for (const [d, want] of [[20, false], [29, false], [32, true], [45, true], [25, false]]) ok(env, at(d) === want, d + ' °C: LED is ' + (want ? 'on' : 'off') + ' ✓', d + ' °C: the LED should be ' + (want ? 'ON' : 'OFF') + '.');
        return result(env);
      }
    },
    {
      id: 'dist-warning', title: 'Proximity warning', level: 'Advanced',
      task: 'Use the ultrasonic sensor so the <b>built-in LED (pin 13)</b> lights when an object is <b>closer than 20 cm</b> and is off otherwise (including when there is no echo).',
      hints: ['The helper function <code>readCm()</code> is already written; call it in loop().', '<code>long cm = readCm();</code> then <code>digitalWrite(13, cm > 0 &amp;&amp; cm < 20);</code>', 'cm == 0 means no echo: that must NOT count as close.'],
      starter: () => exampleStarter('ultrasonic', `// Challenge: built-in LED (pin 13) ON when something is closer than 20 cm.
const int TRIG = 10;
const int ECHO = 9;
const int LED = 13;

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(LED, OUTPUT);
}

long readCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long us = pulseIn(ECHO, HIGH, 30000);
  return us / 58;                 // 0 means "no echo"
}

void loop() {
  // TODO
}
`),
      check(circuit, sketch) {
        const env = boot(circuit, sketch); if (sketchProblem(env) || !needs(env, 'hcsr04', 'the ultrasonic sensor')) return result(env);
        const us = parts(env, 'hcsr04')[0], ard = parts(env, 'arduino')[0], at = d => { us.props.distance = d; env.rt.rebuild(); env.rt.advance(900); return (ard.rt.led13 || 0) > 0.5; };
        if (sketchProblem(env)) return result(env);
        for (const [d, want] of [[100, false], [10, true], [19, true], [40, false], [450, false]]) ok(env, at(d) === want, d + ' cm: LED is ' + (want ? 'on' : 'off') + ' ✓', d + ' cm: the LED should be ' + (want ? 'ON' : 'OFF') + (d === 450 ? ' (no echo is not “close”)' : '') + '.');
        return result(env);
      }
    },
    {
      id: '555-2hz', title: '555 at 2 Hz', level: 'Advanced',
      task: 'Change <b>one or more component values</b> of the 555 blinker so that the LED blinks at <b>2 Hz (±10%)</b>. (Currently it is about 6.9 Hz.)',
      hints: ['f = 1.44 ÷ ((R1 + 2·R2) × C).', 'Keep C = 10 µF and R1 = 1 kΩ: you need R1 + 2·R2 = 1.44 ÷ (2 × 10 µF) = 72 kΩ, so R2 ≈ 35.5 kΩ.', 'Click R2 (the 10 kΩ resistor under R1) and type 36k.'],
      starter: () => exampleStarter('555-blink'),
      check(circuit) {
        const env = boot(circuit); if (!needs(env, 'ic555', 'the 555')) return result(env);
        const ic = parts(env, 'ic555')[0], node = env.rt.nl.nodeOf(ic.id, 'OUT'); env.rt.advance(800);
        let prev = false, rises = 0; const t0 = env.rt.vt;
        for (let k = 0; k < 6000; k++) { env.rt.advance(1); const on = env.rt.sim.v[node] > 2.5; if (on && !prev) rises++; prev = on; }
        const f = rises / ((env.rt.vt - t0) / 1000);
        ok(env, rises >= 2, 'The output oscillates ✓', 'The output does not oscillate: check the wiring (TRIG tied to THR, RESET high, DIS between R1 and R2).');
        if (rises >= 2) ok(env, f > 1.8 && f < 2.2, 'It oscillates at ' + f.toFixed(2) + ' Hz ✓', 'It oscillates at ' + f.toFixed(2) + ' Hz. You need 2 Hz (±10%): ' + (f > 2.2 ? 'make R2 or C larger.' : 'make R2 or C smaller.'));
        return result(env);
      }
    },
    {
      id: 'gate-xor', title: 'Exactly one switch', level: 'Beginner',
      task: 'The LED must be lit <b>only when exactly one</b> of the two switches is closed (not when both, not when neither). Change the circuit so it behaves like that.',
      hints: ['Look at the truth tables in lesson 25: which gate outputs 1 only when its inputs differ?', 'Select the gate and change its type to XOR in the inspector.'],
      starter: () => exampleStarter('logic-gate'),
      check(circuit) {
        const env = boot(circuit); if (!needs(env, 'gate', 'the gate') || !needs(env, 'led', 'the LED')) return result(env);
        const [s1, s2] = parts(env, 'switch'), led = parts(env, 'led')[0];
        for (const [a, b, want] of [[0, 0, false], [1, 0, true], [0, 1, true], [1, 1, false]]) {
          s1.props.closed = !!a; s2.props.closed = !!b; env.rt.rebuild(); env.rt.advance(40);
          ok(env, lit(led) === want, 'A=' + a + ', B=' + b + ': LED ' + (want ? 'on' : 'off') + ' ✓', 'A=' + a + ', B=' + b + ': the LED should be ' + (want ? 'ON' : 'OFF') + '.');
        }
        return result(env);
      }
    }
  ];
  const byId = {}; LIST.forEach(c => { byId[c.id] = c; });

  /* ---------------- progress ---------------- */
  let progress = {}; try { progress = JSON.parse((root.localStorage && root.localStorage.getItem(KEY)) || '{}'); } catch (_) {}
  const saveProgress = () => { try { root.localStorage.setItem(KEY, JSON.stringify(progress)); } catch (_) {} };

  const Challenges = { list: LIST, byId, progress: () => progress, active: null };
  Challenges.run = function (id, circuit, sketch) {
    const ch = byId[id]; if (!ch) return null;
    const res = ch.check(circuit, sketch);
    if (res.pass) { progress[id] = true; saveProgress(); if (S21.Home && S21.Home.check) S21.Home.check(); }
    return res;
  };
  Challenges.kit = { boot, parts, sync, ok, lit, result, needs, sketchProblem, build, exampleStarter, strip };
  S21.Challenges = Challenges;
  if (typeof module !== 'undefined' && module.exports) { module.exports = Challenges; require('./challenges2.js'); }

  /* ---------------- UI ---------------- */
  if (typeof document === 'undefined') return;
  const $ = (s, r) => (r || document).querySelector(s);
  let sel = LIST[0].id;
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function renderList() {
    const done = LIST.filter(c => progress[c.id]).length;
    $('#chList').innerHTML = '<h2>Challenges</h2><p>' + done + ' of ' + LIST.length + ' solved' + (done === LIST.length ? ' 🏆' : '') + '</p>' +
      LIST.map((c, i) => '<button class="lesson-item' + (c.id === sel ? ' on' : '') + (progress[c.id] ? ' done' : '') + '" data-id="' + c.id + '"><span class="num">' + (progress[c.id] ? '✓' : i + 1) + '</span><span><b>' + c.title + '</b><small>' + c.level + '</small></span></button>').join('');
    document.querySelectorAll('#chList .lesson-item').forEach(b => b.addEventListener('click', () => { sel = b.dataset.id; renderList(); renderDetail(); }));
  }
  function resultHtml(res) {
    return '<div class="ch-result ' + (res.pass ? 'pass' : 'fail') + '"><b>' + (res.pass ? '🎉 Challenge solved!' : 'Not yet — keep going') + '</b><ul>' +
      res.items.map(i => '<li class="' + (i.ok ? 'ok' : 'no') + '">' + (i.ok ? '✓ ' : '✗ ') + esc(i.msg) + '</li>').join('') + '</ul></div>';
  }
  function renderDetail() {
    const c = byId[sel];
    $('#chBody').innerHTML = '<article class="lesson"><span class="tag">Challenge · ' + c.level + '</span><h1>' + c.title + '</h1><p>' + c.task + '</p>' +
      '<details class="hints"><summary>Need a hint?</summary><ol>' + c.hints.map(h => '<li>' + h + '</li>').join('') + '</ol></details>' +
      '<div class="try"><div><b>' + (Challenges.active === sel ? 'Working on it' : 'Ready?') + '</b><span class="soft">“Start” loads the starter project into the Circuit Lab. Build your solution, then press <b>Check my solution</b>.</span></div>' +
      '<button class="btn" id="chStart">Start / reset</button><button class="btn primary" id="chCheck">Check my solution</button></div><div id="chOut"></div></article>';
    $('#chStart').onclick = () => start(sel);
    $('#chCheck').onclick = () => { const res = runCheck(sel); $('#chOut').innerHTML = resultHtml(res); renderList(); };
  }
  function runCheck(id) {
    const L = S21.Lab, res = Challenges.run(id, L.editor.circuit, L.sketch);
    if (res.pass) L.toast('🎉 Challenge solved: ' + byId[id].title, '', 6000);
    return res;
  }
  function start(id) {
    const c = byId[id], st = c.starter();
    Challenges.active = id; S21.App.show('lab'); $('#chBarOut').hidden = true; showBar(); S21.Lab.loadStarter(st);
    S21.Lab.toast('Challenge: ' + c.title + '. ' + c.task.replace(/<[^>]+>/g, ''), '', 9000);
  }
  function showBar() {
    const bar = $('#chBar'), c = byId[Challenges.active];
    if (!c) { bar.hidden = true; if (S21.Lab && S21.Lab.editor) S21.Lab.editor.padTop = 0; return; }
    bar.hidden = false; $('#chBarTitle').textContent = 'Challenge: ' + c.title; if (S21.Lab && S21.Lab.editor) S21.Lab.editor.padTop = 64;
  }
  Challenges.init = function () {
    renderList(); renderDetail(); showBar();
    $('#chBarCheck').onclick = () => {
      const res = runCheck(Challenges.active); $('#chBarOut').innerHTML = resultHtml(res); $('#chBarOut').hidden = false; renderList(); renderDetail();
    };
    $('#chBarOut').onclick = () => { $('#chBarOut').hidden = true; };
    $('#chBarDetails').onclick = () => { sel = Challenges.active; renderList(); renderDetail(); S21.App.show('challenges'); };
    $('#chBarClose').onclick = () => { Challenges.active = null; $('#chBarOut').hidden = true; showBar(); renderDetail(); };
  };
})(typeof window !== 'undefined' ? window : globalThis);
