module.exports = {
  apps: [
    {
      name: "manu-ai-hosted-sandbox",
      cwd: "/opt/manu-ai/current/app",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
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
