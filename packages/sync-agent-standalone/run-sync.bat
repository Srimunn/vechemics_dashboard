@echo off
:: ====================================================================
:: Automatic Tally Sync Execution Script for VChemics PC
:: Location: C:\Users\vchem\OneDrive\Desktop\sync-agent-standalone\run-sync.bat
:: ====================================================================

cd /d "%~dp0"
node sync-once.js >> sync.log 2>&1
