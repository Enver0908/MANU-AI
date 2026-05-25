# MANU-AI Phase 15 Safe Observability And Operational Health Spec

## Goal

Create a safe internal operational health snapshot without connecting a monitoring vendor or exposing raw client health data.

## Scope

- Add an app-level health snapshot helper.
- Count operational signals that are safe to log or display internally.
- Include launch-gate blocked status from the existing gate evaluator.
- Add a draft monitoring policy for future external observability tools.
- Keep all output free of raw message bodies, prompts, channel identifiers, health profile fields, provider credentials, and secrets.

## Non-Goals

- No external monitoring, analytics, logging, email, push, WhatsApp, Telegram, Gemini, or secret-manager integration.
- No dashboard UI change.
- No raw event log export.
- No SLA automation.

## Snapshot Signals

- Open handoff count.
- Urgent open handoff count.
- Failed provider decision count.
- Unread notification count.
- Pending draft count.
- Stale draft count using a 24-hour default threshold.
- Passive client count.
- Blocked launch gate count and open gate ids.

## Edge Cases

- Empty app state must produce zeros and launch-gate blocked status.
- Stale draft detection must use the caller-provided `now` when supplied.
- Snapshot must not include client names, message bodies, phone numbers, channel handles, prompts, health profile content, audit metadata, or provider credentials.
- Unknown launch-gate approval ids remain ignored by the launch gate evaluator.

## Verification

- Unit tests cover counts.
- Unit tests prove stale draft detection.
- Unit tests prove snapshot JSON does not contain raw health/message/channel/secret strings from fixture data.
- Existing app tests, lint, and production build pass.
