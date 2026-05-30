// Windows 原生动作：锁屏、关显示器、隐私模式（罩屏 + 锁屏）
// 只依赖系统自带的 rundll32 / powershell，无需任何 native module
import { exec } from 'child_process';
import { platform } from 'process';

import { disablePrivacyWindow, enablePrivacyWindow } from './privacy-window';

export function isWin(): boolean {
  return platform === 'win32';
}

// 锁定工作站（等同于 Win+L）
// 远控会话仍然保持：lockscreen 之后 DXGI 仍可截屏，但需注意 UAC/Secure Desktop 场景下会失效
export function lockWorkstation(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isWin()) {
      reject(new Error('lockWorkstation 仅支持 Windows'));
      return;
    }
    exec('rundll32.exe user32.dll,LockWorkStation', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// 立即关闭所有显示器（SC_MONITORPOWER=2）
// 注意：用户移动鼠标/敲键盘会立刻唤醒；被控端按键模拟不会触发本地唤醒
export function monitorOff(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isWin()) {
      reject(new Error('monitorOff 仅支持 Windows'));
      return;
    }
    // 通过 PowerShell 调用 user32!SendMessage 广播 WM_SYSCOMMAND
    // 0xFFFF = HWND_BROADCAST, 0x112 = WM_SYSCOMMAND, 0xF170 = SC_MONITORPOWER, 2 = off
    const ps = [
      'Add-Type \'using System; using System.Runtime.InteropServices;',
      'public class P {',
      '  [DllImport("user32.dll")]',
      '  public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);',
      '}\';',
      '[P]::SendMessage([IntPtr]0xFFFF, 0x112, [IntPtr]0xF170, [IntPtr]2) | Out-Null',
    ].join(' ');
    exec(
      `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${ps}"`,
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// 真正的"隐私模式"：
//   1. 拉起 setContentProtection 罩屏（本地全黑，远端 desktopCapturer 仍能看到真实桌面）
//   2. 锁工作站（屏蔽本地键鼠输入，远端通过 nutjs/AccessibilityService 操作不受影响）
//   注意：不默认调 monitorOff —— 关显示器会让远端鼠标移动唤醒，反而暴露内容
//   想关显示器走单独的 monitorOff() IPC
//
// 退出隐私模式（privacyModeOff）只移除罩屏；如果之前 lock 过工作站，要本地用户自己解锁
export async function privacyMode(opts?: {
  text?: string;
  bgColor?: string;
  alsoLock?: boolean;
}): Promise<void> {
  enablePrivacyWindow(opts);
  if (opts?.alsoLock !== false) {
    await lockWorkstation();
  }
}

export async function privacyModeOff(): Promise<void> {
  disablePrivacyWindow();
}
