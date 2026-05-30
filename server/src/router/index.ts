import fs from 'fs';

import Router from 'koa-router';

import { PROJECT_ENV, PROJECT_ENV_ENUM, PROJECT_NAME } from '@/constant';
import { chalkERROR, chalkINFO, chalkSUCCESS, chalkWARN } from '@/utils/chalkTip';

const router = new Router();

// =====================================================================
// BilldDesk 精简版（GSDPGIT fork）：禁用与远程桌面无关的 router
// 原仓库 billd-desk-server 是 billd-live + billd-desk 共用代码，
// 直播 / 支付 / 第三方登录 这些 router 对纯远控部署是死代码，
// 且会因 secret 占位符未填启动报错。这里按文件名维度跳过加载。
// 想恢复某个 router，删掉对应行即可。
// =====================================================================
const DISABLED_ROUTERS = new Set<string>([
  // 直播相关
  'live.router',
  'liveConfig.router',
  'livePlay.router',
  'liveRecord.router',
  'liveRoom.router',
  'userLiveRoom.router',
  'srs.router',
  'bilibili.router',
  'tencentcloudCss.router',
  // 支付 / 钱包 / 商品 / 礼物
  'order.router',
  'wallet.router',
  'walletRecord.router',
  'goods.router',
  'giftRecord.router',
  // 签到 / 第三方登录（不用远控就不需要）
  'signinRecord.router',
  'signinStatistics.router',
  'qqUser.router',
  'wechatUser.router',
  // 七牛云上传
  'qiniuData.router',
  // 全站消息（直播弹幕场景用，远控用不到）
  'globalMsg.router',
]);

function isDisabled(file: string): boolean {
  const base = file.replace(/\.(ts|js)$/i, '');
  return DISABLED_ROUTERS.has(base);
}

export function loadAllRoutes(app) {
  router.get('/', async (ctx, next) => {
    ctx.body = {
      message: `欢迎访问${PROJECT_NAME},当前环境是:${PROJECT_ENV},当前时间:${new Date().toLocaleString()}`,
    };
    await next();
  });
  app.use(router.routes()).use(router.allowedMethods());

  const err: string[] = [];
  const skipped: string[] = [];
  fs.readdirSync(__dirname).forEach((file) => {
    try {
      if (PROJECT_ENV === PROJECT_ENV_ENUM.development) {
        if (file === 'index.ts') return;
      } else if (PROJECT_ENV === PROJECT_ENV_ENUM.prod) {
        if (file === 'index.js') return;
      } else if (file === 'index.js') return;

      if (isDisabled(file)) {
        skipped.push(file);
        return;
      }

      const allRouter = require(`./${file}`).default;
      app.use(allRouter.routes()).use(allRouter.allowedMethods());
      console.log(chalkINFO(`加载路由: ${file}`));
    } catch (error) {
      err.push(file);
      console.log(chalkERROR(`加载路由: ${file}出错!`));
      console.log(error);
    }
  });
  if (skipped.length) {
    console.log(
      chalkWARN(`已跳过 ${skipped.length} 个非远控路由: ${skipped.join(', ')}`)
    );
  }
  if (err.length) {
    console.log(chalkERROR(`加载路由: ${err.toString()}出错！`));
    throw new Error('');
  } else {
    console.log(chalkSUCCESS('加载所有路由成功！'));
  }
}
