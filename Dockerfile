# ------------ Stage 1: Build ------------
FROM node:18-alpine AS builder

WORKDIR /app

# 只复制依赖清单以利用缓存
COPY package*.json ./

# 安装全部依赖（含 devDeps，用于构建）
RUN npm ci

# 复制源代码
COPY . .

# 前端构建
RUN npm run build

# ------------ Stage 2: Runtime ------------
FROM node:18-alpine

WORKDIR /app

# 复制 package.json 以便安装 prod 依赖
COPY package*.json ./

# 仅安装生产依赖，减小体积
RUN npm ci --omit=dev && \
    npm cache clean --force;

# 复制运行所需文件：服务器、前端 dist、字体、示例 env 等
COPY --from=builder /app/server ./server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/env.example ./

# 若存在 data 目录，可在运行时通过挂载覆盖
RUN mkdir -p /app/data/uploads

EXPOSE 3000
CMD ["node", "server/server.js"]