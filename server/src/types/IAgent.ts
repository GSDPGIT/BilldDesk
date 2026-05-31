// Agent (被控端) 相关类型定义

export interface IAgent {
  id?: number;
  /** 设备唯一标识（agent 启动时基于硬件指纹/UUID 持久化生成） */
  device_id?: string;
  /** 计算机名 */
  hostname?: string;
  /** 平台：win32 / darwin / linux */
  platform?: string;
  /** OS 版本字符串 */
  os_version?: string;
  /** 公网 IP（服务端从请求 ctx.ip 自动填） */
  public_ip?: string;
  /** 内网 IP（agent 上报） */
  local_ip?: string;
  /** agent 客户端版本 */
  agent_version?: string;
  /** 注册时间 */
  registered_at?: Date;
  /** 上次心跳时间 */
  last_heartbeat?: Date;
  /** 由 last_heartbeat 计算得出，不入库 */
  is_online?: boolean;
  /** 配置 JSON（主控端可远程推送）；e.g. { lockOnDisconnect: true, privacyMode: false } */
  custom_config?: any;
  /** 用户自定义昵称（主控端 UI 用） */
  nickname?: string;
  /** 当前 socket.io 连接 ID（agent 在线时） */
  socket_id?: string;
}

/** agent 注册请求体 */
export interface IAgentRegisterReq {
  device_id: string;
  hostname: string;
  platform: string;
  os_version?: string;
  local_ip?: string;
  agent_version?: string;
}

/** agent 心跳请求体 */
export interface IAgentHeartbeatReq {
  device_id: string;
  socket_id?: string;
}

/** 主控端推送配置请求体 */
export interface IAgentConfigPushReq {
  custom_config?: Record<string, any>;
  nickname?: string;
}
