# BilldDesk Server 多阶段构建
# 镜像最终大小 ~250MB（vs 单阶段 ~1.2GB）

# ===== 阶段 1：依赖安装 =====
FROM node:18.19.0-alpine AS deps
WORKDIR /app

# 国内服务器加速：用 npmmirror（如果在国外把下面 RUN 注释掉）
RUN npm config set registry https://registry.npmmirror.com && \
    npm i -g pnpm@9

COPY package.json pnpm-lock.yaml .npmrc ./
# 装全部依赖（含 dev，build 要用）
RUN pnpm install --frozen-lockfile --prefer-offline

# ===== 阶段 2：构建 =====
FROM node:18.19.0-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 注意：secret.ts 在运行时通过 volume 挂载，构建时用占位
# 如果 secret.ts 不存在，从 example 拷一份临时 build 用的
RUN if [ ! -f src/secret/secret.ts ]; then \
      cp src/secret/secret.example.ts src/secret/secret.ts; \
    fi

RUN npm i -g pnpm@9 && pnpm run build

# 清掉 dev 依赖
RUN pnpm prune --prod

# ===== 阶段 3：运行时 =====
FROM node:18.19.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NODE_APP_RELEASE_PROJECT_NAME=billd-desk-server \
    NODE_APP_RELEASE_PROJECT_ENV=prod \
    NODE_APP_RELEASE_PROJECT_PORT=4200 \
    TZ=Asia/Shanghai

# 时区 + curl（健康检查）
RUN apk add --no-cache curl tzdata && \
    cp /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo $TZ > /etc/timezone

# 非 root 用户跑（安全）
RUN addgroup -g 1001 -S nodejs && \
    adduser -S billd -u 1001 -G nodejs

COPY --from=builder --chown=billd:nodejs /app/dist ./dist
COPY --from=builder --chown=billd:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=billd:nodejs /app/package.json ./
COPY --from=builder --chown=billd:nodejs /app/public ./public

# secret.ts 在 entrypoint 校验并由 volume 挂载注入到 dist/secret/secret.js
# 这里建空目录占位
RUN mkdir -p /app/dist/secret && \
    mkdir -p /app/upload && \
    mkdir -p /app/webm && \
    chown -R billd:nodejs /app

USER billd

EXPOSE 4200

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fs http://localhost:4200/ || exit 1

# 直接跑构建产物，不走 nodemon
CMD ["node", "dist/index.js"]
