@echo off
:: Set working directory to the project root
cd /d "%~dp0"
:: Run the manager silently via VBS
wscript.exe "%~dp0run-manager.vbs"
exit
