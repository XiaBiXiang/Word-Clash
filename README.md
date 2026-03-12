# 首尾对决 (Word Clash)

支持异地双人实时对战的英语拼写网页游戏，具备：

- 双人房间联机（Socket.IO）
- 房主控制（锁房 / 移除对手 / 转移房主）
- 观战模式（不占玩家席位，可实时聊天）
- 中英文切换（i18n）
- 全屏 3-2-1 倒计时动画
- 字母翻牌揭晓、首尾交换位移动画
- 单词成功/失败反馈（粒子/抖动）
- 严格校验：首尾字母、最短长度、词典合法性过滤（排除缩写/专有名词/人名倾向）
- 回合计时与超时自动结算（服务端权威判定）
- 房间系统消息时间线（锁房 / 转移房主 / 踢人等操作记录）

## 本地开发

```bash
npm install --registry=https://registry.npmjs.org
npm run dev
```

可选环境变量：

- `BATTLE_ROUND_SECONDS`：每回合时长（秒），默认 `40`

- 前端地址：`http://localhost:20880`
- 后端健康检查：`http://localhost:31881/api/healthz`

## Docker 部署（单容器：Nginx + Node）

```bash
docker build -t word-clash .
docker run -d --name word-clash -p 20880:20880 word-clash
```

访问：`http://<服务器IP>:20880`

## Docker Compose（推荐给 1Panel）

项目已包含 `docker-compose.yml`，可直接使用：

```bash
docker compose up -d --build
```

查看状态：

```bash
docker compose ps
docker compose logs -f
```

停止：

```bash
docker compose down
```

### 1Panel 部署建议

1. 在 1Panel 新建应用，导入本项目目录中的 `docker-compose.yml`。
2. 将服务端口映射保持为 `20880:20880`。
3. 启动后访问 `http://你的服务器公网IP:20880`。
4. 如果你使用云服务器安全组，请放行 TCP `20880`。

## 对战方式

1. 玩家 A 打开页面，点击“创建房间”，得到 6 位房间码。
2. 玩家 B 打开同一地址，输入房间码并“加入房间”。
3. 双方各自在自己端输入盲填字母（输入过程仅显示 `•`），点击 Ready。
4. 系统倒计时后进入对战阶段，双方可实时同步输入单词并抢分。
