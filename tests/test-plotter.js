global.S21 = {};
const Pl = require('../src/js/plotter.js');
let fails = 0; function check(n, c, x) { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x !== undefined && !c ? '  ' + x : '')); }
let d = Pl.parse('12\n13\n14.5\n');
check('single number per line', d.rows.length === 3 && d.labels.length === 1 && d.rows[2][0] === 14.5);
d = Pl.parse('1 2 3\n4 5 6\n'); check('space-separated columns', d.labels.join() === 'v1,v2,v3' && d.rows[1].join() === '4,5,6');
d = Pl.parse('1,2\n3,4\n'); check('comma-separated columns', d.rows.length === 2 && d.rows[0].join() === '1,2');
d = Pl.parse('temp:21.5,light:300\ntemp:22,light:310\n'); check('Arduino labels "name:value"', d.labels.join() === 'temp,light' && d.rows[1][1] === 310, JSON.stringify(d));
d = Pl.parse('Hello\nValue = 5\n7\n» typed by user\n'); check('words are skipped, numbers in a text line are kept, user input is ignored', d.rows.length === 2 && d.rows[0][0] === 5 && d.rows[1][0] === 7, JSON.stringify(d.rows));
d = Pl.parse('1e3\n-2.5\n.5\n'); check('exponent, negative and leading-dot numbers', d.rows.map(r => r[0]).join() === '1000,-2.5,0.5');
d = Pl.parse(Array.from({ length: 1000 }, (_, i) => i).join('\n')); check('keeps only the newest 400 rows', d.rows.length === 400 && d.rows[399][0] === 999);
d = Pl.parse('1 2 3 4 5 6 7 8 9\n5\n'); check('lines with more than 8 values are skipped', d.rows.length === 1);
const r = Pl.range([[0], [10]]); check('range adds a margin and never collapses', r.lo < 0 && r.hi > 10 && Pl.range([[5], [5]]).hi > Pl.range([[5], [5]]).lo && Pl.range([]).hi === 1);
check('legend shows the latest values', /temp = 22/.test(Pl.legend(Pl.parse('temp:21.5\ntemp:22\n'))));
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll serial plotter tests passed'); if (fails) process.exit(1);
