const P = require('../src/js/sim/parts.js');
const { Sim } = require('../src/js/sim/solver.js');
let fails = 0;
function check(n, c, x) { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  ' + x : '')); }

// Schematic-style: battery -> 470R -> LED -> back to battery (auto ground)
{
  const c = P.newCircuit();
  const bat = P.addPart(c, 'battery', 100, 100, 0, { volts: 9 });
  const r = P.addPart(c, 'resistor', 200, 60, 0, { ohms: 470 });
  const led = P.addPart(c, 'led', 300, 100, 90);
  P.addWire(c, { p: bat.id, t: '+' }, { p: r.id, t: 'a' });
  P.addWire(c, { p: r.id, t: 'b' }, { p: led.id, t: 'a' });
  P.addWire(c, { p: led.id, t: 'k' }, { p: bat.id, t: '-' });
  const nl = P.buildNetlist(c);
  check('auto-ground used', nl.autoGround);
  const sim = new Sim(nl);
  for (let i = 0; i < 4; i++) sim.step(0.001);
  const ledEl = nl.compEls.get(led.id)[0];
  check('LED lit at ~15 mA', Math.abs(ledEl.i * 1000 - 15) < 1, (ledEl.i * 1000).toFixed(2) + ' mA');
}
// Breadboard: resistor + LED placed on holes in same column strip share a node
{
  const c = P.newCircuit();
  const bb = P.addPart(c, 'breadboard', 0, 0, 0);
  // resistor from hole (col1,row a) at (40,100) to (col5,row a) at (120,100): center (80,100)
  const r = P.addPart(c, 'resistor', 80, 100, 0, { ohms: 1000 });
  // LED spans col5 (120,100)? put LED horizontal centered at (140,120): terminals (120,120),(160,120) -> cols 5 and 7, row b
  const led = P.addPart(c, 'led', 140, 120, 0);
  const nl = P.buildNetlist(c);
  const rb = nl.nodeOf(r.id, 'b'), la = nl.nodeOf(led.id, 'a');
  check('resistor end and LED anode joined via column strip 5', rb === la, rb + ' vs ' + la);
  const ra = nl.nodeOf(r.id, 'a'), lk = nl.nodeOf(led.id, 'k');
  check('other ends are separate nets', ra !== lk && ra !== rb);
}
// Arduino blink wiring: D13 -> 220 -> LED -> GND
{
  const c = P.newCircuit();
  const a = P.addPart(c, 'arduino', 0, 0, 0);
  const r = P.addPart(c, 'resistor', 160, -60, 0, { ohms: 220 });
  const led = P.addPart(c, 'led', 260, -60, 0);
  P.addWire(c, { p: a.id, t: 'D13' }, { p: r.id, t: 'a' });
  P.addWire(c, { p: r.id, t: 'b' }, { p: led.id, t: 'a' });
  P.addWire(c, { p: led.id, t: 'k' }, { p: a.id, t: 'GND_T' });
  const nl = P.buildNetlist(c);
  check('arduino context created', !!nl.ctx.ard && nl.ctx.ard.pinEls.length === 20);
  const pin = nl.ctx.ard.pinEls[13]; pin.en = true; pin.v = 5;
  const sim = new Sim(nl);
  for (let i = 0; i < 4; i++) sim.step(0.0005);
  const ledEl = nl.compEls.get(led.id)[0];
  check('D13 HIGH lights LED ~13 mA', ledEl.i * 1000 > 10 && ledEl.i * 1000 < 16, (ledEl.i * 1000).toFixed(2) + ' mA');
  pin.v = 0;
  for (let i = 0; i < 4; i++) sim.step(0.0005);
  check('D13 LOW turns LED off', Math.abs(ledEl.i) < 1e-6);
  console.log('   engineering fmt:', P.fmt(0.0153, 'A'), P.fmt(4700, 'Ω'), P.fmt(1e-7, 'F'), '| parse:', P.parseEng('4.7k'), P.parseEng('100n'), P.parseEng('2.2u'));
}
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll netlist tests passed');
process.exit(fails ? 1 : 0);
