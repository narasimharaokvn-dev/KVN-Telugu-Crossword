@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PYTHON_EXE=C:\Users\naras\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
set "BUILDER=%SCRIPT_DIR%build_ss_index.py"

if not exist "%PYTHON_EXE%" (
  echo Python runtime not found:
  echo %PYTHON_EXE%
  exit /b 1
)

if not exist "%BUILDER%" (
  echo Builder script not found:
  echo %BUILDER%
  exit /b 1
)

if "%~1"=="" (
  echo Rebuilding all configured indexes...
  "%PYTHON_EXE%" "%BUILDER%"
) else (
  echo Rebuilding index for %~1...
  "%PYTHON_EXE%" "%BUILDER%" %*
)

echo.
echo Done.
endlocal
