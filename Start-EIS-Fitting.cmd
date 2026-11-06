@echo off
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" app.py --open
) else (
  where py >nul 2>nul
  if errorlevel 1 (
    python app.py --open
  ) else (
    py -3 app.py --open
  )
)
if errorlevel 1 (
  echo Start fehlgeschlagen. Hinweise zu Python und Installation stehen in README.md.
  pause
)
