/* Smart21 ElectroLab: start-up splash for the Android app (same look as the desktop splash). */
(function () {
  if (!(window.Capacitor || /; wv\)/.test(navigator.userAgent))) return;   // Android app only
  document.documentElement.classList.add('cap-app');
  var done = false;
  function hide() {
    if (done) return; done = true;
    var el = document.getElementById('appSplash'); if (!el) return;
    setTimeout(function () {
      el.classList.add('hide');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 600);
    }, Math.max(0, 1600 - performance.now()));   // keep it up for at least ~1.6 s
  }
  if (document.readyState === 'complete') hide(); else addEventListener('load', hide);
  setTimeout(hide, 7000);
})();
