global.S21 = {};
const L = require('../src/js/logic.js');
let fails = 0; function check(n, c, x) { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x !== undefined && !c ? '  ' + x : '')); }
const sq = (period, dur, hi = 5) => { const t = [], v = []; for (let x = 0; x <= dur; x += 0.25) { t.push(x); v.push(Math.floor(x / (period / 2)) % 2 === 0 ? hi : 0); } return { t, v }; };
const a = sq(10, 100), b = sq(20, 100), c3 = sq(10, 100, 3.3);
check('threshold = half of the highest level (5 V → 2.5 V, 3.3 V → 1.65 V)', L.threshold([a], 0, 100) === 2.5 && Math.abs(L.threshold([c3], 0, 100) - 1.65) < 1e-9);
const e = L.edges(a, 2.5, 0, 100); check('edges: a 10 ms square wave changes every 5 ms (' + e.length + ' entries)', e.length >= 19 && e.length <= 21 && e[0][1] === 1 && Math.abs(e[1][0] - 5) < 0.3, JSON.stringify(e.slice(0, 3)));
check('levelAt', L.levelAt(a, 2, 2.5) === 1 && L.levelAt(a, 7, 2.5) === 0);
const segs = L.busSegments([a, b], 2.5, 0, 40);
check('bus value of two signals counts 3,2,1,0 … (' + segs.slice(0, 4).map(s => s.v).join(',') + ')', segs.map(s => s.v).slice(0, 4).join() === '3,2,1,0', segs.map(s => s.v).join());
const vcd = L.toVCD([a, b], ['clk', 'q/1'], 2.5);
check('VCD: header, two variables (names cleaned) and time-ordered changes', /\$timescale 1 us \$end/.test(vcd) && /\$var wire 1 ! clk \$end/.test(vcd) && /\$var wire 1 " q_1 \$end/.test(vcd) && /#0\n1!\n1"/.test(vcd) && /#5000\n0!/.test(vcd), vcd.slice(0, 300));
const times = (vcd.match(/^#(\d+)$/gm) || []).map(s => +s.slice(1)); check('VCD: timestamps never go backwards', times.every((t, i) => i === 0 || t > times[i - 1]));
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll logic analyzer tests passed'); if (fails) process.exit(1);
