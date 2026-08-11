@echo off
setlocal EnableExtensions
chcp 65001 >nul
title 광고관제소 실행
cd /d "%~dp0"

if not exist "package.json" (
  echo [오류] package.json을 찾을 수 없습니다.
  echo ZIP 파일을 완전히 압축 해제하고 이 파일을 프로젝트 폴더 안에서 실행해주세요.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js LTS가 설치되어 있지 않습니다.
  echo Node.js 20 이상을 설치한 뒤 다시 실행해주세요.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set "NODE_VERSION_RAW=%%v"
set "NODE_VERSION_NUM=%NODE_VERSION_RAW:v=%"
for /f "tokens=1 delims=." %%a in ("%NODE_VERSION_NUM%") do set "NODE_MAJOR=%%a"
if defined NODE_MAJOR if %NODE_MAJOR% LSS 20 (
  echo [오류] 현재 Node.js 버전은 %NODE_VERSION_RAW%입니다.
  echo 이 프로젝트는 Node.js 20 이상이 필요합니다(테스트 도구 vitest 기준).
  pause
  exit /b 1
)

echo 광고관제소를 시작합니다.
echo 개발 패키지가 없으면 서버 에러 대신 포함된 완성 빌드로 바로 실행됩니다.
echo.
call npm run dev

if errorlevel 1 (
  echo.
  echo [오류] 광고관제소를 실행하지 못했습니다.
  echo 위 오류 내용을 확인해주세요.
  pause
  exit /b 1
)
