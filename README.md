# 💼 个人资产管理系统

<p align="center">
  <img src="https://img.shields.io/badge/Node-%3E%3D14-green" alt="node"/>
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="license"/>
  <img src="https://img.shields.io/badge/Made%20with-Cursor-ff69b4" alt="cursor"/>
</p>

> 一个无需数据库、**即克隆即用**的 Web 资产管理工具。适合个人 / 小团队快速记录资产、费用与附件，为你的收支与物品提供清晰可查的台账。

> ⚡ **声明：本项目主要由 [Cursor](https://cursor.sh) AI 编码助手协助生成与维护。**

---

## 📖 目录

- [💼 个人资产管理系统](#-个人资产管理系统)
  - [📖 目录](#-目录)
  - [项目亮点](#项目亮点)
  - [功能特性](#功能特性)
  - [技术栈](#技术栈)
  - [目录结构](#目录结构)
  - [快速开始](#快速开始)
    - [环境要求](#环境要求)
    - [本地运行](#本地运行)
  - [部署说明](#部署说明)
    - [方式一：Docker](#方式一docker)
    - [方式二：传统服务器](#方式二传统服务器)
  - [常见问题](#常见问题)
  - [未来计划](#未来计划)
  - [License](#license)
  - [配置与调试](#配置与调试)
    - [运行时环境变量（.env）](#运行时环境变量env)
    - [前端调试日志](#前端调试日志)

---

## 项目亮点

| ⭐ 亮点 | 说明 |
|--------|------|
| 零依赖数据库 | 所有数据均保存为 `JSON` + 本地图片文件，迁移 & 备份轻而易举 |
| **超轻量** | 前端纯原生 JS + Vite 构建 < 100KB，后端仅 ~100 行 Express 服务器 |
| 可视化列管理 | 任意新增/隐藏/重排列，字段随心所欲 |
| 自动保存 & 快捷键 | 支持自动保存、键盘操作，减少重复点击 |
| 单文件部署 | 构建后整个应用可被任何支持静态文件 + Node 的环境托管 |

---

## 功能特性

- **资产录入**：记录名称、分类、子标签、金额、购买日期、渠道、备注等信息。
- **金额格式化**：自动保留两位小数并支持输入 `99/年`、`12.5/季` 这类带单位格式。
- **附件管理**：图片拖拽上传并本地持久化；表格 & 弹窗双视图浏览 / 替换 / 删除。
- **分类 / 渠道 / 标签管理**：在「管理」页一键增删 & 拖拽排序。
- **数据导入 / 导出**：JSON 备份与还原，轻松迁移。
- **深色模式 & 偏好持久化**：自动保存、深色主题开关写入 `localStorage`。

---

## 技术栈

| 层次 | 技术 | 说明 |
|------|------|------|
| 前端 | 原生 HTML / CSS / JS、Vite | 零依赖框架，直接运行；Vite 负责构建优化 |
| 后端 | Node.js 18 + Express | 提供静态资源、简单 RESTful API & JSON 持久化 |
| 部署 | Docker / docker-compose | 官方 `Dockerfile` & `docker-compose.yml` 开箱即用 |

---

## 目录结构

```text
suzo_management/
├─ server/            # 后端入口 & 路由
│  └─ server.js
├─ scripts/           # 前端业务逻辑 (ESM)
├─ styles/            # 样式
├─ pages/             # 独立页面 (多页应用)
├─ data/              # 运行期生成的数据与附件
├─ LXGWBrightGB/      # 开源字体资源
├─ Dockerfile         # 生产镜像构建
├─ docker-compose.yml # 一键部署
└─ vite.config.js     # 构建配置
```

---

## 快速开始

### 环境要求

- **Node ≥ 14**（推荐 18 LTS）
- **npm ≥ 6**
- 若使用 Docker 可忽略上述要求。

### 本地运行

```bash
# 1. 克隆仓库
$ git clone git@github.com:FASUZO/fasuzo_managemefant.git
$ cd fasuzo_managemefant

# 2. 安装依赖
$ npm i

# 3. 初始化环境变量
$ npm run setup   # 复制 env.example → .env，可按需修改

# 4. 开发模式 (热更新)
$ npm run dev     # 打开 http://localhost:5173

# 5. 生产模式
$ npm run build   # 打包资源到 dist/
$ npm start       # 打开 http://localhost:3000
```

> 默认 Express 会先尝试读取 `dist/`，若不存在则退回 Vite Dev Server。

---

## 部署说明

### 方式一：Docker

```bash
# 构建镜像
$ docker build -t asset-manager:latest .

# 运行容器 (数据持久化到宿主机 ./data)
$ docker run -d \
  --name asset-manager \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  asset-manager:latest
```

或使用 `docker-compose`：

```yaml
version: "3.9"
services:
  asset:
    build: .
    container_name: asset-manager
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
```

```bash
$ docker compose up -d
```

### 方式二：传统服务器

1. **安装 Node**：推荐使用 `nvm` 安装 18 LTS。
2. **上传代码**：`git clone` 或 `scp` 到服务器。
3. **安装依赖 & 构建**：`npm i && npm run build`。
4. **后台运行**：`nohup npm start &` 或使用 `pm2` / `systemd`。

---

## 常见问题

| 问题 | 排查 & 解决 |
|------|--------------|
| 访问 3000 端口无响应 | 查看 `npm start` / Docker 日志，确认没有端口占用或防火墙限制 |
| 上传大尺寸图片失败 | `server/server.js` 中 `express.json({limit: '50mb'})`，可按需上调 |
| 页面样式错乱 | 清浏览器缓存或确认 `dist/` 是否与后端同步 |
| 需要 HTTPS | 推荐使用 Nginx / Caddy 作反向代理，并开启证书 |
| 数据丢失 / 回滚 | 检查是否错误覆盖了 `data/data.json`，定期备份数据目录 |

---

## 未来计划

- [ ] 移动端自适应优化（Touch 体验 & PWA）
- [ ] 资产折旧 & 统计报表
- [ ] 多用户 / 权限管理（可选 JWT）
- [ ] WebDAV / S3 远程附件存储
- [ ] 单元测试 & CI

欢迎通过 Issue / PR 提出建议！

---

## License

[MIT](LICENSE) © 2023–Present SUZO

## 配置与调试

### 运行时环境变量（.env）
| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | 后端监听端口 |
| LOG_LEVEL | info | 日志级别：`debug \| info \| error` |
| JSON_LIMIT | 50mb | 最大 JSON 请求体，含 Base64 图片 |
| DATA_DIR | data | 数据 & 附件目录 |
| DEFAULT_DARK | false | 前端默认暗黑模式 |
| DEFAULT_AUTO_SAVE | false | 前端默认自动保存功能 |
| DEFAULT_DEBUG | false | 前端默认开启调试输出 |
| FONT_URL |  | 需动态加载的字体 CSS 链接 |

`npm run setup` 会在首次安装时自动复制 `env.example` → `.env`（若无）。

### 前端调试日志
在浏览器控制台执行：
```js
debug = true;   // 开启详细调试
debug = false;  // 关闭
```
亦可在 `.env` 中设置 `DEFAULT_DEBUG=true` 让前端默认输出。

---
