#!/usr/bin/env node
/**
 * Serves the production build on all interfaces for real-device PWA capture.
 */

import { networkInterfaces } from "node:os";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { appRoot } from "./lib/stage-5-evidence.mjs";

const port = process.env.STAGE5_REAL_DEVICE_PORT || "3110";
const baseUrl = process.env.STAGE5_REAL_DEVICE_BASE_URL || `http://127.0.0.1:${port}`;
const nextCliPath = join(appRoot, "node_modules", "next", "dist", "bin", "next");

function localIpv4Addresses() {
  return Object.values(networkInterfaces())
    .flatMap((items) => items ?? [])
    .filter((item) => item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
}

console.log("[stage-5-real-device] serving production build for physical-device capture");
console.log(`[stage-5-real-device] local URL: http://127.0.0.1:${port}`);
for (const address of localIpv4Addresses()) {
  console.log(`[stage-5-real-device] LAN URL: http://${address}:${port}`);
}

const child = spawn(process.execPath, [nextCliPath, "start", "--hostname", "0.0.0.0", "--port", port], {
  cwd: appRoot,
  env: {
    ...process.env,
    MANU_DEV_FALLBACK_STORE: "true",
    MANU_ALLOW_PUBLIC_DEMO_LOGIN: "true",
    AI_CHAT_UI_ENABLED: "true",
    AI_CHAT_DETERMINISTIC_MODE: "true",
    NEXT_PUBLIC_APP_URL: baseUrl,
    MANU_ADMIN_APP_URL: baseUrl,
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
