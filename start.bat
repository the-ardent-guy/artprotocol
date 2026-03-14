@echo off
echo.
echo  ART PROTOCOL OS
echo  ===============
echo.

:: Start backend (uses backend_venv for FastAPI, venv311 for crew runner)
echo [1/2] Starting FastAPI backend on port 8000...
start "AP Backend" cmd /k "cd /d %~dp0backend && ..\backend_venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 2 /nobreak > nul

:: Start frontend
echo [2/2] Starting Next.js frontend on port 3000...
start "AP Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo  Backend:  http://localhost:8000/docs
echo  App:      http://localhost:3000
echo.
echo  Login: admin / artprotocol2024
echo.
pause
