@echo off
:: ====================================================================
:: Automatic Tally Sync Batch Script for Vchemics PC
:: Location: C:\Users\vchem\OneDrive\Desktop\tally-test\run-sync.bat
:: ====================================================================

:: Step 1: Change directory to the target folder containing sync-final.js and .env
cd /d "C:\Users\vchem\OneDrive\Desktop\tally-test"

:: Step 2: Log start time
echo [%DATE% %TIME%] Starting Tally Sync... >> sync-log.txt

:: Step 3: Run Node.js script and append both output and errors to sync-log.txt
node sync-final.js >> sync-log.txt 2>&1

:: Step 4: Log completion status
echo [%DATE% %TIME%] Sync completed with Exit Code: %ERRORLEVEL% >> sync-log.txt
echo -------------------------------------------------------------------- >> sync-log.txt
