/* ---------------------------------------------------------------
   Smart21 ElectroLab — guided tutorials
   A tutorial is a list of steps. Each step has a check that looks
   at the real circuit, so the Learn panel (docked in the workspace,
   like Photoshop's Learn panel) ticks steps off as the student
   builds, and the canvas shows ghost parts and wire hints.

   The engine (queries, tutorials, evaluation) is pure and tested in
   Node; the panel / canvas overlay at the bottom needs a browser.
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const P = () => S21.Parts;

  /* ===================== circuit queries ===================== */
  function makeQuery(circuit, env) {
    env = env || {};
    const c0 = S21.Analysis.clone(circuit), nl = P().buildNetlist(c0), parts = c0.parts;
    const live = new Map(circuit.parts.map(p => [p.id, p])); for (const p of parts) { const o = live.get(p.id); if (o && o.rt) p.rt = o.rt; }
    const defs = P().PARTS;
    const of = type => parts.filter(p => p.type === type);
    const termsOf = (type, t) => t === 'any' || t === undefined ? defs[type].terms.map(x => x.n) : Array.isArray(t) ? t : [t];
    const net = (p, t) => nl.nodeOf(p.id, t);
    const Q = {
      env, circuit: c0, parts,
      of, count: type => of(type).length, has: (type, n) => of(type).length >= (n || 1),
      net, termsOf,
      // is terminal ta of any part of typeA on the same net as terminal tb of any part of typeB?
      linked(typeA, ta, typeB, tb) { return !!Q.linkPair(typeA, ta, typeB, tb); },
      linkPair(typeA, ta, typeB, tb) {
        for (const a of of(typeA)) for (const x of termsOf(typeA, ta)) { const na = net(a, x); for (const b of of(typeB)) { if (a === b) continue; for (const y of termsOf(typeB, tb)) if (net(b, y) === na) return { a, ta: x, b, tb: y }; } }
        return null;
      },
      // a two-terminal part R of typeR with one end on (typeA, ta) and the other end on (typeB, tb)
      series(typeA, ta, typeR, typeB, tb) {
        for (const r of of(typeR)) {
          const [t1, t2] = defs[typeR].terms.map(x => x.n);
          for (const [x, y] of [[t1, t2], [t2, t1]]) {
            const nx = net(r, x), ny = net(r, y); if (nx === ny) continue;
            const okA = of(typeA).some(a => a !== r && termsOf(typeA, ta).some(t => net(a, t) === nx));
            const okB = of(typeB).some(b => b !== r && termsOf(typeB, tb).some(t => net(b, t) === ny));
            if (okA && okB) return r;
          }
        }
        return null;
      },
      prop: (type, key, pred) => of(type).some(p => pred(p.props[key])),
      // the terminal of a part that has the fewest connections (not on avoidNet), ties broken by distance to `target` {x,y}
      freeTerm(p, avoidNet, target) {
        const terms = defs[p.type].terms.map(x => x.n); let best = null, bestScore = 1e12;
        for (const t of terms) {
          const n = net(p, t); let cnt = 0; for (const q of parts) for (const tt of defs[q.type].terms) if (net(q, tt.n) === n) cnt++;
          let s = cnt * 1e6 + (n === avoidNet ? 1e9 : 0);
          if (target) { const pos = P().termPos(c0, { p: p.id, t }); if (pos) s += Math.hypot(pos.x - target.x, pos.y - target.y); }
          if (s < bestScore) { bestScore = s; best = t; }
        }
        return best;
      },
      pos: (p, t) => P().termPos(c0, { p: p.id, t })
    };
    return Q;
  }

  /* ===================== tutorials ===================== */
  const num = (v, a, b) => typeof v === 'number' && v >= a && v <= b;
  const ledOn = Q => Q.of('led').some(l => (l.rt && l.rt.ia || 0) > 0.004);
  const BLINK = `// Blink an LED on pin 12
const int LED_PIN = 12;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  delay(500);
}
`;
  const ARD_GND = ['GND_T', 'GND_B1', 'GND_B2'];
  const TUTORIALS = [
    {
      id: 'g-led', title: 'Light an LED', level: 'Beginner', minutes: 6, icon: '💡',
      summary: 'Build your first circuit: a battery, a resistor and an LED.',
      steps: [
        { title: 'Add a battery', text: 'Every circuit needs a power source. <b>Click “Battery”</b> in the Parts panel on the left. It is placed at the highlighted spot.', focus: 'battery',
          ghost: [{ type: 'battery', x: 120, y: 200, props: { volts: 9 } }], done: Q => Q.has('battery'), hint: 'Look for “Battery / DC supply” under Power in the Parts list, or type “battery” in the search box.' },
        { title: 'Add a resistor', text: 'A <b>resistor</b> limits the current. Without it the LED would burn out. Click <b>Resistor</b> in the Parts panel.', focus: 'resistor',
          ghost: [{ type: 'resistor', x: 260, y: 140, props: { ohms: 470 } }], done: Q => Q.has('resistor'), hint: 'Resistors are under Passive.' },
        { title: 'Add an LED', text: 'Now the <b>LED</b>, the part that lights up. It only works one way round: current enters the <b>anode</b> (+) and leaves by the <b>cathode</b>.', focus: 'led',
          ghost: [{ type: 'led', x: 400, y: 140, props: { color: 'red' } }], done: Q => Q.has('led'), hint: 'LEDs are under Semiconductors or Display.' },
        { title: 'Add two ground symbols', text: 'The <b>ground</b> symbol is the 0 V reference. Add one for the battery’s − terminal and one for the LED’s cathode. (Parts that touch the same ground symbol are connected.)', focus: 'ground',
          ghost: [{ type: 'ground', x: 120, y: 240 }, { type: 'ground', x: 420, y: 140 }], done: Q => Q.has('ground', 2), hint: 'Ground is under Power. Click it twice.' },
        { title: 'Wire the battery to the resistor', text: 'Drag from the battery’s <b>+</b> pin to one end of the resistor. Pins light up when you hover over them.', wire: Q => { const b = Q.of('battery')[0], r = Q.of('resistor')[0]; return b && r && { a: { p: b.id, t: '+' }, b: { p: r.id, t: Q.freeTerm(r, -1, Q.pos(b, '+')) } }; },
          done: Q => Q.linked('battery', '+', 'resistor', 'any'), hint: 'Start the drag on the small circle at the end of the battery’s upper pin.' },
        { title: 'Wire the resistor to the LED', text: 'Now connect the <b>other</b> end of the resistor to the LED’s <b>anode (a)</b>.', wire: Q => { const l = Q.of('led')[0], r = Q.of('resistor')[0], b = Q.of('battery')[0]; if (!l || !r) return null; const used = b ? Q.net(b, '+') : -1; return { a: { p: r.id, t: Q.freeTerm(r, used, Q.pos(l, 'a')) }, b: { p: l.id, t: 'a' } }; },
          done: Q => !!Q.series('battery', '+', 'resistor', 'led', 'a'), hint: 'The resistor must sit BETWEEN the battery and the LED. Use its free end.' },
        { title: 'Close the circuit', text: 'Current needs a way back. The LED’s <b>cathode (k)</b> and the battery’s <b>−</b> must both touch a ground symbol. If you placed the ground symbols on the pins they may already be connected; if not, wire each pin to its ground symbol.', done: Q => Q.linked('led', 'k', 'battery', '-'), hint: 'Check both pins: the battery − and the LED cathode must each be wired to (or sit on) a ground symbol.' },
        { title: 'Press Run', text: 'Press the <b>Run</b> button (or F5). If the LED glows, your circuit works! 🎉', target: '#btnRun', done: Q => Q.env.running && ledOn(Q), sticky: true, hint: 'If nothing lights, click “Check” in the toolbar: it finds common wiring mistakes.' },
        { title: 'Experiment', text: 'Select the resistor and set it to <b>2 kΩ</b> in the Properties panel while the circuit runs. Watch the LED get dimmer: a bigger resistor means less current.', done: Q => Q.env.running && Q.prop('resistor', 'ohms', v => v >= 2000), hint: 'Click the resistor, then change “Resistance” in Properties.' }
      ],
      finish: 'You built and ran a circuit! Next, learn to measure it with a multimeter.', next: 'g-meter'
    },
    {
      id: 'g-meter', title: 'Measure a voltage divider', level: 'Beginner', minutes: 7, icon: '🔋',
      summary: 'Two resistors share 9 V. Predict the voltage, then check it with a multimeter.',
      steps: [
        { title: 'Add a battery', text: 'Click <b>Battery</b> in the Parts panel.', focus: 'battery', ghost: [{ type: 'battery', x: 100, y: 200, props: { volts: 9 } }], done: Q => Q.has('battery') },
        { title: 'Add two resistors', text: 'A voltage divider has <b>two resistors in series</b>. Click <b>Resistor</b> twice.', focus: 'resistor', ghost: [{ type: 'resistor', x: 220, y: 140, rot: 90, props: { ohms: 1000 } }, { type: 'resistor', x: 220, y: 220, rot: 90, props: { ohms: 2000 } }], done: Q => Q.has('resistor', 2) },
        { title: 'Set the values: 1 kΩ and 2 kΩ', text: 'Select each resistor and set R1 = <b>1 kΩ</b> and R2 = <b>2 kΩ</b> in the Properties panel. The divider formula says V<sub>out</sub> = 9 V × R2 ÷ (R1 + R2) = <b>6 V</b>.', done: Q => Q.prop('resistor', 'ohms', v => v === 1000) && Q.prop('resistor', 'ohms', v => v === 2000), hint: 'Type 1k and 2k: the app understands k and M.' },
        { title: 'Add a ground', text: 'Add a <b>ground</b> symbol for the bottom of the circuit.', focus: 'ground', ghost: [{ type: 'ground', x: 100, y: 240 }], done: Q => Q.has('ground') },
        { title: 'Wire them in a loop', text: 'Connect: battery <b>+</b> → R1 → R2 → battery <b>−</b>. The point between the two resistors is the divider output.', done: Q => { const r1 = Q.of('resistor').find(r => r.props.ohms === 1000), r2 = Q.of('resistor').find(r => r.props.ohms === 2000); if (!r1 || !r2) return false; const b = Q.of('battery')[0]; if (!b) return false; const n = (p, t) => Q.net(p, t); const ends = p => Q.circuit && ['a', 'b'].map(t => n(p, t)); const bp = n(b, '+'), bm = n(b, '-'); const e1 = ends(r1), e2 = ends(r2); return (e1.includes(bp) && e2.includes(bm) && e1.find(x => x !== bp) === e2.find(x => x !== bm)) || (e1.includes(bm) && e2.includes(bp) && e1.find(x => x !== bm) === e2.find(x => x !== bp)); }, hint: 'The middle point must be shared by exactly one end of each resistor.' },
        { title: 'Add the multimeter', text: 'From the <b>Instruments</b> group add a <b>Multimeter</b>. It reads DC volts by default. <b>Click on the meter</b> any time to turn its dial.', focus: 'multimeter', ghost: [{ type: 'multimeter', x: 360, y: 160, props: { mode: 'dcv' } }], done: Q => Q.has('multimeter') },
        { title: 'Connect the probes across R2', text: 'To measure voltage, connect the meter <b>in parallel</b> with the part: the <b>red</b> probe to the junction between the resistors, the <b>black</b> probe to the ground side of R2.', wire: Q => { const m = Q.of('multimeter')[0], r1 = Q.of('resistor').find(r => r.props.ohms === 1000), r2 = Q.of('resistor').find(r => r.props.ohms === 2000); if (!m || !r1 || !r2) return null;
            const n1 = [Q.net(r1, 'a'), Q.net(r1, 'b')], jT = ['a', 'b'].find(t => n1.includes(Q.net(r2, t))), oT = jT === 'a' ? 'b' : 'a';
            if (!jT) return null; if (Q.net(m, 'red') !== Q.net(r2, jT)) return { a: { p: m.id, t: 'red' }, b: { p: r2.id, t: jT } }; return { a: { p: m.id, t: 'black' }, b: { p: r2.id, t: oT } }; },
          done: Q => { const m = Q.of('multimeter')[0], r2 = Q.of('resistor').find(r => r.props.ohms === 2000); if (!m || !r2) return false; const rn = [Q.net(r2, 'a'), Q.net(r2, 'b')], red = Q.net(m, 'red'), blk = Q.net(m, 'black'); return rn.includes(red) && rn.includes(blk) && red !== blk; }, hint: 'Red on the junction between R1 and R2, black on the other end of R2.' },
        { title: 'Press Run and read the meter', text: 'Press <b>Run</b>. The multimeter should show about <b>6 V</b>. Does it match your prediction?', target: '#btnRun', sticky: true,
          done: Q => { const m = Q.of('multimeter')[0]; return Q.env.running && m && m.props.mode === 'dcv' && m.rt && Math.abs((m.rt.reading || 0) - 6) < 0.15; }, hint: 'If it reads 3 V, you measured across R1 instead of R2. If it reads 9 V, the red probe is on the battery +.' },
        { title: 'Turn the dial', text: 'Click the multimeter to switch to <b>amps</b>. A multimeter measures current <b>in series</b>; across a part it would blow its fuse! Try it, then press Stop and Run to replace the fuse. (Or just continue.)', done: Q => Q.of('multimeter').some(m => m.props.mode !== 'dcv') || false, hint: 'Click on the yellow meter body to cycle the dial.' }
      ],
      finish: 'You can now predict and measure voltages. Next: make an Arduino blink an LED.', next: 'g-blink'
    },
    {
      id: 'g-blink', title: 'Blink an LED with Arduino', level: 'Beginner', minutes: 8, icon: '⌨️',
      summary: 'Wire an LED to pin 12 and write your first sketch.',
      steps: [
        { title: 'Add the Arduino', text: 'Click <b>Arduino Uno</b> in the Parts panel (Boards). It is placed where the highlight shows.', focus: 'arduino', ghost: [{ type: 'arduino', x: 100, y: 260 }], done: Q => Q.has('arduino') },
        { title: 'Add a resistor and an LED', text: 'Add a <b>Resistor</b> (220 Ω) and an <b>LED</b>. The resistor protects the LED from too much current.', focus: 'resistor', ghost: [{ type: 'resistor', x: 180, y: 220, rot: 90, props: { ohms: 220 } }, { type: 'led', x: 180, y: 140, rot: 270, props: { color: 'green' } }], done: Q => Q.has('resistor') && Q.has('led'), hint: 'Resistor is in Passive, LED in Semiconductors.' },
        { title: 'Wire pin 12 to the resistor', text: 'Drag from the Arduino’s <b>D12</b> pin (top row) to one end of the resistor.', wire: Q => { const a = Q.of('arduino')[0], r = Q.of('resistor')[0]; return a && r && { a: { p: a.id, t: 'D12' }, b: { p: r.id, t: Q.freeTerm(r, -1, Q.pos(a, 'D12')) } }; }, done: Q => Q.linked('arduino', 'D12', 'resistor', 'any') },
        { title: 'Wire the resistor to the LED', text: 'Connect the resistor’s other end to the LED’s <b>anode (a)</b>.', wire: Q => { const l = Q.of('led')[0], r = Q.of('resistor')[0], a = Q.of('arduino')[0]; if (!l || !r) return null; return { a: { p: r.id, t: Q.freeTerm(r, a ? Q.net(a, 'D12') : -1, Q.pos(l, 'a')) }, b: { p: l.id, t: 'a' } }; }, done: Q => !!Q.series('arduino', 'D12', 'resistor', 'led', 'a') },
        { title: 'Wire the LED to ground', text: 'Connect the LED’s <b>cathode (k)</b> to one of the Arduino’s <b>GND</b> pins.', wire: Q => { const l = Q.of('led')[0], a = Q.of('arduino')[0]; return l && a && { a: { p: l.id, t: 'k' }, b: { p: a.id, t: 'GND_T' } }; }, done: Q => Q.linked('led', 'k', 'arduino', ARD_GND), hint: 'GND_T is the pin at the left end of the top row.' },
        { title: 'Write the sketch', text: 'Open the <b>Sketch</b> tab at the bottom. A sketch needs <code>pinMode()</code> to make the pin an output, <code>digitalWrite()</code> to switch it, and <code>delay()</code> to wait. Type it, or let the button below do it.', tab: 'code',
          action: { label: '✨ Type the sketch for me', run: lab => lab.setSketch(BLINK) }, done: Q => /pinMode\s*\(/.test(Q.env.sketch || '') && /digitalWrite\s*\(/.test(Q.env.sketch || '') && /delay\s*\(/.test(Q.env.sketch || ''), hint: 'Pin 12 must match your wiring.' },
        { title: 'Run it', text: 'Press <b>Run</b>. The LED should blink once a second.', target: '#btnRun', sticky: true, done: Q => Q.env.running && (Q.env.ledEdges || 0) >= 2, hint: 'No blinking? Click Check: it explains what is wrong, including sketch errors.' },
        { title: 'Change the speed', text: 'Change both <code>delay(500)</code> values to <code>delay(100)</code> and run again: the LED blinks five times faster.', done: Q => /delay\s*\(\s*(1\d\d|\d\d)\s*\)/.test(Q.env.sketch || '') && !/delay\s*\(\s*500\s*\)/.test(Q.env.sketch || '') },
      ],
      finish: 'You wired an Arduino and wrote your first program!', next: 'g-bode'
    },
    {
      id: 'g-bode', title: 'RC filter and Bode plot', level: 'Intermediate', minutes: 9, icon: '📈',
      summary: 'Build a low-pass filter and find its cut-off frequency with the Analysis tool.',
      steps: [
        { title: 'Add a function generator', text: 'Click <b>Function generator</b> (AC source) in the Parts panel (Power). It makes the sine wave that goes into the filter.', focus: 'acsource', ghost: [{ type: 'acsource', x: 100, y: 200, props: { amp: 5, freq: 100, shape: 'sine' } }], done: Q => Q.has('acsource') },
        { title: 'Add a resistor and a capacitor', text: 'A low-pass filter is a <b>resistor</b> followed by a <b>capacitor</b> to ground.', focus: 'resistor', ghost: [{ type: 'resistor', x: 220, y: 160, props: { ohms: 1600 } }, { type: 'capacitor', x: 300, y: 200, rot: 90, props: { farads: 1e-6 } }], done: Q => Q.has('resistor') && Q.has('capacitor') },
        { title: 'Set R = 1.6 kΩ and C = 1 µF', text: 'The cut-off frequency is f<sub>c</sub> = 1 ÷ (2π R C). With these values it is about <b>99.5 Hz</b>. Select each part and set its value in Properties.', done: Q => Q.prop('resistor', 'ohms', v => num(v, 1590, 1610)) && Q.prop('capacitor', 'farads', v => num(v, 0.9e-6, 1.1e-6)), hint: 'Type 1.6k for the resistor and 1u for the capacitor.' },
        { title: 'Add ground symbols', text: 'Add two <b>ground</b> symbols: one for the generator’s − side and one for the capacitor.', focus: 'ground', ghost: [{ type: 'ground', x: 100, y: 240 }, { type: 'ground', x: 300, y: 220 }], done: Q => Q.has('ground', 2) },
        { title: 'Wire the filter', text: 'Connect generator <b>+</b> → resistor → capacitor, and the capacitor’s other end to ground. The output is the point between the resistor and the capacitor.', done: Q => !!Q.series('acsource', '+', 'resistor', 'capacitor', 'any') && (Q.linked('capacitor', 'any', 'acsource', '-')), hint: 'Both the capacitor’s bottom pin and the generator − must touch ground.' },
        { title: 'Open the frequency response', text: 'Click <b>Analysis → Frequency response…</b> in the toolbar, then press <b>Run analysis</b>.', target: '#btnAnalysis', sticky: true, done: Q => (Q.env.St ? Q.env.St.count('analysisRuns') : 0) > (Q.env.base ? Q.env.base.analysis : 0), hint: 'Pick the capacitor’s top pin as the Output point.' },
        { title: 'Read the cut-off', text: 'The plot marks the <b>−3 dB</b> point. It should be close to 99.5 Hz, matching the formula. Above it the gain falls by 20 dB every time the frequency is 10× higher, and the phase heads towards −90°. Change R or C and run it again to see the corner move!', done: Q => true, manual: true }
      ],
      finish: 'You designed a filter and verified it with a Bode plot.', next: 'g-led'
    }
  ];
  const byId = Object.fromEntries(TUTORIALS.map(t => [t.id, t]));

  /* ===================== evaluation ===================== */
  // returns { done: [bool…], current: index (first undone), total }
  function evaluate(tut, circuit, env, sticky) {
    sticky = sticky || {}; const Q = makeQuery(circuit, env), done = [];
    for (let i = 0; i < tut.steps.length; i++) {
      const st = tut.steps[i]; let ok = !!sticky[i];
      if (!ok && !st.manual) { try { ok = !!st.done(Q, env); } catch (e) { ok = false; } }
      if (ok && st.sticky) sticky[i] = true;
      done.push(ok);
    }
    let cur = done.findIndex(d => !d); if (cur < 0) cur = tut.steps.length;
    return { done, current: cur, total: tut.steps.length, Q };
  }

  S21.Guide = { TUTORIALS, byId, makeQuery, evaluate };
  if (typeof module !== 'undefined' && module.exports) module.exports = S21.Guide;
  if (typeof document === 'undefined') return;

  /* ===================== the docked Learn panel ===================== */
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const Guide = S21.Guide, KEY = 's21lab-guide';
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) {}
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (_) {} };
  const lab = () => S21.Lab;
  Guide.active = null;                    // { tut, sticky, skipped:Set, ledOn, ledEdges, base, shown }
  let layer = null, lastCur = -1, advTimer = 0, tickT = 0;

  function env() {
    const L = lab(), a = Guide.active;
    return { running: !!(L.running && L.rt), sketch: L.sketch || '', ledEdges: a ? a.ledEdges : 0, base: a ? a.base : null, St: S21.Stats };
  }
  Guide.evaluateNow = function () {
    const a = Guide.active; if (!a) return null;
    return Guide.evaluate(a.tut, lab().editor.circuit, env(), a.sticky);
  };

  /* ---- canvas overlay ---- */
  function ensureLayer() {
    const ed = lab().editor; if (layer && layer.parentNode) return layer;
    layer = document.createElementNS('http://www.w3.org/2000/svg', 'g'); layer.setAttribute('id', 'guideLayer'); layer.setAttribute('pointer-events', 'none'); ed.world.appendChild(layer); return layer;
  }
  function clearOverlay() {
    if (layer) layer.innerHTML = '';
    $$('.guide-pulse').forEach(n => n.classList.remove('guide-pulse'));
  }
  function drawOverlay(res) {
    clearOverlay(); const a = Guide.active; if (!a || res.current >= res.total) return;
    const st = a.tut.steps[res.current], g = ensureLayer(), NS = 'http://www.w3.org/2000/svg', P_ = S21.Parts;
    for (const gh of st.ghost || []) {
      const d = P_.PARTS[gh.type]; if (!d) continue;
      const have = res.Q.of(gh.type).length; if (st.ghostOnce && have) continue;
      const c = { type: gh.type, props: Object.assign({}, d.defaults || {}, gh.props || {}), rt: {}, x: gh.x, y: gh.y, rot: gh.rot || 0, id: 'ghost' };
      const gg = document.createElementNS(NS, 'g'); gg.setAttribute('class', 'guide-ghost'); gg.setAttribute('transform', 'translate(' + gh.x + ',' + gh.y + ') rotate(' + (gh.rot || 0) + ')');
      let html = ''; try { html = d.svg(c); } catch (_) {}
      const b = d.bounds || [-50, -40, 100, 80];
      gg.innerHTML = '<rect class="guide-ring" x="' + (b[0] - 6) + '" y="' + (b[1] - 6) + '" width="' + (b[2] + 12) + '" height="' + (b[3] + 12) + '" rx="10"/><g opacity=".5">' + html + '</g>';
      g.appendChild(gg);
    }
    if (st.wire) {
      let w = null; try { w = st.wire(res.Q); } catch (_) {}
      if (w && w.a && w.b && w.a.t && w.b.t) {
        const A = P_.termPos(lab().editor.circuit, w.a), B = P_.termPos(lab().editor.circuit, w.b);
        if (A && B) {
          const line = document.createElementNS(NS, 'line'); line.setAttribute('x1', A.x); line.setAttribute('y1', A.y); line.setAttribute('x2', B.x); line.setAttribute('y2', B.y); line.setAttribute('class', 'guide-wire'); g.appendChild(line);
          for (const p of [A, B]) { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 9); c.setAttribute('class', 'guide-dot'); g.appendChild(c); }
        }
      }
    }
    if (st.focus) {
      const sb = $('#palSearch'); if (sb && sb.value) { sb.value = ''; sb.dispatchEvent(new Event('input')); }
      const it = $('.pal-item[data-type="' + st.focus + '"]'); if (it) { it.classList.add('guide-pulse'); it.scrollIntoView({ block: 'nearest' }); }
    }
    if (st.target) { const t = $(st.target); if (t) t.classList.add('guide-pulse'); }
    if (st.tab && a.shownTab !== res.current) { a.shownTab = res.current; lab().showTab(st.tab); }
  }
  // a palette click while a ghost is shown places the part exactly there
  Guide.placementFor = function (type) {
    const a = Guide.active; if (!a) return null; const res = Guide.evaluateNow(); if (!res || res.current >= res.total) return null;
    const st = a.tut.steps[res.current]; if (!st.ghost) return null;
    const want = st.ghost.filter(g => g.type === type), have = res.Q.of(type).length;
    // ghosts for the same type are consumed in order
    const sameBefore = st.ghost.filter(g => g.type === type).length; if (!want.length) return null;
    const idx = Math.min(have, want.length - 1); const g = want[Math.max(0, Math.min(idx, want.length - 1))];
    return { x: g.x, y: g.y, rot: g.rot || 0, props: g.props || {} };
  };

  /* ---- panel rendering ---- */
  function body() { return $('#learnBody'); }
  function renderLibrary() {
    const b = body(); if (!b) return;
    b.innerHTML = '<p class="lp-intro">Guided tutorials build a circuit <b>with you</b>: each step is checked on the real canvas.</p>' +
      Guide.TUTORIALS.map(t => { const s = saved[t.id] || {}; return '<button class="lp-card" data-id="' + t.id + '"><span class="lp-ic">' + t.icon + '</span><span class="lp-tx"><b>' + esc(t.title) + '</b><small>' + esc(t.level) + ' · ' + t.minutes + ' min · ' + t.steps.length + ' steps</small><em>' + esc(t.summary) + '</em></span>' + (s.done ? '<span class="lp-done">✓</span>' : '<span class="lp-go">▶</span>') + '</button>'; }).join('') +
      '<button class="btn small lp-more" id="lpLessons">📘 Browse all lessons</button>';
    $$('.lp-card', b).forEach(c => c.onclick = () => Guide.start(c.dataset.id));
    $('#lpLessons', b).onclick = () => S21.App.show('learn');
    setHeader('Learn');
  }
  function setHeader(t) { const h = $('#learnTitle'); if (h) h.textContent = t; }
  function renderActive(res) {
    const a = Guide.active, b = body(); if (!a || !b) return;
    const t = a.tut, doneN = res.done.filter(Boolean).length, pct = Math.round(doneN / res.total * 100);
    setHeader('Learn · ' + t.title);
    let html = '<div class="lp-prog"><div class="bar"><i style="width:' + pct + '%"></i></div><span>' + (res.current >= res.total ? 'Complete' : 'Step ' + (res.current + 1) + ' of ' + res.total) + '</span></div><ol class="lp-steps">';
    t.steps.forEach((st, i) => {
      const done = res.done[i], cur = i === res.current;
      html += '<li class="lp-step' + (done ? ' done' : '') + (cur ? ' cur' : '') + '" data-i="' + i + '"><span class="lp-mark">' + (done ? '✓' : cur ? '●' : i + 1) + '</span><div><b>' + esc(st.title) + '</b>';
      if (cur) {
        html += '<p>' + st.text + '</p>';
        if (st.action) html += '<button class="btn small primary" id="lpAct">' + esc(st.action.label) + '</button> ';
        if (st.hint) html += '<details class="lp-hint"><summary>Need a hint?</summary><p>' + st.hint + '</p></details>';
        html += '<div class="lp-nav">' + (i > 0 ? '<button class="btn small" id="lpBack">← Back</button>' : '') + (a.viewStep !== undefined ? '<button class="btn small primary" id="lpFwd">Continue →</button>' : '<button class="btn small' + (st.manual ? ' primary' : '') + '" id="lpSkip">' + (st.manual ? 'Got it ✓' : 'Skip step') + '</button>') + '</div>';
      }
      html += '</div></li>';
    });
    html += '</ol>';
    if (res.current >= res.total) html += '<div class="lp-finish"><div class="big">🎉</div><p><b>Tutorial complete!</b></p><p class="soft">' + esc(t.finish || '') + '</p>' + (t.next ? '<button class="btn primary" id="lpNext">Next tutorial →</button> ' : '') + '<button class="btn" id="lpCheck">🩺 Check my circuit</button> <button class="btn" id="lpExit">Back to tutorials</button></div>';
    else html += '<div class="lp-foot"><button class="btn small" id="lpRestart">Restart</button><button class="btn small" id="lpExit">Exit tutorial</button></div>';
    b.innerHTML = html;
    const act = $('#lpAct', b); if (act) act.onclick = () => { t.steps[res.current].action.run(lab()); setTimeout(Guide.update, 50); };
    const skip = $('#lpSkip', b); if (skip) skip.onclick = () => { a.sticky[res.current] = true; Guide.update(true); };
    const back = $('#lpBack', b); if (back) back.onclick = () => { a.viewStep = Math.max(0, (a.viewStep !== undefined ? a.viewStep : res.current) - 1); Guide.update(true); };
    const fwd = $('#lpFwd', b); if (fwd) fwd.onclick = () => { a.viewStep = undefined; Guide.update(true); };
    const nx = $('#lpNext', b); if (nx) nx.onclick = () => Guide.start(t.next);
    const ck = $('#lpCheck', b); if (ck) ck.onclick = () => S21.Tools.doctor();
    const ex = $('#lpExit', b); if (ex) ex.onclick = Guide.stop;
    const rs = $('#lpRestart', b); if (rs) rs.onclick = () => Guide.start(t.id, true);
    const cs = $('.lp-step.cur', b); if (cs) cs.scrollIntoView({ block: 'nearest' });
  }

  /* ---- lifecycle ---- */
  Guide.update = function (force) {
    const a = Guide.active; if (!a) return;
    const res = Guide.evaluateNow();
    if (a.viewStep !== undefined) { if (a.viewStep >= res.current) a.viewStep = undefined; else { res.current = a.viewStep; } }
    const ed = lab().editor.circuit, sig = res.done.join('') + '|' + res.current + '|' + a.viewStep + '|' + ed.parts.length + ':' + ed.wires.length + '|' + (res.current < res.total ? a.tut.steps[res.current].wire ? '' : '' : '');
    if (!force && sig === a.sig) return;
    const advanced = a.sig !== undefined && res.current > lastCur && lastCur >= 0;
    a.sig = sig; lastCur = res.current;
    renderActive(res); drawOverlay(res);
    if (advanced) { const prev = $('#learnBody .lp-step.done:last-of-type .lp-mark'); if (prev) prev.classList.add('pop'); }
    if (res.current >= res.total && !saved[a.tut.id + '#c']) { saved[a.tut.id] = { done: true }; saved[a.tut.id + '#c'] = 1; persist(); if (S21.Stats) { S21.Stats.mark('guides', a.tut.id); S21.Stats.bump('guidesDone'); } if (S21.Home) S21.Home.check(); lab().toast('🎉 Tutorial complete: ' + a.tut.title, '', 5000); }
  };
  Guide.start = function (id, restart) {
    const tut = Guide.byId[id]; if (!tut) return;
    const go = () => {
      S21.App.show('lab');
      lab().stop(); lab().newProject(); lab().editor.view = { x: 60, y: 40, k: 1 }; lab().editor.applyView();
      saved[id + '#c'] = 0;
      Guide.active = { tut, sticky: {}, viewStep: undefined, sig: undefined, ledOn: false, ledEdges: 0, base: { analysis: S21.Stats ? S21.Stats.count('analysisRuns') : 0 }, shownTab: -1 };
      lastCur = -1; openPanel(true); if (S21.Stats) S21.Stats.mark('guideStarted', id);
      Guide.update(true);
    };
    if (lab().editor.circuit.parts.length && !restart) {
      S21.Tools.modal({ title: 'Start “' + tut.title + '”?', body: '<p>The tutorial starts on a <b>fresh canvas</b>. Your current circuit has been autosaved and can be brought back with Export → Restore last autosave.</p>', actions: [{ label: 'Cancel', onClick: m => m.close() }, { label: 'Start the tutorial', primary: true, onClick: m => { m.close(); go(); } }] });
    } else go();
  };
  Guide.stop = function () { Guide.active = null; lastCur = -1; clearOverlay(); renderLibrary(); };
  function openPanel(big) {
    const p = $('#learnPanel'), q = $('#propsPanel'); if (!p) return;
    p.classList.remove('collapsed'); p.classList.toggle('big', !!big); if (big) q.classList.add('small');
  }
  // sample the LEDs a few times a second (to notice blinking)
  function sampleLoop() {
    const a = Guide.active;
    if (a && lab().running && lab().rt) {
      const on = lab().editor.circuit.parts.some(p => p.type === 'led' && (p.rt.ia || 0) > 0.004);
      if (on !== a.ledOn) { a.ledOn = on; a.ledEdges++; }
    }
    if (a && Date.now() - tickT > 400) { tickT = Date.now(); Guide.update(); }
  }
  Guide.onChanged = function () { if (Guide.active) { clearTimeout(advTimer); advTimer = setTimeout(Guide.update, 120); } };

  Guide.init = function () {
    // dock behaviour
    for (const id of ['learnPanel', 'propsPanel']) { const p = $('#' + id); $('.rp-toggle', p).onclick = () => { p.classList.toggle('collapsed'); }; $('.rp-head', p).ondblclick = () => p.classList.toggle('collapsed'); }
    const rs = $('#rdockResize'), view = $('#view-lab');
    rs.onpointerdown = e => { rs.setPointerCapture(e.pointerId); const x0 = e.clientX, w0 = $('#rdock').getBoundingClientRect().width; rs.onpointermove = ev => { const w = Math.max(250, Math.min(560, w0 + (x0 - ev.clientX))); view.style.setProperty('--rdock-w', w + 'px'); }; rs.onpointerup = () => { rs.onpointermove = null; try { localStorage.setItem('s21lab-rdock', view.style.getPropertyValue('--rdock-w')); } catch (_) {} }; };
    try { const w = localStorage.getItem('s21lab-rdock'); if (w) view.style.setProperty('--rdock-w', w); } catch (_) {}
    $('#learnMenu').onclick = e => S21.Tools.menu(e.currentTarget, Guide.active ? [{ label: 'Restart this tutorial', onClick: () => Guide.start(Guide.active.tut.id, true) }, { label: 'Exit tutorial', onClick: Guide.stop }, '-', { label: 'All lessons…', onClick: () => S21.App.show('learn') }] : [{ label: 'Browse all lessons…', onClick: () => S21.App.show('learn') }, { label: 'Take the app tour', onClick: () => S21.Onboarding.tour() }]);
    $('#codeTa').addEventListener('input', () => Guide.onChanged());
    renderLibrary();
    setInterval(sampleLoop, 150);
  };
})(typeof window !== 'undefined' ? window : globalThis);
