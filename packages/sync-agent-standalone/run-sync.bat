@echo off
cd /d "%~dp0"
node sync-once.js >> sync.log 2>&1
