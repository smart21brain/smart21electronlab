# Installing Smart21 ElectroLab

Pick the way that suits you. **Option 1 is the usual one.**

## Option 1: build the Windows installer on your computer (about 10 minutes, once)

You need a Windows PC with internet.

1. Install **Node.js** (the LTS version) from https://nodejs.org if you do not have it.
2. Unzip this project into a folder, for example `C:\Smart21-ElectroLab`.
3. **Double-click `BUILD-WINDOWS.bat`.** It installs the build tools, runs all the tests and builds the installer. The first time it downloads about 150 MB.
4. When it finishes, the **`dist`** folder opens. It contains:
   - `Smart21-ElectroLab-…-win-x64.exe`: the **installer** (Start menu + desktop shortcut, choose the folder, uninstaller in Windows Settings).
   - `Smart21-ElectroLab-…-portable.exe`: a **portable** version that runs from a USB stick without installing.
5. Double-click the installer and follow the steps. Share the same `.exe` with other computers.

**Windows says "Windows protected your PC"?** The installer is not digitally signed (signing needs a paid certificate). Click **More info → Run anyway**. This is normal for new programs.

After installing, double-clicking any `.s21lab` project file opens it in the app.

### macOS or Linux
Run `./build.sh` in a terminal. macOS gives a `.dmg`, Linux gives an `.AppImage` and a `.deb`.

## Option 2: let GitHub build it for you (nothing to install)

1. Put this folder in a new (private is fine) GitHub repository.
2. Open the **Actions** tab → **Build installers** → **Run workflow**.
3. After a few minutes download the Windows, macOS and Linux installers from the **Artifacts** of that run.

## Option 3: install from the browser (no build, any computer)

Put the contents of the `src` folder on a web server over **https** (for example your Smart21 website). Open the address in **Chrome or Edge** and click the **Install** icon in the address bar. The app then opens in its own window, works **offline**, and has a shortcut like any other program. (The AI tutor and the PDF "Save" dialogs need the desktop version.)

## Updating
Change the version in `package.json`, run `BUILD-WINDOWS.bat` again and install the new `.exe` over the old one: projects and settings are kept.

## Changing the icon or name
Replace `build/icon.ico` (Windows) and `build/icon.png` (512 × 512), and edit `productName` in `package.json`.
