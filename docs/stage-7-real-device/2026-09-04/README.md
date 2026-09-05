# Faz 8 physical Android capture - 2026-09-04

Do not reuse `2026-08-24` artifacts. This folder is for the current local revision.

Preferred URL after wireless ADB reverse: `http://127.0.0.1:3110`

LAN fallback (Chrome browse only; Android Chrome often will not install a PWA over plain HTTP LAN): `http://10.126.95.41:3110`

## Chrome + installed PWA walk

1. `/#iletisim`
2. `/login`
3. `/purchase`
4. `/app-install` then Add to Home Screen / Install
5. `/dashboard` (Chrome, then again from the installed icon with standalone display)
6. `/dashboard?section=clients`
7. `/dashboard?section=forms`
8. `/dashboard?section=nutrition`
9. `/dashboard?section=messages`
10. `/dashboard?section=alerts`
11. `/dashboard/more`
12. Airplane mode or Chrome DevTools offline on dashboard: protected content must unmount, no client names

## TalkBack walk

Enable TalkBack, then: launch, landmarks, primary navigation, purchase or login form, dashboard, client workspace, messaging, offline privacy lock.
