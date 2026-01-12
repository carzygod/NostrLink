# NostrLink

NostrLink is a lightweight Nostr chat client built with React + Vite. It supports:
- Nostr key generation/login (NIP-19)
- Global chat and community feed (kind 1)
- Direct messages (kind 4, NIP-04)
- Relay management and health checks
- Local key persistence

---

## English

### Features
- Global chat and community feed (kind 1)
- Direct messages with NIP-04 encryption
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

### Notes
- Default relay: `wss://nos.lol`
- Keys are stored in `localStorage` under `nostr_nsec`.

---

## 中文

### 功能
- 全球聊天与社区动态（kind 1）
- 私信（NIP-04 加密，kind 4）
- 中继管理（新增/删除、延迟检测）
- 本地密钥存储（nsec）和语言偏好
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

### 说明
- 默认中继：`wss://nos.lol`
- 密钥保存在 `localStorage` 的 `nostr_nsec` 中。
