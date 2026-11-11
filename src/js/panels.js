/* Smart21 ElectroLab: resizable Circuit Lab panels (desktop & laptop).
   Drag a divider with the mouse to resize; click its arrow (or double-click the divider) to hide / show the panel;
   right-click a divider to reset every panel. Sizes are remembered. */
(function () {
  'use strict';
  var KEY = 's21lab-layout';
  var CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 6 9 12 15 18"/></svg>';

  function init() {
    var view = document.getElementById('view-lab'); if (!view) return;
    var pal = view.querySelector('.palette'), dock = view.querySelector('.dock'), rdock = document.getElementById('rdock'),
        learn = document.getElementById('learnPanel'), props = document.getElementById('propsPanel'),
        tabs = view.querySelector('.dock-tabs'), tool = view.querySelector('.toolbar');
    if (!pal || !dock || !rdock) return;

    var S = {}; try { S = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { S = {}; }
    ['pal', 'rdock', 'dock'].forEach(function (k) { if (!S[k] || typeof S[k] !== 'object') S[k] = {}; });
    function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} }

    var MIN = { pal: 150, rdock: 240, dock: 120 };
    var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
    var W = function () { return view.clientWidth || window.innerWidth; };
    var H = function () { return (view.clientHeight || window.innerHeight - 60) - (tool ? tool.offsetHeight : 50); };
    var tabsH = function () { return Math.max(36, (tabs && tabs.offsetHeight) || 44); };
    var MAXW = { pal: function () { return W() * 0.3; }, rdock: function () { return W() * 0.38; } };
    var MAXH = function () { return Math.max(MIN.dock, Math.min(H() * 0.72, H() - 150)); };

    /* ---------- build the dividers ---------- */
    function mk(id, cls, axis) {
      var h = document.createElement('div'); h.id = id; h.className = 'split ' + cls; h.tabIndex = 0;
      h.setAttribute('role', 'separator'); h.setAttribute('aria-orientation', axis === 'x' ? 'vertical' : 'horizontal');
      var b = document.createElement('button'); b.type = 'button'; b.innerHTML = CHEV; h.appendChild(b); view.appendChild(h);
      return { h: h, b: b };
    }
    var sp = mk('splitPal', 'v', 'x'), sr = mk('splitRdock', 'v', 'x'), sd = mk('splitDock', 'h', 'y');
    var inner = null;
    if (learn && props && props.parentNode === rdock) {
      inner = document.createElement('div'); inner.id = 'splitPanels'; inner.className = 'split-in';
      inner.setAttribute('role', 'separator'); inner.setAttribute('aria-orientation', 'horizontal');
      inner.title = 'Drag to resize · double-click to reset'; rdock.insertBefore(inner, props);
    }

    var rafId = 0;
    function fire() { if (rafId) return; rafId = requestAnimationFrame(function () { rafId = 0; window.dispatchEvent(new Event('resize')); }); }

    /* ---------- apply the saved layout ---------- */
    function apply() {
      var pw = S.pal.off ? 0 : (S.pal.w ? clamp(S.pal.w, MIN.pal, MAXW.pal()) : null);
      var rw = S.rdock.off ? 0 : (S.rdock.w ? clamp(S.rdock.w, MIN.rdock, MAXW.rdock()) : null);
      var dh = S.dock.off ? tabsH() : (S.dock.h ? clamp(S.dock.h, MIN.dock, MAXH()) : null);
      function set(name, v) { if (v === null) view.style.removeProperty(name); else view.style.setProperty(name, v + 'px'); }
      set('--pal-w', pw); set('--rdock-w', rw); set('--dock-h', dh);
      view.classList.toggle('pal-off', !!S.pal.off); view.classList.toggle('rdock-off', !!S.rdock.off); view.classList.toggle('dock-off', !!S.dock.off);
      if (learn && props) {
        if (typeof S.ratio === 'number') { learn.style.flex = S.ratio + ' 1 0px'; props.style.flex = (1 - S.ratio) + ' 1 0px'; }
        else { learn.style.flex = ''; props.style.flex = ''; }
      }
      arrows();
    }
    function arrows() {
      function a(o, dir, label, off) { o.b.setAttribute('data-arrow', dir); var t = (off ? 'Show ' : 'Hide ') + label; o.b.title = t; o.b.setAttribute('aria-label', t); o.h.title = 'Drag to resize · double-click to ' + (off ? 'show' : 'hide') + ' · right-click to reset all panels'; o.h.setAttribute('aria-expanded', off ? 'false' : 'true'); }
      a(sp, S.pal.off ? 'right' : 'left', 'the parts panel', !!S.pal.off);
      a(sr, S.rdock.off ? 'left' : 'right', 'the learn & properties panel', !!S.rdock.off);
      a(sd, S.dock.off ? 'up' : 'down', 'the code & scope panel', !!S.dock.off);
    }

    /* ---------- resize / hide / show ---------- */
    var size = {
      pal: function () { return pal.getBoundingClientRect().width; },
      rdock: function () { return rdock.getBoundingClientRect().width; },
      dock: function () { return dock.getBoundingClientRect().height; }
    };
    function setSize(k, v, hi) {
      if (v < MIN[k] * 0.6) { S[k].off = true; return; }          // dragged almost shut: hide it
      S[k].off = false; S[k][k === 'dock' ? 'h' : 'w'] = clamp(v, MIN[k], hi);
    }
    function toggle(k) {
      var f = k === 'dock' ? 'h' : 'w';
      if (!S[k].off) { if (!S[k][f]) S[k][f] = size[k](); S[k].off = true; } else S[k].off = false;
      apply(); save(); fire();
    }
    function reset() { S = { pal: {}, rdock: {}, dock: {} }; apply(); save(); fire(); }

    function drag(el, axis, start, move) {
      el.addEventListener('pointerdown', function (e) {
        if (e.button || (e.target.closest && e.target.closest('button'))) return;
        e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) {}
        el.classList.add('drag'); document.body.classList.add(axis === 'x' ? 's21-rx' : 's21-ry');
        var p0 = axis === 'x' ? e.clientX : e.clientY, s = start();
        function mv(ev) { move(s, (axis === 'x' ? ev.clientX : ev.clientY) - p0); apply(); fire(); }
        function up() {
          el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
          el.classList.remove('drag'); document.body.classList.remove('s21-rx', 's21-ry'); save(); fire();
        }
        el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      });
    }
    drag(sp.h, 'x', function () { return { v: size.pal(), o: size.rdock() }; }, function (s, d) { setSize('pal', s.v + d, Math.min(MAXW.pal(), W() - s.o - 320)); });
    drag(sr.h, 'x', function () { return { v: size.rdock(), o: size.pal() }; }, function (s, d) { setSize('rdock', s.v - d, Math.min(MAXW.rdock(), W() - s.o - 320)); });
    drag(sd.h, 'y', function () { return { v: size.dock() }; }, function (s, d) { setSize('dock', s.v - d, MAXH()); });
    if (inner) {
      drag(inner, 'y', function () { return { l: learn.offsetHeight, t: learn.offsetHeight + props.offsetHeight }; },
        function (s, d) { if (s.t > 160) S.ratio = clamp(s.l + d, 80, s.t - 80) / s.t; });
      inner.addEventListener('dblclick', function () { delete S.ratio; apply(); save(); });
    }

    [[sp, 'pal'], [sr, 'rdock'], [sd, 'dock']].forEach(function (x) {
      var o = x[0], k = x[1];
      o.b.addEventListener('click', function (e) { e.stopPropagation(); toggle(k); });
      o.h.addEventListener('dblclick', function (e) { if (!(e.target.closest && e.target.closest('button'))) toggle(k); });
      o.h.addEventListener('contextmenu', function (e) { e.preventDefault(); reset(); });
      o.h.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(k); return; }
        var grow = (k === 'pal' && e.key === 'ArrowRight') || (k === 'rdock' && e.key === 'ArrowLeft') || (k === 'dock' && e.key === 'ArrowUp');
        var shrink = (k === 'pal' && e.key === 'ArrowLeft') || (k === 'rdock' && e.key === 'ArrowRight') || (k === 'dock' && e.key === 'ArrowDown');
        if (!grow && !shrink) return; e.preventDefault();
        var cur = S[k].off ? 0 : size[k](), hi = k === 'dock' ? MAXH() : MAXW[k]();
        setSize(k, cur + (grow ? 24 : -24), hi); apply(); save(); fire();
      });
    });
    if (inner) inner.addEventListener('contextmenu', function (e) { e.preventDefault(); reset(); });
    if (tabs) tabs.addEventListener('click', function (e) { if (S.dock.off && e.target.closest && e.target.closest('.tab')) { S.dock.off = false; apply(); save(); fire(); } });  // picking a tab re-opens a minimised dock

    window.addEventListener('resize', apply);
    apply(); setTimeout(apply, 400);
    window.S21 = window.S21 || {}; window.S21.Panels = { reset: reset, toggle: toggle };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
