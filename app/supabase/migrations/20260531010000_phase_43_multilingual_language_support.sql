-- Phase 43: multilingual language support metadata.

alter table dietitians
  add column if not exists ui_language text not null default 'tr'
    check (ui_language in ('tr', 'en', 'de', 'fr', 'es', 'pt', 'cs'));

alter table clients
  add column if not exists communication_language text not null default 'tr'
    check (communication_language in ('tr', 'en', 'de', 'fr', 'es', 'pt', 'cs')),
  add column if not exists primary_phone_e164 text;

alter table client_form_schemas
  add column if not exists language_code text not null default 'tr'
    check (language_code in ('tr', 'en', 'de', 'fr', 'es', 'pt', 'cs'));

alter table client_form_responses
  add column if not exists language_code text not null default 'tr'
    check (language_code in ('tr', 'en', 'de', 'fr', 'es', 'pt', 'cs')),
  add column if not exists submitted_phone_e164 text;

update clients
set communication_language = coalesce(nullif(health_profile->>'preferredLanguage', ''), 'tr')
where communication_language is null;

update clients
set communication_language = 'tr'
where communication_language not in ('tr', 'en', 'de', 'fr', 'es', 'pt', 'cs');

update clients c
set primary_phone_e164 = cc.channel_user_id
from client_channels cc
where cc.tenant_id = c.tenant_id
  and cc.client_id = c.id
  and cc.channel = 'whatsapp'
  and cc.channel_user_id ~ '^\+[1-9][0-9]{7,14}$'
  and c.primary_phone_e164 is null;

create unique index if not exists clients_tenant_primary_phone_e164_unique
  on clients (tenant_id, primary_phone_e164)
  where primary_phone_e164 is not null;
