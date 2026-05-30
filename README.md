# BilldDesk · 静默无人值守 Fork

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D6)
![status](https://img.shields.io/badge/status-self--hosted-success)

> 上游：[galaxy-s10/billd-desk](https://github.com/galaxy-s10/billd-desk) + [galaxy-s10/billd-desk-server](https://github.com/galaxy-s10/billd-desk-server)
>
> 本仓库在原版基础上 **加了静默被控端模式 + 服务端精简化**，专为单机 / 小规模自部署优化。

---

## 📁 目录结构

```
.
├── client/                # Electron 客户端（主控 + 被控同一份代码）
│   ├── electron-main/     # 主进程（含 silent-mode / win32-actions / privacy-window）
│   ├── src/               # Vue3 渲染端（含 silentHealth）
│   └── scripts/           # watchdog.cjs + install/uninstall-silent.ps1
│
└── server/                # Koa2 后端（精简化：直播/支付/三方登录 router 已禁用）
    ├── src/router/        # index.ts 含 DISABLED_ROUTERS 白名单
    └── src/secret/        # secret.example.ts 模板（cp 改名为 secret.ts 后填值）
```

---

## 🆚 与上游的差异

### 客户端（client/）相对 `galaxy-s10/billd-desk`

| 新增能力 | 文件 |
|---|---|
| 静默启动 `--silent` flag | `electron-main/silent-mode.ts` |
| 隐藏窗口 + 跳过任务栏 + 拦截 close | `electron-main/silent-mode.ts` |
| 开机自启（HKCU Run + Task Scheduler 双保险） | `scripts/install-silent.ps1` |
| 守护进程（双心跳 + CIM 命令行过滤 + 强杀重启） | `scripts/watchdog.cjs` |
| Win11 Modern Standby 唤醒防误杀 | `scripts/watchdog.cjs` |
| 真隐私模式（`setContentProtection` 罩屏，本地黑/远端可见） | `electron-main/privacy-window.ts` |
| 锁屏 / 关显示器 IPC | `electron-main/win32-actions.ts` |
| 渲染端心跳 + WebRTC 健康监测（Proxy patch RTCPeerConnection） | `src/utils/silentHealth.ts` |
| 远控断开自动锁屏（持久化开关） | `electron-main/silent-ipc.ts` + 设置页 UI |
| 设置页：远程会话 + 隐私模式 UI 块 | `src/views/setting/index.vue` |

详细审计与设计文档：见客户端 commit 历史。

### 服务端（server/）相对 `galaxy-s10/billd-desk-server`

| 修改 | 文件 |
|---|---|
| 路由黑名单（禁用直播/支付/三方登录/七牛云相关 router） | `src/router/index.ts` |
| 远控部署专用 secret 模板 | `src/secret/secret.example.ts` |

被禁用的 17 个 router：`live*`, `srs`, `bilibili`, `tencentcloudCss`, `order`, `wallet*`, `goods`, `giftRecord`, `signin*`, `qqUser`, `wechatUser`, `qiniuData`, `globalMsg`。

理由：原 server 是 `billd-live + billd-desk` 共用代码，直播/支付/第三方登录占了一半 router，对纯远控部署是死代码，且会因 secret 里 `**********` 占位符未填导致进程启动失败。

---

## 🚀 快速开始

### 客户端构建（在任意机器上）

```bash
cd client
pnpm i               # Node 18.19.0 + pnpm 9
pnpm run dev         # 开发模式
pnpm run build:win   # 出 Windows 安装包到 client/electron-release/
```

### 服务端部署（在你的 Windows 2H4G 上）

```bash
cd server
pnpm i

# 配置 secret
cp src/secret/secret.example.ts src/secret/secret.ts
# 编辑 secret.ts 把 TODO_ 项目改成你的 MySQL/Redis 密码 + JWT_SECRET

# 初始化数据库（首次）
pnpm run mysql:prod

# 启动（生产环境）
pnpm run build
pm2 start dist/index.js --name billd-desk-server
pm2 save
```

详细 Windows + 宝塔面板部署步骤：见 `server/doc/` 下文档。

### 客户端连你自己的服务端

打开客户端 → 设置 → 接口配置 → 修改 → 填：
- `wss`: `wss://你的域名/socket.io/`
- `axios`: `https://你的域名/api`

---

## 🪟 静默被控端（自用，单机）

```powershell
# 1. 安装（管理员 PowerShell）
powershell -ExecutionPolicy Bypass -File `
  client\scripts\install-silent.ps1 `
  -ExePath "C:\Program Files\BilldDesk\BilldDesk.exe"

# 2. 验证
Get-Content "$env:APPDATA\BilldDesk\silent\watchdog.log" -Tail 30

# 3. 卸载
powershell -ExecutionPolicy Bypass -File client\scripts\uninstall-silent.ps1
```

详细原理：见客户端 [scripts/](client/scripts/) 目录。

---

## 📜 License

MIT —— 沿用上游 license。版权归原作者 [shuisheng (galaxy-s10)](https://github.com/galaxy-s10) 所有。

本 fork 的扩展部分（静默模式 / 隐私罩屏 / 守护进程 / 服务端精简化）同样以 MIT 发布。
