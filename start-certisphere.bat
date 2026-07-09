@echo off
title CertiSphere - Local Dev Server
cd /d "%~dp0"
echo.
echo ============================================================
echo   CertiSphere - starting local development server...
echo ============================================================
echo.
echo The browser will open automatically at http://localhost:3000/
echo Keep this window open while you use the site.
echo Close this window to stop the server.
echo.
echo ============================================================
echo.
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js / npm is not installed on this machine.
  echo.
  echo Download and install Node.js LTS from:
  echo     https://nodejs.org
  echo.
  echo Then run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo [INFO] First run detected - installing dependencies...
  echo This may take 1-2 minutes.
  call npm install
  echo.
)
if exist node_modules\.vite (
  echo [INFO] Clearing Vite cache...
  rmdir /s /q node_modules\.vite >nul 2>nul
)
call npm run dev
echo.
echo Server stopped. Press any key to close this window.
pause >nul
