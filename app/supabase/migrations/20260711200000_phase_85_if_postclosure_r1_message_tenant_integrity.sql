-- P85-IF post-closure audit: complete tenant-scoped provenance references left open by R1.

do $$
begin
  if exists (
    select 1
    from messages message
    where not exists (
      select 1 from conversations conversation
      where conversation.id = message.conversation_id and conversation.tenant_id = message.tenant_id
    )
      or (message.author_dietitian_id is not null and not exists (
        select 1 from dietitians dietitian
        where dietitian.id = message.author_dietitian_id and dietitian.tenant_id = message.tenant_id
      ))
      or (message.generated_by_ai_decision_id is not null and not exists (
        select 1 from ai_decisions decision
        where decision.id = message.generated_by_ai_decision_id and decision.tenant_id = message.tenant_id
      ))
      or (message.approved_by_dietitian_id is not null and not exists (
        select 1 from dietitians dietitian
        where dietitian.id = message.approved_by_dietitian_id and dietitian.tenant_id = message.tenant_id
      ))
      or (message.source_message_id is not null and not exists (
        select 1 from messages source
        where source.id = message.source_message_id and source.tenant_id = message.tenant_id
      ))
      or (message.provider_account_binding_id is not null and not exists (
        select 1 from channel_account_bindings binding
        where binding.id = message.provider_account_binding_id and binding.tenant_id = message.tenant_id
      ))
      or (message.actor_binding_id is not null and not exists (
        select 1 from channel_actor_bindings binding
        where binding.id = message.actor_binding_id and binding.tenant_id = message.tenant_id
      ))
  ) then
    raise exception 'p85_if_postclosure_cross_tenant_message_provenance';
  end if;

  if exists (
    select 1
    from channel_actor_bindings actor
    where not exists (
      select 1 from channel_account_bindings account
      where account.id = actor.account_binding_id and account.tenant_id = actor.tenant_id
    )
      or (actor.dietitian_id is not null and not exists (
        select 1 from dietitians dietitian
        where dietitian.id = actor.dietitian_id and dietitian.tenant_id = actor.tenant_id
      ))
  ) then
    raise exception 'p85_if_postclosure_cross_tenant_actor_binding';
  end if;
end;
$$;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'p85_if_post_message_conversation_tenant_fk') then
    alter table messages add constraint p85_if_post_message_conversation_tenant_fk
      foreign key (tenant_id, conversation_id) references conversations (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_post_message_author_tenant_fk') then
    alter table messages add constraint p85_if_post_message_author_tenant_fk
      foreign key (tenant_id, author_dietitian_id) references dietitians (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_post_message_decision_tenant_fk') then
    alter table messages add constraint p85_if_post_message_decision_tenant_fk
      foreign key (tenant_id, generated_by_ai_decision_id) references ai_decisions (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_post_message_approver_tenant_fk') then
    alter table messages add constraint p85_if_post_message_approver_tenant_fk
      foreign key (tenant_id, approved_by_dietitian_id) references dietitians (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_post_message_source_tenant_fk') then
    alter table messages add constraint p85_if_post_message_source_tenant_fk
      foreign key (tenant_id, source_message_id) references messages (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_post_message_account_tenant_fk') then
    alter table messages add constraint p85_if_post_message_account_tenant_fk
      foreign key (tenant_id, provider_account_binding_id) references channel_account_bindings (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_post_message_actor_tenant_fk') then
    alter table messages add constraint p85_if_post_message_actor_tenant_fk
      foreign key (tenant_id, actor_binding_id) references channel_actor_bindings (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_post_actor_account_tenant_fk') then
    alter table channel_actor_bindings add constraint p85_if_post_actor_account_tenant_fk
      foreign key (tenant_id, account_binding_id) references channel_account_bindings (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'p85_if_post_actor_dietitian_tenant_fk') then
    alter table channel_actor_bindings add constraint p85_if_post_actor_dietitian_tenant_fk
      foreign key (tenant_id, dietitian_id) references dietitians (tenant_id, id);
  end if;
end;
$$;
