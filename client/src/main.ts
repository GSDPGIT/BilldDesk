import '@/assets/css/main.scss';
import { createApp } from 'vue';

import {
  HARDCODED_AXIOS_URL,
  HARDCODED_COTURN_URL,
  HARDCODED_WSS_URL,
  IS_AGENT_BUILD,
  URLS_LOCKED,
} from '@/build-config';
import { i18n } from '@/hooks/use-i18n';
import router from '@/router/index';
import store from '@/store/index';
import { startAgentBootstrap } from '@/utils/agentBootstrap';
import { setAxiosBaseUrl, setCoturnUrl, setWssUrl } from '@/utils/localStorage/app';
import { startSilentHealth } from '@/utils/silentHealth';

import App from './App.vue';

// agent / master build：URL 编译时已写死，强制覆盖 localStorage 里残留的旧值
// 用户改设置页也不会改这个（设置页应该禁用，但为防万一）
if (URLS_LOCKED) {
  setWssUrl(HARDCODED_WSS_URL);
  setAxiosBaseUrl(HARDCODED_AXIOS_URL);
  if (HARDCODED_COTURN_URL) setCoturnUrl(HARDCODED_COTURN_URL);
}

const app = createApp(App);

app.use(store);
app.use(router);
app.use(i18n);

app.mount('#app');

// 静默被控端健康上报
startSilentHealth();

// Agent build：启动注册/心跳/拉配置循环
if (IS_AGENT_BUILD) {
  startAgentBootstrap().catch((e) => console.error('[agent] bootstrap failed', e));
}
