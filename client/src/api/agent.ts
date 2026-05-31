// Agent 系统专用 API（带 X-Agent-Key 鉴权头）
// 主控端调 list / config，agent 调 register / heartbeat / config_for_me
import axios, { AxiosRequestConfig } from 'axios';

import {
  AGENT_API_KEY,
  HARDCODED_AXIOS_URL,
} from '@/build-config';

interface IAgentResp<T = any> {
  code: number;
  data?: T;
  message?: string;
}

interface IAgentRow {
  id: number;
  device_id: string;
  hostname?: string;
  platform?: string;
  os_version?: string;
  public_ip?: string;
  local_ip?: string;
  agent_version?: string;
  registered_at?: string;
  last_heartbeat?: string;
  is_online?: boolean;
  custom_config?: Record<string, any>;
  nickname?: string;
  socket_id?: string;
}

function req<T = any>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  payload?: any,
  query?: any
): Promise<IAgentResp<T>> {
  const url = `${HARDCODED_AXIOS_URL}${path}`;
  const cfg: AxiosRequestConfig = {
    method,
    url,
    headers: { 'X-Agent-Key': AGENT_API_KEY },
    timeout: 10000,
  };
  if (query) cfg.params = query;
  if (payload) cfg.data = payload;
  return axios(cfg).then((r) => r.data);
}

// ====== agent 端调 ======

export function agentRegister(payload: {
  device_id: string;
  hostname: string;
  platform: string;
  os_version?: string;
  local_ip?: string;
  agent_version?: string;
}) {
  return req<IAgentRow>('POST', '/agent/register', payload);
}

export function agentHeartbeat(payload: {
  device_id: string;
  socket_id?: string;
}) {
  return req<{ ok: boolean; action?: string }>(
    'POST',
    '/agent/heartbeat',
    payload
  );
}

export function agentConfigForMe(deviceId: string) {
  return req<{ custom_config: Record<string, any>; nickname?: string }>(
    'GET',
    '/agent/config_for_me',
    undefined,
    { device_id: deviceId }
  );
}

// ====== 主控端调 ======

export function agentList() {
  return req<IAgentRow[]>('GET', '/agent/list');
}

export function agentDetail(id: number) {
  return req<IAgentRow>('GET', `/agent/${id}`);
}

export function agentUpdateConfig(
  id: number,
  payload: { custom_config?: Record<string, any>; nickname?: string }
) {
  return req<IAgentRow>('POST', `/agent/${id}/config`, payload);
}

export function agentDelete(id: number) {
  return req<{ deleted: boolean }>('DELETE', `/agent/${id}`);
}

export type { IAgentRow, IAgentResp };
