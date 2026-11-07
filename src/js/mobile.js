/* Smart21 ElectroLab — mobile support: bottom tab bar + sheets for the Lab, drawers for Lessons/Challenges/AI, pinch-zoom on the canvas. */
(function () {
  'use strict';
  const S21 = window.S21;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const mq = window.matchMedia('(max-width: 820px)');

  /* body[data-view] mirrors the active view (CSS uses it); keep it in sync even if app.js does not set it */
  function syncView() { const on = $('.view.on'); if (on) document.body.dataset.view = on.id.replace('view-', ''); }
  let lastView = '';
  new MutationObserver(() => {
    syncView(); const cur = document.body.dataset.view; if (cur === lastView) return;   // only when the active view really changes
    lastView = cur; closeSheet(); $$('.view.list-open').forEach(v => v.classList.remove('list-open'));
  }).observe($('#views'), { attributes: true, subtree: true, attributeFilter: ['class'] });
  syncView();

  /* ---------- bottom bar + sheets (Circuit Lab) ---------- */
  const icon = id => '<svg class="ic"><use href="#' + id + '"/></svg>';
  const bar = document.createElement('nav');
  bar.className = 'mob-bar'; bar.setAttribute('aria-label', 'Lab tools');
  bar.innerHTML =
    '<button data-sheet="parts" type="button">' + icon('i-chip') + 'Parts</button>' +
    '<button data-sheet="code" type="button">' + icon('i-code') + 'Code &amp; scope</button>' +
    '<button data-sheet="panels" type="button">' + icon('i-book') + 'Learn &amp; props</button>';
  const scrim = document.createElement('div'); scrim.className = 'mob-scrim';
  document.body.append(scrim, bar);

  function closeSheet() { delete document.body.dataset.sheet; $$('button', bar).forEach(b => b.classList.remove('on')); }
  function openSheet(name) {
    if (document.body.dataset.sheet === name) return closeSheet();
    document.body.dataset.sheet = name;
    $$('button', bar).forEach(b => b.classList.toggle('on', b.dataset.sheet === name));
    // canvases inside the dock need a size once visible
    setTimeout(() => window.dispatchEvent(new Event('resize')), 260);
  }
  bar.addEventListener('click', e => { const b = e.target.closest('button[data-sheet]'); if (b) openSheet(b.dataset.sheet); });
  scrim.addEventListener('click', closeSheet);
  // tapping a part adds it to the canvas: get the sheet out of the way so the user sees it appear
  $('#palList') && $('#palList').addEventListener('click', e => { if (mq.matches && e.target.closest('.pal-item')) setTimeout(closeSheet, 120); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
  mq.addEventListener && mq.addEventListener('change', () => { if (!mq.matches) closeSheet(); });

  /* ---------- drawers for the list panes ---------- */
  [['view-learn', '☰  Lessons'], ['view-challenges', '☰  Challenges'], ['view-ai', '☰  Chats']].forEach(([id, label]) => {
    const v = document.getElementById(id); if (!v) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mob-toggle'; b.textContent = label;
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', e => { e.stopPropagation(); const o = v.classList.toggle('list-open'); b.setAttribute('aria-expanded', o); });
    v.appendChild(b);
    // choosing something in the list closes the drawer
    v.addEventListener('click', e => { if (mq.matches && v.classList.contains('list-open') && e.target.closest('.learn-list button, .ai-side .h-title, .ai-side .new-chat')) v.classList.remove('list-open'); });
    // tap outside the drawer closes it
    v.addEventListener('pointerdown', e => { if (mq.matches && v.classList.contains('list-open') && !e.target.closest('.learn-list, .ai-side, .mob-toggle')) v.classList.remove('list-open'); });
  });

  /* ---------- pinch-zoom + two-finger pan on the circuit canvas ---------- */
  const svg = $('#canvas'), pts = new Map();
  let pinch = null;
  function ed() { return S21.Lab && S21.Lab.editor; }
  function metrics() { const [a, b] = [...pts.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; }
  svg.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const E = ed();
    if (pts.size === 2 && E) {
      // a second finger cancels whatever the first one started (drag / wire) and switches to navigation
      if (E.drag) { try { E.undo && E.drag.mode !== 'pan' && E.drag.mode !== 'marquee' && E.drag.mode !== 'wire' && E.undo(); } catch (_) {} E.drag = null; if (E.preview) E.preview.setAttribute('visibility', 'hidden'); if (E.marq) E.marq.setAttribute('visibility', 'hidden'); }
      E.autoFit = false;
      const m = metrics(); pinch = { d: m.d, cx: m.cx, cy: m.cy, k: E.view.k, x: E.view.x, y: E.view.y };
    }
  }, true);
  svg.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const E = ed();
    if (pinch && pts.size >= 2 && E) {
      e.stopImmediatePropagation(); e.preventDefault();
      const m = metrics(), r = svg.getBoundingClientRect();
      const k1 = Math.max(0.25, Math.min(3, pinch.k * m.d / pinch.d)), f = k1 / pinch.k;
      const ox = pinch.cx - r.left, oy = pinch.cy - r.top;           // world point under the first midpoint stays under the current one
      E.view.k = k1;
      E.view.x = (m.cx - r.left) - (ox - pinch.x) * f;
      E.view.y = (m.cy - r.top) - (oy - pinch.y) * f;
      E.applyView && E.applyView();
    }
  }, true);
  function release(e) { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; }
  svg.addEventListener('pointerup', e => { const was = pinch; release(e); if (was) e.stopImmediatePropagation(); }, true);
  svg.addEventListener('pointercancel', release, true);
})();
