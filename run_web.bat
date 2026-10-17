@echo off
setlocal EnableExtensions
title ROBOT VISION — Quality Inspection Workstation (Web)
cd /d "%~dp0"

echo.
echo ======================================================================
echo   ROBOT VISION: AUTOMATED QUALITY INSPECTION WORKSTATION
echo   Stage 3 Comprehensive Review ^| College Engineering Micro-Project
echo   Shah ^& Anchor Kutchhi Engineering College ^| Om Nathwani
echo ======================================================================
echo.

:: -------------------------------------------------------------------------
:: 1. Verify Python availability
:: -------------------------------------------------------------------------
set "PYTHON_CMD="

where python >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=python"
    goto :python_found
)

where py >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=py"
    goto :python_found
)

echo [ERROR] Step failed: Python verification.
echo Python was not found on your system PATH.
echo Please install Python 3.10+ from https://www.python.org/
echo Ensure that "Add Python to PATH" is checked during installation.
echo.
pause
exit /b 1

:python_found
echo [OK] Python detected: %PYTHON_CMD%

:: -------------------------------------------------------------------------
:: 2. Verify or create Python virtual environment (.venv)
:: -------------------------------------------------------------------------
if exist ".venv\Scripts\activate.bat" goto :venv_ready

echo [*] Virtual environment not found. Creating .venv directory...
"%PYTHON_CMD%" -m venv .venv
if errorlevel 1 (
    echo [ERROR] Step failed: Virtual environment creation.
    echo Could not create virtual environment in "%CD%\.venv".
    echo Please verify that python-venv is available and permissions are valid.
    echo.
    pause
    exit /b 1
)
echo [OK] Virtual environment created successfully.

:venv_ready
call ".venv\Scripts\activate.bat"
if errorlevel 1 (
    echo [ERROR] Step failed: Virtual environment activation.
    echo Failed to activate ".venv\Scripts\activate.bat".
    echo.
    pause
    exit /b 1
)
echo [OK] Virtual environment active (.venv)

:: -------------------------------------------------------------------------
:: 3. Install or update backend dependencies
:: -------------------------------------------------------------------------
echo [*] Verifying backend dependencies (FastAPI, OpenCV, NumPy, etc.)...
python -m pip install --quiet -r requirements.txt
if errorlevel 1 (
    echo [WARNING] Pip dependency check returned a non-zero exit code.
    echo Continuing with existing installed packages...
)

:: -------------------------------------------------------------------------
:: 4. Verify compiled frontend bundle (avoid rebuilding if present)
:: -------------------------------------------------------------------------
if exist "frontend\dist\index.html" goto :frontend_ready

echo [*] Production frontend build not found in frontend\dist
echo [*] Checking Node.js and npm to build the React application...

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Step failed: Node.js verification.
    echo Node.js is required to compile the frontend, but was not found on PATH.
    echo Please install Node.js LTS from https://nodejs.org/ and re-run run_web.bat
    echo.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Step failed: npm verification.
    echo npm was not found on PATH.
    echo Please install Node.js LTS from https://nodejs.org/ and re-run run_web.bat
    echo.
    pause
    exit /b 1
)

echo [*] Installing frontend npm packages...
cd frontend
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo [ERROR] Step failed: npm install in frontend directory.
    cd ..
    pause
    exit /b 1
)

echo [*] Compiling React + Vite production bundle...
call npm run build
if errorlevel 1 (
    echo [ERROR] Step failed: Frontend compilation (npm run build).
    cd ..
    pause
    exit /b 1
)
cd ..

:frontend_ready
echo [OK] Production frontend bundle verified in frontend\dist

:: -------------------------------------------------------------------------
:: 5. Launch FastAPI backend and open browser
:: -------------------------------------------------------------------------
echo.
echo [*] Starting Robot Vision Web Application...
python -m backend.server
if errorlevel 1 (
    echo.
    echo [ERROR] Step failed: Web server execution.
    echo The web application exited unexpectedly.
    echo Check the error messages above for details.
    echo.
    pause
    exit /b 1
)

deactivate
