module.exports = {
  apps: [
    {
      name: "manu-ai-hosted-sandbox",
      cwd: `${process.env.MANU_DEPLOY_ROOT || "/opt/manu-ai"}/current/app`,
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "768M",
      env: {
        NODE_ENV: "production",
        MANU_CI_NO_PRODUCTION_EFFECTS: "true",
      },
    },
  ],
};
