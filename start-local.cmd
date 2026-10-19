@echo off
setlocal
cd /d "%~dp0"
if exist "%~dp0.tools\node-v22.23.3-win-x64\node.exe" set "PATH=%~dp0.tools\node-v22.23.3-win-x64;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer, reopen this window, and try again.
  pause
  exit /b 1
)
if not exist "node_modules" (
  call npm.cmd ci
  if errorlevel 1 exit /b 1
)
call npm.cmd run dev
