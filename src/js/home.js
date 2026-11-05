/* ---------------------------------------------------------------
   Smart21 ElectroLab — home dashboard, achievements, certificate
   --------------------------------------------------------------- */
(function () {
  'use strict';
  const S21 = window.S21, St = S21.Stats;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const Home = {};
  S21.Home = Home;

  /* ---------- progress numbers ---------- */
  function lessonProgress() { let p = {}; try { p = JSON.parse(localStorage.getItem('s21lab-progress') || '{}'); } catch (_) {} const L = S21.Lessons.list; return { done: L.filter(l => p[l.id]).length, total: L.length, map: p }; }
  function challengeProgress() { const p = S21.Challenges.progress(), L = S21.Challenges.list; return { done: L.filter(c => p[c.id]).length, total: L.length, map: p }; }
  Home.progress = () => { const l = lessonProgress(), c = challengeProgress(); return { l, c }; };
  const CERT_L = 0.75, CERT_C = 0.4;                       // share of lessons / challenges needed for the certificate
  const certReady = () => { const { l, c } = Home.progress(); return l.done >= Math.ceil(l.total * CERT_L) && c.done >= Math.ceil(c.total * CERT_C); };
  Home.certReady = certReady;

  /* ---------- achievements ---------- */
  const ACH = [
    { id: 'first-light', icon: '💡', title: 'First light', desc: 'Light an LED in the simulator.', test: () => St.hasFeat('ledLit') },
    { id: 'smoke', icon: '💨', title: 'Smoke test', desc: 'Burn out an LED. Everybody does it once: now you know why resistors matter.', test: () => St.hasFeat('burnt') },
    { id: 'coder', icon: '⌨️', title: 'Sketcher', desc: 'Run an Arduino sketch.', test: () => St.hasFeat('sketch') },
    { id: 'serial', icon: '📟', title: 'Talk to me', desc: 'Print something to the Serial monitor.', test: () => St.hasFeat('serial') },
    { id: 'probe', icon: '📈', title: 'Scope operator', desc: 'Probe a pin on the oscilloscope.', test: () => St.hasFeat('probe') },
    { id: 'explorer', icon: '🧭', title: 'Explorer', desc: 'Open 10 different examples.', test: () => St.size('examples') >= 10, prog: () => [St.size('examples'), 10] },
    { id: 'collector', icon: '🧰', title: 'Parts collector', desc: 'Use 15 different kinds of parts.', test: () => St.size('parts') >= 15, prog: () => [St.size('parts'), 15] },
    { id: 'opamp', icon: '🔺', title: 'Op-amp amplifier', desc: 'Get an op-amp working in its linear region.', test: () => St.hasFeat('opamp') },
    { id: 'relay', icon: '🔌', title: 'Click-clack', desc: 'Energise a relay.', test: () => St.hasFeat('relay') },
    { id: 'shift', icon: '🔢', title: 'Eight from three', desc: 'Drive a 74HC595 shift register.', test: () => St.hasFeat('shiftReg') },
    { id: 'eeprom', icon: '💾', title: 'Memory keeper', desc: 'Run a sketch that uses EEPROM.', test: () => St.hasFeat('eeprom') },
    { id: 'isr', icon: '⚡', title: 'Interrupted', desc: 'Attach an interrupt handler.', test: () => St.hasFeat('interrupt') },
    { id: 'struct', icon: '🧱', title: 'Tidy coder', desc: 'Run a sketch that defines a struct.', test: () => St.hasFeat('struct') },
    { id: 'meter', icon: '🔋', title: 'Meter reader', desc: 'Take a reading with the multimeter.', test: () => St.hasFeat('meter') },
    { id: 'hands-on', icon: '🛠️', title: 'Hands-on', desc: 'Finish a guided tutorial in the Learn panel.', test: () => St.size('guides') >= 1 },
    { id: 'apprentice', icon: '🧑‍🔧', title: 'Apprentice', desc: 'Finish all the guided tutorials.', test: () => St.size('guides') >= S21.Guide.TUTORIALS.length, prog: () => [St.size('guides'), S21.Guide.TUTORIALS.length] },
    { id: 'doctor', icon: '🩺', title: 'Circuit doctor', desc: 'Run the circuit check.', test: () => St.hasFeat('doctor') },
    { id: 'bug', icon: '🐞', title: 'Bug squasher', desc: 'Fix a problem the circuit check found.', test: () => St.hasFeat('fixedBug') },
    { id: 'scientist', icon: '🔬', title: 'Scientist', desc: 'Run both a DC sweep and a frequency response.', test: () => St.has('analysis', 'dc') && St.has('analysis', 'ac') },
    { id: 'colours', icon: '🌈', title: 'Colour of voltage', desc: 'Turn on voltage-coloured wires.', test: () => St.has('feat', 'wireColors') },
    { id: 'documenter', icon: '🖨️', title: 'Documenter', desc: 'Export an image, a parts list and a SPICE netlist.', test: () => St.has('exports', 'png') && St.has('exports', 'bom') && St.has('exports', 'spice'), prog: () => [['png', 'bom', 'spice'].filter(k => St.has('exports', k)).length, 3] },
    { id: 'student', icon: '📘', title: 'Student', desc: 'Complete 5 lessons.', test: () => lessonProgress().done >= 5, prog: () => [Math.min(5, lessonProgress().done), 5] },
    { id: 'scholar', icon: '🎓', title: 'Scholar', desc: 'Complete every lesson.', test: () => { const l = lessonProgress(); return l.done >= l.total; }, prog: () => { const l = lessonProgress(); return [l.done, l.total]; } },
    { id: 'challenger', icon: '🏁', title: 'Challenger', desc: 'Solve 5 challenges.', test: () => challengeProgress().done >= 5, prog: () => [Math.min(5, challengeProgress().done), 5] },
    { id: 'champion', icon: '🏆', title: 'Champion', desc: 'Solve every challenge.', test: () => { const c = challengeProgress(); return c.done >= c.total; }, prog: () => { const c = challengeProgress(); return [c.done, c.total]; } },
    { id: 'touring', icon: '🗺️', title: 'Well oriented', desc: 'Finish the guided tour.', test: () => St.hasFeat('tour') },
    { id: 'regular', icon: '📅', title: 'Regular', desc: 'Use the lab on 3 different days.', test: () => St.data.days.length >= 3, prog: () => [Math.min(3, St.data.days.length), 3] },
    { id: 'certified', icon: '📜', title: 'Certified', desc: 'Earn the certificate of achievement.', test: () => certReady() }
  ];
  Home.achievements = ACH;
  let checking = false;
  Home.check = function () {
    if (checking) return; checking = true; let any = false;
    try {
      for (const a of ACH) if (!St.data.unlocked[a.id] && a.test()) {
        St.unlock(a.id); any = true;
        if (S21.Lab && S21.Lab.toast) S21.Lab.toast('🏅 Achievement unlocked: ' + a.title, '', 5000);
      }
    } finally { checking = false; }
    if (any && S21.App && S21.App.view === 'home') Home.render();
  };

  /* ---------- helpers ---------- */
  function ring(done, total, color, label, sub) {
    const r = 34, c = 2 * Math.PI * r, f = total ? done / total : 0;
    return '<div class="ring"><svg viewBox="0 0 84 84" width="84" height="84"><circle cx="42" cy="42" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="8"/><circle cx="42" cy="42" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (c * f).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 42 42)"/><text x="42" y="47" text-anchor="middle" font-size="16" font-weight="700" fill="var(--text)">' + Math.round(f * 100) + '%</text></svg><div><b>' + label + '</b><span>' + done + ' of ' + total + sub + '</span></div></div>';
  }
  function nextLesson() { const l = lessonProgress(), L = S21.Lessons.list; const i = L.findIndex(x => !l.map[x.id]); return i < 0 ? null : { i, l: L[i] }; }
  function nextChallenge() { const c = challengeProgress(); return S21.Challenges.list.find(x => !c.map[x.id]) || null; }
  function hours(sec) { return sec < 90 ? Math.round(sec) + ' s' : sec < 5400 ? Math.round(sec / 60) + ' min' : (sec / 3600).toFixed(1) + ' h'; }

  /* ---------- render ---------- */
  Home.render = function () {
    const host = $('#homeBody'); if (!host) return;
    const { l, c } = Home.progress(), nl = nextLesson(), nc = nextChallenge(), nt = S21.Guide.TUTORIALS.find(t => !St.has('guides', t.id));
    const unlocked = ACH.filter(a => St.data.unlocked[a.id]).length, name = St.name;
    const hour = new Date().getHours(), greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const ready = certReady();
    host.innerHTML =
      '<header class="home-hero"><div class="hero-copy"><h1>' + greet + (name ? ', ' + esc(name.split(' ')[0]) : '') + '</h1><p>Build circuits, write Arduino code, and learn by experimenting. Everything runs on your computer, offline.</p>' +
      '<div class="home-actions"><button class="btn gold" id="hmNew">New circuit</button><button class="btn ghost" id="hmGal">Examples gallery</button><button class="btn ghost" id="hmOpen">Open project</button><button class="btn ghost" id="hmTour">Take the tour</button></div>' +
      '<div class="hero-stats"><span class="hchip"><b>' + St.size('examples') + '</b> Examples tried</span><span class="hchip"><b>' + St.count('runs') + '</b> Simulations</span><span class="hchip"><b>' + hours(St.count('simSeconds')) + '</b> Simulated</span><span class="hchip"><b>' + St.size('parts') + '</b> Part types</span></div></div>' +
      '<div class="hero-ring" aria-hidden="true"><img src="img/logo-192.png" alt=""></div></header>' +
      '<section class="home-grid">' +
      '<div class="home-card"><h2>Your progress</h2><div class="rings">' + ring(l.done, l.total, 'var(--brand)', 'Lessons', '') + ring(c.done, c.total, 'var(--brand-2)', 'Challenges', '') + ring(unlocked, ACH.length, 'var(--warn)', 'Achievements', '') + '</div></div>' +
      '<div class="home-card"><h2>Continue</h2>' +
      (nt ? '<button class="next-item" id="hmGuide"><span class="ni-ic">' + nt.icon + '</span><span><b>Guided tutorial: ' + esc(nt.title) + '</b><small>' + nt.minutes + ' min · build it step by step</small></span><span class="go">→</span></button>' : '') +
      (nl ? '<button class="next-item" id="hmLesson"><span class="ni-ic">📘</span><span><b>Lesson ' + (nl.i + 1) + ': ' + esc(nl.l.title) + '</b><small>' + esc(nl.l.tag) + ' · ' + esc(nl.l.time) + '</small></span><span class="go">→</span></button>' : '<p class="soft">🎓 You finished every lesson!</p>') +
      (nc ? '<button class="next-item" id="hmChal"><span class="ni-ic">🏁</span><span><b>Challenge: ' + esc(nc.title) + '</b><small>' + esc(nc.level) + '</small></span><span class="go">→</span></button>' : '<p class="soft">🏆 You solved every challenge!</p>') +
      '<button class="next-item" id="hmLab"><span class="ni-ic">🔧</span><span><b>Back to the Circuit Lab</b><small>Pick up where you left off</small></span><span class="go">→</span></button></div>' +
      '<div class="home-card cert-card' + (ready ? ' ready' : '') + '"><h2>Certificate</h2>' + certCard(l, c) + '</div>' +
      '</section>' +
      '<section class="home-card wide"><h2>Achievements <small>' + unlocked + ' of ' + ACH.length + '</small></h2><div class="ach-grid">' + ACH.map(a => {
        const on = !!St.data.unlocked[a.id], pr = !on && a.prog ? a.prog() : null;
        return '<div class="ach' + (on ? ' on' : '') + '" title="' + esc(a.desc) + '"><span class="ach-ic">' + (on ? a.icon : '🔒') + '</span><b>' + esc(a.title) + '</b><small>' + esc(a.desc) + '</small>' + (pr ? '<div class="bar"><i style="width:' + Math.min(100, pr[0] / pr[1] * 100) + '%"></i></div><em>' + pr[0] + ' / ' + pr[1] + '</em>' : '') + '</div>';
      }).join('') + '</div></section>' +
      '<footer class="home-foot">© Smart21 ElectroLab · part of Smart21Brain</footer>';
    $('#hmNew').onclick = () => { S21.App.show('lab'); S21.Onboarding.newCircuit(); };
    $('#hmGal').onclick = () => { S21.App.show('lab'); S21.Onboarding.gallery(); };
    $('#hmOpen').onclick = () => { S21.App.show('lab'); S21.Lab.openProject(); };
    $('#hmTour').onclick = () => S21.Onboarding.tour();
    $('#hmLab').onclick = () => S21.App.show('lab');
    if (nt) $('#hmGuide').onclick = () => S21.Guide.start(nt.id);
    if (nl) $('#hmLesson').onclick = () => { S21.App.show('learn'); S21.Lessons.open(nl.i); };
    if (nc) $('#hmChal').onclick = () => { S21.App.show('challenges'); };
    const cb = $('#hmCert'); if (cb) cb.onclick = Home.certificate;
  };
  function certCard(l, c) {
    const needL = Math.ceil(l.total * CERT_L), needC = Math.ceil(c.total * CERT_C), ready = certReady();
    const row = (label, d, n) => '<div class="req' + (d >= n ? ' ok' : '') + '"><span>' + (d >= n ? '✓' : '○') + ' ' + label + '</span><b>' + Math.min(d, n) + ' / ' + n + '</b></div>';
    return '<p class="soft">Finish enough lessons and challenges to earn a printable certificate with your name on it.</p>' + row('Complete lessons', l.done, needL) + row('Solve challenges', c.done, needC) +
      '<button class="btn ' + (ready ? 'primary' : '') + '" id="hmCert"' + (ready ? '' : ' disabled') + '>' + (ready ? '📜 Get my certificate' : 'Keep going: not yet unlocked') + '</button>';
  }

  /* ---------- certificate ---------- */
  function code(name, date) { let h = 2166136261; const s = name + '|' + date; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ('S21-' + (h >>> 0).toString(36).toUpperCase().padStart(7, '0')); }
  function certSvg(name, dateText, lessons, challenges, ach, id) {
    const W = 1100, H = 780;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="Georgia, \'Times New Roman\', serif">' +
      '<rect width="' + W + '" height="' + H + '" fill="#fbf8ef"/><rect x="26" y="26" width="' + (W - 52) + '" height="' + (H - 52) + '" fill="none" stroke="#0B6E4F" stroke-width="6"/><rect x="44" y="44" width="' + (W - 88) + '" height="' + (H - 88) + '" fill="none" stroke="#c9a24a" stroke-width="2"/>' +
      '<g fill="none" stroke="#0B6E4F" stroke-width="3" opacity=".25"><path d="M120 150h120l20-30h60M' + (W - 120) + ' 150h-120l-20-30h-60M120 ' + (H - 150) + 'h120l20 30h60M' + (W - 120) + ' ' + (H - 150) + 'h-120l-20 30h-60"/></g>' +
      '<text x="' + W / 2 + '" y="150" text-anchor="middle" font-size="22" letter-spacing="8" fill="#0B6E4F" font-family="Arial, sans-serif" font-weight="700">SMART21 ELECTROLAB</text>' +
      '<text x="' + W / 2 + '" y="235" text-anchor="middle" font-size="62" fill="#1b2620">Certificate of Achievement</text>' +
      '<text x="' + W / 2 + '" y="305" text-anchor="middle" font-size="22" fill="#5f6b65" font-style="italic">This certifies that</text>' +
      '<text x="' + W / 2 + '" y="400" text-anchor="middle" font-size="' + (name.length > 28 ? 46 : 64) + '" fill="#0B6E4F" font-style="italic">' + esc(name) + '</text>' +
      '<line x1="260" y1="420" x2="' + (W - 260) + '" y2="420" stroke="#c9a24a" stroke-width="2"/>' +
      '<text x="' + W / 2 + '" y="472" text-anchor="middle" font-size="22" fill="#33443d">has completed ' + lessons + ' lessons and solved ' + challenges + ' challenges in electronics and</text>' +
      '<text x="' + W / 2 + '" y="506" text-anchor="middle" font-size="22" fill="#33443d">Arduino programming, and earned ' + ach + ' achievements.</text>' +
      '<g transform="translate(' + W / 2 + ',610)"><circle r="46" fill="#c9a24a"/><circle r="38" fill="none" stroke="#fbf8ef" stroke-width="2"/><path d="M-14 -4l-6 8h12l-3 12 12-16h-9l5-10z" fill="#fbf8ef" transform="translate(4 -2) scale(1.1)"/></g>' +
      '<text x="170" y="650" font-size="20" fill="#33443d">' + esc(dateText) + '</text><line x1="130" y1="660" x2="360" y2="660" stroke="#33443d"/><text x="130" y="684" font-size="14" fill="#5f6b65" font-family="Arial, sans-serif">Date</text>' +
      '<text x="' + (W - 130) + '" y="650" text-anchor="end" font-size="20" fill="#33443d" font-family="Courier New, monospace">' + esc(id) + '</text><line x1="' + (W - 360) + '" y1="660" x2="' + (W - 130) + '" y2="660" stroke="#33443d"/><text x="' + (W - 130) + '" y="684" text-anchor="end" font-size="14" fill="#5f6b65" font-family="Arial, sans-serif">Certificate number</text>' +
      '</svg>';
  }
  Home.certificate = function () {
    if (!certReady()) return;
    const { l, c } = Home.progress(), unlocked = ACH.filter(a => St.data.unlocked[a.id]).length;
    const dateText = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const body = document.createElement('div');
    body.innerHTML = '<label class="lbl">Name on the certificate<input id="certName" type="text" maxlength="60" placeholder="Your full name" value="' + esc(St.name) + '"></label><div class="cert-prev" id="certPrev"></div>';
    const m = S21.Tools.modal({
      title: 'Your certificate', wide: true, body,
      actions: [{ label: 'Print…', onClick: () => printCert() }, { label: 'Save PNG…', primary: true, onClick: savePng }]
    });
    const nm = () => ($('#certName', body).value.trim() || 'Your Name');
    const make = () => certSvg(nm(), dateText, l.done, c.done, unlocked, code(nm(), dateText));
    const prev = () => { $('#certPrev', body).innerHTML = make().replace(/width="\d+" height="\d+"/, 'width="100%"'); };
    $('#certName', body).oninput = prev; prev();
    async function savePng() {
      if (!$('#certName', body).value.trim()) { S21.Lab.toast('Type your name first.', 'warn'); return; }
      St.setName($('#certName', body).value.trim());
      try { const b64 = await S21.Tools.svgToPng(make(), 1100, 780, 2); if (await S21.Tools.saveFile('smart21-certificate.png', b64, 'base64')) { St.feat('certSaved'); Home.render(); } } catch (e) { S21.Lab.toast('Could not create the image: ' + e.message, 'error'); }
    }
    function printCert() {
      if (!$('#certName', body).value.trim()) { S21.Lab.toast('Type your name first.', 'warn'); return; }
      St.setName($('#certName', body).value.trim());
      const sheet = document.createElement('div'); sheet.id = 'printCert'; sheet.innerHTML = make().replace(/width="\d+" height="\d+"/, 'width="100%"'); document.body.appendChild(sheet);
      const done = () => { sheet.remove(); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done); setTimeout(() => window.print(), 50); setTimeout(done, 60000);
    }
  };

  Home.init = function () { St.onChange(() => { clearTimeout(Home._t); Home._t = setTimeout(() => { if (S21.App && S21.App.view === 'home') Home.render(); }, 400); }); Home.check(); Home.render(); setInterval(Home.check, 4000); };
})();
