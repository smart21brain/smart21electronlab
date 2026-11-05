/* ---------------------------------------------------------------
   Smart21 ElectroLab — project exports
   Parts list (bill of materials) and a SPICE netlist that opens
   in LTspice / ngspice. Pure functions: usable (and tested) in Node.
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const P = () => S21.Parts, A = () => S21.Analysis;
  const fmt = (v, u) => P().fmt(v, u);

  /* ---------- parts list ---------- */
  // one line per distinct (part type + value); each line lists its reference designators
  function describe(c) {
    const p = c.props || {};
    switch (c.type) {
      case 'resistor': return { name: 'Resistor', value: fmt(p.ohms, 'Ω'), note: 'carbon film, ¼ W' };
      case 'capacitor': return { name: 'Capacitor', value: fmt(p.farads, 'F'), note: p.farads >= 1e-6 ? 'electrolytic, check polarity' : 'ceramic' };
      case 'inductor': return { name: 'Inductor', value: fmt(p.henries, 'H'), note: '' };
      case 'pot': return { name: 'Potentiometer', value: fmt(p.ohms, 'Ω'), note: 'linear' };
      case 'ldr': return { name: 'Light-dependent resistor (LDR)', value: '', note: 'e.g. GL5528' };
      case 'ntc': return { name: 'NTC thermistor', value: fmt(p.r25, 'Ω') + ' @ 25 °C, β ' + p.beta, note: '' };
      case 'led': return { name: 'LED', value: p.color, note: '5 mm' };
      case 'rgbled': return { name: 'RGB LED', value: p.common === 'anode' ? 'common anode' : 'common cathode', note: '5 mm, 4 leads' };
      case 'diode': return { name: 'Diode', value: '1N4007', note: '' };
      case 'zener': return { name: 'Zener diode', value: fmt(p.vz, 'V'), note: '0.5 W' };
      case 'npn': return { name: 'NPN transistor', value: 'β ' + p.beta, note: 'e.g. 2N2222 / BC547' };
      case 'pnp': return { name: 'PNP transistor', value: 'β ' + p.beta, note: 'e.g. 2N2907 / BC557' };
      case 'mosfet': { const m = { logic: 'logic-level (IRLZ44N-like)', std: 'standard (IRF540-like)', small: 'small signal (2N7000-like)' }[p.model] || p.model; return { name: (p.channel === 'p' ? 'P' : 'N') + '-channel MOSFET', value: m, note: '' }; }
      case 'opamp': return { name: 'Op-amp', value: { lm358: 'LM358', rr: 'MCP6002 (rail-to-rail)', lm741: 'LM741' }[p.rail] || p.rail, note: '' };
      case 'battery': return { name: 'Battery / DC supply', value: fmt(p.volts, 'V'), note: '' };
      case 'vcc': return { name: 'Supply rail', value: fmt(p.volts, 'V'), note: 'symbol only' };
      case 'acsource': return { name: 'Function generator', value: p.shape + ' ' + fmt(p.amp, 'V') + ' peak, ' + fmt(p.freq, 'Hz'), note: 'test equipment' };
      case 'switch': return { name: 'Switch', value: 'SPST', note: '' };
      case 'button': return { name: 'Push button', value: 'momentary', note: '6 mm tactile' };
      case 'buzzer': return { name: 'Buzzer', value: p.kind, note: '' };
      case 'relay': return { name: 'Relay', value: p.volts + ' V coil, SPDT', note: '' };
      case 'motor': return { name: 'DC motor', value: '', note: '' };
      case 'servo': return { name: 'Servo motor', value: 'SG90', note: '' };
      case 'lcd16x2': return { name: 'LCD 16×2', value: 'HD44780', note: 'parallel interface' };
      case 'sevenseg': return { name: '7-segment display', value: 'common cathode', note: '' };
      case 'tmp36': return { name: 'Temperature sensor', value: 'TMP36', note: '' };
      case 'hcsr04': return { name: 'Ultrasonic sensor', value: 'HC-SR04', note: '' };
      case 'ic555': return { name: 'Timer IC', value: 'NE555', note: '8-pin DIP' };
      case 'hc595': return { name: 'Shift register IC', value: '74HC595', note: '16-pin DIP' };
      case 'gate': return { name: 'Logic gate IC', value: { and: '74HC08', or: '74HC32', not: '74HC04', nand: '74HC00', nor: '74HC02', xor: '74HC86' }[p.type] || p.type, note: '' };
      case 'multimeter': return { name: 'Multimeter', value: '', note: 'test equipment' };
      case 'arduino': return { name: 'Arduino Uno', value: 'R3', note: '' };
      case 'breadboard': return { name: 'Solderless breadboard', value: '830 points', note: '' };
      default: { const d = P().PARTS[c.type]; return { name: d ? d.name : c.type, value: '', note: '' }; }
    }
  }
  function partsList(circuit) {
    const refs = A().refMap(circuit), rows = new Map();
    for (const c of circuit.parts) {
      if (c.type === 'ground') continue;                          // a symbol, not a component
      const d = describe(c), key = d.name + '|' + d.value;
      if (!rows.has(key)) rows.set(key, { name: d.name, value: d.value, note: d.note, refs: [], qty: 0 });
      const r = rows.get(key); r.refs.push(refs[c.id]); r.qty++;
    }
    return Array.from(rows.values()).sort((a, b) => a.refs[0].localeCompare(b.refs[0], undefined, { numeric: true }));
  }
  const csvCell = s => { s = String(s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function partsCsv(circuit) {
    const rows = partsList(circuit);
    return 'Qty,Reference,Part,Value,Notes\n' + rows.map(r => [r.qty, r.refs.join(' '), r.name, r.value, r.note].map(csvCell).join(',')).join('\n') + '\n';
  }

  /* ---------- SPICE netlist ---------- */
  const sp = v => { if (!isFinite(v)) return '0'; const a = Math.abs(v); if (a === 0) return '0'; return String(+v.toPrecision(6)); };
  function spiceNetlist(circuit, opts) {
    opts = opts || {};
    const nl = P().buildNetlist(circuit), refs = A().refMap(circuit);
    const node = (c, t) => { const n = nl.nodeOf(c.id, t); return n === 0 ? '0' : 'N' + String(n).padStart(3, '0'); };
    const lines = [], models = [], notes = [];
    const usedModels = new Set();
    const model = (name, text) => { if (!usedModels.has(name)) { usedModels.add(name); models.push(text); } return name; };
    const ref = c => refs[c.id].replace(/[^A-Za-z0-9]/g, '');
    let hasAc = false, hasTran = false;
    for (const c of circuit.parts) {
      const p = c.props, r = ref(c), n = t => node(c, t);
      switch (c.type) {
        case 'resistor': lines.push('R' + r + ' ' + n('a') + ' ' + n('b') + ' ' + sp(p.ohms)); break;
        case 'capacitor': lines.push('C' + r + ' ' + n('a') + ' ' + n('b') + ' ' + sp(p.farads)); break;
        case 'inductor': lines.push('L' + r + ' ' + n('a') + ' ' + n('b') + ' ' + sp(p.henries)); break;
        case 'battery': lines.push('V' + r + ' ' + n('+') + ' ' + n('-') + ' DC ' + sp(p.volts)); break;
        case 'vcc': lines.push('V' + r + ' ' + n('v') + ' 0 DC ' + sp(p.volts)); break;
        case 'acsource': {
          hasAc = true;
          const wave = p.shape === 'square' ? 'PULSE(' + sp(p.offset - p.amp) + ' ' + sp(p.offset + p.amp) + ' 0 1n 1n ' + sp(0.5 / p.freq) + ' ' + sp(1 / p.freq) + ')'
            : p.shape === 'triangle' ? 'PULSE(' + sp(p.offset - p.amp) + ' ' + sp(p.offset + p.amp) + ' 0 ' + sp(0.5 / p.freq) + ' ' + sp(0.5 / p.freq) + ' 1n ' + sp(1 / p.freq) + ')'
            : 'SIN(' + sp(p.offset) + ' ' + sp(p.amp) + ' ' + sp(p.freq) + ')';
          lines.push('V' + r + ' ' + n('+') + ' ' + n('-') + ' DC ' + sp(p.offset) + ' AC 1 ' + wave); break;
        }
        case 'led': lines.push('D' + r + ' ' + n('a') + ' ' + n('k') + ' ' + model('LED_' + p.color.toUpperCase(), '.model LED_' + p.color.toUpperCase() + ' D(IS=' + sp(P().diodeIs(P().LED_COLORS[p.color].vf, 2)) + ' N=2 RS=5 CJO=20p)')); break;
        case 'rgbled': {
          const vf = [2.0, 3.0, 3.1], ca = p.common === 'anode';
          ['r', 'g', 'b'].forEach((k, i) => { const m = 'LED_RGB_' + 'RGB'[i]; lines.push('D' + r + '_' + 'RGB'[i] + ' ' + (ca ? n('com') : n(k)) + ' ' + (ca ? n(k) : n('com')) + ' ' + model(m, '.model ' + m + ' D(IS=' + sp(P().diodeIs(vf[i], 2)) + ' N=2 RS=5)')); });
          break;
        }
        case 'diode': lines.push('D' + r + ' ' + n('a') + ' ' + n('k') + ' ' + model('D1N4007', '.model D1N4007 D(IS=1n N=1.75 RS=0.04 BV=1000)')); break;
        case 'zener': { const m = 'DZ' + String(p.vz).replace('.', 'V'); lines.push('D' + r + ' ' + n('a') + ' ' + n('k') + ' ' + model(m, '.model ' + m + ' D(IS=1e-10 N=1.7 BV=' + sp(p.vz) + ' IBV=5m)')); break; }
        case 'npn': lines.push('Q' + r + ' ' + n('c') + ' ' + n('b') + ' ' + n('e') + ' ' + model('QNPN' + p.beta, '.model QNPN' + p.beta + ' NPN(IS=1e-14 BF=' + p.beta + ' BR=2)')); break;
        case 'pnp': lines.push('Q' + r + ' ' + n('c') + ' ' + n('b') + ' ' + n('e') + ' ' + model('QPNP' + p.beta, '.model QPNP' + p.beta + ' PNP(IS=1e-14 BF=' + p.beta + ' BR=2)')); break;
        case 'mosfet': {
          const M = P().PARTS.mosfet.models[p.model] || P().PARTS.mosfet.models.logic, ch = p.channel === 'p' ? 'PMOS' : 'NMOS', m = 'M' + ch + '_' + p.model;
          lines.push('M' + r + ' ' + n('d') + ' ' + n('g') + ' ' + n('s') + ' ' + n('s') + ' ' + model(m, '.model ' + m + ' ' + ch + '(LEVEL=1 VTO=' + (p.channel === 'p' ? '-' : '') + sp(M.vth) + ' KP=' + sp(M.kp * 2) + ' LAMBDA=0.02)')); break;
        }
        case 'pot': { const x = p.pos / 100; lines.push('R' + r + 'a ' + n('a') + ' ' + n('w') + ' ' + sp(p.ohms * x + 1), 'R' + r + 'b ' + n('w') + ' ' + n('b') + ' ' + sp(p.ohms * (1 - x) + 1)); break; }
        case 'ldr': lines.push('R' + r + ' ' + n('a') + ' ' + n('b') + ' ' + sp(PARTS_R(c))); notes.push(refs[c.id] + ' (LDR) is exported at its present resistance'); break;
        case 'ntc': lines.push('R' + r + ' ' + n('a') + ' ' + n('b') + ' ' + sp(P().PARTS.ntc.resistance(p))); notes.push(refs[c.id] + ' (NTC) is exported at ' + p.temp + ' °C'); break;
        case 'switch': lines.push('R' + r + ' ' + n('a') + ' ' + n('b') + ' ' + (p.closed ? '0.01' : '1G')); break;
        case 'button': lines.push('R' + r + ' ' + n('a') + ' ' + n('b') + ' 1G'); notes.push(refs[c.id] + ' (push button) is exported open'); break;
        case 'buzzer': lines.push('R' + r + ' ' + n('+') + ' ' + n('-') + ' ' + (p.kind === 'passive' ? '500' : '250')); break;
        case 'motor': lines.push('R' + r + ' ' + n('a') + ' ' + n('b') + ' 25'); notes.push(refs[c.id] + ' (motor) is exported as a 25 Ω resistor'); break;
        case 'relay': { const rc = P().PARTS.relay.coilR(+p.volts); lines.push('L' + r + ' ' + n('c1') + ' M' + r + ' 0.15', 'R' + r + 'c M' + r + ' ' + n('c2') + ' ' + sp(rc), 'R' + r + 'no ' + n('com') + ' ' + n('no') + ' 1G', 'R' + r + 'nc ' + n('com') + ' ' + n('nc') + ' 0.05'); notes.push(refs[c.id] + ' (relay) contacts are drawn in the rest position'); break; }
        case 'opamp': {
          const M = P().PARTS.opamp.rails[p.rail] || P().PARTS.opamp.rails.lm358;
          lines.push('X' + r + ' ' + n('p') + ' ' + n('n') + ' ' + n('vp') + ' ' + n('vn') + ' ' + n('o') + ' S21OPAMP_' + p.rail.toUpperCase());
          const sub = 'S21OPAMP_' + p.rail.toUpperCase();
          model(sub, '* behavioural op-amp: gain 1e5, output limited to [V- + ' + M.mlo + ', V+ - ' + M.mhi + ']\n.subckt ' + sub + ' inp inn vp vn out\nEgain mid vn value={limit(1e5*(V(inp)-V(inn))+V(vn),V(vn)+' + M.mlo + ',V(vp)-' + M.mhi + ')}\nRout mid out 50\nRq vp vn 20k\nRin inp inn 1e9\n.ends');
          break;
        }
        case 'ground': case 'breadboard': case 'arduino': case 'multimeter': break;
        case 'voltmeter': case 'ammeter': break;
        default: notes.push(refs[c.id] + ' (' + P().PARTS[c.type].name + ') has no SPICE model and was left out');
      }
    }
    function PARTS_R(c) { return nl.compEls.get(c.id)[0].r; }
    const out = ['* Smart21 ElectroLab — SPICE netlist', '* ' + (opts.title || 'circuit') + ' — exported ' + (opts.date || new Date().toISOString().slice(0, 10)), '* Node N001.. are the nets of your circuit; 0 is ground.'];
    notes.forEach(t => out.push('* NOTE: ' + t));
    if (nl.autoGround) out.push('* NOTE: no ground symbol was placed; the battery minus terminal is used as node 0');
    if (circuit.parts.some(p => p.type === 'arduino')) out.push('* NOTE: the Arduino Uno is not part of a SPICE simulation (its pins are left unconnected)');
    out.push('', ...lines, '', ...models, '');
    out.push(hasAc ? '.tran 0.1m 50m\n* .ac dec 20 1 100k' : '.op');
    out.push('.end', '');
    return out.join('\n');
  }

  S21.Export = { describe, partsList, partsCsv, spiceNetlist };
  if (typeof module !== 'undefined' && module.exports) module.exports = S21.Export;
})(typeof window !== 'undefined' ? window : globalThis);
