@echo off
setlocal
cd /d "%~dp0"
title Pakemon Lite Auto Poster

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required but was not found.
  echo Run "Install Lite Auto Poster.bat" after installing Node.js LTS.
  pause
  exit /b 1
)

start "" "http://localhost:8790"
node server.cjs

echo.
echo Pakemon Lite Auto Poster stopped.
pause
endlocal
