import { Op } from 'sequelize';

import { AGENT_OFFLINE_TIMEOUT_SEC } from '@/secret/agent-key';
import agentModel from '@/model/agent.model';
import {
  IAgent,
  IAgentConfigPushReq,
  IAgentRegisterReq,
} from '@/types/IAgent';

class AgentService {
  /** 注册或更新（按 device_id upsert） */
  async register(
    data: IAgentRegisterReq & { public_ip?: string }
  ): Promise<IAgent> {
    const now = new Date();
    const existing = await agentModel.findOne({
      where: { device_id: data.device_id },
    });
    if (existing) {
      await existing.update({
        hostname: data.hostname,
        platform: data.platform,
        os_version: data.os_version,
        local_ip: data.local_ip,
        public_ip: data.public_ip,
        agent_version: data.agent_version,
        last_heartbeat: now,
      });
      return existing.toJSON();
    }
    const created = await agentModel.create({
      device_id: data.device_id,
      hostname: data.hostname,
      platform: data.platform,
      os_version: data.os_version,
      local_ip: data.local_ip,
      public_ip: data.public_ip,
      agent_version: data.agent_version,
      registered_at: now,
      last_heartbeat: now,
      custom_config: {},
    } as any);
    return created.toJSON();
  }

  /** 更新心跳时间 + socket_id */
  async heartbeat(deviceId: string, socketId?: string): Promise<boolean> {
    const [count] = await agentModel.update(
      {
        last_heartbeat: new Date(),
        ...(socketId ? { socket_id: socketId } : {}),
      } as any,
      { where: { device_id: deviceId } }
    );
    return count > 0;
  }

  /** 列出所有 agent，并计算 is_online */
  async list(): Promise<IAgent[]> {
    const rows = await agentModel.findAll({
      order: [['updated_at', 'DESC']],
    });
    const cutoff = new Date(Date.now() - AGENT_OFFLINE_TIMEOUT_SEC * 1000);
    return rows.map((r) => {
      const obj = r.toJSON() as IAgent;
      obj.is_online =
        !!obj.last_heartbeat && new Date(obj.last_heartbeat) > cutoff;
      return obj;
    });
  }

  /** 按 id 取一条 */
  async findById(id: number): Promise<IAgent | null> {
    const row = await agentModel.findByPk(id);
    return row ? row.toJSON() : null;
  }

  /** 按 device_id 取一条（agent 自己查自己的 config 用） */
  async findByDeviceId(deviceId: string): Promise<IAgent | null> {
    const row = await agentModel.findOne({
      where: { device_id: deviceId },
    });
    return row ? row.toJSON() : null;
  }

  /** 更新配置（merge 不是替换） */
  async updateConfig(
    id: number,
    data: IAgentConfigPushReq
  ): Promise<IAgent | null> {
    const row = await agentModel.findByPk(id);
    if (!row) return null;
    const currentConfig = (row.get('custom_config') as any) || {};
    const newConfig = data.custom_config
      ? { ...currentConfig, ...data.custom_config }
      : currentConfig;
    await row.update({
      custom_config: newConfig,
      ...(data.nickname !== undefined ? { nickname: data.nickname } : {}),
    } as any);
    return row.toJSON();
  }

  /** 删除 agent */
  async delete(id: number): Promise<boolean> {
    const count = await agentModel.destroy({ where: { id } });
    return count > 0;
  }

  /** 清理超时离线的 agent（可由定时任务调） */
  async pruneStale(beforeDate: Date): Promise<number> {
    return agentModel.destroy({
      where: { last_heartbeat: { [Op.lt]: beforeDate } },
    });
  }
}

export default new AgentService();
