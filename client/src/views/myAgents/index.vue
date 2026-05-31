<template>
  <div class="my-agents-wrap">
    <div class="header">
      <div class="title">我的被控端 ({{ list.length }})</div>
      <div class="actions">
        <n-button
          size="small"
          :loading="loading"
          @click="loadList"
        >
          刷新
        </n-button>
      </div>
    </div>

    <div class="hint">
      ✅ 在线 = 90 秒内有心跳。点击设备右侧"远控"按钮直接发起远程连接（无需手输设备码）。
    </div>

    <div
      v-if="loading && list.length === 0"
      class="empty"
    >
      加载中...
    </div>
    <div
      v-else-if="list.length === 0"
      class="empty"
    >
      还没有被控端注册。安装并运行 BilldDesk-Agent.exe 后会自动出现在这里。
    </div>

    <div
      v-else
      class="grid"
    >
      <div
        v-for="row in list"
        :key="row.id"
        :class="['agent-card', row.is_online ? 'online' : 'offline']"
      >
        <div class="card-head">
          <span :class="['dot', row.is_online ? 'on' : 'off']"></span>
          <span class="name">
            {{ row.nickname || row.hostname || row.device_id?.slice(0, 8) }}
          </span>
          <span class="badge">{{ row.platform }}</span>
        </div>
        <div class="card-body">
          <div class="row">
            <span class="k">主机:</span>
            <span class="v">{{ row.hostname || '-' }}</span>
          </div>
          <div class="row">
            <span class="k">公网IP:</span>
            <span class="v">{{ row.public_ip || '-' }}</span>
          </div>
          <div class="row">
            <span class="k">内网IP:</span>
            <span class="v">{{ row.local_ip || '-' }}</span>
          </div>
          <div class="row">
            <span class="k">OS:</span>
            <span class="v">{{ row.os_version || '-' }}</span>
          </div>
          <div class="row">
            <span class="k">最后心跳:</span>
            <span class="v">{{ formatTime(row.last_heartbeat) }}</span>
          </div>
          <div class="row mono">
            <span class="k">ID:</span>
            <span class="v">{{ row.device_id?.slice(0, 16) }}...</span>
          </div>
        </div>
        <div class="card-actions">
          <n-button
            size="tiny"
            type="primary"
            :disabled="!row.is_online"
            @click="connectAgent(row)"
          >
            远控
          </n-button>
          <n-button
            size="tiny"
            @click="openConfig(row)"
          >
            配置
          </n-button>
          <n-button
            size="tiny"
            quaternary
            @click="renameAgent(row)"
          >
            重命名
          </n-button>
          <n-button
            size="tiny"
            quaternary
            type="error"
            @click="deleteAgent(row)"
          >
            删除
          </n-button>
        </div>
      </div>
    </div>

    <!-- 配置弹窗 -->
    <n-modal
      v-model:show="configModalVisible"
      preset="card"
      title="远程配置"
      style="width: 480px"
    >
      <div
        v-if="configEditing"
        class="config-form"
      >
        <div class="cfg-item">
          <n-checkbox v-model:checked="editConfig.lockOnDisconnect">
            断开远控时自动锁屏
          </n-checkbox>
        </div>
        <div class="cfg-item">
          <n-checkbox v-model:checked="editConfig.privacyMode">
            开启隐私模式（罩屏 + 锁屏）
          </n-checkbox>
        </div>
        <div
          v-if="editConfig.privacyMode"
          class="cfg-item indent"
        >
          <n-checkbox v-model:checked="editConfig.privacyAlsoLock">
            隐私模式同时锁定工作站
          </n-checkbox>
        </div>
        <div
          v-if="editConfig.privacyMode"
          class="cfg-item indent"
        >
          <span>罩屏文字：</span>
          <n-input
            v-model:value="editConfig.privacyText"
            size="small"
            placeholder="隐私模式中"
            style="width: 240px"
          />
        </div>
        <div class="cfg-actions">
          <n-button
            size="small"
            @click="configModalVisible = false"
          >
            取消
          </n-button>
          <n-button
            size="small"
            type="primary"
            :loading="configSaving"
            @click="saveConfig"
          >
            推送到被控端
          </n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  agentDelete,
  agentList,
  agentUpdateConfig,
  IAgentRow,
} from '@/api/agent';

const router = useRouter();
const list = ref<IAgentRow[]>([]);
const loading = ref(false);
let pollTimer: number | null = null;

async function loadList() {
  loading.value = true;
  try {
    const res = await agentList();
    if (res?.code === 200 || res?.code === 0) {
      list.value = res.data || [];
    } else {
      window.$message?.error(`加载失败：${res?.message}`);
    }
  } catch (e: any) {
    console.error(e);
    window.$message?.error(
      `加载失败：${e?.response?.data?.message || e?.message || '未知'}`
    );
  } finally {
    loading.value = false;
  }
}

function formatTime(t?: string) {
  if (!t) return '-';
  try {
    const d = new Date(t);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return `${Math.floor(diff / 1000)} 秒前`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return d.toLocaleString('zh-CN');
  } catch {
    return t;
  }
}

function connectAgent(row: IAgentRow) {
  if (!row.is_online) {
    window.$message?.warning('该被控端不在线');
    return;
  }
  // 跳转到 webrtc 远控页，把 device_id 作为 deskUserUuid 传入
  router.push({
    path: '/webrtc',
    query: { deskUserUuid: row.device_id, autoConnect: '1' },
  });
}

// ===== 配置弹窗 =====
const configModalVisible = ref(false);
const configEditing = ref<IAgentRow | null>(null);
const configSaving = ref(false);
const editConfig = reactive({
  lockOnDisconnect: false,
  privacyMode: false,
  privacyAlsoLock: true,
  privacyText: '',
});

function openConfig(row: IAgentRow) {
  configEditing.value = row;
  const cfg = row.custom_config || {};
  editConfig.lockOnDisconnect = !!cfg.lockOnDisconnect;
  editConfig.privacyMode = !!cfg.privacyMode;
  editConfig.privacyAlsoLock = cfg.privacyAlsoLock !== false;
  editConfig.privacyText = cfg.privacyText || '';
  configModalVisible.value = true;
}

async function saveConfig() {
  if (!configEditing.value) return;
  configSaving.value = true;
  try {
    const res = await agentUpdateConfig(configEditing.value.id, {
      custom_config: {
        lockOnDisconnect: editConfig.lockOnDisconnect,
        privacyMode: editConfig.privacyMode,
        privacyAlsoLock: editConfig.privacyAlsoLock,
        privacyText: editConfig.privacyText,
      },
    });
    if (res?.code === 200 || res?.code === 0) {
      window.$message?.success('配置已推送（被控端 60 秒内应用）');
      configModalVisible.value = false;
      await loadList();
    } else {
      window.$message?.error(`保存失败：${res?.message}`);
    }
  } catch (e: any) {
    window.$message?.error(
      `保存失败：${e?.response?.data?.message || e?.message}`
    );
  } finally {
    configSaving.value = false;
  }
}

async function renameAgent(row: IAgentRow) {
  // eslint-disable-next-line no-alert
  const name = window.prompt('给这台被控端起个名字：', row.nickname || '');
  if (name === null) return;
  try {
    await agentUpdateConfig(row.id, { nickname: name });
    window.$message?.success('已更新');
    await loadList();
  } catch (e: any) {
    window.$message?.error(`失败：${e?.message}`);
  }
}

async function deleteAgent(row: IAgentRow) {
  if (
    !window.confirm(
      `确定删除被控端 "${row.nickname || row.hostname}"？\n(被控端再次启动会自动重新注册)`
    )
  )
    return;
  try {
    await agentDelete(row.id);
    window.$message?.success('已删除');
    await loadList();
  } catch (e: any) {
    window.$message?.error(`失败：${e?.message}`);
  }
}

onMounted(() => {
  void loadList();
  // 每 10s 自动刷新
  pollTimer = window.setInterval(loadList, 10000);
});

onBeforeUnmount(() => {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});
</script>

<style lang="scss" scoped>
.my-agents-wrap {
  padding: 20px;
  height: 100vh;
  overflow-y: auto;
  box-sizing: border-box;

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    .title {
      font-size: 18px;
      font-weight: 500;
    }
  }
  .hint {
    color: #888;
    font-size: 12px;
    margin-bottom: 16px;
  }
  .empty {
    color: #999;
    text-align: center;
    padding: 40px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
  .agent-card {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 12px;
    background: #fafafa;
    transition: box-shadow 0.2s;
    &.online {
      background: #fff;
      border-color: #18a058;
    }
    &.offline {
      opacity: 0.7;
    }
    &:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }
    .card-head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        &.on {
          background: #18a058;
        }
        &.off {
          background: #ccc;
        }
      }
      .name {
        font-weight: 500;
        flex: 1;
      }
      .badge {
        font-size: 11px;
        background: #eee;
        color: #666;
        padding: 1px 6px;
        border-radius: 3px;
      }
    }
    .card-body {
      .row {
        display: flex;
        font-size: 12px;
        margin-bottom: 4px;
        .k {
          color: #888;
          width: 70px;
          flex-shrink: 0;
        }
        .v {
          color: #333;
          word-break: break-all;
        }
        &.mono .v {
          font-family: monospace;
          font-size: 11px;
          color: #666;
        }
      }
    }
    .card-actions {
      margin-top: 10px;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
  }
  .config-form {
    .cfg-item {
      margin-bottom: 12px;
      &.indent {
        padding-left: 24px;
      }
    }
    .cfg-actions {
      margin-top: 16px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  }
}
</style>
