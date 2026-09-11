@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [SPPet] Node.js 22 or newer is required.
  pause
  exit /b 1
)

if not defined PORT set "PORT=47822"
set "SPPET_ALLOW_REGISTER=1"
echo [SPPet] Local database: %CD%\data\sppet.db
echo [SPPet] The first registered account becomes administrator.
echo [SPPet] Opening http://127.0.0.1:%PORT%/login.html
if not defined SPPET_NO_BROWSER start "" "http://127.0.0.1:%PORT%/login.html"
node server.mjs

if errorlevel 1 pause
