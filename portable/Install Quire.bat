@echo off
cd /d "%~dp0"
title Install Quire
powershell -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
