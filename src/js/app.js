/* Smart21 ElectroLab — app shell: navigation, theme, settings */
(function () {
  'use strict';
  const S21 = window.S21;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const App = { view: 'home' };
  S21.App = App;

  App.show = function (v) {
    App.view = v;
    $$('.view').forEach(x => x.classList.toggle('on', x.id === 'view-' + v));
    $$('#topnav .nav[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    if (S21.AiFab) S21.AiFab.sync(v);
    if (v === 'home' && S21.Home) S21.Home.render();
    if (v === 'lab') requestAnimationFrame(() => {
      const ed = S21.Lab && S21.Lab.editor; if (ed && ed.needsFit) ed.fit();   // first time the canvas is visible: centre & enlarge the project
      S21.Lab.showTab && S21.Lab.refreshCode && S21.Lab.refreshCode();
    });
    if (v === 'ai') { S21.Tutor.renderAll(); S21.Tutor.refreshSettings(); setTimeout(() => $('#aiInput').focus(), 50); }
  };

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    $('#themeLabel').textContent = t === 'dark' ? 'Light mode' : 'Dark mode';
    $('#themeBtn use').setAttribute('href', t === 'dark' ? '#i-sun' : '#i-moon');
    try { localStorage.setItem('s21lab-theme', t); } catch (_) {}
  }

  async function initSettings() {
    const api = window.s21, prov = $('#setProvider');
    const PH = { anthropic: 'claude-sonnet-5-5', openai: 'gpt-4o-mini  or  llama3.2', cloudflare: 'auto (recommended) · fast · expert · or any @cf/... model' };
    const web = !api && /^https?:$/.test(location.protocol);
    if (web) { $('#optCf').hidden = false; ['anthropic', 'openai'].forEach(v => { const o = prov.querySelector('option[value="' + v + '"]'); if (o) o.remove(); }); } else $('#optCf').remove();
    const sync = () => {
      const p = prov.value; $('#setOnline').style.display = p === 'offline' ? 'none' : ''; $('#setKeyRow').style.display = p === 'cloudflare' ? 'none' : '';
      $('#setBaseRow').style.display = (p === 'openai' || p === 'cloudflare') ? '' : 'none'; $('#setBase').placeholder = p === 'cloudflare' ? 'Leave EMPTY when the Worker serves this same website. Otherwise: https://your-worker.workers.dev' : 'https://api.openai.com/v1  or  http://localhost:11434/v1';
      $('#setModel').placeholder = PH[p] || '';
    };
    prov.onchange = sync;
    let s = { provider: 'offline', model: '', base: '', hasKey: false };
    if (api && api.getSettings) s = await api.getSettings();
    else if (web) { try { s = Object.assign({ provider: 'cloudflare', model: '', base: '', hasKey: false }, JSON.parse(localStorage.getItem('s21lab-web-ai') || '{}')); } catch (_) { s.provider = 'cloudflare'; } }
    prov.value = s.provider; $('#setModel').value = s.model || (web ? 'auto' : ''); $('#setBase').value = (web ? s.url : s.base) || '';
    $('#setKeyState').textContent = s.hasKey ? 'A key is stored securely. Leave this empty to keep it.' : (s.encrypted === false && s.provider !== 'offline' ? 'Note: secure storage is unavailable on this system.' : '');
    sync();
    if (web) { try { fetch(S21.Tutor.cleanBase($('#setBase').value) + '/api/ai').then(r => r.json()).then(j => { const dl = $('#cfModels'); (j.models || []).forEach(m => { if (![...dl.options].some(o => o.value === m)) { const o = document.createElement('option'); o.value = m; dl.appendChild(o); } }); }).catch(() => {}); } catch (_) {} }
    $('#setSave').onclick = async () => {
      if (!api && web) { S21.Tutor.webSave(prov.value, $('#setModel').value.trim(), $('#setBase').value.trim()); $('#setMsg').textContent = 'Saved ✓'; S21.Tutor.refreshSettings(); return; }
      if (!api) { $('#setMsg').textContent = 'Online engines are available in the desktop app.'; return; }
      const r = await api.setSettings({ provider: prov.value, model: $('#setModel').value.trim(), base: $('#setBase').value.trim(), key: $('#setKey').value.trim() || undefined });
      $('#setKey').value = ''; $('#setMsg').textContent = r && r.ok ? 'Saved ✓' : 'Could not save: ' + (r && r.error || 'unknown error');
      const ns = await api.getSettings(); $('#setKeyState').textContent = ns.hasKey ? 'A key is stored securely. Leave this empty to keep it.' : '';
      S21.Tutor.refreshSettings();
    };
    $('#setTest').hidden = !web; $('#setTest').onclick = async () => { const m = $('#setMsg'); m.textContent = 'Testing…'; try { const r = await S21.Tutor.testConnection($('#setBase').value); m.textContent = r.msg; m.style.color = r.ok ? '' : 'var(--danger, #d64545)'; if (r.clear) { $('#setBase').value = ''; S21.Tutor.webSave(prov.value, $('#setModel').value.trim(), ''); S21.Tutor.refreshSettings(); } } catch (e) { m.textContent = '✗ ' + (e.message || e); } };
    $('#setForget').onclick = async () => { if (api) { await api.setSettings({ clearKey: true }); $('#setKeyState').textContent = ''; $('#setMsg').textContent = 'Key removed.'; S21.Tutor.refreshSettings(); } };
    const snd = $('#setSound'); snd.onchange = () => S21.Lab.setSound(snd.checked);
    $('#setHints').onchange = e => { if (!e.target.checked) $('#hoverInfo').style.display = 'none'; else $('#hoverInfo').style.display = ''; };
  }

  // round avatar in the header shows the initials of the name used on the certificate
  function initAvatar() {
    const a = $('#topAvatar'), paint = () => {
      const n = (S21.Stats && S21.Stats.name || '').trim();
      a.textContent = n ? n.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() : 'S21';
      a.title = n ? n + ' · Settings' : 'Settings';
    };
    paint(); if (S21.Stats && S21.Stats.onChange) S21.Stats.onChange(paint);
  }

  document.addEventListener('DOMContentLoaded', () => {
    $$('#topnav .nav[data-view], #topbar .brand[data-view]').forEach(b => b.addEventListener('click', () => App.show(b.dataset.view)));
    $('#topNew').onclick = () => { App.show('lab'); S21.Onboarding.newCircuit(); };
    $('#topAvatar').onclick = () => App.show('settings');
    let theme = 'dark'; try { theme = localStorage.getItem('s21lab-theme') || 'dark'; } catch (_) {}
    setTheme(theme); $('#themeBtn').onclick = () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    S21.Lab.init(); S21.Lessons.init(); S21.Challenges.init(); S21.Tutor.init(); initSettings();
    S21.Tools.init(); S21.Onboarding.init(); S21.Guide.init(); S21.Home.init(); S21.AiFab.init(); S21.GlobalSearch.init(); initAvatar(); setTimeout(S21.Onboarding.maybeWelcome, 600);
    if (window.s21) {
      if (window.s21.version) window.s21.version().then(v => { $('#appVer').textContent = v; });
      window.s21.onMenu && window.s21.onMenu(a => {
        if (a === 'new') { App.show('lab'); S21.Onboarding.newCircuit(); } else if (a === 'open') { App.show('lab'); S21.Lab.openProject(); }
        else if (a === 'save') S21.Lab.saveProject(); else if (a === 'run') { App.show('lab'); S21.Lab.running ? S21.Lab.pause() : S21.Lab.start(); }
        else if (a === 'stop') S21.Lab.stop(); else if (a === 'tour') S21.Onboarding.tour(); else if (a === 'gallery') { App.show('lab'); S21.Onboarding.gallery(); } else if (a.startsWith('view:')) App.show(a.slice(5));
      });
    }
  });
})();
