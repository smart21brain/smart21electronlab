global.S21 = {};
require('../src/js/sim/solver.js'); const P = require('../src/js/sim/parts.js'); const DS = require('../src/js/datasheet.js');
let fails = 0; function check(n, c, x) { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x !== undefined && !c ? '  ' + x : '')); }
const ids = Object.keys(P.PARTS);
const bad = ids.filter(id => { const d = DS.data(id); return !d || !d.name || !d.desc || !d.pins.length; });
check('every part (' + ids.length + ') has name, description and pins in its datasheet', !bad.length, bad.join());
const nolim = ids.filter(id => !DS.limits[id]); check('every part has key limits (' + (nolim.join() || 'none missing') + ')', nolim.length === 0, nolim.join());
const stale = Object.keys(DS.limits).filter(k => !P.PARTS[k] && k !== 'vcc'); check('no limits for parts that do not exist', stale.length === 0, stale.join());
const html = DS.html('uln2003'); check('ULN2003 datasheet lists 16 pins and escapes text', (html.match(/<tr>/g) || []).length === 17 && /500 mA/.test(html));
check('settings are listed with their options', /Resistance/.test(DS.html('resistor')) && /Red, Orange, Yellow/.test(DS.html('led')));
check('joined pins are marked (L293D ground)', /joined inside the chip/.test(DS.html('l293d')));
check('unknown part is handled', DS.data('nope') === null && /No datasheet/.test(DS.html('nope')));
check('HTML-looking text is escaped', !/<script/.test(DS.html('led')));
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll datasheet tests passed'); if (fails) process.exit(1);
