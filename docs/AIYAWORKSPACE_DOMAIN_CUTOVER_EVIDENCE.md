# aiyaworkspace.com Domain Cutover Evidence

Date: 2026-09-01

## Source Baseline

- Branch: `codex/aiyaworkspace-domain-cutover`
- Active deployed commit: `d1e0b5f40e3a6e3b535e2a889ebf68025c5e548a`
- Release ID: `hs-d1e0b5f40e3a-5ad2055fb26f`
- Migration fingerprint: `5ad2055fb26f0070c98e97ac4a91114bea6a6a7ad74b4206824d7c7892e72eb0`

## Code And Runtime

- Public origin: `https://aiyaworkspace.com`
- Admin origin: `https://admin.aiyaworkspace.com`
- Business inbox: `contact@aiyaworkspace.com`
- PM2 process: `manu-ai`
- PM2 script path: `/opt/manu-ai/current/server.js`
- VPS runtime confirmed:
  - `NEXT_PUBLIC_APP_URL=https://aiyaworkspace.com`
  - `MANU_ADMIN_HOST=admin.aiyaworkspace.com`
  - `MANU_ADMIN_APP_URL=https://admin.aiyaworkspace.com`

## DNS And TLS

- `aiyaworkspace.com` resolves to `167.233.207.102` through public resolvers.
- `www.aiyaworkspace.com` resolves to `167.233.207.102` through public resolvers.
- `admin.aiyaworkspace.com` resolves to `167.233.207.102` through public resolvers.
- Dedicated Let's Encrypt certificate issued for:
  - `aiyaworkspace.com`
  - `www.aiyaworkspace.com`
  - `admin.aiyaworkspace.com`
- Certificate expiry observed: 2026-11-30.

## Application Validation

The following routes returned `200 OK` against the VPS-backed new origin:

- `https://aiyaworkspace.com/`
- `https://aiyaworkspace.com/login`
- `https://aiyaworkspace.com/purchase`
- `https://aiyaworkspace.com/app-install`
- `https://admin.aiyaworkspace.com/admin`
- `https://aiyaworkspace.com/robots.txt`
- `https://aiyaworkspace.com/sitemap.xml`

Release health returned:

```json
{
  "status": "ok",
  "releaseId": "hs-d1e0b5f40e3a-5ad2055fb26f",
  "commitSha": "d1e0b5f40e3a6e3b535e2a889ebf68025c5e548a",
  "migrationFingerprint": "5ad2055fb26f0070c98e97ac4a91114bea6a6a7ad74b4206824d7c7892e72eb0",
  "compatibilityVersion": "0.0.0+d1e0b5f"
}
```

## External Services

Supabase Auth:

- Site URL changed to `https://aiyaworkspace.com`.
- Redirect allowlist changed to:
  - `https://aiyaworkspace.com/auth/callback`
  - `https://admin.aiyaworkspace.com/auth/callback`
  - `https://admin.aiyaworkspace.com/auth/callback?next=%2Fadmin`
- Custom SMTP remains enabled through Resend.
- Sender changed to `SiriusAI <no-reply@auth.aiyaworkspace.com>`.

Resend:

- Sending domain `auth.aiyaworkspace.com` is verified.
- DNS records for DKIM and sending CNAMEs resolve through public DNS.
- Magic-link email to `contact@aiyaworkspace.com` was delivered from `no-reply@auth.aiyaworkspace.com`.

Stripe:

- Test-mode webhook endpoint is enabled at `https://aiyaworkspace.com/api/commercial/webhook`.
- Events observed:
  - `checkout.session.completed`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

## Legacy Domain Shutdown

- `siriusai.store`, `www.siriusai.store`, and `admin.siriusai.store` were removed from the active application server block.
- Legacy HTTP/HTTPS requests now return `410 Gone`.
- No PWA transfer bridge is required or implemented.
- The old domain does not need renewal for product continuity unless the owner later chooses brand protection.
