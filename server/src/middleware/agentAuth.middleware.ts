// Agent API_KEY 鉴权中间件
// 所有 /agent/* 接口必须在请求头里带 X-Agent-Key
import { ParameterizedContext } from 'koa';

import { COMMON_HTTP_CODE } from '@/constant';
import { AGENT_API_KEY } from '@/secret/agent-key';

export async function agentAuthMiddleware(
  ctx: ParameterizedContext,
  next: () => Promise<any>
) {
  const provided = (ctx.headers['x-agent-key'] ||
    ctx.headers['X-Agent-Key']) as string | undefined;
  if (!provided || provided !== AGENT_API_KEY) {
    ctx.status = COMMON_HTTP_CODE.unauthorized;
    ctx.body = {
      code: COMMON_HTTP_CODE.unauthorized,
      message: 'Invalid or missing X-Agent-Key header',
    };
    return;
  }
  await next();
}
