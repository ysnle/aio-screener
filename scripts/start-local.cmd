@echo off
setlocal
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8765"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1" -Port %PORT%
