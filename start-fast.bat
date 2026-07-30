@echo off
REM ── LandGuard Kenya — FAST (production) launcher ─────────────────────────────
REM Builds optimised versions once, then runs them. Pages load instantly — no
REM per-visit compiling. Use this for demos / presentations / daily use.
REM (Use start.bat instead only when you are actively editing the code.)
cd /d "%~dp0"

REM Free ports 3000/4000/5001 so the build isn't blocked by a running instance
echo Stopping any previous LandGuard services...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000,4000,5001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

if not exist "node_modules\concurrently" goto setup
if not exist "backend\node_modules" goto setup
if not exist "frontend\node_modules" goto setup
goto build

:setup
echo.
echo   First-time setup - installing everything (a few minutes)...
call npm run setup
if errorlevel 1 ( echo Setup failed. & pause & exit /b 1 )

:build
echo.
echo   Building optimised production bundles (one-time, ~1-2 min)...
call npm run build
if errorlevel 1 ( echo Build failed. & pause & exit /b 1 )

echo.
echo ============================================================
echo   LandGuard Kenya (FAST / production mode)
echo     Web app       : http://localhost:3000
echo     Backend API   : http://localhost:4000
echo     ML fraud model: http://localhost:5001
echo   Press Ctrl+C to stop all services.
echo ============================================================
echo.
call npm run prod
pause
