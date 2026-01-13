# NostrLink

NostrLink is a lightweight Nostr chat client built with React + Vite. It supports:
- Nostr key generation/login (NIP-19)
- Global chat and community feed (kind 1)
- Direct messages (kind 4, NIP-04)
- Group chat (NIP-28)
- Media uploads (image/video/audio/voice) via Cloudflare R2
- Relay management and health checks
- Local key persistence

---

## English

### Features
- Global chat and community feed (kind 1)
- Direct messages with NIP-04 encryption
- Group chat with NIP-28
- Media uploads (image/video/audio/voice) via Cloudflare R2
- Relay management (add/remove, latency check)
- Local key storage (nsec) and language preference
- Settings: address and private key copy

### Requirements
- Node.js (LTS recommended)

### Install
```bash
npm install
```

### Run (dev)
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Preview
```bash
npm run preview
```

### Media uploads (Cloudflare R2)
1. Copy `.env.example` to `.env` and fill in the R2 settings.
2. Start the upload server:
```bash
npm run upload-server
```
3. Start the frontend:
```bash
npm run dev
```

### Notes
- Default relay: `wss://nos.lol`
- Keys are stored in `localStorage` under `nostr_nsec`.

---

## 中文

### 功能
- 全球聊天与社区动态（kind 1）
- 私信（NIP-04 加密，kind 4）
- 群聊（NIP-28，创建/加入/聊天）
- 支持发送图片/视频/音频/语音（Cloudflare R2）
- 中继管理（添加/移除、延迟检测）
- 本地密钥存储（nsec）与语言偏好
- 设置页：地址与私钥复制

### 环境要求
- Node.js（建议 LTS）

### 安装依赖
```bash
npm install
```

### 本地运行
```bash
npm run dev
```

### 构建
```bash
npm run build
```

### 预览
```bash
npm run preview
```

### 媒体上传（Cloudflare R2）
1. 复制 `.env.example` 为 `.env` 并填写 R2 配置。
2. 启动上传服务：
```bash
npm run upload-server
```
3. 启动前端：
```bash
npm run dev
```

### 说明
- 默认中继：`wss://nos.lol`
- 密钥保存在 `localStorage` 的 `nostr_nsec` 中。
