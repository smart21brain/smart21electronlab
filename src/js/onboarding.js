/* ---------------------------------------------------------------
   Smart21 ElectroLab — examples gallery and first-run tour
   --------------------------------------------------------------- */
(function () {
  'use strict';
  const S21 = window.S21;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const Onb = {};
  S21.Onboarding = Onb;
  const NEW_IDS = new Set(['opamp-gain', 'opamp-comparator', 'pnp-highside', 'mosfet-motor', 'zener-reg', 'ntc-thermo', 'relay-lamp', 'rgb-mixer', 'shift-register', 'eeprom-counter', 'interrupt-button', 'struct-traffic', 'diode-curve', 'multimeter-lab']);

  /* ===================== examples gallery ===================== */
  Onb.gallery = function () {
    const E = S21.Examples, list = E.list;
    const body = document.createElement('div'); body.className = 'gallery';
    body.innerHTML = '<div class="gal-top"><div class="pal-search"><svg class="ic"><use href="#i-search"/></svg><input id="galQ" type="search" placeholder="Search examples (LED, motor, op-amp…)" autocomplete="off"></div>' +
      '<div class="chips" id="galChips">' + [['all', 'All'], ['new', 'New'], ['Beginner', 'Beginner'], ['Intermediate', 'Intermediate'], ['Advanced', 'Advanced'], ['code', 'With Arduino code'], ['nocode', 'No code']].map((c, i) => '<button class="chip' + (i ? '' : ' on') + '" data-f="' + c[0] + '">' + c[1] + '</button>').join('') + '</div></div>' +
      '<div class="gal-grid" id="galGrid"></div><p class="soft" id="galEmpty" hidden>No example matches that search.</p>';
    const m = S21.Tools.modal({ title: 'Examples gallery', wide: true, body, noFocus: false });
    let filter = 'all', q = '';
    const grid = $('#galGrid', body);
    const cards = list.map(e => {
      const c = document.createElement('button'); c.className = 'gal-card'; c.dataset.id = e.id;
      const done = S21.Stats && S21.Stats.has('examples', e.id), hasCode = !!(e.sketch !== undefined ? e.sketch : (E.load(e.id) || {}).sketch);
      c.innerHTML = '<div class="gal-thumb"><span class="spin"></span></div><div class="gal-info"><div class="gal-title">' + esc(e.title) + '</div><div class="gal-meta"><span class="lvl lvl-' + e.level.toLowerCase() + '">' + e.level + '</span>' + (hasCode ? '<span class="tag">code</span>' : '') + (NEW_IDS.has(e.id) ? '<span class="tag new">new</span>' : '') + (done ? '<span class="tag ok">✓ tried</span>' : '') + '</div><p>' + esc(e.blurb) + '</p></div>';
      c.dataset.text = (e.title + ' ' + e.blurb + ' ' + e.level).toLowerCase(); c.dataset.level = e.level; c.dataset.code = hasCode ? '1' : '0'; c.dataset.isnew = NEW_IDS.has(e.id) ? '1' : '0';
      c.onclick = () => { m.close(); S21.App.show('lab'); S21.Lab.loadExample(e.id); };
      grid.appendChild(c); return c;
    });
    const apply = () => {
      let n = 0;
      for (const c of cards) {
        const ok = (!q || c.dataset.text.includes(q)) && (filter === 'all' || (filter === 'new' && c.dataset.isnew === '1') || c.dataset.level === filter || (filter === 'code' && c.dataset.code === '1') || (filter === 'nocode' && c.dataset.code === '0'));
        c.hidden = !ok; if (ok) n++;
      }
      $('#galEmpty', body).hidden = n > 0;
    };
    $('#galQ', body).oninput = e => { q = e.target.value.trim().toLowerCase(); apply(); };
    $$('.chip', body).forEach(b => b.onclick = () => { $$('.chip', body).forEach(x => x.classList.toggle('on', x === b)); filter = b.dataset.f; apply(); });
    // thumbnails are drawn a few at a time so the dialog opens instantly
    let i = 0;
    (function next() {
      const t0 = performance.now();
      while (i < cards.length && performance.now() - t0 < 12) {
        const c = cards[i++], ex = E.load(c.dataset.id);
        if (ex) $('.gal-thumb', c).innerHTML = S21.Tools.thumb(ex.circuit) || '';
      }
      if (i < cards.length && document.body.contains(body)) requestAnimationFrame(next);
    })();
  };

  /* ===================== New circuit: template chooser (like File ▸ New in a word processor) ===================== */
  const TPL_TAGS = {
    basics: ['led-basic', 'divider', 'rc', 'npn', 'meters', 'multimeter-lab', 'rl', 'rcfilter', 'diode-curve', 'zener-reg'],
    analog: ['opamp-gain', 'opamp-comparator', 'zener-reg', 'regulator-7805', 'rcfilter', 'diode-curve', 'mosfet-motor', 'pnp-highside', 'npn'],
    digital: ['logic-gate', '555-blink', 'chaser-4017', 'counter-display', 'shift-register'],
    display: ['lcd-hello', 'lcd-volts', 'sevenseg', 'servo-sweep', 'servo-pot', 'motor-pwm', 'stepper-uln2003', 'rgb-mixer', 'ultrasonic', 'temp-lcd', 'counter-display', 'chaser-4017']
  };
  const EMPTY_SKETCH = 'void setup() {\n  // runs once\n}\n\nvoid loop() {\n  // runs again and again\n}\n';
  Onb.newCircuit = function () {
    const E = S21.Examples, Lab = S21.Lab, list = E.list;
    const body = document.createElement('div'); body.className = 'gallery tpl';
    body.innerHTML = '<h3 class="tpl-h">Start a new circuit</h3><div class="tpl-hero" id="tplHero"></div><div id="tplMine"></div>' +
      '<h3 class="tpl-h">Or start from a template</h3><div class="gal-top"><div class="pal-search"><svg class="ic"><use href="#i-search"/></svg><input id="tplQ" type="search" placeholder="Search templates (LED, motor, counter…)" autocomplete="off"></div>' +
      '<div class="chips" id="tplChips">' + [['all', 'All'], ['basics', 'Basics'], ['arduino', 'Arduino'], ['analog', 'Analog & power'], ['digital', 'Digital ICs'], ['display', 'Displays & motion']].map((c, i) => '<button class="chip' + (i ? '' : ' on') + '" data-f="' + c[0] + '">' + c[1] + '</button>').join('') + '</div></div>' +
      '<div class="gal-grid" id="tplGrid"></div><p class="soft" id="tplEmpty" hidden>No template matches that search.</p>';
    const m = S21.Tools.modal({ title: 'New circuit', wide: true, body, noFocus: false });
    const go = fn => { m.close(); S21.App.show('lab'); fn(); };
    // the big starting points
    const mk = parts => E.build({ parts }).circuit;
    const HERO = [
      { t: 'Blank circuit', d: 'An empty workspace.', run: () => Lab.newProject(), circ: null },
      { t: 'Arduino project', d: 'Arduino Uno with an empty sketch.', run: () => Lab.loadStarter({ circuit: mk([['ard', 'arduino', 100, 260, 0]]), sketch: EMPTY_SKETCH, probes: [] }), circ: () => mk([['ard', 'arduino', 100, 260, 0]]) },
      { t: 'Breadboard project', d: 'A solderless breadboard to build on.', run: () => { Lab.loadStarter({ circuit: mk([['bb', 'breadboard', 120, 160, 0]]), sketch: null, probes: [] }); Lab.setSketch(EMPTY_SKETCH); }, circ: () => mk([['bb', 'breadboard', 120, 160, 0]]) }
    ];
    const hero = $('#tplHero', body);
    HERO.forEach(h => {
      const b = document.createElement('button'); b.className = 'tpl-tile';
      b.innerHTML = '<div class="tpl-thumb">' + (h.circ ? (S21.Tools.thumb(h.circ()) || '') : '<span class="tpl-plus">+</span>') + '</div><b>' + esc(h.t) + '</b><small>' + esc(h.d) + '</small>';
      b.onclick = () => go(h.run); hero.appendChild(b);
    });
    // Recent projects and the user's own templates (with teacher packs)
    const Libr = S21.Library, mine = $('#tplMine', body);
    const openSaved = e => go(() => { Lab.loadProject(e.data); });
    const savedCard = (e, kind) => {
      const c = document.createElement('div'); c.className = 'gal-card saved'; let th = '';
      try { th = S21.Tools.thumb(S21.Parts.deserialize(JSON.parse(e.data).circuit)) || ''; } catch (_) {}
      c.innerHTML = '<div class="gal-thumb">' + th + '</div><div class="gal-info"><div class="gal-title">' + esc(e.title) + '</div><div class="gal-meta"><span>' + e.parts + ' parts</span><span>' + Libr.ago(e.when) + '</span></div>' + (e.desc ? '<p>' + esc(e.desc) + '</p>' : '') + '</div><button class="tpl-del" title="Remove" aria-label="Remove">×</button>';
      c.tabIndex = 0; c.onclick = ev => { if (ev.target.classList.contains('tpl-del')) return; openSaved(e); };
      c.onkeydown = ev => { if (ev.key === 'Enter') openSaved(e); };
      $('.tpl-del', c).onclick = ev => { ev.stopPropagation(); if (kind === 'recent') Libr.removeRecent(e.id); else if (confirm('Delete the template “' + e.title + '”?')) Libr.removeTemplate(e.id); renderMine(); };
      return c;
    };
    function renderMine() {
      const rec = Libr.recent(), tp = Libr.templates(); mine.innerHTML = '';
      if (rec.length) { const h = document.createElement('h3'); h.className = 'tpl-h'; h.textContent = 'Recent'; mine.appendChild(h); const g = document.createElement('div'); g.className = 'gal-grid tpl-row'; rec.slice(0, 4).forEach(e => g.appendChild(savedCard(e, 'recent'))); mine.appendChild(g); }
      const h2 = document.createElement('div'); h2.className = 'tpl-mine-head'; h2.innerHTML = '<h3 class="tpl-h">My templates</h3><span class="tpl-actions"><button class="btn sm" id="tplImp" title="Add templates from a pack file shared by a teacher or friend">Import pack…</button>' + (tp.length ? '<button class="btn sm" id="tplExp" title="Save all your templates in one file to share">Export pack…</button>' : '') + '</span>';
      mine.appendChild(h2);
      if (tp.length) { const g = document.createElement('div'); g.className = 'gal-grid tpl-row'; tp.forEach(e => g.appendChild(savedCard(e, 'tpl'))); mine.appendChild(g); }
      else { const p = document.createElement('p'); p.className = 'soft'; p.textContent = 'Build a circuit, then press the “Save as template” button in the toolbar: it will appear here.'; mine.appendChild(p); }
      $('#tplImp', mine).onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.s21pack,.json'; i.onchange = () => { const f = i.files[0]; if (!f) return; f.text().then(t => { const r = Libr.importPack(t); S21.Lab.toast ? S21.Lab.toast(r.ok ? r.added + ' template(s) added' + (r.skipped ? ', ' + r.skipped + ' skipped' : '') : r.error, r.ok ? '' : 'warn') : alert(r.ok ? r.added + ' template(s) added' : r.error); renderMine(); }); }; i.click(); };
      const ex = $('#tplExp', mine); if (ex) ex.onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([Libr.exportPack()], { type: 'application/json' })); a.download = 'my-templates.s21pack'; a.click(); };
    }
    renderMine();
    // templates = the shipped example circuits, each opened as a fresh copy
    let filter = 'all', q = '';
    const grid = $('#tplGrid', body);
    const cards = list.map(e => {
      const hasCode = !!(e.sketch !== undefined ? e.sketch : (E.load(e.id) || {}).sketch), tags = ['all'];
      if (hasCode) tags.push('arduino'); Object.keys(TPL_TAGS).forEach(k => { if (TPL_TAGS[k].indexOf(e.id) >= 0) tags.push(k); });
      const c = document.createElement('button'); c.className = 'gal-card'; c.dataset.tags = tags.join(' ');
      c.innerHTML = '<div class="gal-thumb"><span class="spin"></span></div><div class="gal-info"><div class="gal-title">' + esc(e.title) + '</div><div class="gal-meta"><span class="lvl lvl-' + e.level.toLowerCase() + '">' + e.level + '</span>' + (hasCode ? '<span>Arduino code</span>' : '') + '</div><p>' + esc(e.blurb) + '</p></div>';
      c.dataset.text = (e.title + ' ' + e.blurb + ' ' + e.level).toLowerCase();
      c.onclick = () => go(() => Lab.loadExample(e.id));
      grid.appendChild(c); return c;
    });
    const apply = () => { let n = 0; for (const c of cards) { const ok = (!q || c.dataset.text.includes(q)) && c.dataset.tags.split(' ').indexOf(filter) >= 0; c.hidden = !ok; if (ok) n++; } $('#tplEmpty', body).hidden = n > 0; };
    $('#tplQ', body).oninput = e => { q = e.target.value.trim().toLowerCase(); apply(); };
    $$('.chip', body).forEach(b => b.onclick = () => { $$('.chip', body).forEach(x => x.classList.toggle('on', x === b)); filter = b.dataset.f; apply(); });
    let i = 0;
    (function next() {
      const t0 = performance.now();
      while (i < cards.length && performance.now() - t0 < 12) { const c = cards[i], ex = E.load(list[i].id); i++; if (ex) $('.gal-thumb', c).innerHTML = S21.Tools.thumb(ex.circuit) || ''; }
      if (i < cards.length && document.body.contains(body)) requestAnimationFrame(next);
    })();
  };

  /* ===================== guided tour ===================== */
  const TOUR_KEY = 's21lab-tour';
  const STEPS = [
    { view: 'lab', sel: null, title: 'Welcome to Smart21 ElectroLab', text: 'This is a virtual electronics bench and an Arduino Uno in one app. A one-minute tour shows where everything is. You can leave at any time with <kbd>Esc</kbd>.' },
    { view: 'lab', sel: '#learnPanel', side: 'left', title: 'Learn panel', text: 'The <b>Learn panel</b> is docked in the workspace, like the panels in Photoshop. Pick a <b>guided tutorial</b> and it builds a circuit <b>with you</b>: ghost parts show where to click, and each step ticks itself off when your circuit is right.' },
    { view: 'lab', sel: '.palette', side: 'right', title: '1. Pick parts', text: 'Every part is here: resistors, LEDs, transistors, op-amps, MOSFETs, relays, the 74HC595 and more. Click a part, or drag it onto the canvas. Use the search box to find one fast.' },
    { view: 'lab', sel: '#canvas', side: 'center', title: '2. Build your circuit', text: 'Drag from a pin to another pin to draw a wire. <kbd>R</kbd> rotates the selected part, <kbd>Del</kbd> deletes it, scroll to zoom and drag the background to pan. Click a part to edit its value on the right.' },
    { view: 'lab', sel: '#btnRun', side: 'bottom', title: '3. Run it', text: 'Press <b>Run</b> (F5). LEDs glow, motors spin, and the right-hand panel shows live voltage and current for the selected part. Click a switch or button while it runs.' },
    { view: 'lab', sel: '#btnGallery', side: 'bottom', title: '4. Start from an example', text: 'The <b>Examples</b> gallery has circuits from a blinking LED to op-amp amplifiers, with pictures and short descriptions.' },
    { view: 'lab', sel: '.tabs', side: 'top', title: '5. Code, serial and scope', text: 'The <b>Sketch</b> tab holds Arduino code (C++ with structs, enums, EEPROM and interrupts). <b>Serial</b> shows what you print. The <b>Scope</b> plots voltages over time: Shift+click a pin to probe it.' },
    { view: 'lab', sel: '#btnAnalysis', side: 'bottom', title: '6. Analyse', text: '<b>Analysis</b> sweeps a value and plots the result (DC sweep), or plots gain and phase against frequency (Bode plot). The <b>wave button</b> next to it colours wires by voltage while running.' },
    { view: 'lab', sel: '#btnCheck', side: 'bottom', title: '7. Check and export', text: 'The <b>Check</b> button finds common mistakes (an LED with no resistor, a backwards diode, a missing flyback diode) and explains how to fix them. <b>Export</b> saves a picture of your circuit, a parts list for buying components, or a SPICE netlist for other simulators. Your work is also <b>autosaved</b> every few seconds.' },
    { view: 'lab', sel: '#topnav [data-view="learn"]', side: 'bottom', title: '8. Learn', text: '<b>Lessons</b> teach electronics and Arduino step by step, each with a circuit to open and a short quiz.' },
    { view: 'lab', sel: '#topnav [data-view="challenges"]', side: 'bottom', title: '9. Challenges', text: 'Solve <b>challenges</b>: the app tests your circuit or sketch for real. Collect achievements and earn a certificate on the Home page.' },
    { view: 'lab', sel: '#topnav [data-view="home"]', side: 'bottom', title: 'You are ready!', text: 'The <b>Home</b> page shows your progress. Open the Examples gallery and press Run on any circuit to begin. You can replay this tour from the <b>?</b> button in the toolbar.' }
  ];
  let tourEl = null, idx = 0;
  Onb.tour = function (from) {
    if (tourEl) return;
    S21.App.show('lab'); idx = from || 0;
    tourEl = document.createElement('div'); tourEl.className = 'tour';
    tourEl.innerHTML = '<div class="tour-hole"></div><div class="tour-card" role="dialog" aria-live="polite"></div>'; document.body.appendChild(tourEl);
    document.addEventListener('keydown', onKey, true); window.addEventListener('resize', place);
    place();
  };
  function end(done) {
    if (!tourEl) return; tourEl.remove(); tourEl = null; document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', place);
    try { localStorage.setItem(TOUR_KEY, '1'); } catch (_) {}
    if (done && S21.Stats) S21.Stats.feat('tour');
    if (S21.Home) S21.Home.render();
  }
  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); end(false); } else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); go(1); } else if (e.key === 'ArrowLeft') { e.stopPropagation(); go(-1); } }
  function go(d) { const n = idx + d; if (n < 0) return; if (n >= STEPS.length) { end(true); return; } idx = n; place(); }
  function place() {
    if (!tourEl) return;
    const st = STEPS[idx], hole = $('.tour-hole', tourEl), card = $('.tour-card', tourEl);
    if (st.view && S21.App.view !== st.view) S21.App.show(st.view);
    const target = st.sel ? $(st.sel) : null, r = target ? target.getBoundingClientRect() : null;
    card.innerHTML = '<div class="tour-step">Step ' + (idx + 1) + ' of ' + STEPS.length + '</div><h3>' + st.title + '</h3><p>' + st.text + '</p><div class="tour-btns"><button class="btn small" id="tourSkip">' + (idx === STEPS.length - 1 ? 'Close' : 'Skip tour') + '</button><span style="flex:1"></span>' + (idx ? '<button class="btn small" id="tourBack">Back</button>' : '') + '<button class="btn small primary" id="tourNext">' + (idx === STEPS.length - 1 ? 'Finish' : 'Next') + '</button></div>';
    $('#tourSkip', card).onclick = () => end(idx === STEPS.length - 1); $('#tourNext', card).onclick = () => go(1); const b = $('#tourBack', card); if (b) b.onclick = () => go(-1);
    if (r && r.width) {
      const pad = 6; Object.assign(hole.style, { display: 'block', left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
      const cw = 340, ch = card.offsetHeight || 180; let x, y;
      const side = st.side || 'bottom';
      if (side === 'left') { x = r.left - cw - 18; y = r.top + 20; } else if (side === 'right') { x = r.right + 18; y = r.top; } else if (side === 'top') { x = r.left + 20; y = r.top - ch - 18; } else if (side === 'center') { x = r.left + r.width / 2 - cw / 2; y = r.top + r.height / 2 - ch / 2; } else { x = r.left; y = r.bottom + 14; }
      x = Math.max(12, Math.min(x, innerWidth - cw - 12)); y = Math.max(12, Math.min(y, innerHeight - ch - 12)); card.style.left = x + 'px'; card.style.top = y + 'px'; card.style.transform = 'none';
    } else { hole.style.display = 'none'; card.style.left = '50%'; card.style.top = '50%'; card.style.transform = 'translate(-50%,-50%)'; }
    $('#tourNext', card).focus();
  }
  Onb.maybeWelcome = function () {
    let seen = false; try { seen = !!localStorage.getItem(TOUR_KEY); } catch (_) {}
    if (seen) return;
    const m = S21.Tools.modal({
      title: 'Welcome to Smart21 ElectroLab 👋',
      body: '<p>Build circuits, write Arduino code and watch it all run: no hardware needed.</p><p class="soft">Would you like a one-minute guided tour? You can replay it any time from the <b>?</b> button in the toolbar.</p>',
      actions: [{ label: 'Not now', onClick: a => { try { localStorage.setItem(TOUR_KEY, '1'); } catch (_) {} a.close(); } }, { label: 'Take the tour', primary: true, onClick: a => { a.close(); Onb.tour(); } }]
    });
  };
  Onb.init = function () { $('#btnGallery').onclick = Onb.gallery; $('#btnTour').onclick = () => Onb.tour(); };
})();
