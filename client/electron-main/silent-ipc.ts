// 静默模式新增的 IPC 接线：锁屏、关显示器、隐私模式、退出远控时锁屏、强制退出
// 渲染进程通过 IPC_EVENT.silent_xxx 调过来
import fs from 'fs';
import path from 'path';

import { app, ipcMain } from 'electron';

import {
  getRendererHeartbeatPath,
  getSilentDir,
  isSilent,
  permitSilentExit,
} from './silent-mode';
import { isPrivacyWindowActive } from './privacy-window';
import {
  lockWorkstation,
  monitorOff,
  privacyMode,
  privacyModeOff,
} from './win32-actions';

// 事件名常量（同步在 src/event.ts 里也加一份，保持单一来源）
export const SILENT_IPC = {
  silentLockWorkstation: 'silent_lockWorkstation',
  silentMonitorOff: 'silent_monitorOff',
  silentPrivacyMode: 'silent_privacyMode',
  silentPrivacyModeGet: 'silent_privacyMode_get',
  silentLockOnDisconnect: 'silent_lockOnDisconnect', // 旧 IPC：{enabled:bool} 设置开关
  silentLockOnDisconnectGet: 'silent_lockOnDisconnect_get', // 查询当前开关
  silentExit: 'silent_exit',
  silentRendererPing: 'silent_renderer_ping',
  silentPrivacyModeOff: 'silent_privacyMode_off',
  silentRemoteDisconnected: 'silent_remote_disconnected', // 渲染端检测到 WebRTC 断开
};

// 渲染端可订阅这两个事件名拿到 ack（可选）
export const SILENT_IPC_RESP = {
  response_silentLockWorkstation: 'response_silent_lockWorkstation',
  response_silentMonitorOff: 'response_silent_monitorOff',
  response_silentPrivacyMode: 'response_silent_privacyMode',
};

// 远控会话状态：当 true 时，远端断开会触发自动锁屏
// 持久化到 userData/silent/lock-on-disconnect.json，重启后保留
let lockOnDisconnect = false;

// lazy 路径 —— 在 app.ready 之前 import 时不要触发 app.getPath()
function settingsFilePath(): string {
  return path.join(getSilentDir(), 'lock-on-disconnect.json');
}

function loadLockOnDisconnect(): void {
  try {
    const file = settingsFilePath();
    if (fs.existsSync(file)) {
      const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
      lockOnDisconnect = !!obj?.enabled;
    }
  } catch {
    lockOnDisconnect = false;
  }
}

function persistLockOnDisconnect(): void {
  try {
    const file = settingsFilePath();
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ enabled: lockOnDisconnect }));
  } catch (e) {
    console.error('[silent-ipc] persist lockOnDisconnect failed', e);
  }
}

export function setLockOnDisconnect(v: boolean): void {
  lockOnDisconnect = !!v;
  persistLockOnDisconnect();
}

export function getLockOnDisconnect(): boolean {
  return lockOnDisconnect;
}

// 由 webrtc 断开监听处调用：如果设置了"断开锁屏"，锁工作站（不开罩屏，远端已断不需要）
export async function handleRemoteDisconnect(): Promise<void> {
  if (!lockOnDisconnect) return;
  try {
    await lockWorkstation();
  } catch (e) {
    console.error('[silent-ipc] lock-on-disconnect failed', e);
  }
}

export function registerSilentIpc(): void {
  // 启动时从磁盘恢复开关
  loadLockOnDisconnect();

  // 渲染端每 5s 上报一次。这里把 payload + 收到时间写到 renderer.hb
  // watchdog 读这个文件判断"主进程是否真活着 / WebRTC 是否还连着"
  // 非静默模式下直接 no-op：避免渲染端 ping 触发 ENOENT
  ipcMain.handle(SILENT_IPC.silentRendererPing, (_e, payload) => {
    if (!isSilent()) return { code: 0, skipped: true };
    try {
      const safe = {
        receivedAt: Date.now(),
        ts: (payload && typeof payload.ts === 'number') ? payload.ts : Date.now(),
        rendererAlive: true,
        hasPeer: !!(payload && payload.hasPeer),
        peerState: (payload && typeof payload.peerState === 'string') ? payload.peerState : 'none',
        pcCount: (payload && typeof payload.pcCount === 'number') ? payload.pcCount : 0,
      };
      fs.writeFileSync(getRendererHeartbeatPath(), JSON.stringify(safe));
      return { code: 0 };
    } catch (e) {
      return { code: 1, msg: String(e) };
    }
  });

  ipcMain.handle(SILENT_IPC.silentLockWorkstation, async () => {
    try {
      await lockWorkstation();
      return { code: 0 };
    } catch (e) {
      return { code: 1, msg: String(e) };
    }
  });

  ipcMain.handle(SILENT_IPC.silentMonitorOff, async () => {
    try {
      await monitorOff();
      return { code: 0 };
    } catch (e) {
      return { code: 1, msg: String(e) };
    }
  });

  ipcMain.handle(SILENT_IPC.silentPrivacyMode, async (_e, data) => {
    try {
      // 透传给 privacyMode()，由它负责 alsoLock 默认值（避免双重 default 锁死语义）
      await privacyMode({
        text: data?.text,
        bgColor: data?.bgColor,
        alsoLock: data?.alsoLock,
      });
      return { code: 0 };
    } catch (e) {
      return { code: 1, msg: String(e) };
    }
  });

  ipcMain.handle(SILENT_IPC.silentPrivacyModeOff, async () => {
    try {
      await privacyModeOff();
      return { code: 0 };
    } catch (e) {
      return { code: 1, msg: String(e) };
    }
  });

  // 查询当前隐私模式是否开启（罩屏窗口是否存在）
  ipcMain.handle(SILENT_IPC.silentPrivacyModeGet, () => {
    return { code: 0, data: { active: isPrivacyWindowActive() } };
  });

  // 渲染端设置"远控断开是否自动锁屏"。data: { enabled: bool }
  //   { enabled: true }  → 打开自动锁屏
  //   { enabled: false } → 关闭自动锁屏（你刚要求的"取消"功能）
  // 设置会持久化到 lock-on-disconnect.json，重启不丢
  ipcMain.handle(SILENT_IPC.silentLockOnDisconnect, (_e, data) => {
    setLockOnDisconnect(!!(data && data.enabled));
    return { code: 0, data: { enabled: lockOnDisconnect } };
  });

  // 查询当前开关状态（不带副作用）
  ipcMain.handle(SILENT_IPC.silentLockOnDisconnectGet, () => {
    return { code: 0, data: { enabled: lockOnDisconnect } };
  });

  // 渲染端检测到 WebRTC 从 connected 变为 disconnected/failed/closed 时上报
  // 主进程根据 lockOnDisconnect 决定是否锁屏
  ipcMain.handle(SILENT_IPC.silentRemoteDisconnected, async (_e, data) => {
    console.log('[silent-ipc] remote disconnected', data);
    await handleRemoteDisconnect();
    return { code: 0, data: { lockedTriggered: lockOnDisconnect } };
  });

  // 强制退出（uninstall 用）：要求带本机 token 文件里的密钥
  // token 文件首次启动随机生成在 userData/silent/exit.token，660 权限（POSIX 上）
  // 攻击者要伪造退出请求得能读这个文件 = 已经能在本机执行任意代码 = 无意义
  ipcMain.handle(SILENT_IPC.silentExit, (_e, data) => {
    try {
      const tokenPath = path.join(getSilentDir(), 'exit.token');
      if (!fs.existsSync(tokenPath)) return { code: 1, msg: 'no token' };
      const expected = fs.readFileSync(tokenPath, 'utf8').trim();
      if (!data || data.token !== expected) return { code: 1, msg: 'bad token' };
      permitSilentExit();
      setTimeout(() => app.exit(0), 50);
      return { code: 0 };
    } catch (e) {
      return { code: 1, msg: String(e) };
    }
  });
}
