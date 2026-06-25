@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "PYTHON_EXE=C:\Users\naras\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
set "EXTRACTOR=%SCRIPT_DIR%extract_exported_html.py"
set "BUILDER=%SCRIPT_DIR%build_ss_index.py"
set "SOURCES=%SCRIPT_DIR%sources.json"

if "%~1"=="" goto :usage
if "%~2"=="" goto :usage

set "SOURCE_DIR=%~1"
set "TARGET_CODE=%~2"

if not exist "%PYTHON_EXE%" (
  echo Python runtime not found:
  echo %PYTHON_EXE%
  exit /b 1
)

if not exist "%EXTRACTOR%" (
  echo Extractor script not found:
  echo %EXTRACTOR%
  exit /b 1
)

if not exist "%BUILDER%" (
  echo Index builder script not found:
  echo %BUILDER%
  exit /b 1
)

if not exist "%SOURCE_DIR%" (
  echo Source folder not found:
  echo %SOURCE_DIR%
  exit /b 1
)

dir /b "%SOURCE_DIR%\*.html" >nul 2>&1
if errorlevel 1 (
  echo No HTML files found in:
  echo %SOURCE_DIR%
  exit /b 1
)

if not exist "%SCRIPT_DIR%%TARGET_CODE%" (
  mkdir "%SCRIPT_DIR%%TARGET_CODE%" >nul 2>&1
)

echo.
echo Converting exported HTML files from:
echo %SOURCE_DIR%
echo into:
echo %SCRIPT_DIR%%TARGET_CODE%
echo.

set /a COUNT=0
for %%F in ("%SOURCE_DIR%\*.html") do (
  echo Processing %%~nxF
  "%PYTHON_EXE%" "%EXTRACTOR%" "%%~fF" --output-dir "%TARGET_CODE%"
  if errorlevel 1 (
    echo.
    echo Conversion failed for %%~nxF
    exit /b 1
  )
  set /a COUNT+=1
)

echo.
echo Converted !COUNT! HTML file^(s^).
echo.

findstr /I /C:"\"id\": \"%TARGET_CODE%\"" "%SOURCES%" >nul 2>&1
if errorlevel 1 (
  echo Warning:
  echo %TARGET_CODE% is not listed in sources.json yet.
  echo Files were converted, but the dynamic viewer will not show this magazine
  echo until you add it to sources.json and rebuild the index.
  echo.
  echo Example folder entry:
  echo   {
  echo     "id": "%TARGET_CODE%",
  echo     "title": "%TARGET_CODE%",
  echo     "index": "%TARGET_CODE%/index.json",
  echo     "assetBase": "%TARGET_CODE%/",
  echo     "solutionBase": "PUZZLE/"
  echo   }
  echo.
  goto :done
)

echo Rebuilding index for %TARGET_CODE%...
"%PYTHON_EXE%" "%BUILDER%" %TARGET_CODE%
if errorlevel 1 (
  echo.
  echo Index rebuild failed for %TARGET_CODE%.
  exit /b 1
)

:done
echo.
echo Finished.
exit /b 0

:usage
echo Usage:
echo   convert-exported-folder.cmd "FULL_SOURCE_FOLDER_PATH" MAGAZINE_CODE
echo.
echo Example:
echo   convert-exported-folder.cmd "C:\Users\naras\Desktop\padakosam\KVN-Telugu-Crossword\1EEEXPORTED" EE
exit /b 1
