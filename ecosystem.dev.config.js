// ================================================================
// PM2 Ecosystem — AMBIENTE DE DESARROLLO
// DB: Estrategia_dev  |  Backend: 3021  |  Frontend: 3001
//
// Uso:
//   pm2 start ecosystem.dev.config.js
//   pm2 stop ecosystem.dev.config.js
//   pm2 logs okr-backend-dev
//
// Preparar DB dev (primera vez):
//   bash scripts/setup-dev-db.sh
//
// ARQUITECTURA DE DOS PROCESOS (fix ERROR_BROKEN_PIPE 0x800700E8):
//   "nest start --watch" spawna cmd.exe → node internamente; cuando SWC
//   recompila, PM2 pierde el pipe a cmd.exe y genera ráfagas de errores.
//   Solución: okr-compiler solo compila (nunca spawna un servidor),
//   okr-backend-dev ejecuta dist/main.js directamente — PM2 es el padre
//   directo de node, sin cmd.exe intermediario. Restart limpio, sin pipe.
// ================================================================

module.exports = {
  apps: [
    {
      // Compilador SWC en modo watch — solo escribe a dist/, nunca spawna servidor
      name: 'okr-compiler',
      cwd: './backend',
      script: 'node_modules/@nestjs/cli/bin/nest.js',
      args: 'build --watch',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      windowsHide: true,
      autorestart: true,
      max_restarts: 10,
      kill_timeout: 3000,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'development', ENV_FILE: '../.env.dev' },
      error_file: '../logs/compiler-error.log',
      out_file: '../logs/compiler-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      // Servidor — nodemon gestiona el reinicio de node (no PM2 watch).
      // Así se evita el loop de reinicios que ocurre cuando PM2 watch detecta
      // los múltiples writes de SWC a dist/ y mata el proceso antes de que
      // NestJS pueda arrancar y bindear el puerto.
      // nodemon debouncea 2s y reinicia cuando cualquier archivo de dist/ cambia.
      // Se excluye dist/main.js.map para evitar doble-restart al compilar.
      name: 'okr-backend-dev',
      cwd: './backend',
      script: 'node_modules/nodemon/bin/nodemon.js',
      args: '--watch dist --ext js --ignore dist/main.js.map --delay 2 --exec "node --enable-source-maps dist/main.js"',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      windowsHide: true,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      kill_timeout: 8000,
      max_memory_restart: '1024M',
      env: {
        NODE_ENV: 'development',
        PORT: 3021,
        ENV_FILE: '../.env.dev',
        NODE_OPTIONS: '--max-old-space-size=1024',
      },
      error_file: '../logs/backend-dev-error.log',
      out_file: '../logs/backend-dev-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
    {
      name: 'okr-super-agent-dev',
      cwd: 'D:/estrategia/scripts',
      script: 'D:/estrategia/scripts/super-agent.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      windowsHide: true,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '5s',
      kill_timeout: 3000,
      env: { NODE_ENV: 'development', ENV_FILE: '../.env.dev' },
      error_file: '../logs/super-agent-error.log',
      out_file: '../logs/super-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'okr-monitor-dev',
      cwd: 'D:/estrategia/scripts',
      script: 'D:/estrategia/scripts/monitor-agent.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      windowsHide: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      kill_timeout: 3000,
      env: { NODE_ENV: 'development', ENV_FILE: '../.env.dev' },
      error_file: '../logs/monitor-error.log',
      out_file: '../logs/monitor-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'okr-test-agent-dev',
      cwd: 'D:/estrategia/scripts',
      script: 'D:/estrategia/scripts/test-agent.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      windowsHide: true,
      autorestart: false,
      cron_restart: '0 2 * * *',
      kill_timeout: 120000,
      env: { NODE_ENV: 'development', ENV_FILE: '../.env.dev' },
      error_file: '../logs/test-agent-error.log',
      out_file: '../logs/test-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'okr-frontend-dev',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'dev -p 3001',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      windowsHide: true,         // evita ventanas cmd.exe visibles en Windows
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      max_memory_restart: '512M',
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      error_file: '../logs/frontend-dev-error.log',
      out_file: '../logs/frontend-dev-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
