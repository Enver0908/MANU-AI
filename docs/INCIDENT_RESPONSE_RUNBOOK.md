# MANU-AI Incident Response Runbook

## Status

Draft for external review. This does not approve production pilot launch.

## Trigger Events

- Suspected tenant data leakage.
- Client health data sent to an unapproved provider or channel.
- Red-risk message not handed off.
- Unauthorized account, role, or membership access.
- Production secret exposure.
- Deletion, anonymization, or export failure affecting client rights.

## First 30 Minutes

1. Freeze the affected integration path or tenant access if needed.
2. Preserve audit evidence without adding raw health content to new logs.
3. Assign an incident owner and clinical reviewer.
4. Record affected tenant, client count estimate, systems touched, and current containment status.
5. Decide whether external legal/privacy escalation is required.

## First 24 Hours

1. Complete root-cause notes and timeline.
2. Confirm whether any provider, channel, prompt, or notification payload contained prohibited data.
3. Run tenant/client scope checks before any export or remediation.
4. Prepare client, regulator, or platform notifications only after legal review.
5. Add regression tests or operational checks before re-enabling the affected path.

## Closure Evidence

- Incident owner and reviewers.
- Timeline and containment actions.
- Data categories affected.
- Tenant/client scope analysis.
- Corrective tests or controls.
- Legal/privacy decision record.
