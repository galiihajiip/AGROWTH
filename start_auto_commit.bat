@echo off
title AGROWTH - Auto Commit ^& Push
echo ============================================
echo  AGROWTH Auto Commit ^& Push - Starting...
echo ============================================
cd /d "%~dp0"
uv run auto_commit.py
pause
