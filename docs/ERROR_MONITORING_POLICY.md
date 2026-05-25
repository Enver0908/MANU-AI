# MANU-AI Error Monitoring Policy

## Status

Draft for external review. No monitoring vendor is connected.

## Allowed Operational Signals

- Aggregate counts.
- Route or workflow names.
- Controlled error codes.
- Provider status and provider error codes.
- Launch gate ids.
- Tenant id only when legally and operationally approved for production monitoring.

## Prohibited Monitoring Payloads

- Raw client message bodies.
- Prompt text or completion text.
- Full health profile, diet plan, allergies, restricted foods, clinical notes, or pinned notes.
- Phone numbers, Telegram handles, or raw channel identifiers.
- Provider credentials, Supabase service role keys, JWTs, or cookies.
- Raw audit metadata unless minimized and approved.

## Future Vendor Gate

Before connecting an external monitoring provider, MANU-AI must complete vendor-risk, retention, region, access-control, and breach-notification review.
