/* ---------------------------------------------------------------
   Smart21 ElectroLab — header search
   Finds lessons, example circuits and challenges and jumps to them.
   --------------------------------------------------------------- */
(function () {
  'use strict';
  const S21 = window.S21;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const strip = s => String(s || '').replace(/<[^>]+>/g, ' ');
  const GS = {};
  S21.GlobalSearch = GS;

  let index = null, shown = [], cur = -1;

  function build() {
    index = [];
    (S21.Lessons ? S21.Lessons.list : []).forEach((l, i) => index.push({
      kind: 'Lesson', icon: '📘', title: l.title, sub: (l.tag || '') + (l.time ? ' · ' + l.time : ''),
      hay: (l.title + ' ' + (l.tag || '') + ' ' + strip(l.html).slice(0, 1200)).toLowerCase(),
      go: () => { S21.App.show('learn'); S21.Lessons.open(i); }
    }));
    ((S21.Examples && S21.Examples.list) || []).forEach(e => index.push({
      kind: 'Example', icon: '🔧', title: e.title, sub: (e.level || '') + (e.blurb ? ' · ' + e.blurb : ''),
      hay: (e.title + ' ' + (e.level || '') + ' ' + (e.blurb || '')).toLowerCase(),
      go: () => { S21.App.show('lab'); S21.Lab.loadExample(e.id); }
    }));
    ((S21.Challenges && S21.Challenges.list) || []).forEach(c => index.push({
      kind: 'Challenge', icon: '🏁', title: c.title, sub: c.level || '',
      hay: (c.title + ' ' + (c.level || '') + ' ' + strip(c.task)).toLowerCase(),
      go: () => { S21.App.show('challenges'); const b = document.querySelector('#chList .lesson-item[data-id="' + c.id + '"]'); if (b) b.click(); }
    }));
  }

  function search(q) {
    if (!index) build();
    const words = q.toLowerCase().split(/\s+/).filter(Boolean); if (!words.length) return [];
    const out = [];
    for (const it of index) {
      if (!words.every(w => it.hay.includes(w))) continue;
      const t = it.title.toLowerCase();
      let score = words.reduce((a, w) => a + (t.startsWith(w) ? 4 : t.includes(w) ? 3 : 1), 0);
      out.push({ it, score });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 8).map(x => x.it);
  }

  function render() {
    const box = $('#gResults'), q = $('#gSearch').value.trim();
    if (!q) { box.hidden = true; shown = []; return; }
    shown = search(q); cur = shown.length ? 0 : -1;
    box.innerHTML = shown.length
      ? shown.map((r, i) => '<button type="button" class="gr' + (i === 0 ? ' on' : '') + '" data-i="' + i + '" role="option"><span class="gr-ic">' + r.icon + '</span><span class="gr-tx"><b>' + esc(r.title) + '</b><small>' + esc(r.sub) + '</small></span><span class="gr-kind">' + r.kind + '</span></button>').join('')
      : '<div class="gr-none">No lessons, examples or challenges match “' + esc(q) + '”.<br><small>Try the AI Tutor for open questions.</small></div>';
    box.hidden = false;
  }
  function mark(i) {
    const items = document.querySelectorAll('#gResults .gr'); if (!items.length) return;
    cur = (i + items.length) % items.length; items.forEach((b, k) => b.classList.toggle('on', k === cur)); items[cur].scrollIntoView({ block: 'nearest' });
  }
  function pick(i) { const r = shown[i]; if (!r) return; close(); $('#gSearch').value = ''; $('#gSearch').blur(); r.go(); }
  function close() { $('#gResults').hidden = true; }

  GS.init = function () {
    const inp = $('#gSearch'); if (!inp) return;
    inp.addEventListener('input', render);
    inp.addEventListener('focus', () => { if (inp.value.trim()) render(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); mark(cur + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mark(cur - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(cur); }
      else if (e.key === 'Escape') { inp.value = ''; close(); inp.blur(); }
    });
    $('#gResults').addEventListener('mousedown', e => { const b = e.target.closest('.gr'); if (b) { e.preventDefault(); pick(+b.dataset.i); } });
    document.addEventListener('mousedown', e => { if (!e.target.closest('.gsearch')) close(); });
    document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inp.focus(); inp.select(); } });
  };
})();
