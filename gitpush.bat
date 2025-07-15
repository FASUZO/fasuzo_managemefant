@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: 默认远程仓库（可在后续步骤中修改）
set "repo=http://github.com/FASUZO/fasuzo_management.git"

:: 参数解析
if "%~1"=="" (
  for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set "fdate=%%c-%%b-%%a"
  set "ftime=%time:~0,8%"
  set "commitmsg=chore: update !fdate! !ftime!"
) else (
  set "commitmsg=%*"
)

:: Step 1  检查 Git 安装
echo.
echo ====== 步骤 1/6：检查 Git 安装 ======
pause
where git >nul 2>&1 || (
  echo 错误：未检测到Git，请先安装Git并添加到系统路径
  timeout /t 3 >nul
  exit /b 1
)

:: Step 2  初始化仓库（如缺失）
echo.
echo ====== 步骤 2/6：初始化仓库 ======
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
echo ====== 步骤 3/6：检查远程仓库 (origin) ======
pause
git remote | findstr "origin" >nul || (
  echo 警告：未配置远程仓库(origin)
  set /p "repo=请输入远程仓库URL(回车使用默认: !repo!): "
  if "!repo!"=="" set "repo=%repo%"
  git remote add origin "!repo!"
)

:: Step 4  添加更改到暂存区
echo.
echo ====== 步骤 4/6：git add -A ======
pause
git add -A
if !errorlevel! neq 0 (
  echo 错误：添加文件失败
  exit /b 1
)

:: Step 5  提交更改
echo.
echo ====== 步骤 5/6：git commit ======
pause
git commit -m "!commitmsg!"
if !errorlevel! equ 0 (
  echo 提交成功: !commitmsg!
) else (
  echo 无需提交（工作区无变更）
)

:: Step 6  拉取远程更新并 rebase
echo.
echo ====== 步骤 6/7：git pull --rebase origin main ======
pause
git pull --rebase origin main
if !errorlevel! neq 0 (
  echo 错误：拉取远程变更失败，请手动解决冲突
  exit /b 1
)

:: Step 7  推送更改至远程
echo.
echo ====== 步骤 7/7：git push -u origin main ======
pause
git push -u origin main
if !errorlevel! equ 0 (
  echo 推送成功！分支: main
) else (
  echo 错误：推送失败
  exit /b 1
)

endlocal