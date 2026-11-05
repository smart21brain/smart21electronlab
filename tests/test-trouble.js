// Every troubleshooting case: broken circuit FAILS the check, repaired circuit PASSES
global.S21 = {};
require('../src/js/sim/solver.js'); require('../src/js/arduino/interp.js'); const P = require('../src/js/sim/parts.js'); const RT = require('../src/js/sim/runtime.js'); S21.Runtime = RT;
const T = require('../src/js/trouble.js');
let fails = 0; function check(n, c, x) { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x !== undefined && !c ? '  ' + x : '')); }
check('there are 8 cases', T.scenarios.length === 8, T.scenarios.length);
for (const s of T.scenarios) {
  check('[' + s.id + '] has symptom, 3 hints, fault and fix text', s.symptom && s.hints.length === 3 && s.fault && s.fix);
  const a = T.start(s.id), before = T.check(s.id, a.circuit, a.sketch, a.ids);
  check('[' + s.id + '] the planted fault is detected (check fails): ' + before.msg, before.ok === false, before.msg);
  const b = T.start(s.id); T.repair(s.id, b.circuit, b.ids); const after = T.check(s.id, b.circuit, b.sketch, b.ids);
  check('[' + s.id + '] after the repair the check passes: ' + after.msg, after.ok === true, after.msg);
}
// alternative valid repairs are also accepted (judged by behaviour)
{ const a = T.start('arduino-wrong-pin'); const r = T.check('arduino-wrong-pin', a.circuit, a.sketch.replace(/13/g, '12'), a.ids); check('arduino-wrong-pin: changing the sketch to pin 12 is also a valid fix', r.ok === true, r.msg); }
{ const a = T.start('led-dim'); a.circuit.parts.find(p => p.type === 'resistor').props.ohms = 1; const r = T.check('led-dim', a.circuit, null, a.ids); check('led-dim: a dangerously small resistor is rejected (' + r.msg + ')', r.ok === false); }
{ const a = T.start('divider-wrong'); a.circuit.parts.filter(p => p.type === 'resistor').forEach(p => { p.props.ohms = 4700; }); const r = T.check('divider-wrong', a.circuit, null, a.ids); check('divider-wrong: equal resistors of any value also pass', r.ok === true, r.msg); }
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll troubleshooting tests passed'); if (fails) process.exit(1);
