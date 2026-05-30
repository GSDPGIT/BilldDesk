// 渲染端心跳 + WebRTC 健康监测（用于静默被控端"假活"检测）
// 启动后做两件事：
//   1. 全局 monkey-patch RTCPeerConnection，自动跟踪所有 PC 的 connectionState
//   2. 每 5s 通过 IPC 上报 { rendererAlive, peerState, hasPeer } 给主进程
//
// 主进程把它写到 renderer.hb（JSON），watchdog 读这个文件决定是否要重启主程序。
//
// 非静默模式下也会跑（开销可忽略），主进程的 handler 收到也会写文件——无副作用。

const PING_INTERVAL_MS = 5000;

interface PingPayload {
  ts: number;
  rendererAlive: true;
  hasPeer: boolean; // 当前是否有活的 PeerConnection
  peerState: 'none' | 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';
  pcCount: number;
}

// 跟踪所有活跃 PeerConnection
const livePCs = new Set<RTCPeerConnection>();

function patchRTCPeerConnection() {
  if (typeof window === 'undefined' || !window.RTCPeerConnection) return;
  // 避免重复 patch（HMR / 多次 import）
  if ((window as any).__billdSilentPatched__) return;
  (window as any).__billdSilentPatched__ = true;

  const OriginalPC = window.RTCPeerConnection;
  // 用 Proxy 保留构造签名 & instanceof
  window.RTCPeerConnection = new Proxy(OriginalPC, {
    construct(target, args) {
      const pc = Reflect.construct(target, args) as RTCPeerConnection;
      livePCs.add(pc);
      const cleanup = () => {
        if (
          pc.connectionState === 'closed' ||
          pc.connectionState === 'failed'
        ) {
          livePCs.delete(pc);
        }
      };
      pc.addEventListener('connectionstatechange', cleanup);
      // 兜底：iceConnectionState 也清一遍
      pc.addEventListener('iceconnectionstatechange', () => {
        if (
          pc.iceConnectionState === 'closed' ||
          pc.iceConnectionState === 'failed'
        ) {
          livePCs.delete(pc);
        }
      });
      return pc;
    },
  }) as unknown as typeof RTCPeerConnection;
}

// 跟踪上一轮快照的状态，用于检测 connected → 非 connected 的转变（断开事件）
let lastSnapshotState: PingPayload['peerState'] = 'none';

// 过滤"死"状态的 PC—— closed/failed/disconnected 不参与 snapshot 计算
// 原因：disconnected 状态的 PC 可能永远不会回到 connected，也可能不会进入 closed
// 若它一直留在 livePCs 且贡献 peerState，会让 lastSnapshotState 永远卡在 'disconnected'
// 导致后续 'connected → disconnected' 转变被吞掉（H3 bug）
function isDeadState(s: string): boolean {
  return s === 'closed' || s === 'failed' || s === 'disconnected';
}

function snapshotPeerState(): {
  hasPeer: boolean;
  peerState: PingPayload['peerState'];
  pcCount: number;
} {
  // 顺手清掉死状态的 PC——避免 set 无限增长
  livePCs.forEach((pc) => {
    if (isDeadState(pc.connectionState)) livePCs.delete(pc);
  });

  if (livePCs.size === 0) {
    return { hasPeer: false, peerState: 'none', pcCount: 0 };
  }
  // 多个 PC 时取"最好"的状态：只要有一个 connected 就算健康
  const priority: PingPayload['peerState'][] = [
    'connected',
    'connecting',
    'new',
  ];
  let best: PingPayload['peerState'] = 'new';
  let bestIdx = priority.length;
  livePCs.forEach((pc) => {
    const s = pc.connectionState as PingPayload['peerState'];
    const idx = priority.indexOf(s);
    if (idx >= 0 && idx < bestIdx) {
      bestIdx = idx;
      best = s;
    }
  });
  return { hasPeer: true, peerState: best, pcCount: livePCs.size };
}

function getIpc() {
  const api: any =
    (window as any).electron ||
    (window as any).electronAPI ||
    (window as any).api;
  return api?.ipcRenderer;
}

async function sendPing(): Promise<void> {
  const ipc = getIpc();
  if (!ipc?.invoke) return;

  const snap = snapshotPeerState();
  const payload: PingPayload = {
    ts: Date.now(),
    rendererAlive: true,
    ...snap,
  };

  // 检测断开事件：上一轮 connected，本轮不再 connected（dead PC 已被 snapshot 过滤）
  // 因此 "断开" 表现为 peerState 从 'connected' 变成 'connecting'/'new'/'none' 任一种
  // 这样无论是 disconnected/failed/closed/网卡掉线/远端主动断 都能触发一次
  const wasConnected = lastSnapshotState === 'connected';
  const nowNotConnected = snap.peerState !== 'connected';
  if (wasConnected && nowNotConnected) {
    try {
      await ipc.invoke('silent_remote_disconnected', {
        ts: Date.now(),
        prev: lastSnapshotState,
        curr: snap.peerState,
      });
    } catch {
      /* ignore */
    }
  }
  lastSnapshotState = snap.peerState;

  try {
    await ipc.invoke('silent_renderer_ping', payload);
  } catch {
    /* ignore */
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startSilentHealth(): void {
  patchRTCPeerConnection();
  if (timer) return;
  // 立即发一次再起循环，缩短启动后 watchdog 的"未确认"窗口
  void sendPing();
  timer = setInterval(sendPing, PING_INTERVAL_MS);
  window.addEventListener('beforeunload', () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  });
}
