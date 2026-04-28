@echo off
cd /d C:\Users\Tim\828codeproject\828-weather-direct\public

:loop
python run_skycam.py
echo Script crashed. Restarting in 5 seconds...
timeout /t 5 >nul
goto loop