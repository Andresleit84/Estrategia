// ================================================================
// PM2 Ecosystem — gestión de procesos en el servidor
// Uso producción : pm2 start ecosystem.config.js --env production
// Uso desarrollo : pm2 start ecosystem.config.js --env development
// ================================================================

module.exports = {
  apps: [
    {
      name: 'okr-backend',
      cwd: './backend',
      script: 'dist/main.js',
      instances: 'max',           // un proceso por núcleo de CPU
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3020,
        COOKIE_SECURE: 'false',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3020,
        COOKIE_SECURE: 'false',
      },
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
    {
      name: 'okr-frontend',
      cwd: './frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      instances: 1,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
      error_file: '../logs/frontend-error.log',
      out_file: '../logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── Agents ────────────────────────────────────────────────────────────────

    {
      // Super Agent: Telegram bot + sub-agent supervisor + IPC hub
      name: 'okr-super-agent',
      script: 'scripts/super-agent.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '128M',
      env: { NODE_ENV: 'production' },
      env_production: { NODE_ENV: 'production' },
      error_file: 'logs/super-agent-error.log',
      out_file:   'logs/super-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      // Monitor Agent: health polling + auto-restart
      name: 'okr-monitor',
      script: 'scripts/monitor-agent.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '128M',
      env: { NODE_ENV: 'production' },
      env_production: { NODE_ENV: 'production' },
      error_file: 'logs/monitor-error.log',
      out_file:   'logs/monitor-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      // Test Agent: nightly Jest run (cron_restart) — runs once then exits
      name: 'okr-test-agent',
      script: 'scripts/test-agent.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: false,
      cron_restart: '0 2 * * *',   // 02:00 every day
      env: { NODE_ENV: 'production' },
      env_production: { NODE_ENV: 'production' },
      error_file: 'logs/test-agent-error.log',
      out_file:   'logs/test-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
