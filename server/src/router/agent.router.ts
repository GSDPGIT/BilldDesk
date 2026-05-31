// Agent 路由
// 所有接口都需要 X-Agent-Key 头鉴权
import Router from 'koa-router';

import agentController from '@/controller/agent.controller';
import { agentAuthMiddleware } from '@/middleware/agentAuth.middleware';

const agentRouter = new Router({ prefix: '/agent' });

// 全路由前置鉴权
agentRouter.use(agentAuthMiddleware);

// agent 端调
agentRouter.post('/register', agentController.register);
agentRouter.post('/heartbeat', agentController.heartbeat);
agentRouter.get('/config_for_me', agentController.configForMe);

// 主控端调
agentRouter.get('/list', agentController.list);
agentRouter.get('/:id(\\d+)', agentController.detail);
agentRouter.post('/:id(\\d+)/config', agentController.updateConfig);
agentRouter.delete('/:id(\\d+)', agentController.delete);

export default agentRouter;
