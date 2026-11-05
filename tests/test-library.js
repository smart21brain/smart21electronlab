// Recent projects, personal templates and class packs
global.S21 = {};
const mem = {}; global.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
require('../src/js/sim/solver.js'); const P = require('../src/js/sim/parts.js'); const Lib = require('../src/js/library.js');
let fails = 0;
function check(n, c, x) { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x !== undefined && !c ? '  ' + x : '')); }
const proj = n => { const c = P.newCircuit(); for (let i = 0; i < n; i++) P.addPart(c, 'resistor', 100 + i * 100, 100, 0); return JSON.stringify({ app: 'smart21-electrolab', version: 2, circuit: P.serialize(c), sketch: '', probes: [], eeprom: [] }); };
check('empty canvas is not added to Recent', Lib.addRecent('x', proj(0)) === false && Lib.recent().length === 0);
Lib.addRecent('first.s21lab', proj(2)); Lib.addRecent('second', proj(3));
check('Recent: newest first, extension removed', Lib.recent()[0].title === 'second' && Lib.recent()[1].title === 'first', JSON.stringify(Lib.recent().map(r => r.title)));
Lib.addRecent('first', proj(4)); check('Recent: re-saving the same name moves it to the top without duplicating', Lib.recent().length === 2 && Lib.recent()[0].title === 'first' && Lib.recent()[0].parts === 4);
for (let i = 0; i < 12; i++) Lib.addRecent('p' + i, proj(1)); check('Recent: keeps only the 8 newest', Lib.recent().length === 8 && Lib.recent()[0].title === 'p11');
Lib.removeRecent(Lib.recent()[0].id); check('Recent: an item can be removed', Lib.recent().length === 7);
check('Template: rejects a non-project', Lib.addTemplate('a', '', '{"hello":1}').ok === false);
check('Template: rejects an empty canvas', Lib.addTemplate('a', '', proj(0)).ok === false);
let r = Lib.addTemplate('Night light', 'LDR + LED', proj(3)); check('Template: saved', r.ok && Lib.templates().length === 1 && Lib.templates()[0].desc === 'LDR + LED');
Lib.addTemplate('night LIGHT', 'new version', proj(5)); check('Template: same name (any case) replaces the old one', Lib.templates().length === 1 && Lib.templates()[0].parts === 5);
Lib.addTemplate('Filter', '', proj(2));
const pack = Lib.exportPack(); const d = JSON.parse(pack);
check('Pack: exports every template with its project data', d.app === 'smart21-electrolab-pack' && d.templates.length === 2 && d.templates.every(t => Lib.valid(t.data)));
Lib.templates().forEach(t => Lib.removeTemplate(t.id)); check('Template: delete works', Lib.templates().length === 0);
const imp = Lib.importPack(pack); check('Pack: import restores both templates (' + JSON.stringify(imp) + ')', imp.ok && imp.added === 2 && Lib.templates().length === 2);
check('Pack: rejects garbage', Lib.importPack('not json').ok === false && Lib.importPack('{"app":"other"}').ok === false);
const bad = JSON.parse(pack); bad.templates.push({ title: 'broken', data: '{}' }); const imp2 = Lib.importPack(JSON.stringify(bad)); check('Pack: bad entries are skipped, good ones kept (' + imp2.skipped + ' skipped)', imp2.ok && imp2.skipped === 1);
check('Template: rename', Lib.renameTemplate(Lib.templates()[0].id, 'Renamed') && Lib.templates()[0].title === 'Renamed');
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll library tests passed'); if (fails) process.exit(1);
