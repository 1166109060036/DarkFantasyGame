@echo off
rem Double-click to play Moonmire. Uses Windows PowerShell - nothing to install.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" %*
if errorlevel 1 pause
