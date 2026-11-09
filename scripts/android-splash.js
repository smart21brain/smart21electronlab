// Run after `npx cap add android`: replaces Capacitor's default splash with a black screen + Smart21 logo (matches the desktop splash).
const fs = require('fs'), path = require('path');
const res = path.join('android', 'app', 'src', 'main', 'res');
if (!fs.existsSync(res)) { console.error('android/ folder not found. Run "npx cap add android" first.'); process.exit(1); }
// 1. remove Capacitor's default splash images (they would stretch)
for (const d of fs.readdirSync(res)) {
  if (!d.startsWith('drawable')) continue;
  const f = path.join(res, d, 'splash.png');
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
// 2. our logo + a centred black splash drawable
fs.mkdirSync(path.join(res, 'drawable-nodpi'), { recursive: true });
fs.copyFileSync(path.join('assets', 'splash-logo.png'), path.join(res, 'drawable-nodpi', 'splash_logo.png'));
fs.mkdirSync(path.join(res, 'drawable'), { recursive: true });
fs.writeFileSync(path.join(res, 'drawable', 'splash.xml'),
`<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item><shape android:shape="rectangle"><solid android:color="#000000"/></shape></item>
    <item android:drawable="@drawable/splash_logo" android:gravity="center" android:width="240dp" android:height="240dp"/>
</layer-list>
`);
// 3. Android 12+ system splash: black background + the logo
const styles = path.join(res, 'values', 'styles.xml');
let s = fs.readFileSync(styles, 'utf8');
const marker = '<item name="android:background">@drawable/splash</item>';
if (!s.includes(marker)) { console.error('styles.xml has an unexpected format, splash colour not patched'); process.exit(1); }
s = s.replace(marker, marker +
  '\n        <item name="windowSplashScreenBackground">#000000</item>' +
  '\n        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_logo</item>');
fs.writeFileSync(styles, s);
console.log('Android splash patched.');
