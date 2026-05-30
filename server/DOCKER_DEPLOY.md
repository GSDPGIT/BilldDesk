# BilldDesk Server · 宝塔 Windows + Docker 一键部署

适用：Windows Server / Windows 10/11 + 宝塔Windows面板 + Docker 插件，2H4G 起步。

> 全程 ~30 分钟，不含域名 + SSL + 备案的等待时间。

---

## 🎯 总体流程

```
1. 装 Docker（5 分钟）
       ↓
2. 拉代码（1 分钟）
       ↓
3. 改 2 个配置文件（5 分钟）
       ↓
4. docker compose up -d（10 分钟，第一次拉镜像 + 构建慢）
       ↓
5. 初始化数据库（1 分钟）
       ↓
6. 客户端连上去（3 分钟）
```

---

## 📋 第 0 步：环境前置

| 你需要的 | 状态 |
|---|---|
| 一台 Windows Server 2H4G+ | ✅ 已有 |
| 宝塔 Windows 面板 | ✅ 已有 |
| 已备案的域名（可选） | ⚠️ 没备案就用非标端口 |
| Docker（下面装） | ⬜ |

---

## 🐳 第 1 步：装 Docker

宝塔 Windows 面板的 Docker 插件比较旧，**推荐直接装 Docker Desktop**。

### 1.1 装 Docker Desktop for Windows

下载：https://www.docker.com/products/docker-desktop/

安装时勾选：
- ✅ Use WSL 2 instead of Hyper-V
- ✅ Add shortcut to desktop

装完重启。开机后启动 Docker Desktop，等右下角图标变绿。

### 1.2 验证

打开 PowerShell：

```powershell
docker --version
docker compose version
```

两条都有版本号输出 = OK。

### 1.3 国内服务器加速（强烈推荐）

Docker Desktop → Settings → Docker Engine，在 JSON 里加：

```json
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.m.daocloud.io",
    "https://docker.xuanyuan.me"
  ]
}
```

Apply & Restart。

---

## 📦 第 2 步：拉代码

宝塔 → 文件 → 进入 `C:\www\`（或随便哪里），开终端：

```bash
cd C:\www
git clone https://github.com/GSDPGIT/BilldDesk.git
cd BilldDesk\server
```

---

## ⚙️ 第 3 步：配置 2 个文件

### 3.1 secret.ts（数据库密码、JWT 密钥）

```bash
# 在 server/ 目录下
copy src\secret\secret.docker.example.ts src\secret\secret.ts
notepad src\secret\secret.ts
```

只需要改 3 个值（都是 `TODO_` 开头的）：

| 字段 | 改成什么 |
|---|---|
| `JWT_SECRET` | 随机 64 字符（PowerShell 跑 `[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')` 拷贝结果） |
| `MYSQL_CONFIG.docker.MYSQL_ROOT_PASSWORD` | 一个强密码（比如 `Mn8!kP3#qR7$xL2`） |
| `MYSQL_CONFIG.password` | **和上面那个完全一样的密码** |
| `IP_URL.tencent.serverIp` / `ali.serverIp` | 你的服务器公网 IP |

### 3.2 .env（docker-compose 用的环境变量）

```bash
copy .env.example .env
notepad .env
```

| 字段 | 改成 |
|---|---|
| `MYSQL_ROOT_PASSWORD` | **必须和 secret.ts 里那个一模一样** |
| `HTTP_PORT` | 80（备案过域名）或 `8080`（没备案） |
| `HTTPS_PORT` | 443（备案过）或 `8443`（没备案） |

### 3.3（可选）SSL 证书

**没域名 / 没备案**：跳过这一步，先用 HTTP 端口测试通了再说。

**有域名 + 已备案**：
1. 在宝塔申请 Let's Encrypt 证书
2. 把宝塔生成的 `fullchain.pem` 和 `privkey.pem` 拷到 `server/docker/nginx/cert/`
3. 编辑 `server/docker/nginx/conf.d/default.conf`，把 `server_name _;` 改成你的域名

---

## 🚀 第 4 步：起容器

```bash
# 在 server/ 目录下
docker compose up -d
```

第一次跑会拉 mysql:8.0 / redis:7-alpine / nginx:1.25-alpine / node:18.19.0-alpine 镜像 + 构建 server 镜像，**5-10 分钟**。

跑完看状态：

```bash
docker compose ps
```

应该看到 4 个容器都是 `Up (healthy)`：

```
NAME                  STATUS
billd-desk-mysql      Up 2 minutes (healthy)
billd-desk-redis      Up 2 minutes (healthy)
billd-desk-server     Up 1 minute (healthy)
billd-desk-nginx      Up 1 minute
```

看 server 日志（确认 router 已加载、跳过的 17 个非远控 router）：

```bash
docker compose logs -f server
```

应该看到：

```
加载路由: deskUser.router.ts
加载路由: wsMessage.router.ts
...
已跳过 17 个非远控路由: live.router.ts, liveConfig.router.ts, ...
加载所有路由成功！
监听端口: 4200
项目启动成功！
```

---

## 🗄 第 5 步：初始化数据库表

**首次部署必须执行一次**（创建所有表 + 初始数据）：

```bash
docker compose exec server sh -c "NODE_APP_INIT_MYSQL=true node dist/index.js"
```

跑完会自动退出。再 `docker compose restart server` 让正常启动接管。

验证表是否建好：

```bash
docker compose exec mysql mysql -uroot -p${MYSQL_ROOT_PASSWORD} -e "USE billd_desk; SHOW TABLES;"
```

应该看到 30+ 张表。

---

## 🔌 第 6 步：客户端连你的服务器

打开 BilldDesk 客户端 → 设置 → 接口配置 → 修改：

**有域名 + SSL：**
```
wss:    wss://你的域名
axios:  https://你的域名
```

**没域名（用 IP + 非标端口）：**
```
wss:    ws://你的公网IP:8080
axios:  http://你的公网IP:8080
```

> ⚠️ 没 SSL 时 `ws://` 是明文，公网用不安全。仅适用于内网测试 / VPN 隧道场景。

---

## ✅ 验证清单

| 检查项 | 命令 / 方法 |
|---|---|
| 4 个容器都在跑 | `docker compose ps` |
| Server 健康 | 浏览器开 `http://你的IP:HTTP端口/`，看到 "欢迎访问 billd-desk-server" |
| WSS 通 | 客户端开 F12 控制台不报 socket 错 |
| MySQL 有数据 | `docker compose exec mysql mysql -uroot -p${MYSQL_ROOT_PASSWORD} -e "SELECT COUNT(*) FROM billd_desk.user;"` |
| Redis 通 | `docker compose exec redis redis-cli ping` 返回 `PONG` |
| 远控走得通 | 两台机都设置好，发起远程能看到画面 |

---

## 🔧 常用运维命令

```bash
# 看日志
docker compose logs -f                  # 全部
docker compose logs -f server           # 只看 server
docker compose logs --tail=100 nginx    # 看最近 100 行

# 重启
docker compose restart server           # 改了 secret.ts 后必跑
docker compose restart nginx            # 改了 nginx 配置后必跑

# 停止 / 启动
docker compose stop
docker compose start

# 完全销毁（保留 data/ 数据）
docker compose down

# 完全销毁 + 删数据（慎用）
docker compose down -v
rm -rf data/

# 升级（拉最新代码后）
git pull
docker compose build server
docker compose up -d

# 进容器排查
docker compose exec server sh
docker compose exec mysql mysql -uroot -p${MYSQL_ROOT_PASSWORD}
docker compose exec redis redis-cli
```

---

## 🆘 常见坑

| 现象 | 原因 / 处理 |
|---|---|
| `docker compose up` 卡在 build server 阶段 | 国内服务器没配 npmmirror，等很久。Ctrl+C，参考 §1.3 配 registry-mirrors |
| Server 启动报 "secret.ts not found" | 没拷 `secret.docker.example.ts` 为 `secret.ts`，或拷错位置 |
| Server 启动报 "Access denied for user 'root'" | secret.ts 里的密码和 .env 里的 `MYSQL_ROOT_PASSWORD` 不一致 |
| MySQL 容器一直 unhealthy | 第一次启动 mysql 初始化要 30-60s，等等再看 |
| Nginx 报 "cert not found" | 没拷 SSL 证书 + 没改 `default.conf` 注释掉 SSL 段 |
| 客户端 wss 连不上 | 99% 是端口被防火墙/安全组挡了；云厂商安全组要开 443 / 你设的 HTTPS_PORT |
| 装了备案的域名 80/443 仍然 403 | 域名解析没指对，或 nginx `server_name` 没改成你的域名 |
| MySQL 数据在 `server/data/mysql/`，怎么搬服务器 | 直接整包打包搬走，新机器解压后 `docker compose up -d` 就接着用 |

---

## 🛡 备份

### 数据库备份

```bash
docker compose exec mysql mysqldump -uroot -p${MYSQL_ROOT_PASSWORD} billd_desk > backup_$(Get-Date -Format yyyyMMdd).sql
```

宝塔可以定时任务：每天凌晨 3 点跑上面这条 → 上传到对象存储。

### 整库 + 配置备份

```bash
docker compose down
tar -czf billd-desk-backup-$(Get-Date -Format yyyyMMdd).tar.gz data/ src/secret/secret.ts .env docker/nginx/cert/
docker compose up -d
```

---

## 📊 资源监控

宝塔 Windows 面板首页能看到 CPU/内存/磁盘 走势。Docker 容器单独看：

```bash
docker stats
```

2H4G 实测稳态占用：
- mysql ~400MB RAM / 1-3% CPU
- redis ~30MB / <1% CPU
- server ~250MB / 1-5% CPU（远控会话时上升）
- nginx ~20MB / <1% CPU

**总计 ~700MB RAM + ~10% CPU 稳态**。剩 3GB+ RAM 给 Windows 自己 + 缓冲，2H4G 完全够。

---

## 🔄 不想要 Docker 了，怎么回退？

```bash
docker compose down
# 数据还在 server/data/，可以拷出来用 native MySQL 接管
```

然后参考主 README 里的 PM2 部署方式装 native Node + native MySQL + native Redis。
