@echo off
setlocal EnableExtensions
chcp 65001 >nul
title HOWTOM 유니버스 실행
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js 20 이상을 설치해주세요.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo [안내] 최신 화면 빌드를 생성합니다.
  call npm install
  if errorlevel 1 goto :fail
  call npm run build
  if errorlevel 1 goto :fail
)
echo [안내] HOWTOM 유니버스 백엔드 서버를 시작합니다.
call npm start
goto :eof
:fail
echo [오류] 설치 또는 빌드에 실패했습니다.
pause
exit /b 1
