@echo off
cd /d "%~dp0"
title Quire
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -PdfPath "%~1"
)
if errorlevel 1 pause
