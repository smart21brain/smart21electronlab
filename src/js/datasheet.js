/* ---------------------------------------------------------------
   Smart21 ElectroLab — datasheet pop-up for every part (the "?" button in the inspector)
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const DS = {}; S21.Datasheet = DS;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Key limits and typical numbers. What the simulator warns about is marked in the text.
  const LIMITS = {
    battery: ['Ideal voltage source with a small internal resistance', 'Shorting + to − gives a short-circuit warning'],
    ground: ['The 0 V reference every voltage is measured from', 'Connect it to the − of the battery and to every GND pin'],
    switch: ['Toggle switch: click it (also while running) to open or close the contact', 'Contact resistance ≈ 0 Ω when closed'],
    button: ['Push button: closed only while you hold the mouse button down', 'Use a pull-up or pull-down resistor, or INPUT_PULLUP on an Arduino pin'],
    acsource: ['Sine, square, triangle or sawtooth; set amplitude, frequency and offset', 'Used to test filters, amplifiers and rectifiers'],
    voltmeter: ['Measures the voltage between its two probes; very high input resistance', 'Connect it in PARALLEL with the part you measure'],
    ammeter: ['Measures current; almost zero resistance', 'Connect it in SERIES (in the path of the current), never across a battery'],
    multimeter: ['Switch between voltage, current and resistance', 'Resistance: measure with the circuit unpowered and the part isolated'],
    vcc: ['Ideal supply, any voltage you set', 'Arduino 5 V is 5.0 V; many 74HC chips also work at 3.3 V'],
    resistor: ['Power rating: 0.25 W (the simulator warns above this)', 'P = V² ÷ R = I² × R', 'Colour bands are shown from the value you set'],
    pot: ['Wiper at 0–100 %; the total resistance is the value you set', 'Used as a voltage divider: connect the ends to +V and GND, read the middle pin'],
    ldr: ['Dark ≈ 1 MΩ, bright sunlight ≈ 100 Ω (use the light slider)', 'Put it in a voltage divider to turn light into a voltage'],
    capacitor: ['Time constant τ = R × C; fully charged after about 5 τ', 'Electrolytic types have a + and − side: do not reverse them'],
    inductor: ['Opposes changes of current; stores energy ½ L I²', 'Switching it off suddenly makes a voltage spike: add a flyback diode'],
    led: ['Forward voltage: red ≈ 1.8 V, yellow ≈ 2.0 V, green ≈ 2.1 V, blue/white ≈ 3.0 V', 'Typical current 5–20 mA; above 30 mA it burns out (the simulator warns)', 'Always use a series resistor: R = (Vsupply − Vf) ÷ I'],
    diode: ['Forward drop ≈ 0.7 V; blocks current the other way', 'Typical 1N4148: 200 mA, 100 V'],
    schottky: ['Forward drop ≈ 0.3 V (1N5819)', 'Rated 1 A, 40 V; very fast switching'],
    zener: ['Conducts backwards at its zener voltage (the value you choose)', 'Needs a series resistor to limit current'],
    npn: ['Gain (β) ≈ 100; base-emitter ≈ 0.7 V', 'Typical 2N2222 / BC547: 100–800 mA collector current', 'Use a base resistor (1–10 kΩ)'],
    pnp: ['Gain (β) ≈ 100; emitter-base ≈ 0.7 V', 'Base must be pulled LOW to turn it on'],
    mosfet: ['Gate threshold about 2–4 V; the gate takes almost no current', 'Logic-level types switch fully on at 5 V', 'Add a pull-down (10 kΩ) so it stays off when the gate floats'],
    opamp: ['Gain is very high: use negative feedback for amplifiers', 'Output cannot go beyond its supply rails (about 1.5 V short of each)', 'Without feedback it is a comparator'],
    ic555: ['Supply 4.5–15 V', 'Astable frequency f = 1.44 ÷ ((R1 + 2·R2) × C)', 'Output can supply about 200 mA'],
    gate: ['Logic levels: HIGH above half the supply', 'Choose NOT, AND, OR, NAND, NOR, XOR in the inspector'],
    relay: ['Coil needs about 70 mA at 5 V; drive it with a transistor', 'Always add a flyback diode across the coil', 'Contacts: rated 10 A (not simulated)'],
    motor: ['DC motor about 100–300 mA at 5 V; stalls draw much more', 'Drive with a transistor or driver, with a flyback diode'],
    servo: ['Signal pulse 1–2 ms every 20 ms sets the angle (0–180°)', 'Power from 5 V; it can draw 500 mA or more', 'Use the Servo library: servo.write(angle)'],
    buzzer: ['Passive buzzer: tone(pin, frequency)', 'Draws about 10–30 mA'],
    lcd16x2: ['HD44780 in 4-bit mode: RS, E, D4–D7; V0 sets contrast', 'Use the LiquidCrystal library: LiquidCrystal lcd(rs, en, d4, d5, d6, d7)'],
    sevenseg: ['Common-cathode: connect COM to GND, drive segments HIGH', 'Each segment needs a resistor (220–470 Ω)'],
    tmp36: ['Output 10 mV per °C with 0.5 V offset: °C = (V − 0.5) × 100', 'Supply 2.7–5.5 V'],
    lm35: ['Output 10 mV per °C: °C = V × 100', 'Supply 4–30 V'],
    hcsr04: ['Range 2–400 cm, 5 V supply', 'TRIG: 10 µs HIGH pulse; ECHO pulse width = distance × 58 µs per cm'],
    ntc: ['Resistance falls as it gets hotter (10 kΩ at 25 °C, β ≈ 3950)', 'Use it in a voltage divider and the Steinhart–Hart equation'],
    rgbled: ['Three LEDs in one: R, G, B with a common cathode or anode', 'Each colour needs its own resistor'],
    hc595: ['Serial in, 8 parallel outputs: SER, SRCLK, RCLK', 'Each output about 6 mA continuous; VCC 2–6 V', 'Chain several by connecting Q7\' to the next SER'],
    vreg: ['Input must be 2 V (1.1 V for LDO types) above the output', 'Maximum about 1 A; wasted heat = (Vin − Vout) × I', 'Add 0.1–10 µF capacitors on input and output'],
    lm317: ['Vout = 1.25 × (1 + R2 ÷ R1); range 1.25–37 V', 'Input at least 3 V above the output; maximum about 1.5 A', 'Needs at least 10 mA load: R1 = 240 Ω provides it'],
    uln2003: ['7 channels, 500 mA each, up to 50 V', 'Output saturation ≈ 1 V at 350 mA; the simulator uses a few ohms', 'COM goes to the load supply + for the flyback diodes'],
    l293d: ['Logic supply VCC 4.5–7 V, motor supply VS 4.5–36 V', '600 mA per channel (1.2 A peak); drops about 1.4 V (high) and 1 V (low)', 'EN pin takes PWM for speed control'],
    opto: ['LED: 1.2 V, up to 50 mA (use 330 Ω–1 kΩ)', 'Output transistor: up to 35 V, 50 mA; current transfer ratio 50–400 %', 'Isolation 5 kV (not simulated)'],
    fuse: ['Blows when the current is far above its rating for long enough (faster the bigger the overload)', 'Replace it by pressing Stop and Run'],
    lamp: ['Rated voltage and 250 mA; cold resistance about 10 times lower', 'Burns out above 130 % of its rated voltage'],
    quadgate: ['74HC00 / 08 / 32 / 86: VCC 2–6 V, output about ±25 mA', 'Inputs HIGH above half the supply; tie unused inputs'],
    quadnor: ['74HC02: VCC 2–6 V, output about ±25 mA'],
    hexinv: ['74HC04: VCC 2–6 V; 74HC14: Schmitt inputs, thresholds ≈ 35 % and 65 % of VCC'],
    dff74: ['VCC 2–6 V; maximum clock about 50 MHz (simulator: limited by the step size)', '/PRE and /CLR are active LOW: tie them to VCC'],
    cd4017: ['VDD 3–15 V; outputs about 10 mA at 5 V', 'Maximum clock about 5 MHz at 5 V'],
    hc161: ['VCC 2–6 V; counts 0–15', 'Tie /MR, /PE, CEP and CET to VCC for free counting'],
    cd4511: ['VDD 3–15 V; each output sources about 25 mA', 'Drives a common-cathode display; BCD above 9 blanks the display'],
    hc138: ['VCC 2–6 V; outputs are active LOW', 'Enables: /E1 and /E2 LOW, E3 HIGH'],
    hc4051: ['Switch resistance about 80 Ω at 5 V', 'Signals must stay between GND and VCC; VEE to GND'],
    hc165: ['VCC 2–6 V; shifts D7 out first', 'Tie /CE and DS to GND and /PL to VCC when not used'],
    dac8: ['Output = VREF × code ÷ 256', 'Output is weak: buffer it with an op-amp'],
    lm393: ['Supply 2–36 V; open-collector outputs sink up to 16 mA', 'Needs a pull-up resistor on every output'],
    scr: ['Gate trigger about 0.2–1 mA; holding current about 5 mA', 'Rated 0.8 A, 60 V (2N5060)'],
    ledbar: ['10 LEDs; with the built-in 220 Ω each draws about 12 mA at 5 V', 'Without resistors each segment needs one'],
    dotmatrix: ['64 LEDs; one 220 Ω resistor per column is built in', 'Light one row at a time and scan quickly (multiplexing)'],
    stepper: ['28BYJ-48: 5 V, about 80 mA per coil (60 Ω), 2048 full steps (4096 half-steps) per turn', 'Drive it through a ULN2003; Stepper library: Stepper(2048, 8, 10, 9, 11)'],
    pir: ['Supply 4.5–20 V; output 3.3 V HIGH on motion', 'Hold time 0.5–5 s'],
    joystick: ['Two 10 kΩ pots and a button; centre ≈ 2.5 V', 'SW is pulled to GND when pressed: use INPUT_PULLUP'],
    keypad: ['4 rows × 4 columns; pressing a key joins its row and column', 'Keypad library: Keypad(makeKeymap(keys), rowPins, colPins, 4, 4)'],
    transformer: ['Only AC passes: Vsecondary = Vprimary × (secondary turns ÷ primary turns)', 'Power in = power out (less losses): step-up gives less current', 'Windings have a little wire resistance; coupling about 99 %', 'A steady DC on the primary produces nothing on the secondary'],
    adc8: ['Code = VIN ÷ VREF × 255; 8 bits D0–D7', 'Supply 4.5–6 V; VREF open = VCC', 'Continuous or one conversion per START pulse'],
    dht11: ['DHT11: 0–50 °C ±2 °C, 20–90 % ±5 % (whole numbers); DHT22: −40…80 °C ±0.5 °C, 0–100 % ±2 %', 'Supply 3–5.5 V, one data wire; real sensors need 2 s between readings', 'Arduino: DHT dht(pin, DHT11); dht.readTemperature(); dht.readHumidity();'],
    lcdi2c: ['PCF8574 backpack: address 0x27 or 0x3F, 5 V supply', 'SDA = Arduino A4, SCL = A5 (Uno)', 'LiquidCrystal_I2C lcd(0x27, 16, 2); lcd.init(); lcd.backlight();'],
    oled: ['SSD1306, 128 × 64 pixels, address 0x3C, 3.3–5 V', 'SDA = Arduino A4, SCL = A5 (Uno)', 'Adafruit_SSD1306 display(128, 64, &Wire, -1); display.begin(SSD1306_SWITCHCAPVCC, 0x3C); draw, then display.display();'],
    dipsw: ['Four independent slide switches; contact resistance ≈ 0 Ω'],
    arduino: ['Uno R3 (ATmega328P): 5 V logic, 14 digital pins, 6 analog inputs', 'Each pin: 20 mA recommended, 40 mA absolute maximum (the simulator warns)', 'PWM pins: 3, 5, 6, 9, 10, 11; analogRead 0–1023 for 0–5 V'],
    breadboard: ['Rows of 5 connected holes; the long rails run the full length', 'Parts pushed into the same row are connected']
  };
  DS.limits = LIMITS;

  // plain data (testable): name, category, description, pins [{n,label}], settings [{label, options}], limits [text]
  DS.data = function (type) {
    const P = S21.Parts, d = P && P.PARTS && P.PARTS[type]; if (!d) return null;
    const pins = d.terms.map(t => ({ n: t.n, label: t.label || t.n, group: t.group || null }));
    const settings = (d.props || []).map(p => ({ label: p.label, kind: p.type, unit: p.unit || '', options: p.type === 'select' ? p.options.map(o => String(o.l)) : null, range: p.min !== undefined ? [p.min, p.max] : null }));
    return { id: type, name: d.name, cat: d.cat || '', desc: d.desc || '', pins, settings, limits: LIMITS[type] || [] };
  };
  DS.html = function (type, thumbSvg) {
    const x = DS.data(type); if (!x) return '<p>No datasheet for this part.</p>';
    let h = '<div class="ds"><div class="ds-top">' + (thumbSvg ? '<div class="ds-fig">' + thumbSvg + '</div>' : '') + '<div><p class="soft ds-cat">' + esc(x.cat) + '</p><p>' + esc(x.desc) + '</p></div></div>';
    h += '<h3>Pinout (' + x.pins.length + ' pin' + (x.pins.length === 1 ? '' : 's') + ')</h3><table class="ds-t"><thead><tr><th>#</th><th>Pin</th><th>Function</th></tr></thead><tbody>' +
      x.pins.map((p, i) => '<tr><td>' + (i + 1) + '</td><td class="mono">' + esc(p.n) + '</td><td>' + esc(p.label) + (p.group ? ' <span class="soft">(joined inside the chip)</span>' : '') + '</td></tr>').join('') + '</tbody></table>';
    h += '<h3>Key limits and numbers</h3>' + (x.limits.length ? '<ul>' + x.limits.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' : '<p class="soft">See the description above.</p>');
    if (x.settings.length) h += '<h3>Settings in the inspector</h3><ul>' + x.settings.map(s => '<li><b>' + esc(s.label) + '</b>' + (s.options ? ': ' + esc(s.options.join(', ')) : s.range ? ' (' + s.range[0] + ' to ' + s.range[1] + (s.unit ? ' ' + esc(s.unit) : '') + ')' : '') + '</li>').join('') + '</ul>';
    return h + '</div>';
  };
  DS.open = function (type) {
    const P = S21.Parts; let th = '';
    try { const c = P.newCircuit(); P.addPart(c, type, 100, 100, 0); th = S21.Tools.thumb(c, 240, 150) || ''; } catch (_) {}
    S21.Tools.modal({ title: (P.PARTS[type] || {}).name + ': datasheet', wide: true, body: DS.html(type, th) });
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = DS;
})(typeof window !== 'undefined' ? window : globalThis);
