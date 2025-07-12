@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: 参数解析
if "%~1"=="" (
  set "commitmsg=chore: update %date% %time%"
) else (
  set "commitmsg=%*"
)

:: 初始化仓库（若不存在）
if not exist .git (
  echo 初始化 Git 仓库...
  git init -b main
)

:: 添加/提交/推送
echo 添加
git add -A
echo 提交
git commit -m "!commitmsg!" 2>nul || echo 无需提交
echo 拉取
git pull --rebase origin main 2>nul
echo 推送
git push -u origin main

echo 完成推送。
endlocal 