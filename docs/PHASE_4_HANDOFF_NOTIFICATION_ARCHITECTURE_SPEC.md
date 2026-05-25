# MANU-AI Phase 4: Handoff Notification Architecture Spec

## Goal

Make urgent handoffs operationally visible without sending external notifications yet. Convert the current `handoff_notification_queued` audit event into backed notification records with read/acknowledge tracking.

## Current State Analysis

- Handoff creation in `simulator.ts` (line 341) emits `handoff_notification_queued` audit event.
- Dashboard has a handoff queue panel with resolve/dismiss actions.
- No notification model exists — only audit events.
- No notification center or bell icon in the dashboard.
- No read/acknowledged tracking for notifications.
- Overview panel shows open handoff count as a metric card.

## Scope

### In Scope

1. Add `NotificationRecord` type.
2. Add `notifications` array to `ManuAppState`.
3. Create notification records when handoffs are created.
4. Add notification center UI in the dashboard sidebar with unread count badge.
5. Mark notifications as read/acknowledged.
6. Add notification-related tests.
7. Document future email/push adapter requirements.

### Out Of Scope

- Real push notifications (Firebase, APNS, etc.).
- Real email notifications.
- External notification provider integration.
- Raw health-message content in notification bodies.

## Implementation Plan

### 1. Add `NotificationRecord` type [MODIFY]

`app/src/lib/types.ts`

```typescript
export type NotificationRecord = {
  id: string;
  tenantId: string;
  type: "handoff_urgent" | "handoff_standard" | "system";
  entityType: string;
  entityId: string;
  title: string;
  body: string;
  read: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
};
```

### 2. Add `notifications` to `ManuAppState` [MODIFY]

`app/src/lib/types.ts`

### 3. Create notifications on handoff [MODIFY]

`app/src/lib/simulator.ts`

In `appendCoreSimulationResult()`, when a handoff is created, also create a `NotificationRecord`. Title includes client name and risk level. Body uses safe acknowledgement text — never raw client message content.

### 4. Add notification actions [MODIFY]

`app/src/lib/simulator.ts` + `app/src/lib/app-state-store.ts`

- `markNotificationReadInState(state, notificationId)` — sets `read = true`.
- `acknowledgeNotificationInState(state, notificationId)` — sets `acknowledgedAt`.

### 5. Add notification center to dashboard [MODIFY]

`app/src/components/dashboard-app.tsx`

- Bell icon in the sidebar with unread count badge.
- Dropdown/panel showing recent notifications with mark-read and acknowledge actions.
- Urgent notifications highlighted.

### 6. Expose notification API endpoints [NEW]

`app/src/app/api/notifications/route.ts` — Not needed for fallback mode; notifications are managed in client state. Keeping in-state for now.

### 7. Update seed data [MODIFY]

`app/src/lib/seed-data.ts`

- Add empty `notifications: []` to initial state.

### 8. Add tests [MODIFY]

`app/src/lib/simulator.test.ts`

- Test: handoff creates notification record.
- Test: notification has safe content (no raw client message).
- Test: mark notification as read.
- Test: acknowledge notification.

## Success Criteria

- Red handoffs create notification records.
- Notifications can be read or acknowledged in the dashboard.
- Notification body never contains raw client message content.
- Mobile viewport can handle urgent handoff review (already works via existing responsive design).
- No external push/email provider is connected.

## Future Adapter Notes

When real notification adapters are added:
- External notifications (email, push) must NOT include raw health-message content.
- Safe acknowledgement text only: "Urgent handoff for [client name] — review required."
- Push notifications should use topic-based routing per tenant/dietitian.
- Email notifications should be rate-limited and grouped.
