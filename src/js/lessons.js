/* ---------------------------------------------------------------
   Smart21 ElectroLab — lessons (original content written for this app)
   --------------------------------------------------------------- */
(function () {
  'use strict';
  const S21 = window.S21;
  const $ = (s, r) => (r || document).querySelector(s);
  const KEY = 's21lab-progress';

  const LESSONS = [
    {
      id: 'l1', title: 'Voltage, current & resistance', time: '8 min', tag: 'Electronics basics', example: 'led-basic',
      html: `
<p>Electricity is the movement of tiny charged particles called <b>electrons</b> through a wire. Three ideas describe almost everything you will build.</p>
<h2>The water-pipe picture</h2>
<table><tr><th>Quantity</th><th>Symbol / unit</th><th>Water analogy</th></tr>
<tr><td><b>Voltage</b></td><td>V, volts (V)</td><td>Water pressure: the “push”</td></tr>
<tr><td><b>Current</b></td><td>I, amperes (A)</td><td>How much water flows per second</td></tr>
<tr><td><b>Resistance</b></td><td>R, ohms (Ω)</td><td>A narrow pipe that slows the flow</td></tr></table>
<p>A battery is the pump. It makes a voltage between its <b>+</b> and <b>−</b> terminals. When you connect a complete loop, current flows out of <b>+</b>, through the parts, and back to <b>−</b>. A loop that is broken (an open switch, a missing wire) carries no current.</p>
<div class="tip"><b>Ground (0 V)</b> is the reference point. Every voltage is really “the difference compared to ground”. In the lab, hover any pin while the simulation runs to read its voltage.</div>
<h2>Prefixes you will meet</h2>
<p>1 kΩ = 1 000 Ω · 1 mA = 0.001 A · 1 µF = 0.000001 F. You can type <code>4.7k</code>, <code>100n</code> or <code>2.2u</code> in any value box.</p>`,
      quiz: [{ q: 'A switch is open. How much current flows in the loop?', opts: ['Maximum current', 'Almost none', 'Exactly the battery voltage'], a: 1, why: 'An open switch breaks the loop, so electrons cannot circulate.' },
             { q: 'Which unit measures resistance?', opts: ['Volt', 'Ampere', 'Ohm'], a: 2, why: 'Resistance is measured in ohms (Ω).' }]
    },
    {
      id: 'l2', title: 'Ohm’s law & power', time: '10 min', tag: 'Electronics basics', example: 'led-basic',
      html: `
<p>In 1827 Georg Ohm found the link between the three quantities:</p>
<div class="formula">V = I × R &nbsp;&nbsp;→&nbsp;&nbsp; I = V ÷ R &nbsp;&nbsp;→&nbsp;&nbsp; R = V ÷ I</div>
<p><b>Worked example.</b> A 9 V battery drives current through a 470 Ω resistor. The LED takes about 1.9 V, so the resistor has 9 − 1.9 = 7.1 V across it:</p>
<div class="formula">I = 7.1 V ÷ 470 Ω = 0.0151 A = 15.1 mA</div>
<h2>Power</h2>
<p>Power is how fast energy is turned into heat or light:</p>
<div class="formula">P = V × I &nbsp;(watts)</div>
<p>That resistor dissipates 7.1 V × 15.1 mA ≈ 0.107 W. A common ¼ W resistor handles it comfortably.</p>
<div class="warnbox"><b>Check the rating.</b> If a part must dissipate more power than it is rated for, it gets hot and can fail.</div>
<h2>Try it</h2>
<p>Open the example, press <b>Run</b>, click the resistor and compare the live <i>V ÷ I</i> with its value. Change the resistor to 1 kΩ: the current drops to about 7 mA and the LED dims.</p>`,
      quiz: [{ q: 'A 5 V supply is across a 1 kΩ resistor. What is the current?', opts: ['5 mA', '50 mA', '0.2 A'], a: 0, why: 'I = V ÷ R = 5 ÷ 1000 = 0.005 A = 5 mA.' },
             { q: 'Current is 20 mA and voltage is 3 V. What is the power?', opts: ['6 mW', '60 mW', '0.6 W'], a: 1, why: 'P = V × I = 3 × 0.02 = 0.06 W = 60 mW.' }]
    },
    {
      id: 'l3', title: 'LEDs & the series resistor', time: '8 min', tag: 'Components', example: 'led-basic',
      html: `
<p>An LED is a <b>diode</b> that glows. It has a polarity: current enters the <b>anode (+, long leg)</b> and leaves the <b>cathode (−, flat side)</b>.</p>
<p>Unlike a resistor, an LED does not limit current. Above its “forward voltage” (about 1.9 V for red, 3 V for blue) the current rises extremely quickly. Without a resistor, the current becomes huge and the LED burns out in a fraction of a second.</p>
<div class="formula">R = (V<sub>supply</sub> − V<sub>LED</sub>) ÷ I<sub>LED</sub></div>
<p>For a red LED on 5 V at 15 mA: R = (5 − 1.9) ÷ 0.015 ≈ 207 Ω → use the next standard value, 220 Ω.</p>
<h2>Experiment</h2>
<ol><li>Run the example and look at the LED current.</li><li>Press <b>Stop</b>, select the resistor and type <code>10</code> for 10 Ω. Run again. What happens?</li><li>Try different LED colours in the inspector and see how the voltage across them changes.</li></ol>
<div class="tip">The simulator burns an LED when it carries more than about 50 mA for a few milliseconds. Press Stop to repair it.</div>`,
      quiz: [{ q: 'Why does an LED need a series resistor?', opts: ['To make it brighter', 'To limit the current so it does not burn out', 'To change its colour'], a: 1, why: 'An LED’s current rises sharply with voltage; the resistor sets a safe current.' },
             { q: 'Which LED leg is the anode?', opts: ['The long leg (+)', 'The flat-side leg (−)', 'Either one'], a: 0, why: 'Current must enter the anode (+) and exit the cathode (−).' }]
    },
    {
      id: 'l4', title: 'Series, parallel & voltage dividers', time: '10 min', tag: 'Circuits', example: 'divider',
      html: `
<h2>Series</h2><p>Parts in a single chain share the <b>same current</b>. Resistances add: <code>R<sub>total</sub> = R1 + R2</code>. The supply voltage is split between them.</p>
<h2>Parallel</h2><p>Parts connected across the same two points share the <b>same voltage</b>. Currents add and the total resistance gets smaller: <code>1/R<sub>total</sub> = 1/R1 + 1/R2</code>.</p>
<h2>The voltage divider</h2>
<div class="formula">V<sub>out</sub> = V<sub>in</sub> × R2 ÷ (R1 + R2)</div>
<p>With 9 V, R1 = 1 kΩ and R2 = 2 kΩ: V<sub>out</sub> = 9 × 2000 ÷ 3000 = <b>6 V</b>. Run the example and hover the middle point to confirm.</p>
<p>Dividers are everywhere: a potentiometer is an adjustable divider, and sensors such as the light-dependent resistor (LDR) become voltage signals the Arduino can read.</p>
<div class="tip"><b>Challenge:</b> change R2 to 1 kΩ. Predict V<sub>out</sub> before you run it.</div>`,
      quiz: [{ q: 'Two 100 Ω resistors in series. Total resistance?', opts: ['50 Ω', '100 Ω', '200 Ω'], a: 2, why: 'Series resistances add.' },
             { q: 'Two 100 Ω resistors in parallel. Total resistance?', opts: ['50 Ω', '100 Ω', '200 Ω'], a: 0, why: '1/R = 1/100 + 1/100 = 2/100, so R = 50 Ω.' }]
    },
    {
      id: 'l5', title: 'Capacitors & the RC time constant', time: '10 min', tag: 'Components', example: 'rc',
      html: `
<p>A capacitor stores electric charge, like a tiny rechargeable tank. Through a resistor it charges gradually:</p>
<div class="formula">τ = R × C &nbsp;&nbsp;&nbsp; V(t) = V<sub>supply</sub> × (1 − e<sup>−t/τ</sup>)</div>
<p>With 10 kΩ and 100 µF, τ = 10 000 × 0.0001 = <b>1 second</b>. After one τ the capacitor reaches 63% of the supply; after 5τ it is practically full.</p>
<h2>Run it</h2>
<p>The example has a scope probe on the capacitor. Press <b>Run</b>, switch to the <b>Scope</b> tab, then click the switch to close it. Watch the curve rise to about 3.16 V (63% of 5 V) after 1 s. Set the time window to 5 s for the full curve.</p>
<div class="tip">Capacitors are used for timing, smoothing power, and filtering noise. They block steady DC but let changing signals through.</div>`,
      quiz: [{ q: 'R = 100 kΩ and C = 10 µF. What is τ?', opts: ['0.1 s', '1 s', '10 s'], a: 1, why: '100 000 × 0.00001 = 1 s.' },
             { q: 'After about how many time constants is a capacitor almost fully charged?', opts: ['1', '5', '100'], a: 1, why: 'At 5τ it has reached 99.3%.' }]
    },
    {
      id: 'l6', title: 'Diodes & transistors', time: '12 min', tag: 'Components', example: 'npn',
      html: `
<h2>Diode</h2><p>A diode is a one-way valve. Current passes anode → cathode (dropping about 0.7 V for silicon) and is blocked in reverse. Uses: protection from reversed batteries, rectifying AC to DC.</p>
<h2>NPN transistor</h2>
<p>A transistor has three legs: <b>base (B)</b>, <b>collector (C)</b> and <b>emitter (E)</b>. A small current into the base lets a much larger current flow from collector to emitter.</p>
<div class="formula">I<sub>C</sub> ≈ β × I<sub>B</sub> &nbsp;(β ≈ 100 in the active region)</div>
<p>Used as a <b>switch</b>, the transistor is either cut off (no base current → off) or saturated (plenty of base current → fully on, V<sub>CE</sub> ≈ 0.1 V). That is how a tiny Arduino pin controls a motor or a bright lamp.</p>
<h2>Experiment</h2>
<ol><li>Run the example. The LED is off because the switch is open (no base current).</li><li>Close the switch. About 0.8 mA flows into the base and ~14 mA through the LED. Click the transistor to see its mode.</li><li>Increase the base resistor to 1 MΩ. The transistor leaves saturation and moves into the active region.</li></ol>`,
      quiz: [{ q: 'In switch mode with no base current, the transistor is…', opts: ['Saturated', 'Cut off (off)', 'Broken'], a: 1, why: 'No base current means no collector current.' },
             { q: 'With β = 100 and a base current of 0.1 mA, the (non-saturated) collector current is about…', opts: ['1 mA', '10 mA', '100 mA'], a: 1, why: 'I_C = β × I_B = 100 × 0.1 mA = 10 mA.' }]
    },
    {
      id: 'l7', title: 'Meet the Arduino Uno', time: '8 min', tag: 'Arduino', example: 'blink',
      html: `
<p>The Arduino Uno is a small computer on a board. Its chip (the ATmega328P) runs the program you write, called a <b>sketch</b>, and talks to the world through <b>pins</b>.</p>
<table><tr><th>Pins</th><th>What they do</th></tr>
<tr><td><b>D0–D13</b></td><td>Digital: read or write only HIGH (5 V) or LOW (0 V). Pins marked ~ (3, 5, 6, 9, 10, 11) can also do PWM.</td></tr>
<tr><td><b>A0–A5</b></td><td>Analog inputs: measure 0–5 V as a number from 0 to 1023.</td></tr>
<tr><td><b>5V / 3V3 / GND</b></td><td>Power for your circuit, and the 0 V reference.</td></tr></table>
<h2>Every sketch has two parts</h2>
<pre>void setup() {
  // runs once at the start
}
void loop() {
  // runs again and again, forever
}</pre>
<div class="warnbox"><b>Limits to remember:</b> each pin should supply no more than 20 mA (absolute max 40 mA). That is why LEDs always get a resistor. The simulator warns you when a pin is overloaded.</div>
<p>In the lab, the <b>Sketch</b> tab holds the code, the <b>Serial monitor</b> shows what your program prints, and the virtual board runs it in real time against your circuit.</p>`,
      quiz: [{ q: 'Which function runs only once?', opts: ['loop()', 'setup()', 'main()'], a: 1, why: 'setup() runs once, then loop() repeats forever.' },
             { q: 'A0–A5 can read…', opts: ['Only HIGH or LOW', 'A value 0–1023 for 0–5 V', 'Only 3.3 V'], a: 1, why: 'The analog-to-digital converter gives 10-bit values: 0 to 1023.' }]
    },
    {
      id: 'l8', title: 'Digital output: Blink & traffic lights', time: '12 min', tag: 'Arduino', example: 'traffic',
      html: `
<pre>pinMode(13, OUTPUT);     // make pin 13 an output
digitalWrite(13, HIGH);  // 5 V on the pin  → LED on
delay(1000);             // wait 1000 ms
digitalWrite(13, LOW);   // 0 V on the pin  → LED off</pre>
<p><code>pinMode</code> tells the chip how to use a pin. <code>digitalWrite</code> sets it. <code>delay(ms)</code> pauses the sketch while the circuit keeps running.</p>
<h2>Make names, not numbers</h2>
<pre>const int RED = 12;
pinMode(RED, OUTPUT);</pre>
<p>Names make a sketch easier to read and change. Tiny helper functions like <code>allOff()</code> in the traffic-light example avoid repeating yourself.</p>
<h2>Experiments</h2>
<ol><li>Open <b>Blink</b>. Change <code>delay(1000)</code> to <code>delay(100)</code> and Run again.</li><li>Delete the line <code>pinMode(...)</code>. The Console explains why the LED misbehaves.</li><li>Open <b>Traffic light</b> and add a flashing-yellow mode of your own.</li></ol>
<div class="tip">Use the <b>0.1×</b> speed to watch fast changes in slow motion.</div>`,
      quiz: [{ q: 'What does delay(500) do?', opts: ['Waits 500 seconds', 'Waits half a second', 'Repeats 500 times'], a: 1, why: 'delay() takes milliseconds: 500 ms = 0.5 s.' },
             { q: 'Which call must come first for an LED on pin 9?', opts: ['pinMode(9, OUTPUT)', 'delay(9)', 'analogRead(9)'], a: 0, why: 'The pin needs to be set up as an OUTPUT (usually in setup()).' }]
    },
    {
      id: 'l9', title: 'Digital input: buttons & pull-ups', time: '10 min', tag: 'Arduino', example: 'button',
      html: `
<p>A pin set as <code>INPUT</code> and connected to nothing “floats”: it picks up noise and reads random values. A <b>pull-up resistor</b> gives it a default level.</p>
<p>The Uno has a built-in pull-up you can switch on with <code>INPUT_PULLUP</code>. Wire the button between the pin and GND:</p>
<ul><li>Button not pressed → the pull-up holds the pin <b>HIGH</b>.</li><li>Button pressed → the pin is connected to GND → reads <b>LOW</b>.</li></ul>
<pre>pinMode(2, INPUT_PULLUP);
if (digitalRead(2) == LOW) {
  // button is pressed
}</pre>
<p>It feels backwards at first (pressed = LOW), but it needs no extra parts, which is why it is so popular.</p>
<h2>Experiments</h2>
<ol><li>Run the example and hold the button (mouse down on it). Watch the Serial monitor.</li><li>Change the sketch so the LED toggles on each press (store the state in a variable).</li></ol>
<div class="tip">Real buttons “bounce” for a few milliseconds when pressed; a short <code>delay(20)</code> is a quick debounce.</div>`,
      quiz: [{ q: 'With INPUT_PULLUP and a button to GND, a pressed button reads…', opts: ['HIGH', 'LOW', 'Random'], a: 1, why: 'Pressing connects the pin to GND (0 V), so it reads LOW.' }]
    },
    {
      id: 'l10', title: 'Analog input & PWM', time: '12 min', tag: 'Arduino', example: 'fade',
      html: `
<h2>Reading analog values</h2>
<p><code>analogRead(A0)</code> measures a voltage between 0 V and 5 V and returns a number from 0 to 1023. 2.5 V gives about 512.</p>
<h2>Faking analog output with PWM</h2>
<p>The Uno cannot output a steady 2.5 V, but it can switch a pin on and off very fast (490 times a second). The fraction of time spent HIGH is the <b>duty cycle</b>. Your eyes see the average, so an LED looks half-bright at 50%.</p>
<pre>analogWrite(9, 128);   // 0..255 → about 50% brightness</pre>
<p>Because analogRead gives 0–1023 and analogWrite wants 0–255, the <code>map()</code> function rescales:</p>
<pre>int brightness = map(raw, 0, 1023, 0, 255);</pre>
<h2>Experiment</h2>
<p>Run the example, select the potentiometer and drag its slider (or scroll the mouse wheel over it). Compare the Serial output with the LED brightness. Then add a probe on pin D9 (Shift+click) and watch the PWM waveform on the Scope with a 10 ms window.</p>`,
      quiz: [{ q: 'analogRead returns 512. About what voltage is on the pin?', opts: ['1 V', '2.5 V', '5 V'], a: 1, why: '512 ÷ 1023 × 5 V ≈ 2.5 V.' },
             { q: 'analogWrite(9, 255) gives…', opts: ['Always LOW', 'Always HIGH (100% duty)', '50% duty'], a: 1, why: '255 is the maximum: the pin stays HIGH.' }]
    },
    {
      id: 'l11', title: 'Sensors & the Serial monitor', time: '10 min', tag: 'Arduino', example: 'ldr',
      html: `
<p>A light-dependent resistor (LDR) changes resistance with brightness: about 300 Ω in bright light, 100 kΩ in the dark. Put it in a voltage divider with a fixed resistor and the Arduino can read the light level.</p>
<pre>Serial.begin(9600);          // in setup()
Serial.println(value);       // prints a number and a new line</pre>
<p>Without <code>Serial.begin</code>, nothing appears, just like on a real board. The simulator tells you when you forget it.</p>
<h2>Use a threshold</h2>
<pre>if (light &lt; 400) {
  digitalWrite(LED, HIGH);
}</pre>
<h2>Experiments</h2>
<ol><li>Run the example and move the LDR’s light slider. When does the LED switch?</li><li>Print a message only when the state changes.</li><li>Add a second threshold so the LED does not flicker around the limit (hysteresis).</li></ol>`,
      quiz: [{ q: 'Which function prints a value on the Serial monitor?', opts: ['Serial.println()', 'print.Serial()', 'Monitor.write()'], a: 0, why: 'Serial.print() and Serial.println() send text to the monitor.' }]
    },
    {
      id: 'l12', title: 'Sound with tone()', time: '8 min', tag: 'Arduino', example: 'melody',
      html: `
<p>Sound is vibration. A <b>passive buzzer</b> makes a note when you drive it with a square wave at the note’s frequency; <code>tone(pin, frequency)</code> generates that wave and <code>noTone(pin)</code> stops it.</p>
<table><tr><th>Note</th><th>C4</th><th>D4</th><th>E4</th><th>F4</th><th>G4</th><th>A4</th><th>B4</th><th>C5</th></tr><tr><td>Hz</td><td>262</td><td>294</td><td>330</td><td>349</td><td>392</td><td>440</td><td>494</td><td>523</td></tr></table>
<p>An <b>active buzzer</b> has its own oscillator and just needs power, like an LED.</p>
<h2>Experiments</h2>
<ol><li>Turn on the speaker button in the toolbar, then Run.</li><li>Use an array of notes and a for-loop, as in the example.</li><li>Change the durations to make a simple tune.</li></ol>`,
      quiz: [{ q: 'A4 is 440 Hz. What is the signal on the pin?', opts: ['A steady 5 V', 'A square wave switching 440 times a second', 'A random signal'], a: 1, why: 'tone() produces a 50% duty square wave at the requested frequency.' }]
    },
    {
      id: 'l13', title: 'Remember state: one-button toggle & debounce', time: '12 min', tag: 'Arduino', example: 'toggle',
      html: `
<p>So far the LED followed the button: pressed = on, released = off. A real light switch is different: <b>each press flips</b> the light and it <i>stays</i> that way. To do that, the sketch must <b>remember</b> something between runs of <code>loop()</code>.</p>
<h2>1. A variable that remembers</h2>
<p>Variables declared <b>outside</b> any function keep their value forever. Declared inside <code>loop()</code>, they would reset on every pass.</p>
<pre>bool ledOn = false;     // global: survives between loops
...
ledOn = !ledOn;         // ! means NOT: flips true/false
digitalWrite(LED, ledOn);</pre>
<h2>2. React to the <i>edge</i>, not the level</h2>
<p><code>loop()</code> runs thousands of times a second. If you flip the LED whenever the button <i>is</i> pressed, one press (say 150 ms) flips it hundreds of times and the result looks random. Instead, act only at the <b>moment</b> the reading changes from HIGH (released) to LOW (pressed), an <b>edge</b>.</p>
<h2>3. Contact bounce</h2>
<p>Real switch contacts are springy. For a few milliseconds after a press the signal flickers LOW-HIGH-LOW-HIGH before settling. Without protection, one press can look like several. <b>Debouncing</b> means ignoring changes until the signal has stayed the same for a short time (about 20 ms):</p>
<pre>if (reading != lastReading) { lastChange = millis(); lastReading = reading; }
if (millis() - lastChange > 20 &amp;&amp; reading != stableState) {
  stableState = reading;
  // now it is safe to act on stableState
}</pre>
<div class="tip">This uses <code>millis()</code> instead of <code>delay()</code>, so the sketch is never frozen and could do other jobs at the same time.</div>
<h2>Experiments</h2>
<ol>
<li>Run the example. Hold the button for a few seconds: the LED flips <b>once</b>. Release and press again: it flips back. Watch the Serial monitor.</li>
<li>Add a probe on pin D2 (Shift+click) and watch the signal on the Scope: HIGH while released, LOW while pressed.</li>
<li><b>Break it on purpose:</b> change the second <code>if</code> so it reacts to the level only (<code>if (reading == LOW)</code> with no <code>stableState</code> check). Hold the button and see the LED flicker wildly.</li>
<li>Challenge: add a second LED on pin 12 that turns on only while the first one is off.</li>
</ol>
<div class="warnbox"><b>Note:</b> the simulator’s button is a perfect switch with no bounce, so the debounce code cannot be seen working here. On real hardware it is essential. Keep it in every button sketch.</div>`,
      quiz: [{ q: 'Where must a variable be declared so it keeps its value between loop() runs?', opts: ['Inside loop()', 'Outside all functions (global)', 'Inside setup() only'], a: 1, why: 'Global variables live for the whole program; variables inside loop() are recreated on every pass.' },
             { q: 'Why react to the button “edge” instead of its level?', opts: ['Edges are faster to read', 'A single press lasts many loop() passes and would flip the LED many times', 'The Arduino cannot read levels'], a: 1, why: 'A press lasts far longer than one loop(). Acting only when the state changes makes one press equal one action.' },
             { q: 'What does debouncing do?', opts: ['Ignores rapid flicker right after a contact changes', 'Makes the LED brighter', 'Speeds up the sketch'], a: 0, why: 'Switch contacts bounce for a few milliseconds; debouncing waits until the signal is stable.' }]
    },
    {
      id: 'l14', title: 'Thresholds & hysteresis (no flicker)', time: '10 min', tag: 'Arduino', example: 'hysteresis',
      html: `
<p>Your night light from lesson 11 switches on when <code>light &lt; 400</code>. Now imagine the room is lit at exactly the limit. Sensor readings always wobble a little (electrical noise, passing shadows, mains flicker): 401, 399, 402, 398… The lamp flicks on and off many times a second. Annoying, and bad for relays and motors too.</p>
<h2>The cure: two thresholds</h2>
<p>A thermostat does not switch the heating on at 20.0 °C and off at 20.0 °C. It turns on at 19 °C and off at 21 °C. The gap between the two limits is called <b>hysteresis</b>. Inside the gap the system simply <b>keeps its previous state</b>.</p>
<pre>const int ON_BELOW  = 350;   // clearly dark   → lamp ON
const int OFF_ABOVE = 450;   // clearly bright → lamp OFF
bool lampOn = false;         // remembers the state

if (!lampOn &amp;&amp; light &lt; ON_BELOW)   lampOn = true;
else if (lampOn &amp;&amp; light &gt; OFF_ABOVE) lampOn = false;</pre>
<p>Notice it needs a variable that remembers (lesson 13) and that the <code>else if</code> only runs while the lamp is on.</p>
<table><tr><th>Reading</th><th>Lamp was OFF</th><th>Lamp was ON</th></tr><tr><td>&lt; 350</td><td>turns ON</td><td>stays ON</td></tr><tr><td>350 – 450</td><td>stays OFF</td><td>stays ON</td></tr><tr><td>&gt; 450</td><td>stays OFF</td><td>turns OFF</td></tr></table>
<h2>Experiments</h2>
<ol><li>Run the example. Drag the LDR light slider down to about 25%: the lamp turns on.</li><li>Slowly raise the light to 60%: it <b>stays on</b> (the reading is in the gap). Raise it to 85% and it turns off.</li><li>Move back to 60%: now it <b>stays off</b>. Same light level, different result: that is hysteresis.</li><li>Narrow the gap to <code>ON_BELOW = 399</code>, <code>OFF_ABOVE = 401</code> and imagine noise of ±5. What would happen?</li></ol>
<div class="tip">The same idea in hardware is called a <b>Schmitt trigger</b>. It also cleans noisy signals into crisp HIGH/LOW levels.</div>`,
      quiz: [{ q: 'The lamp is ON and the reading is 400 (between 350 and 450). What happens?', opts: ['It turns OFF', 'It stays ON', 'It blinks'], a: 1, why: 'Inside the gap the previous state is kept; it only turns off above 450.' },
             { q: 'What problem does hysteresis solve?', opts: ['Slow sensors', 'Flickering when a noisy reading sits near a single threshold', 'Low brightness'], a: 1, why: 'Two separate thresholds stop small noise from toggling the output repeatedly.' }]
    },
    {
      id: 'l15', title: 'Driving bigger loads with a transistor', time: '14 min', tag: 'Arduino', example: 'driver',
      html: `
<p>An Arduino pin is fragile: <b>20 mA recommended, 40 mA absolute maximum</b> (and about 200 mA for the whole chip). A buzzer, relay, motor or a strip of LEDs needs far more. The trick: the pin controls a <b>transistor</b>, and the transistor switches the heavy load from a separate supply.</p>
<h2>The circuit</h2>
<ul><li>Pin → <b>base resistor</b> → transistor <b>base</b>.</li><li>Transistor <b>emitter</b> → ground.</li><li>Load between the supply (+) and the transistor <b>collector</b>.</li><li><b>Common ground:</b> the load supply’s − must be connected to Arduino GND, or the transistor has no shared reference.</li></ul>
<h2>Choosing the base resistor</h2>
<p>To saturate the transistor (fully on), give it more base current than the load strictly needs. Use a safety factor of about 5 to 10:</p>
<div class="formula">I<sub>B</sub> ≈ (I<sub>load</sub> ÷ β) × 5 &nbsp;&nbsp;→&nbsp;&nbsp; R<sub>B</sub> = (5 V − 0.7 V) ÷ I<sub>B</sub></div>
<p>Example: load 20 mA, β = 100 → I<sub>B</sub> = 1 mA → R<sub>B</sub> ≈ 4.3 kΩ. A 1 kΩ resistor gives 4.3 mA, which is plenty and still gentle on the pin.</p>
<h2>Run it and look inside</h2>
<ol><li>Run the example, turn the sound on (toolbar), and listen: it beeps for 0.2 s every second.</li><li>Click the Arduino and read the pin current: only a few mA. Click the transistor: <i>Saturation</i> when beeping, <i>Cutoff</i> otherwise.</li><li>Change the base resistor to 220 kΩ. The base current becomes tiny, the transistor leaves saturation and the buzzer gets too little voltage to sound.</li><li>Select the ground symbol under the battery and delete it. The buzzer falls silent: the battery’s − is no longer joined to the Arduino’s ground, so there is no complete loop through the transistor. That is why separate supplies need a <b>common ground</b>.</li></ol>
<div class="warnbox"><b>Motors and relays are inductive.</b> When switched off they create a voltage spike. In real circuits put a diode across the load (cathode to +), the <b>flyback diode</b>, to protect the transistor. The simulator’s resistive buzzer does not need one.</div>`,
      quiz: [{ q: 'Why use a transistor between the Arduino pin and a motor?', opts: ['The motor needs more current than a pin can supply', 'To make the sketch run faster', 'To reduce the motor’s voltage'], a: 0, why: 'A pin gives ≤ 20 mA; the transistor lets a small base current switch a much larger load current.' },
             { q: 'What must be connected between the Arduino and a separate load supply?', opts: ['Their + terminals', 'Their grounds', 'Nothing'], a: 1, why: 'A common ground gives both circuits the same 0 V reference.' },
             { q: 'Base current should be…', opts: ['Exactly I_load ÷ β', 'More than I_load ÷ β so the transistor saturates', 'Zero when the load is on'], a: 1, why: 'Extra base current drives the transistor fully on (V_CE ≈ 0.1 V).' }]
    },
    {
      id: 'l16', title: 'AC signals, filters & inductors', time: '16 min', tag: 'Electronics', example: 'rcfilter', extra: [{ id: 'rl', label: 'Open the inductor (RL) example' }],
      html: `
<p>So far everything was DC: steady voltages. Many real signals <b>change continuously</b>: audio, radio, mains power, sensor waveforms. The simplest is the <b>sine wave</b>, described by its <b>amplitude</b> (peak voltage) and <b>frequency</b> (cycles per second, in hertz). Period T = 1 ÷ f. At 100 Hz one cycle lasts 10 ms.</p>
<h2>The AC signal source</h2>
<p>The <b>AC signal source</b> is a function generator: sine, square or triangle, up to 1 kHz here. Shift+click its + pin to see the wave on the <b>Scope</b> (set the window to 50 ms for 100 Hz).</p>
<h2>Low-pass filter: a resistor and a capacitor</h2>
<p>A capacitor lets quick changes through more easily than slow ones: its opposition (reactance) is X<sub>C</sub> = 1 ÷ (2π f C). Together with a resistor it forms a <b>low-pass filter</b>: low frequencies pass, high frequencies are weakened. The <b>cutoff frequency</b> is where the output has dropped to 71% (−3 dB):</p>
<div class="formula">f<sub>c</sub> = 1 ÷ (2π × R × C)</div>
<p>With R = 1.6 kΩ and C = 1 µF: f<sub>c</sub> = 1 ÷ (2π × 1600 × 0.000001) ≈ <b>99.5 Hz</b>.</p>
<table><tr><th>Input frequency</th><th>Output ÷ input (measured in the simulator)</th></tr><tr><td>10 Hz</td><td>≈ 1.00 (passes)</td></tr><tr><td>100 Hz (cutoff)</td><td>≈ 0.71</td></tr><tr><td>1 kHz</td><td>≈ 0.10 (strongly reduced)</td></tr></table>
<p>Uses: removing hiss and noise, smoothing a PWM signal into a steady voltage, the “bass” control in audio.</p>
<h2>The inductor</h2>
<p>An inductor is a coil. It stores energy in a magnetic field and <b>resists changes in current</b>: <code>V = L × dI/dt</code>. Switch a voltage on across an inductor in series with a resistor and the current <i>ramps up</i> instead of jumping, with time constant:</p>
<div class="formula">τ = L ÷ R</div>
<p>With L = 100 mH and R = 100 Ω, τ = 1 ms. An inductor is the “mirror image” of a capacitor: the capacitor resists changes in <i>voltage</i>.</p>
<h2>Experiments</h2>
<ol><li>Open the RC filter, press Run. The scope shows input and output. Select the AC source and change the frequency to 10 Hz, then 1 kHz (adjust the scope window). Watch the output amplitude shrink.</li><li>Change the capacitor to 100 nF. Where does the cutoff go now? Predict first.</li><li>Open the RL example: a square wave drives the inductor. Watch the voltage across the resistor (= current × 100 Ω) curve up in about 1 ms.</li><li>Change L to 10 mH: the current now settles 10× faster.</li></ol>`,
      quiz: [{ q: 'R = 1 kΩ and C = 1 µF. What is the cutoff frequency (approx.)?', opts: ['16 Hz', '160 Hz', '1 600 Hz'], a: 1, why: 'f = 1 ÷ (2π × 1000 × 0.000001) ≈ 159 Hz.' },
             { q: 'An RC low-pass filter mainly weakens…', opts: ['Low frequencies', 'High frequencies', 'DC only'], a: 1, why: 'The capacitor shorts out fast-changing signals, so high frequencies are reduced; DC and low frequencies pass.' },
             { q: 'L = 50 mH, R = 50 Ω. Time constant?', opts: ['1 ms', '2.5 ms', '1 s'], a: 0, why: 'τ = L ÷ R = 0.05 ÷ 50 = 0.001 s = 1 ms.' }]
    },
    {
      id: 'l17', title: 'DC motors & PWM speed control', time: '14 min', tag: 'Motion', example: 'motor-pwm',
      html: `
<p>A small DC motor turns electrical energy into rotation. Apply a voltage and it spins; <b>more voltage = more speed</b>; <b>swap the two wires and it spins the other way</b>. But a motor needs <b>100–500 mA</b> while an Arduino pin can give only 20–40 mA, so you can never connect it straight to a pin.</p>
<h2>The driver circuit (you met it in lesson 15)</h2>
<ul><li>Pin 9 → <b>1 kΩ</b> → transistor base.</li><li>Motor between the motor supply (+) and the collector. Emitter to ground. <b>Grounds joined.</b></li><li>A <b>flyback diode</b> across the motor (stripe/cathode towards +).</li></ul>
<h2>Speed with PWM</h2>
<p>Switching the transistor on and off 490 times a second gives the motor an <i>average</i> voltage of V<sub>supply</sub> × duty. Because the rotor has inertia it does not jerk; it just spins at a speed that follows that average. <code>analogWrite(9, 128)</code> (50% duty) gives roughly half speed.</p>
<div class="formula">average voltage ≈ duty × V<sub>supply</sub> &nbsp;&nbsp; duty = analogWrite value ÷ 255</div>
<h2>Why the diode?</h2>
<p>A motor is a coil (an inductor, lesson 16). When the transistor switches off, the coil tries to keep the current flowing and produces a voltage spike that can be much higher than the supply, enough to destroy the transistor. The diode gives that current a safe path to circulate. <b>Always add it for motors, relays and solenoids.</b> (The simulator’s simple motor model does not make spikes, but real ones do.)</p>
<h2>Experiments</h2>
<ol><li>Run the example. Select the motor and watch the speed (rpm) rise and fall as the sketch ramps PWM.</li><li>Change <code>analogWrite</code> to a fixed value such as 100 and find the lowest value at which the motor still starts (there is a dead zone).</li><li>Click the Arduino: the pin supplies only a few mA while the motor takes about 200 mA.</li><li>Delete the transistor and wire the motor straight to pin 9. Run it and read the warning.</li><li>Swap the motor wires (rotate it 180°): it spins backwards. An <b>H-bridge</b> chip does this under program control.</li></ol>`,
      quiz: [{ q: 'analogWrite(9, 64) gives a duty cycle of about…', opts: ['25%', '50%', '64%'], a: 0, why: '64 ÷ 255 ≈ 0.25.' },
             { q: 'What does the flyback diode protect against?', opts: ['Too much current from the battery', 'A voltage spike when the motor coil is switched off', 'Reversed polarity of the Arduino'], a: 1, why: 'The collapsing magnetic field in the coil creates a spike; the diode gives it a safe path.' },
             { q: 'Why not connect a motor directly to an Arduino pin?', opts: ['It would spin too fast', 'The motor needs far more current than a pin can supply', 'Pins only output 3.3 V'], a: 1, why: 'A pin supplies ≤ 20–40 mA; a motor needs hundreds of mA.' }]
    },
    {
      id: 'l18', title: 'Servo motors & the Servo library', time: '12 min', tag: 'Motion', example: 'servo-sweep', extra: [{ id: 'servo-pot', label: 'Open the knob-controlled servo' }],
      html: `
<p>A <b>servo</b> contains a motor, gears and a small control circuit. You tell it an <b>angle</b> (0–180°) and it moves there and holds the position. Perfect for robot arms, steering, and pointing sensors.</p>
<h2>Three wires</h2>
<table><tr><th>Wire</th><th>Goes to</th></tr><tr><td>Brown / black</td><td>GND</td></tr><tr><td>Red</td><td>5 V (a supply that can give several hundred mA)</td></tr><tr><td>Orange / yellow</td><td>A signal pin (any digital pin)</td></tr></table>
<p>The signal is not PWM brightness: it is a <b>pulse every 20 ms</b> whose <i>width</i> sets the angle: about 1 ms for 0°, 1.5 ms for 90°, 2 ms for 180°. The <code>Servo</code> library creates it for you.</p>
<pre>#include &lt;Servo.h&gt;
Servo myServo;               // make a servo object
void setup() { myServo.attach(9); }
void loop()  { myServo.write(90); }   // go to 90 degrees</pre>
<div class="warnbox"><b>Power:</b> a moving servo can draw several hundred mA. Many servos on the Arduino’s 5 V pin will reset the board. Use a separate supply and <b>join the grounds</b>. The example does exactly that.</div>
<h2>Experiments</h2>
<ol><li>Run <b>Servo sweep</b>. Shift+click is already set up: the scope shows the control pulse on pin 9.</li><li>Zoom the scope to 10 ms and measure the pulse width at different angles.</li><li>Delete the battery. The inspector says “No power” and the arm stops: a classic real-life bug.</li><li>Open the knob-controlled version: <code>map(raw, 0, 1023, 0, 180)</code> converts the potentiometer reading to an angle.</li><li>Make the sweep faster/slower by changing the step and the <code>delay(15)</code>. Why does the servo need the delay?</li></ol>`,
      quiz: [{ q: 'What sets a servo’s angle?', opts: ['The voltage on the signal wire', 'The width of a pulse repeated every 20 ms', 'The brightness of PWM'], a: 1, why: 'About 1 ms = 0°, 2 ms = 180°.' },
             { q: 'Your servo twitches and the Arduino resets. Likely cause?', opts: ['Wrong baud rate', 'The servo draws too much current from the Arduino 5 V', 'A missing semicolon'], a: 1, why: 'Use a separate supply with a common ground.' }]
    },
    {
      id: 'l19', title: 'Text on a 16×2 LCD', time: '14 min', tag: 'Displays', example: 'lcd-hello', extra: [{ id: 'lcd-volts', label: 'Open the LCD voltmeter' }],
      html: `
<p>The 16×2 character LCD shows 2 rows of 16 characters. It has 16 pins, but in <b>4-bit mode</b> you need only <b>six signal wires</b> from the Arduino:</p>
<table><tr><th>LCD pin</th><th>Job</th><th>Arduino (example)</th></tr><tr><td>RS</td><td>Register select: command or character</td><td>12</td></tr><tr><td>E</td><td>Enable: “read the data now”</td><td>11</td></tr><tr><td>D4–D7</td><td>4 data lines</td><td>5, 4, 3, 2</td></tr></table>
<p>The other pins are power and settings: <b>VSS</b> to GND, <b>VDD</b> to 5 V, <b>V0</b> contrast (GND or a potentiometer), <b>RW</b> to GND (write only), <b>A/K</b> backlight. The part has a <b>Simplified power</b> checkbox that does these for you; untick it when you want to wire them yourself.</p>
<pre>#include &lt;LiquidCrystal.h&gt;
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);  // rs, en, d4, d5, d6, d7
void setup() {
  lcd.begin(16, 2);          // columns, rows
  lcd.print("Hello!");
}</pre>
<table><tr><th>Function</th><th>Does</th></tr><tr><td><code>lcd.setCursor(col, row)</code></td><td>moves the cursor (row 0 = top)</td></tr><tr><td><code>lcd.print(x)</code></td><td>prints text or a number; <code>lcd.print(3.14159, 2)</code> gives 3.14</td></tr><tr><td><code>lcd.clear()</code></td><td>wipes the screen</td></tr></table>
<h2>Classic mistakes (try them!)</h2>
<ol><li><b>Black boxes on row 1:</b> you forgot <code>lcd.begin(16, 2)</code>. Delete that line and Run.</li><li><b>Blank screen:</b> a signal wire is missing or on the wrong pin. Delete one wire: the inspector tells you which pin should connect where.</li><li><b>Leftover characters</b> after a number gets shorter (e.g. “10” → “9” shows “90”): print spaces afterwards, as the voltmeter example does with <code>" V    "</code>.</li><li><b>Invisible text:</b> contrast pin V0 too high. Untick “Simplified power” and leave V0 unconnected or wired to 5 V to see the message.</li></ol>`,
      quiz: [{ q: 'The LCD shows only a row of black boxes. What is the most likely cause?', opts: ['Missing lcd.begin()', 'Too many wires', 'delay() is too short'], a: 0, why: 'Until lcd.begin() initialises the display it shows its power-on pattern.' },
             { q: 'How many Arduino pins does 4-bit mode need?', opts: ['2', '6', '16'], a: 1, why: 'RS, E and D4–D7.' },
             { q: 'What does lcd.setCursor(0, 1) do?', opts: ['Moves to the first column of the second row', 'Clears the screen', 'Moves to row 0, column 1'], a: 0, why: 'Arguments are (column, row), both starting at 0.' }]
    },
    {
      id: 'l20', title: '7-segment displays & bit patterns', time: '12 min', tag: 'Displays', example: 'sevenseg',
      html: `
<p>A <b>7-segment display</b> is seven LEDs shaped like a figure 8, labelled <b>a–g</b>, plus a decimal point (dp). Light the right combination and you get any digit.</p>
<p>In a <b>common-cathode</b> display all the LED cathodes are tied together (COM → GND). Raise a segment pin HIGH to light that segment. (Common-anode displays are the opposite: COM to 5 V, pins LOW = lit.) Each segment is an LED, so it needs a <b>series resistor</b> (about 220 Ω); the example part has them built in, and you can turn that off to wire your own.</p>
<h2>Digits as bytes</h2>
<p>Eight segments = eight bits = one byte. Bit 0 is segment a, bit 1 is b, … bit 6 is g, bit 7 is dp:</p>
<table><tr><th>Digit</th><th>Segments lit</th><th>Binary (g…a)</th><th>Hex</th></tr><tr><td>0</td><td>a b c d e f</td><td>0111111</td><td>0x3F</td></tr><tr><td>1</td><td>b c</td><td>0000110</td><td>0x06</td></tr><tr><td>7</td><td>a b c</td><td>0000111</td><td>0x07</td></tr><tr><td>8</td><td>all</td><td>1111111</td><td>0x7F</td></tr></table>
<pre>for (int i = 0; i &lt; 8; i++) {
  int on = (digits[n] &gt;&gt; i) &amp; 1;   // pick out bit number i
  digitalWrite(segPin[i], on);
}</pre>
<p><code>&gt;&gt;</code> shifts the bits right; <code>&amp; 1</code> keeps only the lowest bit. This idea (bit masks) is used everywhere in embedded programming.</p>
<h2>Experiments</h2>
<ol><li>Run the example and watch the counter. Click the display to see which segments are lit.</li><li>Make it count <b>down</b> from 9 to 0.</li><li>Add the letter A (a b c e f g = <code>0x77</code>) and F (<code>0x71</code>) to count in hexadecimal.</li><li>Light the decimal point on every digit by setting bit 7 (<code>| 0x80</code>).</li><li>Set “Series resistors” to <b>None</b>: segments now draw too much current. Add resistors.</li></ol>`,
      quiz: [{ q: 'In a common-cathode display, how do you light segment a?', opts: ['Set its pin LOW', 'Set its pin HIGH', 'Connect it to 5 V'], a: 1, why: 'The common cathode is on GND; current flows when the segment pin is HIGH.' },
             { q: 'Which byte lights segments b and c only (the digit 1)?', opts: ['0x06', '0x3F', '0x7F'], a: 0, why: 'Bits 1 and 2 set: 0b00000110 = 0x06.' }]
    },
    {
      id: 'l21', title: 'Measuring with a voltmeter & ammeter', time: '10 min', tag: 'Electronics', example: 'meters',
      html: `
<p>You can always <i>calculate</i> voltages and currents (Ohm’s law). But real engineers <b>measure</b>, and measuring wrongly is the most common beginner mistake.</p>
<table><tr><th></th><th>Voltmeter</th><th>Ammeter</th></tr><tr><td>Measures</td><td>voltage <i>across</i> a part</td><td>current <i>through</i> a branch</td></tr><tr><td>Connect</td><td><b>in parallel</b> (probes on both sides)</td><td><b>in series</b> (break the circuit, put it in the gap)</td></tr><tr><td>Meter resistance</td><td>very high (10 MΩ), so it takes almost no current</td><td>very low (0.05 Ω), so it barely changes the circuit</td></tr></table>
<div class="warnbox"><b>Never put an ammeter across a battery or a part.</b> Its tiny resistance makes a short circuit. (Try it in the lab: you get the short-circuit warning.)</div>
<h2>Predict, then measure</h2>
<p>In the example, 9 V drives R1 = 1 kΩ and R2 = 2 kΩ in series.</p>
<div class="formula">I = 9 ÷ (1000 + 2000) = 3 mA &nbsp;&nbsp; V<sub>R2</sub> = 3 mA × 2000 = 6 V</div>
<p>Press Run: the ammeter should read 3 mA and the voltmeter 6 V.</p>
<h2>Experiments</h2>
<ol><li>Change R2 to 1 kΩ. Predict both readings, then check.</li><li>Move the voltmeter across R1 instead. Do the two voltages add up to 9 V?</li><li>Turn the voltmeter around (swap A and B): the reading becomes negative. The sign tells you which side is more positive.</li><li>Make R1 and R2 both 10 MΩ. The 10 MΩ voltmeter now disturbs the circuit and the reading is wrong! This is the “loading effect”.</li></ol>`,
      quiz: [{ q: 'How do you connect an ammeter?', opts: ['In parallel with the part', 'In series with the branch', 'Across the battery'], a: 1, why: 'It must be in the path of the current, like a gap filled by the meter.' },
             { q: 'Why does a voltmeter have a very high resistance?', opts: ['So it takes almost no current and does not disturb the circuit', 'So it gets hot', 'So it can measure current'], a: 0, why: 'A high resistance means negligible loading of the circuit under test.' }]
    },
    {
      id: 'l22', title: 'Temperature sensing with the TMP36', time: '12 min', tag: 'Sensors', example: 'temp-lcd',
      html: `
<p>Sensors turn the real world into voltages. The <b>TMP36</b> is a three-pin temperature sensor whose output voltage rises <b>10 mV for every °C</b>, starting from 0.5 V at 0 °C:</p>
<div class="formula">V<sub>out</sub> = 0.5 V + 0.01 V/°C × T &nbsp;&nbsp;→&nbsp;&nbsp; T = (V<sub>out</sub> − 0.5) × 100</div>
<table><tr><th>Temperature</th><th>Output</th><th>analogRead (5 V ref)</th></tr><tr><td>0 °C</td><td>0.50 V</td><td>102</td></tr><tr><td>25 °C</td><td>0.75 V</td><td>153</td></tr><tr><td>100 °C</td><td>1.50 V</td><td>307</td></tr></table>
<pre>int raw = analogRead(A0);
float volts = raw * 5.0 / 1023.0;
float tempC = (volts - 0.5) * 100.0;</pre>
<h2>How precise can it be?</h2>
<p>The Arduino’s ADC has 1024 steps over 5 V, so one step is 4.9 mV, which is about <b>0.5 °C</b>. You cannot read a finer change than that. (Using the 1.1 V internal reference would give 0.1 °C steps; that is an advanced trick.) Real readings also jitter a little, so averaging several samples helps.</p>
<h2>Wiring</h2>
<p>Facing the flat side: <b>left leg +Vs (5 V)</b>, middle leg <b>Vout → A0</b>, right leg <b>GND</b>. Powering it the wrong way round can burn it. In the example the supply and ground are symbols placed on the sensor’s legs.</p>
<h2>Experiments</h2>
<ol><li>Run it, select the sensor and drag the temperature slider. The LCD follows.</li><li>Click the sensor: the output voltage matches 0.5 V + 10 mV × T.</li><li>Convert to Fahrenheit: <code>float tempF = tempC * 9.0 / 5.0 + 32.0;</code></li><li>Delete the 5 V symbol. The sensor has no power: its output is 0 V and the LCD shows −50 °C. A classic wiring bug!</li><li>Combine with lesson 14: switch an LED on above 30 °C and off below 28 °C using hysteresis.</li></ol>`,
      quiz: [{ q: 'A TMP36 outputs 0.85 V. What is the temperature?', opts: ['35 °C', '85 °C', '0.85 °C'], a: 0, why: '(0.85 − 0.5) × 100 = 35 °C.' },
             { q: 'Why does the LCD show −50 °C when the sensor has no supply?', opts: ['Output is 0 V and (0 − 0.5) × 100 = −50', 'The sensor is very cold', 'analogRead overflowed'], a: 0, why: 'With no power the output stays at 0 V, which the formula turns into −50 °C.' }]
    },
    {
      id: 'l23', title: 'Measuring distance with ultrasound', time: '14 min', tag: 'Sensors', example: 'ultrasonic',
      html: `
<p>Bats and submarines “see” with sound. The <b>HC-SR04</b> module does the same: it sends an inaudible 40 kHz burst, waits for the echo, and the <b>time</b> tells the distance.</p>
<div class="formula">distance = speed of sound × time ÷ 2 &nbsp;&nbsp; (÷ 2 because the sound goes there <i>and back</i>)</div>
<p>Sound travels about 343 m/s = 0.0343 cm/µs, so each centimetre takes <b>58 µs</b> for the round trip. Hence <code>cm = microseconds ÷ 58</code>.</p>
<h2>The protocol</h2>
<ol><li>Pull TRIG LOW briefly, then HIGH for <b>at least 10 µs</b>, then LOW.</li><li>The module sends the burst and, a moment later, raises ECHO HIGH.</li><li>ECHO stays HIGH for the echo time. <code>pulseIn(ECHO, HIGH, 30000)</code> measures that HIGH time in µs.</li></ol>
<pre>digitalWrite(TRIG, HIGH); delayMicroseconds(10); digitalWrite(TRIG, LOW);
long us = pulseIn(ECHO, HIGH, 30000);   // 30 ms timeout
long cm = us / 58;</pre>
<p><code>pulseIn</code> returns <b>0</b> if nothing arrives before the timeout: no object, out of range (about 2–400 cm), or the sensor has no power. Always handle that case.</p>
<h2>Experiments</h2>
<ol><li>Run it and drag the distance slider. The Serial monitor follows. The Scope shows TRIG and ECHO: the ECHO pulse gets longer as the object moves away. Measure it: 100 cm should give ~5.8 ms.</li><li>Set the distance to 450 cm: out of range, so you see “no echo”.</li><li>Change <code>delayMicroseconds(10)</code> to <code>delayMicroseconds(5)</code>. The sensor ignores the too-short trigger (just like the real one).</li><li>Delete a power symbol: no echo.</li><li>Print the distance in inches (cm ÷ 2.54).</li></ol>`,
      quiz: [{ q: 'ECHO stays HIGH for 2 900 µs. What is the distance?', opts: ['About 50 cm', 'About 100 cm', 'About 2.9 m'], a: 0, why: '2900 ÷ 58 = 50 cm.' },
             { q: 'Why divide the time by 2 (or use 58 instead of 29)?', opts: ['Sound goes to the object and back', 'The Arduino is slow', 'Echo is half speed'], a: 0, why: 'The measured time covers the trip there and back.' },
             { q: 'pulseIn() returns 0. What does that mean?', opts: ['No echo before the timeout', 'The distance is zero', 'The pin is HIGH'], a: 0, why: 'It gives up after the timeout and returns 0.' }]
    },
    {
      id: 'l24', title: 'The 555 timer', time: '16 min', tag: 'Electronics', example: '555-blink',
      html: `
<p>The <b>555</b> (1972) is one of the most successful chips ever made. With a resistor and a capacitor it makes pulses and delays <b>without any programming</b>: blinkers, tone generators, timers.</p>
<h2>What is inside</h2>
<p>Two comparators watch the voltage on the capacitor: one trips below <b>⅓ V<sub>cc</sub></b> (TRIG pin), the other above <b>⅔ V<sub>cc</sub></b> (THRESHOLD pin). They set and reset a flip-flop that drives OUT and a discharge transistor (DIS).</p>
<h2>Astable mode (a free-running oscillator)</h2>
<ol><li>OUT is HIGH. The capacitor charges through <b>R1 + R2</b>.</li><li>At ⅔ V<sub>cc</sub> the chip flips: OUT goes LOW and DIS pulls the R1/R2 junction to ground.</li><li>The capacitor discharges through <b>R2</b> only.</li><li>At ⅓ V<sub>cc</sub> the chip flips back. Repeat forever.</li></ol>
<div class="formula">t<sub>HIGH</sub> = 0.693 × (R1 + R2) × C &nbsp; t<sub>LOW</sub> = 0.693 × R2 × C<br>f = 1.44 ÷ ((R1 + 2·R2) × C) &nbsp; duty = (R1 + R2) ÷ (R1 + 2·R2)</div>
<p>Example: R1 = 1 kΩ, R2 = 10 kΩ, C = 10 µF → f = 1.44 ÷ (21 000 × 0.00001) = <b>6.9 Hz</b>, duty 52%. Because the capacitor charges through R1+R2 but discharges only through R2, the output is always HIGH longer than LOW.</p>
<h2>Experiments</h2>
<ol><li>Run the example. The Scope shows the capacitor ramping between ⅓ and ⅔ of 5 V (1.67 V and 3.33 V) while OUT toggles. Use the scope’s trigger and measurements: it reports the frequency.</li><li>Change C to 100 µF: the blink is 10× slower.</li><li>Make R1 tiny (100 Ω) and R2 large: the duty approaches 50%.</li><li>Ask the AI tutor: “555 astable R1 1k R2 10k C 10uF”.</li><li>Disconnect the RESET wire’s supply: RESET must be HIGH or the chip is held off.</li></ol>
<div class="tip">With a small capacitor (10 nF) and kilo-ohm resistors the 555 reaches kHz speeds; connect OUT to a passive buzzer for a tone. (This simulator is accurate up to a few hundred hertz.)</div>`,
      quiz: [{ q: 'In astable mode, through which resistors does the capacitor DISCHARGE?', opts: ['R1 + R2', 'R2 only', 'R1 only'], a: 1, why: 'The discharge pin connects the R1/R2 junction to ground, bypassing R1.' },
             { q: 'R1 = 1 kΩ, R2 = 10 kΩ, C = 10 µF. About what frequency?', opts: ['0.7 Hz', '6.9 Hz', '69 Hz'], a: 1, why: '1.44 ÷ (21 kΩ × 10 µF) ≈ 6.9 Hz.' },
             { q: 'The 555 flips when the capacitor reaches…', opts: ['⅓ and ⅔ of Vcc', '0 V and 5 V', 'Vcc and 2×Vcc'], a: 0, why: 'The two internal comparators trip at ⅓ Vcc and ⅔ Vcc.' }]
    },
    {
      id: 'l25', title: 'Digital logic gates', time: '14 min', tag: 'Electronics', example: 'logic-gate',
      html: `
<p>Digital electronics works with two levels: <b>0</b> (LOW, about 0 V) and <b>1</b> (HIGH, about 5 V). <b>Logic gates</b> combine such signals. They are the building blocks of every computer, including the Arduino’s own chip.</p>
<table><tr><th>A</th><th>B</th><th>AND</th><th>OR</th><th>XOR</th><th>NAND</th><th>NOR</th></tr><tr><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>1</td><td>1</td></tr><tr><td>0</td><td>1</td><td>0</td><td>1</td><td>1</td><td>1</td><td>0</td></tr><tr><td>1</td><td>0</td><td>0</td><td>1</td><td>1</td><td>1</td><td>0</td></tr><tr><td>1</td><td>1</td><td>1</td><td>1</td><td>0</td><td>0</td><td>0</td></tr></table>
<ul><li><b>AND</b>: 1 only if <i>both</i> inputs are 1 (like two switches in series).</li><li><b>OR</b>: 1 if <i>at least one</i> input is 1 (switches in parallel).</li><li><b>XOR</b>: 1 if the inputs <i>differ</i> (a staircase light with two switches).</li><li><b>NOT</b>: flips its input. <b>NAND</b> and <b>NOR</b> are AND/OR followed by NOT.</li></ul>
<p>The same operators exist in Arduino code: <code>&amp;&amp;</code> (AND), <code>||</code> (OR), <code>!</code> (NOT) for conditions, and <code>&amp;</code>, <code>|</code>, <code>^</code> (XOR) on bits (lesson 20).</p>
<h2>Never let an input float</h2>
<p>A switch from 5 V to a gate input leaves the input unconnected (floating) while the switch is open, so the gate reads random noise. A <b>pull-down resistor</b> (10 kΩ to ground) pulls it to a clean LOW. The example does this.</p>
<h2>Experiments</h2>
<ol><li>Click the two switches in all four combinations and fill in the table for AND. Then switch the gate type in the inspector to OR, XOR, NAND, NOR and compare with the table above.</li><li>Select the gate: the inspector shows A, B and Y live.</li><li>NOT uses input A only: set it and flip switch 1.</li><li>Remove one pull-down resistor and think about why a real circuit would misbehave.</li><li>Challenge: which single gate lights the LED only when <i>exactly one</i> switch is closed?</li></ol>`,
      quiz: [{ q: 'Which gate outputs 1 only when both inputs are 1?', opts: ['OR', 'AND', 'XOR'], a: 1, why: 'That is the definition of AND.' },
             { q: 'Why add a pull-down resistor to a switch input?', opts: ['To keep the input at a defined LOW when the switch is open', 'To make the gate faster', 'To raise the voltage'], a: 0, why: 'A floating input picks up noise; the resistor gives it a definite 0.' },
             { q: 'A = 1, B = 0. What does NAND give?', opts: ['0', '1', 'Undefined'], a: 1, why: 'AND would be 0, so NAND (the opposite) is 1.' }]
    }
  ];

  let progress = {}; try { progress = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (_) {} };
  let current = 0;
  const hasSketch = id => { const e = S21.Examples.list.find(x => x.id === id); return !!(e && e.sketch); };

  function renderList() {
    const done = LESSONS.filter(l => progress[l.id]).length;
    $('#lessonList').innerHTML = '<h2>Lessons</h2><p>' + done + ' of ' + LESSONS.length + ' completed</p>' +
      LESSONS.map((l, i) => '<button class="lesson-item' + (i === current ? ' on' : '') + (progress[l.id] ? ' done' : '') + '" data-i="' + i + '"><span class="num">' + (progress[l.id] ? '✓' : i + 1) + '</span><span><b>' + l.title + '</b><small>' + l.tag + ' · ' + l.time + '</small></span></button>').join('');
    document.querySelectorAll('#lessonList .lesson-item').forEach(b => b.addEventListener('click', () => open(+b.dataset.i)));
  }
  function open(i) {
    current = i; const l = LESSONS[i];
    const quiz = (l.quiz || []).map((q, qi) => '<div class="quiz" data-q="' + qi + '"><div class="q">Quick check: ' + q.q + '</div>' + q.opts.map((o, oi) => '<button class="opt" data-o="' + oi + '">' + o + '</button>').join('') + '<div class="why"></div></div>').join('');
    $('#lessonBody').innerHTML = '<article class="lesson"><span class="tag">' + l.tag + ' · ' + l.time + '</span><h1>' + l.title + '</h1>' + l.html +
      '<div class="try"><div><b>Try it in the lab</b><span class="soft">Loads a ready-made circuit' + (hasSketch(l.example) ? ' and sketch' : '') + ' you can run and change.</span></div>' + (l.extra || []).map((x, k) => '<button class="btn" data-extra="' + k + '">' + x.label + '</button>').join('') + '<button class="btn primary" id="tryBtn">Open in Circuit Lab</button></div>' + quiz +
      '<div class="lesson-nav"><button class="btn" id="prevL"' + (i === 0 ? ' disabled' : '') + '>← Previous</button><button class="btn' + (progress[l.id] ? '' : ' primary') + '" id="doneL">' + (progress[l.id] ? 'Completed ✓' : 'Mark as complete') + '</button><button class="btn" id="nextL"' + (i === LESSONS.length - 1 ? ' disabled' : '') + '>Next →</button></div></article>';
    $('#tryBtn').onclick = () => { S21.App.show('lab'); S21.Lab.loadExample(l.example); };
    document.querySelectorAll('[data-extra]').forEach(b => b.onclick = () => { S21.App.show('lab'); S21.Lab.loadExample(l.extra[+b.dataset.extra].id); });
    $('#prevL').onclick = () => open(i - 1); $('#nextL').onclick = () => open(i + 1);
    $('#doneL').onclick = () => { progress[l.id] = !progress[l.id]; save(); open(i); if (S21.Home) S21.Home.check(); };
    document.querySelectorAll('.quiz').forEach(box => {
      const q = l.quiz[+box.dataset.q];
      box.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => {
        box.querySelectorAll('.opt').forEach(x => x.classList.remove('right', 'wrong'));
        const ok = +b.dataset.o === q.a; b.classList.add(ok ? 'right' : 'wrong');
        if (!ok) box.querySelectorAll('.opt')[q.a].classList.add('right');
        box.querySelector('.why').innerHTML = (ok ? 'Correct! ' : 'Not quite. ') + q.why;
      }));
    });
    renderList(); $('#lessonBody').scrollTop = 0;
  }
  S21.Lessons = { LESSONS, init() { renderList(); open(0); }, markVisited() {}, list: LESSONS, open: i => open(i), progress: () => progress };
})();
