-- Phase 84G: extend commercial admin audit event types for subscription operations.

alter table commercial_admin_audit_events
  drop constraint commercial_admin_audit_event_type_check;

alter table commercial_admin_audit_events
  add constraint commercial_admin_audit_event_type_check check (
    event_type in (
      'invite_created',
      'invite_revoked',
      'entitlement_revoked',
      'ledger_inspected',
      'stripe_subscription_canceled',
      'lead_status_updated',
      'admin_operation_blocked'
    )
  );
