// PM2 进程守护配置（Windows 原生部署 / 宝塔 Windows 面板）
// 用法：
//   cd server
//   pnpm i -g pm2 pm2-windows-startup
//   pnpm run build
//   pm2 start ecosystem.config.cjs --env production
//   pm2 save
//   pm2-startup install     # 设为 Windows 服务，开机自启
//
// 更新代码后：
//   git pull && pnpm i && pnpm run build && pm2 reload billd-desk-server

module.exports = {
  apps: [
    {
      name: 'billd-desk-server',
      script: './dist/index.js',
      cwd: __dirname,
      instances: 1, // 2H4G 不要起多实例，socket.io 跨实例需要 redis-adapter 加上粘性会话
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G', // 超过 1G 自动重启，防内存泄漏拖垮系统
      kill_timeout: 5000,
      listen_timeout: 30000,
      restart_delay: 3000,
      max_restarts: 50,
      env: {
        NODE_ENV: 'production',
        NODE_APP_RELEASE_PROJECT_NAME: 'billd-desk-server',
        NODE_APP_RELEASE_PROJECT_ENV: 'prod',
        NODE_APP_RELEASE_PROJECT_PORT: '4200',
        TZ: 'Asia/Shanghai',
      },
      env_production: {
        NODE_ENV: 'production',
        NODE_APP_RELEASE_PROJECT_NAME: 'billd-desk-server',
        NODE_APP_RELEASE_PROJECT_ENV: 'prod',
        NODE_APP_RELEASE_PROJECT_PORT: '4200',
        TZ: 'Asia/Shanghai',
      },
      // 日志路径（宝塔的 PM2 管理器也会读这里）
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
