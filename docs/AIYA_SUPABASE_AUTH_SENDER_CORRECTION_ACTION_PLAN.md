# AIya Supabase Auth Sender Correction Action Plan

Date: 2026-09-02

Status: `COMPLETE`

## Purpose

Correct and prove the hosted Supabase Auth custom SMTP sender display name for
the AIya domain cutover:

```text
AIya <no-reply@auth.aiyaworkspace.com>
```

## Scope

In scope:

- Read the linked Supabase project Auth config through the Management API.
- Change only `smtp_sender_name` from the retired `SiriusAI` brand to `AIya`.
- Re-read the Auth config through the Management API after the patch.
- Send one controlled hosted magic-link request to the business contact address
  to verify the app/Supabase send path still accepts the request.
- Record non-sensitive evidence.

Out of scope:

- SMTP host, port, username, password, or sender email changes.
- Resend domain/DNS changes.
- Email template changes.
- Production `GO`.
- Remote migrations, deploy, worker start, WhatsApp/Z.ai/Stripe changes, live
  provider egress, live billing, or real client health-data processing.

## External System Impact

- Supabase project `pxyjocahjutcojltcalj` Auth config changed:
  `smtp_sender_name` is now `AIya`.
- `smtp_admin_email` remains `no-reply@auth.aiyaworkspace.com`.
- Custom SMTP remains enabled.
- No secrets were printed or committed.

## Verification

- Supabase Management API `GET /v1/projects/{ref}/config/auth` before change:
  `smtp_sender_name=SiriusAI`.
- Supabase Management API `PATCH /v1/projects/{ref}/config/auth` with only
  `smtp_sender_name=AIya`.
- Supabase Management API `GET /v1/projects/{ref}/config/auth` after change:
  `smtp_sender_name=AIya`.
- Hosted `POST /api/auth/magic-link` for `contact@aiyaworkspace.com` returned
  `sent=true`.
