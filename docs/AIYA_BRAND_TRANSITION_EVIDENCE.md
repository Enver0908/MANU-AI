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

## 2026-09-01 Hosted Runtime Addendum

The hosted VPS now serves AIya release `hs-82ee37250765-2c32cf194421` at commit `82ee3725076566304e9e0308632b2efe9d3b1deb`.

Live checked surfaces:

```text
https://aiyaworkspace.com/ status=200 hasAIya=True legacy=<none>
https://aiyaworkspace.com/login status=200 hasAIya=True legacy=<none>
https://aiyaworkspace.com/purchase status=200 hasAIya=True legacy=<none>
https://aiyaworkspace.com/app-install status=200 hasAIya=True legacy=<none>
https://aiyaworkspace.com/manifest.webmanifest status=200 hasAIya=True legacy=<none>
```

Live manifest:

```json
{
  "name": "AIya",
  "short_name": "AIya",
  "start_url": "/dashboard",
  "scope": "/",
  "display": "standalone",
  "iconCount": 6
}
```

This hosted runtime validation does not change production `NO-GO` and does not prove the Supabase Auth sender display name. Sender proof remains owner-external evidence.

## 2026-09-02 Hosted Repeatability Addendum

The hosted VPS now serves AIya release `hs-4c7bbea8ba21-2c32cf194421` at commit `4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9`.

Live checked surfaces:

```text
https://aiyaworkspace.com/ status=200 legacy=<none>
https://aiyaworkspace.com/login status=200 legacy=<none>
https://aiyaworkspace.com/purchase status=200 legacy=<none>
https://aiyaworkspace.com/app-install status=307 legacy=<none>
https://aiyaworkspace.com/manifest.webmanifest status=200 legacy=<none>
https://admin.aiyaworkspace.com/admin status=200 legacy=<none>
```

The official hosted apply wrapper completed without manual fallback. This does not change production `NO-GO` and does not prove the Supabase Auth sender display name. Sender proof remains owner-external evidence.
