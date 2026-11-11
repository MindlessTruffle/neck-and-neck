@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is needed. Install the current LTS release from https://nodejs.org.
  pause
  exit /b 1
)
if not exist "node_modules\vite" call npm install
call npm run dev -- --port 5173 --open
