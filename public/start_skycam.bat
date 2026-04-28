@echo off
cd /d C:\Users\Tim\828codeproject\828-weather-direct\public

:loop
python run_skycam.py >> skycam.log 2>&1
timeout /t 5 >nul
goto loop