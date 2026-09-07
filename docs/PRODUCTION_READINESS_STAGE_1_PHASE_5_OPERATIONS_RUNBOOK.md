# Production Readiness Stage 1 Phase 5 Operations Runbook

Date: 2026-08-30

Status: `LOCAL_PREPARATION_ONLY`

## Scope

This runbook describes worker, release package, and operating readiness for
**Birinci Asama: Canli Hesaplari Beklemeden Teknik Hazirlik** Phase 5.

It does not authorize production `GO`, deploy, remote migration, live provider
egress, live WhatsApp traffic, or real client health-data processing.

## Worker Commands

Run one-shot smoke checks before any long-running process:

```text
npm run worker:media:stage4b3:once
npm run worker:media:lifecycle:once
npm run worker:audio:stage4b4:once
npm run worker:audio:lifecycle:stage4b4:once
npm run worker:ai-chat:stage4c:once
npm run worker:ai-chat:lifecycle:stage4c:once
```

Long-running commands:

```text
npm run worker:media:stage4b3
npm run worker:media:lifecycle
npm run worker:audio:stage4b4
npm run worker:audio:lifecycle:stage4b4
npm run worker:ai-chat:stage4c
npm run worker:ai-chat:lifecycle:stage4c
```

## Required Environment

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MANU_DEV_FALLBACK_STORE` must not be `true`.
- `MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK` must not be `true`.
- `MANU_ALLOW_MOCK_VISION` must not be `true`.
- `MANU_ALLOW_MOCK_VOICE_TRANSCRIPTION` must not be `true`.

## Required Decisions Before Production Start

- Production `GO` approval is recorded.
- Release package verification has passed for the exact commit.
- Incident response runbook is approved and owner-assigned.
- Rollback owner is assigned.
- Secret rotation owner is assigned.
- Worker logs and queue failure counts have an operator review path.
- External provider/channel approvals remain current.

## Release Package

The release package manifest must include:

- Release identity and commit SHA.
- Migration fingerprint.
- Service-worker cache version rendered only inside the artifact copy.
- SHA-256 for packaged files and archive.
- Phase 5 operations manifest with worker commands and `productionPilotGo:false`.

Build and verify locally:

```text
npm run build
npm run release:artifact
npm run test:release-artifact
```

Full release verification remains:

```text
npm run release:verify
```

## Rollback

1. Stop long-running worker processes.
2. Disable provider/channel flags.
3. Keep service-role audit tables intact.
4. Revert traffic to the previous verified release artifact.
5. Run one-shot worker checks only after queue ownership is reviewed.
6. Record incident, rollback owner, commit, artifact hash, and verification output.

## Current Decision

Phase 5 is local technical preparation only. Production remains `NO-GO`.
