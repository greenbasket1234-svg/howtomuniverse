@echo off
setlocal EnableExtensions
chcp 65001 >nul
title HOWTOM 유니버스 바로 실행

cd /d "%~dp0"

if not exist "dist\index.html" (
  echo [오류] dist\index.html 파일을 찾을 수 없습니다.
  echo ZIP 파일을 완전히 압축 해제한 뒤 다시 실행해주세요.
  echo 현재 폴더: %CD%
  pause
  exit /b 1
)

where powershell >nul 2>nul
if errorlevel 1 (
  echo [오류] Windows PowerShell을 찾을 수 없습니다.
  pause
  exit /b 1
)

start "HOWTOM 유니버스 서버" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve-dist.ps1" -Port 3000

timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:3000/home"

echo 광고관제소를 실행했습니다.
echo 별도로 열린 'HOWTOM 유니버스 서버' 창을 닫으면 종료됩니다.
echo.
echo [참고] 이 방식은 화면 파일만 제공하는 간단 서버입니다.
echo Google Sheets/Notion 연동처럼 서버 API가 필요한 기능은 이 방식으로는 동작하지 않습니다.
echo 그런 기능까지 전부 쓰려면 "npm run start"로 실행해주세요(Node.js 필요).
exit /b 0
