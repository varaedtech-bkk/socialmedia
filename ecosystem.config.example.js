module.exports = {
  apps: [
    {
      name: "multisocial",
      script: "./dist/index.js",
      env_production: {
        NODE_ENV: "production",
      },
      error_file: "/var/log/multisocial/err.log",
      out_file: "/var/log/multisocial/out.log",
      log_file: "/var/log/multisocial/combined.log",
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      max_restarts: 10,
      min_uptime: "10s",
      log_type: "json",
      instances: 1,
      exec_mode: "fork",
    },
  ],
};

