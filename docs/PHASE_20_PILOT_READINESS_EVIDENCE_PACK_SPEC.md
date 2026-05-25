# MANU-AI Phase 20 Pilot Readiness Evidence Pack Spec

## Goal

Create a concise evidence pack that maps the local pilot-foundation work to production-pilot launch gates without claiming external approval.

## Scope

- Summarize completed technical controls.
- Map every production-pilot launch gate to available evidence and remaining blockers.
- Record the current verification command and latest passing result.
- Keep real WhatsApp, Telegram, Gemini, external notifications, monitoring, and real health data disconnected.
- Make the next approval path explicit for the user and future Codex sessions.

## Non-Goals

- No launch gate approval.
- No legal, clinical, vendor, or platform sign-off.
- No real production rollout checklist completion.
- No new runtime feature.
- No provider/channel/monitoring/secret-manager integration.

## Done Criteria

- Evidence pack lists all eight launch gates.
- Evidence pack distinguishes internal evidence from external approval.
- Evidence pack states that production pilot remains blocked.
- Evidence pack includes release verification result.
- Evidence pack includes R-405 dependency blocker status.
- Handoff and next-phase plan reference the evidence pack.

## Edge Cases

- Draft runbooks count as internal evidence, not approval.
- Local mock channel/provider tests count as readiness evidence, not production integration proof.
- RLS tests count only when run against local Supabase or explicitly permitted remote environments.
- Visual tests remain a separate optional release evidence item.
- Any future real data/channel/provider use still requires the relevant launch gates to be externally approved.
