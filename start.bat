@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

where python >nul 2>nul
if errorlevel 1 (
    echo Python was not found. Install Python and add it to PATH.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo npm was not found. Install Node.js and add it to PATH.
    pause
    exit /b 1
)

python -c "import fastapi, uvicorn" >nul 2>nul
if errorlevel 1 (
    echo Backend dependencies are missing. Run: python -m pip install -r "%BACKEND%\requirements.txt"
    pause
    exit /b 1
)

if not exist "%FRONTEND%\node_modules\vite" (
    echo Installing frontend dependencies...
    pushd "%FRONTEND%"
    call npm install
    if errorlevel 1 (
        popd
        echo Frontend dependency installation failed.
        pause
        exit /b 1
    )
    popd
)

echo Starting AeroRoute AI backend and frontend...
start "AeroRoute AI Backend" /D "%BACKEND%" cmd /k "python -m uvicorn app.main:app --reload"
start "AeroRoute AI Frontend" /D "%FRONTEND%" cmd /k "npm run dev -- --host 127.0.0.1"
echo Backend: http://127.0.0.1:8000
echo Frontend: http://127.0.0.1:5173
endlocal
