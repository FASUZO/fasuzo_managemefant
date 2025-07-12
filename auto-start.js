#!/usr/bin/env node
// node auto-start.js
const { existsSync, statSync, writeFileSync } = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const root = __dirname;
const marker = path.join(root, '.deps_marker');
const lockFile = path.join(root, 'package-lock.json');

function needsInstall() {
  if (!existsSync(path.join(root, 'node_modules'))) return true;
  if (!existsSync(lockFile)) return false;
  if (!existsSync(marker)) return true;
  return statSync(lockFile).mtimeMs > statSync(marker).mtimeMs;
}

if (needsInstall()) {
  console.log(' √ 正在安装/更新依赖...');
  execSync('npm install', { stdio: 'inherit' });   // 安装全部依赖
  // 构建前端静态资源（若有 Vite 配置）
  try {
    require.resolve('vite');
    console.log(' √ 正在构建前端资源...');
    execSync('npm run build', { stdio: 'inherit' });
  } catch {
    console.log(' × 未安装 vite，跳过前端构建');
  }
  writeFileSync(marker, Date.now().toString());
} else {
  console.log(' √ 依赖已是最新');
}

console.log(' √ 启动服务...');
execSync('node server/server.js', { stdio: 'inherit' }); 