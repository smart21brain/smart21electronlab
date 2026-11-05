/* ---------------------------------------------------------------
   Smart21 ElectroLab — built-in example circuits and sketches
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};

  // spec.parts: [key, type, x, y, rot, props]    spec.wires: ['key.term', 'key.term', {o:'h'|'v', v:number}]
  function build(spec) {
    const P = S21.Parts, c = P.newCircuit(), ids = {};
    for (const [key, type, x, y, rot, props] of spec.parts) ids[key] = P.addPart(c, type, x, y, rot || 0, props).id;
    for (const w of spec.wires || []) {
      const [ak, at] = w[0].split('.'), [bk, bt] = w[1].split('.');
      const wire = P.addWire(c, { p: ids[ak], t: at }, { p: ids[bk], t: bt });
      if (w[2]) wire.m = { o: w[2].o, v: w[2].v };
    }
    const probes = (spec.probes || []).map(s => { const [k, t] = s.split('.'); return { p: ids[k], t }; });
    return { circuit: c, probes };
  }

  const ARD = { x: 100, y: 260 };   // Arduino origin used by every Arduino example
  const LED_ON_D13 = {
    parts: [['r', 'resistor', 200, 200, 0, { ohms: 220 }], ['led', 'led', 320, 200, 0, { color: 'red' }], ['gnd', 'ground', 340, 200, 0]],
    wires: [['ard.D13', 'r.a'], ['r.b', 'led.a']]
  };

  const EXAMPLES = [
    {
      id: 'led-basic', title: 'LED + resistor', level: 'Beginner', icon: 'led',
      blurb: 'The “Hello world” of electronics. Change the resistor and watch the current change.',
      spec: {
        parts: [['bat', 'battery', 100, 200, 0, { volts: 9 }], ['r', 'resistor', 240, 100, 0, { ohms: 470 }], ['led', 'led', 340, 160, 90, { color: 'red' }]],
        wires: [['bat.+', 'r.a', { o: 'h', v: 100 }], ['r.b', 'led.a', { o: 'h', v: 340 }], ['led.k', 'bat.-', { o: 'v', v: 280 }]]
      }
    },
    {
      id: 'divider', title: 'Voltage divider', level: 'Beginner', icon: 'resistor',
      blurb: 'Two resistors share the voltage. Hover the middle node to read it, then try other values.',
      spec: {
        parts: [['bat', 'battery', 100, 200, 0, { volts: 9 }], ['r1', 'resistor', 240, 120, 90, { ohms: 1000 }], ['r2', 'resistor', 240, 200, 90, { ohms: 2000 }], ['gnd', 'ground', 240, 240, 0], ['gnd2', 'ground', 100, 240, 0]],
        wires: [['bat.+', 'r1.a', { o: 'h', v: 100 }]],
        probes: ['r1.b']
      }
    },
    {
      id: 'rc', title: 'Capacitor charging (RC)', level: 'Intermediate', icon: 'capacitor',
      blurb: 'Close the switch and watch the capacitor charge with time constant τ = R × C = 1 s.',
      spec: {
        parts: [['bat', 'battery', 100, 200, 0, { volts: 5 }], ['gnd2', 'ground', 100, 240, 0], ['sw', 'switch', 200, 100, 0, { closed: false }],
          ['r', 'resistor', 320, 100, 0, { ohms: 10000 }], ['c', 'capacitor', 400, 140, 90, { farads: 100e-6 }], ['gnd', 'ground', 400, 160, 0]],
        wires: [['bat.+', 'sw.a', { o: 'h', v: 100 }], ['sw.b', 'r.a'], ['r.b', 'c.a', { o: 'h', v: 400 }]],
        probes: ['c.a']
      }
    },
    {
      id: 'npn', title: 'Transistor as a switch', level: 'Intermediate', icon: 'npn',
      blurb: 'A tiny base current (through 10 kΩ) switches a much bigger LED current.',
      spec: {
        parts: [['bat', 'battery', 100, 220, 0, { volts: 9 }], ['gnd2', 'ground', 100, 260, 0], ['sw', 'switch', 200, 100, 0, { closed: false }],
          ['rb', 'resistor', 300, 100, 0, { ohms: 10000 }], ['q', 'npn', 400, 180, 0, { beta: 100 }], ['gnd', 'ground', 420, 200, 0],
          ['rc', 'resistor', 420, 60, 90, { ohms: 470 }], ['led', 'led', 420, 120, 90, { color: 'green' }]],
        wires: [['bat.+', 'sw.a', { o: 'h', v: 100 }], ['sw.b', 'rb.a'], ['rb.b', 'q.b', { o: 'h', v: 360 }], ['bat.+', 'rc.a', { o: 'v', v: 0 }], ['rc.b', 'led.a'], ['led.k', 'q.c']]
      }
    },
    {
      id: 'blink', title: 'Arduino: Blink', level: 'Beginner', icon: 'arduino',
      blurb: 'The classic first sketch. Pin 13 → 220 Ω → LED → GND.',
      spec: Object.assign({ parts: [['ard', 'arduino', ARD.x, ARD.y, 0]].concat(LED_ON_D13.parts), wires: LED_ON_D13.wires }),
      sketch: `// Blink — turn the LED on pin 13 on and off every second
const int LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);   // pin 13 is an output
}

void loop() {
  digitalWrite(LED_PIN, HIGH); // LED on
  delay(1000);                 // wait 1 second
  digitalWrite(LED_PIN, LOW);  // LED off
  delay(1000);
}
`
    },
    {
      id: 'button', title: 'Arduino: Button + LED', level: 'Beginner', icon: 'button',
      blurb: 'Read a push button with INPUT_PULLUP and light the LED while it is pressed.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0]].concat(LED_ON_D13.parts, [['btn', 'button', 440, 200, 0], ['gnd3', 'ground', 480, 200, 0]]),
        wires: LED_ON_D13.wires.concat([['ard.D2', 'btn.a']])
      },
      sketch: `// Button + LED
// The button connects pin 2 to GND. INPUT_PULLUP keeps the pin HIGH
// until the button is pressed, which pulls it LOW.
const int BUTTON = 2;
const int LED = 13;

void setup() {
  pinMode(BUTTON, INPUT_PULLUP);
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  bool pressed = (digitalRead(BUTTON) == LOW);
  digitalWrite(LED, pressed);
  if (pressed) {
    Serial.println("Button pressed!");
    delay(200);
  }
}
`
    },
    {
      id: 'toggle', title: 'Arduino: One-button toggle', level: 'Intermediate', icon: 'button',
      blurb: 'Press once to turn the LED on, press again to turn it off. Uses state, edge detection and debouncing.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0]].concat(LED_ON_D13.parts, [['btn', 'button', 440, 200, 0], ['gnd3', 'ground', 480, 200, 0]]),
        wires: LED_ON_D13.wires.concat([['ard.D2', 'btn.a']])
      },
      sketch: `// One-button toggle with debounce
// Each press flips the LED. We react to the *moment* the button goes
// from released to pressed (an "edge"), not to it being held down.
const int BUTTON = 2;
const int LED = 13;
const unsigned long DEBOUNCE_MS = 20;

bool ledOn = false;            // remembers the LED state between loops
int lastReading = HIGH;        // last raw reading (HIGH = released)
int stableState = HIGH;        // debounced state
unsigned long lastChange = 0;  // when the raw reading last changed

void setup() {
  pinMode(BUTTON, INPUT_PULLUP);
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int reading = digitalRead(BUTTON);

  if (reading != lastReading) {      // something changed (maybe just bounce)
    lastChange = millis();
    lastReading = reading;
  }

  // only trust the reading once it has stayed the same for DEBOUNCE_MS
  if (millis() - lastChange > DEBOUNCE_MS && reading != stableState) {
    stableState = reading;
    if (stableState == LOW) {        // pressed: this is the edge we want
      ledOn = !ledOn;                // flip the stored state
      digitalWrite(LED, ledOn);
      Serial.print("LED is ");
      Serial.println(ledOn ? "ON" : "OFF");
    }
  }
}
`
    },
    {
      id: 'hysteresis', title: 'Arduino: Night light without flicker', level: 'Intermediate', icon: 'ldr',
      blurb: 'Two thresholds (hysteresis) stop the lamp flickering when the light level hovers near the limit.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0]].concat(LED_ON_D13.parts, [
          ['ldr', 'ldr', 320, 540, 90, { light: 80 }], ['r10', 'resistor', 320, 620, 90, { ohms: 10000 }], ['gnd2', 'ground', 320, 660, 0]]),
        wires: LED_ON_D13.wires.concat([['ldr.a', 'ard.5V', { o: 'v', v: 480 }], ['r10.a', 'ard.A5', { o: 'h', v: 420 }]])
      },
      sketch: `// Night light with hysteresis (a "Schmitt trigger" in software)
// With ONE threshold the lamp flickers when the light sits right at the limit.
// With TWO thresholds it switches on when it is clearly dark and off only
// when it is clearly bright.
const int SENSOR = A5;
const int LED = 13;
const int ON_BELOW = 350;    // turn the lamp ON when light falls below this
const int OFF_ABOVE = 450;   // turn it OFF when light rises above this

bool lampOn = false;         // remembered between loops

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int light = analogRead(SENSOR);

  if (!lampOn && light < ON_BELOW) {
    lampOn = true;
  } else if (lampOn && light > OFF_ABOVE) {
    lampOn = false;
  }                          // between the thresholds: keep the old state

  digitalWrite(LED, lampOn);
  Serial.print("light = ");
  Serial.print(light);
  Serial.println(lampOn ? "  lamp ON" : "  lamp OFF");
  delay(200);
}
`
    },
    {
      id: 'driver', title: 'Arduino: Transistor driver + separate supply', level: 'Advanced', icon: 'npn',
      blurb: 'A pin controls a buzzer through a transistor, powered from its own 5 V supply with a common ground.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['rb', 'resistor', 300, 200, 0, { ohms: 1000 }], ['q', 'npn', 380, 200, 0, { beta: 100 }], ['gq', 'ground', 400, 220, 0],
          ['bz', 'buzzer', 400, 160, 90, { kind: 'active' }], ['bat', 'battery', 480, 160, 0, { volts: 5 }], ['gb', 'ground', 480, 200, 0]],
        wires: [['ard.D8', 'rb.a'], ['rb.b', 'q.b'], ['bz.+', 'bat.+', { o: 'h', v: 440 }]]
      },
      sketch: `// Drive a load through a transistor
// An Arduino pin can only give ~20 mA. The buzzer (and later a motor or
// relay) draws more, so the pin drives a transistor and the transistor
// switches the load from a SEPARATE supply. All grounds are joined.
const int DRIVER_PIN = 8;    // pin -> 1k resistor -> transistor base

void setup() {
  pinMode(DRIVER_PIN, OUTPUT);
}

void loop() {
  digitalWrite(DRIVER_PIN, HIGH);   // base current flows: transistor ON
  delay(200);
  digitalWrite(DRIVER_PIN, LOW);    // no base current: transistor OFF
  delay(800);
}
`
    },
    {
      id: 'rcfilter', title: 'RC low-pass filter (AC)', level: 'Advanced', icon: 'acsource', scope: '50',
      blurb: 'A sine wave goes in; the capacitor removes the fast changes. Change the frequency and compare the traces.',
      spec: {
        parts: [['ac', 'acsource', 100, 200, 0, { amp: 5, freq: 100, shape: 'sine' }], ['gnd', 'ground', 100, 240, 0], ['r', 'resistor', 200, 160, 0, { ohms: 1600 }],
          ['c', 'capacitor', 280, 200, 90, { farads: 1e-6 }], ['gc', 'ground', 280, 220, 0]],
        wires: [['ac.+', 'r.a'], ['r.b', 'c.a', { o: 'h', v: 280 }]],
        probes: ['ac.+', 'c.a']
      }
    },
    {
      id: 'rl', title: 'Inductor: RL circuit (AC square wave)', level: 'Advanced', icon: 'inductor', scope: '50',
      blurb: 'Current cannot jump through an inductor: it ramps with time constant τ = L ÷ R. Watch the voltage across the resistor.',
      spec: {
        parts: [['ac', 'acsource', 100, 200, 0, { amp: 5, freq: 100, shape: 'square' }], ['gnd', 'ground', 100, 240, 0], ['l', 'inductor', 240, 160, 0, { henries: 0.1 }],
          ['r', 'resistor', 360, 160, 0, { ohms: 100 }], ['gr', 'ground', 400, 160, 0]],
        wires: [['ac.+', 'l.a'], ['l.b', 'r.a']],
        probes: ['ac.+', 'r.a']
      }
    },
    {
      id: 'motor-pwm', title: 'Arduino: Motor speed with PWM', level: 'Advanced', icon: 'motor',
      blurb: 'A transistor lets a pin control a DC motor on its own 5 V supply. PWM ramps the speed up and down. The diode protects against voltage spikes.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['rb', 'resistor', 280, 200, 0, { ohms: 1000 }], ['q', 'npn', 360, 200, 0, { beta: 100 }], ['gq', 'ground', 380, 220, 0],
          ['m', 'motor', 380, 140, 90], ['d', 'diode', 420, 140, 270], ['bat', 'battery', 460, 140, 0, { volts: 5 }], ['gb', 'ground', 460, 180, 0]],
        wires: [['ard.D9', 'rb.a'], ['rb.b', 'q.b'], ['bat.+', 'm.a'], ['d.k', 'm.a', { o: 'h', v: 420 }], ['d.a', 'q.c', { o: 'h', v: 420 }]],
        probes: ['m.b']
      },
      sketch: `// Motor speed control
// Pin 9 (PWM) -> 1k resistor -> transistor base. The motor runs from its own
// 5 V battery through the transistor. The diode across the motor absorbs the
// voltage spike a real motor makes when it is switched off (flyback diode).
const int MOTOR_PIN = 9;

void setup() {
  pinMode(MOTOR_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  for (int speed = 0; speed <= 255; speed += 5) {   // speed up
    analogWrite(MOTOR_PIN, speed);
    delay(60);
  }
  Serial.println("full speed");
  delay(1000);
  for (int speed = 255; speed >= 0; speed -= 5) {   // slow down
    analogWrite(MOTOR_PIN, speed);
    delay(60);
  }
  delay(1000);
}
`
    },
    {
      id: 'servo-sweep', title: 'Arduino: Servo sweep', level: 'Intermediate', icon: 'servo', scope: '50',
      blurb: 'The Servo library turns an angle into a 1–2 ms pulse every 20 ms. Watch the pulse on the Scope while the arm sweeps.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['sv', 'servo', 360, 180, 0], ['gs', 'ground', 320, 160, 90], ['bat', 'battery', 200, 180, 0, { volts: 5 }], ['gb', 'ground', 200, 220, 0]],
        wires: [['ard.D9', 'sv.sig', { o: 'h', v: 240 }], ['bat.+', 'sv.vcc', { o: 'h', v: 280 }]],
        probes: ['ard.D9']
      },
      sketch: `#include <Servo.h>

Servo myServo;            // an object that controls one servo

void setup() {
  myServo.attach(9);      // the orange wire is on pin 9
}

void loop() {
  for (int angle = 0; angle <= 180; angle += 2) {   // sweep one way
    myServo.write(angle);
    delay(15);                                      // give the arm time to move
  }
  for (int angle = 180; angle >= 0; angle -= 2) {   // and back
    myServo.write(angle);
    delay(15);
  }
}
`
    },
    {
      id: 'servo-pot', title: 'Arduino: Knob-controlled servo', level: 'Intermediate', icon: 'servo',
      blurb: 'Turn the potentiometer and the servo follows: analogRead() 0–1023 is mapped to 0–180°.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['sv', 'servo', 360, 180, 0], ['gs', 'ground', 320, 160, 90], ['bat', 'battery', 200, 180, 0, { volts: 5 }], ['gb', 'ground', 200, 220, 0],
          ['pot', 'pot', 380, 560, 180, { ohms: 10000, pos: 50 }], ['gp', 'ground', 420, 560, 0]],
        wires: [['ard.D9', 'sv.sig', { o: 'h', v: 240 }], ['bat.+', 'sv.vcc', { o: 'h', v: 280 }], ['pot.w', 'ard.A0', { o: 'v', v: 490 }], ['pot.b', 'ard.5V', { o: 'h', v: 220 }]]
      },
      sketch: `#include <Servo.h>

Servo myServo;
const int KNOB = A0;

void setup() {
  myServo.attach(9);
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(KNOB);                  // 0 .. 1023
  int angle = map(raw, 0, 1023, 0, 180);       // 0 .. 180 degrees
  myServo.write(angle);
  Serial.print("angle = ");
  Serial.println(angle);
  delay(20);
}
`
    },
    {
      id: 'lcd-hello', title: 'Arduino: Text on an LCD', level: 'Intermediate', icon: 'lcd16x2',
      blurb: 'The classic 16×2 character display with the LiquidCrystal library. RS, E and D4–D7 are wired to pins 12, 11, 5, 4, 3, 2.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['lcd', 'lcd16x2', 300, 100, 0]],
        wires: [['ard.D12', 'lcd.RS', { o: 'v', v: 220 }], ['ard.D11', 'lcd.E', { o: 'v', v: 230 }], ['ard.D5', 'lcd.D4', { o: 'v', v: 260 }], ['ard.D4', 'lcd.D5', { o: 'v', v: 250 }],
          ['ard.D3', 'lcd.D6', { o: 'v', v: 240 }], ['ard.D2', 'lcd.D7', { o: 'v', v: 230 }]]
      },
      sketch: `#include <LiquidCrystal.h>

// LiquidCrystal(rs, enable, d4, d5, d6, d7)
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

void setup() {
  lcd.begin(16, 2);              // 16 columns, 2 rows: do not forget this!
  lcd.print("Hello, Smart21!");   // first row
}

void loop() {
  lcd.setCursor(0, 1);           // column 0, row 1 (the second row)
  lcd.print(millis() / 1000);    // seconds since start
  lcd.print(" s running");
}
`
    },
    {
      id: 'lcd-volts', title: 'Arduino: Voltmeter on an LCD', level: 'Advanced', icon: 'lcd16x2',
      blurb: 'Read a potentiometer with analogRead and show the voltage with two decimals.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['lcd', 'lcd16x2', 300, 100, 0], ['pot', 'pot', 380, 560, 180, { ohms: 10000, pos: 40 }], ['gp', 'ground', 420, 560, 0]],
        wires: [['ard.D12', 'lcd.RS', { o: 'v', v: 220 }], ['ard.D11', 'lcd.E', { o: 'v', v: 230 }], ['ard.D5', 'lcd.D4', { o: 'v', v: 260 }], ['ard.D4', 'lcd.D5', { o: 'v', v: 250 }],
          ['ard.D3', 'lcd.D6', { o: 'v', v: 240 }], ['ard.D2', 'lcd.D7', { o: 'v', v: 230 }], ['pot.w', 'ard.A0', { o: 'v', v: 490 }], ['pot.b', 'ard.5V', { o: 'h', v: 220 }]]
      },
      sketch: `#include <LiquidCrystal.h>

LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

void setup() {
  lcd.begin(16, 2);
  lcd.print("Voltage on A0:");
}

void loop() {
  int raw = analogRead(A0);                 // 0 .. 1023
  float volts = raw * 5.0 / 1023.0;         // convert to volts
  lcd.setCursor(0, 1);
  lcd.print(volts, 2);                      // 2 decimal places
  lcd.print(" V    ");                      // spaces erase old characters
  delay(100);
}
`
    },
    {
      id: 'sevenseg', title: 'Arduino: 7-segment counter', level: 'Intermediate', icon: 'sevenseg',
      blurb: 'Eight pins light the segments a–g and dp. A table of bit patterns turns each digit into segments.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['sg', 'sevenseg', 300, 100, 0], ['gc', 'ground', 380, 164, 270]],
        wires: [['ard.D9', 'sg.a', { o: 'v', v: 270 }], ['ard.D8', 'sg.b', { o: 'v', v: 262 }], ['ard.D7', 'sg.c', { o: 'v', v: 254 }], ['ard.D6', 'sg.d', { o: 'v', v: 246 }],
          ['ard.D5', 'sg.e', { o: 'v', v: 238 }], ['ard.D4', 'sg.f', { o: 'v', v: 230 }], ['ard.D3', 'sg.g', { o: 'v', v: 222 }], ['ard.D2', 'sg.dp', { o: 'v', v: 214 }]]
      },
      sketch: `// 7-segment counter (common cathode)
// Segment pins in the order a, b, c, d, e, f, g, dp
const int segPin[] = {9, 8, 7, 6, 5, 4, 3, 2};

// One byte per digit. Bit 0 = segment a ... bit 6 = segment g.
const byte digits[10] = {
  0x3F, 0x06, 0x5B, 0x4F, 0x66,    // 0 1 2 3 4
  0x6D, 0x7D, 0x07, 0x7F, 0x6F     // 5 6 7 8 9
};

void showDigit(int n) {
  for (int i = 0; i < 8; i++) {
    int on = (digits[n] >> i) & 1;     // pick bit i of the pattern
    digitalWrite(segPin[i], on);
  }
}

void setup() {
  for (int i = 0; i < 8; i++) {
    pinMode(segPin[i], OUTPUT);
  }
}

void loop() {
  for (int n = 0; n <= 9; n++) {
    showDigit(n);
    delay(700);
  }
}
`
    },
    {
      id: 'meters', title: 'Voltmeter & ammeter', level: 'Beginner', icon: 'voltmeter',
      blurb: 'The ammeter sits IN the loop (series); the voltmeter goes ACROSS a part (parallel). Predict the readings first.',
      spec: {
        parts: [['bat', 'battery', 100, 240, 0, { volts: 9 }], ['gb', 'ground', 100, 280, 0], ['am', 'ammeter', 180, 200, 0], ['r1', 'resistor', 280, 240, 90, { ohms: 1000 }],
          ['r2', 'resistor', 280, 320, 90, { ohms: 2000 }], ['g2', 'ground', 280, 360, 0], ['vm', 'voltmeter', 380, 320, 90], ['g3', 'ground', 380, 360, 0]],
        wires: [['bat.+', 'am.a'], ['am.b', 'r1.a'], ['r2.a', 'vm.a']]
      }
    },
    {
      id: 'temp-lcd', title: 'Arduino: Thermometer (TMP36 + LCD)', level: 'Intermediate', icon: 'tmp36',
      blurb: 'The TMP36 outputs 0.5 V + 10 mV per °C. Convert the analogRead value back to degrees and show it on the LCD. Drag the temperature slider.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['lcd', 'lcd16x2', 300, 100, 0], ['t', 'tmp36', 320, 540, 180, { temp: 25 }], ['vs', 'vcc', 340, 500, 0], ['gs', 'ground', 300, 500, 180]],
        wires: [['ard.D12', 'lcd.RS', { o: 'v', v: 220 }], ['ard.D11', 'lcd.E', { o: 'v', v: 230 }], ['ard.D5', 'lcd.D4', { o: 'v', v: 260 }], ['ard.D4', 'lcd.D5', { o: 'v', v: 250 }], ['ard.D3', 'lcd.D6', { o: 'v', v: 240 }], ['ard.D2', 'lcd.D7', { o: 'v', v: 230 }], ['ard.A0', 't.out']]
      },
      sketch: `#include <LiquidCrystal.h>

LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

void setup() {
  lcd.begin(16, 2);
  lcd.print("Temperature:");
}

void loop() {
  int raw = analogRead(A0);                  // 0 .. 1023
  float volts = raw * 5.0 / 1023.0;          // back to volts
  float tempC = (volts - 0.5) * 100.0;       // TMP36: 0.5 V offset, 10 mV per degree
  lcd.setCursor(0, 1);
  lcd.print(tempC, 1);
  lcd.print(" C    ");
  delay(200);
}
`
    },
    {
      id: 'ultrasonic', title: 'Arduino: Distance with HC-SR04', level: 'Advanced', icon: 'hcsr04', scope: '200',
      blurb: 'A 10 µs pulse on TRIG starts a measurement; ECHO stays HIGH for 58 µs per centimetre. pulseIn() measures it. Drag the distance slider.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['us', 'hcsr04', 250, 180, 0, { distance: 50 }], ['vs', 'vcc', 210, 220, 270], ['gs', 'ground', 270, 220, 270]],
        wires: [['ard.D10', 'us.trig', { o: 'v', v: 240 }], ['ard.D9', 'us.echo', { o: 'v', v: 250 }]],
        probes: ['ard.D10', 'ard.D9']
      },
      sketch: `// Distance with an ultrasonic sensor
const int TRIG = 10;
const int ECHO = 9;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
}

long readCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);          // a 10 microsecond pulse starts the measurement
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long us = pulseIn(ECHO, HIGH, 30000);   // length of the echo pulse in microseconds
  return us / 58;                         // sound travels 1 cm there and back in 58 us
}

void loop() {
  long cm = readCm();
  if (cm == 0) {
    Serial.println("no echo");
  } else {
    Serial.print("Distance: ");
    Serial.print(cm);
    Serial.println(" cm");
  }
  delay(300);
}
`
    },
    {
      id: '555-blink', title: '555 timer: astable blinker', level: 'Advanced', icon: 'ic555', scope: '1000',
      blurb: 'No Arduino needed: R1, R2 and C set the blink rate. f ≈ 1.44 ÷ ((R1 + 2·R2)·C) ≈ 6.9 Hz. Watch the capacitor voltage ramp between ⅓ and ⅔ of 5 V.',
      spec: {
        parts: [['ic', 'ic555', 300, 200, 0], ['g1', 'ground', 260, 160, 90], ['v1', 'vcc', 260, 220, 270], ['v2', 'vcc', 340, 160, 90],
          ['v3', 'vcc', 400, 60, 0], ['r1', 'resistor', 400, 100, 90, { ohms: 1000 }], ['r2', 'resistor', 400, 180, 90, { ohms: 10000 }], ['c', 'capacitor', 400, 240, 90, { farads: 10e-6 }], ['gc', 'ground', 400, 260, 0],
          ['r3', 'resistor', 200, 200, 0, { ohms: 330 }], ['led', 'led', 120, 200, 180, { color: 'green' }], ['gl', 'ground', 100, 200, 0]],
        wires: [['r1.b', 'ic.DIS', { o: 'h', v: 370 }], ['r2.b', 'ic.THR', { o: 'h', v: 370 }], ['ic.TRIG', 'ic.THR', { o: 'h', v: 300 }], ['ic.OUT', 'r3.b'], ['r3.a', 'led.a']],
        probes: ['c.a', 'ic.OUT']
      }
    },
    {
      id: 'logic-gate', title: 'Logic gate with two switches', level: 'Beginner', icon: 'gate',
      blurb: 'Two switches feed an AND gate. Flip them and fill in the truth table, then change the gate type in the inspector (OR, XOR, NAND…).',
      spec: {
        parts: [['v1', 'vcc', 120, 100, 0], ['s1', 'switch', 160, 100, 0, { closed: false }], ['p1', 'resistor', 200, 140, 90, { ohms: 10000 }], ['g1', 'ground', 200, 180, 0],
          ['v2', 'vcc', 120, 220, 0], ['s2', 'switch', 160, 220, 0, { closed: false }], ['p2', 'resistor', 200, 260, 90, { ohms: 10000 }], ['g2', 'ground', 200, 300, 0],
          ['gt', 'gate', 320, 160, 0, { type: 'and' }], ['ro', 'resistor', 420, 160, 0, { ohms: 330 }], ['led', 'led', 520, 160, 0, { color: 'yellow' }], ['gl', 'ground', 540, 160, 0]],
        wires: [['s1.b', 'gt.A', { o: 'h', v: 240 }], ['s2.b', 'gt.B', { o: 'h', v: 240 }], ['gt.Y', 'ro.a'], ['ro.b', 'led.a']]
      }
    },
    {
      id: 'fade', title: 'Arduino: Knob-controlled LED', level: 'Intermediate', icon: 'pot',
      blurb: 'Turn the potentiometer: analogRead() sets the LED brightness through PWM (analogWrite).',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['r', 'resistor', 280, 200, 0, { ohms: 220 }], ['led', 'led', 400, 200, 0, { color: 'yellow' }], ['gnd', 'ground', 420, 200, 0],
          ['pot', 'pot', 380, 560, 180, { ohms: 10000, pos: 35 }], ['gnd2', 'ground', 420, 560, 0]],
        wires: [['ard.D9', 'r.a'], ['r.b', 'led.a'], ['pot.w', 'ard.A0', { o: 'v', v: 490 }], ['pot.b', 'ard.5V', { o: 'h', v: 220 }]]
      },
      sketch: `// Knob-controlled LED
// The potentiometer wiper is on A0. analogRead gives 0-1023,
// analogWrite needs 0-255, so we scale the number with map().
const int KNOB = A0;
const int LED = 9;      // pin 9 supports PWM (marked ~ on the board)

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(KNOB);          // 0 .. 1023
  int brightness = map(raw, 0, 1023, 0, 255);
  analogWrite(LED, brightness);
  Serial.print("raw=");
  Serial.print(raw);
  Serial.print("  brightness=");
  Serial.println(brightness);
  delay(100);
}
`
    },
    {
      id: 'ldr', title: 'Arduino: Night light (LDR)', level: 'Intermediate', icon: 'ldr',
      blurb: 'A light sensor + 10 kΩ resistor make a voltage divider. Darkness turns the LED on.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0]].concat(LED_ON_D13.parts, [
          ['ldr', 'ldr', 320, 540, 90, { light: 80 }], ['r10', 'resistor', 320, 620, 90, { ohms: 10000 }], ['gnd2', 'ground', 320, 660, 0]]),
        wires: LED_ON_D13.wires.concat([['ldr.a', 'ard.5V', { o: 'v', v: 480 }], ['r10.a', 'ard.A5', { o: 'h', v: 420 }]])
      },
      sketch: `// Night light
// 5V -> LDR -> A5 -> 10k resistor -> GND.
// More light = lower LDR resistance = higher voltage on A5.
const int SENSOR = A5;
const int LED = 13;
const int DARK_LEVEL = 400;

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int light = analogRead(SENSOR);
  Serial.print("light = ");
  Serial.println(light);
  if (light < DARK_LEVEL) {
    digitalWrite(LED, HIGH);   // it is dark: lamp on
  } else {
    digitalWrite(LED, LOW);
  }
  delay(200);
}
`
    },
    {
      id: 'traffic', title: 'Arduino: Traffic light', level: 'Beginner', icon: 'led',
      blurb: 'Three LEDs and a repeating sequence.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0],
          ['r1', 'resistor', 180, 220, 90, { ohms: 220 }], ['l1', 'led', 180, 140, 270, { color: 'red' }], ['g1', 'ground', 180, 120, 180],
          ['r2', 'resistor', 220, 220, 90, { ohms: 220 }], ['l2', 'led', 220, 140, 270, { color: 'yellow' }], ['g2', 'ground', 220, 120, 180],
          ['r3', 'resistor', 260, 220, 90, { ohms: 220 }], ['l3', 'led', 260, 140, 270, { color: 'green' }], ['g3', 'ground', 260, 120, 180]],
        wires: [['ard.D12', 'r1.b'], ['r1.a', 'l1.a'], ['ard.D10', 'r2.b'], ['r2.a', 'l2.a'], ['ard.D8', 'r3.b'], ['r3.a', 'l3.a']]
      },
      sketch: `// Traffic light: red -> green -> yellow -> red ...
const int RED = 12;
const int YELLOW = 10;
const int GREEN = 8;

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
}

void allOff() {
  digitalWrite(RED, LOW);
  digitalWrite(YELLOW, LOW);
  digitalWrite(GREEN, LOW);
}

void loop() {
  allOff();  digitalWrite(RED, HIGH);    delay(3000);
  allOff();  digitalWrite(GREEN, HIGH);  delay(3000);
  allOff();  digitalWrite(YELLOW, HIGH); delay(1000);
}
`
    },
    {
      id: 'melody', title: 'Arduino: Play a melody', level: 'Intermediate', icon: 'buzzer',
      blurb: 'tone() makes a passive buzzer play notes. Turn the sound on in the toolbar.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['bz', 'buzzer', 300, 200, 0, { kind: 'passive' }], ['gnd', 'ground', 320, 200, 0]],
        wires: [['ard.D8', 'bz.+', { o: 'v', v: 240 }]]
      },
      sketch: `// Play a scale on a passive buzzer connected to pin 8
const int BUZZER = 8;
int notes[] = {262, 294, 330, 349, 392, 440, 494, 523};   // C4 ... C5 in Hz

void setup() {
  pinMode(BUZZER, OUTPUT);
}

void loop() {
  for (int i = 0; i < 8; i++) {
    tone(BUZZER, notes[i]);
    delay(300);
  }
  noTone(BUZZER);
  delay(1500);
}
`
    }
    ,
    /* ---------------- round 2 ---------------- */
    {
      id: 'opamp-gain', title: 'Op-amp: non-inverting amplifier', level: 'Advanced', icon: 'opamp', scope: '200',
      blurb: 'Gain = 1 + R2 ÷ R1 = 2. Turn the knob (mouse wheel over the pot): the output follows 2× the input until it hits the supply limit (about 7.5 V) and clips.',
      spec: {
        parts: [['bat', 'battery', 80, 200, 0, { volts: 9 }], ['gb', 'ground', 80, 240, 0],
          ['p', 'pot', 200, 200, 90, { ohms: 10000, pos: 80 }], ['gp', 'ground', 200, 240, 0],
          ['oa', 'opamp', 320, 200, 0, { rail: 'lm358' }], ['gv', 'ground', 320, 240, 0],
          ['r1', 'resistor', 280, 290, 90, { ohms: 10000 }], ['g1', 'ground', 280, 330, 0],
          ['r2', 'resistor', 340, 120, 0, { ohms: 10000 }]],
        wires: [['bat.+', 'p.a', { o: 'h', v: 120 }], ['bat.+', 'oa.vp', { o: 'h', v: 120 }], ['p.w', 'oa.p'], ['oa.n', 'r1.a'],
          ['oa.o', 'r2.b', { o: 'v', v: 400 }], ['r2.a', 'oa.n', { o: 'v', v: 250 }]],
        probes: ['p.w', 'oa.o']
      }
    },
    {
      id: 'opamp-comparator', title: 'Op-amp: dark detector (comparator)', level: 'Advanced', icon: 'opamp',
      blurb: 'With no feedback the op-amp is a comparator: the output swings to a rail when IN+ is above IN−. The LED lights when the LDR is darker than the knob setting.',
      spec: {
        parts: [['bat', 'battery', 80, 200, 0, { volts: 9 }], ['gb', 'ground', 80, 240, 0],
          ['ldr', 'ldr', 200, 160, 90, { light: 70 }], ['rf', 'resistor', 200, 240, 90, { ohms: 10000 }], ['gf', 'ground', 200, 280, 0],
          ['p', 'pot', 280, 200, 90, { ohms: 10000, pos: 50 }], ['gp', 'ground', 280, 240, 0],
          ['oa', 'opamp', 400, 200, 0, { rail: 'lm358' }], ['gv', 'ground', 400, 240, 0],
          ['r', 'resistor', 500, 200, 0, { ohms: 470 }], ['led', 'led', 580, 200, 0, { color: 'yellow' }], ['gl', 'ground', 600, 200, 0]],
        wires: [['bat.+', 'ldr.a', { o: 'h', v: 100 }], ['bat.+', 'p.a', { o: 'h', v: 100 }], ['bat.+', 'oa.vp', { o: 'h', v: 100 }],
          ['ldr.b', 'oa.n'], ['p.w', 'oa.p'], ['oa.o', 'r.a'], ['r.b', 'led.a']],
        probes: ['ldr.b', 'oa.o']
      }
    },
    {
      id: 'pnp-highside', title: 'Arduino: PNP high-side switch', level: 'Advanced', icon: 'pnp',
      blurb: 'A PNP transistor switches the + side of the load. It turns ON when the pin goes LOW (base below the emitter), so the LED blinks “backwards”.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['rb', 'resistor', 260, 220, 90, { ohms: 10000 }], ['q', 'pnp', 320, 180, 0, { beta: 100 }],
          ['vs', 'vcc', 340, 200, 180, { volts: 5 }], ['gs', 'ground', 440, 200, 0], ['rl', 'resistor', 340, 100, 90, { ohms: 330 }],
          ['led', 'led', 340, 20, 270, { color: 'green' }], ['gl', 'ground', 340, 0, 180]],
        wires: [['ard.D8', 'rb.b'], ['rb.a', 'q.b'], ['q.c', 'rl.b'], ['rl.a', 'led.a']]
      },
      sketch: `// PNP high-side switch: LOW turns the transistor (and the LED) ON
const int BASE = 8;

void setup() {
  pinMode(BASE, OUTPUT);
}

void loop() {
  digitalWrite(BASE, LOW);    // base below emitter: ON
  delay(500);
  digitalWrite(BASE, HIGH);   // base = emitter voltage (5 V): OFF
  delay(500);
}
`
    },
    {
      id: 'mosfet-motor', title: 'Arduino: MOSFET motor driver', level: 'Advanced', icon: 'mosfet', scope: '50',
      blurb: 'A logic-level N-MOSFET switches the motor with almost no gate current. PWM sets the speed. Try changing the model to “Standard power (IRF540)”: 5 V is not enough to turn it fully on!',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['rg', 'resistor', 240, 220, 90, { ohms: 220 }], ['rp', 'resistor', 200, 220, 90, { ohms: 10000 }], ['gp', 'ground', 200, 260, 0],
          ['q', 'mosfet', 300, 180, 0, { channel: 'n', model: 'logic' }], ['gs', 'ground', 320, 200, 0],
          ['m', 'motor', 320, 100, 90], ['d', 'diode', 360, 100, 270], ['bat', 'battery', 400, 100, 0, { volts: 5 }], ['gb', 'ground', 400, 140, 0]],
        wires: [['ard.D9', 'rg.b'], ['rg.a', 'q.g'], ['rp.a', 'rg.a'], ['m.b', 'q.d'], ['bat.+', 'm.a', { o: 'h', v: 40 }], ['d.k', 'm.a'], ['d.a', 'm.b']],
        probes: ['q.d']
      },
      sketch: `// MOSFET motor speed with PWM
const int GATE = 9;

void setup() {
  pinMode(GATE, OUTPUT);
}

void loop() {
  for (int speed = 0; speed <= 255; speed += 5) {
    analogWrite(GATE, speed);
    delay(60);
  }
  delay(500);
  analogWrite(GATE, 0);
  delay(1000);
}
`
    },
    {
      id: 'zener-reg', title: 'Zener diode voltage regulator', level: 'Intermediate', icon: 'zener',
      blurb: 'The Zener sits in reverse across the load and holds about 5.1 V while the series resistor soaks up the rest. Change the battery from 12 V to 9 V or 15 V: the output barely moves.',
      spec: {
        parts: [['bat', 'battery', 80, 200, 0, { volts: 12 }], ['gb', 'ground', 80, 240, 0], ['r', 'resistor', 200, 100, 0, { ohms: 470 }],
          ['z', 'zener', 240, 160, 270, { vz: 5.1 }], ['gz', 'ground', 240, 180, 0], ['rl', 'resistor', 320, 150, 90, { ohms: 1000 }], ['gl', 'ground', 320, 190, 0]],
        wires: [['bat.+', 'r.a', { o: 'h', v: 100 }], ['r.b', 'z.k'], ['r.b', 'rl.a']],
        probes: ['z.k']
      }
    },
    {
      id: 'ntc-thermo', title: 'Arduino: Thermistor thermometer', level: 'Advanced', icon: 'ntc',
      blurb: 'A 10 kΩ NTC in a voltage divider. The sketch converts the reading to resistance, then to °C with the β equation. Drag the temperature slider; the board LED lights above 30 °C.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['rf', 'resistor', 400, 540, 90, { ohms: 10000 }], ['t', 'ntc', 400, 620, 90, { r25: 10000, beta: 3950, temp: 25 }],
          ['vs', 'vcc', 400, 500, 0, { volts: 5 }], ['gt', 'ground', 400, 660, 0]],
        wires: [['ard.A0', 'rf.b', { o: 'h', v: 520 }]]
      },
      sketch: `// Thermistor thermometer (NTC 10k, beta = 3950)
const float BETA = 3950.0;
const float R0 = 10000.0;        // resistance at 25 C
const float T0 = 298.15;         // 25 C in kelvin
const float R_FIXED = 10000.0;

void setup() {
  Serial.begin(9600);
  pinMode(13, OUTPUT);
}

void loop() {
  int raw = analogRead(A0);
  if (raw > 0 && raw < 1023) {
    float rNtc = R_FIXED * raw / (1023.0 - raw);          // divider: NTC is the bottom resistor
    float kelvin = 1.0 / (1.0 / T0 + log(rNtc / R0) / BETA);
    float celsius = kelvin - 273.15;
    Serial.print(celsius, 1);
    Serial.println(" C");
    digitalWrite(13, celsius > 30.0);
  }
  delay(500);
}
`
    },
    {
      id: 'relay-lamp', title: 'Arduino: Relay with flyback diode', level: 'Advanced', icon: 'relay',
      blurb: 'A transistor drives the relay coil from 5 V; the relay then switches a separate 9 V lamp circuit. The diode across the coil absorbs the spike when the coil turns off. Delete it and watch the warning.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['rb', 'resistor', 300, 220, 90, { ohms: 1000 }], ['q', 'npn', 340, 160, 0, { beta: 100 }], ['gq', 'ground', 360, 180, 0],
          ['rly', 'relay', 440, 120, 0, { volts: 5 }], ['vs', 'vcc', 400, 100, 0, { volts: 5 }], ['d', 'diode', 380, 120, 270],
          ['bat', 'battery', 600, 140, 0, { volts: 9 }], ['gb', 'ground', 600, 180, 0],
          ['r', 'resistor', 540, 60, 0, { ohms: 470 }], ['led', 'led', 620, 60, 0, { color: 'red' }], ['gl', 'ground', 640, 60, 0]],
        wires: [['ard.D7', 'rb.b'], ['rb.a', 'q.b'], ['q.c', 'd.a'], ['d.a', 'rly.c2'], ['d.k', 'rly.c1'], ['rly.com', 'bat.+', { o: 'v', v: 520 }], ['rly.no', 'r.a'], ['r.b', 'led.a']]
      },
      sketch: `// Switch a lamp circuit through a relay
const int RELAY = 7;

void setup() {
  Serial.begin(9600);
  pinMode(RELAY, OUTPUT);
}

void loop() {
  digitalWrite(RELAY, HIGH);
  Serial.println("Relay ON");
  delay(2000);
  digitalWrite(RELAY, LOW);
  Serial.println("Relay OFF");
  delay(2000);
}
`
    },
    {
      id: 'rgb-mixer', title: 'Arduino: RGB colour cycle', level: 'Intermediate', icon: 'rgbled',
      blurb: 'analogWrite() on three pins mixes any colour. The sketch stores colours in an array of structs and steps through them.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['rgb', 'rgbled', 260, 140, 270, { common: 'cathode' }], ['gc', 'ground', 260, 120, 180],
          ['r1', 'resistor', 200, 220, 90, { ohms: 220 }], ['r2', 'resistor', 240, 220, 90, { ohms: 220 }], ['r3', 'resistor', 320, 220, 90, { ohms: 220 }]],
        wires: [['ard.D11', 'r1.b'], ['ard.D9', 'r2.b'], ['ard.D6', 'r3.b'], ['r1.a', 'rgb.r'], ['r2.a', 'rgb.g'], ['r3.a', 'rgb.b']]
      },
      sketch: `// RGB colour cycle using a struct and an array of colours
struct Color {
  byte r, g, b;
};

Color palette[] = {
  {255, 0, 0}, {255, 120, 0}, {255, 255, 0}, {0, 255, 0},
  {0, 255, 255}, {0, 0, 255}, {160, 0, 255}, {255, 255, 255}
};

const int RED_PIN = 11, GREEN_PIN = 9, BLUE_PIN = 6;

void show(Color c) {
  analogWrite(RED_PIN, c.r);
  analogWrite(GREEN_PIN, c.g);
  analogWrite(BLUE_PIN, c.b);
}

void setup() {
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);
}

void loop() {
  for (int i = 0; i < 8; i++) {
    show(palette[i]);
    delay(800);
  }
}
`
    },
    {
      id: 'shift-register', title: 'Arduino: 74HC595 — 8 LEDs on 3 pins', level: 'Advanced', icon: 'hc595', scope: '200',
      blurb: 'shiftOut() sends a byte one bit at a time; pulsing the latch pin shows it on the 8 outputs. A single light sweeps back and forth.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['ic', 'hc595', 600, 260, 0],
          ['vs', 'vcc', 520, 300, 0, { volts: 5 }], ['g1', 'ground', 480, 320, 0], ['g2', 'ground', 480, 240, 0], ['vs2', 'vcc', 520, 260, 0, { volts: 5 }],
          ...'ABCDEFGH'.split('').flatMap((k, i) => [['r' + k, 'resistor', 700, 180 + i * 20, 0, { ohms: 330 }], ['l' + k, 'led', 780, 180 + i * 20, 0, { color: i % 2 ? 'green' : 'red' }], ['g' + k, 'ground', 800, 180 + i * 20, 0]])],
        wires: [['ard.D8', 'ic.SER', { o: 'v', v: 300 }], ['ard.D9', 'ic.SRCLK', { o: 'v', v: 310 }], ['ard.D10', 'ic.RCLK', { o: 'v', v: 320 }],
          ['g2.g', 'ic.OE'], ['vs2.v', 'ic.SRCLR'], ['vs.v', 'ic.VCC'], ['g1.g', 'ic.GND']]
          .concat(...'ABCDEFGH'.split('').map(k => [['ic.Q' + k, 'r' + k + '.a'], ['r' + k + '.b', 'l' + k + '.a']]))
      },
      sketch: `// 74HC595 shift register: 8 LEDs from 3 pins
const int DATA = 8;    // SER
const int CLOCK = 9;   // SRCLK
const int LATCH = 10;  // RCLK

void show(byte pattern) {
  digitalWrite(LATCH, LOW);                 // hold the outputs while shifting
  shiftOut(DATA, CLOCK, MSBFIRST, pattern); // send 8 bits
  digitalWrite(LATCH, HIGH);                // copy them to the outputs
}

void setup() {
  pinMode(DATA, OUTPUT);
  pinMode(CLOCK, OUTPUT);
  pinMode(LATCH, OUTPUT);
}

void loop() {
  for (int i = 0; i < 8; i++) { show(1 << i); delay(120); }
  for (int i = 6; i > 0; i--) { show(1 << i); delay(120); }
}
`
    },
    {
      id: 'eeprom-counter', title: 'Arduino: EEPROM press counter', level: 'Advanced', icon: 'button',
      blurb: 'The counter is saved in EEPROM, so it survives Stop and Run (like a real board losing power). Press the button, press Stop, then Run again.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['btn', 'button', 440, 200, 0], ['gnd3', 'ground', 480, 200, 0]],
        wires: [['ard.D2', 'btn.a']]
      },
      sketch: `#include <EEPROM.h>

// Settings saved in the board's permanent memory
struct Saved {
  unsigned int presses;
  byte magic;               // 42 means "this EEPROM holds valid data"
};

Saved data;
const int ADDR = 0;

void setup() {
  Serial.begin(9600);
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
  EEPROM.get(ADDR, data);
  if (data.magic != 42) {   // first ever run: initialise
    data.presses = 0;
    data.magic = 42;
    EEPROM.put(ADDR, data);
  }
  Serial.print("Presses so far: ");
  Serial.println(data.presses);
}

void loop() {
  if (digitalRead(2) == LOW) {
    data.presses++;
    EEPROM.put(ADDR, data);
    Serial.println(data.presses);
    digitalWrite(13, HIGH);
    delay(300);
    digitalWrite(13, LOW);
    while (digitalRead(2) == LOW) { }   // wait for release
  }
}
`
    },
    {
      id: 'interrupt-button', title: 'Arduino: Interrupt button', level: 'Advanced', icon: 'button',
      blurb: 'The main loop sleeps for a full second with delay(1000), yet the LED reacts instantly: the interrupt handler runs the moment the button is pressed.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0]].concat(LED_ON_D13.parts, [['btn', 'button', 440, 200, 0], ['gnd3', 'ground', 480, 200, 0]]),
        wires: LED_ON_D13.wires.concat([['ard.D2', 'btn.a']])
      },
      sketch: `// Pin 2 can trigger an interrupt: INT0
volatile bool ledOn = false;
volatile unsigned int presses = 0;
volatile unsigned long lastPress = 0;

void onButton() {
  unsigned long now = millis();
  if (now - lastPress > 50) {       // ignore contact bounce
    ledOn = !ledOn;
    presses++;
    lastPress = now;
  }
  digitalWrite(13, ledOn);
}

void setup() {
  Serial.begin(9600);
  pinMode(13, OUTPUT);
  pinMode(2, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(2), onButton, FALLING);
}

void loop() {
  Serial.print("presses = ");
  Serial.println(presses);
  delay(1000);                       // the button still works during this delay
}
`
    },
    {
      id: 'struct-traffic', title: 'Arduino: Traffic light with struct + enum', level: 'Advanced', icon: 'led',
      blurb: 'The same traffic light, written as a small state machine: an enum names the phases and a struct holds each phase’s pin, duration and next phase.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0],
          ['r1', 'resistor', 180, 220, 90, { ohms: 220 }], ['l1', 'led', 180, 140, 270, { color: 'red' }], ['g1', 'ground', 180, 120, 180],
          ['r2', 'resistor', 220, 220, 90, { ohms: 220 }], ['l2', 'led', 220, 140, 270, { color: 'yellow' }], ['g2', 'ground', 220, 120, 180],
          ['r3', 'resistor', 260, 220, 90, { ohms: 220 }], ['l3', 'led', 260, 140, 270, { color: 'green' }], ['g3', 'ground', 260, 120, 180]],
        wires: [['ard.D12', 'r1.b'], ['r1.a', 'l1.a'], ['ard.D10', 'r2.b'], ['r2.a', 'l2.a'], ['ard.D8', 'r3.b'], ['r3.a', 'l3.a']]
      },
      sketch: `// Traffic light as a state machine
enum Phase { RED, GREEN, YELLOW };

struct Light {
  byte pin;            // which LED
  unsigned int ms;     // how long it stays on
  Phase next;          // which phase comes after
};

Light lights[3] = {
  {12, 3000, GREEN},   // RED
  {8,  3000, YELLOW},  // GREEN
  {10, 1000, RED}      // YELLOW
};

Phase current = RED;

void setup() {
  for (int i = 0; i < 3; i++) pinMode(lights[i].pin, OUTPUT);
}

void loop() {
  digitalWrite(lights[current].pin, HIGH);
  delay(lights[current].ms);
  digitalWrite(lights[current].pin, LOW);
  current = lights[current].next;
}
`
    },
    {
      id: 'diode-curve', title: 'Diode I–V curve (DC sweep)', level: 'Intermediate', icon: 'diode',
      blurb: 'Open Analysis → DC sweep, sweep the battery from 0 to 5 V and plot the current through the resistor: you will see the diode switch on at about 0.7 V.',
      spec: {
        parts: [['bat', 'battery', 100, 200, 0, { volts: 5 }], ['r', 'resistor', 200, 100, 0, { ohms: 100 }], ['d', 'diode', 300, 100, 0]],
        wires: [['bat.+', 'r.a', { o: 'h', v: 100 }], ['r.b', 'd.a'], ['d.k', 'bat.-', { o: 'v', v: 340 }]],
        probes: ['d.a']
      }
    }
    ,
    {
      id: 'multimeter-lab', title: 'Multimeter: measure a voltage divider', level: 'Beginner', icon: 'multimeter',
      blurb: 'Click the multimeter to turn its dial. In DC volts it reads the voltage across R2 (6 V). Try the other dial positions: amps needs the meter IN SERIES, and resistance needs the power OFF.',
      spec: {
        parts: [['bat', 'battery', 80, 200, 0, { volts: 9 }], ['gb', 'ground', 80, 240, 0], ['r1', 'resistor', 200, 140, 90, { ohms: 1000 }], ['r2', 'resistor', 200, 220, 90, { ohms: 2000 }],
          ['dmm', 'multimeter', 340, 160, 0, { mode: 'dcv' }]],
        wires: [['bat.+', 'r1.a', { o: 'h', v: 100 }], ['r1.b', 'r2.a'], ['r2.b', 'bat.-', { o: 'h', v: 280 }], ['dmm.red', 'r2.a', { o: 'v', v: 240 }], ['dmm.black', 'r2.b', { o: 'v', v: 280 }]]
      }
    },
    {
      id: 'regulator-7805', title: '7805 regulator: steady 5 V from a 12 V supply', level: 'Intermediate', icon: 'vreg', scope: '200',
      blurb: 'The 7805 turns 12 V into a steady 5 V for the LED. Select the battery and change its voltage in the inspector (try 8 V, then 5 V): the output stays at 5 V until the input drops below about 7 V. Select the regulator to see the heat it wastes.',
      spec: {
        parts: [['bat', 'battery', 100, 200, 0, { volts: 12 }], ['gb', 'ground', 100, 240, 0], ['u', 'vreg', 340, 120, 0, { model: 'r7805' }], ['gu', 'ground', 340, 200, 0],
          ['r', 'resistor', 560, 120, 0, { ohms: 330 }], ['led', 'led', 700, 120, 0, { color: 'green' }], ['gl', 'ground', 720, 120, 0]],
        wires: [['bat.+', 'u.in', { o: 'h', v: 100 }], ['u.gnd', 'gu.g'], ['u.out', 'r.a'], ['r.b', 'led.a']],
        probes: ['u.in', 'u.out']
      }
    },
    {
      id: 'chaser-4017', title: '555 + CD4017: LED running light', level: 'Advanced', icon: 'cd4017', scope: '1000',
      blurb: 'A 555 makes a slow clock (about 3 Hz); every pulse the CD4017 moves its single HIGH output on to the next of Q0–Q9, so a light runs along the LED bar graph. Change C to make it faster or slower.',
      spec: {
        parts: [['v', 'vcc', 100, 60, 0, { volts: 5 }], ['g', 'ground', 100, 360, 0],
          ['ic', 'ic555', 300, 200, 0], ['r1', 'resistor', 460, 60, 90, { ohms: 1000 }], ['r2', 'resistor', 540, 100, 90, { ohms: 10000 }], ['c', 'capacitor', 620, 200, 90, { farads: 22e-6 }],
          ['cd', 'cd4017', 840, 220, 0], ['bar', 'ledbar', 1160, 420, 0, { color: 'green' }]],
        wires: [['v.v', 'ic.VCC'], ['v.v', 'ic.RESET'], ['g.g', 'ic.GND'], ['v.v', 'r1.a'], ['r1.b', 'ic.DIS'], ['r2.a', 'ic.DIS'], ['r2.b', 'ic.THR'], ['ic.TRIG', 'ic.THR'], ['c.a', 'ic.THR'], ['c.b', 'g.g'],
          ['ic.OUT', 'cd.CLK'], ['v.v', 'cd.VCC'], ['g.g', 'cd.GND'], ['g.g', 'cd.INH'], ['g.g', 'cd.RST']]
          .concat(Array.from({ length: 10 }, (_, k) => ['cd.Q' + k, 'bar.a' + (k + 1)]))
          .concat(Array.from({ length: 9 }, (_, k) => ['bar.k' + (k + 1), 'bar.k' + (k + 2)])).concat([['bar.k1', 'g.g']]),
        probes: ['ic.OUT', 'cd.Q0']
      }
    },
    {
      id: 'counter-display', title: 'Digital counter: 555 → 74HC161 → CD4511 → 7-segment', level: 'Advanced', icon: 'cd4511', scope: '1000',
      blurb: 'No microcontroller: a 555 clock drives a 4-bit binary counter, a BCD decoder turns the binary number into the segment pattern, and a 7-segment display shows it. It counts 0–9, then blanks for 10–15 (the decoder only knows decimal digits).',
      spec: {
        parts: [['v', 'vcc', 100, 60, 0, { volts: 5 }], ['g', 'ground', 100, 400, 0],
          ['ic', 'ic555', 260, 200, 0], ['r1', 'resistor', 420, 60, 90, { ohms: 1000 }], ['r2', 'resistor', 500, 100, 90, { ohms: 10000 }], ['c', 'capacitor', 580, 200, 90, { farads: 47e-6 }],
          ['ct', 'hc161', 800, 240, 0], ['dec', 'cd4511', 1100, 240, 0], ['seg', 'sevenseg', 1460, 560, 0, { resistors: 'builtin' }]],
        wires: [['v.v', 'ic.VCC'], ['v.v', 'ic.RESET'], ['g.g', 'ic.GND'], ['v.v', 'r1.a'], ['r1.b', 'ic.DIS'], ['r2.a', 'ic.DIS'], ['r2.b', 'ic.THR'], ['ic.TRIG', 'ic.THR'], ['c.a', 'ic.THR'], ['c.b', 'g.g'],
          ['ic.OUT', 'ct.CP'], ['v.v', 'ct.VCC'], ['g.g', 'ct.GND'], ['v.v', 'ct.MR'], ['v.v', 'ct.PE'], ['v.v', 'ct.CEP'], ['v.v', 'ct.CET'],
          ['ct.Q0', 'dec.A'], ['ct.Q1', 'dec.B'], ['ct.Q2', 'dec.C'], ['ct.Q3', 'dec.D'], ['v.v', 'dec.VCC'], ['g.g', 'dec.GND'], ['v.v', 'dec.LT'], ['v.v', 'dec.BI'], ['g.g', 'dec.LE'], ['g.g', 'seg.com']]
          .concat('abcdefg'.split('').map(k => ['dec.' + k, 'seg.' + k])),
        probes: ['ic.OUT', 'ct.Q0']
      }
    },
    {
      id: 'stepper-uln2003', title: 'Arduino: stepper motor with a ULN2003 driver', level: 'Advanced', icon: 'stepper',
      blurb: 'Four pins energise the stepper coils one after another through a ULN2003 (a pin alone cannot supply 80 mA). Select the motor to watch the half-steps counted. Change the order in the sketch to reverse it, or shorten the delay to go faster.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['u', 'uln2003', 540, 120, 0], ['m', 'stepper', 840, 160, 0], ['v', 'vcc', 640, 380, 0, { volts: 5 }], ['g', 'ground', 560, 400, 0]],
        wires: [['ard.D8', 'u.IN1'], ['ard.D9', 'u.IN2'], ['ard.D10', 'u.IN3'], ['ard.D11', 'u.IN4'], ['ard.GND_T', 'g.g'], ['g.g', 'u.GND'], ['v.v', 'u.COM'], ['v.v', 'm.com'],
          ['u.OUT1', 'm.c1'], ['u.OUT2', 'm.c2'], ['u.OUT3', 'm.c3'], ['u.OUT4', 'm.c4']]
      },
      sketch: `// Stepper motor 28BYJ-48 through a ULN2003 driver
const int coil[4] = {8, 9, 10, 11};   // IN1..IN4
int step = 0;

void setup() {
  for (int i = 0; i < 4; i++) pinMode(coil[i], OUTPUT);
}

void loop() {
  // energise one coil at a time: 1, 2, 3, 4, 1, 2 ...
  for (int i = 0; i < 4; i++) digitalWrite(coil[i], i == step ? HIGH : LOW);
  step = (step + 1) % 4;          // use (step + 3) % 4 to turn the other way
  delay(5);                       // 5 ms per step = 200 steps per second
}
`
    },
    {
      id: 'stepper-library', title: 'Arduino: Stepper library, one turn each way', level: 'Intermediate', icon: 'stepper',
      blurb: 'The normal way to drive a stepper motor: the Stepper library does the coil sequence for you. step(2048) is one full turn of the 28BYJ-48 shaft; a negative number turns the other way. Select the motor to watch the steps.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['u', 'uln2003', 540, 120, 0], ['m', 'stepper', 840, 160, 0], ['v', 'vcc', 640, 380, 0, { volts: 5 }], ['g', 'ground', 560, 400, 0]],
        wires: [['ard.D8', 'u.IN1'], ['ard.D9', 'u.IN2'], ['ard.D10', 'u.IN3'], ['ard.D11', 'u.IN4'], ['ard.GND_T', 'g.g'], ['g.g', 'u.GND'], ['v.v', 'u.COM'], ['v.v', 'm.com'],
          ['u.OUT1', 'm.c1'], ['u.OUT2', 'm.c2'], ['u.OUT3', 'm.c3'], ['u.OUT4', 'm.c4']]
      },
      sketch: `#include <Stepper.h>

const int STEPS_PER_TURN = 2048;          // 28BYJ-48: 2048 full steps per turn of the shaft

// Pin order 8, 10, 9, 11 matches the coil order of the 28BYJ-48 + ULN2003
Stepper motor(STEPS_PER_TURN, 8, 10, 9, 11);

void setup() {
  motor.setSpeed(10);                     // 10 revolutions per minute
}

void loop() {
  motor.step(STEPS_PER_TURN);             // one turn forward (takes 6 seconds)
  delay(1000);
  motor.step(-STEPS_PER_TURN);            // one turn back
  delay(1000);
}
`
    },
    {
      id: 'keypad-serial', title: 'Arduino: 4×4 keypad', level: 'Intermediate', icon: 'keypad',
      blurb: 'Click a key on the keypad (click again to release) and the Arduino prints it in the Serial tab. Eight wires read sixteen keys: the Keypad library scans rows and columns for you.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['kp', 'keypad', 640, 100, 0]],
        wires: [['ard.D9', 'kp.R1'], ['ard.D8', 'kp.R2'], ['ard.D7', 'kp.R3'], ['ard.D6', 'kp.R4'], ['ard.D5', 'kp.C1'], ['ard.D4', 'kp.C2'], ['ard.D3', 'kp.C3'], ['ard.D2', 'kp.C4']]
      },
      sketch: `#include <Keypad.h>

const byte ROWS = 4;
const byte COLS = 4;
char keys[ROWS][COLS] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'}
};
byte rowPins[ROWS] = {9, 8, 7, 6};       // keypad R1..R4
byte colPins[COLS] = {5, 4, 3, 2};       // keypad C1..C4

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

void setup() {
  Serial.begin(9600);
  Serial.println("Press a key on the keypad");
}

void loop() {
  char key = keypad.getKey();            // 0 when nothing is pressed
  if (key) {
    Serial.print("Key: ");
    Serial.println(key);
  }
}
`
    },
    {
      id: 'comparator-dark', title: 'LM393 comparator: automatic night light', level: 'Intermediate', icon: 'lm393', scope: '200',
      blurb: 'Select the light sensor and drag its light slider down. When it gets dark the LDR voltage rises above the reference (set by two equal resistors) and the comparator output pulls LOW, which lights the LED.',
      spec: {
        parts: [['v', 'vcc', 100, 80, 0, { volts: 5 }], ['g', 'ground', 100, 520, 0], ['u', 'lm393', 480, 260, 0],
          ['rl', 'resistor', 240, 160, 90, { ohms: 10000 }], ['ldr', 'ldr', 240, 340, 90, { light: 80 }],
          ['r1', 'resistor', 340, 160, 90, { ohms: 10000 }], ['r2', 'resistor', 340, 340, 90, { ohms: 10000 }],
          ['rd', 'resistor', 700, 120, 0, { ohms: 330 }], ['led', 'led', 840, 200, 90, { color: 'yellow' }]],
        wires: [['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['v.v', 'rl.a'], ['rl.b', 'ldr.a'], ['ldr.b', 'g.g'], ['rl.b', 'u.M1'],
          ['v.v', 'r1.a'], ['r1.b', 'r2.a'], ['r2.b', 'g.g'], ['r1.b', 'u.P1'], ['v.v', 'rd.a'], ['rd.b', 'led.a'], ['led.k', 'u.O1']],
        probes: ['rl.b', 'r1.b']
      }
    },
    {
      id: '555-monostable', title: '555 one-shot timer (monostable)', level: 'Advanced', icon: 'ic555', scope: '5000',
      blurb: 'Press and release the button: the 555 turns the LED on for exactly one time period (about 3 seconds, T = 1.1 × R × C) and then switches it off by itself. Change R or C to change the time.',
      spec: {
        parts: [['v', 'vcc', 100, 80, 0, { volts: 5 }], ['g', 'ground', 100, 520, 0], ['ic', 'ic555', 360, 280, 0],
          ['rp', 'resistor', 240, 120, 90, { ohms: 10000 }], ['btn', 'button', 140, 240, 90],
          ['rt', 'resistor', 560, 120, 90, { ohms: 270000 }], ['ct', 'capacitor', 640, 280, 90, { farads: 10e-6 }],
          ['rl', 'resistor', 560, 380, 0, { ohms: 330 }], ['led', 'led', 720, 380, 0, { color: 'red' }]],
        wires: [['v.v', 'ic.VCC'], ['g.g', 'ic.GND'], ['v.v', 'ic.RESET'], ['v.v', 'rp.a'], ['rp.b', 'ic.TRIG'], ['btn.a', 'ic.TRIG'], ['btn.b', 'g.g'],
          ['v.v', 'rt.a'], ['rt.b', 'ic.THR'], ['ic.THR', 'ic.DIS'], ['ct.a', 'ic.THR'], ['ct.b', 'g.g'], ['ic.OUT', 'rl.a'], ['rl.b', 'led.a'], ['led.k', 'g.g']],
        probes: ['ic.THR', 'ic.OUT']
      }
    },
    {
      id: 'scr-latch', title: 'SCR latching alarm', level: 'Advanced', icon: 'scr', scope: '1000',
      blurb: 'Press the GATE button once: the SCR switches on and the LED STAYS lit after you let go. That is latching. Open the RESET switch (click it) and close it again to clear the alarm, because the current must fall to zero for the SCR to let go.',
      spec: {
        parts: [['bat', 'battery', 100, 260, 0, { volts: 9 }], ['sw', 'switch', 300, 100, 0, { closed: true }], ['rl', 'resistor', 460, 100, 0, { ohms: 470 }], ['led', 'led', 620, 160, 90, { color: 'red' }],
          ['q', 'scr', 620, 320, 0], ['rg', 'resistor', 360, 360, 0, { ohms: 1000 }], ['gb', 'button', 240, 360, 0]],
        wires: [['bat.+', 'sw.a'], ['sw.b', 'rl.a'], ['rl.b', 'led.a'], ['led.k', 'q.a'], ['q.k', 'bat.-'], ['bat.+', 'gb.a'], ['gb.b', 'rg.a'], ['rg.b', 'q.g']]
      }
    },
    {
      id: 'transformer-step-down', title: 'Transformer: stepping AC voltage down', level: 'Intermediate', icon: 'transformer', scope: '100',
      blurb: 'A 10 V peak, 50 Hz source feeds the primary of a 2 : 1 transformer. The scope shows the secondary is a copy of the wave at HALF the size (5 V peak). Select the transformer and change the turns ratio to 1 : 2 to step the voltage UP: the current then falls. Replace the AC source with a battery to see that a transformer ignores DC.',
      spec: {
        parts: [['ac', 'acsource', 100, 280, 0, { amp: 10, freq: 50, shape: 'sine', offset: 0 }], ['g1', 'ground', 100, 360, 0], ['x', 'transformer', 400, 260, 0, { ratio: '2', l1: 10 }], ['rl', 'resistor', 700, 260, 90, { ohms: 1000 }], ['g2', 'ground', 560, 360, 0]],
        wires: [['ac.+', 'x.p1'], ['ac.-', 'x.p2'], ['ac.-', 'g1.g'], ['x.s1', 'rl.a'], ['rl.b', 'x.s2'], ['x.s2', 'g2.g']],
        probes: ['x.p1', 'x.s1']
      }
    },
    {
      id: 'adc-pot-leds', title: '8-bit ADC: a binary voltmeter', level: 'Intermediate', icon: 'adc8',
      blurb: 'Move the potentiometer (select it and use the slider): the ADC converts the wiper voltage into an 8-bit number and the LED bar graph shows its bits, D7 (128) on segment 1 down to D0 (1) on segment 8. At the start 3 V gives 153 = 10011001, so segments 1, 4, 5 and 8 light.',
      spec: {
        parts: [['v', 'vcc', 100, 60, 0, { volts: 5 }], ['g', 'ground', 100, 500, 0], ['p', 'pot', 260, 180, 0, { ohms: 10000, pos: 40 }], ['u', 'adc8', 560, 260, 0], ['bar', 'ledbar', 1000, 420, 0, { color: 'green' }]],
        wires: [['v.v', 'p.a'], ['g.g', 'p.b'], ['p.w', 'u.VIN'], ['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['v.v', 'u.VREF'], ['u.D7', 'bar.a1'], ['u.D6', 'bar.a2'], ['u.D5', 'bar.a3'], ['u.D4', 'bar.a4'], ['u.D3', 'bar.a5'], ['u.D2', 'bar.a6'], ['u.D1', 'bar.a7'], ['u.D0', 'bar.a8']]
          .concat(Array.from({ length: 9 }, (_, k) => ['bar.k' + (k + 1), 'bar.k' + (k + 2)])).concat([['bar.k1', 'g.g']]),
        probes: ['p.w']
      }
    },
    {
      id: 'dht-serial', title: 'Arduino: DHT11 temperature and humidity', level: 'Intermediate', icon: 'dht11',
      blurb: 'The DHT library reads temperature and humidity over one wire. Select the sensor and move its sliders: the values appear in the Serial tab and the Plotter tab (printed as label:value pairs). The DHT11 gives whole numbers; a DHT22 would give decimals.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['d', 'dht11', 640, 120, 0, { model: '11', temp: 24, hum: 55 }], ['v', 'vcc', 560, 380, 0, { volts: 5 }], ['g', 'ground', 500, 400, 0]],
        wires: [['ard.D2', 'd.data'], ['v.v', 'd.vcc'], ['g.g', 'd.gnd'], ['ard.GND_T', 'g.g']]
      },
      sketch: `#include <DHT.h>

#define DHTPIN 2
#define DHTTYPE DHT11            // use DHT22 for the more accurate sensor

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(9600);
  dht.begin();
}

void loop() {
  delay(1000);                   // the sensor needs about 2 s between readings in real life
  float t = dht.readTemperature();   // degrees Celsius
  float h = dht.readHumidity();      // percent
  if (isnan(t) || isnan(h)) {
    Serial.println("Failed to read the DHT sensor!");
    return;
  }
  // "label:value" pairs are drawn as lines in the Plotter tab
  Serial.print("temp:");
  Serial.print(t);
  Serial.print(",hum:");
  Serial.println(h);
}
`
    },
    {
      id: 'lcd-i2c-hello', title: 'Arduino: I²C LCD with four wires', level: 'Beginner', icon: 'lcdi2c',
      blurb: 'Only four wires: GND, VCC, SDA (to A4) and SCL (to A5). The LiquidCrystal_I2C library writes the text. Select the display to see its status; if the sketch address (0x27) does not match the module the screen explains why.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['u', 'lcdi2c', 640, 100, 0], ['v', 'vcc', 560, 380, 0, { volts: 5 }], ['g', 'ground', 500, 400, 0]],
        wires: [['ard.A4', 'u.SDA'], ['ard.A5', 'u.SCL'], ['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['ard.GND_T', 'g.g']]
      },
      sketch: `#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);   // address 0x27, 16 columns, 2 rows

void setup() {
  lcd.init();
  lcd.backlight();                    // without this the text is too dark to read
  lcd.setCursor(0, 0);
  lcd.print("Hello, Smart21!");
}

void loop() {
  lcd.setCursor(0, 1);
  lcd.print(millis() / 1000);
  lcd.print(" s running   ");
  delay(200);
}
`
    },
    {
      id: 'oled-hello', title: 'Arduino: OLED graphics (SSD1306)', level: 'Intermediate', icon: 'oled',
      blurb: 'A 128 × 64 pixel graphic display on four I²C wires. The sketch writes text and draws a bar, a frame and a bouncing dot. Nothing appears until display.display() copies the drawing to the screen.',
      spec: {
        parts: [['ard', 'arduino', ARD.x, ARD.y, 0], ['u', 'oled', 640, 60, 0], ['v', 'vcc', 560, 400, 0, { volts: 5 }], ['g', 'ground', 500, 420, 0]],
        wires: [['ard.A4', 'u.SDA'], ['ard.A5', 'u.SCL'], ['v.v', 'u.VCC'], ['g.g', 'u.GND'], ['ard.GND_T', 'g.g']]
      },
      sketch: `#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 display(128, 64, &Wire, -1);

int x = 4, dx = 3;

void setup() {
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
}

void loop() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(0, 0);
  display.println("Smart21");
  display.setTextSize(1);
  display.print("running ");
  display.print(millis() / 1000);
  display.println(" s");

  display.drawRect(0, 36, 128, 28, SSD1306_WHITE);      // frame
  display.fillCircle(x, 50, 5, SSD1306_WHITE);          // bouncing dot
  x += dx;
  if (x > 120 || x < 8) dx = -dx;

  display.display();                                    // show everything we drew
  delay(100);
}
`
    }
  ];

  const byId = {}; EXAMPLES.forEach(e => { byId[e.id] = e; });
  function load(id) {
    const e = byId[id]; if (!e) return null;
    const b = build(e.spec);
    return { id, title: e.title, circuit: b.circuit, probes: b.probes, sketch: e.sketch || null, hasArduino: !!e.sketch, scope: e.scope || (id === 'rc' ? '5000' : '200') };
  }
  S21.Examples = { list: EXAMPLES, load, build };
  if (typeof module !== 'undefined' && module.exports) module.exports = S21.Examples;
})(typeof window !== 'undefined' ? window : globalThis);
