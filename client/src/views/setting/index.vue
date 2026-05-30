<template>
  <div class="setting-wrap">
    <div class="nav"></div>
    <div class="container">
      <template v-if="ipcRenderer">
        <div class="item">
          <div class="label">界面设置</div>
          <div class="value">
            <n-space>
              <div>主窗口置顶：</div>
              <n-radio
                :checked="cacheStore.isAlwaysOnTop"
                @change="cacheStore.isAlwaysOnTop = true"
              >
                是
              </n-radio>
              <n-radio
                :checked="!cacheStore.isAlwaysOnTop"
                @change="cacheStore.isAlwaysOnTop = false"
              >
                否
              </n-radio>
            </n-space>
          </div>
        </div>
        <div class="hr"></div>
        <div class="item">
          <div class="label">远程会话</div>
          <div class="value">
            <n-space>
              <div>断开远控时自动锁屏：</div>
              <n-radio
                :checked="lockOnDisconnectEnabled"
                @change="lockOnDisconnectEnabled = true"
              >
                开启
              </n-radio>
              <n-radio
                :checked="!lockOnDisconnectEnabled"
                @change="lockOnDisconnectEnabled = false"
              >
                关闭
              </n-radio>
            </n-space>
            <div class="hint">
              开启后，当 WebRTC 远控会话从 connected 变为
              disconnected/failed/closed 时，自动锁定本机工作站。
              设置自动保存，重启保留。
            </div>
          </div>
        </div>
        <div class="hr"></div>
        <div class="item">
          <div class="label">隐私模式</div>
          <div class="value">
            <div class="v-item">
              当前状态：
              <span :class="['status', privacyActive ? 'on' : 'off']">
                {{ privacyActive ? '● 已开启' : '○ 未开启' }}
              </span>
            </div>
            <div
              class="v-item"
              style="margin-top: 8px"
            >
              <n-space align="center">
                <span>罩屏文字：</span>
                <n-input
                  v-model:value="privacyText"
                  size="small"
                  placeholder="隐私模式中 · Privacy Mode"
                  style="width: 280px"
                />
              </n-space>
            </div>
            <div
              class="v-item"
              style="margin-top: 8px"
            >
              <n-checkbox v-model:checked="privacyAlsoLock">
                同时锁定工作站（推荐，强烈建议保持开启）
              </n-checkbox>
            </div>
            <div
              class="v-item"
              style="margin-top: 12px"
            >
              <n-space>
                <n-button
                  size="small"
                  type="primary"
                  :disabled="privacyActive || privacyBusy"
                  @click="handlePrivacyOn"
                >
                  立即开启
                </n-button>
                <n-button
                  size="small"
                  :disabled="!privacyActive || privacyBusy"
                  @click="handlePrivacyOff"
                >
                  关闭隐私模式
                </n-button>
                <n-button
                  size="small"
                  type="warning"
                  ghost
                  :disabled="privacyActive || privacyBusy"
                  @click="handlePrivacyPreview"
                >
                  预览 5 秒（不锁屏）
                </n-button>
              </n-space>
            </div>
            <div class="hint">
              开启后：本地物理屏被罩屏覆盖（看不见桌面），远端通过 WebRTC
              捕获的画面仍然能看到真实桌面。Win10 build 19041 (2004) 及以上 / Win11
              全版本支持。<br />
              <span style="color: #d97706">
                ⚠️ "同时锁定工作站" 开启时，开启隐私模式会立即锁屏；要从本地关闭隐私模式，需先输入密码解锁。
                如担心被锁外面，可先用 "预览 5 秒" 验证效果。
              </span>
            </div>
          </div>
        </div>
        <div class="hr"></div>
      </template>

      <div class="item">
        <div class="label">接口配置</div>
        <div class="value">
          <div class="v-item one">
            <span
              class="link"
              @click="handleCopy(getWssUrl() || WEBSOCKET_URL)"
            >
              wss：{{ getWssUrl() || WEBSOCKET_URL }}
            </span>
          </div>
          <div class="v-item two">
            <span>axios：</span>
            <span
              class="link"
              @click="
                handleOpenExternal({
                  windowId: WINDOW_ID_ENUM.remote,
                  url: getAxiosBaseUrl() || AXIOS_BASEURL,
                })
              "
            >
              <span>{{ getAxiosBaseUrl() || AXIOS_BASEURL }}</span>
              <span>
                <VPIconExternalLink class="icon"></VPIconExternalLink>
              </span>
            </span>
          </div>
          <div class="v-item two">
            <span
              class="link"
              @click="handleCopy(getCoturnUrl() || COTURN_URL)"
            >
              coturn：{{ getCoturnUrl() || COTURN_URL }}
            </span>
          </div>
          <div
            class="v-item edit"
            @click="showUrlModalCpt = true"
          >
            修改
          </div>
        </div>
      </div>
      <div class="hr"></div>
      <div class="item">
        <div class="label">作者信息</div>
        <div class="value">
          <div class="v-item one">
            <span
              class="link"
              @click="handleCopy(AUTHOR_INFO.wechat)"
            >
              微信：{{ AUTHOR_INFO.wechat }}
            </span>
          </div>
          <div class="v-item two">
            <span
              class="link"
              @click="handleCopy(AUTHOR_INFO.qq)"
            >
              QQ：{{ AUTHOR_INFO.qq }}
            </span>
          </div>
          <div class="v-item two">
            <span>
              <span>Github：</span>
              <span
                class="link"
                @click="
                  handleOpenExternal({
                    windowId: WINDOW_ID_ENUM.remote,
                    url: AUTHOR_INFO.github,
                  })
                "
              >
                <span>{{ AUTHOR_INFO.github }}</span>
                <VPIconExternalLink class="icon"></VPIconExternalLink>
              </span>
            </span>
          </div>
        </div>
      </div>
      <div class="hr"></div>
      <div class="item">
        <div class="label">网页版体验</div>
        <div class="value">
          <div class="v-item one">
            <span
              class="link"
              @click="
                handleOpenExternal({
                  windowId: WINDOW_ID_ENUM.remote,
                  url: WEB_DESK_URL,
                })
              "
            >
              <span>{{ WEB_DESK_URL }}</span>
              <VPIconExternalLink class="icon"></VPIconExternalLink>
            </span>
          </div>
        </div>
      </div>
      <div class="hr"></div>
      <div class="item">
        <div class="label">私有化部署</div>
        <div class="value">
          <div class="v-item one">
            <span
              class="link"
              @click="
                handleOpenExternal({
                  windowId: WINDOW_ID_ENUM.remote,
                  url: COMMON_URL.privatizationDeployment,
                })
              "
            >
              <span>了解详情</span>
              <VPIconExternalLink class="icon"></VPIconExternalLink>
            </span>
          </div>
        </div>
      </div>
      <div class="hr"></div>
      <div class="item">
        <div class="label">下载客户端</div>
        <div class="value">
          <div class="v-item one">
            <div class="client-list">
              <div
                v-for="(item, index) in clientList"
                :key="index"
                class="client-btn"
                @click="
                  jumpToDownload({
                    windowId: WINDOW_ID_ENUM.remote,
                    url: item.url,
                  })
                "
              >
                <div class="name">{{ item.label }}</div>
                <div class="ext">{{ item.ext }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="hr"></div>
      <div class="item">
        <div class="label">关于{{ PRODUCT_NAME }}</div>
        <div class="value">
          <div class="v-item one">
            <span>
              当前版本：v{{ appStore.version }}（{{ appStore.lastBuildDate }}）
            </span>
            <span
              v-if="ipcRenderer"
              class="btn"
              @click="handleDeskVersionCheck"
            >
              检查更新
            </span>
          </div>
        </div>
      </div>
    </div>
    <UrlModalCpt
      v-if="showUrlModalCpt"
      @close="showUrlModalCpt = false"
    ></UrlModalCpt>
  </div>
</template>

<script lang="ts" setup>
import { copyToClipBoard } from 'billd-utils';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { fetchDeskVersionCheck } from '@/api/deskVersion';
import {
  AUTHOR_INFO,
  AXIOS_BASEURL,
  COMMON_URL,
  COTURN_URL,
  PRODUCT_NAME,
  WEB_DESK_URL,
  WEBSOCKET_URL,
  WINDOW_ID_ENUM,
} from '@/constant';
import { IPC_EVENT } from '@/event';
import { useIpcRendererSend } from '@/hooks/use-ipcRendererSend';
import { useAppStore } from '@/store/app';
import { usePiniaCacheStore } from '@/store/cache';
import { ipcRenderer } from '@/utils';
import {
  getAxiosBaseUrl,
  getCoturnUrl,
  getWssUrl,
} from '@/utils/localStorage/app';

import UrlModalCpt from './urlModal.vue';

const appStore = useAppStore();
const cacheStore = usePiniaCacheStore();
const showUrlModalCpt = ref(false);
const { handleOpenExternal, handlesetAlwaysOnTop } = useIpcRendererSend();

// 远控断开自动锁屏开关。从主进程读初始值，用户拨动后写回并持久化
const lockOnDisconnectEnabled = ref(false);
// 记录上一次"已同步"到主进程的值；watch 触发时如果新值等于上一次同步值就不重复写
// 避免 onMounted 把磁盘里的 true 读回来时，watch 又把它当作"用户改了"echo 回去多调一次 IPC + 弹 toast
let lastSyncedValue: boolean | null = null;

onMounted(async () => {
  if (!ipcRenderer) return;
  try {
    const res: any = await ipcRenderer.invoke(
      IPC_EVENT.silent_lockOnDisconnect_get
    );
    const initial = !!res?.data?.enabled;
    lastSyncedValue = initial; // 必须在赋值前设好，否则 watch 触发时还是 null 会进 if 体
    lockOnDisconnectEnabled.value = initial;
  } catch (e) {
    console.warn('读取自动锁屏开关失败', e);
    lastSyncedValue = false;
  }
});

watch(lockOnDisconnectEnabled, async (v) => {
  if (!ipcRenderer) return;
  // 初始加载阶段的 echo / 重复设同值，都跳过
  if (lastSyncedValue === v) return;
  try {
    await ipcRenderer.invoke(IPC_EVENT.silent_lockOnDisconnect, {
      enabled: v,
    });
    lastSyncedValue = v;
    window.$message?.success(v ? '已开启：断开远控自动锁屏' : '已关闭自动锁屏');
  } catch (e) {
    console.error('设置自动锁屏开关失败', e);
    window.$message?.error('设置失败');
  }
});

// ===== 隐私模式 =====
const privacyActive = ref(false);
const privacyText = ref('');
const privacyAlsoLock = ref(true);
const privacyBusy = ref(false);
let privacyPollTimer: number | null = null;
let privacyPreviewTimer: number | null = null;

async function refreshPrivacyState() {
  if (!ipcRenderer) return;
  try {
    const res: any = await ipcRenderer.invoke(
      IPC_EVENT.silent_privacyMode_get
    );
    privacyActive.value = !!res?.data?.active;
  } catch {
    /* ignore */
  }
}

async function handlePrivacyOn() {
  if (!ipcRenderer || privacyBusy.value) return;
  privacyBusy.value = true;
  try {
    const res: any = await ipcRenderer.invoke(IPC_EVENT.silent_privacyMode, {
      text: privacyText.value || undefined,
      alsoLock: privacyAlsoLock.value,
    });
    if (res?.code === 0) {
      // 不直接 set true：用 refresh 拿真实状态（self-heal 万一 main 早返回）
      await refreshPrivacyState();
      window.$message?.success(
        privacyAlsoLock.value
          ? '隐私模式已开启（工作站已锁定）'
          : '隐私模式已开启'
      );
    } else {
      window.$message?.error(`开启失败：${res?.msg || '未知错误'}`);
    }
  } catch (e) {
    console.error(e);
    window.$message?.error('开启失败');
  } finally {
    privacyBusy.value = false;
  }
}

async function handlePrivacyOff() {
  if (!ipcRenderer || privacyBusy.value) return;
  privacyBusy.value = true;
  try {
    const res: any = await ipcRenderer.invoke(
      IPC_EVENT.silent_privacyMode_off
    );
    if (res?.code === 0) {
      await refreshPrivacyState();
      window.$message?.success('隐私模式已关闭');
    } else {
      window.$message?.error(`关闭失败：${res?.msg || '未知错误'}`);
    }
  } catch (e) {
    console.error(e);
    window.$message?.error('关闭失败');
  } finally {
    privacyBusy.value = false;
  }
}

// 预览：开启 5 秒后自动关闭，且强制 alsoLock=false（不锁屏），避免把自己锁外面
async function handlePrivacyPreview() {
  if (!ipcRenderer || privacyBusy.value) return;
  privacyBusy.value = true;
  try {
    const res: any = await ipcRenderer.invoke(IPC_EVENT.silent_privacyMode, {
      text: privacyText.value || '【预览模式】5 秒后自动关闭',
      alsoLock: false,
    });
    if (res?.code !== 0) {
      window.$message?.error(`预览失败：${res?.msg || '未知错误'}`);
      privacyBusy.value = false;
      return;
    }
    await refreshPrivacyState();
    window.$message?.info('预览中，5 秒后自动关闭');
    privacyPreviewTimer = window.setTimeout(async () => {
      privacyPreviewTimer = null;
      try {
        await ipcRenderer.invoke(IPC_EVENT.silent_privacyMode_off);
      } catch {
        /* ignore */
      }
      await refreshPrivacyState();
      privacyBusy.value = false;
    }, 5000);
  } catch (e) {
    console.error(e);
    window.$message?.error('预览失败');
    privacyBusy.value = false;
  }
}

onMounted(() => {
  if (!ipcRenderer) return;
  void refreshPrivacyState();
  // 轮询：罩屏可能被外部 IPC（远端或其他来源）开关，需要保持 UI 状态同步
  privacyPollTimer = window.setInterval(refreshPrivacyState, 3000);
});

onBeforeUnmount(() => {
  if (privacyPollTimer !== null) {
    clearInterval(privacyPollTimer);
    privacyPollTimer = null;
  }
  // 取消未执行的预览定时器，避免组件卸载后还回调写 ref + 误关其他 session
  if (privacyPreviewTimer !== null) {
    clearTimeout(privacyPreviewTimer);
    privacyPreviewTimer = null;
  }
});

const clientList = ref<
  {
    label: string;
    ext: string;
    url: string;
  }[]
>([]);

function handleCopy(str) {
  copyToClipBoard(str);
  window.$message.success('复制成功！');
}

watch(
  () => cacheStore.isAlwaysOnTop,
  () => {
    handlesetAlwaysOnTop({
      windowId: WINDOW_ID_ENUM.remote,
      flag: cacheStore.isAlwaysOnTop,
    });
  },
  { immediate: true }
);

watch(
  () => appStore.deskVersionInfo,
  (newval) => {
    if (newval) {
      Object.keys(newval).forEach((item) => {
        if (item.indexOf('download_linux') !== -1) {
          const arr = item.split('_');
          const bit = arr[2] === 'arm' ? 'arm' : `${arr[2]}bit`;
          clientList.value.push({
            label: `${arr[1]}(${bit})`,
            ext: arr[3],
            url: newval[item],
          });
        }
        if (item.indexOf('download_windows') !== -1) {
          const arr = item.split('_');
          const bit = arr[2] === 'arm' ? 'arm' : `${arr[2]}bit`;
          clientList.value.push({
            label: `${arr[1]}(${bit})`,
            ext: arr[3],
            url: newval[item],
          });
        }
        if (item.indexOf('download_macos') !== -1) {
          const arr = item.split('_');
          clientList.value.push({
            label: `${arr[1]}`,
            ext: arr[2],
            url: newval[item],
          });
        }
      });
    }
  },
  { immediate: true, deep: true }
);

function jumpToDownload({ windowId, url }) {
  if (!url || url === '') {
    window.$message.info('敬请期待！');
    return;
  }
  handleOpenExternal({
    windowId,
    url,
  });
}

async function handleDeskVersionCheck() {
  const res = await fetchDeskVersionCheck(appStore.version);
  if (res.code === 200 && res.data) {
    appStore.updateModalInfo = res.data;
    if (appStore.updateModalInfo?.checkUpdate === 2) {
      window.$message.success('当前不需要更新');
    } else if (appStore.updateModalInfo?.isUpdate === 2) {
      window.$message.success('当前是最新版本');
    }
  }
}
</script>

<style lang="scss" scoped>
.setting-wrap {
  box-sizing: border-box;
  height: 100vh;
  .nav {
    height: $top-system-bar-height;
  }
  .container {
    overflow: scroll;
    padding: 0 40px;
    height: calc(100vh - $top-system-bar-height);

    @extend %customScrollbarHide;
    &:hover {
      @extend %customScrollbar;
    }
    .item {
      display: flex;
      margin-bottom: 20px;
      .icon {
        margin-left: 5px;
        width: 12px;
        height: 12px;
        vertical-align: middle;
      }
      .label {
        margin-right: 20px;
        width: 100px;
        text-align: right;
        font-weight: 500;
        font-size: 15px;
      }
      .value {
        flex: 1;
        color: #666;
        font-size: 14px;
        .hint {
          margin-top: 6px;
          color: #999;
          font-size: 12px;
          line-height: 1.6;
        }
        .status {
          font-weight: 500;
          &.on {
            color: #18a058;
          }
          &.off {
            color: #999;
          }
        }
        .v-item {
          margin-bottom: 5px;

          .link {
            cursor: pointer;
          }
          &.edit {
            font-size: 13px;
            cursor: pointer;
          }
          &.one {
            .btn {
              padding: 2px 10px;
              border: 1px solid #bec3ca;
              border-radius: 20px;
              font-size: 12px;
              cursor: pointer;

              user-select: none;
            }
            .client-list {
              display: flex;
              flex-wrap: wrap;
              .client-btn {
                display: flex;
                margin-right: 10px;
                margin-bottom: 10px;
                height: 30px;
                border-radius: 5px;
                background: #448ccb;
                color: white;
                font-size: 14px;
                line-height: 30px;
                cursor: pointer;

                user-select: none;
                .name {
                  width: 120px;
                  text-align: center;
                }
                .ext {
                  width: 40px;
                  background-color: #0000005c;
                  text-align: center;
                }
              }
            }
          }
          &.two {
            .btn {
              margin-right: 10px;
              padding: 2px 10px;
              border: 1px solid #bec3ca;
              border-radius: 20px;
              font-size: 12px;
              cursor: pointer;

              user-select: none;
            }
          }
        }
      }
    }
    .hr {
      margin: 20px 0;
      width: 100%;
      height: 1px;
      background-color: #ebedf1;
    }
  }
}
</style>
