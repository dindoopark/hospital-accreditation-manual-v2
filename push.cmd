@echo off
chcp 65001 >nul
setlocal
rem 이 폴더(N: 드라이브)는 점(.)으로 시작하는 파일을 만들 수 없어서
rem git 저장소 폴더(.git)만 C 드라이브에 따로 두고 작업 파일은 여기 그대로 씁니다.
set "GIT_DIR=C:\Users\PC\repos\hospital-accreditation-manual-v2.git"
set "GIT_WORK_TREE=%~dp0."
cd /d "%~dp0"

echo [1/3] docs\data.js 다시 만드는 중...
python build.py
if errorlevel 1 goto err

echo.
echo [2/3] 바뀐 파일
git status --short
echo.
set "MSG="
set /p "MSG=커밋 메시지 (Enter 치면 '매뉴얼 내용 수정'): "
if "%MSG%"=="" set "MSG=매뉴얼 내용 수정"

git add -A
if errorlevel 1 goto err
git commit -m "%MSG%"
if errorlevel 1 goto nochange

echo.
echo [3/3] GitHub 에 올리는 중...
git push
if errorlevel 1 goto err

echo.
echo 완료. 1~2분 뒤 아래 주소에 반영됩니다.
echo   https://dindoopark.github.io/hospital-accreditation-manual-v2/
goto end

:nochange
echo.
echo 바뀐 내용이 없어서 올리지 않았습니다.
goto end

:err
echo.
echo 오류가 났습니다. 위 메시지를 확인하세요.

:end
echo.
pause
