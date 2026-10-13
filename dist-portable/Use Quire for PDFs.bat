@echo off
cd /d "%~dp0"
title Quire
powershell -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0register.ps1"
echo.
pause
