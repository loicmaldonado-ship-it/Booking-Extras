@echo off
cd /d "%~dp0"
node scripts\recette-local.mjs --stop
if errorlevel 1 pause
