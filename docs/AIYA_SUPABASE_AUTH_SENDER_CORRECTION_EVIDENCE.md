# AIya Supabase Auth Sender Correction Evidence

Date: 2026-09-02

Status: `SENDER_CORRECTED_AND_CONFIG_PROVEN`

## Summary

The linked hosted Supabase project Auth custom SMTP sender display name was
corrected from the retired `SiriusAI` brand to `AIya`.

Production remains `NO-GO`. No remote migration, production deploy, DNS edit,
Resend edit, Stripe edit, WhatsApp edit, Z.ai edit, worker start, live provider
egress, live billing, or real client health-data processing was executed.

## Authority

The Supabase Management API supports updating Auth service config with
`smtp_sender_name` through:

```text
PATCH /v1/projects/{ref}/config/auth
```

The local Supabase CLI profile provided the required authenticated Management
API access. The token was used only in memory and was not printed, logged, or
written to the repository.

## Before

Non-sensitive Auth config fields read from project `pxyjocahjutcojltcalj`:

```json
{
  "projectRef": "pxyjocahjutcojltcalj",
  "site_url": "https://aiyaworkspace.com",
  "smtp_admin_email": "no-reply@auth.aiyaworkspace.com",
  "smtp_sender_name": "SiriusAI",
  "external_email_enabled": true,
  "mailer_autoconfirm": false
}
```

## Change

Only this field was patched:

```json
{
  "smtp_sender_name": "AIya"
}
```

No SMTP password, SMTP username, SMTP host, SMTP port, sender email, site URL,
redirect URL, email template, Resend, DNS, or auth policy setting was changed.

## After

Non-sensitive Auth config fields read from project `pxyjocahjutcojltcalj` after
the patch:

```json
{
  "projectRef": "pxyjocahjutcojltcalj",
  "patchStatus": "applied",
  "site_url": "https://aiyaworkspace.com",
  "smtp_admin_email": "no-reply@auth.aiyaworkspace.com",
  "smtp_sender_name": "AIya",
  "external_email_enabled": true,
  "mailer_autoconfirm": false
}
```

## Hosted Send Path Smoke

One controlled hosted magic-link request was sent to the business contact
address:

```json
{
  "endpoint": "https://aiyaworkspace.com/api/auth/magic-link",
  "sent": true,
  "hasRequestId": true
}
```

This proves the hosted app/Supabase send request path still accepts the email
request after the sender-name correction. Inbox rendering was not inspected in
this phase.

## Result

- Supabase Auth sender display name: `AIya`.
- Supabase Auth sender email: `no-reply@auth.aiyaworkspace.com`.
- Required config-level sender proof: closed.
- Production launch gate: unchanged, still `NO-GO`.
