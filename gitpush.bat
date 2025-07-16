@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: 默认远程仓库（可在后续步骤中修改）
set "repo=http://github.com/FASUZO/fasuzo_management.git"

:: 参数解析
if "%~1"=="" (
  for /f "tokens=1-3 delims=/ " %%a in ("%date%") do (
    set "yy=%%c"
    set "mm=%%b"
    set "dd=%%a"
  )
  for /f "tokens=1-3 delims=:." %%h in ("%time%") do (
    set "hh=%%h"
    set "mi=%%i"
    set "ss=%%j"
  )
  :: 补零处理
  if 1!mm! lss 110 set "mm=0!mm!"
  if 1!dd! lss 110 set "dd=0!dd!"
  if 1!hh! lss 110 set "hh=0!hh!"
  if 1!mi! lss 110 set "mi=0!mi!"
  if 1!ss! lss 110 set "ss=0!ss!"
  set "fdate=!yy:~2,2!!mm!!dd!!hh!!mi!!ss!"
  set "commitmsg=chore: update !fdate!"
) else (
  set "commitmsg=%*"
)

:: Step 1  检查 Git 安装
echo.
echo ====== 步骤 1/8：检查 Git 安装 ======
pause
where git >nul 2>&1 || (
  echo 错误：未检测到Git，请先安装Git并添加到系统路径
  timeout /t 3 >nul
  exit /b 1
)

:: Step 2  初始化仓库（如缺失）
echo.
echo ====== 步骤 2/8：初始化仓库 ======
pause
if not exist .git (
  echo 初始化Git仓库...
  git init -b main
  echo 已创建 .git 仓库
) else (
  echo 已存在 .git 仓库，跳过初始化
)

:: Step 3  检查远程仓库配置
echo.
echo ====== 步骤 3/8：检查远程仓库 (origin) ======
pause
git remote | findstr "origin" >nul || (
  echo 警告：未配置远程仓库(origin)
  set /p "repo=请输入远程仓库URL(回车使用默认: !repo!): "
  if "!repo!"=="" set "repo=%repo%"
  git remote add origin "!repo!"
)

:: Step 4  清理暂存区
echo.
echo ====== 步骤 4/8：清理暂存区 (git reset) ======
pause
git reset
if !errorlevel! neq 0 (
  echo 错误：清理暂存区失败
  exit /b 1
)

:: Step 5  添加更改到暂存区
echo.
echo ====== 步骤 5/8：git add -A ======
pause
git add -A
if !errorlevel! neq 0 (
  echo 错误：添加文件失败
  exit /b 1
)

:: Step 6  提交更改
echo.
echo ====== 步骤 6/8：git commit ======
pause
git commit -m "!commitmsg!"
if !errorlevel! equ 0 (
  echo 提交成功: !commitmsg!
) else (
  echo 无需提交（工作区无变更）
)

:: Step 7  拉取远程更新并 rebase
echo.
echo ====== 步骤 7/8：git pull --rebase origin main ======
pause
git pull --rebase origin main
if !errorlevel! neq 0 (
  echo 错误：拉取远程变更失败，请手动解决冲突
  exit /b 1
)

:: Step 8  推送更改至远程
echo.
echo ====== 步骤 8/8：git push -u origin main ======
pause
git push -u origin main
if !errorlevel! equ 0 (
  echo 推送成功！分支: main
) else (
  echo 错误：推送失败
  exit /b 1
)

endlocal