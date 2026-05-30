# SSL 证书放这里

把 Let's Encrypt 或其他来源的证书拷到本目录：

```
docker/nginx/cert/
├── fullchain.pem   # 完整证书链
└── privkey.pem     # 私钥
```

## 从宝塔申请证书后拷过来

宝塔 → 网站 → 你的域名 → SSL → Let's Encrypt → 申请

成功后宝塔会把证书放在：
```
C:\BtSoft\panel\vhost\cert\你的域名\fullchain.pem
C:\BtSoft\panel\vhost\cert\你的域名\privkey.pem
```

把这两个文件拷到 `docker/nginx/cert/` 即可。

或者用 `mklink`（管理员 cmd）：

```cmd
mklink "C:\www\BilldDesk\server\docker\nginx\cert\fullchain.pem" "C:\BtSoft\panel\vhost\cert\你的域名\fullchain.pem"
mklink "C:\www\BilldDesk\server\docker\nginx\cert\privkey.pem"   "C:\BtSoft\panel\vhost\cert\你的域名\privkey.pem"
```

## 想用 certbot 容器自动续签

参考 `docker-compose.certbot.yml`（如果以后我们加）。
