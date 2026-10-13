@echo off
cd /d "%~dp0"
title Uninstall Quire
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
echo.
pause
