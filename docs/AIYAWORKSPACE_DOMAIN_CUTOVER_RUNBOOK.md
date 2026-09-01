# aiyaworkspace.com Domain Cutover Runbook

Status: implementation runbook for the current committed release baseline.

Canonical production origin:

- Public/customer app: `https://aiyaworkspace.com`
- Admin app: `https://admin.aiyaworkspace.com`
- Business contact inbox: `contact@aiyaworkspace.com`
- Legacy domain policy: no long-term redirect retention. After final validation, legacy hosts may be shut down immediately because there is no real customer traffic on the old brand/domain.
- PWA policy: no migration bridge. Users must install the PWA again from the new origin.

## Code Contract

The app must be built and deployed from the clean committed baseline, not from the dirty local AI-ya brand draft.

Required runtime values for the VPS release:

```env
NEXT_PUBLIC_APP_URL=https://aiyaworkspace.com
MANU_ADMIN_HOST=admin.aiyaworkspace.com
MANU_ADMIN_APP_URL=https://admin.aiyaworkspace.com
```

Keep `MANU_ADMIN_EMAIL_ALLOWLIST` pointed at the current owner/admin login until the app admin account is intentionally changed. The public business inbox is for prospects and support contact, not automatically the app admin identity.

## DNS

In Squarespace domain DNS, the app hosts must resolve to the Hetzner VPS:

- `@` A record: `167.233.207.102`
- `www` CNAME or A behavior: direct to `aiyaworkspace.com` or `167.233.207.102` depending on the registrar UI option
- `admin` A record: `167.233.207.102`

Google Workspace mail records must remain active:

- MX for Google Workspace mail delivery
- SPF including Google Workspace
- Google DKIM
- DMARC initial policy:

```txt
v=DMARC1; p=none; rua=mailto:contact@aiyaworkspace.com; fo=1; adkim=s; aspf=s; pct=100
```

Resend must use a dedicated sending subdomain for Supabase Auth SMTP:

- Sending domain: `auth.aiyaworkspace.com`
- Supabase Auth sender: `SiriusAI <no-reply@auth.aiyaworkspace.com>`

## External App Settings

Supabase Auth:

- Site URL: `https://aiyaworkspace.com`
- Redirect URLs:
  - `https://aiyaworkspace.com/auth/callback`
  - `https://admin.aiyaworkspace.com/auth/callback`
  - `https://admin.aiyaworkspace.com/auth/callback?next=%2Fadmin`
- Custom SMTP: Resend SMTP with the verified `auth.aiyaworkspace.com` sender.

Stripe test-mode webhook:

- Endpoint URL: `https://aiyaworkspace.com/api/commercial/webhook`
- Events remain unchanged:
  - `checkout.session.completed`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

WhatsApp and Telegram:

- No live domain switch is required until live channels are actually configured.
- When live channels are configured later, webhook callback origins must use `https://aiyaworkspace.com`.

## VPS Cutover

Nginx must serve:

- `aiyaworkspace.com`
- `www.aiyaworkspace.com`
- `admin.aiyaworkspace.com`

The admin host must keep the existing host-rewrite behavior to `/admin`.

After DNS points to the VPS and certificate issuance succeeds, issue a Let's Encrypt certificate covering all three new hosts.

## Validation

Required checks before calling the domain cutover complete:

- `https://aiyaworkspace.com` returns 200.
- `https://aiyaworkspace.com/login` returns 200.
- `https://aiyaworkspace.com/purchase` returns 200.
- `https://aiyaworkspace.com/purchase/success` returns 200.
- `https://aiyaworkspace.com/app-install` returns 200.
- `https://admin.aiyaworkspace.com` returns 200 and renders the admin surface.
- `https://aiyaworkspace.com/api/health/release` returns the deployed release identity.
- `https://aiyaworkspace.com/robots.txt` references `https://aiyaworkspace.com/sitemap.xml`.
- `https://aiyaworkspace.com/sitemap.xml` only contains the new canonical origin.
- Supabase magic-link callback returns users to the new origin.
- Public and purchase contact links use `contact@aiyaworkspace.com`.

## Legacy Shutdown

After all validation checks pass:

- Remove `siriusai.store`, `www.siriusai.store`, and `admin.siriusai.store` from the active Nginx production server block.
- Return `410 Gone` or a plain shutdown response for the legacy hosts.
- Do not renew `siriusai.store` unless the owner later chooses to keep it for brand protection.
- Do not build a PWA transfer bridge.

Rollback before legacy shutdown:

- Restore the previous VPS release and Nginx config for `siriusai.store`.
- Restore Supabase Site URL and redirect URLs to the previous values.
- Restore Stripe test webhook endpoint to the previous old-domain URL.
