/* ---------------------------------------------------------------
   Smart21 ElectroLab — runtime
   Couples the circuit solver with the Arduino sketch interpreter on a
   shared virtual clock, and keeps per-part live readings.
   --------------------------------------------------------------- */
(function (root) {
  'use strict';
  const S21 = root.S21 = root.S21 || {};
  const P = () => S21.Parts, A = () => S21.Arduino, SV = () => S21.Solver;

  const PWM_PERIOD = 2.04;            // ms (490 Hz, like the Uno)
  const SUB_MS = 0.25;                // target physics step (virtual ms)
  const MAX_SUB = 64;

  class Runtime {
    constructor(circuit, opts) {
      opts = opts || {};
      this.circuit = circuit;
      this.vt = 0;                    // virtual time in ms
      this.alerts = [];               // {key, msg, level}
      this.alertKeys = new Set();
      this.onSerial = opts.onSerial || (() => {});
      this.onConsole = opts.onConsole || (() => {});
      this.pins = Array.from({ length: 20 }, () => ({ mode: 0, out: 0, pwm: null, tone: 0, toneUntil: 0, servo: null, lastLvl: null }));
      this.evq = [];
      this.pinTrans = [];             // logical pin edges during the current physics step (for clocked chips like the 74HC595)
      this.intLvl = [undefined, undefined];
      this.eeprom = opts.eeprom || new Uint8Array(1024).fill(255);   // survives Stop/Run when the lab passes the same array
      this.scope = [];                // channels {ref, t[], v[]}
      this.interp = null;
      this.program = null;
      this.sketchError = null;
      this.running = false;
      this.rebuild();
    }

    // Which key of a keypad part is held, as [rowIndex, colIndex] into the sketch's rowPins / colPins arrays (the library scans the matrix; we read the connections)
    scanKeypad(rows, cols) {
      const PK = P().PARTS.keypad; if (!PK || !this.ard) return null;
      for (const c of this.circuit.parts) {
        if (c.type !== 'keypad') continue; const k = PK.KEYS.indexOf(c.props.key); if (k < 0) continue;
        const rn = this.nl.nodeOf(c.id, 'R' + (((k / 4) | 0) + 1)), cn = this.nl.nodeOf(c.id, 'C' + ((k % 4) + 1));
        const ri = rows.findIndex(p => this.ard.nodes[p] === rn), ci = cols.findIndex(p => this.ard.nodes[p] === cn);
        if (ri >= 0 && ci >= 0) return [ri, ci];
      }
      return null;
    }

    // DHT11 / DHT22 sensor wired to an Arduino pin → { t (°C), h (%) } or null (not found, unpowered or the wrong model in the sketch)
    scanDHT(pin, model) {
      const PD = P().PARTS.dht11; if (!PD || !this.ard) return null;
      for (const c of this.circuit.parts) {
        if (c.type !== 'dht11') continue; const nd = this.nl.nodeOf(c.id, 'data'); if (nd !== this.ard.nodes[pin] || !c.rt.powered) continue;
        const m = c.props.model === '22' ? 22 : 11; if (model !== m && !(model === 21 && m === 22)) { this.alert('dhtm' + c.id, 'The sketch says DHT' + model + ' but the sensor is a DHT' + m + ': change one of them. Reads fail until they match.', 'warn'); return null; }
        const t = +c.props.temp, h = +c.props.hum;
        return m === 11 ? { t: Math.round(Math.max(0, Math.min(50, t))), h: Math.round(Math.max(20, Math.min(90, h))) } : { t: Math.round(Math.max(-40, Math.min(80, t)) * 10) / 10, h: Math.round(Math.max(0, Math.min(100, h)) * 10) / 10 };
      }
      return null;
    }

    alert(key, msg, level) {
      if (this.alertKeys.has(key)) return;
      this.alertKeys.add(key);
      this.alerts.push({ key, msg, level: level || 'warn' });
    }
    takeAlerts() { const a = this.alerts; this.alerts = []; return a; }

    rebuild() {
      const nl = P().buildNetlist(this.circuit);
      this.nl = nl;
      this.sim = new (SV().Sim)(nl);
      // carry over node voltages where possible is not needed; solver re-converges in a step
      this.ard = nl.ctx.ard;
      this.ledComps = this.circuit.parts.filter(p => p.type === 'led');
      this.rgbComps = this.circuit.parts.filter(p => p.type === 'rgbled');
      this.checkParts = this.circuit.parts.filter(p => P().PARTS[p.type].check);
      this.watchParts = this.circuit.parts.filter(p => P().PARTS[p.type].watch);
      this.tickParts = this.circuit.parts.filter(p => P().PARTS[p.type].tick);
      this.subMs = this.circuit.parts.some(p => p.type === 'acsource') ? 0.05 : SUB_MS;
      for (const c of this.circuit.parts) { const d = P().PARTS[c.type]; if (d.sync) d.sync(c, nl.compEls.get(c.id)); }
      for (const ch of this.scope) ch.node = nl.nodeOf(ch.ref.p, ch.ref.t);
      if (nl.autoGround) this.alert('autoground', 'No ground symbol found: the battery’s − terminal is used as 0 V automatically.', 'info');
    }

    // Compile and start the sketch. Returns {ok, error, warnings}.
    loadSketch(src) {
      this.interp = null; this.sketchError = null; this.program = null;
      if (!this.ard) return { ok: true, skipped: true, warnings: [] };
      const res = A().compile(src);
      if (!res.ok) { this.sketchError = res.error; return res; }
      this.program = res.program;
      const it = new (A().Interpreter)(res.program);
      it.onSerial = (s, t) => this.onSerial(s, t);
      it.onWarn = (m, line) => this.onConsole('warn', m, line);
      it.oracle = (pin, level, now) => this.echoOracle(pin, level, now);
      it.eeprom = this.eeprom;
      it.keypadScan = (rows, cols) => this.scanKeypad(rows, cols);
      it.dhtRead = (pin, model) => this.scanDHT(pin, model);
      this.intLvl = [undefined, undefined];
      this.interp = it;
      for (const p of this.pins) { p.mode = 0; p.out = 0; p.pwm = null; p.tone = 0; p.servo = null; p.lastLvl = null; }
      this.evq.length = 0;
      this.sim.step(1e-4);                       // prime pin voltages so the very first read is meaningful
      for (let p = 0; p < 20; p++) it.pinVolts[p] = this.sim.v[this.ard.nodes[p]];
      return res;
    }
    sendSerial(text) { if (this.interp) for (const ch of text) this.interp.serialIn.push(ch.charCodeAt(0)); }

    addProbe(ref) {
      if (this.scope.length >= 8) this.scope.shift();
      const ch = { ref, node: this.nl.nodeOf(ref.p, ref.t), t: [], v: [] };
      this.scope.push(ch); return ch;
    }
    clearProbes() { this.scope.length = 0; }
    nodeVoltage(ref) { return this.sim.v[this.nl.nodeOf(ref.p, ref.t)] || 0; }

    reset() {
      this.vt = 0; this.alerts.length = 0; this.alertKeys.clear();
      for (const c of this.circuit.parts) { c.rt = {}; }
      for (const ch of this.scope) { ch.t.length = 0; ch.v.length = 0; }
      this.rebuild();
    }

    applyEvents(tEnd) {
      const q = this.evq;
      let n = 0;
      while (n < q.length && q[n].t <= tEnd) {
        const e = q[n++], p = this.pins[e.pin];
        switch (e.kind) {
          case 'mode': p.mode = e.val; break;
          case 'dw': p.out = e.val; p.pwm = null; break;
          case 'pwm': p.pwm = e.val; p.mode = 1; break;
          case 'tone': p.tone = e.val; p.toneUntil = e.dur ? e.t + e.dur : 0; break;
          case 'servo': p.servo = e.val >= 0 ? e.val : null; break;
        }
        const lv = (p.mode === 1 && p.pwm === null && !p.tone && p.servo === null) ? (p.out ? 1 : 0) : null;
        if (lv !== null && lv !== p.lastLvl) this.pinTrans.push({ pin: e.pin, t: e.t, level: lv });
        p.lastLvl = lv;
      }
      if (n) q.splice(0, n);
    }

    // Logical edges (in time order) that the sketch produced on the Arduino pin(s) connected to `node` during this step.
    transFor(node) {
      if (!this.ard || !node || !this.pinTrans.length) return null;
      const out = [];
      for (const x of this.pinTrans) if (this.ard.nodes[x.pin] === node) out.push(x);
      return out;
    }

    // attachInterrupt(): D2 = INT0, D3 = INT1. Edges are detected on the simulated pin voltage.
    checkInterrupts(t) {
      const it = this.interp; if (!it || !it.isrs || !this.ard) return;
      for (let k = 0; k < 2; k++) {
        const isr = it.isrs[k]; if (!isr) { this.intLvl[k] = undefined; continue; }
        const v = this.sim.v[this.ard.nodes[2 + k]] || 0, prev = this.intLvl[k];
        let lvl = prev === undefined ? (v > 2.5 ? 1 : 0) : (v > 3 ? 1 : v < 1.5 ? 0 : prev);
        this.intLvl[k] = lvl;
        if (prev === undefined) continue;
        const m = isr.mode;
        if ((m === 3 && lvl && !prev) || (m === 2 && !lvl && prev) || (m === 1 && lvl !== prev) || (m === 0 && !lvl)) it.raiseInterrupt(k);
      }
    }

    setPinSources(t) {
      if (!this.ard) return;
      for (let i = 0; i < 20; i++) {
        const p = this.pins[i], el = this.ard.pinEls[i];
        if (p.tone && p.toneUntil && t >= p.toneUntil) p.tone = 0;
        if (p.mode === 1) {
          let v;
          if (p.servo !== null) v = (t % 20) < (544 + p.servo / 180 * (2400 - 544)) / 1000 ? 5 : 0;
          else if (p.tone > 0) v = ((t * p.tone / 1000) % 1) < 0.5 ? 5 : 0;
          else if (p.pwm !== null) v = p.pwm >= 255 ? 5 : p.pwm <= 0 ? 0 : (((t / PWM_PERIOD) % 1) < p.pwm / 255 ? 5 : 0);
          else v = p.out ? 5 : 0;
          el.en = true; el.rs = 25; el.v = v;
        } else if (p.mode === 2 || (p.mode === 0 && p.out)) {
          el.en = true; el.rs = 30000; el.v = 5;
        } else el.en = false;
      }
    }

    // Advance the whole simulation by `spanMs` virtual milliseconds. The sketch and the
    // circuit are interleaved in ~1 ms chunks so digitalRead()/analogRead() see fresh voltages.
    advance(spanMs) {
      const target = this.vt + spanMs;
      let opsLeft = 60000;
      while (this.vt < target - 1e-9) {
        const end = Math.min(target, this.vt + 1);
        let reached = end;
        if (this.interp) {
          const before = this.interp.ops;
          reached = this.interp.runUntil(end, opsLeft);
          opsLeft -= this.interp.ops - before;
          const ev = this.interp.events; if (ev.length) { this.evq.push(...ev); ev.length = 0; }
          if (this.interp.error && !this.errReported) {
            this.errReported = true;
            this.onConsole('error', 'Runtime error: ' + this.interp.error.message, this.interp.error.line);
          }
        }
        if (reached > this.vt + 1e-9) this.physics(reached);
        if (reached < end - 1e-9 || opsLeft <= 0) break;   // sketch too busy: simulated time slows down
      }
      this.checkAlerts();
    }

    physics(reached) {
      const span = reached - this.vt;
      const nSub = Math.max(1, Math.min(MAX_SUB, Math.ceil(span / this.subMs)));
      const dtMs = span / nSub, dt = dtMs / 1000;
      const nl = this.nl, sim = this.sim, parts = this.circuit.parts, PARTS = P().PARTS;
      for (let k = 1; k <= nSub; k++) {
        const t = this.vt + k * dtMs;
        this.pinTrans.length = 0;
        this.applyEvents(t);
        this.setPinSources(t);
        for (const c of this.tickParts) PARTS[c.type].tick(c, nl.compEls.get(c.id), t, this);
        sim.step(dt);
        if (this.interp) this.checkInterrupts(t);
        for (const c of this.watchParts) PARTS[c.type].watch(c, nl.compEls.get(c.id));
        for (let i = 0; i < parts.length; i++) {
          const c = parts[i], d = PARTS[c.type];
          if (d.read) d.read(c, nl.compEls.get(c.id));
        }
        // LED smoothing + burn-out
        const a = 1 - Math.exp(-dtMs / 3);
        for (const c of this.ledComps) {
          const rt = c.rt; rt.ia = (rt.ia || 0) + ((rt.i || 0) - (rt.ia || 0)) * a;
          if (!rt.burnt) {
            if (rt.ia > 0.05) { rt.stress = (rt.stress || 0) + dtMs; if (rt.stress > 15) { rt.burnt = true; nl.compEls.get(c.id)[0].off = true; this.alert('burnt' + c.id, 'An LED burned out! Too much current (' + (rt.ia * 1000).toFixed(0) + ' mA). Always put a resistor in series with an LED.', 'error'); } }
            else if (rt.stress) rt.stress = Math.max(0, rt.stress - dtMs * 0.5);
          }
        }
        for (const c of this.rgbComps) {
          const rt = c.rt, els = nl.compEls.get(c.id);
          if (!rt.ia) { rt.ia = [0, 0, 0]; rt.burnt = [false, false, false]; rt.stress = [0, 0, 0]; }
          for (let k = 0; k < 3; k++) {
            rt.ia[k] += ((rt.iCh ? rt.iCh[k] : 0) - rt.ia[k]) * a;
            if (rt.burnt[k]) continue;
            if (rt.ia[k] > 0.05) { rt.stress[k] += dtMs; if (rt.stress[k] > 15) { rt.burnt[k] = true; els[k].off = true; this.alert('burnt' + c.id + k, 'One colour of an RGB LED burned out (' + (rt.ia[k] * 1000).toFixed(0) + ' mA). Each colour needs its own series resistor.', 'error'); } }
            else if (rt.stress[k]) rt.stress[k] = Math.max(0, rt.stress[k] - dtMs * 0.5);
          }
        }
        if (this.ard) {
          const rt = this.ard.comp.rt, v13 = sim.v[this.ard.nodes[13]] / 5;
          rt.led13 = (rt.led13 || 0) + (Math.max(0, Math.min(1, v13)) - (rt.led13 || 0)) * a;
          if (this.interp) for (let p = 0; p < 20; p++) this.interp.pinVolts[p] = sim.v[this.ard.nodes[p]];
        }
        for (const ch of this.scope) { ch.t.push(t); ch.v.push(sim.v[ch.node] || 0); if (ch.t.length > 24000) { ch.t.splice(0, 4000); ch.v.splice(0, 4000); } }
      }
      this.vt = reached;
    }

    checkAlerts() {
      const nl = this.nl, sim = this.sim;
      for (const e of nl.elements) {
        if (e.type === 'V' && e.en !== false && Math.abs(e.i) > 3 && e.rs <= 0.1) this.alert('short', 'Short circuit! A battery or power pin is connected straight to ground (' + Math.abs(e.i).toFixed(0) + ' A).', 'error');
        if (e.type === 'V' && e.pin !== undefined && e.en && e.rs === 25 && Math.abs(e.i) > 0.04) this.alert('pin' + e.pin, 'Arduino pin ' + (e.pin < 14 ? 'D' + e.pin : 'A' + (e.pin - 14)) + ' is supplying ' + (Math.abs(e.i) * 1000).toFixed(0) + ' mA. A real pin is limited to 40 mA (20 mA recommended) and could be damaged.', 'warn');
      }
      for (const c of this.checkParts) P().PARTS[c.type].check(c, nl.compEls.get(c.id), this);
      if (!sim.converged) this.alert('conv', 'The solver had trouble converging. Check for a very unusual circuit (for example a diode directly across a source).', 'warn');
      if (this.ard) this.updateBuzzer();
    }

    // Answers pulseIn(): finds an HC-SR04 whose ECHO is on this pin and whose TRIG got a >= 10 us pulse.
    echoOracle(pin, level, now) {
      if (!this.ard || !this.interp) return null;
      const node = this.ard.nodes[pin], v = this.sim.v;
      for (const c of this.circuit.parts) {
        if (c.type !== 'hcsr04' || !c.rt.n || c.rt.n.echo !== node || node === 0) continue;
        const n = c.rt.n; if (v[n.vcc] - v[n.gnd] < 4) continue;
        let tp = -1; for (let p = 0; p < 20; p++) if (this.ard.nodes[p] === n.trig && n.trig !== 0) tp = p;
        if (tp < 0) continue;
        const pu = this.interp.pinPulse[tp];
        // the interpreter spends ~8 us of statement overhead between the HIGH and LOW writes, so a real 10 us pulse measures ~18 us here
        if (!pu || pu.fall - pu.rise < 0.017 || pu.fall > now || now - pu.fall > 2) continue;
        const cm = c.props.distance; if (cm < 2 || cm > 400) continue;
        const t0 = pu.fall + 0.46, t1 = t0 + cm * 2 * 0.0291;      // 58.3 us per cm round trip
        c.rt.echo = { t0, t1 }; return { start: t0, end: t1 };
      }
      return null;
    }

    updateBuzzer() {
      let freq = 0;
      for (const c of this.circuit.parts) {
        if (c.type !== 'buzzer' || !c.rt.sounding) continue;
        if (c.props.kind === 'active') { freq = 2400; break; }
        // passive: find the Arduino pin on the same net as '+'
        const node = this.nl.nodeOf(c.id, '+');
        for (let p = 0; p < 20; p++) if (this.ard.nodes[p] === node && this.pins[p].tone > 0) { freq = this.pins[p].tone; break; }
      }
      this.buzzFreq = freq;
    }
  }

  S21.Runtime = Runtime;
  if (typeof module !== 'undefined' && module.exports) module.exports = Runtime;
})(typeof window !== 'undefined' ? window : globalThis);
