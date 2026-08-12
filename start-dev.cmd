@echo off
setlocal EnableExtensions
chcp 65001 >nul
title HOWTOM 유니버스 개발 실행
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js 20 이상을 설치해주세요.
  pause
  exit /b 1
)
call npm run dev
if errorlevel 1 (
  echo.
  echo [오류] 실행하지 못했습니다. 위 오류를 확인해주세요.
  pause
  exit /b 1
)
