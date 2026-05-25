# MANU-AI Phase 18 Notification SLA And Internal Escalation Spec

## Goal

Add safe internal SLA signals for handoff notifications without connecting email, push, WhatsApp, Telegram, or any external notification provider.

## Scope

- Define local notification acknowledgement SLA thresholds.
- Count open handoff notifications that have not been acknowledged within the SLA.
- Count urgent open handoff notifications that require internal escalation.
- Add the counts to the safe operational health snapshot.
- Keep all output aggregate-only and free of raw client health data.

## Non-Goals

- No real email, push, WhatsApp, Telegram, APNs, FCM, or SMS integration.
- No external escalation workflow.
- No on-call schedule or rota.
- No dashboard UI changes.
- No raw handoff, message, or client export.

## SLA Defaults

- Urgent handoff notification acknowledgement target: 15 minutes.
- Standard handoff notification acknowledgement target: 4 hours.

## Done Criteria

- Acknowledged notifications are not counted as SLA breaches.
- Notifications tied to resolved or dismissed handoffs are not counted as SLA breaches.
- Urgent unacknowledged notifications older than the urgent SLA are counted as internal escalation due.
- Standard unacknowledged notifications older than the standard SLA are counted as SLA breaches but not urgent escalation due.
- Safe operational health snapshot includes only aggregate SLA counts.
- No raw message body, client channel identifier, health profile, prompt, diet plan, allergy, clinical note, or secret is emitted.

## Edge Cases

- Notifications not linked to `handoff_case` are ignored by the handoff SLA helper.
- Notifications whose handoff case is missing are ignored rather than escalated.
- Non-open handoff cases are ignored.
- Caller-provided `now` controls deterministic tests.
- Unknown notification types default to the standard SLA unless they are explicitly `handoff_urgent`.
