@echo off
REM ── LandGuard Kenya — one-click launcher ─────────────────────────────────────
REM Double-click this file (or run it in a terminal) to start the whole system.
cd /d "%~dp0"

REM Free ports 3000/4000/5001 in case a previous run is still holding them
echo Stopping any previous LandGuard services...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000,4000,5001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

REM First-time setup if dependencies are missing
if not exist "node_modules\concurrently" goto setup
if not exist "backend\node_modules" goto setup
if not exist "frontend\node_modules" goto setup
goto run

:setup
echo.
echo ============================================================
echo   First-time setup - installing everything (a few minutes)
echo ============================================================
call npm run setup
if errorlevel 1 (
  echo.
  echo Setup failed. Please check the errors above.
  pause
  exit /b 1
)

:run
echo.
echo ============================================================
echo   Starting LandGuard Kenya
echo     Backend API   : http://localhost:4000
echo     Web app       : http://localhost:3000
echo     ML fraud model: http://localhost:5001
echo   Press Ctrl+C to stop all services.
echo ============================================================
echo.
call npm run dev
pause
