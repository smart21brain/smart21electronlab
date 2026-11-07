# Smart21 ElectroLab

A desktop app (Electron) for **studying electronics and Arduino**, with the look and feel of the Smart21Store
(deep green-black surfaces, gold accents, Poppins headings, top bar with search, pill navigation, dark-first). It is fully offline and self-contained:
**no website code, backend, login or online content is used.**

| Area | What it does |
|---|---|
| **Circuit Lab** | Drag-and-drop circuit simulator: battery, **AC signal source** (sine/square/triangle, up to 1 kHz), resistor, capacitor, **inductor**, LED, diode, NPN transistor, potentiometer, light sensor (LDR), switch, push button, buzzer, **DC motor**, **servo**, **16×2 LCD**, **7-segment display**, **voltmeter / ammeter**, **TMP36 temperature sensor**, **HC-SR04 ultrasonic sensor**, **555 timer**, **logic gates** (AND/OR/NOT/NAND/NOR/XOR), 5 V supply symbol, solderless **breadboard** and an **Arduino Uno**. Live voltage/current, burn-out warnings, hover-to-measure, 3-channel scope with **edge trigger, automatic Vpp/average/frequency measurements and two cursors (Δt, 1/Δt)**. **Multi-select** (Shift+drag, Ctrl+A), group move, copy/paste. |
| **Arduino emulator** | Write a sketch and run it against your circuit in real time: `pinMode`, `digitalRead/Write`, `analogRead/Write` (PWM), `delay`, `millis`, `tone`, `Serial` (print + input), arrays, functions, `switch`, `String`, plus `pulseIn`, and the **`Servo`** and **`LiquidCrystal`** libraries… Compile errors show the line number. |
| **Lessons** | 25 original lessons (Ohm's law → transistors → Arduino I/O, PWM, sensors, sound, state & debouncing, hysteresis, transistor drivers, AC/filters/inductors, DC motors, servos, LCD, 7-segment displays, measuring, temperature sensing, ultrasonic distance, the 555 timer, logic gates) with "open in the lab" buttons and quizzes. |
| **Challenges** | 16 tasks (safe LED, 3 V divider, blink at 2 Hz, hold-button, 25% PWM, RC time constant, wire a transistor switch, count to five, servo angle, two-line LCD, half-speed motor, 7-segment digit, overheat warning, proximity warning, 555 at 2 Hz, XOR gate). **Check my solution** runs your circuit and sketch in a separate simulation and tells you exactly what differs; progress is saved. |
| **Floating AI button** | An **Ask AI** button sits in the bottom-right corner of every page. It opens a chat window that shares the tutor engine and chat history of the AI Tutor page (and can read your circuit and sketch). *Expand* opens the full page; the button hides itself there. |
| **AI Tutor** | Works **offline** (calculators for Ohm/LED resistor/divider/RC/series-parallel/colour code, concept explanations, circuit & sketch debugger, starter sketches, quiz). Optionally connect Claude, any OpenAI-compatible service or a local **Ollama** model for free-form answers. |

## Install as a program
See **INSTALL.md**: double-click `BUILD-WINDOWS.bat` to build the Windows installer (or use the GitHub workflow, or install from the browser).

## Branding

The app uses the Smart21Brain logo (`src/img/`, cropped to a transparent circle). Installer icons are in `build/` (`icon.ico`, `icon.png`). To change the logo, replace those files.

## Run it

Requires [Node.js](https://nodejs.org) 18+.

```bash
npm install        # downloads Electron (needs internet once)
npm start          # launches the app
npm test           # runs the engine tests (solver, interpreter, netlist, all examples)
npm run dist       # builds an installer for your OS into ./dist (electron-builder)
```

## Using the lab

* **New circuit:** the New button (or `Ctrl+N`, or *New circuit* on the Home page) opens a template chooser, like File ▸ New in a word processor: Blank circuit, Arduino project, Breadboard project, or any example circuit as a starting template (search and category filters included).
* **Save as template / Recent:** the template button in the toolbar saves the circuit (with its sketch) under *My templates*; *Recent* shows the last projects you saved or opened. Teachers can *Export pack…* / *Import pack…* to share templates as a `.s21pack` file.
* **Arduino libraries:** `Stepper.h`, `Keypad.h`, `DHT.h` (`readTemperature`, `readHumidity`), `LiquidCrystal_I2C.h` and `Adafruit_SSD1306.h` (text with the 5×7 font, pixels, lines, rectangles, circles, bitmaps) in addition to Servo and LiquidCrystal. `Wire.begin()` is accepted; raw I²C transfers are not simulated.
* **Troubleshoot:** a toolbar button opens 8 faulty circuits. Find the fault, repair it, press *Check my fix*: the circuit is simulated and judged by what it does, so any correct repair passes.
* **Datasheet:** the **?** button next to a part's name in the inspector shows its pinout, limits and settings.
* **Logic analyzer:** the *Logic* tab shows up to 8 probed signals as a timing diagram with an optional bus value row and **Save VCD** for GTKWave / PulseView. Probes are now limited to 8 (was 3).
* **Serial plotter:** the *Plotter* tab graphs the numbers the sketch prints (`12`, `12 40`, `temp:21.5,light:300`).
* **Schematic view:** the **Schematic** button switches common parts to standard symbols (parts without a symbol keep their normal drawing).
* **Circuit report (PDF):** Export ▸ Circuit report: picture, parts list, notes, circuit check and sketch. The desktop app saves a PDF directly; in a browser it opens the print dialog.
* **Add parts:** drag from the left palette (or click one). **Wire:** drag from one pin to another.
  **Rotate** `R` · **Delete** `Del` · **Duplicate** `Ctrl+D` · **Undo/Redo** `Ctrl+Z / Ctrl+Y` · **Fit** `F` · **Pan** hold `Space` and drag (or right-drag) · **Zoom** mouse wheel.
* **Breadboard:** parts snap to its holes. Holes in a column strip (a–e or f–j) are connected; the top/bottom rails run the full length. Two legs in the same strip = shorted.
* **Run (F5)**, then hover any pin for its voltage, or select a part for live V / I / power. `Shift`+click a pin to add it to the **Scope**.
* **Select several parts:** `Shift`+drag a box (or `Shift`+click, or `Ctrl+A`), drag to move them together, `Ctrl+C` / `Ctrl+V` to copy with their wires.
* **Scope:** pick *Rising edge* trigger for a steady picture; the legend shows Vpp, average and frequency; click the scope twice to place cursors A and B (pause first).
* Potentiometer / LDR: mouse wheel over the part, or use the inspector slider. Sensors (TMP36, HC-SR04) have a slider in the inspector. Switch: click. Push button: hold the mouse button on it.
* **Examples…** loads ready circuits + sketches (Blink, Button, Knob-LED, Night light, Traffic light, Melody, RC, transistor switch…).
* **Save / Open** project files (`.s21lab`: circuit + sketch). **Import / Export** a sketch as `.ino` to move code to or from the real Arduino IDE.
* **Challenges** (sidebar): *Start* loads a starter project; the bar at the top of the canvas has **Check my solution**. Ask the AI tutor for a *hint* while a challenge is active.

## AI tutor engines

Settings → *AI tutor engine*:

* **Built-in offline tutor** – default, no account.
* **Anthropic (Claude)** – paste an API key. Default model `claude-sonnet-5-5` (editable).
* **OpenAI-compatible** – any `/v1/chat/completions` server. For a fully offline LLM install [Ollama](https://ollama.com),
  pull a model, then use base URL `http://localhost:11434/v1`, any model name you pulled and no key.

Keys are encrypted with Electron `safeStorage` and used only from the main process. The renderer has no network access
(`connect-src 'none'` CSP, context isolation, sandbox). With "Share my circuit & sketch" ticked, a text description of your
lab is attached to messages sent to an online engine.

## How it works (for extending)

```
main.js / preload.js            window, menu, file dialogs, encrypted settings, AI streaming (IPC)
src/js/sim/solver.js            modified nodal analysis + Newton iteration (diode/LED/BJT), backward-Euler capacitor
src/js/sim/parts.js             parts library (terminals, SVG, solver stamps, inspector fields) + netlist builder
src/js/sim/parts3.js            round-3 parts: regulators, drivers, logic ICs, displays, sensors (see below)
src/js/sim/schematic.js         schematic view: standard circuit symbols
src/js/library.js               recent projects, personal templates, class packs
src/js/logic.js, plotter.js     logic analyzer (timing diagram, VCD export) and serial plotter
src/js/datasheet.js             the "?" datasheet pop-up for every part
src/js/report.js                printable circuit report (PDF)
src/js/trouble.js               troubleshooting mode (8 planted-fault cases)
src/js/sim/runtime.js           couples circuit solver and sketch interpreter on one virtual clock
src/js/arduino/interp.js        Arduino C++ subset: tokenizer, parser, generator-based interpreter
src/js/sim/editor.js            SVG canvas editor (drag, wire, snap, undo)
src/js/lab.js                   Lab UI: palette, inspector, code editor, serial, scope, run loop
src/js/lessons.js · ai.js · app.js · examples.js
```

**Add a part:** call `def('myPart', {...})` in `parts.js` with `terms`, `svg(comp)`, `elements(comp, N)` (return solver
elements `R`, `V`, `D`, `C`, `Q`) and optional `sync`/`read`/`update`. It appears in the palette automatically.

## What's new in 1.1

* **Parts:** op-amp (LM358 / rail-to-rail / ±supply), PNP, MOSFET (N/P, logic-level / standard / small-signal), Zener, NTC thermistor, SPDT relay
  (inductive coil), RGB LED (common cathode/anode), 74HC595 shift register.
* **More parts (round 3):**
  * *Power & drivers:* 7805/7809/7812/AMS1117 regulator, LM317 adjustable regulator, ULN2003 Darlington driver, L293D H-bridge motor driver, PC817 optocoupler, fuse.
  * *Logic ICs:* 74HC00/08/32/86 quad gates, 74HC02, 74HC04/14 hex inverter (Schmitt option), 74HC74 flip-flop, CD4017 decade counter, 74HC161 counter, CD4511 BCD→7-segment decoder, 74HC138 decoder, 74HC4051 analog multiplexer.
  * *Devices:* Schottky diode, filament lamp (inrush current, burn-out), LED bar graph, 8×8 LED matrix, 28BYJ-48 stepper motor, PIR sensor, LM35, joystick, 4×4 keypad, 4-position DIP switch.
  * Also: LM393 comparator, SCR thyristor, 74HC165 shift register, 8-bit DAC and 8-bit ADC, **transformer** (coupled windings, AC only), DHT11/DHT22, I²C LCD and SSD1306 OLED.
  * Fourteen new examples (also: transformer, ADC voltmeter, DHT, I²C LCD, OLED): 7805 regulator, 555 + CD4017 running light, 555 → 74HC161 → CD4511 counter, Arduino stepper (plain and with the Stepper library), keypad, LM393 night light, 555 one-shot, SCR latch.
  * A printable reference with every new part's pins and usage is in `docs/ElectroLab-new-devices-and-ICs.pdf`.
  * To add another chip with a DIP pinout, call `mkIC({...})` in `parts3.js` (pin list, inputs, outputs, `event` for clock edges, `comb` for the outputs).
* **Arduino language:** `struct`, `enum`, `typedef`, `EEPROM` (read/write/update/put/get/`[]`, persists across Stop/Run), `attachInterrupt`, `shiftOut`, more math.
* **Analysis:** DC sweep of any value, Bode plot (gain + phase, −3 dB markers), voltage-coloured wires.
* **Project tools:** autosave + session restore, PNG export, parts list (CSV) and SPICE netlist.
* **App:** examples gallery with thumbnails, first-run tour, home dashboard with achievements and a printable certificate.
* **Content:** 12 new lessons (op-amps … DC sweep & Bode), 13 new examples, 9 new challenges.
* Run the whole test suite with `npm test`.

## What's new in 1.3

* **Learn panel docked in the workspace** (like Photoshop's Learn panel): collapsible, resizable panels on the right of the Circuit Lab.
  Pick a **guided tutorial** and it builds a circuit with you: ghost parts show where to click (clicking a part in the palette places it
  on the highlighted spot), dashed wires show what to connect, and each step is ticked off by checking the **real circuit**.
  Tutorials: Light an LED, Measure a voltage divider (multimeter), Blink an LED with Arduino, RC filter and Bode plot.
* **Circuit check** (toolbar): explains common wiring mistakes and how to fix them, with a "Show me" button.

## Honest limitations

* The Arduino emulator interprets a **practical subset of Arduino C++** on a virtual clock; it is *not* a cycle-accurate AVR
  emulator and does not run `.hex` files. No libraries beyond Servo/LiquidCrystal, no classes/pointers/templates
  (unsupported features give a clear message). `struct`, `enum`, `typedef`, `EEPROM`, `attachInterrupt` (D2/D3) and `shiftOut` are supported. One Arduino Uno per project.
* The circuit solver is a transient model with simple device models (LED ≈ Shockley diode, ideal-ish sources with small
  internal resistance, Ebers-Moll NPN, backward-Euler capacitor/inductor). AC sources are limited to 1 kHz in the live simulation (the Bode analysis goes to 1 MHz). Op-amps are a gain-100 000 piecewise-linear model
  with output limits (no slew rate, bandwidth or input offsets); the op-amp's output current is not drawn from its supply pins.
  MOSFETs use the level-1 square-law model with a body diode; a ±120 V clamp keeps inductive kicks finite.
* The motor is a simple model (resistance + speed that follows voltage, no back-EMF or flyback spikes). The LCD supports 4-bit
  `LiquidCrystal(rs, en, d4, d5, d6, d7)` only and shows 16×2; `createChar`/scrolling are accepted but not drawn. The servo
  library supports `attach/detach/write/writeMicroseconds/read`. The 7-segment part is common-cathode.
* The 555 and logic gates are behavioural models (they react one 0.25 ms simulation step late, so keep 555 circuits below a few
  hundred hertz). Gate power pins are assumed; the 555 uses a CMOS-style output and does not model the CONTROL pin.
* The ultrasonic sensor is answered through `pulseIn()`; other timing functions (`pulseInLong` is an alias, `shiftIn`) are not implemented. Interrupt edges are detected
  at the 0.25 ms simulation step, so a handler can run up to ~1 ms after the real edge. I2C/SPI devices, keypads and OLED displays are not included yet.
* Fonts use system fonts (Poppins/Inter if installed). To bundle them, add `@font-face` rules and `.woff2` files under `src/`.


## Design notes

* Layout: top bar (logo, search, New circuit, avatar, light/dark) + pill navigation, instead of the old left sidebar. The search box finds lessons, example circuits and challenges (`Ctrl+K` focuses it).
* Fonts: Poppins is bundled in `src/fonts/` (SIL Open Font License) because the app's content-security policy only allows local fonts.
* Colours are CSS variables at the top of `src/css/app.css` (`--gold`, `--green-deep`, `--bg`, `--panel`…). Light mode uses the same layout.
* New files: `src/js/aifab.js` (floating AI), `src/js/gsearch.js` (header search).

## Mobile / responsive
`src/css/mobile.css` + `src/js/mobile.js` make the app usable on phones and tablets (≤820 px): the Circuit Lab shows the canvas full-screen with a bottom bar that opens **Parts**, **Code & scope** and **Learn & props** as sheets; pinch to zoom / two-finger pan on the canvas; Lessons, Challenges and AI chats use slide-in drawers; modals become bottom sheets. Desktop layout is unchanged.
