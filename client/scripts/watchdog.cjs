// BilldDesk 静默被控端守护进程（自用，单机部署）
// 用法：被 silent-mode.ts 通过 spawn 启动，或被 Task Scheduler 在登录时启动
// 运行方式：electron.exe 以 ELECTRON_RUN_AS_NODE=1 跑本脚本（无需额外 Node 依赖）
//
// 职责：
//   1. 定时写自己的心跳文件
//   2. 定时检查主程序心跳；超时即拉起主程序
//   3. 单实例锁（避免多个 watchdog 互相打架）
//
// 环境变量（由 silent-mode 注入；独立启动时回退到默认值）：
//   BILLD_APP_EXE              主程序可执行文件路径
//   BILLD_SILENT_FLAG          静默参数（默认 --silent）
//   BILLD_HEARTBEAT_DIR        心跳目录
//   BILLD_APP_HEARTBEAT        主程序心跳文件
//   BILLD_WATCHDOG_HEARTBEAT   本进程心跳文件
//   BILLD_WATCHDOG_PID_FILE    本进程 pid 文件（单实例锁）

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFile } = require('child_process');

const HEARTBEAT_DIR =
  process.env.BILLD_HEARTBEAT_DIR ||
  path.join(os.homedir(), 'AppData', 'Roaming', 'BilldDesk', 'silent');
const APP_HEARTBEAT =
  process.env.BILLD_APP_HEARTBEAT || path.join(HEARTBEAT_DIR, 'app.hb');
const RENDERER_HEARTBEAT =
  process.env.BILLD_RENDERER_HEARTBEAT ||
  path.join(HEARTBEAT_DIR, 'renderer.hb');
const WATCHDOG_HEARTBEAT =
  process.env.BILLD_WATCHDOG_HEARTBEAT ||
  path.join(HEARTBEAT_DIR, 'watchdog.hb');
const PID_FILE =
  process.env.BILLD_WATCHDOG_PID_FILE ||
  path.join(HEARTBEAT_DIR, 'watchdog.pid');
const LOCK_FILE = path.join(HEARTBEAT_DIR, 'watchdog.lock');
const APP_EXE = process.env.BILLD_APP_EXE || '';
const SILENT_FLAG = process.env.BILLD_SILENT_FLAG || '--silent';

const HEARTBEAT_INTERVAL_MS = 3000;
const APP_CHECK_INTERVAL_MS = 5000;
const APP_STALE_MS = 20000; // 主进程心跳新鲜阈值
const RENDERER_STALE_MS = 30000; // 渲染端心跳新鲜阈值
const STARTUP_GRACE_MS = 60000; // 启动后这段时间内不杀（页面还没加载）
const APP_RESTART_BACKOFF_MS = 8000; // 拉起后至少等这么久再判定下一次
const FROZEN_KILL_AFTER_TICKS = 3; // 连续 N 次检测到"进程在跑但心跳僵死"就强杀

let lastRespawnAt = 0;
let frozenTickCount = 0;
// 用于"启动宽限"判定：spawnApp 成功一次就更新；watchdog 启动时若主程序已经在跑，
// 我们也给一段宽限期（认为它刚启动），所以初始化为 now
let instanceStartedAt = Date.now();
// 上次 tick 实际执行时间，用于检测休眠唤醒
// Win11 Modern Standby 会让 watchdog 停摆，唤醒时 hb 全部过期，但其实大家一起睡了
let lastTickAt = Date.now();
// "刚醒来"判定：相邻两次 tick 间隔 > SLEEP_DETECT_MS 就认为期间发生了休眠
const SLEEP_DETECT_MS = APP_CHECK_INTERVAL_MS * 4; // 5s * 4 = 20s

function log() {
  // 静默运行，日志只写文件
  try {
    const args = Array.prototype.slice.call(arguments);
    const line = `[${new Date().toISOString()}] ${args
      .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
      .join(' ')}\n`;
    fs.appendFileSync(path.join(HEARTBEAT_DIR, 'watchdog.log'), line);
  } catch (_) {
    /* ignore */
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// 用 O_EXCL 文件独占创建做单例锁——比 PID 文件可靠（不受 PID 重用影响）
// 持有 fd 直到进程退出；强 kill 后系统会释放 fd，下次启动可重新创建
let lockFd = null;
function acquireSingleInstance() {
  try {
    // 'wx' = O_WRONLY | O_CREAT | O_EXCL，已存在则抛错
    lockFd = fs.openSync(LOCK_FILE, 'wx');
    fs.writeSync(lockFd, String(process.pid));
    // pid 文件作为可读的附加信息（不参与互斥判断）
    fs.writeFileSync(PID_FILE, String(process.pid));
  } catch (e) {
    if (e && e.code === 'EEXIST') {
      // 锁文件已存在；检查锁文件本身是否过期（按 mtime；超过 stale 阈值就抢锁）
      try {
        const st = fs.statSync(LOCK_FILE);
        if (Date.now() - st.mtimeMs > 60000) {
          log('lock file stale, taking over');
          fs.unlinkSync(LOCK_FILE);
          lockFd = fs.openSync(LOCK_FILE, 'wx');
          fs.writeSync(lockFd, String(process.pid));
          fs.writeFileSync(PID_FILE, String(process.pid));
          return;
        }
      } catch (_) {
        /* ignore */
      }
      log('another watchdog holding lock, exiting');
      process.exit(0);
    }
    log('acquireSingleInstance failed', String(e));
  }
}

// 每次心跳同时 touch 锁文件，证明锁还活着（用于 stale 判定）
function touchLock() {
  try {
    if (lockFd !== null) {
      const now = new Date();
      fs.futimesSync(lockFd, now, now);
    }
  } catch (_) {
    /* ignore */
  }
}

function writeHeartbeat() {
  try {
    fs.writeFileSync(WATCHDOG_HEARTBEAT, String(Date.now()));
    touchLock();
  } catch (e) {
    log('write heartbeat failed', String(e));
  }
}

function readTs(file) {
  try {
    if (!fs.existsSync(file)) return 0;
    const raw = fs.readFileSync(file, 'utf8').trim();
    // 渲染心跳是 JSON，主心跳是裸数字
    if (raw.startsWith('{')) {
      try {
        const obj = JSON.parse(raw);
        // 优先取 main 接收到的时间戳（receivedAt），更准确
        return typeof obj.receivedAt === 'number'
          ? obj.receivedAt
          : typeof obj.ts === 'number'
            ? obj.ts
            : 0;
      } catch {
        return 0;
      }
    }
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

function isAppFresh() {
  return Date.now() - readTs(APP_HEARTBEAT) < APP_STALE_MS;
}

function isRendererFresh() {
  return Date.now() - readTs(RENDERER_HEARTBEAT) < RENDERER_STALE_MS;
}

function inStartupGrace() {
  // 跟随最近一次 spawn / watchdog 启动，给慢启动留余地（防止杀刚出生的 Electron）
  return Date.now() - instanceStartedAt < STARTUP_GRACE_MS;
}

// 找到所有真正的主程序进程 PID（命令行带 --silent 且不是 watchdog 自己）
// 返回 PID 数组，没找到返回 []
//
// 注入防御：imageName 通过 PS 参数 $args 传入而非字符串拼接。
// 即便 APP_EXE 被恶意改成 "Foo$(calc).exe"，$args[0] 也是字面量字符串，
// PS 不会去 eval $() 子表达式。
function findAppPids(cb) {
  if (!APP_EXE) {
    cb([]);
    return;
  }
  const imageName = path.basename(APP_EXE);
  // 额外的格式校验：进程名应该全是字母数字/中划线/下划线/点/空格，且以 .exe 结尾
  // 不符就直接放弃查询（被攻击场景）
  if (!/^[\w .\-]{1,128}\.exe$/i.test(imageName)) {
    log('imageName format suspect, refusing query:', imageName);
    cb([]);
    return;
  }
  const selfPid = process.pid;
  // 单引号 PS 字符串：$ 不会被插值；用 $args[0] 接收 imageName，CIM Filter 由 PS 拼接但全字面量
  const ps =
    "$n = $args[0]; " +
    "$me = [int]$args[1]; " +
    "Get-CimInstance Win32_Process -Filter ('Name=''' + $n + '''') | " +
    "Where-Object { $_.CommandLine -match '--silent' -and $_.CommandLine -notmatch 'watchdog' -and $_.ProcessId -ne $me } | " +
    'Select-Object -ExpandProperty ProcessId';
  execFile(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      ps,
      imageName,
      String(selfPid),
    ],
    { windowsHide: true },
    (err, stdout) => {
      if (err) {
        log('powershell process query failed', String(err));
        cb([]);
        return;
      }
      const pids = String(stdout)
        .split(/\r?\n/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n) && n > 0);
      cb(pids);
    }
  );
}

function isAppProcessRunning(cb) {
  findAppPids((pids) => cb(pids.length > 0));
}

// 强杀指定 PID 列表（taskkill /F /PID xxx /T 连同子进程）
function killPids(pids, cb) {
  if (!pids.length) {
    cb();
    return;
  }
  const args = ['/F', '/T'];
  pids.forEach((p) => {
    args.push('/PID', String(p));
  });
  execFile('taskkill.exe', args, { windowsHide: true }, (err) => {
    if (err) log('taskkill failed', String(err));
    else log('killed pids', pids);
    cb();
  });
}

function spawnApp(opts) {
  const force = opts && opts.force === true;
  if (!APP_EXE || !fs.existsSync(APP_EXE)) {
    log('app exe missing, cannot respawn:', APP_EXE);
    return;
  }
  const now = Date.now();
  if (!force && now - lastRespawnAt < APP_RESTART_BACKOFF_MS) {
    log('respawn backoff, skip');
    return;
  }
  lastRespawnAt = now;
  try {
    const child = spawn(APP_EXE, [SILENT_FLAG], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    // 重置 per-instance 启动宽限期，让新生 Electron 有时间加载页面
    instanceStartedAt = Date.now();
    log('app respawned, pid=', child.pid, 'force=', !!force);
  } catch (e) {
    log('spawn app failed', String(e));
  }
}

// 健康判定：
//   两类心跳——主进程 app.hb（证明 Electron 主线程没死）+ 渲染端 renderer.hb（证明窗口没卡死）
//   规则：
//     - app.hb 新鲜 && renderer.hb 新鲜 → 完全健康（frozenTickCount 归零）
//     - app.hb 新鲜 但 renderer.hb 僵死 → 渲染端假死；启动宽限期内不动，过了就杀
//     - app.hb 僵死 → 进程死了或冻僵；进程在跑就杀，不在就 spawn
function tick() {
  const now = Date.now();
  // 休眠唤醒检测：上次 tick 跟现在差太多 → 期间系统睡了
  // Win11 Modern Standby 经常会让所有定时器停摆。此时所有 hb 看起来都过期了，
  // 但其实主程序也只是被冻结，没有崩。给一个新的启动宽限期，避免误杀
  if (now - lastTickAt > SLEEP_DETECT_MS) {
    log(
      'sleep/wake detected, gap=',
      now - lastTickAt,
      'ms; granting fresh startup grace'
    );
    instanceStartedAt = now;
    frozenTickCount = 0;
  }
  lastTickAt = now;

  writeHeartbeat();
  const appFresh = isAppFresh();
  const rendFresh = isRendererFresh();

  if (appFresh && rendFresh) {
    frozenTickCount = 0;
    return;
  }

  findAppPids((pids) => {
    const running = pids.length > 0;

    // 场景 1：进程不在 → 直接 spawn
    if (!running) {
      frozenTickCount = 0;
      log('app process not found, respawning');
      spawnApp();
      return;
    }

    // 进程在跑但心跳出问题
    if (inStartupGrace()) {
      // 启动宽限期：页面正在加载，先别动
      log('in startup grace, skip kill; pids=', pids);
      return;
    }

    frozenTickCount += 1;
    log(
      'app process alive but stale; appFresh=',
      appFresh,
      'rendFresh=',
      rendFresh,
      'tickCount=',
      frozenTickCount,
      'pids=',
      pids
    );

    if (frozenTickCount >= FROZEN_KILL_AFTER_TICKS) {
      log('forcing kill+respawn for frozen main');
      frozenTickCount = 0;
      killPids(pids, () => {
        // 给系统一点时间清理 singleInstanceLock
        // 使用 force:true 绕过 8s 退避——刚强杀完，必须立刻重启，不然 10s 真空
        setTimeout(() => spawnApp({ force: true }), 1500);
      });
    }
  });
}

function main() {
  ensureDir(HEARTBEAT_DIR);
  acquireSingleInstance();
  writeHeartbeat();
  log('watchdog started, pid=', process.pid, 'APP_EXE=', APP_EXE);

  setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS);
  setInterval(tick, APP_CHECK_INTERVAL_MS);

  const cleanup = () => {
    try {
      if (lockFd !== null) {
        fs.closeSync(lockFd);
        lockFd = null;
      }
      if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
      if (fs.existsSync(PID_FILE)) {
        const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'), 10);
        if (pid === process.pid) fs.unlinkSync(PID_FILE);
      }
    } catch (_) {
      /* ignore */
    }
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('uncaughtException', (e) => {
    log('uncaughtException', String(e));
  });
}

main();
