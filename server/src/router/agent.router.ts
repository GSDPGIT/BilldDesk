// Agent 路由（分权）
//   agent 端接口：低权 X-Agent-Key
//   主控端接口：高权 X-Agent-Admin-Key
import Router from 'koa-router';

import agentController from '@/controller/agent.controller';
import {
  agentAuthMiddleware,
  agentAdminMiddleware,
} from '@/middleware/agentAuth.middleware';

const agentRouter = new Router({ prefix: '/agent' });

// ---- agent 端（低权）----
agentRouter.post('/register', agentAuthMiddleware, agentController.register);
agentRouter.post('/heartbeat', agentAuthMiddleware, agentController.heartbeat);
agentRouter.get('/config_for_me', agentAuthMiddleware, agentController.configForMe);

// ---- 主控端（高权，agent 产物里没有这把 key）----
agentRouter.get('/list', agentAdminMiddleware, agentController.list);
agentRouter.get('/:id(\\d+)', agentAdminMiddleware, agentController.detail);
agentRouter.post('/:id(\\d+)/config', agentAdminMiddleware, agentController.updateConfig);
agentRouter.delete('/:id(\\d+)', agentAdminMiddleware, agentController.delete);

export default agentRouter;
