/** PM2 process manager — uso: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: 'matubyte-growth-factory',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        // VPS compartido: MatuCash usa 4100; nginx growth.matubyte.com → 4101
        PORT: '4101',
      },
      max_memory_restart: '800M',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
