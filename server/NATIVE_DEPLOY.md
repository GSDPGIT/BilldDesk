# BilldDesk Server · 宝塔 Windows 原生部署（不用 Docker）

> 适用：Windows Server / Win10/Win11 + 宝塔Windows面板 8.x，**2H4G 完全够**
>
> 全程 ~30 分钟（不含域名备案 + SSL 等待）

如果你想用 Docker 部署，看 [DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md)（但 2H4G + Windows 紧张，**不推荐**）。

---

## 🎯 总体流程

```
1. 宝塔软件商店装 4 个软件（10 分钟）
       ↓
2. 建库 / 建用户（3 分钟）
       ↓
3. 拉代码 + 装依赖 + 编译（10 分钟）
       ↓
4. 改 1 个配置文件（3 分钟）
       ↓
5. PM2 起服务（2 分钟）
       ↓
6. 宝塔加站点 + Nginx 反代 + 申请 SSL（5 分钟）
       ↓
7. 客户端连上（2 分钟）
```

---

## 📦 第 1 步：宝塔软件商店装 4 个软件

宝塔 → 软件商店 → 依次安装：

| 软件 | 版本 | 备注 |
|---|---|---|
| **Nginx** | 1.24+ | 反向代理 + WSS + SSL |
| **MySQL** | 8.0 | 字符集选 utf8mb4 |
| **Redis** | 5.x 或更高 | Windows 移植版（宝塔商店里就一个版本，直接装） |
| **Node.js 版本管理器** | 装完后到管理器里选 **v18.19.0** | 服务端代码要求 |
| **PM2 管理器** | 最新 | 装不上的话见下方 §5 手动装 PM2 |

装完打开终端，验证：

```cmd
node -v       # v18.19.0
npm -v        # 10.x
mysql --version
redis-cli --version
```

---

## 🗄 第 2 步：建库 + 数据库用户

宝塔 → 数据库 → 添加：

| 字段 | 值 |
|---|---|
| 数据库名 | `billd_desk` |
| 用户名 | `billd_desk` |
| 密码 | 强密码（**记下来，下面要填**）|
| 字符集 | `utf8mb4` |
| 排序规则 | `utf8mb4_general_ci` |

> ⚠️ MySQL 8 默认认证插件是 `caching_sha2_password`，Node 的 mysql2 驱动兼容，但如果用旧的 mysql 驱动可能要改成 `mysql_native_password`。这套代码用 sequelize + mysql2，**不用改**。

Redis 默认无密码、监听 127.0.0.1：6379，宝塔装完直接能用。**为安全建议在 redis 配置加 `requirepass 你的强密码`**，然后 §4 secret.ts 里 `REDIS_CONFIG.password` 同步填进去。

---

## 📥 第 3 步：拉代码 + 装依赖 + 编译

打开宝塔的终端（菜单 → 终端），或者用 cmd / PowerShell：

```cmd
:: 进入随便一个目录（建议 C:\www\）
cd C:\www

:: 拉代码
git clone https://github.com/GSDPGIT/BilldDesk.git
cd BilldDesk\server

:: 装 pnpm + 依赖
npm i -g pnpm@9
pnpm i
```

**装依赖如果卡在 sharp / better-sqlite3 / bcrypt 等原生模块**：

```cmd
:: 临时设置走预编译二进制，绕过 node-gyp 编译
set npm_config_build_from_source=false
pnpm i
```

如果还是失败，装 `windows-build-tools`：

```cmd
npm i -g windows-build-tools
:: 装完重启终端
pnpm i
```

依赖装好后编译 TypeScript：

```cmd
pnpm run build
```

成功后 `server\dist\` 目录会生成 .js 文件。

---

## ⚙️ 第 4 步：配置 secret.ts

```cmd
copy src\secret\secret.example.ts src\secret\secret.ts
notepad src\secret\secret.ts
```

只需要改 4 项（都是 `TODO_` 开头）：

| 字段 | 改成 |
|---|---|
| `JWT_SECRET` | 随机长串。PowerShell 里跑：`[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')` 拷贝结果 |
| `MYSQL_CONFIG.username` | `billd_desk`（第 2 步建的用户名） |
| `MYSQL_CONFIG.password` | 第 2 步设的数据库密码 |
| `MYSQL_CONFIG.database` | `billd_desk` |
| `REDIS_CONFIG.password` | 如果你 Redis 设了密码，填这里；没设留空字符串 |
| `IP_URL.tencent.serverIp` / `ali.serverIp` | 你的服务器公网 IP（IP 白名单用，可写同一个 IP） |

> 注意 `secret.example.ts` 默认 `MYSQL_CONFIG.username = 'root'`，**改成你建的 billd_desk 用户**，更安全（生产环境别用 root）。

---

## 🚀 第 5 步：PM2 起服务

### 5.1 装 PM2（如果宝塔的 PM2 管理器装失败，用这个手动装）

```cmd
npm i -g pm2 pm2-windows-startup
pm2-startup install
:: 这一步会把 PM2 注册为 Windows 服务，开机自启
```

### 5.2 初始化数据库表（首次部署必跑一次）

```cmd
:: 在 server 目录下
set NODE_APP_INIT_MYSQL=true
set NODE_ENV=production
set NODE_APP_RELEASE_PROJECT_NAME=billd-desk-server
set NODE_APP_RELEASE_PROJECT_ENV=prod
set NODE_APP_RELEASE_PROJECT_PORT=4200
node dist\index.js
:: 看到 "项目启动成功" 或 "init mysql ok" 后 Ctrl+C 退出
```

### 5.3 用 PM2 启动

```cmd
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 status
```

应该看到：

```
┌─────┬────────────────────┬─────────┬─────────┬─────────┬──────┐
│ id  │ name               │ mode    │ status  │ cpu     │ mem  │
├─────┼────────────────────┼─────────┼─────────┼─────────┼──────┤
│ 0   │ billd-desk-server  │ fork    │ online  │ 0%      │ 180mb│
└─────┴────────────────────┴─────────┴─────────┴─────────┴──────┘
```

实时看日志：

```cmd
pm2 logs billd-desk-server
```

应该看到：
```
加载路由: deskUser.router.ts
加载路由: wsMessage.router.ts
...
已跳过 17 个非远控路由: live.router.ts, ...
加载所有路由成功！
监听端口: 4200
项目启动成功！
```

### 5.4 验证端口监听

```cmd
netstat -ano | findstr :4200
```

应该看到 `LISTENING`。浏览器开 `http://127.0.0.1:4200/` 应该返回欢迎 JSON。

---

## 🌐 第 6 步：宝塔加站点 + Nginx 反代 + SSL

### 6.1 加站点

宝塔 → 网站 → 添加站点：

| 字段 | 值 |
|---|---|
| 域名 | `api.你的域名.com` |
| 根目录 | 随便填（反代不用，比如 `C:\www\api-placeholder`） |
| FTP | 不创建 |
| 数据库 | 不创建 |
| PHP 版本 | **纯静态** |

### 6.2 申请 SSL

站点 → 设置 → SSL → Let's Encrypt → 选择域名 → 申请

> ⚠️ 前提：**域名已解析到本服务器 IP** + **域名已备案**（国内服务器 80/443 必须备案）+ **防火墙 / 云安全组 80 端口开着**

申请成功后宝塔会把证书自动放到：
```
C:\BtSoft\panel\vhost\cert\api.你的域名.com\fullchain.pem
C:\BtSoft\panel\vhost\cert\api.你的域名.com\privkey.pem
```

### 6.3 改 Nginx 反代配置

站点 → 设置 → 配置文件 → 把整个内容**清空**，粘贴下方（**自己替换 3 个占位符**）：

```nginx
server {
    listen 80;
    server_name api.你的域名.com;
    rewrite ^(.*)$ https://$host$1 permanent;
}

server {
    listen 443 ssl http2;
    server_name api.你的域名.com;

    ssl_certificate     C:/BtSoft/panel/vhost/cert/api.你的域名.com/fullchain.pem;
    ssl_certificate_key C:/BtSoft/panel/vhost/cert/api.你的域名.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    # Socket.io / WSS（必须在 / 之前）
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4200;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # HTTP API
    location / {
        proxy_pass http://127.0.0.1:4200;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    access_log  C:/BtSoft/wwwlogs/api.你的域名.com.log;
    error_log   C:/BtSoft/wwwlogs/api.你的域名.com.error.log;
}
```

保存。宝塔自动 reload nginx。

模板文件也在 [docker/nginx/native-bt-vhost.example.conf](docker/nginx/native-bt-vhost.example.conf)。

### 6.4 验证 HTTPS 通

浏览器开 `https://api.你的域名.com/` 应该返回欢迎 JSON。

如果报 502/504：99% 是 PM2 进程没起来 / 4200 端口没监听 / 宝塔的 Nginx 没开。

---

## 🔌 第 7 步：客户端连你的服务器

打开 BilldDesk 客户端 → 设置 → 接口配置 → 修改：

```
wss:    wss://api.你的域名.com
axios:  https://api.你的域名.com
```

重启客户端。如果一切正常，状态栏会显示已连接，能看到自己的设备码。

---

## ✅ 验证清单

| 检查项 | 命令 / 方法 |
|---|---|
| PM2 进程 online | `pm2 status` |
| 4200 监听 | `netstat -ano \| findstr :4200` 有 LISTENING |
| API 通 | 浏览器开 `http://127.0.0.1:4200/` 有欢迎 JSON |
| HTTPS 通 | 浏览器开 `https://api.你的域名.com/` 有欢迎 JSON |
| WSS 通 | 客户端 F12 控制台无 socket 错 |
| MySQL 表 | 宝塔 → 数据库 → billd_desk → 管理，看到 30+ 张表 |
| Redis 通 | `redis-cli ping` 返回 PONG |
| 远控走得通 | 两台机都连上，发起远程能看画面 |
| 开机自启 | 重启服务器，PM2 自动起，4200 自动监听 |

---

## 🔧 常用运维命令

```cmd
:: 看进程
pm2 status

:: 看实时日志
pm2 logs billd-desk-server
pm2 logs billd-desk-server --lines 200

:: 重启（改了代码 / secret.ts 后）
pm2 reload billd-desk-server

:: 停止
pm2 stop billd-desk-server

:: 完全删除（不会触发自启）
pm2 delete billd-desk-server

:: 查内存 / CPU 使用
pm2 monit

:: 查 PM2 自身的状态
pm2-startup status
```

---

## 🆘 常见坑

| 现象 | 原因 / 处理 |
|---|---|
| `pnpm i` 卡在 sharp / bcrypt 编译 | 装 `windows-build-tools`；或 `set npm_config_build_from_source=false` 走预编译 |
| `pnpm run build` 报 TS 错 | 检查 secret.ts 是否有未填的字段；用 `pnpm run typecheck` 看具体错误 |
| PM2 启动后立刻挂 | `pm2 logs` 看错误，多半是 MySQL/Redis 连不上。检查端口、密码、防火墙 |
| MySQL 报 "Access denied" | secret.ts 里的 user/password 和宝塔建的对不上 |
| MySQL 字符集报错 | 必须 utf8mb4，宝塔建库时设错就重建 |
| Redis "WRONGTYPE Operation" | 重启 Redis 清掉旧 key：`redis-cli FLUSHDB`（注意会丢所有缓存） |
| Nginx 502 Bad Gateway | PM2 进程没起；或 4200 没监听 |
| WSS 握手 400 | Nginx 漏配 `Upgrade` / `Connection` 头 |
| 重启服务器后 PM2 没自启 | `pm2-startup install` 没跑成功；管理员 cmd 重跑一次，然后 `pm2 save` |
| 改了 ecosystem.config.cjs 不生效 | `pm2 reload ecosystem.config.cjs` |

---

## 🛡 备份

宝塔自带定时任务 + 数据库备份：

宝塔 → 计划任务 → 添加：
- 任务类型：备份数据库
- 名称：billd_desk_daily
- 执行周期：每天 03:00
- 备份保留：14 份
- 备份的数据库：billd_desk

整目录备份（含 secret.ts）：
```cmd
:: 用宝塔的"备份网站"功能不行，因为站点根目录不是这里
:: 手动 PowerShell：
Compress-Archive -Path C:\www\BilldDesk\server -DestinationPath C:\backup\billd-desk-server-$(Get-Date -Format yyyyMMdd).zip
```

---

## 📊 2H4G 占用预估（PM2 + native 软件）

| 进程 | 内存 | CPU |
|---|---|---|
| `mysqld.exe` | ~200MB | <2% |
| `redis-server.exe` | ~10MB | <1% |
| `node.exe`（PM2 主） | ~30MB | <1% |
| `node.exe`（server worker） | ~180-300MB | 1-5%（会话中升） |
| `nginx.exe` | ~10MB | <1% |
| **总计** | **~430-550MB** | **~5% 稳态** |

剩余 3.5GB+ RAM 给 Windows + Buffer。**比 Docker 方案省 ~250MB**（没有 WSL2 虚拟化层）。

---

## 🔄 想换 Docker 怎么办？

```cmd
:: 停 PM2
pm2 stop billd-desk-server
pm2 delete billd-desk-server

:: 备份数据
:: 宝塔 → 数据库 → 备份

:: 跟着 DOCKER_DEPLOY.md 走
```

数据库导出导入即可保留远控历史 / 用户。
