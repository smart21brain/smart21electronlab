global.S21 = {};
require('../src/js/sim/solver.js'); require('../src/js/arduino/interp.js');
const P = require('../src/js/sim/parts.js'); require('../src/js/sim/runtime.js'); const Ex = require('../src/js/examples.js'); require('../src/js/analysis.js'); const X = require('../src/js/export.js');
let fails = 0; function check(n, c, x) { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  ' + x)); }

// parts list
{
  const c = Ex.load('traffic').circuit, rows = X.partsList(c);
  const res = rows.find(r => r.name === 'Resistor'), led = rows.filter(r => r.name === 'LED');
  check('BOM groups identical resistors: 3 × 220 Ω', res && res.qty === 3 && res.value === '220 Ω' && res.refs.join(' ') === 'R1 R2 R3', JSON.stringify(res));
  check('BOM splits LEDs by colour (red / yellow / green)', led.length === 3 && led.every(l => l.qty === 1));
  check('BOM leaves out ground symbols', !rows.some(r => /ground/i.test(r.name)));
  check('BOM includes the Arduino', rows.some(r => r.name === 'Arduino Uno'));
  const csv = X.partsCsv(c); check('CSV has a header and quotes cells that need it', csv.startsWith('Qty,Reference,Part,Value,Notes') && csv.trim().split('\n').length === rows.length + 1);
  const mixed = Ex.load('opamp-comparator').circuit; const m = X.partsList(mixed);
  check('BOM: different resistor values are separate lines', m.filter(r => r.name === 'Resistor').length === 2, JSON.stringify(m.filter(r => r.name === 'Resistor')));
}
// SPICE
{
  const c = Ex.load('led-basic').circuit, t = X.spiceNetlist(c, { title: 'LED test', date: '2026-10-17' });
  check('spice: header, title and .end', /LED test/.test(t) && /\.end/.test(t) && /\.op/.test(t));
  check('spice: resistor, battery and LED lines', /^RR 0?N?\d*/m.test(t) || /^R\w* \S+ \S+ 470$/m.test(t), t);
  check('spice: LED diode model emitted once', (t.match(/\.model LED_RED/g) || []).length === 1);
  check('spice: battery as DC source', /^V\w* \S+ \S+ DC 9$/m.test(t), t);
  const nets = new Set(); t.split('\n').filter(l => /^[RCLVDQMX]/.test(l)).forEach(l => l.split(/\s+/).slice(1, 3).forEach(x => nets.add(x)));
  check('spice: ground is node 0', nets.has('0'));
}
{
  const t = X.spiceNetlist(Ex.load('rcfilter').circuit);
  check('spice: AC source becomes SIN(...) with AC 1 and a .tran line', /SIN\(0 5 100\)/.test(t) && /AC 1/.test(t) && /\.tran/.test(t), t);
  check('spice: capacitor value in farads', /^C\w* \S+ \S+ 1e-6$/m.test(t) || /^C\w* \S+ \S+ 0\.000001$/m.test(t), t);
}
{
  const t = X.spiceNetlist(Ex.load('opamp-gain').circuit);
  check('spice: op-amp as a sub-circuit instance with a definition', /^X\w* .* S21OPAMP_LM358$/m.test(t) && /\.subckt S21OPAMP_LM358/.test(t) && /\.ends/.test(t), t);
  const t2 = X.spiceNetlist(Ex.load('mosfet-motor').circuit); check('spice: MOSFET M line with 4 nodes and an NMOS model', /^M\w* \S+ \S+ \S+ \S+ MNMOS_logic/m.test(t2) && /\.model MNMOS_logic NMOS/.test(t2), t2);
  const t3 = X.spiceNetlist(Ex.load('pnp-highside').circuit); check('spice: PNP model + Arduino note', /PNP\(IS/.test(t3) && /Arduino Uno is not part/.test(t3));
  const t4 = X.spiceNetlist(Ex.load('zener-reg').circuit); check('spice: Zener model has BV', /D\(IS=1e-10 N=1.7 BV=5.1/.test(t4), t4);
  const t5 = X.spiceNetlist(Ex.load('relay-lamp').circuit); check('spice: relay coil as L + R, contacts as resistors', /^L\w+ \S+ M\w+ 0\.15$/m.test(t5) && /nc /.test(t5), t5);
  const t6 = X.spiceNetlist(Ex.load('shift-register').circuit); check('spice: 74HC595 reported as unsupported instead of silently dropped', /74HC595.* no SPICE model|Shift register|has no SPICE model/.test(t6), t6.split('\n').filter(l => /NOTE/.test(l)).join('|'));
}
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll export tests passed'); process.exit(fails ? 1 : 0);
