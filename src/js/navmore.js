/* Smart21 ElectroLab: arrow at the end of the top menu. Tap it to see the menu items that do not fit on a small screen. */
(function () {
  function init() {
    var nav = document.getElementById('topnav'), inner = nav && nav.querySelector('.nav-inner');
    if (!inner) return;
    var btn = document.createElement('button');
    btn.id = 'navMore'; btn.type = 'button'; btn.hidden = true; btn.setAttribute('aria-label', 'More menu items'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    var menu = document.createElement('div'); menu.id = 'navMoreMenu'; menu.hidden = true;
    nav.appendChild(btn); nav.appendChild(menu);

    function hiddenItems() {
      var box = inner.getBoundingClientRect(), out = [];
      inner.querySelectorAll('.nav[data-view]').forEach(function (b) {
        var r = b.getBoundingClientRect();
        if (r.right > box.right - 44 || r.left < box.left - 1) out.push(b);
      });
      return out;
    }
    function close() { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    function update() {
      var any = inner.scrollWidth > inner.clientWidth + 2 && hiddenItems().length > 0;
      btn.hidden = !any; if (!any) close();
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!menu.hidden) { close(); return; }
      menu.innerHTML = '';
      hiddenItems().forEach(function (b) {
        var it = document.createElement('button'); it.type = 'button'; it.textContent = b.textContent;
        if (b.classList.contains('on')) it.className = 'on';
        it.addEventListener('click', function () { close(); b.click(); try { b.scrollIntoView({ inline: 'nearest', block: 'nearest' }); } catch (_) {} setTimeout(update, 250); });
        menu.appendChild(it);
      });
      menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
    });
    document.addEventListener('click', function (e) { if (!menu.hidden && !menu.contains(e.target)) close(); });
    inner.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update); window.addEventListener('orientationchange', update);
    if (window.ResizeObserver) new ResizeObserver(update).observe(inner);
    update(); setTimeout(update, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
