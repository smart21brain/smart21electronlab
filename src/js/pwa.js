/* Registers the offline service worker when the app is opened from a web server (not inside the desktop app). */
(function () {
  if (window.s21 || !('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
})();
