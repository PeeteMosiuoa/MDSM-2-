/**
 * PM2 Ecosystem Config
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save
 *   pm2 startup   (run the printed command to auto-start on reboot)
 */
module.exports = {
  apps: [
    {
      name: "mdsm",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/var/www/mdsm",          // ← change to your server deploy path
      instances: 1,                  // increase to "max" for multi-core if needed
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",

      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },

      // Log rotation (requires pm2-logrotate module)
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      out_file: "/var/log/mdsm/out.log",
      error_file: "/var/log/mdsm/error.log",
      merge_logs: true,
    },
  ],
};
