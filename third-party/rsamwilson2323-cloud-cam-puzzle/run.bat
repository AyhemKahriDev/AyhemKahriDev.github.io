@echo off
title PuzzleCam - Gesture Capture
color 0A

echo ========================================
echo        PuzzleCam - Gesture Capture
echo ========================================
echo.

if not exist "index.html" (
    echo ERROR: index.html was not found.
    echo.
    echo Please place this BAT file inside the PuzzleCam project folder.
    echo.
    pause
    exit /b 1
)

where py >nul 2>&1
if %errorlevel%==0 (
    echo Starting PuzzleCam at:
    echo http://localhost:5500
    echo.
    start "" "http://localhost:5500"
    py -m http.server 5500
    pause
    exit /b
)

where python >nul 2>&1
if %errorlevel%==0 (
    echo Starting PuzzleCam at:
    echo http://localhost:5500
    echo.
    start "" "http://localhost:5500"
    python -m http.server 5500
    pause
    exit /b
)

echo ERROR: Python was not found.
echo.
echo Install Python, or use VS Code Live Server.
echo.
pause