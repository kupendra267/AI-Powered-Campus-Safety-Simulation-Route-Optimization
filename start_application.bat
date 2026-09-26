@echo off
title AI-Powered Campus Launcher
echo ================================================================
echo    AI-Powered Campus Simulation, Prediction & Optimization
echo ================================================================
echo Starting Flask Backend Server (Port 5000)...
start "Campus Backend (Flask API :5000)" cmd /k "cd /d "%~dp0" && python backend\run.py"

echo Waiting 2 seconds for backend initialization...
timeout /t 2 /nobreak >nul

echo Starting React Vite Frontend (Port 5173)...
start "Campus Frontend (Vite UI :5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo ================================================================
echo  Servers Launched!
echo  1. Unified App / Backend:  http://localhost:5000
echo  2. Vite Live Dev Server:   http://localhost:5173
echo ================================================================
pause
