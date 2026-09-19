@echo off
echo ======================================================================
echo    MandiMitra - Agricultural Procurement Scheduling Platform
echo    Smart India Hackathon Prototype Launcher
echo ======================================================================
echo.
echo [1/2] Starting MandiMitra FastAPI Backend on http://127.0.0.1:8000 ...
start "MandiMitra Backend" cmd /k "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"

echo [2/2] Waiting for server initialization...
timeout /t 2 /nobreak >nul

echo.
echo Opening MandiMitra Web Portal in your default browser...
start http://127.0.0.1:8000/frontend/index.html

echo.
echo ======================================================================
echo MandiMitra is running!
echo - Web Application: http://127.0.0.1:8000/frontend/index.html
echo - Interactive Swagger API Docs: http://127.0.0.1:8000/docs
echo ======================================================================
pause
