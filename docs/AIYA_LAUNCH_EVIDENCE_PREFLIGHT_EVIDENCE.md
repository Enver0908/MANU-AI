# AIya Launch Evidence Preflight Evidence

Date: 2026-09-02

Status: `PHASE_5_LAUNCH_EVIDENCE_PREFLIGHT_COMPLETE`

## Summary

Faz 5 closed the local/test and dependency findings from the launch-evidence
preflight. Supabase Auth sender display-name proof and GitHub remote
traceability remain external/repository publication items, not hosted runtime
code defects.

Production remains `NO-GO`. No remote migration, push, PR, merge, production
deploy, Supabase Auth edit, Resend edit, DNS edit, Stripe edit, WhatsApp edit,
Z.ai edit, live provider/channel egress, live billing, worker start, or real
client health-data processing was executed.

## Changes

- Updated stale Playwright visual assertions from `SiriusAI` to `AIya` for the
  current public, customer login, and admin login surfaces.
- Updated the visual shell-navigation helper to accept current link-based shell
  navigation as well as button-based navigation.
- Replaced one direct `Bildirimler` button lookup with the shared shell-nav
  helper.
- Ran `npm audit fix --package-lock-only` without `--force`; this updated only
  lockfile-resolved transitive development tooling packages and did not change
  `package.json`.

## Verification Commands

```text
git status --short --branch
## codex/production-readiness-stage-1

npm run typecheck
PASS

npm run lint
PASS: 0 errors, 77 warnings

npm run build
PASS

npx playwright test dashboard.visual.spec.ts commercial-saas.visual.spec.ts --project=desktop
PASS: 9/9

npm audit --omit=dev --json
PASS: total vulnerabilities 0

npm audit --json
PASS: total vulnerabilities 0
```

The first targeted Playwright attempt exposed a stale helper assumption: shell
navigation currently renders links, while the helper only searched buttons.
After fixing that helper, the same targeted visual run passed 9/9.

## Live Read-Only Smoke

```text
https://aiyaworkspace.com/api/health/release 200
releaseId hs-4c7bbea8ba21-2c32cf194421
commitSha 4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9
compatibilityVersion 0.0.0+4c7bbea

https://aiyaworkspace.com/ 200
https://aiyaworkspace.com/login 200
https://aiyaworkspace.com/purchase 200
https://aiyaworkspace.com/app-install 307
https://aiyaworkspace.com/manifest.webmanifest 200
https://admin.aiyaworkspace.com/admin 200
https://siriusai.store/ 410
https://www.siriusai.store/ 410
https://admin.siriusai.store/ 410

manifest name=AIya
manifest short_name=AIya
manifest start_url=/dashboard
manifest display=standalone
manifest first_icon=/icons/aiya-180.png
```

## Brand Scan

```text
rg -n "SiriusAI|MANU-AI|AI-ya|siriusai\.store" app/src app/public app/tests/visual -g '!**/node_modules/**'
app/src/lib/brand.ts:15 Historical evidence documents can mention MANU-AI, SiriusAI, and siriusai.store as past-state records.
```

The only remaining hit is the explicit allowed compatibility/historical-evidence
note in `app/src/lib/brand.ts`.

## Sender And Traceability Findings

Supabase Auth sender display name remains:

```text
OWNER_EXTERNAL_EVIDENCE_REQUIRED
```

Public DNS and route smoke cannot prove the Supabase Auth email display name.
The latest recorded historical sender evidence still requires Supabase/Resend
panel proof or controlled inbox evidence showing:

```text
AIya <no-reply@auth.aiyaworkspace.com>
```

Remote branch containment remains unresolved:

```text
git branch -r --contains 4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9
no remote branch output

git branch -r --contains 1e8178c46388672e23f49c4e9c1c47daced04658
no remote branch output

git ls-remote origin refs/heads/codex/production-readiness-stage-1 refs/heads/codex/aiya-brand-transition refs/heads/codex/aiyaworkspace-domain-cutover
609f31089d10d6e51aee59fad013efa2fa3144e9 refs/heads/codex/aiya-brand-transition
26579dc4f3337925730229aa1c487fd309fb2851 refs/heads/codex/aiyaworkspace-domain-cutover
```

The live VPS code commit is therefore not yet published on a remote branch.
This does not break the running hosted sandbox, but it must be resolved before
production traceability or PR review.

## Result

- Stale visual brand expectations: closed locally.
- Visual shell-nav test helper drift: closed locally.
- Production dependency audit: clean.
- Full dev dependency audit: clean after safe lockfile remediation.
- Live hosted AIya runtime: stable on the previously deployed `4c7bbea` code
  release.
- Supabase Auth sender display name: still owner-external evidence.
- GitHub release traceability: still requires push/PR publication.

Next correct phase: resolve owner/external launch evidence in the smallest
possible unit, starting with Supabase Auth sender display-name proof or
controlled sender correction.

## 2026-09-02 Follow-Up Closure Addendum

The two non-code findings listed above were closed after explicit owner
approval:

- `codex/production-readiness-stage-1` was pushed to origin at
  `a35c3e167b22d42a57d51d4614567906293b7b03`, and the live VPS commit
  `4c7bbea8ba21fb84b51843eac9fff2e9ff8fecf9` is contained in that remote
  branch.
- Supabase Auth sender display name was corrected and Management-API-proven as
  `AIya`; sender email remains `no-reply@auth.aiyaworkspace.com`.

Evidence: `docs/AIYA_SUPABASE_AUTH_SENDER_CORRECTION_EVIDENCE.md`.
Production remains `NO-GO`.
