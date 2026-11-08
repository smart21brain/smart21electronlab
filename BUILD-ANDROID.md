# Building the Android APK

The Android app is the same web app (the `src` folder) wrapped with Capacitor.

## Option 1: GitHub builds it for you (nothing to install)
1. Put this folder in a GitHub repository (private is fine).
2. Open **Actions → Build Android APK → Run workflow**.
3. After 5-10 minutes open the finished run and download **Smart21-ElectroLab-apk** (a zip containing `app-debug.apk`).
4. Send the APK to your phone, open it and allow "Install unknown apps" when Android asks.

## Option 2: build on your computer
Needs Node.js 20+, Java 21 and Android Studio (for the Android SDK).
```
npm install
npm run pwa
npx cap add android
npx -y @capacitor/assets generate --android
npx cap sync android
cd android && ./gradlew assembleDebug      # on Windows: gradlew.bat assembleDebug
```
The APK is at `android/app/build/outputs/apk/debug/app-debug.apk`. Or run `npm run android:open` and use **Build → Build APK** in Android Studio.

## Notes
- The AI tutor in the app calls your hosted Worker (`https://smart21electronlab.smart21brain.com/api/ai`), so it needs internet. Everything else works offline. Change the address in `src/js/ai.js` if your site is different.
- This is a **debug** APK: perfect for installing and sharing directly. For Google Play you need a signed release build (`.aab`) with your own keystore.
- Desktop-only features (native Save dialogs, PDF export through Electron) are not available in the APK.
