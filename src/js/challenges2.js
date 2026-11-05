/* ---------------------------------------------------------------
   Smart21 ElectroLab — challenges, round 2
   Zener, PNP, op-amp, MOSFET/PWM, thermistor, relay, RGB LED,
   shift register and EEPROM. Registered into S21.Challenges.
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const C = S21.Challenges;
  if (!C || !C.kit || C.byId['zener-5v']) return;
  const { boot, parts, sync, ok, lit, result, needs, sketchProblem, build, exampleStarter } = C.kit;
  const fmt = (v, u) => S21.Parts.fmt(v, u);
  const volt = (env, c, t) => env.rt.nodeVoltage({ p: c.id, t });

  function blinkHz(env, led, ms) {
    const edges = []; let prev = false;
    for (let t = 0; t < ms; t += 10) { env.rt.advance(10); const on = lit(led); if (on && !prev) edges.push(env.rt.vt); prev = on; }
    return edges.length >= 2 ? 1000 / ((edges[edges.length - 1] - edges[0]) / (edges.length - 1)) : 0;
  }

  const LIST = [
    {
      id: 'zener-5v', title: 'Regulate to 5.1 V with a Zener', level: 'Intermediate',
      task: 'The 12 V battery must power a 1 kΩ load at a steady <b>5.1 V (±0.3 V)</b> using the Zener diode. Add a <b>series resistor</b> and wire it up. It must still give about 5.1 V (±0.35 V) when the battery sags to 9 V, and the Zener must not overheat (under 0.5 W).',
      hints: ['The Zener goes in reverse: cathode (bar) towards +, anode to ground, in parallel with the load.', 'The series resistor carries the load current plus a little Zener current: about (12 − 5.1) ÷ 10 mA ≈ 680 Ω. Anything from 300 to 700 Ω works.', 'Wire: battery + → series resistor → junction; junction → Zener cathode and → load; Zener anode and load → ground.'],
      starter: () => { const b = build({ parts: [['bat', 'battery', 80, 200, 0, { volts: 12 }], ['gb', 'ground', 80, 240, 0], ['z', 'zener', 240, 160, 270, { vz: 5.1 }], ['gz', 'ground', 240, 180, 0], ['rl', 'resistor', 320, 150, 90, { ohms: 1000 }], ['gl', 'ground', 320, 190, 0]], wires: [] }); return { circuit: b.circuit, probes: [], sketch: null }; },
      check(circuit) {
        const env = boot(circuit); if (!needs(env, 'zener', 'the Zener diode') || !needs(env, 'battery', 'the battery')) return result(env);
        const z = parts(env, 'zener')[0], bat = parts(env, 'battery')[0];
        env.rt.advance(40); const v12 = volt(env, z, 'k'), pz = Math.abs(env.rt.nl.compEls.get(z.id)[0].vd * env.rt.nl.compEls.get(z.id)[0].i);
        ok(env, Math.abs(v12 - 5.1) <= 0.3, 'With 12 V in, the load gets ' + fmt(v12, 'V') + '.', 'With 12 V in, the load gets ' + fmt(v12, 'V') + ', not 5.1 V. Check the series resistor and that the Zener is wired in reverse across the load.');
        ok(env, pz < 0.5, 'The Zener dissipates a safe ' + fmt(pz, 'W') + '.', 'The Zener dissipates ' + fmt(pz, 'W') + ': too hot. Use a larger series resistor.');
        bat.props.volts = 9; sync(env, bat); env.rt.advance(40); const v9 = volt(env, z, 'k');
        ok(env, Math.abs(v9 - 5.1) <= 0.35, 'At 9 V the output is still ' + fmt(v9, 'V') + ': regulated!', 'At 9 V the output drops to ' + fmt(v9, 'V') + '. The series resistor is too big: the Zener runs out of current.');
        return result(env);
      }
    },
    {
      id: 'pnp-4hz', title: 'PNP blinker at 4 Hz', level: 'Intermediate',
      task: 'The LED is switched by a <b>PNP transistor</b>, so it lights when the pin is LOW. Change the sketch so the LED blinks <b>4 times per second</b> (125 ms on, 125 ms off).',
      hints: ['4 Hz means a 250 ms cycle: 125 ms ON + 125 ms OFF.', 'Keep the LOW = ON logic; just change the two delay() values.'],
      starter: () => exampleStarter('pnp-highside'),
      check(circuit, sketch) {
        const env = boot(circuit, sketch); if (sketchProblem(env) || !needs(env, 'pnp', 'the PNP transistor') || !needs(env, 'arduino', 'the Arduino')) return result(env);
        const led = parts(env, 'led')[0], f = blinkHz(env, led, 3000);
        if (!ok(env, f > 0, 'The LED blinks.', 'The LED does not blink: keep the wiring and use digitalWrite(BASE, LOW/HIGH).')) return result(env);
        ok(env, f > 3.6 && f < 4.4, 'It blinks at ' + f.toFixed(2) + ' Hz.', 'It blinks at ' + f.toFixed(2) + ' Hz. You need 4 Hz (a 250 ms cycle).');
        return result(env);
      }
    },
    {
      id: 'opamp-gain5', title: 'Op-amp gain of 5', level: 'Advanced',
      task: 'The non-inverting amplifier has a gain of 2. Change one component value so the output is <b>5 × the input</b> (±5 %). The knob is set so the amplifier stays out of clipping.',
      hints: ['Gain = 1 + R2 ÷ R1. For a gain of 5 you need R2 ÷ R1 = 4.', 'R1 is 10 kΩ (to ground). Make R2 (the feedback resistor) 40 kΩ.'],
      starter: () => { const e = exampleStarter('opamp-gain'); return e; },
      check(circuit) {
        const env = boot(circuit); if (!needs(env, 'opamp', 'the op-amp') || !needs(env, 'pot', 'the potentiometer')) return result(env);
        const pot = parts(env, 'pot')[0], oa = parts(env, 'opamp')[0]; pot.props.pos = 90; sync(env, pot); env.rt.advance(40);
        const vin = volt(env, pot, 'w'), vout = volt(env, oa, 'o'), g = vin > 0.05 ? vout / vin : 0;
        ok(env, oa.rt.state === 'lin', 'The op-amp works in its linear region.', 'The output is saturated against a supply rail: the amplifier is clipping.');
        ok(env, g >= 4.75 && g <= 5.25, 'Gain = ' + g.toFixed(2) + ' (' + fmt(vout, 'V') + ' ÷ ' + fmt(vin, 'V') + ').', 'Gain = ' + g.toFixed(2) + '. You need 5: gain = 1 + R2 ÷ R1.');
        return result(env);
      }
    },
    {
      id: 'mosfet-half', title: 'MOSFET motor at half power', level: 'Intermediate',
      task: 'Write the sketch so the MOSFET gets a <b>50 % PWM</b> signal on pin 9 and the motor sees an average of <b>about 2.5 V</b> (2.1–2.9 V) from its 5 V supply.',
      hints: ['analogWrite() takes 0 to 255. 50 % of 255 is about 128.', 'Set pinMode(GATE, OUTPUT) in setup(), then analogWrite(GATE, 128) once is enough.'],
      starter: () => exampleStarter('mosfet-motor', `// Challenge: run the motor at 50 % power
const int GATE = 9;

void setup() {
  pinMode(GATE, OUTPUT);
}

void loop() {
  // TODO: PWM on the gate
}
`),
      check(circuit, sketch) {
        const env = boot(circuit, sketch); if (sketchProblem(env) || !needs(env, 'motor', 'the motor') || !needs(env, 'arduino', 'the Arduino')) return result(env);
        const m = parts(env, 'motor')[0]; env.rt.advance(100); let sum = 0, n = 0;
        for (let t = 0; t < 400; t++) { env.rt.advance(1); sum += Math.abs(m.rt.v); n++; }
        const avg = sum / n;
        ok(env, avg >= 2.1 && avg <= 2.9, 'The motor averages ' + fmt(avg, 'V') + '.', 'The motor averages ' + fmt(avg, 'V') + (avg < 2.1 ? ': too slow. Use a larger analogWrite() value (128 is 50 %).' : ': too fast. Use analogWrite(GATE, 128).'));
        return result(env);
      }
    },
    {
      id: 'ntc-alarm', title: 'Overheat alarm', level: 'Advanced',
      task: 'Write the sketch so the board LED (pin 13) turns <b>ON above 40 °C</b> and stays <b>OFF below 35 °C</b>. Use the thermistor on A0 (10 kΩ NTC on the bottom of a 10 kΩ divider).',
      hints: ['You can work in raw ADC counts: at 40 °C the NTC is about 5.3 kΩ, so analogRead ≈ 1023 × 5.3 ÷ 15.3 ≈ 355. The reading FALLS as it gets hotter.', 'Or convert to °C like the thermometer example and compare with 40.', 'if (raw < 355) the temperature is above 40 °C.'],
      starter: () => exampleStarter('ntc-thermo', `// Challenge: LED on pin 13 ON above 40 C, OFF below 35 C
void setup() {
  Serial.begin(9600);
  pinMode(13, OUTPUT);
}

void loop() {
  int raw = analogRead(A0);
  Serial.println(raw);          // watch the number while you change the temperature
  // TODO: compare and drive the LED
  delay(200);
}
`),
      check(circuit, sketch) {
        const env = boot(circuit, sketch); if (sketchProblem(env) || !needs(env, 'ntc', 'the thermistor') || !needs(env, 'arduino', 'the Arduino')) return result(env);
        const ntc = parts(env, 'ntc')[0], led13 = () => env.rt.ard.comp.rt.led13 || 0; const res = {};
        for (const T of [20, 30, 50, 70]) { ntc.props.temp = T; sync(env, ntc); env.rt.advance(900); res[T] = led13() > 0.5; }
        ok(env, !res[20] && !res[30], 'The LED is off at 20 °C and 30 °C.', 'The LED should be OFF at 20 °C and 30 °C (below 35 °C).');
        ok(env, res[50] && res[70], 'The LED is on at 50 °C and 70 °C.', 'The LED should be ON at 50 °C and 70 °C (above 40 °C).');
        return result(env);
      }
    },
    {
      id: 'relay-timing', title: 'Relay: 3 s on, 1 s off', level: 'Advanced',
      task: 'Change the sketch so the lamp circuit (switched by the relay) is <b>ON for 3 seconds, then OFF for 1 second</b>, repeating.',
      hints: ['The relay follows pin 7: HIGH energises the coil.', 'digitalWrite(RELAY, HIGH); delay(3000); digitalWrite(RELAY, LOW); delay(1000);'],
      starter: () => exampleStarter('relay-lamp'),
      check(circuit, sketch) {
        const env = boot(circuit, sketch); if (sketchProblem(env) || !needs(env, 'relay', 'the relay') || !needs(env, 'arduino', 'the Arduino')) return result(env);
        const led = parts(env, 'led')[0], ons = [], offs = []; let prev = null, since = 0;
        for (let t = 0; t < 14000; t += 10) { env.rt.advance(10); const on = lit(led); if (prev === null) { prev = on; since = env.rt.vt; continue; } if (on !== prev) { (prev ? ons : offs).push(env.rt.vt - since); since = env.rt.vt; prev = on; } }
        if (!ok(env, ons.length >= 1 && offs.length >= 1, 'The lamp switches on and off.', 'The lamp never switches: keep the wiring and drive pin 7.')) return result(env);
        const on = ons[ons.length - 1], off = offs[offs.length - 1];
        ok(env, Math.abs(on - 3000) < 250, 'ON for ' + (on / 1000).toFixed(2) + ' s.', 'ON for ' + (on / 1000).toFixed(2) + ' s; it should be 3 s.');
        ok(env, Math.abs(off - 1000) < 250, 'OFF for ' + (off / 1000).toFixed(2) + ' s.', 'OFF for ' + (off / 1000).toFixed(2) + ' s; it should be 1 s.');
        return result(env);
      }
    },
    {
      id: 'rgb-orange', title: 'Mix orange', level: 'Intermediate',
      task: 'Write the sketch so the RGB LED shows <b>orange</b>: red at full brightness, green at about <b>40 %</b> (PWM), blue <b>off</b>. Red is on pin 11, green on pin 9, blue on pin 6.',
      hints: ['Red full: digitalWrite(11, HIGH) or analogWrite(11, 255).', '40 % of 255 ≈ 100: analogWrite(9, 100).', 'Blue: leave pin 6 LOW.'],
      starter: () => exampleStarter('rgb-mixer', `// Challenge: show orange on the RGB LED
const int RED_PIN = 11, GREEN_PIN = 9, BLUE_PIN = 6;

void setup() {
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);
}

void loop() {
  // TODO: set the three colours
}
`),
      check(circuit, sketch) {
        const env = boot(circuit, sketch); if (sketchProblem(env) || !needs(env, 'rgbled', 'the RGB LED') || !needs(env, 'arduino', 'the Arduino')) return result(env);
        const rgb = parts(env, 'rgbled')[0]; env.rt.advance(400); const ia = rgb.rt.ia || [0, 0, 0];
        ok(env, ia[0] > 0.01, 'Red is fully on (' + fmt(ia[0], 'A') + ').', 'Red should be at full brightness (' + fmt(ia[0], 'A') + ' now).');
        ok(env, ia[1] > 0.0015 && ia[1] < 0.0065, 'Green is partly on (' + fmt(ia[1], 'A') + ').', 'Green should be about 40 % (' + fmt(ia[1], 'A') + ' now): try analogWrite(9, 100).');
        ok(env, ia[2] < 0.0005, 'Blue is off.', 'Blue should be off.');
        return result(env);
      }
    },
    {
      id: 'shift-count', title: 'Binary counter on 8 LEDs', level: 'Advanced',
      task: 'Use the 74HC595 to <b>count in binary</b>: show 0, 1, 2, 3, … on the 8 LEDs, <b>one step every 500 ms</b>.',
      hints: ['The show(byte) function already shifts a byte out and latches it.', 'Keep a variable: byte n = 0; then in loop(): show(n); n++; delay(500);', 'A byte wraps from 255 back to 0 by itself.'],
      starter: () => exampleStarter('shift-register', `// Challenge: binary counter, one step every 500 ms
const int DATA = 8, CLOCK = 9, LATCH = 10;

void show(byte pattern) {
  digitalWrite(LATCH, LOW);
  shiftOut(DATA, CLOCK, MSBFIRST, pattern);
  digitalWrite(LATCH, HIGH);
}

void setup() {
  pinMode(DATA, OUTPUT);
  pinMode(CLOCK, OUTPUT);
  pinMode(LATCH, OUTPUT);
}

void loop() {
  // TODO: count
}
`),
      check(circuit, sketch) {
        const env = boot(circuit, sketch); if (sketchProblem(env) || !needs(env, 'hc595', 'the 74HC595') || !needs(env, 'arduino', 'the Arduino')) return result(env);
        const ic = parts(env, 'hc595')[0], seq = [], at = []; let last = -1;
        for (let t = 0; t < 4200; t += 10) { env.rt.advance(10); const v = ic.rt.latch || 0; if (v !== last) { seq.push(v); at.push(env.rt.vt); last = v; } }
        const nonZero = seq.length >= 4;
        if (!ok(env, nonZero, 'The pattern changes (' + seq.length + ' steps seen).', 'The LEDs hardly change: call show(n) and increase n each time.')) return result(env);
        let counting = true; for (let i = 1; i < Math.min(seq.length, 8); i++) if (seq[i] !== ((seq[i - 1] + 1) & 255)) counting = false;
        ok(env, counting, 'The values go ' + seq.slice(0, 6).join(', ') + '… : binary counting!', 'The values go ' + seq.slice(0, 6).join(', ') + '…: they must increase by 1 each time.');
        const gaps = []; for (let i = 2; i < Math.min(at.length, 8); i++) gaps.push(at[i] - at[i - 1]);
        const avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
        ok(env, Math.abs(avg - 500) < 100, 'One step every ' + avg.toFixed(0) + ' ms.', 'One step every ' + avg.toFixed(0) + ' ms; it should be 500 ms.');
        return result(env);
      }
    },
    {
      id: 'eeprom-keep', title: 'Remember the LED after power-off', level: 'Advanced',
      task: 'Each press of the button (pin 2) toggles the LED (pin 13). Save the state in <b>EEPROM</b> so that after you press Stop and Run again the LED comes back in the state it was in.',
      hints: ['EEPROM.update(0, state) writes only when the value changed (and saves wear).', 'In setup() read it back: state = EEPROM.read(0) == 1; then digitalWrite(LED, state).', 'A brand-new EEPROM reads 255 in every cell, so treat anything other than 1 as OFF.'],
      starter: () => exampleStarter('button', `#include <EEPROM.h>
// Challenge: toggle the LED with the button and remember it in EEPROM
const int LED = 13;
const int BUTTON = 2;
bool state = false;

void setup() {
  pinMode(LED, OUTPUT);
  pinMode(BUTTON, INPUT_PULLUP);
  // TODO: restore the saved state
}

void loop() {
  if (digitalRead(BUTTON) == LOW) {
    // TODO: toggle, show and save the state
    delay(250);
    while (digitalRead(BUTTON) == LOW) { }
  }
}
`),
      check(circuit, sketch) {
        const eeprom = new Uint8Array(1024).fill(255), led13 = e => e.rt.ard.comp.rt.led13 || 0;
        const press = env => { const b = parts(env, 'button')[0]; b.rt.pressed = true; env.rt.rebuild(); env.rt.advance(150); b.rt.pressed = false; env.rt.rebuild(); env.rt.advance(500); };
        const items = []; const fresh = () => { const e = boot(circuit, sketch, { eeprom }); e.items = items; return e; };
        let env = fresh(); if (sketchProblem(env) || !needs(env, 'button', 'the button') || !needs(env, 'arduino', 'the Arduino')) return result(env);
        env.rt.advance(300); ok(env, led13(env) < 0.2, 'A fresh board starts with the LED off.', 'A fresh board (EEPROM empty) should start with the LED off.');
        press(env); if (!ok(env, led13(env) > 0.5, 'Pressing the button turns the LED on.', 'Pressing the button should turn the LED on.')) return result(env);
        env = fresh(); env.rt.advance(400);
        ok(env, led13(env) > 0.5, 'After Stop → Run the LED is still on: it was remembered!', 'After Stop → Run the LED is off: the state was not saved/restored.');
        press(env); ok(env, led13(env) < 0.2, 'Pressing again turns it off.', 'The second press should turn the LED off.');
        env = fresh(); env.rt.advance(400);
        ok(env, led13(env) < 0.2, 'After another restart it stays off.', 'After another restart the LED should stay off.');
        return result(env);
      }
    }
  ];
  for (const ch of LIST) { C.list.push(ch); C.byId[ch.id] = ch; }
})(typeof window !== 'undefined' ? window : globalThis);
