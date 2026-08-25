#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const templatePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "nginx", "hosted-sandbox.conf.template");
const content = readFileSync(templatePath, "utf8");
const required = [
  "server_tokens off",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Content-Security-Policy",
  "frame-ancestors",
  "Strict-Transport-Security",
  "no-cache",
  "immutable",
  "proxy_hide_header X-Powered-By",
];
for (const needle of required) {
  if (!content.includes(needle)) throw new Error("nginx template missing: " + needle);
}
process.stdout.write(JSON.stringify({ result: "PASS", templatePath }, null, 2) + "\n");
