@echo off
setlocal

rem Determine script directory (server folder)
set "SCRIPT_DIR=%~dp0"

rem Go to project root (one level above server) to find .venv
cd /d "%SCRIPT_DIR%.."

if exist ".venv\Scripts\activate.bat" (
  call ".venv\Scripts\activate.bat"
) else (
  echo [WARN] .venv not found in %CD%.
  echo        Create it with: py -m venv .venv
  echo        (or: python -m venv .venv)
)

rem Ensure ffmpeg is available for this server process
set "FFMPEG_DIR=C:\ffmpeg\bin"
if exist "%FFMPEG_DIR%\ffmpeg.exe" (
  set "PATH=%FFMPEG_DIR%;%PATH%"
) else (
  echo [WARN] ffmpeg.exe not found in %FFMPEG_DIR%.
  echo        Install ffmpeg and place ffmpeg.exe in C:\ffmpeg\bin or ensure it is in PATH.
)

rem Go back to server folder to run uvicorn with the correct module path
cd /d "%SCRIPT_DIR%"

python -m uvicorn recorder_server:app --host 127.0.0.1 --port 8765

endlocal
