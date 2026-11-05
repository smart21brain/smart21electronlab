/* ---------------------------------------------------------------
   Smart21 ElectroLab — AI tutor
   * Offline engine: calculators, electronics knowledge base, sketch
     debugging and circuit explanations (no account, no network).
   * Optional online engines (Anthropic / OpenAI-compatible / Ollama)
     are called from the app's main process via window.s21.
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const KEY = 's21lab-chats';

  /* ============================ number helpers ============================ */
  const PFX = { k: 1e3, K: 1e3, M: 1e6, meg: 1e6, m: 1e-3, u: 1e-6, 'µ': 1e-6, n: 1e-9, p: 1e-12 };
  function nums(text, unitRe) {
    const re = new RegExp('(\\d+(?:[.,]\\d+)?)\\s*(k|K|M|meg|m|u|µ|n|p)?\\s*(?:' + unitRe + ')(?![a-zA-Z])', 'g');
    const out = []; let m;
    while ((m = re.exec(text))) out.push(parseFloat(m[1].replace(',', '.')) * (m[2] ? PFX[m[2]] : 1));
    return out;
  }
  const volts = t => nums(t, 'volts?|V|v'), amps = t => nums(t, 'amperes?|amps?|A|a'), watts = t => nums(t, 'watts?|W'), farads = t => nums(t, 'farads?|F|f');
  function ohms(t) {
    const out = nums(t, 'ohms?|Ω|ω');
    const re = /(\d+(?:[.,]\d+)?)\s*([kKM])(?![a-zA-Z])(?!\s*(?:ohm|Ω))/g; let m;
    const seen = new Set(out);
    while ((m = re.exec(t))) { const v = parseFloat(m[1].replace(',', '.')) * PFX[m[2]]; if (!seen.has(v)) out.push(v); }
    return out;
  }
  function f(v, unit) { return S21.Parts.fmt(v, unit); }
  function sig(v) { return +v.toPrecision(3); }
  const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
  function nextE12(r) { const dec = Math.pow(10, Math.floor(Math.log10(r))); for (const e of E12) if (e * dec >= r * 0.999) return e * dec; return 10 * dec; }
  const LEDV = { red: 1.9, orange: 2.0, yellow: 2.05, green: 2.2, blue: 3.0, white: 3.1 };

  /* ============================ calculators ============================ */
  function calcOhm(t) {
    if (!/ohm|current|voltage|resistance|volt|amp|power|watt/i.test(t)) return null;
    const V = volts(t), I = amps(t), R = ohms(t);
    const have = [V.length, I.length, R.length].filter(Boolean).length;
    if (have < 2) return null;
    let v = V[0], i = I[0], r = R[0], steps = '';
    if (v !== undefined && r !== undefined && i === undefined) { i = v / r; steps = 'I = V ÷ R = ' + f(v, 'V') + ' ÷ ' + f(r, 'Ω') + ' = **' + f(i, 'A') + '**'; }
    else if (v !== undefined && i !== undefined && r === undefined) { r = v / i; steps = 'R = V ÷ I = ' + f(v, 'V') + ' ÷ ' + f(i, 'A') + ' = **' + f(r, 'Ω') + '**'; }
    else if (i !== undefined && r !== undefined && v === undefined) { v = i * r; steps = 'V = I × R = ' + f(i, 'A') + ' × ' + f(r, 'Ω') + ' = **' + f(v, 'V') + '**'; }
    else return null;
    const p = v * i;
    return '### Ohm’s law\n\n```\nV = I × R\n```\n\n' + steps + '\n\nPower: P = V × I = ' + f(v, 'V') + ' × ' + f(i, 'A') + ' = **' + f(p, 'W') + '**' + (p > 0.25 ? '\n\n⚠️ That is more than a ¼ W resistor can handle. Use a higher-wattage part.' : '') + '\n\nYou can build this in the **Circuit Lab** and hover the parts to check the numbers.';
  }
  function calcLed(t) {
    if (!/led/i.test(t) || !/(resistor|resistance|ohm|calculat|value|need|use)/i.test(t)) return null;
    const V = volts(t); if (!V.length) return null;
    const color = (/(red|orange|yellow|green|blue|white)/i.exec(t) || [])[1];
    const vf = LEDV[(color || 'red').toLowerCase()];
    let I = amps(t); const i = I.length ? I[0] : 0.015;
    const vs = V[0];
    if (vs <= vf + 0.1) return 'A ' + (color || 'red') + ' LED needs about ' + vf + ' V to light up, so a ' + f(vs, 'V') + ' supply is too low to light it.';
    const r = (vs - vf) / i, std = nextE12(r), real = (vs - vf) / std;
    return '### LED series resistor\n\n```\nR = (Vsupply − Vled) ÷ I\n```\n\n- Supply: **' + f(vs, 'V') + '**\n- ' + (color || 'Red') + ' LED forward voltage: about **' + vf + ' V**\n- Wanted current: **' + f(i, 'A') + '**' + (I.length ? '' : ' (a safe default)') + '\n\nR = (' + vs + ' − ' + vf + ') ÷ ' + sig(i) + ' = **' + f(r, 'Ω') + '**\n\nUse the next standard value up: **' + f(std, 'Ω') + '** → real current ≈ ' + f(real, 'A') + ', resistor power ≈ ' + f((vs - vf) * real, 'W') + '.' + (i > 0.02 ? '\n\n⚠️ An Arduino pin should not supply more than 20 mA.' : '') + '\n\nTry it: open the **LED + resistor** example and type this value into the resistor.';
  }
  function calcDivider(t) {
    if (!/divider/i.test(t)) return null;
    const R = ohms(t), V = volts(t); if (R.length < 2 || !V.length) return null;
    const vo = V[0] * R[1] / (R[0] + R[1]);
    return '### Voltage divider\n\n```\nVout = Vin × R2 ÷ (R1 + R2)\n```\n\nR1 = ' + f(R[0], 'Ω') + ' (top), R2 = ' + f(R[1], 'Ω') + ' (bottom), Vin = ' + f(V[0], 'V') + '\n\nVout = ' + V[0] + ' × ' + sig(R[1]) + ' ÷ (' + sig(R[0]) + ' + ' + sig(R[1]) + ') = **' + f(vo, 'V') + '**\n\nRemember: this only holds when whatever you connect to Vout draws very little current compared with the divider.';
  }
  function calcRC(t) {
    if (!/(time constant|\brc\b|capacitor.*(charge|time)|charge.*capacitor)/i.test(t)) return null;
    const R = ohms(t), C = farads(t); if (!R.length || !C.length) return null;
    const tau = R[0] * C[0];
    return '### RC time constant\n\n```\nτ = R × C\n```\n\nτ = ' + f(R[0], 'Ω') + ' × ' + f(C[0], 'F') + ' = **' + f(tau, 's') + '**\n\n| Time | Charge level |\n|---|---|\n| 1 τ (' + f(tau, 's') + ') | 63% |\n| 2 τ (' + f(2 * tau, 's') + ') | 86% |\n| 3 τ (' + f(3 * tau, 's') + ') | 95% |\n| 5 τ (' + f(5 * tau, 's') + ') | 99.3% |\n\nOpen the **Capacitor charging (RC)** example, use these values, and watch the curve on the Scope.';
  }
  function calcSeriesParallel(t) {
    if (!/(series|parallel)/i.test(t)) return null;
    let R = ohms(t);
    if (R.length < 2) { R = []; const re = /(\d+(?:[.,]\d+)?)\s*([kKM])?(?![a-zA-Z0-9])/g; let m; while ((m = re.exec(t))) R.push(parseFloat(m[1].replace(',', '.')) * (m[2] ? PFX[m[2]] : 1)); }
    if (R.length < 2) return null;
    const par = /parallel/i.test(t) && !(/series/i.test(t) && t.search(/series/i) < t.search(/parallel/i));
    const total = par ? 1 / R.reduce((a, r) => a + 1 / r, 0) : R.reduce((a, r) => a + r, 0);
    return '### Resistors in ' + (par ? 'parallel' : 'series') + '\n\n' + (par ? '```\n1/Rtotal = 1/R1 + 1/R2 + …\n```\n' : '```\nRtotal = R1 + R2 + …\n```\n') + '\nValues: ' + R.map(r => f(r, 'Ω')).join(', ') + '\n\n**Rtotal = ' + f(total, 'Ω') + '**';
  }
  const henries = t => nums(t, 'henr(?:y|ies)|H');
  function calcCutoff(t) {
    if (!/(cut.?off|corner|low.?pass|high.?pass|filter)/i.test(t)) return null;
    const R = ohms(t), C = farads(t); if (!R.length || !C.length) return null;
    const fc = 1 / (2 * Math.PI * R[0] * C[0]);
    return '### RC filter cutoff frequency\n\n```\nfc = 1 ÷ (2π × R × C)\n```\n\nfc = 1 ÷ (2π × ' + f(R[0], 'Ω') + ' × ' + f(C[0], 'F') + ') = **' + f(fc, 'Hz') + '**\n\n| Input frequency | Output ÷ input (low-pass) |\n|---|---|\n| ' + f(fc / 10, 'Hz') + ' | ≈ 0.995 |\n| ' + f(fc, 'Hz') + ' | ≈ 0.707 (−3 dB) |\n| ' + f(fc * 10, 'Hz') + ' | ≈ 0.100 |\n\nOpen the **RC low-pass filter (AC)** example and try these values.';
  }
  function calcRL(t) {
    if (!/(inductor|coil|\brl\b|henr|time constant)/i.test(t)) return null;
    const L = henries(t), R = ohms(t); if (!L.length || !R.length) return null;
    const tau = L[0] / R[0];
    return '### RL time constant\n\n```\nτ = L ÷ R\n```\n\nτ = ' + f(L[0], 'H') + ' ÷ ' + f(R[0], 'Ω') + ' = **' + f(tau, 's') + '**\n\nThe current reaches 63% of its final value after 1 τ (' + f(tau, 's') + ') and about 99% after 5 τ (' + f(5 * tau, 's') + ').';
  }
  function calcBase(t) {
    if (!/(base resistor|drive|driving|switch).*(transistor|motor|relay|buzzer|load)|transistor.*(base resistor|resistor)/i.test(t)) return null;
    const I = amps(t); if (!I.length) return null;
    const beta = (/beta\D{0,3}(\d+)|β\D{0,3}(\d+)|gain\D{0,3}(\d+)/i.exec(t) || []).slice(1).find(Boolean), b = beta ? +beta : 100;
    const ib = I[0] / b * 5, rb = (5 - 0.7) / ib, std = nextE12(rb) > rb * 1.01 ? E12.slice().reverse().map(e => e * Math.pow(10, Math.floor(Math.log10(rb)))).find(x => x <= rb) || rb : rb;
    return '### Base resistor for a transistor switch\n\nLoad current **' + f(I[0], 'A') + '**, β = ' + b + ' (a pin gives 5 V, V<sub>BE</sub> ≈ 0.7 V). Use about 5× the minimum base current so the transistor saturates:\n\n```\nIB = (Iload ÷ β) × 5 = ' + f(ib, 'A') + '\nRB = (5 − 0.7) ÷ IB = ' + f(rb, 'Ω') + '\n```\n\nPick a standard value at or below this, such as **' + f(std, 'Ω') + '**. Check that the pin current (' + f((5 - 0.7) / std, 'A') + ') is under 20 mA' + ((5 - 0.7) / std > 0.02 ? ' — it is NOT, use a larger resistor.' : ' ✓.') + (I[0] > 0.5 ? '\n\n⚠️ A small signal transistor handles ~100–500 mA. For more, use a power transistor or MOSFET.' : '');
  }
  function calc555(t) {
    if (!/(555|astable)/i.test(t)) return null;
    const R = ohms(t), C = farads(t); if (R.length < 2 || !C.length) return null;
    const f1 = 1.44 / ((R[0] + 2 * R[1]) * C[0]), th = 0.693 * (R[0] + R[1]) * C[0], tl = 0.693 * R[1] * C[0];
    return '### 555 astable timer\n\n```\nf = 1.44 ÷ ((R1 + 2·R2) × C)\nHIGH time = 0.693 × (R1 + R2) × C\nLOW time  = 0.693 × R2 × C\n```\n\nR1 = ' + f(R[0], 'Ω') + ', R2 = ' + f(R[1], 'Ω') + ', C = ' + f(C[0], 'F') + '\n\n- Frequency: **' + f(f1, 'Hz') + '** (period ' + f(1 / f1, 's') + ')\n- HIGH: ' + f(th, 's') + ', LOW: ' + f(tl, 's') + '\n- Duty cycle: **' + (th / (th + tl) * 100).toFixed(1) + '%**\n\nOpen the **555 timer: astable blinker** example and type these values in.';
  }
  const COLORS = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white'];
  function calcColor(t) {
    if (!/(colou?r code|bands?|stripes)/i.test(t)) return null;
    const words = (t.toLowerCase().match(/black|brown|red|orange|yellow|green|blue|violet|purple|gr[ae]y|white|gold|silver/g) || []).map(w => w === 'purple' ? 'violet' : w === 'gray' ? 'grey' : w);
    if (words.length >= 3) {
      const d = x => COLORS.indexOf(x); if (d(words[0]) < 0 || d(words[1]) < 0) return null;
      const mult = words[2] === 'gold' ? 0.1 : words[2] === 'silver' ? 0.01 : Math.pow(10, d(words[2]));
      const val = (d(words[0]) * 10 + d(words[1])) * mult;
      return '### Resistor colour code\n\n' + words.slice(0, 3).join(' – ') + ' → (' + d(words[0]) + d(words[1]) + ') × ' + mult + ' = **' + f(val, 'Ω') + '**' + (words[3] ? '\n\nThe last band (' + words[3] + ') is the tolerance' + (words[3] === 'gold' ? ' (±5%)' : words[3] === 'silver' ? ' (±10%)' : '') + '.' : '');
    }
    const R = ohms(t); if (!R.length) return '### Resistor colour code\n\n| Colour | Digit |\n|---|---|\n' + COLORS.map((c, i) => '| ' + c + ' | ' + i + ' |').join('\n') + '\n\nBands 1 and 2 are digits, band 3 is the multiplier (number of zeros), band 4 is the tolerance (gold = ±5%).';
    const b = S21.Parts.resistorBands(R[0]);
    const nm = h => { const k = ['#161616', '#7b4a1d', '#d62d20', '#f28c28', '#f2d62c', '#2e9e4a', '#2f6fd6', '#8a4bd6', '#8a8a8a', '#f0f0f0'].indexOf(h); return k >= 0 ? COLORS[k] : h === '#d4af37' ? 'gold' : 'silver'; };
    return '### Colour bands for ' + f(R[0], 'Ω') + '\n\n**' + b.map(nm).join(' – ') + '**  (the last band is ±5% tolerance).';
  }

  /* ============================ knowledge base ============================ */
  const KB = [
    [/ohm'?s? law|ohms law/i, 'Ohm’s law', 'Ohm’s law links voltage (V), current (I) and resistance (R):\n\n```\nV = I × R\n```\n\nIf you know any two you can find the third. Example: 9 V across 470 Ω gives I = 9 ÷ 470 ≈ 19 mA. Power is **P = V × I**. Ask me “5V across 220 ohm” and I will calculate it for you.'],
    [/(why|need).*(resistor).*(led)|led.*(burn|blow|resistor)|led without/i, 'Why LEDs need resistors', 'An LED does not limit its own current. Once the voltage passes its forward voltage (red ≈ 1.9 V), current rises extremely fast. The resistor takes the leftover voltage and sets a safe current:\n\n```\nR = (Vsupply − Vled) ÷ I\n```\n\nTry it in the lab: remove the resistor from the **LED + resistor** example and watch the LED burn out. Ask me “resistor for a red LED on 5V” for a calculation.'],
    [/led.*(not|n't|won't|doesn't|no).*(light|work|glow|turn)|(not|n't).*(light|lit).*led/i, 'LED will not light', 'Check these in order:\n\n1. **Polarity.** The anode (+, long leg) goes towards the positive side. Reversed, it stays dark.\n2. **Complete loop.** Is there a path from + through the LED and back to − / GND?\n3. **Resistor present** and not huge (a 1 MΩ resistor allows almost no current).\n4. **Arduino:** did you call `pinMode(pin, OUTPUT)` and `digitalWrite(pin, HIGH)`? Is the wire on the same pin as in your sketch?\n5. **Breadboard:** both LED legs in the *same column strip* are shorted together. Use different columns.\n\nSwitch to **Debug** mode and I will inspect your circuit and sketch.'],
    [/pull[- ]?up|pull[- ]?down|input_pullup|floating/i, 'Pull-up / pull-down', 'A digital input that is connected to nothing “floats” and reads random values. A **pull-up** resistor ties it to 5 V (default HIGH); a **pull-down** ties it to GND (default LOW).\n\nThe Uno has built-in pull-ups: `pinMode(2, INPUT_PULLUP);`. Wire the button between the pin and GND: not pressed → HIGH, pressed → LOW. Try the **Button + LED** example.'],
    [/pwm|analogwrite|duty cycle/i, 'PWM', '**PWM** (pulse-width modulation) switches a pin on and off very fast (about 490 Hz on the Uno). The **duty cycle** is the fraction of time it is HIGH. `analogWrite(pin, 0..255)` sets it: 128 ≈ 50%, giving an average of about 2.5 V. LEDs look dimmer, motors slower.\n\nOnly pins marked ~ (3, 5, 6, 9, 10, 11) support it. Probe the pin with **Shift+click** and watch the waveform in the Scope.'],
    [/analogread|adc|analog input|0.?1023/i, 'analogRead', '`analogRead(A0)` measures 0–5 V and returns **0–1023** (10 bits, 5 V ÷ 1024 ≈ 4.9 mV per step).\n\n```\nvoltage = reading × 5.0 / 1023.0;\n```\n\nAnalog pins are A0–A5. Common sensors (LDR, thermistor, potentiometer) are voltage dividers feeding these pins.'],
    [/millis|without delay|non.?blocking|multitask/i, 'millis() vs delay()', '`delay()` freezes your sketch. `millis()` returns the time since start so you can check “has enough time passed?” while doing other things:\n\n```cpp\nunsigned long last = 0;\nvoid loop() {\n  if (millis() - last >= 500) {\n    last = millis();\n    // do the periodic job (toggle LED...)\n  }\n  // other work keeps running here\n}\n```'],
    [/serial.*(not|n't|nothing|empty|blank)|nothing.*serial|serial monitor/i, 'Serial monitor basics', 'If nothing appears in the Serial monitor:\n\n- Call `Serial.begin(9600);` in `setup()`. Without it nothing is sent (the emulator warns you, like a real board silently would).\n- Use `Serial.println(value);` to print.\n- Make sure the simulation is running (press Run).\n\nYou can also type text into the box under the monitor and read it with `Serial.read()` or `Serial.parseInt()`.'],
    [/transistor|npn|bjt|amplif/i, 'Transistor as a switch', 'An NPN transistor lets a small **base** current control a bigger **collector → emitter** current: **I<sub>C</sub> ≈ β × I<sub>B</sub>**.\n\nAs a switch: emitter to GND, load between supply and collector, and a resistor (1–10 kΩ) from the control signal to the base. Enough base current saturates it (V<sub>CE</sub> ≈ 0.1 V = fully on). Use this to let an Arduino pin drive a motor or buzzer. Open the **Transistor as a switch** example.'],
    [/diode|rectif|flyback/i, 'Diodes', 'A diode conducts only anode → cathode (about 0.7 V drop for silicon; LEDs drop 1.9–3 V). Uses: reverse-polarity protection, rectifying AC, and a **flyback diode** across motors/relays to absorb the voltage spike when they switch off.'],
    [/capacitor|farad/i, 'Capacitors', 'A capacitor stores charge. Charging through a resistor follows **τ = R × C**, reaching 63% after 1τ and ~99% after 5τ. They smooth power supplies, filter noise and make timers. Ask me for a calculation, e.g. “time constant 10k and 100uF”.'],
    [/breadboard|solderless|strips?/i, 'Using a breadboard', 'On the breadboard, the five holes of a column (a–e, or f–j) are connected. The centre channel separates the two halves (that is where chips straddle). The long rows at the top and bottom are **power rails**, connected along their whole length.\n\nIn the lab, parts snap to holes automatically. If both legs of a component land in the same column strip, you have shorted it. Hover a hole to see its voltage while running.'],
    [/short.?circuit|shorted/i, 'Short circuits', 'A short circuit is a path with almost no resistance between + and −. Current is limited only by the supply, so wires overheat and batteries or Arduino pins can be damaged. The lab warns you. Always have a load (resistor, LED + resistor, …) between the supply and ground.'],
    [/(what is|explain).*(voltage|current)|voltage vs current|difference between voltage and current/i, 'Voltage and current', '**Voltage** is the “push” (pressure) between two points, measured in volts. **Current** is the amount of charge flowing per second, in amperes. Water analogy: voltage = pressure, current = flow rate, resistance = a narrow pipe. A battery has voltage even with nothing connected; current only flows once there is a complete loop.'],
    [/series|parallel/i, 'Series and parallel', '**Series:** one path, same current, resistances add (R1 + R2). **Parallel:** several paths, same voltage, current splits and 1/R<sub>total</sub> = 1/R1 + 1/R2. Give me values, e.g. “100 and 220 ohm in parallel”, and I will compute it.'],
    [/arduino.*(pin|uno)|digital pin|how many pins/i, 'Arduino Uno pins', '- **D0–D13**: digital I/O (D0/D1 are also the serial port)\n- **~3, 5, 6, 9, 10, 11**: PWM (`analogWrite`)\n- **A0–A5**: analog inputs (0–1023); also usable as digital pins 14–19\n- **5V, 3V3, GND, VIN**: power\n- Each pin: ≤ 20 mA recommended, 40 mA absolute max.'],
    [/(difference|vs).*(digitalwrite|analogwrite)|digitalwrite/i, 'digitalWrite', '`digitalWrite(pin, HIGH)` puts 5 V on an output pin, `LOW` puts 0 V. The pin must first be an output: `pinMode(pin, OUTPUT)`. For in-between levels use PWM with `analogWrite` on a ~ pin.'],
    [/(hello|hi|hey|good (morning|afternoon|evening))\b/i, 'Hello', 'Hello! 👋 I am your electronics and Arduino tutor. Try asking:\n\n- “What resistor for a red LED on 5V?”\n- “Explain my circuit”\n- “Why is my LED not lighting?”\n- “Write a sketch that blinks two LEDs”\n- “Quiz me”'],
    [/inductor|coil|henry|back.?emf|flyback/i, 'Inductors', 'An **inductor** is a coil that stores energy in a magnetic field and **resists changes in current**: V = L × dI/dt. In series with a resistor the current ramps up with time constant **τ = L ÷ R**. Motors, relays and speakers are inductive: switching them off creates a voltage spike, so put a **flyback diode** across them. Ask me “time constant 100mH and 100 ohm” for a calculation, or open the **RL** example.'],
    [/low.?pass|high.?pass|filter|cut.?off|frequency response/i, 'Filters', 'A **low-pass RC filter** passes slow signals and weakens fast ones. Cutoff frequency **fc = 1 ÷ (2π R C)**: at fc the output is 71% of the input. Swap R and C positions and you get a **high-pass** filter (blocks DC, passes fast changes). Try the **RC low-pass filter (AC)** example and change the source frequency.'],
    [/hysteresis|schmitt|flicker|jitter|noisy (reading|sensor)/i, 'Hysteresis', 'With a single threshold, a noisy reading near the limit makes the output flicker. **Hysteresis** uses two thresholds (e.g. ON below 350, OFF above 450) and keeps the previous state in between. It needs a variable that remembers the state. See the **Night light without flicker** example.'],
    [/debounce|bounce|toggle|edge detect/i, 'Debouncing & toggling', 'Switch contacts bounce for a few ms, so one press can look like many. **Debounce**: only accept a new reading after it has been stable for ~20 ms (use `millis()`). To **toggle** with one button, react to the *edge* (released → pressed) and flip a stored `bool`. Open **One-button toggle**.'],
    [/\b(ac|alternating)\b|sine|frequency|waveform|period|hertz|\bhz\b/i, 'AC & frequency', 'AC signals change continuously. A sine wave has an **amplitude** (peak voltage) and a **frequency** f in hertz (cycles per second); the period is T = 1 ÷ f. The **AC signal source** in the Parts list makes sine, square or triangle waves up to 1 kHz. Shift+click its + pin to watch it on the **Scope**.'],
    [/challenge/i, 'Challenges', 'Open **Challenges** in the sidebar. Each task loads a starter project; when you think you have solved it press **Check my solution** and the app runs your circuit and sketch to measure what really happens. Say “hint” while a challenge is active and I will give you the next hint.'],
    [/servo/i, 'Servo motors', 'A **servo** moves its arm to an angle (0–180°) and holds it. Wires: brown = GND, red = 5 V, orange = signal. The signal is a pulse every 20 ms whose width (about 1–2 ms) sets the angle. In Arduino:\n\n```cpp\n#include <Servo.h>\nServo myServo;\nvoid setup() { myServo.attach(9); }\nvoid loop() { myServo.write(90); }\n```\n\nSmall servos can draw several hundred mA when moving: for more than one, use a separate 5 V supply and **join the grounds**. Open **Servo sweep** and watch the pulse on the Scope.'],
    [/motor/i, 'DC motors', 'A DC motor draws far more current than an Arduino pin can give (a pin: ≤ 20 mA; a small motor: 100–500 mA). So: pin → base resistor → **transistor** → motor on its own supply, with a **flyback diode** across the motor (cathode to +) and a **common ground**. Speed is controlled with PWM (`analogWrite`). Open **Motor speed with PWM**.'],
    [/lcd|liquidcrystal|16x2|character display/i, 'LCD 16×2', 'The 16×2 LCD works with the **LiquidCrystal** library:\n\n```cpp\n#include <LiquidCrystal.h>\nLiquidCrystal lcd(12, 11, 5, 4, 3, 2);   // rs, enable, d4, d5, d6, d7\nvoid setup() {\n  lcd.begin(16, 2);      // forget this and you only see black boxes\n  lcd.print(\"Hello\");\n}\n```\n\n`lcd.setCursor(col, row)` moves the cursor; `lcd.clear()` wipes the screen. Text that gets shorter leaves old characters behind: print spaces to erase. If the screen is blank check the 6 signal wires first, then power and contrast (V0). Open **Text on an LCD**.'],
    [/7.?seg|seven.?seg|segment/i, '7-segment display', 'A **7-segment digit** has 7 LEDs (a–g) plus a decimal point. In a *common-cathode* display all cathodes join to GND and you raise a segment pin HIGH to light it (with a 220 Ω resistor per segment). Store each digit as a bit pattern: 0 = `0x3F`, 1 = `0x06`, 2 = `0x5B`… and test bits with `(pattern >> i) & 1`. Open **7-segment counter**.'],
    [/multimeter|voltmeter|ammeter|how (do|to) (i )?measure/i, 'Voltmeter & ammeter', 'A **voltmeter** measures the voltage *across* a part, so it goes in **parallel** and has a huge resistance (it must not disturb the circuit). An **ammeter** measures the current *through* a branch, so it goes in **series** (break the wire, put the meter in the gap) and has almost zero resistance. Connecting an ammeter across a battery is a short circuit! Open **Voltmeter & ammeter** and predict the readings first.'],
    [/tmp36|thermistor|temperature sensor|thermometer|lm35|how.*(measure|read).*temperature/i, 'Temperature sensing', 'The **TMP36** is an analog temperature sensor: **Vout = 0.5 V + 10 mV × T(°C)** (so 25 °C = 0.75 V, 0 °C = 0.5 V). Wire +Vs to 5 V, GND to ground and Vout to an analog pin:\n\n```cpp\nint raw = analogRead(A0);\nfloat volts = raw * 5.0 / 1023.0;\nfloat tempC = (volts - 0.5) * 100.0;\n```\n\nThe 10-bit ADC gives 4.9 mV per step ≈ 0.5 °C resolution. Fahrenheit = C × 9/5 + 32. Open **Thermometer (TMP36 + LCD)** and drag the temperature slider.'],
    [/ultrasonic|hc-?sr04|distance sensor|sonar|pulsein|how.*measure.*distance/i, 'Ultrasonic distance', 'The **HC-SR04** measures distance with sound. Send a **10 µs HIGH pulse** to TRIG; the sensor emits a burst and raises ECHO for as long as the echo takes. Sound travels about 343 m/s, so **distance (cm) = echo time (µs) ÷ 58** (there and back). Measure with `pulseIn(ECHO, HIGH, 30000)`; it returns 0 on timeout (no object, out of range 2–400 cm, or no power). Open **Distance with HC-SR04**.'],
    [/\b555\b|astable|monostable|timer ic/i, '555 timer', 'The **555** compares the capacitor voltage with ⅓ and ⅔ of Vcc. In **astable** mode the capacitor charges through R1+R2 and discharges through R2, so the output toggles forever: **f = 1.44 ÷ ((R1 + 2·R2)·C)**, duty = (R1+R2) ÷ (R1+2·R2) (always above 50%). Tie RESET high. Ask me “555 astable R1 1k R2 10k C 10uF” for numbers, or open the **555 timer** example.'],
    [/logic gate|truth table|\band gate|\bor gate|\bnand|\bnor\b|\bxor\b|\bnot gate|boolean|pull.?down/i, 'Logic gates', '| A | B | AND | OR | NAND | NOR | XOR |\n|---|---|---|---|---|---|---|\n| 0 | 0 | 0 | 0 | 1 | 1 | 0 |\n| 0 | 1 | 0 | 1 | 1 | 0 | 1 |\n| 1 | 0 | 0 | 1 | 1 | 0 | 1 |\n| 1 | 1 | 1 | 1 | 0 | 0 | 0 |\n\nNOT flips its single input. A gate input must never float: use a **pull-down resistor** (10 kΩ to GND) with a switch to 5 V. NAND (or NOR) alone can build every other gate. Open **Logic gate with two switches** and change the gate type.'],
    [/thank/i, 'Thanks', 'You are welcome! Keep experimenting: change one thing at a time and watch what happens. 🔧']
  ];

  /* ============================ sketch generator ============================ */
  function exampleSketch(id) { const e = S21.Examples.list.find(x => x.id === id); return e && e.sketch; }
  function codeAnswer(t) {
    const table = [
      [/blink|flash/i, 'blink', 'Blink'], [/button|switch|push/i, 'button', 'Button + LED'], [/(fade|pwm|brightness|knob|potentiometer|dimm)/i, 'fade', 'Knob-controlled LED'],
      [/(ldr|light sensor|night ?light|photo)/i, 'ldr', 'Night light (LDR)'], [/traffic/i, 'traffic', 'Traffic light'], [/(melody|tone|buzzer|music|song|note)/i, 'melody', 'Play a melody'], [/(temperature|tmp36|thermometer)/i, 'temp-lcd', 'Thermometer'], [/(ultrasonic|hc-?sr04|distance)/i, 'ultrasonic', 'Distance with HC-SR04'], [/servo/i, 'servo-sweep', 'Servo sweep'], [/(lcd|liquidcrystal|display text|16x2)/i, 'lcd-hello', 'Text on an LCD'], [/(7.?seg|seven.?seg)/i, 'sevenseg', '7-segment counter'], [/(motor)/i, 'motor-pwm', 'Motor speed with PWM']];
    if (!/(sketch|code|program|write|example|show me)/i.test(t)) return null;
    for (const [re, id, name] of table) if (re.test(t)) {
      return '### ' + name + '\n\nHere is a complete sketch. Use **Load into editor** to put it in the lab, and pick the **' + S21.Examples.list.find(e => e.id === id).title + '** example for the matching circuit.\n\n```cpp\n' + exampleSketch(id) + '```';
    }
    return null;
  }

  /* ============================ circuit / sketch analysis ============================ */
  function wiredPins() {
    const L = S21.Lab, set = new Set(); if (!L || !L.editor) return set;
    const c = L.editor.circuit, ard = c.parts.find(p => p.type === 'arduino'); if (!ard) return set;
    const nl = S21.Parts.buildNetlist(c);
    for (let p = 0; p < 20; p++) {
      const n = nl.ctx.ard.nodes[p];
      const name = p < 14 ? 'D' + p : 'A' + (p - 14);
      const others = c.parts.some(q => q.id !== ard.id && !S21.Parts.PARTS[q.type].noPins && S21.Parts.PARTS[q.type].terms.some(t => nl.nodeOf(q.id, t.n) === n && n !== 0))
        || c.parts.some(q => S21.Parts.PARTS[q.type].noPins && false);
      const wired = c.wires.some(w => (w.a.p === ard.id && w.a.t === name) || (w.b.p === ard.id && w.b.t === name)) || others;
      if (wired) set.add(p);
    }
    return set;
  }
  function sketchPins(src) {
    const out = { out: new Set(), inp: new Set(), analog: new Set() };
    const consts = {}; let m;
    const cre = /(?:const\s+)?(?:int|byte|uint8_t)\s+(\w+)\s*=\s*(A?\d+)\s*;/g; while ((m = cre.exec(src))) consts[m[1]] = m[2];
    const dre = /#define\s+(\w+)\s+(A?\d+)/g; while ((m = dre.exec(src))) consts[m[1]] = m[2];
    const val = s => { s = s.trim(); if (consts[s]) s = consts[s]; if (/^A\d$/.test(s)) return 14 + +s[1]; return /^\d+$/.test(s) ? +s : null; };
    const lcm = /LiquidCrystal\s+\w+\s*\(([^)]*)\)/.exec(src); if (lcm) lcm[1].split(',').forEach(x => { const q = val(x); if (q !== null) out.out.add(q); });
    const re = /(pinMode|digitalWrite|analogWrite|digitalRead|analogRead|tone|attach)\s*\(\s*([A-Za-z_]\w*|\d+)\s*(?:,\s*(\w+))?/g;
    while ((m = re.exec(src))) {
      const p = val(m[2]); if (p === null) continue;
      if (m[1] === 'pinMode') (m[3] === 'OUTPUT' ? out.out : out.inp).add(p);
      else if (/Write|tone|attach/.test(m[1])) out.out.add(p); else if (m[1] === 'analogRead') out.analog.add(p); else out.inp.add(p);
    }
    return out;
  }
  function debugAnswer() {
    const L = S21.Lab; if (!L || !L.editor) return 'Open the **Circuit Lab** first, then ask me again.';
    const c = L.editor.circuit, P = S21.Parts, issues = [], goods = [];
    if (!c.parts.length) return 'The canvas is empty. Add some parts (or load an example) and I will check it for you.';
    const hasArd = c.parts.some(p => p.type === 'arduino');
    // sketch
    if (hasArd) {
      const r = S21.Arduino.compile(L.sketch);
      if (!r.ok) issues.push('**Sketch error on line ' + r.error.line + ':** ' + r.error.message);
      else {
        goods.push('The sketch compiles.'); r.warnings.forEach(w => issues.push('**Sketch (line ' + w.line + '):** ' + w.msg));
        const sp = sketchPins(L.sketch), wired = wiredPins();
        sp.out.forEach(p => { if (!wired.has(p)) issues.push('Your sketch drives pin **' + (p < 14 ? 'D' + p : 'A' + (p - 14)) + '**, but nothing is wired to that pin.'); });
        wired.forEach(p => { if (!sp.out.has(p) && !sp.inp.has(p) && !sp.analog.has(p)) issues.push('Pin **' + (p < 14 ? 'D' + p : 'A' + (p - 14)) + '** is wired in the circuit, but the sketch never uses it.'); });
        if (/while\s*\(\s*(1|true)\s*\)\s*;/.test(L.sketch)) issues.push('`while(true);` freezes the sketch forever.');
        if (/digitalWrite[\s\S]*digitalWrite/.test(L.sketch) && !/delay|millis/.test(L.sketch)) issues.push('The LED is switched on and off with no `delay()`, so it flickers far too fast to see.');
      }
    }
    // circuit
    const nl = P.buildNetlist(c);
    for (const led of c.parts.filter(p => p.type === 'led')) {
      const na = nl.nodeOf(led.id, 'a'), nk = nl.nodeOf(led.id, 'k');
      const resNear = c.parts.some(q => q.type === 'resistor' && ['a', 'b'].some(t => { const n = nl.nodeOf(q.id, t); return n !== 0 && (n === na || n === nk); }));
      if (na === nk) issues.push('An LED has both legs on the **same net** (shorted). On a breadboard, use different columns.');
      else if (!resNear) issues.push('An LED has **no series resistor**. It will burn out. Add a 220 Ω – 470 Ω resistor in the loop.');
      else goods.push('LED has a current-limiting resistor.');
      if (led.rt && led.rt.burnt) issues.push('An LED **burned out** during the simulation (too much current). Press Stop to repair it.');
    }
    if (!hasArd && !c.parts.some(p => p.type === 'battery')) issues.push('There is no power source (battery or Arduino).');
    if (!hasArd && !c.parts.some(p => p.type === 'ground') && c.parts.some(p => p.type === 'battery')) goods.push('No ground symbol, so the battery’s − terminal is used as 0 V.');
    for (const b of c.parts.filter(p => p.type === 'battery')) { const np = nl.nodeOf(b.id, '+'), nm = nl.nodeOf(b.id, '-'); if (np === nm) issues.push('A battery’s + and − are joined directly: that is a **short circuit**.'); }
    // dangling parts
    for (const p of c.parts.filter(q => ['resistor', 'led', 'diode', 'capacitor', 'buzzer', 'inductor'].includes(q.type))) {
      const ns = P.PARTS[p.type].terms.map(t => nl.nodeOf(p.id, t.n));
      const alone = ns.some(n => { if (n === 0) return false; return !c.parts.some(q => q.id !== p.id && !P.PARTS[q.type].noPins && P.PARTS[q.type].terms.some(t => nl.nodeOf(q.id, t.n) === n)) && !c.parts.some(q => P.PARTS[q.type].noPins) ; });
      if (alone) issues.push('A **' + P.PARTS[p.type].name + '** has a leg that is not connected to anything.');
    }
    if (hasArd) for (const m of c.parts.filter(q => q.type === 'motor')) {
      const na = nl.nodeOf(m.id, 'a'), nb = nl.nodeOf(m.id, 'b');
      if (nl.ctx.ard.nodes.some(n => n !== 0 && (n === na || n === nb))) issues.push('A **motor is connected straight to an Arduino pin**. A pin can only supply 20–40 mA; use a transistor (and a separate supply) to drive it.');
    }
    if (L.rt) for (const p of c.parts.filter(q => ['servo', 'lcd16x2'].includes(q.type))) if (p.rt.status && p.rt.status !== 'OK') issues.push('**' + P.PARTS[p.type].name + ':** ' + p.rt.status);
    if (L.rt) for (const a of L.rt.alerts) issues.push(a.msg);
    let out = '### Circuit & sketch check\n\n';
    out += issues.length ? '**Problems I found:**\n\n' + issues.map(i => '- ' + i).join('\n') + '\n\n' : '**No problems found** 🎉\n\n';
    if (goods.length) out += '**Looks fine:**\n\n' + goods.map(i => '- ' + i).join('\n');
    return out;
  }
  function explainAnswer() {
    const L = S21.Lab; if (!L || !L.editor || !L.editor.circuit.parts.length) return 'There is no circuit on the canvas yet. Load an example from **Circuit Lab → Examples…** and ask again.';
    const c = L.editor.circuit, P = S21.Parts, PT = P.PARTS;
    const count = {}; c.parts.forEach(p => { count[p.type] = (count[p.type] || 0) + 1; });
    const list = Object.entries(count).filter(([k]) => k !== 'ground' && k !== 'breadboard').map(([k, n]) => n + ' × ' + PT[k].name).join(', ');
    let out = '### What your circuit does\n\n**Parts:** ' + list + '.\n\n';
    const bat = c.parts.find(p => p.type === 'battery'), ard = c.parts.find(p => p.type === 'arduino');
    if (bat) out += '- The battery supplies **' + f(bat.props.volts, 'V') + '**.\n';
    for (const r of c.parts.filter(p => p.type === 'resistor')) out += '- A resistor of **' + f(r.props.ohms, 'Ω') + '** limits current (at 5 V it would pass ' + f(5 / r.props.ohms, 'A') + ').\n';
    if (c.parts.some(p => p.type === 'led')) out += '- LED(s) light when current flows anode → cathode.\n';
    if (c.parts.some(p => p.type === 'capacitor')) out += '- The capacitor stores charge and smooths or delays voltage changes.\n';
    if (c.parts.some(p => p.type === 'npn')) out += '- The transistor acts as an electronic switch controlled by its base current.\n';
    if (ard) out += '- The Arduino runs your sketch and controls its pins.\n';
    if (ard) {
      const sp = sketchPins(L.sketch);
      if (sp.out.size) out += '\n**Your sketch** drives pin(s) ' + [...sp.out].map(p => p < 14 ? 'D' + p : 'A' + (p - 14)).join(', ') + (sp.inp.size ? ' and reads ' + [...sp.inp].map(p => 'D' + p).join(', ') : '') + (sp.analog.size ? ' and reads analog ' + [...sp.analog].map(p => 'A' + (p - 14)).join(', ') : '') + '.\n';
    }
    if (L.rt) {
      out += '\n**Right now (t = ' + (L.rt.vt / 1000).toFixed(1) + ' s):**\n\n';
      for (const p of c.parts.filter(q => q.type === 'led')) out += '- An LED carries ' + f(p.rt.ia || 0, 'A') + (p.rt.burnt ? ' (burnt out!)' : (p.rt.ia || 0) > 0.0005 ? ' (lit)' : ' (off)') + '.\n';
    } else out += '\nPress **Run** in the lab to see live voltages and currents.';
    return out + '\n\nSwitch to **Debug** mode if something does not work.';
  }

  /* ============================ quiz ============================ */
  function quizBank() {
    const out = [];
    for (const l of (S21.Lessons ? S21.Lessons.list : [])) for (const q of l.quiz || []) out.push(q);
    return out;
  }
  function startQuiz(chat) {
    const bank = quizBank(); if (!bank.length) return 'No quiz questions available.';
    const q = bank[Math.floor(Math.random() * bank.length)];
    chat.quiz = q;
    return '### Quiz time 🎯\n\n**' + q.q + '**\n\n' + q.opts.map((o, i) => '**' + 'ABC'[i] + ')** ' + o).join('\n\n') + '\n\nAnswer with A, B or C.';
  }
  function checkQuiz(chat, text) {
    const m = /^\s*([abc1-3])\b/i.exec(text); if (!m || !chat.quiz) return null;
    const idx = isNaN(m[1]) ? 'abc'.indexOf(m[1].toLowerCase()) : +m[1] - 1;
    const q = chat.quiz; chat.quiz = null;
    return (idx === q.a ? '✅ **Correct!** ' : '❌ **Not quite.** The answer is **' + 'ABC'[q.a] + ') ' + q.opts[q.a] + '**. ') + q.why + '\n\nType “quiz me” for another one.';
  }

  /* ============================ offline engine ============================ */
  function offlineAnswer(text, mode, chat, wantCtx) {
    const t = text.trim();
    const q = checkQuiz(chat, t); if (q) return q;
    if (mode === 'quiz' || /\bquiz me\b|test me|ask me a question/i.test(t)) return startQuiz(chat);
    if (mode === 'debug' || /(check|debug|fix|review).*(my )?(circuit|sketch|code|project)|why (is|does|isn'?t|won'?t).*(not )?(work|light|blink)|not working/i.test(t)) { if (wantCtx !== false) return debugAnswer(); }
    if (/(explain|describe|what does).*(my|this|the) (circuit|project|schematic)|what is on (the )?canvas/i.test(t)) { if (wantCtx !== false) return explainAnswer(); }
    const calc = calc555(t) || calcDivider(t) || calcCutoff(t) || calcBase(t) || calcRL(t) || calcRC(t) || calcSeriesParallel(t) || calcLed(t) || calcColor(t) || calcOhm(t);
    if (calc) return calc;
    if (mode === 'calc') return 'Give me numbers and I will calculate. Examples:\n\n- “5V across 220 ohm”\n- “resistor for a green LED on 9V at 10mA”\n- “voltage divider 9V 1k 2k”\n- “time constant 10k and 100uF”\n- “100 and 220 ohm in parallel”\n- “colour code for 4.7k”';
    const CH = S21.Challenges && S21.Challenges.active && S21.Challenges.byId[S21.Challenges.active];
    if (CH && /(hint|stuck|help.*challenge|challenge.*help|how (do|can) i (solve|do) (this|it))/i.test(t)) {
      chat.hintIdx = Math.min((chat.hintIdx || 0) + 1, CH.hints.length);
      return '### Hint ' + chat.hintIdx + ' of ' + CH.hints.length + ' — ' + CH.title + '\n\n' + CH.hints.slice(0, chat.hintIdx).map((h, i) => (i + 1) + '. ' + h.replace(/<[^>]+>/g, '')).join('\n') + (chat.hintIdx < CH.hints.length ? '\n\nAsk again for the next hint.' : '\n\nThat is every hint. Press **Check my solution** to see what still differs.');
    }
    const code = codeAnswer(t); if (code) return code;
    for (const [re, , ans] of KB) if (re.test(t)) return ans;
    return 'I am not sure about that one. 🤔 My built-in knowledge covers the basics of electronics and Arduino. I can:\n\n- **Calculate** (Ohm’s law, LED resistors, dividers, RC, series/parallel, colour codes)\n- **Explain** concepts (PWM, pull-ups, transistors, millis(), breadboards…)\n- **Debug** your current circuit and sketch (try “check my circuit”)\n- **Write** starter sketches (“sketch for a blinking LED”)\n- **Quiz** you\n\nFor open-ended questions, connect an online AI in **Settings → AI tutor engine** (a local model through Ollama works without internet).';
  }

  /* ============================ markdown ============================ */
  const escH = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function inline(s) {
    s = escH(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>');
    return s.replace(/&lt;(\/?)(sub|sup|b|i)&gt;/g, '<$1$2>');
  }
  function md(text) {
    const parts = text.split(/```/); let html = '';
    parts.forEach((seg, i) => {
      if (i % 2) { const nl = seg.indexOf('\n'); const lang = seg.slice(0, nl).trim(), code = seg.slice(nl + 1).replace(/\n$/, ''); html += '<pre data-lang="' + escH(lang) + '"><code>' + escH(code) + '</code></pre>'; return; }
      const lines = seg.split('\n'); let list = null, tbl = [];
      const flushList = () => { if (list) { html += '<' + list.t + '>' + list.items.map(x => '<li>' + inline(x) + '</li>').join('') + '</' + list.t + '>'; list = null; } };
      const flushTbl = () => { if (tbl.length) { const rows = tbl.filter(r => !/^\s*\|?\s*:?-+/.test(r)).map(r => r.replace(/^\s*\||\|\s*$/g, '').split('|').map(c => c.trim())); html += '<table>' + rows.map((r, k) => '<tr>' + r.map(c => '<' + (k ? 'td' : 'th') + '>' + inline(c) + '</' + (k ? 'td' : 'th') + '>').join('') + '</tr>').join('') + '</table>'; tbl = []; } };
      for (const ln of lines) {
        let m;
        if (/^\s*\|.*\|\s*$/.test(ln)) { flushList(); tbl.push(ln); continue; } else flushTbl();
        if ((m = /^(#{1,4})\s+(.*)/.exec(ln))) { flushList(); html += '<h' + (m[1].length + 2) + '>' + inline(m[2]) + '</h' + (m[1].length + 2) + '>'; }
        else if ((m = /^\s*[-*]\s+(.*)/.exec(ln))) { if (!list || list.t !== 'ul') { flushList(); list = { t: 'ul', items: [] }; } list.items.push(m[1]); }
        else if ((m = /^\s*\d+[.)]\s+(.*)/.exec(ln))) { if (!list || list.t !== 'ol') { flushList(); list = { t: 'ol', items: [] }; } list.items.push(m[1]); }
        else if (ln.trim() === '') flushList();
        else { flushList(); html += '<p>' + inline(ln) + '</p>'; }
      }
      flushList(); flushTbl();
    });
    return html;
  }

  /* ============================ UI ============================ */
  const $ = (s, r) => (r || document).querySelector(s);
  const Tutor = { chats: [], cur: null, mode: '', busy: false, settings: { provider: 'offline' }, reqId: 0, active: null, webAI: false, webCtl: null, webModels: [] };
  S21.Tutor = Tutor;
  const load = () => { try { Tutor.chats = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { Tutor.chats = []; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(Tutor.chats.slice(0, 60))); } catch (_) {} };
  const CARDS = [
    ['🔴', 'Pick an LED resistor', 'Calculate the right resistor for a red LED on 5V', 'What resistor do I need for a red LED on 5V?'],
    ['⚡', 'Explain Ohm’s law', 'Voltage, current and resistance in plain words', 'Explain Ohm’s law'],
    ['🔍', 'Check my circuit', 'Find problems in my circuit and sketch', 'Check my circuit and sketch'],
    ['🧩', 'Explain my circuit', 'What is on the canvas and what does it do?', 'Explain my circuit'],
    ['💡', 'Write a sketch', 'A starter sketch for a blinking LED', 'Write a sketch that blinks an LED'],
    ['🎯', 'Quiz me', 'Test what you have learned', 'Quiz me']
  ];

  function newChat() { const c = { id: 'c' + Date.now(), title: 'New chat', ts: Date.now(), msgs: [] }; Tutor.chats.unshift(c); Tutor.cur = c; renderAll(); return c; }
  function renderHistory() {
    const q = ($('#aiSearch').value || '').toLowerCase(), box = $('#aiHistory'); box.innerHTML = '';
    const list = Tutor.chats.filter(c => c.msgs.length && (!q || c.title.toLowerCase().includes(q)));
    if (!list.length) { box.innerHTML = '<div class="h-empty">No chats yet</div>'; return; }
    const today = new Date().setHours(0, 0, 0, 0), groups = { Today: [], Yesterday: [], Earlier: [] };
    list.forEach(c => (c.ts >= today ? groups.Today : c.ts >= today - 864e5 ? groups.Yesterday : groups.Earlier).push(c));
    for (const [g, items] of Object.entries(groups)) {
      if (!items.length) continue; const h = document.createElement('div'); h.className = 'h-group'; h.textContent = g; box.appendChild(h);
      items.forEach(c => {
        const d = document.createElement('div'); d.className = 'h-item' + (Tutor.cur && c.id === Tutor.cur.id ? ' active' : '');
        d.innerHTML = '<button class="h-title"></button><button class="h-del" title="Delete" aria-label="Delete chat">✕</button>'; d.firstChild.textContent = c.title;
        d.firstChild.onclick = () => { Tutor.cur = c; renderAll(); };
        d.lastChild.onclick = () => { Tutor.chats = Tutor.chats.filter(x => x.id !== c.id); if (Tutor.cur === c) Tutor.cur = null; save(); if (!Tutor.cur) newChat(); else renderAll(); };
        box.appendChild(d);
      });
    }
  }
  function bubbleHtml(m) { return m.r === 'u' ? '' : md(m.t); }
  function addMsgDom(m) {
    const th = $('#aiThread'), d = document.createElement('div'); d.className = 'msg ' + (m.r === 'u' ? 'user' : 'ai');
    if (m.r === 'u') { d.innerHTML = '<div class="bubble"></div>'; d.firstChild.textContent = m.t; }
    else { d.innerHTML = '<img class="av" src="img/logo-64.png" alt=""><div class="bubble">' + bubbleHtml(m) + '</div>'; decorate(d); }
    th.appendChild(d); return d;
  }
  function decorate(root) {
    root.querySelectorAll('pre').forEach(pre => {
      if (pre.querySelector('.copy')) return;
      const code = pre.textContent;
      const cp = document.createElement('button'); cp.className = 'copy'; cp.textContent = 'Copy'; cp.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(code); cp.textContent = 'Copied'; setTimeout(() => cp.textContent = 'Copy', 1200); }; pre.appendChild(cp);
      if (/void\s+setup\s*\(/.test(code) && S21.Lab) { const lc = document.createElement('button'); lc.className = 'loadcode'; lc.textContent = 'Load into editor'; lc.onclick = () => { S21.Lab.setSketch(code); S21.App.show('lab'); S21.Lab.showTab('code'); S21.Lab.toast('Sketch loaded. Press Run (it needs an Arduino in the circuit).'); }; pre.appendChild(lc); }
    });
  }
  function renderThread() {
    const th = $('#aiThread'); th.innerHTML = ''; const c = Tutor.cur;
    $('#aiWelcome').style.display = c && c.msgs.length ? 'none' : '';
    if (c) c.msgs.forEach(addMsgDom);
    scroll();
  }
  const scroll = () => { const s = $('#aiStage'); s.scrollTop = s.scrollHeight; };
  function renderAll() { renderHistory(); renderThread(); updateEngineLabel(); }
  function updateEngineLabel() {
    const s = Tutor.settings; let label = 'Smart21 Tutor · offline';
    if (s.provider === 'workers-ai') label = Tutor.webAI ? 'Cloudflare Workers AI · ' + String(s.model || (Tutor.webModels[0] || 'default')).replace(/^@cf\//, '') : 'Smart21 Tutor · offline (AI unreachable)'; else if (s.provider === 'anthropic') label = 'Claude · ' + (s.model || 'default model'); else if (s.provider === 'openai') label = (s.model || 'OpenAI-compatible') + (s.base && /localhost|127\.0\.0\.1/.test(s.base) ? ' · local' : '');
    $('#aiEngine').textContent = label; Tutor.engineLabel = label; (Tutor.onEngine || []).forEach(fn => { try { fn(label, s); } catch (_) {} });
    $('#aiFine').textContent = (s.provider === 'workers-ai' && Tutor.webAI) ? 'Your message' + ($('#aiCtx').checked ? ' and your circuit/sketch are' : ' is') + ' sent to Cloudflare Workers AI through this site.' : (s.provider === 'offline' || s.provider === 'workers-ai') ? 'Offline tutor: great for calculations and the basics. Connect an online AI in Settings for open-ended questions.' : 'Your message' + ($('#aiCtx').checked ? ' and your circuit/sketch are' : ' is') + ' sent to the AI service you configured.';
  }

  const SYSTEM = 'You are the AI tutor inside Smart21 ElectroLab, a desktop emulator for learning electronics and Arduino (Uno). Students are beginners (age 10 and up). Be friendly, accurate and concise; explain step by step with small examples; use Markdown, and put code in fenced ```cpp blocks. Use SI units and show formulas. The lab has: a circuit canvas with battery, resistor, LED, capacitor, diode, NPN transistor, potentiometer, LDR, switch, button, buzzer, breadboard and Arduino Uno; a sketch editor running a subset of Arduino C++; a serial monitor; a scope. Safety first: mention current limits (Arduino pin 20 mA) and LED resistors. If the student shares their circuit or sketch, base your help on it and point out real mistakes. Never invent parts the lab does not have. If unsure, say so.';

  async function send(text, forcedMode) {
    if (Tutor.busy || !text.trim()) return;
    const chat = Tutor.cur || newChat(), mode = forcedMode !== undefined ? forcedMode : Tutor.mode;
    chat.msgs.push({ r: 'u', t: text.trim() }); if (chat.title === 'New chat') chat.title = text.trim().slice(0, 48);
    chat.ts = Date.now(); $('#aiWelcome').style.display = 'none'; addMsgDom(chat.msgs[chat.msgs.length - 1]); renderHistory(); scroll();
    const reply = { r: 'a', t: '' }; chat.msgs.push(reply);
    const dom = addMsgDom({ r: 'a', t: '' }); const bub = dom.querySelector('.bubble'); bub.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>'; scroll();
    Tutor.busy = true; setSend(true);
    const wantCtx = $('#aiCtx').checked;
    try {
      await route(text, mode, chat, wantCtx, reply, bub);
    } catch (e) { reply.t += (reply.t ? '\n\n' : '') + '⚠️ ' + (e.message || e); bub.innerHTML = md(reply.t); }
    Tutor.busy = false; setSend(false); save(); decorate(bub); scroll(); renderHistory();
  }
  function offline(text, mode, chat, wantCtx, reply, bub) {
    return new Promise(resolve => {
      const full = offlineAnswer(text, mode, chat, wantCtx); let i = 0;
      const tick = () => { i = Math.min(full.length, i + 28); reply.t = full.slice(0, i); bub.innerHTML = md(reply.t); scroll(); if (i < full.length && Tutor.busy) setTimeout(tick, 12); else { reply.t = full; bub.innerHTML = md(full); resolve(); } };
      setTimeout(tick, 250);
    });
  }
  function buildHist(chat, mode, wantCtx) {
    const hist = chat.msgs.slice(0, -1).slice(-16).filter(m => m.t).map(m => ({ role: m.r === 'u' ? 'user' : 'assistant', content: m.t }));
    const last = hist[hist.length - 1];
    const modeHint = { learn: 'The student wants a clear explanation.', calc: 'The student wants a calculation: show the formula and numbers.', debug: 'The student wants help debugging their circuit/sketch: find real problems.', quiz: 'Quiz the student with one multiple-choice question at a time.' }[mode];
    if (last) last.content += (modeHint ? '\n\n[' + modeHint + ']' : '') + (wantCtx && S21.Lab ? '\n\n[Student’s current lab state]\n' + S21.Lab.describeCircuit() : '');
    return hist;
  }
  /* Web version: stream from this site's Worker (/api/ai), which calls Cloudflare Workers AI. */
  async function webOnline(chat, mode, wantCtx, reply, bub) {
    const ctl = new AbortController(); Tutor.webCtl = ctl;
    try {
      const res = await fetch('/api/ai', { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: Tutor.settings.model || undefined, system: SYSTEM, messages: buildHist(chat, mode, wantCtx) }) });
      if (!res.ok || !res.body) { let m = 'HTTP ' + res.status; try { m = (await res.json()).error || m; } catch (_) {} throw new Error(m); }
      const reader = res.body.getReader(), dec = new TextDecoder(); let buf = '', done = false;
      while (!done) {
        const r = await reader.read(); if (r.done) break;
        buf += dec.decode(r.value, { stream: true });
        let i; while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1);
          if (!line.startsWith('data:')) continue; const d = line.slice(5).trim();
          if (d === '[DONE]') { done = true; break; }
          try { const j = JSON.parse(d); const t = typeof j.response === 'string' ? j.response : (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content) || ''; if (t) { reply.t += t; bub.innerHTML = md(reply.t); scroll(); } } catch (_) {}
        }
      }
    } finally { if (Tutor.webCtl === ctl) Tutor.webCtl = null; }
  }
  Tutor.abortActive = function () {
    if (Tutor.webCtl) { try { Tutor.webCtl.abort(); } catch (_) {} }
    if (Tutor.active && window.s21 && window.s21.aiAbort) window.s21.aiAbort(Tutor.active.id);
  };
  // picks the engine: desktop online engines, Workers AI on the web, otherwise the built-in offline tutor (also the fallback)
  async function route(text, mode, chat, wantCtx, reply, bub) {
    const p = Tutor.settings.provider;
    if (p === 'workers-ai' && !window.s21 && Tutor.webAI && navigator.onLine !== false) {
      try { await webOnline(chat, mode, wantCtx, reply, bub); }
      catch (e) { if (e && e.name === 'AbortError') return; if (reply.t) throw e; await offline(text, mode, chat, wantCtx, reply, bub); }
      return;
    }
    if (p !== 'offline' && p !== 'workers-ai' && window.s21 && window.s21.aiStart) return online(chat, mode, wantCtx, reply, bub);
    return offline(text, mode, chat, wantCtx, reply, bub);
  }
  function online(chat, mode, wantCtx, reply, bub) {
    return new Promise((resolve, reject) => {
      const s = Tutor.settings, id = ++Tutor.reqId;
      const hist = buildHist(chat, mode, wantCtx);
      Tutor.active = { id, resolve, reject, bub, reply };
      window.s21.aiStart({ id, provider: s.provider, model: s.model, base: s.base, system: SYSTEM, messages: hist });
    });
  }
  function setSend(busy) {
    const b = $('#aiSend'); b.innerHTML = '<svg class="ic"><use href="#' + (busy ? 'i-stopai' : 'i-send') + '"/></svg>'; b.disabled = false; b.dataset.busy = busy ? '1' : '';
    if (!busy) b.disabled = !$('#aiInput').value.trim();
  }

  Tutor.refreshSettings = async function () {
    if (window.s21 && window.s21.getSettings) { try { Tutor.settings = await window.s21.getSettings(); } catch (_) {} }
    else {                                                   // web build: settings live in this browser; Workers AI is the default when the site's Worker answers
      Tutor.settings = Tutor.webSettings();
      if (!Tutor.webChecked) { Tutor.webChecked = true; try { const r = await fetch('/api/ai/health', { cache: 'no-store' }); const j = r.ok ? await r.json() : null; Tutor.webAI = !!(j && j.ok); Tutor.webModels = j && j.models || []; } catch (_) { Tutor.webAI = false; } }
    }
    updateEngineLabel();
  };
  Tutor.webSettings = function () {
    let s = {}; try { s = JSON.parse(localStorage.getItem('s21lab-ai') || '{}'); } catch (_) {}
    return { provider: s.provider === 'offline' ? 'offline' : 'workers-ai', model: s.model || '', base: '', hasKey: false };
  };
  Tutor.saveWebSettings = function (p) { try { localStorage.setItem('s21lab-ai', JSON.stringify({ provider: p.provider, model: p.model || '' })); return true; } catch (_) { return false; } };
  if (typeof window.addEventListener === 'function') window.addEventListener('online', () => { Tutor.webChecked = false; Tutor.refreshSettings(); });
  Tutor.init = function () {
    load(); const h = new Date().getHours(); $('#aiGreet').textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    $('#aiCards').innerHTML = CARDS.map((c, i) => '<button class="card" data-i="' + i + '"><div class="em">' + c[0] + '</div><div><b>' + c[1] + '</b><span>' + c[2] + '</span></div></button>').join('');
    $('#aiCards').addEventListener('click', e => { const b = e.target.closest('.card'); if (b) send(CARDS[+b.dataset.i][3], ''); });
    const inp = $('#aiInput');
    inp.addEventListener('input', () => { inp.style.height = 'auto'; inp.style.height = Math.min(160, inp.scrollHeight) + 'px'; if (!Tutor.busy) $('#aiSend').disabled = !inp.value.trim(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#aiForm').requestSubmit(); } });
    $('#aiForm').addEventListener('submit', e => {
      e.preventDefault();
      if (Tutor.busy) { Tutor.abortActive(); Tutor.busy = false; if (Tutor.active) { Tutor.active.resolve(); } setSend(false); return; }
      const t = inp.value; inp.value = ''; inp.style.height = 'auto'; send(t);
    });
    $('#aiModes').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Tutor.mode = b.dataset.mode; document.querySelectorAll('#aiModes button').forEach(x => x.classList.toggle('on', x === b)); inp.focus(); });
    $('#aiNew').onclick = newChat; $('#aiSearch').addEventListener('input', renderHistory); $('#aiCtx').addEventListener('change', updateEngineLabel);
    $('#aiClear').onclick = () => { if (confirm('Delete all tutor chats?')) { Tutor.chats = []; Tutor.cur = null; save(); newChat(); } };
    if (window.s21 && window.s21.onAi) window.s21.onAi(ev => {
      const a = Tutor.active; if (!a || ev.id !== a.id) return;
      if (ev.type === 'chunk') { a.reply.t += ev.text; a.bub.innerHTML = md(a.reply.t); scroll(); }
      else if (ev.type === 'done') { Tutor.active = null; a.resolve(); }
      else if (ev.type === 'error') { Tutor.active = null; a.reply.t += (a.reply.t ? '\n\n' : '') + '⚠️ ' + ev.message + '\n\nCheck **Settings → AI tutor engine**, or switch back to the offline tutor.'; a.bub.innerHTML = md(a.reply.t); a.resolve(); }
    });
    Tutor.cur = Tutor.chats.find(c => c.msgs.length) || null; if (!Tutor.cur) newChat(); else renderAll();
    Tutor.refreshSettings();
  };
  /* ---- shared API used by the floating AI widget (js/aifab.js) ---- */
  Tutor.CARDS = CARDS; Tutor.save = save; Tutor.decorate = decorate; Tutor.newChat = newChat; Tutor.renderAll = renderAll; Tutor.onEngine = [];
  Tutor.respond = async function (chat, text, mode, wantCtx, reply, bub) {      // fills `reply`/`bub` with the answer (offline or online engine)
    Tutor.busy = true;
    try {
      await route(text, mode || '', chat, wantCtx, reply, bub);
    } catch (e) { reply.t += (reply.t ? '\n\n' : '') + '⚠️ ' + (e.message || e); bub.innerHTML = md(reply.t); }
    Tutor.busy = false; save(); decorate(bub);
  };
  Tutor.stop = function () {
    if (!Tutor.busy) return;
    Tutor.abortActive();
    Tutor.busy = false; if (Tutor.active) Tutor.active.resolve();
  };
  Tutor.offlineAnswer = offlineAnswer; Tutor.md = md; Tutor._calc = { calcOhm, calcLed, calcDivider, calcRC, calcSeriesParallel, calcColor, calcCutoff, calcRL, calcBase };
  if (typeof module !== 'undefined' && module.exports) module.exports = Tutor;
})(typeof window !== 'undefined' ? window : globalThis);
