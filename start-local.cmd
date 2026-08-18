@echo off
title Mandarin PhotoProtocol — локальный запуск
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1"
if errorlevel 1 pause
