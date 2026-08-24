// Build-time 注入的常量
// 通过 vite.config.ts 的 define 把环境变量编译进 binary
// 用法：set BILLD_VARIANT=agent && pnpm run build:agent
//
// 类型声明（vite 编译时把 __XXX__ 替换成字面量）
declare const __BILLD_VARIANT__: 'agent' | 'master';
declare const __BILLD_WSS_URL__: string;
declare const __BILLD_AXIOS_URL__: string;
declare const __BILLD_COTURN_URL__: string;
declare const __BILLD_COTURN_USERNAME__: string;
declare const __BILLD_COTURN_CREDENTIAL__: string;
declare const __BILLD_AGENT_API_KEY__: string;
declare const __BILLD_AGENT_VERSION__: string;

export const BUILD_VARIANT: 'agent' | 'master' = __BILLD_VARIANT__;
export const IS_AGENT_BUILD = BUILD_VARIANT === 'agent';
export const IS_MASTER_BUILD = BUILD_VARIANT === 'master';

// 编译时写死的服务端 URL（agent 模式忽略用户设置）
export const HARDCODED_WSS_URL = __BILLD_WSS_URL__;
export const HARDCODED_AXIOS_URL = __BILLD_AXIOS_URL__;
export const HARDCODED_COTURN_URL = __BILLD_COTURN_URL__;
export const COTURN_USERNAME = __BILLD_COTURN_USERNAME__;
export const COTURN_CREDENTIAL = __BILLD_COTURN_CREDENTIAL__;

// Agent 鉴权密钥
export const AGENT_API_KEY = __BILLD_AGENT_API_KEY__;
export const AGENT_VERSION = __BILLD_AGENT_VERSION__;

// 一旦是 agent / master 任一固定 build，URL 配置都是只读不能改
export const URLS_LOCKED = IS_AGENT_BUILD || IS_MASTER_BUILD;
