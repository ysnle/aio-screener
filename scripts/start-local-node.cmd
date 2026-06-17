@echo off
setlocal
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8765"
set "NODE_EXE=C:\Users\zmfhd\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%NODE_EXE%" (
  "%NODE_EXE%" "%~dp0start-local-node.mjs" %PORT%
) else (
  node "%~dp0start-local-node.mjs" %PORT%
)
