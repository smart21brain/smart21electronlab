const { spawnSync } = require('child_process'); const path = require('path');
let bad = 0;
for (const t of ['solver', 'interp', 'lang2', 'netlist', 'examples', 'parts2', 'parts3', 'library', 'logic', 'plotter', 'datasheet', 'report', 'schematic', 'trouble', 'analysis', 'export', 'doctor', 'guide', 'challenges']) {
  const r = spawnSync('node', [path.join(__dirname, 'test-' + t + '.js')], { stdio: 'inherit' });
  if (r.status) bad++;
}
console.log(bad ? '\n' + bad + ' test file(s) failed' : '\nEverything passed ✔'); process.exit(bad ? 1 : 0);
