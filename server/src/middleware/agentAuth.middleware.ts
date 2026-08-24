// Agent 鉴权中间件（分权版）
//   agentAuthMiddleware —— 低权，校验 X-Agent-Key === AGENT_API_KEY
//     用于 agent 自身接口：register / heartbeat / config_for_me
//   agentAdminMiddleware —— 高权，校验 X-Agent-Admin-Key === AGENT_ADMIN_KEY
//     用于主控端接口：list / :id / :id/config / delete
// 分权目的：agent 产物里只带低权 key，一旦泄露也无法枚举/控制/删除整个 fleet。
import { ParameterizedContext } from 'koa';

import { COMMON_HTTP_CODE } from '@/constant';
import { AGENT_API_KEY, AGENT_ADMIN_KEY } from '@/secret/agent-key';

// 常量时间比较，防时序侧信道
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function deny(ctx: ParameterizedContext, msg: string) {
  ctx.status = COMMON_HTTP_CODE.unauthorized;
  ctx.body = { code: COMMON_HTTP_CODE.unauthorized, message: msg };
}

export async function agentAuthMiddleware(
  ctx: ParameterizedContext,
  next: () => Promise<any>
) {
  const provided = ctx.headers['x-agent-key'] as string | undefined;
  if (!provided || !safeEqual(provided, AGENT_API_KEY)) {
    deny(ctx, 'Invalid or missing X-Agent-Key header');
    return;
  }
  await next();
}

export async function agentAdminMiddleware(
  ctx: ParameterizedContext,
  next: () => Promise<any>
) {
  const provided = ctx.headers['x-agent-admin-key'] as string | undefined;
  if (!provided || !safeEqual(provided, AGENT_ADMIN_KEY)) {
    deny(ctx, 'Invalid or missing X-Agent-Admin-Key header');
    return;
  }
  await next();
}
