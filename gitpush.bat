@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: 默认远程仓库（可在后续步骤中修改）
set "repo=http://github.com/FASUZO/fasuzo_management.git"

:: 参数解析
if "%~1"=="" (
  for /f "tokens=1-3 delims=/ " %%a in ("%date%") do (
    rem %%a=年份(YYYY) %%b=月份 %%c=日期
    set "yy=%%a"
    set "mm=%%b"
    set "dd=%%c"
  )
  for /f "tokens=1-3 delims=:." %%h in ("%time%") do (
    set "hh=%%h"
    set "mi=%%i"
    set "ss=%%j"
  )
  :: 补零处理
  set "mm=0!mm!" & set "mm=!mm:~-2!"
  set "dd=0!dd!" & set "dd=!dd:~-2!"
  set "hh=0!hh!" & set "hh=!hh:~-2!"
  set "mi=0!mi!" & set "mi=!mi:~-2!"
  set "ss=0!ss!" & set "ss=!ss:~-2!"
  set "fdate=!yy:~2,2!!mm!!dd!!hh!!mi!!ss!"
  set "commitmsg=chore: update !fdate!"
) else (
  set "commitmsg=%*"
)

:: Step 1  检查 Git 安装
echo.
echo ====== 步骤 1/8：检查 Git 安装 ======
where git >nul 2>&1 || (
  echo 错误：未检测到Git，请先安装Git并添加到系统路径
  timeout /t 3 >nul
  exit /b 1
)
echo Git 安装检查通过
pause

:: Step 2  初始化仓库（如缺失）
echo.
echo ====== 步骤 2/8：初始化仓库 ======
if not exist .git (
  echo 初始化Git仓库...
  git init -b main
  echo 已创建 .git 仓库
) else (
  echo 已存在 .git 仓库，跳过初始化
)
echo 仓库初始化检查通过
pause

:: Step 3  检查远程仓库配置
echo.
echo ====== 步骤 3/8：检查远程仓库 (origin) ======

rem 使用 git remote get-url 判断 origin 是否存在，避免重复添加
git remote get-url origin >nul 2>&1
if !errorlevel! neq 0 (
  echo 警告：未检测到远程仓库(origin)
  set /p "repo=请输入远程仓库URL(回车使用默认: !repo!): "
  if "!repo!"=="" set "repo=%repo%"
  git remote add origin "!repo!"
) else (
  echo 已检测到远程仓库 origin，无需添加
)
echo 远程仓库检查通过
pause

:: Step 4  清理暂存区
echo.
echo ====== 步骤 4/8：清理暂存区 (git reset) ======
git reset
if !errorlevel! neq 0 (
  echo 错误：清理暂存区失败
  exit /b 1
)
echo 暂存区已清理
pause

:: Step 5  添加更改到暂存区
echo.
echo ====== 步骤 5/8：git add -A ======
git add -A
if !errorlevel! neq 0 (
  echo 错误：添加文件失败
  exit /b 1
)
echo 文件已添加到暂存区
pause

:: Step 6  提交更改
echo.
echo ====== 步骤 6/8：git commit ======
git commit -m "!commitmsg!"
if !errorlevel! equ 0 (
  echo 提交成功: !commitmsg!
) else (
  echo 无需提交（工作区无变更）
)
pause

:: Step 7  拉取远程更新并 rebase
echo.
echo ====== 步骤 7/8：git pull --rebase origin main ======
git pull --rebase origin main
if !errorlevel! neq 0 (
  echo 错误：拉取远程变更失败，请手动解决冲突
  exit /b 1
)
echo 已拉取并 rebase 远程更新
pause

:: Step 8  推送更改至远程
echo.
echo ====== 步骤 8/8：git push -u origin main ======
git push -u origin main
if !errorlevel! equ 0 (
  echo 推送成功！分支: main
) else (
  echo 错误：推送失败
  exit /b 1
)
pause

endlocal