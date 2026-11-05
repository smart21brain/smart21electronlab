/* ---------------------------------------------------------------
   Smart21 ElectroLab — troubleshooting mode
   The app loads a circuit with ONE planted fault. The student finds it with the
   probe / multimeter / hover readout, repairs it, and presses "Check my fix":
   the circuit is simulated and judged by what it DOES, so any correct repair passes.
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const T = {}; S21.Trouble = T;
  const P = () => S21.Parts, RT = () => S21.Runtime;

  /* ---------- helpers ---------- */
  function mk(spec) {
    const c = P().newCircuit(), id = {};
    for (const [k, type, x, y, rot, props] of spec.parts) id[k] = P().addPart(c, type, x, y, rot || 0, props).id;
    for (const w of spec.wires || []) { const [ak, at] = w[0].split('.'), [bk, bt] = w[1].split('.'); P().addWire(c, { p: id[ak], t: at }, { p: id[bk], t: bt }); }
    return { circuit: c, id };
  }
  const part = (c, type) => c.parts.find(p => p.type === type);
  const wire = (c, a, b) => c.wires.find(w => (w.a.p === a.p && w.a.t === a.t && w.b.p === b.p && w.b.t === b.t) || (w.a.p === b.p && w.a.t === b.t && w.b.p === a.p && w.b.t === a.t));
  const ref = (c, type, term) => ({ p: part(c, type).id, t: term });
  const link = (c, a, b) => P().addWire(c, a, b);
  const unlink = (c, a, b) => { c.wires = c.wires.filter(w => w !== wire(c, a, b)); };
  const run = (c, sketch, ms) => { const rt = new (RT())(c, {}); if (sketch) { const r = rt.loadSketch(sketch); if (!r.ok) return { rt, error: r.error }; } rt.advance(ms || 100); return { rt }; };
  const ledOn = (c, sketch, ms) => { // did the LED carry ≥ 4 mA at any moment?
    const led = part(c, 'led'), r = run(c, sketch, 5); if (r.error) return { ok: false, max: 0 }; let max = 0;
    for (let t = 0; t < (ms || 100); t += 10) { r.rt.advance(10); max = Math.max(max, led.rt.ia || 0); }
    return { ok: max > 0.004, max };
  };
  const mA = v => (v * 1000).toFixed(1) + ' mA';

  /* ---------- scenarios ---------- */
  const SCEN = [];
  const add = s => SCEN.push(s);

  const LEDLOOP = (rv, flip) => ({
    parts: [['bat', 'battery', 100, 200, 0, { volts: 5 }], ['r', 'resistor', 300, 120, 0, { ohms: rv }], ['led', 'led', 480, 200, 90, { color: 'red' }]],
    wires: flip ? [['bat.+', 'r.a'], ['r.b', 'led.k'], ['led.a', 'bat.-']] : [['bat.+', 'r.a'], ['r.b', 'led.a'], ['led.k', 'bat.-']]
  });

  add({
    id: 'led-backwards', title: 'The LED will not light', level: 'Beginner',
    symptom: 'A battery, a resistor and an LED are connected in a loop, but the LED stays dark.',
    hints: ['Run the circuit and hover over the LED pins: is there a voltage across it?', 'An LED only conducts one way: current must enter the ANODE (+) and leave the CATHODE (−).', 'Look at which LED pin is connected to the resistor.'],
    fault: 'The LED is in backwards: its cathode faces the resistor.', fix: 'Swap the LED: anode to the resistor, cathode to the battery −. (Select it and press R twice to turn it round, then re-wire.)',
    build: () => mk(LEDLOOP(330, true)),
    repair: (c, ids) => { const led = ids.led; unlink(c, { p: ids.r, t: 'b' }, { p: led, t: 'k' }); unlink(c, { p: led, t: 'a' }, { p: ids.bat, t: '-' }); link(c, { p: ids.r, t: 'b' }, { p: led, t: 'a' }); link(c, { p: led, t: 'k' }, { p: ids.bat, t: '-' }); },
    check: c => { const r = ledOn(c, null, 60); return { ok: r.ok, msg: r.ok ? 'The LED lights: ' + mA(r.max) + ' flows through it.' : 'The LED is still dark (' + mA(r.max) + '). Current must flow in at the anode (+).' }; }
  });
  add({
    id: 'led-dim', title: 'A very dim LED', level: 'Beginner',
    symptom: 'The LED is wired the right way round, but it glows so weakly you can hardly see it.',
    hints: ['Select the LED and read the current in the inspector: how many mA is it?', 'A normal LED wants roughly 5–20 mA. Use Ohm’s law: I = (5 V − 2 V) ÷ R.', 'Check the resistor value.'],
    fault: 'The resistor is 100 kΩ instead of about 330 Ω, so only 0.03 mA flows.', fix: 'Change the resistor to about 330 Ω (anything from 150 Ω to 560 Ω works).',
    build: () => mk(LEDLOOP(100000, false)),
    repair: c => { part(c, 'resistor').props.ohms = 330; },
    check: c => { const r = ledOn(c, null, 60), led = part(c, 'led'); const i = led.rt.ia || 0; const ok = i > 0.004 && i < 0.03; return { ok, msg: ok ? 'Bright and safe: ' + mA(i) + '.' : i <= 0.004 ? 'Still too dim: only ' + mA(i) + '. The resistor is too large.' : 'Too much current: ' + mA(i) + ' could burn the LED. Use a bigger resistor.' }; }
  });
  add({
    id: 'broken-return', title: 'The loop is not closed', level: 'Beginner',
    symptom: 'Everything looks connected, yet nothing happens and no current flows.',
    hints: ['Current needs a complete loop from the battery + back to the battery −.', 'Hover over the LED cathode: what voltage does it have? Compare it with the battery −.', 'Look for a pin with no wire on it.'],
    fault: 'The wire between the LED cathode and the battery − is missing.', fix: 'Draw a wire from the LED cathode (k) to the battery − terminal.',
    build: () => { const s = LEDLOOP(330, false); s.wires = s.wires.filter(w => w[0] !== 'led.k'); return mk(s); },
    repair: (c, ids) => { link(c, { p: ids.led, t: 'k' }, { p: ids.bat, t: '-' }); },
    check: c => { const r = ledOn(c, null, 60); return { ok: r.ok, msg: r.ok ? 'The loop is closed and the LED lights (' + mA(r.max) + ').' : 'Still no current. Is every part part of one closed loop?' }; }
  });
  add({
    id: 'divider-wrong', title: 'The divider is not halving', level: 'Beginner',
    symptom: 'A voltage divider on a 9 V battery should give half the voltage (4.5 V), but the middle point is much lower.',
    hints: ['Hover over the middle point (between the resistors) while running.', 'V_mid = 9 V × R2 ÷ (R1 + R2). For half, what must R2 be compared with R1?', 'Compare the two resistor values.'],
    fault: 'R2 is 1 kΩ but R1 is 10 kΩ: V_mid = 9 × 1 ÷ 11 = 0.8 V.', fix: 'Make R2 equal to R1 (10 kΩ) and the middle point sits at 4.5 V.',
    build: () => mk({ parts: [['bat', 'battery', 100, 200, 0, { volts: 9 }], ['r1', 'resistor', 300, 120, 90, { ohms: 10000 }], ['r2', 'resistor', 300, 280, 90, { ohms: 1000 }]], wires: [['bat.+', 'r1.a'], ['r1.b', 'r2.a'], ['r2.b', 'bat.-']] }),
    repair: c => { c.parts.filter(p => p.type === 'resistor')[1].props.ohms = 10000; },
    check: (c, s, ids) => { const r = run(c, null, 40), rs = c.parts.filter(p => p.type === 'resistor'), r2 = c.parts.find(p => p.id === ids.r2) || rs[1] || rs[0], v = r.rt.nodeVoltage({ p: r2.id, t: 'a' }); const ok = Math.abs(v - 4.5) < 0.25; return { ok, msg: ok ? 'The middle point is at ' + v.toFixed(2) + ' V: half of 9 V.' : 'The middle point is at ' + v.toFixed(2) + ' V. It should be about 4.5 V.' }; }
  });
  add({
    id: 'transistor-weak', title: 'The transistor switch is half asleep', level: 'Intermediate',
    symptom: 'A transistor should switch an LED on, but the LED only glows faintly.',
    hints: ['A transistor amplifies: collector current ≈ gain × base current.', 'Find the base current: (5 V − 0.7 V) ÷ R_base. Is it enough for ~10 mA of LED current with a gain around 100?', 'To saturate the switch, the base resistor should be 1 kΩ to 10 kΩ, not megaohms.'],
    fault: 'The base resistor is 1 MΩ: only about 4 µA reaches the base, so the LED gets a tiny current.', fix: 'Change the base resistor to about 4.7 kΩ.',
    build: () => mk({ parts: [['bat', 'battery', 100, 240, 0, { volts: 5 }], ['rb', 'resistor', 280, 360, 0, { ohms: 1e6 }], ['rc', 'resistor', 460, 120, 90, { ohms: 330 }], ['led', 'led', 460, 220, 90, { color: 'green' }], ['q', 'npn', 460, 340, 0]],
      wires: [['bat.+', 'rb.a'], ['rb.b', 'q.b'], ['bat.+', 'rc.a'], ['rc.b', 'led.a'], ['led.k', 'q.c'], ['q.e', 'bat.-']] }),
    repair: (c) => { part(c, 'resistor').props.ohms = 4700; c.parts.filter(p => p.type === 'resistor').forEach(r => { if (r.props.ohms === 1e6) r.props.ohms = 4700; }); },
    check: c => { const r = ledOn(c, null, 60); const i = part(c, 'led').rt.ia || 0; return { ok: i > 0.008, msg: i > 0.008 ? 'The transistor switches fully: ' + mA(i) + ' in the LED.' : 'The LED only gets ' + mA(i) + '. The base needs more current.' }; }
  });
  add({
    id: '555-reset', title: 'The 555 flasher never flashes', level: 'Intermediate',
    symptom: 'A 555 timer should flash an LED about 7 times a second, but the LED stays off.',
    hints: ['Probe the 555 output (pin 3): does it ever change?', 'Check what each of the 8 pins is connected to. Which pin has no wire?', 'RESET (pin 4) is active LOW: left unconnected it holds the chip in reset.'],
    fault: 'The RESET pin is not connected, so the timer is held reset and the output stays LOW.', fix: 'Connect RESET to the + supply (VCC).',
    build: () => mk({ parts: [['v', 'vcc', 100, 100, 0, { volts: 5 }], ['g', 'ground', 100, 440, 0], ['ic', 'ic555', 300, 260, 0], ['r1', 'resistor', 460, 80, 90, { ohms: 1000 }], ['r2', 'resistor', 560, 140, 90, { ohms: 10000 }], ['c', 'capacitor', 640, 260, 90, { farads: 10e-6 }], ['rl', 'resistor', 560, 340, 0, { ohms: 330 }], ['led', 'led', 700, 340, 0, { color: 'yellow' }]],
      wires: [['v.v', 'ic.VCC'], ['g.g', 'ic.GND'], ['v.v', 'r1.a'], ['r1.b', 'ic.DIS'], ['r2.a', 'ic.DIS'], ['r2.b', 'ic.THR'], ['ic.TRIG', 'ic.THR'], ['c.a', 'ic.THR'], ['c.b', 'g.g'], ['ic.OUT', 'rl.a'], ['rl.b', 'led.a'], ['led.k', 'g.g']] }),
    repair: (c, ids) => { link(c, { p: ids.v, t: 'v' }, { p: ids.ic, t: 'RESET' }); },
    check: c => { const led = part(c, 'led'), r = run(c, null, 5); let changes = 0, last = null; for (let t = 0; t < 1200; t += 10) { r.rt.advance(10); const on = (led.rt.ia || 0) > 0.002; if (last !== null && on !== last) changes++; last = on; } const ok = changes >= 4; return { ok, msg: ok ? 'The LED flashes (' + changes + ' changes in 1.2 s).' : 'The LED does not flash yet (' + changes + ' changes in 1.2 s).' }; }
  });
  const BLINK12 = '// Blink on pin 13\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}\n';
  add({
    id: 'arduino-wrong-pin', title: 'Arduino blink that does not blink', level: 'Intermediate',
    symptom: 'The sketch blinks pin 13, but the LED on the breadboard side never lights.',
    hints: ['Read the sketch: which pin does it switch?', 'Now look at the wire from the Arduino: which pin is it plugged into?', 'The code and the wiring must agree. You can fix either one.'],
    fault: 'The LED circuit is wired to pin 12 but the sketch blinks pin 13.', fix: 'Move the wire to pin 13 (or change the sketch to use pin 12).',
    sketch: BLINK12,
    build: () => mk({ parts: [['ard', 'arduino', 100, 260, 0], ['r', 'resistor', 320, 100, 0, { ohms: 220 }], ['led', 'led', 480, 100, 0, { color: 'red' }], ['g', 'ground', 600, 100, 0]],
      wires: [['ard.D12', 'r.a'], ['r.b', 'led.a'], ['led.k', 'g.g'], ['ard.GND_T', 'g.g']] }),
    repair: (c, ids) => { unlink(c, { p: ids.ard, t: 'D12' }, { p: ids.r, t: 'a' }); link(c, { p: ids.ard, t: 'D13' }, { p: ids.r, t: 'a' }); },
    check: (c, sketch) => { const r = ledOn(c, sketch, 2200); return { ok: r.ok, msg: r.ok ? 'The LED blinks: it carries ' + mA(r.max) + ' when on.' : 'The LED never lights. Does the pin in the code match the wiring?' }; }
  });
  add({
    id: 'chip-unpowered', title: 'A logic chip that ignores its inputs', level: 'Intermediate',
    symptom: 'A NAND gate has input A tied HIGH and input B tied LOW, so its output should be HIGH and light the LED, but the LED is off.',
    hints: ['A chip needs power to work: check the VCC and GND pins.', 'Hover over each pin of the chip. Which one reads 0 V when it should read 5 V?', 'The inputs are fine: the problem is on one of the two power pins.'],
    fault: 'The VCC pin is not connected, so the chip is dead.', fix: 'Connect the chip’s VCC pin to the + supply.',
    build: () => mk({ parts: [['v', 'vcc', 100, 100, 0, { volts: 5 }], ['g', 'ground', 100, 460, 0], ['u', 'quadgate', 300, 280, 0, { type: 'nand' }], ['r', 'resistor', 560, 140, 0, { ohms: 330 }], ['led', 'led', 700, 140, 0, { color: 'green' }]],
      wires: [['g.g', 'u.GND'], ['v.v', 'u.1A'], ['g.g', 'u.1B'], ['u.1Y', 'r.a'], ['r.b', 'led.a'], ['led.k', 'g.g']] }),
    repair: (c, ids) => { link(c, { p: ids.v, t: 'v' }, { p: ids.u, t: 'VCC' }); },
    check: c => { const r = ledOn(c, null, 60); return { ok: r.ok, msg: r.ok ? 'The chip is alive: the gate output lights the LED (' + mA(r.max) + ').' : 'The LED is still off. Does the chip have power on VCC and GND?' }; }
  });

  T.scenarios = SCEN;
  T.get = id => SCEN.find(s => s.id === id);
  // load a scenario: { circuit, ids, sketch, scenario }
  T.start = function (id) { const s = T.get(id); if (!s) return null; const b = s.build(); return { circuit: b.circuit, ids: b.id, sketch: s.sketch || null, scenario: s }; };
  T.check = function (id, circuit, sketch, ids) {
    const s = T.get(id); if (!s) return { ok: false, msg: 'Unknown scenario' };
    const idmap = ids || {}; try { return s.check(circuit, sketch, idmap); } catch (e) { return { ok: false, msg: 'Could not simulate the circuit: ' + e.message }; }
  };
  T.repair = function (id, circuit, ids) { const s = T.get(id); if (s) s.repair(circuit, ids); };

  /* ---------- UI ---------- */
  T.active = null;
  T.openList = function () {
    const Tools = S21.Tools, done = id => S21.Stats && S21.Stats.has && S21.Stats.has('trouble', id);
    const body = document.createElement('div'); body.className = 'gallery';
    body.innerHTML = '<p class="soft">Each case is a circuit with ONE hidden fault. Find it with the hover readout, probes and the multimeter, repair it, then press <b>Check my fix</b>.</p><div class="gal-grid" id="trGrid"></div>';
    const m = Tools.modal({ title: 'Troubleshoot a faulty circuit', wide: true, body });
    const grid = body.querySelector('#trGrid');
    SCEN.forEach(s => {
      const c = document.createElement('button'); c.className = 'gal-card';
      c.innerHTML = '<div class="gal-info"><div class="gal-title">' + s.title + (done(s.id) ? ' <span class="ok">✓</span>' : '') + '</div><div class="gal-meta"><span class="lvl lvl-' + s.level.toLowerCase() + '">' + s.level + '</span></div><p>' + s.symptom + '</p></div>';
      c.onclick = () => { m.close(); T.load(s.id); }; grid.appendChild(c);
    });
  };
  T.load = function (id) {
    const st = T.start(id); if (!st) return; const Lab = S21.Lab;
    S21.App.show('lab'); Lab.loadStarter({ circuit: st.circuit, sketch: st.sketch || undefined, probes: [] });
    T.active = { id, ids: st.ids, hint: 0, solved: false };
    // the Lab re-creates the circuit object; map by position so repairs target the right parts
    T.showCard();
  };
  T.showCard = function () {
    const a = T.active; if (!a) return; const s = T.get(a.id); let card = document.getElementById('troubleCard'); if (card) card.remove();
    card = document.createElement('div'); card.id = 'troubleCard'; card.className = 'trouble-card';
    card.innerHTML = '<div class="tc-head"><b>🔧 ' + s.title + '</b><button class="tc-x" aria-label="Close" title="Close">×</button></div><p>' + s.symptom + '</p><div class="tc-hint" hidden></div><div class="tc-res" hidden></div>' +
      '<div class="tc-btns"><button class="btn small" data-a="hint">Hint</button><button class="btn small primary" data-a="check">Check my fix</button><button class="btn small" data-a="reveal">Reveal the fault</button></div>';
    (document.querySelector('#view-lab .canvas-wrap') || document.querySelector('#view-lab') || document.body).appendChild(card);
    const hint = card.querySelector('.tc-hint'), res = card.querySelector('.tc-res');
    card.querySelector('.tc-x').onclick = () => { card.remove(); T.active = null; };
    card.querySelector('[data-a=hint]').onclick = () => { hint.hidden = false; hint.textContent = 'Hint ' + (Math.min(a.hint, s.hints.length - 1) + 1) + ' of ' + s.hints.length + ': ' + s.hints[Math.min(a.hint, s.hints.length - 1)]; a.hint++; };
    card.querySelector('[data-a=check]').onclick = () => {
      const Lab = S21.Lab, c = Lab.editor.circuit, r = T.check(a.id, c, Lab.sketch, a.ids); res.hidden = false; res.className = 'tc-res ' + (r.ok ? 'good' : 'bad'); res.textContent = (r.ok ? '✓ Fixed! ' : '✗ Not yet. ') + r.msg;
      if (r.ok && !a.solved) { a.solved = true; if (S21.Stats && S21.Stats.mark) S21.Stats.mark('trouble', a.id); res.textContent += ' The fault was: ' + s.fault; }
    };
    card.querySelector('[data-a=reveal]').onclick = () => {
      hint.hidden = false; hint.innerHTML = '<b>The fault:</b> ' + s.fault + '<br><b>The repair:</b> ' + s.fix;
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = T;
})(typeof window !== 'undefined' ? window : globalThis);
