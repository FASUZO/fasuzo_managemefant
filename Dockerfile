# 使用合适的 Node.js 版本
FROM node:18  

# 创建并设置工作目录
WORKDIR /app

# 先复制 package.json（利用 Docker 缓存层优化）
# 关键：复制 package.json 和 package-lock.json
COPY package*.json ./  

# 安装依赖
RUN npm install

# 再复制其他文件（源代码、配置、静态资源等）
COPY . .

# 进行生产构建（Vite）
RUN npm run build

# 启动命令
CMD ["npm", "start"]