@echo off
cd /d "%~dp0"
python tools\build_share.py
if errorlevel 1 (
  echo.
  echo Build failed. See the messages above.
) else (
  echo.
  echo Done. See the dist folder.
)
pause
