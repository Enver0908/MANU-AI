# AIya Brand Transition Evidence

Date: 2026-09-01

Branch: `codex/aiya-brand-transition`

Base: `codex/aiyaworkspace-domain-cutover` at `26579dc`

## Decision

The active visible product brand is `AIya`.

Permanent public/customer URL: `https://aiyaworkspace.com`

Permanent admin URL: `https://admin.aiyaworkspace.com`

Business contact and default admin allowlist email: `contact@aiyaworkspace.com`

## Scope Applied

- Added central brand authority in `app/src/lib/brand.ts`.
- Updated public website, commercial entry pages, login, onboarding, purchase,
  admin login, dashboard shell, Stage 7 scenario shell, demo seed display names,
  and internal copilot visible messages to use AIya.
- Updated application metadata, Apple web app metadata, PWA manifest, SVG icon,
  and generated raster icons to AIya.
- Generated new `aiya-*` PWA icons while keeping existing `siriusai-*` icon
  filenames as one-release aliases for compatibility.
- Renamed reusable marketing component and active state hook to AIya names while
  keeping `use-manu-state.ts` as a compatibility export.
- Updated current README, owner handoff, and handoff authority language.

## Compatibility Preserved

The following names intentionally remain unchanged because they are operational
contracts or historical records:

- `MANU_*` environment variables and release placeholders.
- `x-siriusai-*` headers and `siriusai-app-version` metadata key.
- Service worker cache names `siriusai-static-*`, `siriusai-assets-*`, and
  legacy cleanup prefix `manu-ai-shell-*`.
- Existing server paths, PM2 process names, persisted database IDs, migration
  names, audit readability, and historical evidence documents.

## Guardrails

- No API shape changed.
- No database migration was added.
- No provider/channel egress was enabled.
- No billing behavior changed.
- No production deployment or production schema rollout was performed.
- Production remains `NO-GO`.

## Required Verification

Run from `app/` before merge/deploy:

```bash
npm run typecheck
npm test
npm run build
npm run release:verify
```

The active runtime scan should have no visible legacy brand results except the
documented compatibility aliases:

```bash
rg -n "SiriusAI|MANU-AI|AI-ya|ai-ya|siriusai\.store|olkuenver@gmail\.com" app/src app/public --glob '!**/*.png' --glob '!**/*.ico'
```
