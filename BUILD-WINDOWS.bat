@echo off
title Build Smart21 ElectroLab installer
cd /d "%~dp0"
echo ============================================
echo   Smart21 ElectroLab - build the Windows installer
echo ============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo 1. Download the LTS version from https://nodejs.org
  echo 2. Install it, then double-click this file again.
  echo.
  pause
  exit /b 1
)
echo Step 1 of 3: installing build tools (needs internet, a few minutes the first time)...
call npm install
if errorlevel 1 goto :fail
echo.
echo Step 2 of 3: checking the program (all tests)...
call npm test
if errorlevel 1 goto :fail
echo.
echo Step 3 of 3: building the installer...
call npm run dist:win
if errorlevel 1 goto :fail
echo.
echo ============================================
echo   DONE. Your installer is in the "dist" folder:
echo     Smart21-ElectroLab-...-Setup / portable .exe
echo ============================================
explorer dist
pause
exit /b 0
:fail
echo.
echo Something went wrong. Read the messages above, or see INSTALL.md.
pause
exit /b 1
