@echo off
title Robot Vision — Quality Inspection
cd /d "%~dp0"
echo.
echo ============================================================
echo  AUTOMATED OBJECT DETECTION ^& QUALITY INSPECTION
echo  Robot Vision Micro-Project — Stage 3
echo  Shah ^& Anchor Kutchhi Engineering College  ^|  Om Nathwani
echo ============================================================
echo.

:: Check that Python is available.
where py >nul 2>&1
if errorlevel 1 (
    where python >nul 2>&1
    if errorlevel 1 (
        echo ERROR: Python is not installed or not on PATH.
        echo Download Python 3.10+ from https://www.python.org/
        pause
        exit /b 1
    )
    set PYTHON=python
) else (
    set PYTHON=py
)
echo Python found: %PYTHON%

:: Create a virtual environment if it does not already exist.
if not exist ".venv\" (
    echo Creating virtual environment in .venv\ ...
    %PYTHON% -m venv .venv
    if errorlevel 1 (
        echo ERROR: Could not create virtual environment.
        pause
        exit /b 1
    )
)

:: Activate the virtual environment.
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Could not activate virtual environment.
    pause
    exit /b 1
)

:: Install / upgrade dependencies quietly.
echo Installing dependencies (this only downloads on first run)...
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
if errorlevel 1 (
    echo ERROR: Dependency installation failed.
    echo Check your internet connection and try again.
    deactivate
    pause
    exit /b 1
)

echo Dependencies ready.
echo.
echo Launching GUI...
echo.
python main.py
if errorlevel 1 (
    echo.
    echo ERROR: The application exited with an error.
    echo Check outputs\robot_vision.log for details.
)

deactivate
echo.
pause
