/* ---------------------------------------------------------------
   Smart21 ElectroLab — circuit doctor (mistake detector)
   analyze(circuit)               fast static checks: wiring mistakes
   analyzeRun(circuit, sketch)    runs a private copy for ~1.5 s and
                                  looks at what actually happens
   Every finding explains the problem in plain words and says how
   to fix it. Pure functions: usable (and tested) in Node.
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const P = () => S21.Parts, A = () => S21.Analysis, PARTS = () => S21.Parts.PARTS;
  const SEV = { error: 0, warn: 1, tip: 2 };

  const ALL_TERMS = new Set(['resistor', 'capacitor', 'inductor', 'led', 'diode', 'zener', 'ldr', 'ntc', 'buzzer', 'motor', 'battery', 'switch', 'button', 'acsource',
    'npn', 'pnp', 'mosfet', 'voltmeter', 'ammeter', 'multimeter', 'vcc', 'servo']);
  const REQUIRED = { pot: ['a', 'b'], opamp: ['p', 'n', 'o', 'vp'], relay: ['c1', 'c2'], hc595: ['VCC', 'GND', 'SER', 'SRCLK', 'RCLK'], rgbled: ['com'] };
  const isPin = t => /^(D\d+|A\d+)$/.test(t);
  const POS = (c, t) => (c.type === 'battery' && t === '+') || (c.type === 'vcc' && t === 'v') || (c.type === 'acsource' && t === '+') || (c.type === 'arduino' && (t === '5V' || t === '3V3' || t === 'VIN' || isPin(t)));
  const LOW = (c, t) => (c.type === 'battery' && t === '-') || (c.type === 'acsource' && t === '-') || c.type === 'ground' || (c.type === 'arduino' && /^GND/.test(t));

  function analyze(circuit) {
    const out = [], seen = new Set();
    const add = (id, sev, title, text, parts, extra) => { if (seen.has(id)) return; seen.add(id); out.push(Object.assign({ id, sev, title, text, parts: parts || [] }, extra || {})); };
    if (!circuit.parts.length) return out;
    const c0 = A().clone(circuit), nl = P().buildNetlist(c0), refs = A().refMap(c0);
    const parts = c0.parts, byId = new Map(parts.map(p => [p.id, p]));
    const net = (c, t) => nl.nodeOf(c.id, t), R = id => refs[id] || id;
    const members = new Map();                                   // net -> [{c, t}]
    for (const c of parts) for (const t of PARTS()[c.type].terms) { const n = net(c, t.n); if (!members.has(n)) members.set(n, []); members.get(n).push({ c, t: t.n }); }
    // roots that also merge nets through switches / buttons / ammeters (conditional connections)
    const par = new Map(); const find = x => { if (!par.has(x)) par.set(x, x); let r = x; while (par.get(r) !== r) r = par.get(r); par.set(x, r); return r; };
    const union = (a, b) => { par.set(find(a), find(b)); };
    for (const c of parts) if (['switch', 'button', 'ammeter'].includes(c.type)) union(net(c, 'a'), net(c, 'b'));
    const rootPos = n => { const r = find(n); for (const [k, ms] of members) if (find(k) === r && ms.some(m => POS(m.c, m.t))) return true; return false; };
    const rootLow = n => { const r = find(n); if (find(0) === r) return true; for (const [k, ms] of members) if (find(k) === r && (k === 0 || ms.some(m => LOW(m.c, m.t)))) return true; return false; };

    /* ---- 1. short circuits ---- */
    for (const [n, ms] of members) {
      const pos = ms.find(m => POS(m.c, m.t) && !(m.c.type === 'arduino' && isPin(m.t))), low = ms.find(m => LOW(m.c, m.t) && m !== pos);
      if (pos && low) add('short-' + n, 'error', 'Short circuit', R(pos.c.id) + (pos.c.type === 'arduino' ? ' ' + pos.t : ' +') + ' is connected straight to ground (0 V) with nothing in between. A real supply would overheat. Put a resistor or a load between them.', [pos.c.id]);
    }
    for (const c of parts) if (c.type === 'battery' && net(c, '+') === net(c, '-')) add('short-bat' + c.id, 'error', 'Battery shorted', R(c.id) + ' has its + and − terminals joined together.', [c.id]);
    for (const c of parts) if (c.type === 'battery' && net(c, '+') !== net(c, '-') && find(net(c, '+')) === find(net(c, '-'))) add('short-sw' + c.id, 'warn', 'Switch can short the supply', 'A switch, button or ammeter is the only thing between the + and − of ' + R(c.id) + '. When it closes, the battery is shorted. Add a resistor or load in series.', [c.id]);

    /* ---- 2. parts across a supply with no current limit ---- */
    for (const c of parts) {
      const d = P().PARTS[c.type];
      const across = (a, k) => rootPos(net(c, a)) && rootLow(net(c, k)) && find(net(c, a)) !== find(net(c, k));
      if (c.type === 'led' && across('a', 'k')) add('led-nores-' + c.id, 'error', 'LED without a resistor', R(c.id) + ' is wired straight across a supply or pin. It will burn out in a fraction of a second. Add a resistor in series: about 220–470 Ω on 5 V, 470–1 kΩ on 9 V.', [c.id], { fix: 'resistor' });
      if (c.type === 'rgbled') { const ca = c.props.common === 'anode'; ['r', 'g', 'b'].forEach(k => { if ((ca ? across('com', k) : across(k, 'com'))) add('rgb-nores-' + c.id + k, 'error', 'RGB LED colour without a resistor', 'The ' + { r: 'red', g: 'green', b: 'blue' }[k] + ' leg of ' + R(c.id) + ' goes straight to a supply or pin. Each colour needs its own resistor.', [c.id], { fix: 'resistor' }); }); }
      if (c.type === 'diode' && across('a', 'k')) add('diode-short-' + c.id, 'error', 'Diode across the supply', R(c.id) + ' is connected forward across a supply: it acts like a short circuit. Add a resistor in series.', [c.id], { fix: 'resistor' });
      if (c.type === 'zener' && across('k', 'a')) add('zener-nores-' + c.id, 'error', 'Zener without a series resistor', R(c.id) + ' is across a supply with nothing to limit the current. Add a resistor between the supply and the Zener.', [c.id], { fix: 'resistor' });
      if ((c.type === 'npn' || c.type === 'pnp') && rootPos(net(c, 'b')) && !members.get(net(c, 'b')).some(m => m.c.type === 'resistor')) {
        const direct = (members.get(net(c, 'b')) || []).some(m => POS(m.c, m.t));
        if (direct) add('base-direct-' + c.id, 'error', 'Transistor base without a resistor', 'The base of ' + R(c.id) + ' is wired straight to a supply or pin. Put a resistor of 1–10 kΩ in series with the base.', [c.id], { fix: 'resistor' });
      }
    }

    /* ---- 3. Arduino pins ---- */
    const ards = parts.filter(p => p.type === 'arduino');
    for (const a of ards) {
      const pins = PARTS().arduino.terms.filter(t => isPin(t.n));
      for (const t of pins) {
        const ms = members.get(net(a, t.n)) || [];
        for (const m of ms) {
          if (m.c.type === 'motor') add('pin-motor-' + m.c.id, 'error', 'Motor on an Arduino pin', R(m.c.id) + ' is connected straight to pin ' + t.n + '. A pin gives only about 20 mA, a motor needs far more. Drive it through a transistor or MOSFET.', [m.c.id, a.id], { fix: 'transistor' });
          if (m.c.type === 'relay' && (m.t === 'c1' || m.t === 'c2')) add('pin-relay-' + m.c.id, 'error', 'Relay coil on an Arduino pin', R(m.c.id) + ' coil is connected straight to pin ' + t.n + '. A pin cannot supply the 70+ mA a coil needs. Use a transistor.', [m.c.id, a.id], { fix: 'transistor' });
          if (m.c.type === 'battery' && m.t === '+' && m.c.props.volts > 5.5) add('overvolt-' + m.c.id + t.n, 'error', 'Too much voltage for the Arduino', R(m.c.id) + ' (' + m.c.props.volts + ' V) is connected to pin ' + t.n + '. Pins tolerate 5 V at most. Use a voltage divider or a level shifter.', [m.c.id, a.id]);
          if (m.c.type === 'arduino' && m.t !== t.n && isPin(m.t) && t.n < m.t) add('pins-tied-' + t.n + m.t, 'warn', 'Two Arduino pins tied together', 'Pins ' + t.n + ' and ' + m.t + ' are wired to each other. If one is HIGH and the other LOW they fight and can be damaged.', [a.id]);
        }
      }
    }

    /* ---- 4. coils without a flyback diode ---- */
    for (const c of parts) {
      const coil = c.type === 'relay' ? ['c1', 'c2'] : c.type === 'inductor' ? ['a', 'b'] : c.type === 'motor' ? ['a', 'b'] : null; if (!coil) continue;
      const n1 = net(c, coil[0]), n2 = net(c, coil[1]);
      if (n1 === n2) continue;
      const has = parts.some(d => d.type === 'diode' && ((net(d, 'a') === n1 && net(d, 'k') === n2) || (net(d, 'a') === n2 && net(d, 'k') === n1)));
      const hasMos = parts.some(d => d.type === 'mosfet');
      if (!has && c.type === 'relay') add('flyback-' + c.id, 'warn', 'No flyback diode', R(c.id) + ' is a coil. When it switches off it makes a high-voltage spike that can destroy the transistor. Put a diode across the coil, bar (cathode) towards the + side.', [c.id], { fix: 'diode' });
      else if (!has && c.type === 'inductor') add('flyback-' + c.id, 'tip', 'Inductor without a diode', R(c.id) + ' will produce a voltage spike when its current is cut. A diode across it absorbs the spike.', [c.id]);
      else if (!has && c.type === 'motor' && !hasMos && parts.some(d => d.type === 'npn' || d.type === 'pnp')) add('flyback-' + c.id, 'tip', 'Motor without a diode', 'A motor behaves like a coil: add a diode across ' + R(c.id) + ' (bar towards +) to protect the transistor that switches it.', [c.id], { fix: 'diode' });
    }

    /* ---- 5. unconnected terminals ---- */
    for (const c of parts) {
      const d = P().PARTS[c.type];
      const need = ALL_TERMS.has(c.type) ? d.terms.map(t => t.n) : (REQUIRED[c.type] || d.required || []);
      const open = need.filter(tn => { const n = net(c, tn); return n !== 0 && (members.get(n) || []).length <= 1; });
      if (open.length) {
        const labels = open.map(tn => (d.terms.find(t => t.n === tn) || {}).label || tn);
        add('open-' + c.id, c.type === 'battery' || c.type === 'vcc' ? 'tip' : 'warn', 'Unconnected ' + (open.length > 1 ? 'terminals' : 'terminal'), R(c.id) + ' has ' + (open.length > 1 ? 'terminals' : 'a terminal') + ' that go nowhere: ' + labels.join(', ') + '. Current cannot flow until it is wired.', [c.id]);
      }
      if (c.type === 'hc595') {
        const f = tn => { const n = net(c, tn); return n !== 0 && (members.get(n) || []).length <= 1; };
        if (f('SRCLR')) add('595-clr-' + c.id, 'tip', '/SRCLR is floating', 'An unconnected /SRCLR reads LOW, which keeps clearing the shift register. Connect it to VCC.', [c.id]);
      }
    }

    /* ---- 6. no reference ---- */
    const hasGround = parts.some(p => PARTS()[p.type].ground);
    if (!hasGround && parts.length > 1) {
      if (nl.autoGround) add('no-gnd', 'tip', 'No ground symbol', 'There is no GND symbol, so the app is using the battery’s − terminal as 0 V. Add a ground symbol to make your circuit clearer.', []);
      else if (parts.some(p => p.type === 'vcc' || p.type === 'voltmeter' || p.type === 'multimeter')) add('no-gnd', 'warn', 'No ground', 'The circuit has no ground symbol and no battery, so voltages have no 0 V reference. Add a ground symbol.', []);
    }
    return out.sort((a, b) => SEV[a.sev] - SEV[b.sev]);
  }

  /* ---------- run it for a moment and see ---------- */
  function analyzeRun(circuit, sketch, opts) {
    opts = opts || {};
    const out = [], seen = new Set();
    const add = (id, sev, title, text, parts, extra) => { if (!seen.has(id)) { seen.add(id); out.push(Object.assign({ id, sev, title, text, parts: parts || [] }, extra || {})); } };
    if (!circuit.parts.length) return out;
    const c = A().clone(circuit), refs = A().refMap(c), R = id => refs[id] || id;
    const logs = [];
    let rt;
    try { rt = new S21.Runtime(c, { onSerial: () => {}, onConsole: (lvl, msg, line) => logs.push({ lvl, msg, line }), eeprom: new Uint8Array(1024).fill(255) }); }
    catch (e) { return out; }
    const hasArd = c.parts.some(p => p.type === 'arduino');
    if (hasArd && sketch && sketch.trim()) { const r = rt.loadSketch(sketch); if (!r.ok) add('sketch-compile', 'error', 'Sketch error', 'Line ' + r.error.line + ': ' + r.error.message, [], { line: r.error.line }); }
    const leds = c.parts.filter(p => p.type === 'led'), stat = new Map(leds.map(l => [l.id, { max: 0, rev: 0, n: 0 }]));
    const T = opts.ms || 1500;
    for (let t = 0; t < T; t += 25) {
      rt.advance(25);
      for (const l of leds) {
        const s = stat.get(l.id), vd = rt.nodeVoltage({ p: l.id, t: 'a' }) - rt.nodeVoltage({ p: l.id, t: 'k' });
        s.n++; s.max = Math.max(s.max, l.rt.i || 0); if (vd < -1.0) s.rev++;
      }
    }
    for (const l of leds) {
      const s = stat.get(l.id);
      if (s.max < 1e-4 && s.rev >= s.n * 0.8) add('led-rev-' + l.id, 'error', 'LED the wrong way round', R(l.id) + ' never lights because it is connected backwards. The anode (long leg, the side with the + sign) must be on the positive side and the cathode (the flat side, with the bar) towards ground. Swap its two wires.', [l.id], { fix: 'swap' });
      else if (s.max > 1e-4 && s.max < 1e-3) add('led-dim-' + l.id, 'tip', 'LED very dim', R(l.id) + ' only gets ' + (s.max * 1000).toFixed(2) + ' mA, so it is barely visible. Use a smaller resistor (a 220–470 Ω resistor gives 5–15 mA on 5 V).', [l.id]);
    }
    for (const o of c.parts.filter(p => p.type === 'opamp')) if (o.rt.state === 'off') add('oa-off-' + o.id, 'error', 'Op-amp has no power', R(o.id) + ' needs at least 2.4 V between V+ and V−. Connect V+ to the positive supply and V− to ground.', [o.id]);
    for (const a of rt.alerts || []) add('run-' + a.key, a.level === 'error' ? 'error' : 'warn', a.level === 'error' ? 'Problem while running' : 'Warning while running', a.msg, []);
    for (const l of logs) if (l.lvl === 'warn' || l.lvl === 'error') add('log-' + l.msg.slice(0, 60), l.lvl === 'error' ? 'error' : 'warn', 'Sketch ' + (l.lvl === 'error' ? 'error' : 'warning'), (l.line ? 'Line ' + l.line + ': ' : '') + l.msg, [], { line: l.line });
    if (hasArd && rt.sim && !rt.sim.converged) add('noconv', 'warn', 'The simulation is struggling', 'The solver could not settle on an answer. Check for loops of parts with no resistance, or a very large or very small value.', []);
    return out.sort((a, b) => SEV[a.sev] - SEV[b.sev]);
  }

  S21.Doctor = { analyze, analyzeRun, SEV };
  if (typeof module !== 'undefined' && module.exports) module.exports = S21.Doctor;
})(typeof window !== 'undefined' ? window : globalThis);
