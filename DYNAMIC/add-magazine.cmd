@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PYTHON_EXE=C:\Users\naras\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
set "SCRIPT_FILE=%SCRIPT_DIR%add_magazine.py"

if "%~1"=="" goto :usage

if not exist "%PYTHON_EXE%" (
  echo Python runtime not found:
  echo %PYTHON_EXE%
  exit /b 1
)

if not exist "%SCRIPT_FILE%" (
  echo Script not found:
  echo %SCRIPT_FILE%
  exit /b 1
)

if "%~2"=="" (
  "%PYTHON_EXE%" "%SCRIPT_FILE%" "%~1"
) else (
  "%PYTHON_EXE%" "%SCRIPT_FILE%" "%~1" --title "%~2"
)

exit /b %errorlevel%

:usage
echo Usage:
echo   add-magazine.cmd MAGAZINE_CODE
echo   add-magazine.cmd MAGAZINE_CODE "DISPLAY TITLE"
echo.
echo Example:
echo   add-magazine.cmd KK
echo   add-magazine.cmd KK "Kalanjali"
exit /b 1
