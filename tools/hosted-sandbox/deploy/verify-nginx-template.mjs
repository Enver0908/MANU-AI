#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const templatePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "nginx", "hosted-sandbox.conf.template");
const appHeadersPath = path.join(repoRoot, "app", "src", "lib", "hosted-sandbox-security-headers.ts");
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
  "proxy_set_header Host $host",
  "proxy_set_header X-Forwarded-Host $host",
  "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for",
  "proxy_set_header X-Real-IP $remote_addr",
  "proxy_set_header X-Forwarded-Proto $scheme",
];
for (const needle of required) {
  if (!content.includes(needle)) throw new Error("nginx template missing: " + needle);
}
const appHeaders = readFileSync(appHeadersPath, "utf8");
const appCsp = appHeaders.match(/HOSTED_SANDBOX_CONTENT_SECURITY_POLICY\s*=\s*\n\s*"([^"]+)"/)?.[1];
const nginxCsp = content.match(/add_header Content-Security-Policy "([^"]+)" always;/)?.[1];
if (!appCsp || !nginxCsp || appCsp !== nginxCsp) {
  throw new Error("nginx CSP must match app hosted sandbox CSP exactly");
}
process.stdout.write(JSON.stringify({ result: "PASS", templatePath }, null, 2) + "\n");
