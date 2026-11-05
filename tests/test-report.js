global.S21 = {};
const R = require('../src/js/report.js');
let fails = 0; function check(n, c, x) { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x !== undefined && !c ? '  ' + x : '')); }
const h = R.html({ title: 'LED <test>', author: 'Amina & Joseph', date: '21 October 2026', notes: 'Line 1\n<script>alert(1)</script>', svgText: '<?xml version="1.0"?><svg width="400" height="200"><rect/></svg>',
  parts: [{ qty: 2, refs: ['R1', 'R2'], name: 'Resistor', value: '330 Ω', note: '' }, { qty: 1, refs: ['D1'], name: 'LED', value: 'red', note: '' }], sketch: 'void setup() { if (a < b && c > d) {} }', checks: ['No problems found.'] });
check('has title, author and date, escaped', /<h1>LED &lt;test&gt;<\/h1>/.test(h) && /Amina &amp; Joseph · 21 October 2026/.test(h));
check('notes are escaped (no script injection)', !/<script>alert/.test(h) && /&lt;script&gt;/.test(h));
check('circuit picture embedded, XML header removed, scaled to the page', /<figure class="fig"><svg width="100%"/.test(h) && !/<\?xml/.test(h));
check('parts list with total count (3 parts)', /Parts list \(3 parts\)/.test(h) && /R1, R2/.test(h) && /330 Ω/.test(h));
check('sketch is escaped', /a &lt; b &amp;&amp; c &gt; d/.test(h));
check('check results section', /Circuit check/.test(h) && /No problems found/.test(h));
const empty = R.html({ title: '', parts: [], notes: '  ', sketch: '' }); check('empty sections are left out', !/Parts list/.test(empty) && !/Notes/.test(empty) && !/Arduino sketch/.test(empty) && /Circuit report/.test(empty));
check('file name is clean', R.fileName('My LED: test/1!') === 'My-LED-test1.pdf' && R.fileName('') === 'circuit-report.pdf');
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll report tests passed'); if (fails) process.exit(1);
