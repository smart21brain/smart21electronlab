/* ---------------------------------------------------------------
   Smart21 ElectroLab — lessons, round 2 (original content)
   Registered into S21.Lessons.list before the lesson UI starts.
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  if (!S21.Lessons || !S21.Lessons.list || S21.Lessons.list.some(l => l.id === 'l26')) return;
  const L = [
    {
      id: 'l26', title: 'Op-amps: amplifiers & comparators', time: '16 min', tag: 'Analog', example: 'opamp-gain', extra: [{ id: 'opamp-comparator', label: 'Open the dark detector (comparator)' }],
      html: `
<p>An <b>operational amplifier</b> (op-amp) has two inputs, <b>IN+</b> and <b>IN−</b>, one output and two power pins. It multiplies the difference between the inputs by a huge number (about 100 000). Almost every useful op-amp circuit comes from one idea.</p>
<h2>The golden rule</h2>
<p>When the op-amp has <b>negative feedback</b> (part of the output is fed back to IN−), it adjusts its output until <b>IN− equals IN+</b>. Because the gain is so large, the two inputs end up within microvolts of each other, and almost no current flows <i>into</i> the inputs.</p>
<h2>Non-inverting amplifier</h2>
<p>Signal into IN+. R2 from the output to IN−, R1 from IN− to ground. IN− is a voltage divider of the output, and must equal the input:</p>
<p><b>V<sub>out</sub> = V<sub>in</sub> × (1 + R2 ÷ R1)</b>. With 10 kΩ and 10 kΩ the gain is 2.</p>
<h2>Inverting amplifier</h2>
<p>Signal through R1 into IN−, IN+ at the reference (ground), R2 from the output back to IN−: <b>gain = −R2 ÷ R1</b>. The minus sign means the output is upside-down.</p>
<h2>Clipping</h2>
<p>The output can never go beyond the supply. An LM358 on 9 V stops at about <b>7.5 V</b> (V+ − 1.5 V). Open the lab, turn the knob and watch the output flatten: this is <b>clipping</b>. The little dot on the op-amp symbol turns amber when the output is saturated.</p>
<h2>No feedback = comparator</h2>
<p>Without feedback the gain is so large that the output slams to one rail: HIGH when IN+ &gt; IN−, LOW when IN+ &lt; IN−. A comparator turns a smooth voltage (light, temperature) into a clean yes/no. The second example uses it as a dark detector.</p>
<div class="tip"><b>Remember:</b> an op-amp must be powered. If V− is not connected, the simulator treats it as 0 V (single supply). With no power at all the output floats.</div>`,
      quiz: [
        { q: 'A non-inverting amplifier uses R1 = 1 kΩ and R2 = 9 kΩ. What is the gain?', opts: ['9', '10', '0.9', '−9'], a: 1, why: 'Gain = 1 + R2 ÷ R1 = 1 + 9 = 10.' },
        { q: 'An op-amp with NO feedback and IN+ slightly above IN− gives…', opts: ['0 V', 'A tiny voltage', 'The positive rail (output HIGH)', 'An oscillation'], a: 2, why: 'Open-loop gain is about 100 000, so even a few millivolts of difference saturates the output.' },
        { q: 'Why does the amplified output flatten at the top?', opts: ['The op-amp is broken', 'The output cannot exceed the supply voltage', 'The resistors overheat', 'IN− is floating'], a: 1, why: 'An op-amp can only swing between its supply rails (minus a small margin).' }
      ]
    },
    {
      id: 'l27', title: 'Zener diodes & voltage regulation', time: '10 min', tag: 'Components', example: 'zener-reg',
      html: `
<p>A normal diode blocks current in reverse. A <b>Zener diode</b> is built to <i>break down</i> in reverse at a precise voltage, called the <b>Zener voltage V<sub>Z</sub></b> (3.3 V, 5.1 V, 12 V …), and then holds that voltage steady even if the current changes a lot. The breakdown is harmless as long as the power stays within the rating.</p>
<h2>The shunt regulator</h2>
<p>Put the Zener <b>in reverse across the load</b> (bar towards +), and feed it through a <b>series resistor</b>:</p>
<ul><li>The series resistor drops the extra voltage: V<sub>R</sub> = V<sub>in</sub> − V<sub>Z</sub>.</li><li>The current through it is split: some goes to the load, the rest through the Zener.</li><li>If the input rises, the Zener takes more current and V<sub>out</sub> stays put.</li></ul>
<h2>Choosing the resistor</h2>
<p>Example: 12 V in, 5.1 V out, 5 mA load, 5 mA minimum Zener current:</p>
<p>R<sub>S</sub> = (12 − 5.1) ÷ (5 mA + 5 mA) = <b>690 Ω</b> → use 680 Ω.</p>
<p>Check the power: the Zener must handle V<sub>Z</sub> × I<sub>max</sub>. If the load is removed, all 10 mA flows through it: 5.1 V × 10 mA = 51 mW. Fine for a 500 mW part. The app warns you when a Zener dissipates more than 0.5 W.</p>
<h2>Limits</h2>
<p>Zener regulators waste power (the current flows all the time) and the output moves a little with load. For anything big, use a proper regulator IC. But for a reference voltage or protecting a pin, nothing is simpler.</p>
<div class="tip"><b>Try it:</b> change the battery from 12 V to 9 V and 15 V. The output hardly moves. Then set it to 3 V: below V<sub>Z</sub> the Zener does nothing.</div>`,
      quiz: [
        { q: 'In a shunt regulator the Zener is connected…', opts: ['In series with the load, forward', 'In parallel with the load, in reverse', 'In parallel with the load, forward', 'Across the battery with no resistor'], a: 1, why: 'The Zener must be reverse-biased across the load so it can break down at V<sub>Z</sub>.' },
        { q: '12 V in, 5.1 V Zener, 10 mA total current. Series resistor?', opts: ['51 Ω', '690 Ω', '1.2 kΩ', '6.9 Ω'], a: 1, why: 'R = (12 − 5.1) ÷ 0.01 = 690 Ω.' },
        { q: 'What happens with a 3 V input and a 5.1 V Zener?', opts: ['The Zener burns', 'The output is 5.1 V anyway', 'The output follows the input, about 3 V', 'The output is 0 V'], a: 2, why: 'Below the Zener voltage there is no breakdown, so no regulation.' }
      ]
    },
    {
      id: 'l28', title: 'PNP transistors & high-side switching', time: '10 min', tag: 'Components', example: 'pnp-highside',
      html: `
<p>The NPN transistor from lesson 6 switches the <b>ground side</b> of a load. A <b>PNP</b> transistor is its mirror image and switches the <b>positive side</b>. This is called a <b>high-side switch</b>: the load stays connected to ground and only the supply is interrupted.</p>
<h2>How a PNP works</h2>
<ul><li>The emitter goes to the <b>positive</b> supply, the collector to the load.</li><li>It turns <b>ON</b> when the base is about <b>0.7 V below</b> the emitter, so current flows <i>out of</i> the base.</li><li>It turns <b>OFF</b> when the base is at (or above) the emitter voltage.</li></ul>
<h2>With an Arduino</h2>
<p>The emitter is at 5 V. A pin at <b>LOW</b> (0 V) pulls current out of the base: transistor ON. A pin at <b>HIGH</b> (5 V) equals the emitter: transistor OFF. The logic is <b>inverted</b>: LOW means ON. The 10 kΩ base resistor limits the base current.</p>
<h2>Why use high-side?</h2>
<p>Many sensors and modules must keep a common ground with the controller; switching their ground would break that. Switching the supply instead keeps the ground solid.</p>
<div class="tip"><b>Gotcha:</b> if the PNP emitter is on a supply higher than the Arduino’s 5 V (say 12 V), a HIGH of 5 V is still 7 V <i>below</i> the emitter and will not turn it off. You then need a level-shifting NPN or a P-channel MOSFET with extra circuitry.</div>`,
      quiz: [
        { q: 'A PNP transistor with its emitter at 5 V turns ON when the base is…', opts: ['At 5 V', 'At about 4.3 V or lower', 'At 9 V', 'Floating'], a: 1, why: 'The base must be about 0.7 V below the emitter, so 4.3 V or less.' },
        { q: 'With a PNP high-side switch driven by an Arduino pin, the LED lights when the pin is…', opts: ['HIGH', 'LOW', 'PWM only', 'INPUT'], a: 1, why: 'LOW pulls current out of the base, turning the PNP on.' }
      ]
    },
    {
      id: 'l29', title: 'MOSFETs: efficient switching', time: '14 min', tag: 'Components', example: 'mosfet-motor',
      html: `
<p>A <b>MOSFET</b> is a switch controlled by <b>voltage</b> instead of current. The <b>gate</b> is insulated from the rest of the transistor, so it draws essentially no current (apart from a brief charge of its tiny capacitance). Three pins: <b>gate</b>, <b>drain</b> (the load side) and <b>source</b> (the ground side for an N-channel).</p>
<h2>Threshold voltage</h2>
<p>Below the <b>threshold voltage V<sub>th</sub></b> the channel is closed (OFF). Above it the channel opens, and the more gate voltage, the lower its resistance. A fully-on MOSFET has a tiny <b>R<sub>DS(on)</sub></b> (milliohms), so it wastes almost no power and stays cool even at several amps.</p>
<h2>Logic-level matters</h2>
<table><tr><th>Type</th><th>Needs on the gate</th><th>At 5 V from an Arduino</th></tr><tr><td>Logic-level (IRLZ44N)</td><td>≈ 4–5 V</td><td>fully on ✓</td></tr><tr><td>Standard (IRF540)</td><td>≈ 10 V</td><td>half on ✗ (hot and weak)</td></tr></table>
<p>In the lab, change the MOSFET’s <b>Model</b> to “Standard power” and watch the motor lose voltage.</p>
<h2>Wiring an N-channel low-side switch</h2>
<ul><li>Source to ground, load between supply and drain.</li><li>A 100–220 Ω resistor in series with the gate calms switching ringing.</li><li>A 10 kΩ resistor from gate to ground keeps it OFF while the Arduino pin is floating during start-up.</li><li>A diode across a motor catches the spike when it turns off (the MOSFET also has a built-in body diode).</li></ul>
<h2>MOSFET vs BJT</h2>
<p>A BJT needs base current (milliamps for amps of load) and always drops about 0.2 V. A MOSFET needs almost no drive current and can drop millivolts. For motors, heaters and LED strips the MOSFET wins.</p>`,
      quiz: [
        { q: 'Which statement about the gate of a MOSFET is true?', opts: ['It needs a large steady current', 'It draws almost no steady current', 'It must be connected to the load', 'It only works with AC'], a: 1, why: 'The gate is insulated: voltage controls the channel and almost no current flows.' },
        { q: 'You drive an IRF540 (needs 10 V) from a 5 V Arduino pin. What happens?', opts: ['It works perfectly', 'It is only partly on and runs hot', 'It never turns on at all', 'It turns on only for AC'], a: 1, why: '5 V is above the threshold but far below full enhancement, so R<sub>DS(on)</sub> is high.' },
        { q: 'Why add a 10 kΩ resistor from gate to ground?', opts: ['To make the gate faster', 'To keep the MOSFET off when the pin floats', 'To increase gate voltage', 'To measure current'], a: 1, why: 'A floating gate can drift and switch the MOSFET on randomly.' }
      ]
    },
    {
      id: 'l30', title: 'Thermistors & measuring temperature', time: '14 min', tag: 'Sensors', example: 'ntc-thermo',
      html: `
<p>A <b>thermistor</b> is a resistor whose value changes strongly with temperature. An <b>NTC</b> (negative temperature coefficient) thermistor <b>loses resistance as it gets hotter</b>: a typical one is 10 kΩ at 25 °C and about 3.6 kΩ at 50 °C.</p>
<h2>Reading it</h2>
<p>Put it in a voltage divider with a 10 kΩ resistor and read the middle point with <code>analogRead()</code>. With the NTC on the bottom: V = 5 V × R<sub>NTC</sub> ÷ (R<sub>fixed</sub> + R<sub>NTC</sub>). Hot → low R → <b>lower reading</b>.</p>
<h2>From reading to resistance</h2>
<p>With the NTC at the bottom of the divider: <b>R<sub>NTC</sub> = R<sub>fixed</sub> × raw ÷ (1023 − raw)</b>.</p>
<h2>From resistance to temperature: the β equation</h2>
<p>1 ÷ T = 1 ÷ T<sub>0</sub> + ln(R ÷ R<sub>0</sub>) ÷ β</p>
<p>T is in <b>kelvin</b>; subtract 273.15 for °C. T<sub>0</sub> = 298.15 K (25 °C), R<sub>0</sub> is the resistance at 25 °C and β (about 3950) comes from the data sheet. The sketch uses <code>log()</code> for the natural logarithm.</p>
<h2>Compared with the TMP36</h2>
<table><tr><th></th><th>TMP36</th><th>NTC</th></tr><tr><td>Output</td><td>linear, 10 mV/°C</td><td>curved (logarithmic)</td></tr><tr><td>Maths</td><td>one line</td><td>needs the β equation</td></tr><tr><td>Cost / size</td><td>higher</td><td>very cheap, tiny, fast</td></tr></table>
<div class="tip"><b>Try it:</b> drag the temperature slider and watch the Serial monitor. The board LED lights above 30 °C. Then try the “Overheat alarm” challenge.</div>`,
      quiz: [
        { q: 'When an NTC thermistor gets hotter, its resistance…', opts: ['rises', 'falls', 'stays the same', 'becomes infinite'], a: 1, why: 'NTC = negative temperature coefficient: resistance falls as temperature rises.' },
        { q: 'NTC on the BOTTOM of the divider. The analogRead value as it warms up…', opts: ['rises', 'falls', 'does not change', 'jumps to 1023'], a: 1, why: 'Lower R at the bottom gives a lower voltage at the middle point.' },
        { q: 'Which unit must T be in for the β equation?', opts: ['Celsius', 'Fahrenheit', 'Kelvin', 'Any'], a: 2, why: 'The equation uses absolute temperature in kelvin.' }
      ]
    },
    {
      id: 'l31', title: 'Relays & the flyback diode', time: '14 min', tag: 'Motion', example: 'relay-lamp',
      html: `
<p>A <b>relay</b> is an electrically operated switch: a coil makes a magnet that moves a contact. The coil circuit and the contact circuit are <b>completely separate</b>, so a 5 V Arduino can switch a 230 V lamp (with a proper relay!) without any electrical connection between the two sides.</p>
<h2>The pins</h2>
<ul><li><b>Coil 1 / Coil 2</b>: energise it with its rated voltage (5 V, 12 V …). It needs tens of milliamps: <b>too much for an Arduino pin</b>, so a transistor drives it.</li><li><b>COM</b>: the common contact.</li><li><b>NC</b> (normally closed): connected to COM when the relay is off.</li><li><b>NO</b> (normally open): connected to COM when the relay is on.</li></ul>
<h2>The inductive kick</h2>
<p>A coil is an inductor. When current through it stops suddenly, it tries to keep the current going and produces a <b>large voltage spike</b> (V = L × di/dt), often hundreds of volts. That kills transistors and Arduino pins.</p>
<h2>The flyback diode</h2>
<p>Put a diode <b>across the coil, cathode (bar) towards the positive side</b>. In normal operation it is reverse-biased and does nothing. When the transistor switches off, the coil current flows round through the diode and dies away gently.</p>
<p>In the lab, delete the diode and run: the app reports the spike. Put it back and the warning disappears.</p>
<div class="tip"><b>Other ideas:</b> use the same trick for motors, solenoids and buzzers. Any coil needs a flyback diode.</div>`,
      quiz: [
        { q: 'Why can’t an Arduino pin drive a relay coil directly?', opts: ['Relays need AC', 'The coil needs more current than a pin can give', 'Relays are too slow', 'The pin voltage is too high'], a: 1, why: 'A pin gives about 20 mA; a 5 V relay coil needs 70–80 mA.' },
        { q: 'The flyback diode is connected…', opts: ['In series with the coil', 'Across the coil, cathode to the + side', 'Across the contacts', 'From the base to ground'], a: 1, why: 'It conducts only when the coil tries to push current the “wrong” way.' },
        { q: 'Which contact is connected to COM while the relay is OFF?', opts: ['NO', 'NC', 'Coil 1', 'None'], a: 1, why: 'NC means normally closed: closed when the relay is not energised.' }
      ]
    },
    {
      id: 'l32', title: 'RGB LEDs & mixing colours', time: '10 min', tag: 'Displays', example: 'rgb-mixer',
      html: `
<p>An <b>RGB LED</b> is three LEDs (red, green, blue) in one package. By mixing different brightnesses you can make almost any colour.</p>
<h2>Common cathode or common anode?</h2>
<ul><li><b>Common cathode</b>: the shared pin goes to <b>ground</b>; each colour pin gets HIGH to light.</li><li><b>Common anode</b>: the shared pin goes to <b>+5 V</b>; each colour lights when its pin is LOW, so <code>analogWrite()</code> values are inverted (255 − value).</li></ul>
<p>You can switch between them in the part’s inspector.</p>
<h2>One resistor per colour</h2>
<p>The three LEDs have different forward voltages (about 2 V red, 3 V green and blue). Sharing one resistor would give uneven brightness. Use <b>one resistor per colour</b> (220 Ω is fine on 5 V). Without them, a colour burns out within milliseconds.</p>
<h2>Mixing</h2>
<table><tr><th>Colour</th><th>R</th><th>G</th><th>B</th></tr><tr><td>Red</td><td>255</td><td>0</td><td>0</td></tr><tr><td>Yellow</td><td>255</td><td>255</td><td>0</td></tr><tr><td>Cyan</td><td>0</td><td>255</td><td>255</td></tr><tr><td>Purple</td><td>160</td><td>0</td><td>255</td></tr><tr><td>White</td><td>255</td><td>255</td><td>255</td></tr></table>
<h2>A cleaner way: struct</h2>
<p>The example stores colours as <code>struct Color { byte r, g, b; };</code>: three values that always travel together. Lesson 36 explains structs.</p>`,
      quiz: [
        { q: 'A common-cathode RGB LED: where does the shared pin go?', opts: ['+5 V', 'Ground', 'A PWM pin', 'Nowhere'], a: 1, why: 'Common cathode means all three cathodes are tied together: connect them to ground.' },
        { q: 'Why one resistor per colour?', opts: ['To save power', 'The LEDs have different forward voltages and each needs its own current limit', 'Arduino requires it', 'It makes colours brighter'], a: 1, why: 'A shared resistor gives unequal currents, and each LED needs its own protection.' }
      ]
    },
    {
      id: 'l33', title: 'Shift registers: 8 outputs from 3 pins', time: '16 min', tag: 'Digital', example: 'shift-register',
      html: `
<p>An Arduino Uno has only 14 digital pins. A <b>74HC595 shift register</b> turns <b>3 pins into 8 outputs</b> (and you can chain more).</p>
<h2>The pins you use</h2>
<table><tr><th>Pin</th><th>Name</th><th>Job</th></tr><tr><td>SER</td><td>serial data</td><td>the next bit to store</td></tr><tr><td>SRCLK</td><td>shift clock</td><td>on a rising edge the register shifts one place and takes SER</td></tr><tr><td>RCLK</td><td>latch</td><td>on a rising edge the shifted bits are copied to the outputs</td></tr><tr><td>/OE</td><td>output enable</td><td>tie to GND (LOW = outputs on)</td></tr><tr><td>/SRCLR</td><td>clear</td><td>tie to VCC (LOW clears the register)</td></tr></table>
<h2>How a byte gets in</h2>
<ol><li>Put the first bit on SER.</li><li>Pulse SRCLK: the bit is shifted in.</li><li>Repeat for all 8 bits.</li><li>Pulse RCLK: all 8 outputs update at once.</li></ol>
<p>The Arduino function <code>shiftOut(dataPin, clockPin, MSBFIRST, value)</code> does steps 1–3 for you. The latch is why the LEDs do not flicker while data is moving: you hold RCLK LOW while shifting, then raise it.</p>
<h2>Bit order</h2>
<p>With MSBFIRST, bit 0 (the least significant) ends up on <b>QA</b> and bit 7 on <b>QH</b>. So <code>show(1 &lt;&lt; i)</code> lights output number <i>i</i>.</p>
<div class="tip"><b>Current limit:</b> each output gives about 20 mA. The app warns above 35 mA. Always use a resistor with each LED.</div>`,
      quiz: [
        { q: 'Which pin copies the shifted bits to the outputs?', opts: ['SER', 'SRCLK', 'RCLK', '/OE'], a: 2, why: 'RCLK is the latch: its rising edge updates the outputs.' },
        { q: 'You call shiftOut(8, 9, MSBFIRST, 0b00000100). Which output lights after the latch?', opts: ['QA', 'QC', 'QE', 'QH'], a: 1, why: 'Bit 2 is set. Bit 0 is QA, so bit 2 is QC.' },
        { q: '/SRCLR left unconnected (floating LOW) does what?', opts: ['Nothing', 'Keeps clearing the register', 'Doubles the outputs', 'Resets the Arduino'], a: 1, why: 'LOW on /SRCLR clears the shift register, so tie it to VCC.' }
      ]
    },
    {
      id: 'l34', title: 'EEPROM: memory that survives power-off', time: '12 min', tag: 'Arduino', example: 'eeprom-counter',
      html: `
<p>Variables live in RAM and vanish when the power goes off. The Arduino Uno also has <b>1024 bytes of EEPROM</b>: memory that <b>keeps its contents without power</b>. Use it for settings, calibration, high scores and counters.</p>
<h2>The functions</h2>
<table><tr><th>Call</th><th>Does</th></tr><tr><td><code>EEPROM.read(addr)</code></td><td>read one byte (0–255)</td></tr><tr><td><code>EEPROM.write(addr, v)</code></td><td>write one byte</td></tr><tr><td><code>EEPROM.update(addr, v)</code></td><td>write only if the value changed</td></tr><tr><td><code>EEPROM.put(addr, x)</code></td><td>store any variable (int, float, struct …)</td></tr><tr><td><code>EEPROM.get(addr, x)</code></td><td>load it back into variable x</td></tr><tr><td><code>EEPROM[addr]</code></td><td>use it like an array</td></tr></table>
<p>Addresses run from 0 to 1023. A brand-new EEPROM holds <b>255 (0xFF)</b> in every cell.</p>
<h2>Wear and speed</h2>
<ul><li>Each cell survives about <b>100 000 writes</b>. Never write inside a fast loop. Prefer <code>update()</code>.</li><li>A write takes about <b>3.3 ms</b>. The simulator charges that time too, so you can feel it.</li></ul>
<h2>A magic number</h2>
<p>How do you know the EEPROM holds your data and not garbage? Store a marker, like <code>magic = 42</code>, beside it. If the marker is missing, this is the first run: write defaults.</p>
<div class="tip"><b>In the lab:</b> press the button a few times, press Stop, then Run: the count continues. The lab keeps the EEPROM until you clear it from the Arduino inspector.</div>`,
      quiz: [
        { q: 'What does a brand-new EEPROM cell contain?', opts: ['0', '255', '1', 'Random'], a: 1, why: 'Erased EEPROM reads as all ones: 0xFF = 255.' },
        { q: 'Why prefer EEPROM.update() to write()?', opts: ['It is faster for new values', 'It skips unchanged bytes and saves wear', 'It stores floats', 'It writes 2 bytes'], a: 1, why: 'Fewer writes means a longer EEPROM life.' },
        { q: 'How many bytes does an int take when stored with EEPROM.put()?', opts: ['1', '2', '4', '8'], a: 1, why: 'On the Uno, int is 2 bytes.' }
      ]
    },
    {
      id: 'l35', title: 'Interrupts: react instantly', time: '14 min', tag: 'Arduino', example: 'interrupt-button',
      html: `
<p>So far the Arduino <b>polls</b>: loop() keeps asking “has anything happened?”. If loop() is busy in <code>delay(1000)</code>, a button press can be missed. An <b>interrupt</b> makes the hardware stop what it is doing, run a short function, and carry on.</p>
<h2>Setting it up</h2>
<pre><code>void onButton() { ... }          // the interrupt handler (ISR)

void setup() {
  pinMode(2, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(2), onButton, FALLING);
}</code></pre>
<p>On the Uno only <b>pin 2 (INT0)</b> and <b>pin 3 (INT1)</b> support this. The mode says when to fire: <b>RISING</b>, <b>FALLING</b>, <b>CHANGE</b> or <b>LOW</b>.</p>
<h2>Rules for handlers</h2>
<ul><li>Keep it <b>short</b>: set a flag, add to a counter.</li><li>No <code>delay()</code> inside (it does nothing). <code>millis()</code> does not advance meaningfully but can be read.</li><li>Variables shared with loop() must be declared <b><code>volatile</code></b> so the compiler always re-reads them.</li><li>Pause interrupts with <code>noInterrupts()</code> and resume with <code>interrupts()</code> when reading multi-byte values.</li></ul>
<h2>Bounce</h2>
<p>Real buttons bounce: one press can create several edges within milliseconds. The example ignores edges within 50 ms of the last one using <code>millis()</code>.</p>
<div class="tip"><b>Try it:</b> while the Serial monitor prints once per second, press the button. The LED reacts immediately even though loop() is asleep.</div>`,
      quiz: [
        { q: 'Which Uno pins can use attachInterrupt()?', opts: ['Any pin', '2 and 3', '0 and 1', '9 to 13'], a: 1, why: 'INT0 is on pin 2 and INT1 on pin 3.' },
        { q: 'Why declare a shared counter volatile?', opts: ['To make it faster', 'So the compiler re-reads it, since an interrupt can change it at any time', 'To store it in EEPROM', 'It is required for int'], a: 1, why: 'Without volatile, the compiler may keep a stale copy in a register.' },
        { q: 'What does delay() do inside an interrupt handler?', opts: ['Waits as usual', 'Nothing, because the timer is blocked', 'Resets the Arduino', 'Disables the handler'], a: 1, why: 'delay() depends on timer interrupts, which are blocked inside a handler.' }
      ]
    },
    {
      id: 'l36', title: 'Tidy code: struct, enum & typedef', time: '14 min', tag: 'Arduino', example: 'struct-traffic',
      html: `
<p>As sketches grow, loose variables get messy. Three C++ tools keep related things together.</p>
<h2>enum: named numbers</h2>
<pre><code>enum Phase { RED, GREEN, YELLOW };   // RED = 0, GREEN = 1, YELLOW = 2
Phase current = RED;</code></pre>
<p>You can set values: <code>enum { LOW_T = 10, HIGH_T = 30 };</code>. An enum makes <code>if (state == RUNNING)</code> readable instead of <code>if (state == 2)</code>.</p>
<h2>struct: a bundle of variables</h2>
<pre><code>struct Light {
  byte pin;
  unsigned int ms;
  Phase next;
};
Light lights[3] = { {12, 3000, GREEN}, {8, 3000, YELLOW}, {10, 1000, RED} };
lights[0].ms = 5000;</code></pre>
<p>Access members with a dot. Structs can be copied, passed to functions (by value, or by reference with <code>&amp;</code> to change the original), returned, put in arrays, and nested inside each other. <code>sizeof(Light)</code> gives the total bytes (4 here).</p>
<h2>typedef: a shorter name</h2>
<pre><code>typedef struct { byte r, g, b; } Color;     // use "Color" without struct
typedef unsigned int u16;</code></pre>
<h2>The traffic light as a table</h2>
<p>The example describes each phase as a row of data: which pin, how long, what comes next. The loop is just three lines and never changes if you add a phase. <b>Data-driven code</b> is easier to extend than a long chain of if statements.</p>
<div class="tip"><b>Tip:</b> structs also work with EEPROM: <code>EEPROM.put(0, settings)</code> saves the whole bundle at once.</div>`,
      quiz: [
        { q: 'enum Color { RED, GREEN = 5, BLUE }; What is BLUE?', opts: ['2', '5', '6', '7'], a: 2, why: 'Values continue counting from the last one: GREEN is 5, so BLUE is 6.' },
        { q: 'How do you read the pin member of a Light variable called l?', opts: ['l->pin', 'l.pin', 'l[pin]', 'pin(l)'], a: 1, why: 'Use the dot operator to reach a member of a struct variable.' },
        { q: 'A struct { byte a; int b; float c; } takes how many bytes on an Uno?', opts: ['3', '5', '7', '8'], a: 2, why: '1 + 2 + 4 = 7 bytes (AVR does not pad).' }
      ]
    },
    {
      id: 'l37', title: 'Reading curves: DC sweep & frequency response', time: '16 min', tag: 'Electronics', example: 'diode-curve', extra: [{ id: 'rcfilter', label: 'Open the RC filter' }],
      html: `
<p>Instead of probing a circuit one value at a time, engineers <b>sweep</b> a value and plot the result. The Analysis menu in the lab gives you two such tools.</p>
<h2>DC sweep</h2>
<p>Pick a part and one of its values (a battery voltage, a pot position, a temperature), a range, and what to measure (a voltage or a current). The simulator solves the circuit again for each step and draws the curve.</p>
<ul><li><b>Diode I–V curve:</b> sweep the battery from 0 to 5 V and plot the resistor current. Nothing flows until about 0.7 V, then the current shoots up. Where it bends is the diode’s “knee”.</li><li><b>Voltage divider:</b> sweep a pot from 0 to 100 % and plot the output: a straight line.</li><li><b>Op-amp:</b> plot output against input and see the straight slope (gain) and the flat clipped ends.</li></ul>
<h2>Frequency response (Bode plot)</h2>
<p>Add an AC signal source and ask for the response between 1 Hz and 100 kHz. For every frequency the simulator runs the circuit with a small sine wave and measures the <b>gain</b> (output ÷ input, in decibels) and the <b>phase shift</b>.</p>
<table><tr><th>Gain</th><th>dB</th></tr><tr><td>×1</td><td>0 dB</td></tr><tr><td>×2</td><td>+6 dB</td></tr><tr><td>×10</td><td>+20 dB</td></tr><tr><td>×0.707 (half power)</td><td>−3 dB</td></tr><tr><td>×0.1</td><td>−20 dB</td></tr></table>
<p>The <b>−3 dB point</b> is the <b>cut-off frequency</b>. For an RC filter, <b>f<sub>c</sub> = 1 ÷ (2π R C)</b>. With 1.6 kΩ and 1 µF that is 99.5 Hz. Above it a low-pass filter loses 20 dB per decade, and its phase tends to −90°.</p>
<div class="tip"><b>Try it:</b> open the RC filter, choose Analysis → Frequency response and compare the marked −3 dB frequency with the formula.</div>`,
      quiz: [
        { q: 'What does a DC sweep do?', opts: ['Runs a sine wave at many frequencies', 'Varies one value and plots a result for each step', 'Burns components', 'Exports a netlist'], a: 1, why: 'It re-solves the circuit for each value of the swept parameter.' },
        { q: 'At the cut-off frequency of a low-pass filter the gain is…', opts: ['0 dB', '−3 dB', '−20 dB', '+3 dB'], a: 1, why: 'The cut-off is defined as the point where the output power has halved: −3 dB.' },
        { q: 'R = 1 kΩ and C = 100 nF. What is f<sub>c</sub>?', opts: ['160 Hz', '1.6 kHz', '16 kHz', '100 Hz'], a: 1, why: 'f = 1 ÷ (2π × 1000 × 100×10⁻⁹) ≈ 1592 Hz.' }
      ]
    }
    ,
    {
      id: 'l38', title: 'Using a multimeter', time: '10 min', tag: 'Electronics', example: 'multimeter-lab',
      html: `
<p>A <b>multimeter</b> is the tool every electronics bench has. One dial, five jobs. In the lab, <b>click the meter</b> to turn the dial.</p>
<h2>Measuring voltage (V=)</h2>
<p>Connect the probes <b>across</b> the part, in parallel: red on the more positive side, black on the other. The meter has a huge resistance (10 MΩ), so it hardly disturbs the circuit. A minus sign means the probes are the wrong way round.</p>
<h2>Measuring current (A=)</h2>
<p>You must <b>break the circuit</b> and put the meter <b>in the gap, in series</b>, so the current flows through it. In this mode the meter is almost a wire (0.1 Ω). <b>Never connect it across a supply</b>: a huge current flows and the 10 A fuse blows. Try it in the lab: the meter shows FUSE and you must press Stop and Run to replace it.</p>
<h2>Measuring resistance (Ω)</h2>
<p>The meter pushes a tiny current through the part and works out R. So the circuit power must be <b>OFF</b> and the part should be measured <b>on its own</b>, otherwise other parts in parallel or a live voltage give a wrong answer. <b>OL</b> means “over limit”: an open circuit.</p>
<h2>Continuity (•))</h2>
<p>Like resistance, but it beeps (the display shows ♪) when the resistance is under about 50 Ω. Use it to check wires, fuses and solder joints.</p>
<h2>AC volts (V~)</h2>
<p>Shows the <b>RMS</b> value. A 5 V peak sine wave reads 3.54 V (peak ÷ √2).</p>
<div class="tip"><b>Rule of thumb:</b> volts are measured <i>across</i>, amps <i>through</i>, ohms with the power <i>off</i>.</div>`,
      quiz: [
        { q: 'To measure the current in a circuit you connect the multimeter…', opts: ['In parallel with the supply', 'In series, in a gap of the circuit', 'Across the load', 'To the Arduino'], a: 1, why: 'The current has to flow through the meter, so it goes in series.' },
        { q: 'What happens in amps mode across a battery?', opts: ['It reads the battery voltage', 'Almost nothing', 'A huge current flows and the fuse blows', 'It beeps'], a: 2, why: 'The meter is nearly a short circuit in amps mode.' },
        { q: 'A 5 V peak sine wave on the AC volts range reads about…', opts: ['5 V', '3.5 V', '10 V', '7.1 V'], a: 1, why: 'RMS = peak ÷ √2 ≈ 0.707 × 5 = 3.54 V.' }
      ]
    }
  ];
  for (const l of L) S21.Lessons.list.push(l);
})(typeof window !== 'undefined' ? window : globalThis);
