-- Phase 84C: public marketing contact leads (service-role API writes; no tenant-member policies).

create table commercial_leads (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  normalized_email text not null,
  clinic_name text not null default '',
  message text not null default '',
  source_path text not null default '/',
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_lead_status_check check (
    status in ('new', 'contacted', 'closed')
  )
);

create index commercial_leads_status_created_idx
  on commercial_leads (status, created_at desc);

create index commercial_leads_normalized_email_created_idx
  on commercial_leads (normalized_email, created_at desc);

alter table commercial_leads enable row level security;
