// BilldDesk Server - Docker 部署专用 secret 模板
// 用法：
//   cp src/secret/secret.docker.example.ts src/secret/secret.ts
//   编辑 secret.ts 把 TODO_ 项目改成你的值
//
// 关键差异（vs secret.example.ts）：
//   - MySQL host = 'mysql' （Docker 服务名，不是 127.0.0.1）
//   - Redis host = 'redis'
//   - 与 docker-compose.yml 里的 service 名字必须一致

import { PROJECT_ENV, PROJECT_ENV_ENUM } from '../constant';
import { prodDomain } from '../spec-config';

// ============ 必填 ============

export const JWT_SECRET = 'TODO_CHANGE_ME_RANDOM_64_CHARS'; // openssl rand -hex 32

export const MYSQL_CONFIG = {
  docker: {
    container: 'billd-desk-mysql',
    image: 'mysql:8.0',
    port: { 3306: 3306 },
    MYSQL_ROOT_PASSWORD: 'TODO_change_me_same_as_compose_env',
    volume: '/var/lib/mysql',
  },
  database: 'billd_desk',
  // 关键：Docker 网络内通过服务名访问，不是 127.0.0.1
  host: 'mysql',
  port: 3306,
  username: 'root',
  // 必须和 docker-compose.yml 的 MYSQL_ROOT_PASSWORD 一致
  password: 'TODO_change_me_same_as_compose_env',
};

export enum REDIS_DATABASE {
  blog,
  live,
}

export const REDIS_CONFIG = {
  docker: {
    container: 'billd-desk-redis',
    image: 'redis:7-alpine',
    port: { 6379: 6379 },
    volume: '/data',
  },
  database: 0,
  socket: {
    port: 6379,
    host: 'redis', // 同样：Docker 网络内
  },
  username: '',
  password: '', // 如启用 requirepass，填这里
};

// ============ 自有服务器 IP（白名单用） ============
// Docker 里就填 server 容器看到的入口 IP；通常宿主机的公网 IP 即可

export const IP_URL = {
  tencent: {
    localIp: 'localhost',
    serverIp: 'TODO_your_server_public_ip',
  },
  ali: {
    localIp: 'localhost',
    serverIp: 'TODO_your_server_public_ip',
  },
};

export const IP_WHITE_LIST = [IP_URL.tencent.serverIp, IP_URL.ali.serverIp];

// ============ 以下为已禁用模块的占位符（router 已在 router/index.ts 黑名单中） ============

export const QQ_CLIENT_ID = 'disabled';
export const QQ_CLIENT_SECRET = 'disabled';
export const QQ_REDIRECT_URI = `https://${prodDomain}/qq`;
export const WECHAT_APPID = 'disabled';
export const WECHAT_SECRET = 'disabled';
export const WECHAT_REDIRECT_URI = 'https://disabled.example.com/wx';
export const QINIU_ACCESSKEY = 'disabled';
export const QINIU_SECRETKEY = 'disabled';
export const QINIU_PILI_LIVE = {
  RTMPPublishDomain: 'disabled',
  Hub: 'disabled',
  PublishKey: 'disabled',
};
export const TENCENTCLOUD_APPID = 0;
export const TENCENTCLOUD_SECRETID = 'disabled';
export const TENCENTCLOUD_SECRETKEY = 'disabled';
export const TENCENTCLOUD_LIVE = {
  PushDomain: 'disabled',
  PullDomain: 'disabled',
  AppName: 'live',
  Key: 'disabled',
};
export const SRS_CONFIG = {
  docker: {
    container: 'billd-desk-srs',
    image: 'registry.cn-hangzhou.aliyuncs.com/ossrs/srs:5.0.200',
    port: { 1935: 1935, 8080: 5001, 1985: 1985, 8000: 8000 },
    volume: '/usr/local/srs',
  },
  CANDIDATE: '127.0.0.1',
};
export const RABBITMQ_CONFIG = {
  docker: {
    container: 'billd-desk-rabbitmq',
    image: 'rabbitmq:3.11-management',
    port: { 5672: 5672, 15672: 15672 },
  },
};
export const ALIPAY_LIVE_CONFIG = {
  appId: 'disabled',
  privateKey: 'disabled',
  alipayPublicKey: 'disabled',
  gateway: 'https://openapi.alipay.com/gateway.do',
};
export const SERVER_LIVE = {
  PushDomain: 'rtmp://disabled',
  PullDomain: 'http://disabled',
  AppName: 'live',
};
export const BILIBILI_LIVE_PUSH_KEY = '';
export const DOUYU_LIVE_PUSH_KEY = '';
export const HUYA_LIVE_PUSH_KEY = '';
