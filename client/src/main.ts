// ⚠️ early-init 必须放在所有其他 import 前面
// 它会把编译时写死的 URL 灌到 localStorage，让 request.ts 在它自己被 import 时
// 读到正确的 baseURL（而不是用户上次留下的旧值或默认值）
import './early-init';

import '@/assets/css/main.scss';
import { createApp } from 'vue';

import { IS_AGENT_BUILD } from '@/build-config';
import { i18n } from '@/hooks/use-i18n';
import router from '@/router/index';
import store from '@/store/index';
import { startAgentBootstrap } from '@/utils/agentBootstrap';
import { startSilentHealth } from '@/utils/silentHealth';

import App from './App.vue';

const app = createApp(App);

app.use(store);
app.use(router);
app.use(i18n);

app.mount('#app');

// 静默被控端健康上报
startSilentHealth();

// Agent build：启动注册/心跳/拉配置循环
if (IS_AGENT_BUILD) {
  startAgentBootstrap().catch((e) =>
    // eslint-disable-next-line no-console
    console.error('[agent] bootstrap failed', e)
  );
}
