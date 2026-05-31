// Agent 认证共享密钥（GSDPGIT 自部署）
// ====================================
// 主控端 + 所有 agent (被控端) 编译时都用同一个密钥，作为 API_KEY 鉴权
// 服务端拿来校验所有 /agent/* 接口请求的 X-Agent-Key 头
// ====================================
//
// ⚠️ 重要：这个文件包含敏感信息！
// - 在自部署 fork 里可以直接提交（你的私有 repo）
// - 在公开 fork / 上游里必须 gitignore + 通过环境变量注入
// - 想轮换密钥：改这里的值 → 重新编译服务端 + 主控端 + 所有 agent

export const AGENT_API_KEY =
  'c6aed1f8702016f298c7bb3dda70269379a663e97f1d0c8e3e15a2825a6fa1a5';

// agent 心跳超时阈值（秒）—— 超过这个时间未收到心跳认为 agent 离线
export const AGENT_OFFLINE_TIMEOUT_SEC = 90;
