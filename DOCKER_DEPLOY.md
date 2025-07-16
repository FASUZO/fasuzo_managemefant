# 使用 Docker 部署资产管理系统

> 本教程适用于当前项目（Node.js + Express + 静态网页 + JSON 文件持久化）。

---

## 目录结构
```
项目根/
│  server/           # Express 后端
│  scripts/          # 前端 JS (ESM)
│  styles/
│  │  base.css
│  │  main.css
│  package.json
│  Dockerfile        # 已提供示例
│  vite.config.js    # 前端构建配置
│  data/             # 运行时生成数据与图片
│  dist/             # 打包生成 (构建后出现)
│  .dockerignore     # 可选
├─ pages/
│   ├─ assets.html
│   ├─ planning.html
│   └─ management.html
└─ index.html
```

---

## 1. 创建 Dockerfile
在项目根目录新建 **Dockerfile**：
```Dockerfile
# 1. 使用轻量 Node 镜像
FROM node:18-alpine

# 2. 设置工作目录
WORKDIR /app

# 3. 复制依赖清单并安装依赖（含 dev 依赖用于构建）
COPY package*.json ./
RUN npm install

# 4. 进行前端生产构建 (Vite)
RUN npm run build

# 5. 复制剩余源代码（包括 server/ 等）
COPY . .

# 6. 暴露端口（与 server/server.js 保持一致）
EXPOSE 3000

# 7. 启动命令
CMD ["npm", "start"]
```

可选 **.dockerignore**（减少镜像体积）：
```
node_modules
*.log
data.json
.DS_Store
```

---

## 2. 构建镜像
```bash
docker build -t asset-manager:latest .
```

---

## 3. 运行容器
### 3.1 最简单方式（数据写在镜像内部）
```bash
docker run -d --name asset-manager -p 3000:3000 asset-manager:latest
```
访问 `http://localhost:3000` 使用系统，但删除容器后数据将丢失。

### 3.2 挂载数据目录，实现持久化
```bash
mkdir -p ~/asset-data   # 用于存放 data.json

docker run -d \
  --name asset-manager \
  -p 3000:3000 \
  -v ~/asset-data:/app \
  asset-manager:latest
```
说明：将宿主机 `~/asset-data` 挂载到容器 `/app`，`server.js` 会在该目录写入/读取 `data.json`。
也可仅挂载单个文件： `-v ~/asset-data/data.json:/app/data.json`。

### 3.3 使用 docker-compose（可选）
`docker-compose.yml`：
```yaml
services:
  fasuzo_management:
    image: fasuzo_management  # 直接指定镜像名，避免自动加前缀
    build: .
    restart: always
    container_name: fasuzo_management  # 容器名（可选）
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
```
启动：
```bash
docker compose up -d   # 或 docker-compose up -d
```

---

## 4. 推送到服务器
1. **源码方式**：上传项目源码到服务器，并重复第 2、3 步。  
2. **镜像仓库方式**：
```bash
# 本地
docker tag asset-manager your_dockerhub/asset-manager:latest
docker push your_dockerhub/asset-manager:latest

# 服务器
docker pull your_dockerhub/asset-manager:latest
docker run -d -p 3000:3000 your_dockerhub/asset-manager:latest
```

---

## 5. 常见问题
| 问题 | 解决方案 |
|------|-----------|
| 字体文件较大导致镜像膨胀 | 在 `.dockerignore` 中排除不必要文件，或使用多阶段构建。 |
| 端口冲突 | 修改 `-p 宿主端口:3000`，如 `-p 8080:3000`。 |
| 文件权限 | 挂载卷时注意宿主与容器用户权限；如需降权可在 Dockerfile 末尾 `USER node`。 |

---

完成上述步骤后，任何浏览器访问 `http://<服务器IP>:<映射端口>` 即可正常交互并持久化数据。 