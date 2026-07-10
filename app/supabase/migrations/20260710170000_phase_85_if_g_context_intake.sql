-- P85-IF-G: extend context intake proposal contract for dedicated off-channel workflow.

alter table context_intake_proposals
  add column if not exists intake_source text,
  add column if not exists raw_source_reference text;

alter table context_intake_proposals
  drop constraint if exists context_intake_proposals_status_check;

alter table context_intake_proposals
  add constraint context_intake_proposals_status_check check (
    status in (
      'pending_confirmation',
      'confirmed',
      'applied',
      'rejected',
      'stale',
      'blocked_structured_impact',
      'expired'
    )
  );

alter table context_intake_proposals
  drop constraint if exists context_intake_proposals_intake_source_check;

alter table context_intake_proposals
  add constraint context_intake_proposals_intake_source_check check (
    intake_source is null or intake_source in ('phone', 'zoom', 'in_person', 'other')
  );
