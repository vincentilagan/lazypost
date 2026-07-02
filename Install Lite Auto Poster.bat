@echo off
setlocal
cd /d "%~dp0"
title Lazypost 1.0 Lite Installer

echo.
echo ===============================================
echo   Lazypost 1.0 Lite - Installer
echo ===============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo.
  echo Install Node.js LTS first:
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo [OK] Node detected:
node --version
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [WARN] npm was not found. This lite app has no packages to install.
) else (
  echo [OK] npm detected:
  npm --version
  echo.
  if exist "package.json" (
    echo Installing lite app package metadata...
    npm install
    if errorlevel 1 (
      echo.
      echo [WARN] npm install failed, but the lite app can still run if Node.js works.
    )
  )
)

echo.
echo Checking lite app files...
node --check server.cjs
if errorlevel 1 (
  echo [ERROR] server.cjs check failed.
  pause
  exit /b 1
)

node --check app.js
if errorlevel 1 (
  echo [ERROR] app.js check failed.
  pause
  exit /b 1
)

echo [OK] Lite app check passed.
echo.
echo ===============================================
echo   Install complete
echo ===============================================
echo.
echo Run the lite app by double-clicking:
echo   Start Lite Poster.bat
echo.
echo Lite app URL:
echo   http://localhost:8790
echo.
pause
