@echo off
:: Set working directory to the project root
cd /d "%~dp0"
:: Run manager without popping up a window (using start /b)
:: We use the absolute path of node if found, otherwise just 'node'
set NODE_PATH=node
where node >nul 2>nul
if %errorlevel%==0 for /f "delims=" %%i in ('where node') do set NODE_PATH="%%i"

start /b "" %NODE_PATH% server-manager.mjs
exit
