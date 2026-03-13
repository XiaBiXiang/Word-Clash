# 首尾对决 (Word Clash)

一个支持异地实时联机 + 单人人机挑战的英语拼写网页游戏。  
前端 React + Tailwind + Framer Motion，后端 Express + Socket.IO，容器化部署使用 Nginx + Docker。

## 核心特性

- 实时双人联机房间（创建 / 加入 / 观战）
- 房主控制（锁房、移除对手、转移房主）
- 聊天系统（历史消息保留、时间戳、移动端未读角标）
- 人机对战模式（AI 随机字母、短时限回合）
- 三语言界面（中文 / English / 日本語，下拉切换，默认中文并持久化）
- 两套主题（霓虹 Neon / 白棕 Cream）
- 全屏 `3-2-1` 倒计时、交换字母动画、成功粒子与失败抖动反馈
- 单词严格校验（首尾字母、最短长度、词典合法性、缩写/专名过滤）
- 请求限流保护（防连点、防刷接口）
- 移动端与桌面端适配 + 性能降级模式（低性能设备自动减动画）

## 游戏模式

### 1) 联机对战

1. 玩家 A 创建房间，分享 6 位房间码。
2. 玩家 B 输入房间码加入。
3. 双方在准备阶段各输入 1 个盲填字母并点击 `Ready`。
4. 倒计时后进入对战：输入单词，或发起交换首尾投票。
5. 交换必须 `2/2` 双方同意才执行。
6. 任一玩家命中有效单词，本回合立即结束并计分。

### 2) 人机对战 (VS AI)

1. 大厅点击 `人机对战 / Play VS AI / AI対戦`。
2. 玩家输入 1 个字母，AI 随机生成另一个字母。
3. 短倒计时后进入作答阶段（默认 24 秒）。
4. 玩家按同样规则提交英文单词，命中得分后进入下一回合。

## 技术栈

- Frontend: React 18 + Vite + Tailwind CSS + Framer Motion
- Backend: Node.js + Express + Socket.IO
- Validation: Dictionary API + Datamuse + 内置词表兜底（可选离线宽松模式）
- Deploy: Nginx (20880) + Docker / Docker Compose
- CI/CD: GitHub Actions 构建并推送 GHCR 多架构镜像

## 本地开发

```bash
npm install
npm run dev
```

- 前端地址：`http://localhost:20880`
- 后端健康检查：`http://localhost:31881/api/healthz`

可选环境变量：

- `PORT`：后端监听端口（默认 `31881`）
- `BATTLE_ROUND_SECONDS`：联机模式回合时长（默认 `40`）
- `DISCONNECT_GRACE_MS`：断线重连保留时长（默认 `12000` 毫秒）
- `VITE_ALLOW_OFFLINE_RELAXED`：当前端在线词典不可达且本地词库未命中时，是否启用离线宽松校验（`true/1/on/yes` 开启，默认关闭）

## 生产构建

```bash
npm run build
```

## Docker 部署（Nginx + Node 同容器）

```bash
docker build -t word-clash:latest .
docker run -d --name word-clash \
  -p 20880:20880 \
  -e PORT=30881 \
  word-clash:latest
```

访问：`http://<服务器IP>:20880`

## Docker Compose

仓库内置 `docker-compose.yml`（默认使用 `localhost/word-clash:amd64` 镜像）：

```bash
docker compose up -d
docker compose ps
docker compose logs -f
```

停止：

```bash
docker compose down
```

如果你希望直接使用 GHCR 镜像，请把 `docker-compose.yml` 里的 `image` 改为：

```text
ghcr.io/xiabixiang/word-clash:latest
```

## GitHub Actions / GHCR

工作流文件：`.github/workflows/docker-publish.yml`

- 触发：`push main`、`v* tag`、`workflow_dispatch`
- PR：仅构建，不推送
- 主分支/标签：推送 `linux/amd64` + `linux/arm64` 镜像到 GHCR
- 已关闭 `provenance` / `sbom`，避免产生 `unknown/unknown` 平台条目

镜像地址示例：

- `ghcr.io/xiabixiang/word-clash:latest`

## 项目结构

```text
.
├── src/                 # React 前端
│   ├── App.jsx          # 主界面与交互逻辑
│   ├── index.css        # 主题与动画样式
│   └── utils/wordValidation.js
├── server/index.js      # Socket.IO 房间/对战服务
├── nginx.conf           # 20880 端口与反向代理
├── Dockerfile
├── docker-compose.yml
└── .github/workflows/docker-publish.yml
```

## License

本项目采用 [MIT License](./LICENSE)。
