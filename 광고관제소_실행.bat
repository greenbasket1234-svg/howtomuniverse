@echo off
rem 예전에는 존재하지 않는 "광고관제소_바로실행.cmd"를 호출하고 있어 더블클릭해도
rem 아무 반응이 없었습니다. 실제로 존재하는 start-app.cmd(빌드된 dist를 정적 서버로
rem 바로 실행)를 호출하도록 수정했습니다.
call "%~dp0start-app.cmd"
