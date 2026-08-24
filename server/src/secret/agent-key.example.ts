// 模板：拷成 agent-key.ts？不需要 —— agent-key.ts 现在只读 env。
// 你要做的是把下面两行写进 server/.env（已 gitignore）：
//   BILLD_AGENT_API_KEY=<openssl rand -hex 32 生成的低权 key>
//   BILLD_AGENT_ADMIN_KEY=<另一把 openssl rand -hex 32 生成的高权 key，两把必须不同>
export {};
