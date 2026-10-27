@echo off
cd /d "%~dp0"
where pythonw >nul 2>nul
if errorlevel 1 (
    python "%~dp0main.py"
) else (
    start "" pythonw "%~dp0main.py"
)
