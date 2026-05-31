// ⚠️ 此文件必须是 main.ts 第一个 import
// 原因：utils/request.ts 用 getAxiosBaseUrl() 在模块加载时就锁定 baseURL
// 如果 URL 写到 localStorage 的动作放在 main.ts 的 if 块里，
// 等执行到那里时 request.ts 已经 import 完成并锁定了旧值。
//
// 此文件**只能**依赖：build-config + utils/localStorage/app + utils/cache + billd-utils
// （这些都没有间接 import request.ts）
import {
  HARDCODED_AXIOS_URL,
  HARDCODED_COTURN_URL,
  HARDCODED_WSS_URL,
  URLS_LOCKED,
} from '@/build-config';
import {
  setAxiosBaseUrl,
  setCoturnUrl,
  setWssUrl,
} from '@/utils/localStorage/app';

if (URLS_LOCKED) {
  try {
    setWssUrl(HARDCODED_WSS_URL);
    setAxiosBaseUrl(HARDCODED_AXIOS_URL);
    if (HARDCODED_COTURN_URL) setCoturnUrl(HARDCODED_COTURN_URL);
    // eslint-disable-next-line no-console
    console.log('[early-init] hardcoded URLs applied');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[early-init] failed to apply URLs', e);
  }
}
