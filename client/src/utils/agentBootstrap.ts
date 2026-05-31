// Agent 端启动引导：注册 / 心跳 / 拉配置 / 应用配置
// 仅在 IS_AGENT_BUILD 为 true 时启用
import {
  AGENT_VERSION,
  IS_AGENT_BUILD,
} from '@/build-config';
import {
  agentConfigForMe,
  agentHeartbeat,
  agentRegister,
} from '@/api/agent';
import { IPC_EVENT } from '@/event';

const STORE_KEY = 'agent_device_id';
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30s
const CONFIG_POLL_INTERVAL_MS = 60 * 1000; // 60s

function getIpc(): any {
  return (window as any).electronAPI?.ipcRenderer;
}

/** 生成或读取持久化 device_id（localStorage） */
function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(STORE_KEY);
  if (id && id.length >= 16) return id;
  // 用 crypto.randomUUID 生成（Electron 内 Chromium 都支持）
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    id = crypto.randomUUID();
  } else {
    // 退化：时间戳 + 随机
    id =
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 18);
  }
  localStorage.setItem(STORE_KEY, id);
  return id;
}

/** 从主进程拿系统信息（hostname / platform / OS / local_ip） */
async function getSystemInfo(): Promise<{
  hostname: string;
  platform: string;
  os_version: string;
  local_ip: string;
}> {
  const ipc = getIpc();
  if (ipc?.invoke) {
    try {
      const res: any = await ipc.invoke('agent_get_system_info');
      if (res?.code === 0 && res.data) return res.data;
      if (res?.hostname) return res; // 兼容直接返回对象
    } catch (e) {
      console.warn('[agent] getSystemInfo via IPC failed', e);
    }
  }
  return {
    hostname: 'unknown',
    platform: 'unknown',
    os_version: 'unknown',
    local_ip: 'unknown',
  };
}

/** 应用从服务端拉到的 config（lockOnDisconnect / privacyMode 等） */
async function applyConfig(config: Record<string, any>): Promise<void> {
  const ipc = getIpc();
  if (!ipc?.invoke) return;

  try {
    if (config.lockOnDisconnect !== undefined) {
      await ipc.invoke(IPC_EVENT.silent_lockOnDisconnect, {
        enabled: !!config.lockOnDisconnect,
      });
    }
  } catch (e) {
    console.warn('[agent] apply lockOnDisconnect failed', e);
  }

  try {
    if (config.privacyMode === true) {
      await ipc.invoke(IPC_EVENT.silent_privacyMode, {
        alsoLock: config.privacyAlsoLock !== false,
        text: config.privacyText,
      });
    } else if (config.privacyMode === false) {
      await ipc.invoke(IPC_EVENT.silent_privacyMode_off);
    }
  } catch (e) {
    console.warn('[agent] apply privacyMode failed', e);
  }
}

let bootstrapped = false;
let deviceId = '';

/** 启动 agent 引导。多次调用幂等 */
export async function startAgentBootstrap(): Promise<void> {
  if (!IS_AGENT_BUILD) return;
  if (bootstrapped) return;
  bootstrapped = true;

  deviceId = getOrCreateDeviceId();
  console.log('[agent] device_id =', deviceId);

  // 同步成 BilldDesk 的 deskUserUuid，让主控端走现有 WebRTC 流程能找到我们
  try {
    localStorage.setItem('deskUserUuid', deviceId);
  } catch (e) {
    /* ignore */
  }

  // 注册
  try {
    const info = await getSystemInfo();
    const res = await agentRegister({
      device_id: deviceId,
      hostname: info.hostname,
      platform: info.platform,
      os_version: info.os_version,
      local_ip: info.local_ip,
      agent_version: AGENT_VERSION,
    });
    console.log('[agent] register:', res?.code, res?.data?.id);
  } catch (e: any) {
    console.error('[agent] register failed:', e?.message || e);
  }

  // 立即拉一次 config 应用
  try {
    const cfg = await agentConfigForMe(deviceId);
    await applyConfig(cfg?.data?.custom_config || {});
  } catch (e: any) {
    console.warn('[agent] initial config fetch failed', e?.message || e);
  }

  // 心跳循环
  setInterval(async () => {
    try {
      const res = await agentHeartbeat({ device_id: deviceId });
      if (res?.data?.action === 'reregister') {
        // 服务端表里找不到，重新注册（防数据库被清）
        const info = await getSystemInfo();
        await agentRegister({
          device_id: deviceId,
          hostname: info.hostname,
          platform: info.platform,
          os_version: info.os_version,
          local_ip: info.local_ip,
          agent_version: AGENT_VERSION,
        });
      }
    } catch (e: any) {
      console.warn('[agent] heartbeat failed', e?.message || e);
    }
  }, HEARTBEAT_INTERVAL_MS);

  // 配置轮询循环
  setInterval(async () => {
    try {
      const cfg = await agentConfigForMe(deviceId);
      await applyConfig(cfg?.data?.custom_config || {});
    } catch (e) {
      /* ignore */
    }
  }, CONFIG_POLL_INTERVAL_MS);
}

export function getAgentDeviceId(): string {
  return deviceId || getOrCreateDeviceId();
}
