# MANU-AI Secret Rotation Runbook

## Status

Draft for external review. This does not approve production pilot launch.

## Secret Classes

- Supabase service role keys.
- Supabase anon or publishable keys.
- WhatsApp and Telegram credentials.
- LLM provider credentials.
- Email, push, or monitoring provider credentials.
- CI/CD deployment tokens.

## Rotation Checklist

1. Inventory affected services and environments.
2. Create replacement secret in the approved secret manager.
3. Deploy the replacement without printing secret values to logs.
4. Revoke the old secret after health checks pass.
5. Run smoke tests for auth, simulator, notification read/acknowledge, and provider/channel mocks.
6. Record the rotation owner, time, affected systems, and verification results.

## Emergency Revocation

1. Disable the exposed secret immediately.
2. Freeze affected provider/channel paths.
3. Rotate dependent credentials.
4. Review audit logs for unauthorized access.
5. Escalate through the incident response runbook.
