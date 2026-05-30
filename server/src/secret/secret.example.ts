// BilldDesk 远控部署专用 secret 模板（GSDPGIT fork）
// 用法：
//   1. cp src/secret/secret.example.ts src/secret/secret.ts
//   2. 把下方 TODO_ 开头的项目改成你自己的值
//   3. 涉及直播/支付/第三方登录的占位符已经填了无意义的字符串，让进程能起来即可，
//      因为对应的 router 已经在 router/index.ts 的 DISABLED_ROUTERS 里禁用，不会被调用。
//
// 安全提示：secret.ts 已加入 .gitignore，不会被提交。

import { PROJECT_ENV, PROJECT_ENV_ENUM } from '../constant';
import { prodDomain } from '../spec-config';

// ============ 必填 ============

export const JWT_SECRET = 'TODO_CHANGE_ME_RANDOM_64_CHARS'; // 用 `openssl rand -hex 32` 生成

export const MYSQL_CONFIG = {
  docker: {
    container: 'billd-desk-mysql',
    image: 'mysql:8.0',
    port: { 3306: 3306 },
    MYSQL_ROOT_PASSWORD: 'TODO_change_me',
    volume:
      PROJECT_ENV === PROJECT_ENV_ENUM.development
        ? '/tmp/billd-desk-mysql-dev'
        : '/data/billd-desk-mysql',
  },
  database: 'billd_desk',
  host: '127.0.0.1',
  port: 3306,
  username: 'root',
  password: 'TODO_change_me',
};

export enum REDIS_DATABASE {
  blog,
  live,
}

export const REDIS_CONFIG = {
  docker: {
    container: 'billd-desk-redis',
    image: 'redis:7.0',
    port: { 6379: 6379 },
    volume:
      PROJECT_ENV === PROJECT_ENV_ENUM.development
        ? '/tmp/billd-desk-redis-dev'
        : '/data/billd-desk-redis',
  },
  database: 0,
  socket: {
    port: 6379,
    host: '127.0.0.1',
  },
  username: '',
  password: '', // 宝塔 Redis 默认无密码；建议在 redis.conf 里加上 requirepass 然后填这里
};

// ============ 自有服务器 IP（白名单用） ============

export const IP_URL = {
  tencent: {
    localIp: 'localhost',
    serverIp: 'TODO_your_server_ip',
  },
  ali: {
    localIp: 'localhost',
    serverIp: 'TODO_your_server_ip',
  },
};

export const IP_WHITE_LIST = [IP_URL.tencent.serverIp, IP_URL.ali.serverIp];

// ============ 以下为禁用模块的占位符（router 已禁用，仅为通过类型检查） ============

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
    volume: '/tmp/billd-desk-srs',
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
