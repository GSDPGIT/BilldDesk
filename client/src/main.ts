import '@/assets/css/main.scss';
import { createApp } from 'vue';

import { i18n } from '@/hooks/use-i18n';
import router from '@/router/index';
import store from '@/store/index';
import { startSilentHealth } from '@/utils/silentHealth';

import App from './App.vue';

const app = createApp(App);

app.use(store);
app.use(router);
app.use(i18n);

app.mount('#app');

// 静默被控端健康上报：每 5s 把 WebRTC 状态告诉主进程
// 非静默模式下主进程的 handler 也接，写文件无副作用
startSilentHealth();
