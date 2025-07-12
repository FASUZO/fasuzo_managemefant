/**
 * 初始化脚本：复制 env.example 为 .env（若不存在）
 * 用法：npm run setup
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, 'env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log('已生成 .env（请根据需要修改环境变量）');
  } else {
    fs.writeFileSync(envPath, 'PORT=3000\n');
    console.log('已创建 .env：PORT=3000');
  }
} else {
  console.log('.env 已存在，跳过创建');
}

console.log('初始化完成'); 