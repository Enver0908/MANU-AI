# AIya Local Release Parity Verification Evidence

Date: 2026-09-01
Branch: `codex/production-readiness-stage-1`
Verification HEAD: `2b33cc661b17ae171547ad23fe1b19328ea261db`
AIya code baseline: `609f31089d10d6e51aee59fad013efa2fa3144e9`
Status: `PHASE_2_LOCAL_PARITY_VERIFIED`

## Boundary

No deploy, remote migration, VPS change, PM2/nginx change, DNS change, Supabase Auth change, Resend change, Stripe change, WhatsApp change, Z.ai change, worker start, live provider/channel traffic, live billing, production `GO`, or real health-data processing was executed.

## Verification Commands

### Typecheck

Command:

```text
npm run typecheck
```

Result: `PASS`.

### Lint

Command:

```text
npm run lint
```

Result: `PASS` with `0 errors` and `77 warnings`.

The warnings match the existing unused-symbol warning class and were not treated as errors.

### Targeted AIya Brand/PWA Tests

Command:

```text
npx vitest run src/lib/phase-85-stage-5-shell-branding.test.ts src/lib/phase-85-stage-5-shell-pwa.test.ts src/lib/phase-83d-pwa-install-gate.test.ts src/lib/commercial-admin-access.test.ts src/lib/hosted-sandbox-runtime-fixes.test.ts --no-file-parallelism --maxWorkers=1
```

Result: `PASS`.

Summary:

```text
Test Files  5 passed (5)
Tests       24 passed (24)
```

### Production Build

Command:

```text
npm run build
```

Result: `PASS`.

Observed build output included `/app-install`, `/api/app-state`, `/api/clients`, `/manifest.webmanifest`, public routes, admin routes, and `/api/health/release`.

Known warning: Next.js reported custom cache-control headers for `/_next/static/:path*`.

### Local Production Server Smoke

Command shape:

```text
npx next start -p 3101 -H 127.0.0.1
curl local public, app-install, manifest, app-state, clients, and release routes
```

Result: `PASS` for local parity.

Observed routes:

- `http://127.0.0.1:3101/` -> `200`
- `http://127.0.0.1:3101/login` -> `200`
- `http://127.0.0.1:3101/purchase` -> `200`
- `http://127.0.0.1:3101/app-install` -> `307` to `/`; following redirects returns `200`
- `http://127.0.0.1:3101/manifest.webmanifest` -> `200`
- `http://127.0.0.1:3101/api/health/release` -> `200`
- `http://127.0.0.1:3101/api/app-state` -> `401 Unauthorized`
- `http://127.0.0.1:3101/api/clients` -> `401 Unauthorized`

Local release health observed:

```json
{
  "status": "ok",
  "releaseId": "hs-2b33cc661b17-2c32cf194421",
  "commitSha": "2b33cc661b17ae171547ad23fe1b19328ea261db",
  "migrationFingerprint": "2c32cf1944215123cd9a90999c906a5e49b7e3c6f1d145a3805afb4d929d78bd",
  "compatibilityVersion": "0.0.0+2b33cc6"
}
```

Note: `next start` reported the existing standalone-output warning. The local smoke still responded successfully. Hosted deploy should use the established standalone runtime path rather than treating this warning as a blocker.

### Local Manifest Smoke

Command:

```text
curl.exe -sS http://127.0.0.1:3101/manifest.webmanifest
```

Result: `PASS`.

Observed manifest:

- `name`: `AIya`
- `short_name`: `AIya`
- `description`: `AIya supervised dietitian messaging assistant.`
- icon paths use `/icons/aiya-*`

### Active-Surface Legacy Brand Scan

Command:

```text
rg -n "SiriusAI|MANU-AI|AI-ya|ai-ya|siriusai\.store|olkuenver@gmail\.com" app/src app/public --glob '!**/*.png' --glob '!**/*.ico'
```

Result: `PASS_WITH_ALLOWED_COMPATIBILITY_NOTE`.

Only hit:

```text
app/src/lib/brand.ts: Historical evidence documents can mention MANU-AI, SiriusAI, and siriusai.store as past-state records.
```

### Scoped Secret Scan

Command:

```text
rg -n "sk_live_|sk_test_|SUPABASE_SERVICE_ROLE_KEY\s*=|ZAI_API_KEY\s*=|WHATSAPP.*SECRET\s*=|RESEND_API_KEY\s*=|STRIPE_SECRET_KEY\s*=|BEGIN PRIVATE KEY|password\s*=\s*['\"]" docs/AIYA_LIVE_PARITY_RUNTIME_SMOKE_ACTION_PLAN.md docs/AIYA_LIVE_PARITY_RUNTIME_SMOKE_EVIDENCE.md HANDOFF_FOR_NEXT_CODEX.md docs/RISK_REGISTER.md app/src app/public --glob '!**/*.png' --glob '!**/*.ico'
```

Result: `PASS`, no hits.

### Release Verify

Command:

```text
npm run release:verify
```

Result: `PASS`.

Observed summary:

- Release identity bound: `hs-2b33cc661b17-2c32cf194421 @ 2b33cc661b17`
- Core package tests: `295 pass`, `0 fail`, `0 skipped`
- App unit tests: `276 files passed`; `1642 passed`, `9 skipped`
- Production build: `PASS`
- Release artifact generated:
  - `releaseId`: `hs-2b33cc661b17-2c32cf194421`
  - archive SHA-256: `dde4f5afd5a5f9b9588a253faf632faa73bc8dfd8742ec6768e4f87deea22c27`
  - file count: `2725`
- Stage 5 dependency security verify: `PASS`
- Production dependency audit: zero production vulnerabilities
- Final result: `Release verification passed`

## Classification Update

- Local AIya release parity: `VERIFIED`
- Live brand mismatch: still `OPEN` until hosted deploy smoke proves the new release is live.
- Live `/app-install` and app-state route `500`: not reproducible locally; now classified as `LIVE_RUNTIME_OR_DEPLOYED_ENV_SCHEMA_MISMATCH`.
- Supabase Auth sender: still `OWNER_EXTERNAL_EVIDENCE_REQUIRED`.
- Production status: `NO-GO`.
- iPhone Safari/PWA status: `WAIVED_NOT_EXECUTED`, not `PASS`.

## Next Required Action

Request a separate explicit hosted deploy command before Phase 3. Phase 3 must deploy only the verified release/artifact path and then re-run live release identity, route, manifest, brand, DNS/TLS, and old-domain smoke checks.
