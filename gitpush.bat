@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: 参数解析
if "%~1"=="" (
  for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set "fdate=%%c-%%b-%%a"
  set "ftime=%time:~0,8%"
  set "commitmsg=chore: update !fdate! !ftime!"
) else (
  set "commitmsg=%*"
)

:: 检查Git安装
where git >nul 2>&1 || (
  echo 错误：未检测到Git，请先安装Git并添加到系统路径
  timeout /t 3 >nul
  exit /b 1
)

:: 初始化仓库
if not exist .git (
  echo 初始化Git仓库...
  git init -b main
  echo 已创建.git仓库
)

:: 检查远程仓库
git remote | findstr "origin" >nul || (
  echo 警告：未配置远程仓库(origin)
  set /p "repo=请输入远程仓库URL: "
  git remote add origin "!repo!"
)

:: 添加更改
git add -A
if !errorlevel! neq 0 (
  echo 错误：添加文件失败
  exit /b 1
)

:: 提交更改
git commit -m "!commitmsg!" --quiet
if !errorlevel! equ 0 (
  echo 提交成功: !commitmsg!
) else (
  echo 无需提交（工作区无变更）
)

:: 拉取远程更新
git pull --rebase origin main
if !errorlevel! neq 0 (
  echo 错误：拉取远程变更失败，请手动解决冲突
  exit /b 1
)

:: 推送更改
git push -u origin main
if !errorlevel! equ 0 (
  echo 推送成功！分支: main
) else (
  echo 错误：推送失败
  exit /b 1
)

endlocal