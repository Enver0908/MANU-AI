# MANU-AI Mobile App Strategy

## Decision

MANU-AI must not be only a website. It needs:

1. A full web dashboard for detailed dietitian operations.
2. An installable mobile PWA for MVP.
3. A future native iOS/Android app after core workflows are validated.

## MVP Mobile Approach

Use a mobile-first PWA before building native apps.

Reasons:

- Faster to ship.
- Same codebase as the dashboard.
- Dietitians can install it to the phone home screen.
- Push-notification architecture can be designed early.
- Native app store complexity is deferred until the product workflow is proven.

## Mobile MVP Workflows

The phone experience should prioritize speed:

- View urgent handoff alerts.
- Turn AI active/passive for a client.
- Review and approve yellow AI drafts.
- Send a manual reply.
- Check whether a message was written by AI or by the dietitian.
- Pause AI after a risky client message.
- Search a client and open their conversation.

## Desktop Web Workflows

The desktop dashboard remains best for heavier work:

- Client profile setup.
- Intake form review.
- Diet plan edits.
- Persona configuration.
- Voice profile setup.
- Dataset/evaluation review.
- Settings, channels, and reports.

## Future Native App

Recommended stack after MVP validation:

- React Native
- Expo
- Shared API/backend with web app
- Push notifications through Expo/APNs/FCM

Native app should be started only after:

- Core dashboard is usable.
- WhatsApp simulator flow works.
- Handoff queue works.
- AI active/passive controls work.
- Message provenance is reliable.
- Pilot dietitians confirm mobile workflows are valuable.

## Implementation Status - 2026-07-01

Phase 83A reaffirms and extends the PWA-first decision in `docs/PHASE_83_COMMERCIAL_PWA_AND_FRONTEND_RELAUNCH_SPEC.md`:

- Mobile v1 is installable PWA only (no App Store / Play Store / APK in v1).
- PWA install center is gated to active Stripe subscribers (Phase 83D complete on 2026-07-01).
- Service worker must cache shell/static assets only; never cache PHI or tenant API payloads.
- Full dashboard parity on mobile is required in the Phase 83E relaunch.

The first PWA shell exists in `app`:

- `public/manifest.webmanifest` defines install metadata.
- `public/sw.js` caches shell/static only; `/api/*` is network-only (no PHI caching).
- `src/components/pwa-subscriber-shell.tsx` registers the service worker only for active subscribers.
- `src/components/pwa-runtime.tsx` is a no-op placeholder; SW registration deferred to subscriber shell.
- The dashboard layout is responsive and includes mobile-relevant workflows: urgent handoff queue, AI active/passive controls, simulator, manual reply, and conversation provenance labels.

Next mobile work:

- Continue refining the in-app notification center for urgent handoffs.
- Add dedicated compact screens for draft approval, handoff acknowledgement, and notification review.
- Keep future email/push adapters separate from the local prototype until policy and privacy review are complete.
- Ensure external notifications do not include raw health-message content.
- Keep visual checks at phone widths in the Playwright smoke suite.
