import { getActiveFormSchema } from "./client-forms";
import { AppDomainError } from "./app-errors";
import type { AppTenantContext } from "./auth-context";
import {
  buildFormRead,
  buildWorkspaceSummary,
  paginateByCreatedThenId,
  scopedMutation,
  toRosterItem,
  type ClientScopedMutationResponse,
  type Stage6AiControlPayload,
  type Stage6ContextCreatePayload,
  type Stage6ContextUpdatePage,
  type Stage6FoodRuleSavePayload,
  type Stage6FormRead,
  type Stage6FormSavePayload,
  type Stage6MenuMutationPayload,
  type Stage6MenuPlanPage,
  type Stage6RosterPage,
  type Stage6WorkspaceSummary,
} from "./phase-85-stage-6-dashboard-contracts";
import {
  getActiveClientMenuPlanV1Record,
  listClientMenuPlanV1Records,
} from "./phase-77f-client-menu-plan";
import type {
  ClientContextUpdateRecord,
  ClientMenuPlanV1Record,
  ClientRecord,
  ConversationRecord,
  ManuAppState,
} from "./types";

function requireActiveClient(state: ManuAppState, clientId: string) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client || client.lifecycleStatus === "removed_anonymized") {
    throw new AppDomainError(404, "client_not_found");
  }
  return client;
}

function conversationForClient(state: ManuAppState, clientId: string) {
  return state.conversations.find((item) => item.clientId === clientId) ?? null;
}

export function projectStage6Roster(state: ManuAppState, query: { query: string; cursor: string | null; limit: number }): Stage6RosterPage {
  const needle = query.query.toLocaleLowerCase("tr-TR");
  const items = state.clients
    .map(toRosterItem)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => !needle || item.fullName.toLocaleLowerCase("tr-TR").includes(needle) || item.id.toLowerCase().includes(needle));
  const page = paginateByCreatedThenId(items, query.cursor, query.limit, "client_roster");
  return { items: page.items, nextCursor: page.nextCursor, limit: page.limit };
}

export function projectStage6Workspace(state: ManuAppState, clientId: string, context: Pick<AppTenantContext, "role">): Stage6WorkspaceSummary {
  const client = requireActiveClient(state, clientId);
  return buildWorkspaceSummary(client, context, {
    conversation: conversationForClient(state, clientId),
    contextUpdateCount: state.clientContextUpdates.filter((item) => item.clientId === clientId).length,
    menuPlanCount: listClientMenuPlanV1Records(state, clientId).length,
    formResponseCount: state.clientFormResponses.filter((item) => item.clientId === clientId).length,
  });
}

export function projectStage6Forms(state: ManuAppState, clientId: string): Stage6FormRead {
  requireActiveClient(state, clientId);
  const schema = getActiveFormSchema(state);
  const response = schema
    ? state.clientFormResponses.find((item) => item.clientId === clientId && item.schemaId === schema.id) ?? null
    : null;
  return buildFormRead(clientId, schema, response);
}

export function projectStage6ContextUpdates(
  state: ManuAppState,
  clientId: string,
  query: { cursor: string | null; limit: number },
): Stage6ContextUpdatePage {
  requireActiveClient(state, clientId);
  const items = state.clientContextUpdates.filter((item) => item.clientId === clientId);
  const page = paginateByCreatedThenId(items, query.cursor, query.limit, "client_context");
  return { clientId, items: page.items, nextCursor: page.nextCursor, limit: page.limit };
}

export function projectStage6MenuPlans(
  state: ManuAppState,
  clientId: string,
  query: { cursor: string | null; limit: number } | null = null,
): Stage6MenuPlanPage {
  requireActiveClient(state, clientId);
  const records = listClientMenuPlanV1Records(state, clientId);
  const active = getActiveClientMenuPlanV1Record(state, clientId);
  if (!query) {
    return { clientId, plans: records, activePlanId: active?.id ?? null, nextCursor: null, limit: records.length };
  }
  const page = paginateByCreatedThenId(records, query.cursor, query.limit, "client_menu");
  return {
    clientId,
    plans: page.items,
    activePlanId: active?.id ?? null,
    nextCursor: page.nextCursor,
    limit: page.limit,
  };
}

export function projectFormSave(
  state: ManuAppState,
  clientId: string,
  schemaId: string,
  requestId: string | null,
): ClientScopedMutationResponse<Stage6FormSavePayload> {
  const client = requireActiveClient(state, clientId);
  const response = state.clientFormResponses.find((item) => item.clientId === clientId && item.schemaId === schemaId);
  if (!response) throw new AppDomainError(404, "client_form_response_not_found");
  const schema = state.clientFormSchemas.find((item) => item.id === schemaId) ?? null;
  return scopedMutation(
    "client_form_save",
    clientId,
    { response, clientContextRevision: client.contextRevision },
    {
      clientContextRevision: client.contextRevision,
      formSchemaRevision: schema?.version,
      formResponseRevision: Date.parse(response.updatedAt) || 0,
    },
    requestId,
  );
}

export function projectFoodRuleSave(
  state: ManuAppState,
  clientId: string,
  requestId: string | null,
): ClientScopedMutationResponse<Stage6FoodRuleSavePayload> {
  const client = requireActiveClient(state, clientId);
  const profile = state.clientFoodRuleProfiles.find((item) => item.clientId === clientId);
  if (!profile) throw new AppDomainError(404, "client_food_rule_profile_not_found");
  return scopedMutation(
    "client_food_rule_save",
    clientId,
    { profile, revision: profile.revision },
    { clientContextRevision: client.contextRevision, foodRuleRevision: profile.revision },
    requestId,
  );
}

export function projectMenuMutation(
  state: ManuAppState,
  clientId: string,
  kind: "client_menu_create" | "client_menu_save" | "client_menu_activate",
  requestId: string | null,
): ClientScopedMutationResponse<Stage6MenuMutationPayload> {
  const client = requireActiveClient(state, clientId);
  const plans = listClientMenuPlanV1Records(state, clientId);
  const active = getActiveClientMenuPlanV1Record(state, clientId);
  const latest = plans.reduce<ClientMenuPlanV1Record | null>((current, plan) => {
    if (!current) return plan;
    return plan.updatedAt > current.updatedAt ? plan : current;
  }, null);
  return scopedMutation(
    kind,
    clientId,
    { plans, activePlanId: active?.id ?? null },
    {
      clientContextRevision: client.contextRevision,
      menuPlanRevision: latest?.revision,
      activeMenuPlanId: active?.id ?? null,
    },
    requestId,
  );
}

export function projectContextCreate(
  state: ManuAppState,
  clientId: string,
  created: ClientContextUpdateRecord,
  requestId: string | null,
): ClientScopedMutationResponse<Stage6ContextCreatePayload> {
  const client = requireActiveClient(state, clientId);
  return scopedMutation(
    "client_context_create",
    clientId,
    { update: created },
    { clientContextRevision: client.contextRevision },
    requestId,
  );
}

export function projectAiControl(
  state: ManuAppState,
  clientId: string,
  kind: "client_ai_activate" | "client_release_takeover",
  requestId: string | null,
): ClientScopedMutationResponse<Stage6AiControlPayload> {
  const client = requireActiveClient(state, clientId);
  const conversation = conversationForClient(state, clientId);
  return scopedMutation(
    kind,
    clientId,
    {
      client: {
        id: client.id,
        aiStatus: client.aiStatus,
        aiMode: client.aiMode,
        aiActiveFrom: client.aiActiveFrom,
        aiActiveUntil: client.aiActiveUntil,
        humanTakeoverLocked: client.humanTakeoverLocked,
        contextRevision: client.contextRevision,
      },
      conversation: conversation
        ? { id: conversation.id, revision: conversation.revision, clientId: conversation.clientId }
        : null,
    },
    {
      clientContextRevision: client.contextRevision,
      conversationRevision: conversation?.revision,
    },
    requestId,
  );
}

export function mergeStage6MutationIntoAppState(
  base: ManuAppState,
  response: ClientScopedMutationResponse<unknown>,
): ManuAppState {
  if (!response?.clientId || !response.kind) return base;
  if ("state" in (response as object)) return base;

  switch (response.kind) {
    case "client_create": {
      const payload = response.payload as { client: ClientRecord; conversation: ConversationRecord | null };
      const clients = base.clients.some((item) => item.id === payload.client.id)
        ? base.clients.map((item) => (item.id === payload.client.id ? payload.client : item))
        : [...base.clients, payload.client];
      const conversations = payload.conversation
        ? base.conversations.some((item) => item.id === payload.conversation!.id)
          ? base.conversations.map((item) => (item.id === payload.conversation!.id ? payload.conversation! : item))
          : [...base.conversations, payload.conversation]
        : base.conversations;
      return { ...base, clients, conversations };
    }
    case "client_patch": {
      const client = (response.payload as { client: ClientRecord }).client;
      if (!base.clients.some((item) => item.id === client.id)) return base;
      return { ...base, clients: base.clients.map((item) => (item.id === client.id ? client : item)) };
    }
    case "client_form_save": {
      const payload = response.payload as Stage6FormSavePayload;
      return {
        ...base,
        clientFormResponses: upsertById(base.clientFormResponses, payload.response),
        clients: patchClientRevision(base.clients, response.clientId, payload.clientContextRevision),
      };
    }
    case "client_food_rule_save": {
      const payload = response.payload as Stage6FoodRuleSavePayload;
      return {
        ...base,
        clientFoodRuleProfiles: upsertByClientId(base.clientFoodRuleProfiles, payload.profile),
      };
    }
    case "client_menu_create":
    case "client_menu_save":
    case "client_menu_activate": {
      const payload = response.payload as Stage6MenuMutationPayload;
      const retained = base.clientMenuPlans.filter((plan) => plan.clientId !== response.clientId);
      return {
        ...base,
        clientMenuPlans: [...retained, ...payload.plans],
        clients: patchClientRevision(base.clients, response.clientId, response.revisions.clientContextRevision),
      };
    }
    case "client_context_create": {
      const payload = response.payload as Stage6ContextCreatePayload;
      const exists = base.clientContextUpdates.some((item) => item.id === payload.update.id);
      return {
        ...base,
        clientContextUpdates: exists
          ? base.clientContextUpdates.map((item) => (item.id === payload.update.id ? payload.update : item))
          : [...base.clientContextUpdates, payload.update],
        clients: patchClientRevision(base.clients, response.clientId, response.revisions.clientContextRevision),
      };
    }
    case "client_ai_activate":
    case "client_release_takeover": {
      const payload = response.payload as Stage6AiControlPayload;
      return {
        ...base,
        clients: base.clients.map((item) =>
          item.id === payload.client.id
            ? {
                ...item,
                aiStatus: payload.client.aiStatus,
                aiMode: payload.client.aiMode,
                aiActiveFrom: payload.client.aiActiveFrom,
                aiActiveUntil: payload.client.aiActiveUntil,
                humanTakeoverLocked: payload.client.humanTakeoverLocked,
                contextRevision: payload.client.contextRevision,
              }
            : item,
        ),
        conversations: payload.conversation
          ? base.conversations.map((item) =>
              item.id === payload.conversation!.id ? { ...item, revision: payload.conversation!.revision } : item,
            )
          : base.conversations,
      };
    }
    default:
      return base;
  }
}

function upsertById<T extends { id: string }>(items: T[], next: T) {
  return items.some((item) => item.id === next.id)
    ? items.map((item) => (item.id === next.id ? next : item))
    : [...items, next];
}

function upsertByClientId<T extends { clientId: string }>(items: T[], next: T) {
  return items.some((item) => item.clientId === next.clientId)
    ? items.map((item) => (item.clientId === next.clientId ? next : item))
    : [...items, next];
}

function patchClientRevision(clients: ClientRecord[], clientId: string, revision: number | undefined) {
  if (revision == null) return clients;
  return clients.map((item) => (item.id === clientId ? { ...item, contextRevision: revision } : item));
}

export function latestContextUpdate(state: ManuAppState, clientId: string) {
  return state.clientContextUpdates.filter((item) => item.clientId === clientId).at(-1) ?? null;
}

export function shouldApplyStage6Response(response: ClientScopedMutationResponse<unknown>, expectedClientId: string) {
  return response.clientId === expectedClientId;
}
