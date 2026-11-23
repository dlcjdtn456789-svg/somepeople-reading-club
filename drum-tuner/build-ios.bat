@echo off
rem Double-click to build the iOS app with EAS (runs on Expo cloud Macs).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-ios.ps1"
