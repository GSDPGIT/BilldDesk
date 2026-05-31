// Agent (被控端) 控制器
// 接口：
//   POST /agent/register          —— 注册（agent 启动时调）
//   POST /agent/heartbeat         —— 心跳
//   GET  /agent/list              —— 列出所有 agent（主控端查）
//   GET  /agent/:id               —— 取单个 agent 详情
//   GET  /agent/config_for_me     —— agent 拉自己的 custom_config（带 device_id query）
//   POST /agent/:id/config        —— 主控端推送配置
//   DELETE /agent/:id             —— 删除一台 agent

import { ParameterizedContext } from 'koa';

import successHandler from '@/app/handler/success-handle';
import { COMMON_HTTP_CODE } from '@/constant';
import { CustomError } from '@/model/customError.model';
import agentService from '@/service/agent.service';
import {
  IAgentConfigPushReq,
  IAgentHeartbeatReq,
  IAgentRegisterReq,
} from '@/types/IAgent';

class AgentController {
  register = async (ctx: ParameterizedContext, next) => {
    const body = ctx.request.body as IAgentRegisterReq;
    if (!body?.device_id || !body?.hostname || !body?.platform) {
      throw new CustomError(
        'device_id / hostname / platform 必填',
        COMMON_HTTP_CODE.paramsError,
        COMMON_HTTP_CODE.paramsError
      );
    }
    // 从 ctx.ip 自动取公网 IP；nginx 反代后需要在 nginx.conf 配 X-Real-IP（已配）
    const publicIp = ctx.ip || '';
    const data = await agentService.register({ ...body, public_ip: publicIp });
    successHandler({ ctx, data });
    await next();
  };

  heartbeat = async (ctx: ParameterizedContext, next) => {
    const body = ctx.request.body as IAgentHeartbeatReq;
    if (!body?.device_id) {
      throw new CustomError(
        'device_id 必填',
        COMMON_HTTP_CODE.paramsError,
        COMMON_HTTP_CODE.paramsError
      );
    }
    const ok = await agentService.heartbeat(body.device_id, body.socket_id);
    if (!ok) {
      // 没找到 agent 记录 —— 让 agent 自动重新 register
      successHandler({
        ctx,
        data: { ok: false, action: 'reregister' },
      });
    } else {
      successHandler({ ctx, data: { ok: true } });
    }
    await next();
  };

  list = async (ctx: ParameterizedContext, next) => {
    const data = await agentService.list();
    successHandler({ ctx, data });
    await next();
  };

  detail = async (ctx: ParameterizedContext, next) => {
    const id = Number(ctx.params.id);
    if (!id) {
      throw new CustomError(
        'id 必填',
        COMMON_HTTP_CODE.paramsError,
        COMMON_HTTP_CODE.paramsError
      );
    }
    const data = await agentService.findById(id);
    if (!data) {
      throw new CustomError(
        'agent 不存在',
        COMMON_HTTP_CODE.notFound,
        COMMON_HTTP_CODE.notFound
      );
    }
    successHandler({ ctx, data });
    await next();
  };

  /** agent 自己拉自己的 config（用 device_id 查） */
  configForMe = async (ctx: ParameterizedContext, next) => {
    const deviceId = (ctx.request.query.device_id as string) || '';
    if (!deviceId) {
      throw new CustomError(
        'device_id 必填',
        COMMON_HTTP_CODE.paramsError,
        COMMON_HTTP_CODE.paramsError
      );
    }
    const row = await agentService.findByDeviceId(deviceId);
    if (!row) {
      successHandler({ ctx, data: { custom_config: {} } });
      await next();
      return;
    }
    successHandler({
      ctx,
      data: {
        custom_config: row.custom_config || {},
        nickname: row.nickname,
      },
    });
    await next();
  };

  /** 主控端推送配置 */
  updateConfig = async (ctx: ParameterizedContext, next) => {
    const id = Number(ctx.params.id);
    if (!id) {
      throw new CustomError(
        'id 必填',
        COMMON_HTTP_CODE.paramsError,
        COMMON_HTTP_CODE.paramsError
      );
    }
    const body = ctx.request.body as IAgentConfigPushReq;
    const data = await agentService.updateConfig(id, body);
    if (!data) {
      throw new CustomError(
        'agent 不存在',
        COMMON_HTTP_CODE.notFound,
        COMMON_HTTP_CODE.notFound
      );
    }
    successHandler({ ctx, data });
    await next();
  };

  delete = async (ctx: ParameterizedContext, next) => {
    const id = Number(ctx.params.id);
    if (!id) {
      throw new CustomError(
        'id 必填',
        COMMON_HTTP_CODE.paramsError,
        COMMON_HTTP_CODE.paramsError
      );
    }
    const ok = await agentService.delete(id);
    successHandler({ ctx, data: { deleted: ok } });
    await next();
  };
}

export default new AgentController();
