// 真正的"隐私模式"罩屏窗口
// 原理：setContentProtection(true) 在 Win10 build 19041+ 调用 SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)
//   → 本地物理屏幕：能看到这个罩屏窗口（覆盖整个屏幕的黑色 / 自定义内容）
//   → DXGI Desktop Duplication 抓屏：看不到这个窗口，看到的是被罩屏遮住的真实桌面
// 远控用 Electron desktopCapturer.getSources({types:['screen']})，底层就是 DXGI Duplication，所以远端正常看到桌面
//
// 退化：Win10 build < 19041 时 setContentProtection 会变成 WDA_MONITOR（远端看到黑块），不达预期
// 此时降级为"只锁屏 + 关显示器"，效果可接受
//
// 输入屏蔽：罩屏 setFocusable(false) + setIgnoreMouseEvents 配合 lockWorkstation 阻止本地用户操作
import path from 'path';

import { app, BrowserWindow, powerMonitor, screen } from 'electron';

let privacyWindows: BrowserWindow[] = [];
let lastOpts: PrivacyOptions = {};

interface PrivacyOptions {
  text?: string; // 罩屏显示文字
  bgColor?: string; // 背景色，默认黑
}

function buildPrivacyHtml(text: string, bgColor: string): string {
  // dataURL 简化，无需打包成单独资源
  const safeText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const html =
    `<!DOCTYPE html><html><head><meta charset="utf-8"><style>` +
    `html,body{margin:0;padding:0;height:100%;background:${bgColor};` +
    `color:#888;font-family:'Segoe UI',Microsoft YaHei,sans-serif;` +
    `display:flex;align-items:center;justify-content:center;` +
    `user-select:none;cursor:none;overflow:hidden;}` +
    `.t{font-size:18px;opacity:.5;}</style></head>` +
    `<body><div class="t">${safeText}</div></body></html>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

export function enablePrivacyWindow(opts: PrivacyOptions = {}): void {
  if (privacyWindows.length > 0) return; // 已开启
  lastOpts = opts;
  const text = opts.text ?? '隐私模式中 · Privacy Mode';
  const bgColor = opts.bgColor ?? '#000000';

  // 每个物理屏都罩一个，多屏场景下也覆盖完整
  const displays = screen.getAllDisplays();
  displays.forEach((d) => {
    const win = new BrowserWindow({
      x: d.bounds.x,
      y: d.bounds.y,
      width: d.bounds.width,
      height: d.bounds.height,
      frame: false,
      transparent: false,
      fullscreen: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: false, // 不抢焦点，避免触发某些应用的失焦行为
      hasShadow: false,
      backgroundColor: bgColor,
      webPreferences: {
        // 罩屏不需要 preload / IPC，禁用减少攻击面
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
      icon: path.join(__dirname, '../public/favicon.ico'),
    });

    // 关键：从屏幕捕获中排除本窗口（远端抓不到这层罩屏）
    // 仅 Win10 build 19041+ 真正等同 WDA_EXCLUDEFROMCAPTURE
    win.setContentProtection(true);

    // 多桌面切换 / 最高层级
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // 鼠标事件穿透——本地用户的鼠标点到下层应用而非罩屏
    // 但因为我们同时调 lockWorkstation()，输入会被系统锁拦截
    win.setIgnoreMouseEvents(true, { forward: false });

    void win.loadURL(buildPrivacyHtml(text, bgColor));
    privacyWindows.push(win);
  });
}

export function disablePrivacyWindow(): void {
  privacyWindows.forEach((w) => {
    try {
      if (!w.isDestroyed()) {
        // closable:false 的窗口需要 destroy 而不是 close
        w.destroy();
      }
    } catch (e) {
      console.warn('[privacy] destroy failed', e);
    }
  });
  privacyWindows = [];
}

export function isPrivacyWindowActive(): boolean {
  return privacyWindows.length > 0;
}

// 多屏热插拔：罩屏开启状态下显示器变化时重建
// 防抖 500ms，避免休眠唤醒时连续 add/remove 引起本地短暂"漏屏"闪烁
let rebuildTimer: NodeJS.Timeout | null = null;
function scheduleRebuild() {
  if (privacyWindows.length === 0) return;
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    rebuildTimer = null;
    if (privacyWindows.length === 0) return;
    const keepOpts = lastOpts;
    disablePrivacyWindow();
    enablePrivacyWindow(keepOpts);
  }, 500);
}

// 把所有罩屏强制提到顶层 + 重新设置 always-on-top
// 用于"用户解锁工作站 / 系统从休眠唤醒"后罩屏可能被推到 LogonUI 下方的场景
function reassertOnTop() {
  privacyWindows.forEach((w) => {
    if (w.isDestroyed()) return;
    try {
      w.setAlwaysOnTop(true, 'screen-saver');
      w.moveTop();
    } catch (e) {
      console.warn('[privacy] reassertOnTop failed', e);
    }
  });
}

app.whenReady().then(() => {
  screen.on('display-added', scheduleRebuild);
  screen.on('display-removed', scheduleRebuild);
  // 解锁 / 唤醒后立刻 reassertOnTop —— 防止罩屏被 LogonUI 顶走后再不回来
  powerMonitor.on('unlock-screen' as any, reassertOnTop);
  powerMonitor.on('resume', reassertOnTop);
});
