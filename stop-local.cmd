@echo off
title Mandarin PhotoProtocol — остановка
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-local.ps1"
pause
