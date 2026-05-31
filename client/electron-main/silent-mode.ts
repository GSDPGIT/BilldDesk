// 被控端静默模式
// 由 --silent 命令行参数触发。开启后：
//   - 主窗口创建即隐藏 + 不在任务栏显示
//   - 关闭窗口不退出 app（window-all-closed 拦截）
//   - 注册开机自启（HKCU Run，等同于 setLoginItemSettings）
//   - 启动 watchdog 守护进程（如果未运行）
//   - 与 watchdog 双向心跳
import { randomBytes } from 'crypto';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { app, BrowserWindow } from 'electron';

const SILENT_FLAG = '--silent';

// vite define 注入；agent 编译产物里固定为 'agent'，否则 'master' / undefined
declare const __BILLD_VARIANT__: string;
const IS_AGENT_BUILD =
  typeof __BILLD_VARIANT__ !== 'undefined' &&
  __BILLD_VARIANT__ === 'agent';

// 所有路径都做成 lazy getter：app.getPath('userData') 在 app.ready 前调有风险
// （Electron 文档明确不保证 ready 之前可用）。模块顶部 import 时就调一定踩雷。
function heartbeatDir(): string {
  return path.join(app.getPath('userData'), 'silent');
}
function appHeartbeatPath(): string {
  return path.join(heartbeatDir(), 'app.hb');
}
function rendererHeartbeatPath(): string {
  return path.join(heartbeatDir(), 'renderer.hb');
}
function watchdogHeartbeatPath(): string {
  return path.join(heartbeatDir(), 'watchdog.hb');
}
function watchdogPidFilePath(): string {
  return path.join(heartbeatDir(), 'watchdog.pid');
}

// 暴露给 silent-ipc.ts 用
export function getRendererHeartbeatPath(): string {
  return rendererHeartbeatPath();
}
export function getSilentDir(): string {
  return heartbeatDir();
}

const HEARTBEAT_INTERVAL_MS = 3000;
const WATCHDOG_STALE_MS = 20000;

let heartbeatTimer: NodeJS.Timeout | null = null;
let watchdogCheckTimer: NodeJS.Timeout | null = null;

export function isSilent(): boolean {
  // Agent build：永远静默
  if (IS_AGENT_BUILD) return true;
  return process.argv.includes(SILENT_FLAG);
}

export function isAgentBuild(): boolean {
  return IS_AGENT_BUILD;
}

// 调用方在创建 BrowserWindow 之前合并这些选项
export function silentWindowOptions(): Partial<Electron.BrowserWindowConstructorOptions> {
  if (!isSilent()) return {};
  return {
    show: false,
    skipTaskbar: true,
    // 防止用户用 Alt+F4 关掉
    closable: false,
  };
}

// 注册开机自启
// 注意：Windows 推荐用 install-silent.ps1 安装（统一管理 HKCU Run + Task Scheduler）
// 这里只作为后备：如果用户直接拷贝运行没跑安装脚本，运行时也能补一次自启
// 仅在 macOS / Linux 上启用 setLoginItemSettings，Windows 留给 PS1
export function ensureAutoStart(): void {
  if (!app.isPackaged) {
    console.log('[silent] dev mode, skip auto-start registration');
    return;
  }
  try {
    const exe = process.execPath;
    // Agent build：Windows 也注册 HKCU Run（无需 install-silent.ps1 配合）
    // 普通 master/silent build：Windows 跳过避免和 install-silent.ps1 冲突
    if (process.platform === 'win32' && !IS_AGENT_BUILD) {
      return;
    }
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
      path: exe,
      // agent build 不带 --silent 也会因 IS_AGENT_BUILD 强制静默
      args: IS_AGENT_BUILD ? [] : [SILENT_FLAG],
    });
    console.log('[silent] auto-start registered:', exe);
  } catch (e) {
    console.error('[silent] auto-start failed', e);
  }
}

// 移除开机自启（卸载用）
export function removeAutoStart(): void {
  try {
    app.setLoginItemSettings({ openAtLogin: false });
  } catch (e) {
    console.error('[silent] remove auto-start failed', e);
  }
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureExitToken(): void {
  const tokenPath = path.join(heartbeatDir(), 'exit.token');
  if (!fs.existsSync(tokenPath)) {
    fs.writeFileSync(tokenPath, randomBytes(24).toString('hex'), {
      mode: 0o600,
    });
  }
}

// 写自己的心跳
function writeAppHeartbeat(): void {
  try {
    fs.writeFileSync(appHeartbeatPath(), String(Date.now()));
  } catch (e) {
    // 心跳写失败不致命，watchdog 下个周期会重启我们
    console.warn('[silent] write heartbeat failed', e);
  }
}

// 检查 watchdog 心跳是否新鲜；不新鲜就拉起 watchdog
function checkWatchdog(): void {
  let alive = false;
  try {
    if (fs.existsSync(watchdogHeartbeatPath())) {
      const ts = parseInt(fs.readFileSync(watchdogHeartbeatPath(), 'utf8'), 10);
      if (!Number.isNaN(ts) && Date.now() - ts < WATCHDOG_STALE_MS) {
        alive = true;
      }
    }
  } catch {
    alive = false;
  }
  if (!alive) {
    console.log('[silent] watchdog stale or missing, spawning...');
    spawnWatchdog();
  }
}

// 启动 watchdog 子进程（detached，脱离父进程生命周期）
function spawnWatchdog(): void {
  try {
    const watchdogScript = app.isPackaged
      ? path.join(process.resourcesPath, 'scripts', 'watchdog.cjs')
      : path.join(__dirname, '..', 'scripts', 'watchdog.cjs');

    if (!fs.existsSync(watchdogScript)) {
      console.warn('[silent] watchdog.cjs not found at', watchdogScript);
      return;
    }

    // 用 Electron 自带的 node runtime 跑 watchdog
    // ELECTRON_RUN_AS_NODE=1 让 electron.exe 行为像 node.exe
    const child = spawn(process.execPath, [watchdogScript], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        BILLD_APP_EXE: process.execPath,
        BILLD_SILENT_FLAG: SILENT_FLAG,
        BILLD_HEARTBEAT_DIR: heartbeatDir(),
        BILLD_APP_HEARTBEAT: appHeartbeatPath(),
        BILLD_RENDERER_HEARTBEAT: rendererHeartbeatPath(),
        BILLD_WATCHDOG_HEARTBEAT: watchdogHeartbeatPath(),
        BILLD_WATCHDOG_PID_FILE: watchdogPidFilePath(),
      },
    });
    child.unref();
    console.log('[silent] watchdog spawned, pid =', child.pid);
  } catch (e) {
    console.error('[silent] spawn watchdog failed', e);
  }
}

// 初始化静默模式（只在 isSilent() 为 true 时调用）
export function initSilent(): void {
  if (!isSilent()) return;

  ensureDir(heartbeatDir());
  ensureExitToken();
  // window-all-closed 的拦截在 index.ts 里通过 isSilent() 已经处理，不在此处重复注册

  // 立即写一次心跳，再起循环
  writeAppHeartbeat();
  heartbeatTimer = setInterval(writeAppHeartbeat, HEARTBEAT_INTERVAL_MS);

  // 启动时检查 watchdog；之后每 10s 复查一次
  checkWatchdog();
  watchdogCheckTimer = setInterval(checkWatchdog, 10000);

  // 注册自启
  ensureAutoStart();

  // 应用真正退出时清理（一般不会触发，但留个手）
  app.on('will-quit', () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (watchdogCheckTimer) clearInterval(watchdogCheckTimer);
  });

  console.log('[silent] initialized; argv =', process.argv.join(' '));
}

// 给窗口实例附加静默行为（阻止用户关闭、隐藏到任务栏）
// 注意：不再监听 on('show') —— 那会和 ready-to-show / loadURL 内部触发的 show 死磕
// 单纯靠 show: false + skipTaskbar: true 已经足够保持隐藏
export function attachSilentBehavior(win: BrowserWindow): void {
  if (!isSilent()) return;
  // 拦截 close：用户点 X 不退出，仅隐藏。silent_exit IPC 走 app.exit() 才能真退
  win.on('close', (e) => {
    if (!allowExit) {
      e.preventDefault();
      win.hide();
    }
  });
}

// 由 silent_exit IPC 设为 true 后才允许 close 真正发生
let allowExit = false;
export function permitSilentExit(): void {
  allowExit = true;
}
