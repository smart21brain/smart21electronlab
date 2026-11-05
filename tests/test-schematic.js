global.S21 = {};
require('../src/js/sim/solver.js'); const P = require('../src/js/sim/parts.js'); require('../src/js/sim/schematic.js');
let fails = 0; function check(n, c, x) { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x !== undefined && !c ? '  ' + x : '')); }
const kinds = Object.keys(P.SCHEM);
const mk = type => { const c = P.newCircuit(); const p = P.addPart(c, type, 100, 100, 0); return { c, p }; };
check('symbols exist for ' + kinds.length + ' part types', kinds.length >= 28, kinds.length);
const missing = kinds.filter(k => !P.PARTS[k]); check('every symbol belongs to a real part', !missing.length, missing.join());
P.schematic = false; const real = mk('resistor'); check('off: the realistic drawing is used', P.partSvg(real.p, real.c).sch === false && /<rect|<path/.test(P.partSvg(real.p, real.c).svg));
P.schematic = true;
let bad = [];
for (const k of kinds) { const { c, p } = mk(k); try { const r = P.partSvg(p, c); if (!r.sch || !/^<g class="sch">/.test(r.svg)) bad.push(k + ': not schematic'); const opens = (r.svg.match(/<(?!\/|\?)[a-zA-Z]+/g) || []).length, closes = (r.svg.match(/<\/[a-zA-Z]+>|\/>/g) || []).length; if (opens !== closes) bad.push(k + ': unbalanced tags ' + opens + '/' + closes); if (/NaN|undefined/.test(r.svg)) bad.push(k + ': NaN/undefined'); } catch (e) { bad.push(k + ': ' + e.message); } }
check('every symbol renders as balanced SVG without NaN', !bad.length, bad.join('; '));
const ic = mk('uln2003'); check('parts without a symbol keep their normal drawing', P.partSvg(ic.p, ic.c).sch === false);
const gt = mk('gate'); const shapes = {}; for (const t of ['and', 'or', 'nand', 'nor', 'xor', 'not']) { gt.p.props.type = t; shapes[t] = P.partSvg(gt.p, gt.c).svg; } check('each gate type has its own symbol', new Set(Object.values(shapes)).size === 6);
const sw = mk('switch'); sw.p.props.closed = true; const closed = P.partSvg(sw.p, sw.c).svg; sw.p.props.closed = false; check('switch symbol shows open / closed', closed !== P.partSvg(sw.p, sw.c).svg);
const rr = mk('resistor'); rr.p.rot = 90; check('labels stay upright when a part is rotated', /rotate\(-90\)/.test(P.partSvg(rr.p, rr.c).svg));
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll schematic tests passed'); if (fails) process.exit(1);
