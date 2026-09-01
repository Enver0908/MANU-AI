# AIya Live Parity Runtime Smoke Evidence

Date: 2026-09-01
Branch: `codex/production-readiness-stage-1`
Local HEAD: `609f31089d10d6e51aee59fad013efa2fa3144e9`
Status: `PHASE_1_RUNTIME_FINDING_COMPLETE`

## Non-Mutating Boundary

No files, database state, VPS processes, deployments, migrations, DNS records, Supabase settings, Resend settings, Stripe settings, WhatsApp settings, Z.ai settings, workers, or production gates were changed during this phase.

## Git Verification

- `git branch --show-current` -> `codex/production-readiness-stage-1`
- `git status --short --branch` -> `## codex/production-readiness-stage-1`
- `git rev-parse HEAD` -> `609f31089d10d6e51aee59fad013efa2fa3144e9`
- `git diff --check` -> pass, no output

## Live Release Identity

Command:

```text
curl.exe -sS https://aiyaworkspace.com/api/health/release
```

Observed response:

```json
{
  "status": "ok",
  "releaseId": "hs-d1e0b5f40e3a-5ad2055fb26f",
  "commitSha": "d1e0b5f40e3a6e3b535e2a889ebf68025c5e548a",
  "migrationFingerprint": "5ad2055fb26f0070c98e97ac4a91114bea6a6a7ad74b4206824d7c7892e72eb0",
  "compatibilityVersion": "0.0.0+d1e0b5f"
}
```

Finding: the live VPS is not running local AIya HEAD `609f31089d10d6e51aee59fad013efa2fa3144e9`.

## Live Route Smoke

Observed public route results:

- `https://aiyaworkspace.com/` -> `200`
- `https://aiyaworkspace.com/login` -> `200`
- `https://aiyaworkspace.com/purchase` -> `200`
- `https://aiyaworkspace.com/app-install` -> `500`
- `https://admin.aiyaworkspace.com/admin` -> `200`
- `https://admin.aiyaworkspace.com/login` -> `200`
- `https://siriusai.store/` -> `410`
- `http://siriusai.store/` -> `410`

Additional route checks:

- `https://aiyaworkspace.com/api/app-state` -> `500`
- `https://aiyaworkspace.com/api/clients` -> `500`
- `https://aiyaworkspace.com/dashboard` -> `307` to `https://aiyaworkspace.com/login?next=%2Fdashboard`
- `https://aiyaworkspace.com/api/commercial/admin/manual-entitlements` -> `405`

Finding: the live `500` issue is broader than `/app-install` and affects multiple Supabase/app-state route families.

## Live Brand Scan

Command shape:

```text
curl live public/admin/manifest URLs and scan for SiriusAI|MANU-AI|AI-ya|ai-ya|siriusai.store|olkuenver@gmail.com
```

Observed terms:

- `https://aiyaworkspace.com/` -> `SiriusAI`
- `https://aiyaworkspace.com/login` -> `SiriusAI`
- `https://aiyaworkspace.com/purchase` -> `SiriusAI`
- `https://admin.aiyaworkspace.com/admin` -> `SiriusAI`
- `https://admin.aiyaworkspace.com/login` -> `SiriusAI`
- `https://aiyaworkspace.com/manifest.webmanifest` -> `SiriusAI`

Finding: live brand mismatch is confirmed. Local active-surface scan only found the allowed compatibility note in `app/src/lib/brand.ts`, so the mismatch is a live release parity gap, not a local AIya source gap.

## DNS And TLS

Observed DNS:

- `aiyaworkspace.com` A -> `167.233.207.102`
- `www.aiyaworkspace.com` A -> `167.233.207.102`
- `admin.aiyaworkspace.com` A -> `167.233.207.102`
- `aiyaworkspace.com` MX -> `smtp.google.com`
- `aiyaworkspace.com` SPF -> `v=spf1 include:_spf.google.com ~all`
- `resend._domainkey.auth.aiyaworkspace.com` TXT exists
- `_dmarc.aiyaworkspace.com` TXT exists
- `auth.aiyaworkspace.com` A/CNAME/TXT not publicly present
- `_dmarc.auth.aiyaworkspace.com` not publicly present

Observed TLS:

- `aiyaworkspace.com`, `www.aiyaworkspace.com`, and `admin.aiyaworkspace.com` use a Let's Encrypt certificate for `CN=aiyaworkspace.com`, expiring `2026-11-30T13:13:28+03:00`.
- `siriusai.store` uses a Let's Encrypt certificate for `CN=siriusai.store`, expiring `2026-11-30T12:12:31+03:00`, while HTTP/HTTPS routes return `410`.

## Supabase Auth Sender Evidence

Public read-only checks cannot prove the current Supabase Auth sender display name. The latest recorded evidence in `docs/AIYAWORKSPACE_DOMAIN_CUTOVER_EVIDENCE.md` still says:

```text
SiriusAI <no-reply@auth.aiyaworkspace.com>
```

Finding: sender status remains `OWNER_EXTERNAL_EVIDENCE_REQUIRED`. Do not mark as AIya until owner provides Supabase dashboard/API evidence or an approved non-sensitive smoke proves the sender display name.

## Classification

Current classification:

- Brand mismatch: `live_release_parity_gap`
- `/app-install` and app-state route `500`: `runtime_env_or_supabase_schema_bundle_mismatch_unproven`
- Supabase sender: `owner_external_evidence_required`
- Production status: `NO-GO`
- iPhone Safari/PWA status: `WAIVED_NOT_EXECUTED`, not `PASS`

## Next Required Action

Run `Phase 2 - AIya Local Release Parity Verification` before any deploy. If local production-like verification passes, request a separate explicit deploy command for the verified release artifact. If it fails, fix only the proven local failure in a scoped phase before deploy.
