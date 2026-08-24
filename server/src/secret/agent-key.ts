// Agent 认证密钥（GSDPGIT 自部署）—— 从环境变量注入，禁止硬编码提交
// ============================================================
// 历史教训：旧版把明文 key 直接写在这里并被提交进【公开】仓库 → 全 fleet 暴露。
// 现在：值只从 process.env 读；本文件不含任何真实密钥，可安全提交。
// 真实值放 server/.env（已 gitignore），或部署环境变量里。
//
// 两把 key 分权（降低泄露爆炸半径）：
//   AGENT_API_KEY   —— 低权：只够 agent 注册/心跳/拉自己的配置（/agent/register|heartbeat|config_for_me）
//   AGENT_ADMIN_KEY —— 高权：主控端枚举/配置/删除全 fleet（/agent/list|:id|:id/config|delete）
//                      绝不编译进 agent 产物，只给主控端 / 运维手里。
// 轮换：改 .env 的值 → 重启服务端 + 重新编译主控端/agent。
// ============================================================

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length < 32) {
    throw new Error(
      `[secret] 环境变量 ${name} 未设置或过短（需 >=32 字符）。` +
        `用 \`openssl rand -hex 32\` 生成后写进 server/.env`
    );
  }
  return v;
}

export const AGENT_API_KEY = required('BILLD_AGENT_API_KEY');
export const AGENT_ADMIN_KEY = required('BILLD_AGENT_ADMIN_KEY');

// agent 心跳超时阈值（秒）
export const AGENT_OFFLINE_TIMEOUT_SEC = 90;
