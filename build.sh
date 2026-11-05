#!/usr/bin/env bash
# Build the installer for the system you are on (macOS: .dmg, Linux: .AppImage and .deb)
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Install Node.js (LTS) from https://nodejs.org first."; exit 1; }
npm install
npm test
case "$(uname -s)" in
  Darwin) npm run dist:mac ;;
  *)      npm run dist:linux ;;
esac
echo "Done: see the dist folder."
