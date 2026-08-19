import { AppDomainError } from "./app-errors";
import { hasCapability, type AppCapability } from "./app-capability-contracts";
import type { AppTenantContext } from "./auth-context";
import type {
  AiMode,
  AiStatus,
  Channel,
  ClientContextUpdateRecord,
  ClientFoodRuleProfileV2Record,
  ClientFormFieldDefinition,
  ClientFormResponseRecord,
  ClientFormSchemaRecord,
  ClientMenuPlanV1Record,
  ClientRecord,
  ConversationRecord,
  TenantRole,
} from "./types";

export const PHASE_85_STAGE_6_CONTRACT_VERSION = "p85-stage-6-dashboard-contracts-v1";
export const STAGE_6_API_CACHE_CONTROL = "no-store";
export const STAGE_6_ROSTER_DEFAULT_LIMIT = 30;
export const STAGE_6_ROSTER_MAX_LIMIT = 100;
export const STAGE_6_CONTEXT_DEFAULT_LIMIT = 30;
export const STAGE_6_CONTEXT_MAX_LIMIT = 100;
export const STAGE_6_MENU_DEFAULT_LIMIT = 30;
export const STAGE_6_MENU_MAX_LIMIT = 100;
export const STAGE_6_MAX_QUERY_LENGTH = 80;
export const STAGE_6_CURSOR_VERSION = 1;
export const STAGE_6_MAX_CURSOR_LENGTH = 2048;

export const STAGE_6_REVISION_CONFLICT = "revision_conflict";

export type Stage6MutationKind =
  | "client_create"
  | "client_patch"
  | "client_form_save"
  | "client_food_rule_save"
  | "client_menu_create"
  | "client_menu_save"
  | "client_menu_activate"
  | "client_context_create"
  | "client_ai_activate"
  | "client_release_takeover";

export type Stage6RevisionSource =
  | "client"
  | "form_schema"
  | "form_response"
  | "food_rule_profile"
  | "menu_plan"
  | "conversation"
  | "client_context";

export type ClientScopedMutationResponse<T> = {
  kind: Stage6MutationKind;
  clientId: string;
  requestId: string | null;
  payload: T;
  revisions: Stage6RevisionMap;
};

export type Stage6RevisionMap = {
  clientContextRevision?: number;
  conversationRevision?: number;
  formSchemaRevision?: number;
  formResponseRevision?: number;
  foodRuleRevision?: number;
  menuPlanRevision?: number;
  activeMenuPlanId?: string | null;
};

export type Stage6PageMeta = {
  nextCursor: string | null;
  limit: number;
};

export type Stage6RosterItem = {
  id: string;
  fullName: string;
  lifecycleStatus: "active";
  aiStatus: AiStatus;
  aiMode: AiMode;
  channel: Channel;
  contextRevision: number;
  createdAt: string;
};

export type Stage6RosterPage = {
  items: Stage6RosterItem[];
  nextCursor: string | null;
  limit: number;
};

export type Stage6WorkspaceCapabilities = {
  canUpdateClient: boolean;
  canReleaseTakeover: boolean;
  canExportClient: boolean;
};

export type Stage6AiControlSummary = {
  aiStatus: AiStatus;
  aiMode: AiMode;
  humanTakeoverLocked: boolean;
  conversationId: string | null;
  conversationRevision: number | null;
};

export type Stage6WorkspaceSummary = {
  clientId: string;
  fullName: string;
  lifecycleStatus: ClientRecord["lifecycleStatus"];
  contextRevision: number;
  capabilities: Stage6WorkspaceCapabilities;
  counts: {
    contextUpdates: number;
    menuPlans: number;
    formResponses: number;
  };
  aiControl: Stage6AiControlSummary;
};

export type Stage6FormSchemaDto = {
  id: string;
  title: string;
  version: number;
  languageCode: string;
  fields: ClientFormFieldDefinition[];
};

export type Stage6FormRead = {
  clientId: string;
  schema: Stage6FormSchemaDto | null;
  response: {
    id: string;
    schemaId: string;
    schemaVersion: number;
    updatedAt: string;
    answers: Record<string, unknown>;
  } | null;
  schemaRevision: number | null;
  responseRevision: number | null;
};

export type Stage6ContextUpdatePage = {
  clientId: string;
  items: ClientContextUpdateRecord[];
  nextCursor: string | null;
  limit: number;
};

export type Stage6MenuPlanPage = {
  clientId: string;
  plans: ClientMenuPlanV1Record[];
  activePlanId: string | null;
  nextCursor: string | null;
  limit: number;
};

export type Stage6ClientCreatePayload = {
  client: ClientRecord;
  conversation: ConversationRecord | null;
};

export type Stage6ClientPatchPayload = {
  client: ClientRecord;
};

export type Stage6FormSavePayload = {
  response: ClientFormResponseRecord;
  clientContextRevision: number;
};

export type Stage6FoodRuleSavePayload = {
  profile: ClientFoodRuleProfileV2Record;
  revision: number;
};

export type Stage6MenuMutationPayload = {
  plans: ClientMenuPlanV1Record[];
  activePlanId: string | null;
};

export type Stage6ContextCreatePayload = {
  update: ClientContextUpdateRecord;
};

export type Stage6AiControlPayload = {
  client: Pick<
    ClientRecord,
    "id" | "aiStatus" | "aiMode" | "aiActiveFrom" | "aiActiveUntil" | "humanTakeoverLocked" | "contextRevision"
  >;
  conversation: Pick<ConversationRecord, "id" | "revision" | "clientId"> | null;
};

export class Stage6ContractError extends Error {
  status: 400 | 401 | 403 | 404 | 409 | 429;
  code: string;
  sourceType?: Stage6RevisionSource;
  currentRevision?: number;

  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 429,
    code: string,
    sourceType?: Stage6RevisionSource,
    currentRevision?: number,
  ) {
    super(code);
    this.name = "Stage6ContractError";
    this.status = status;
    this.code = code;
    this.sourceType = sourceType;
    this.currentRevision = currentRevision;
  }
}

const SPOOF_KEYS = ["tenantId", "accountId", "dietitianId", "userId", "tenant_id", "account_id", "dietitian_id", "user_id"];

const STALE_CODES = new Set([
  "profile_stale_recreate_required",
  "concurrent_state_update",
  "reactivation_conflict_client_context_revision",
  "reactivation_conflict_conversation_revision",
]);

export function assertNoSpoofedTenantIdentity(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return;
  for (const key of SPOOF_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      throw new Stage6ContractError(400, "actor_supplied_tenant_identity_rejected");
    }
  }
}

export function parseRequestId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Stage6ContractError(400, "request_id_invalid");
  }
  return value.toLowerCase();
}

export function parseOptionalRequestId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return parseRequestId(value);
}

export function parseExpectedRevision(value: unknown, code = "expected_revision_invalid"): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new Stage6ContractError(400, code);
  }
  return value;
}

export function parseClampedLimit(value: string | null | undefined, fallback: number, max: number) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Stage6ContractError(400, "invalid_limit");
  }
  return Math.min(parsed, max);
}

export function parseRosterQuery(input: { query?: string | null; cursor?: string | null; limit?: string | null }) {
  const query = (input.query ?? "").trim();
  if (query.length > STAGE_6_MAX_QUERY_LENGTH) {
    throw new Stage6ContractError(400, "invalid_query");
  }
  return {
    query,
    cursor: input.cursor?.trim() || null,
    limit: parseClampedLimit(input.limit, STAGE_6_ROSTER_DEFAULT_LIMIT, STAGE_6_ROSTER_MAX_LIMIT),
  };
}

export function parseContextUpdateQuery(input: { cursor?: string | null; limit?: string | null }) {
  return {
    cursor: input.cursor?.trim() || null,
    limit: parseClampedLimit(input.limit, STAGE_6_CONTEXT_DEFAULT_LIMIT, STAGE_6_CONTEXT_MAX_LIMIT),
  };
}

export function parseMenuPlanQuery(input: { cursor?: string | null; limit?: string | null }) {
  return {
    cursor: input.cursor?.trim() || null,
    limit: parseClampedLimit(input.limit, STAGE_6_MENU_DEFAULT_LIMIT, STAGE_6_MENU_MAX_LIMIT),
  };
}

function encodeCursor(payload: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(value: string): Record<string, unknown> {
  if (value.length > STAGE_6_MAX_CURSOR_LENGTH || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Stage6ContractError(400, "invalid_cursor");
  }
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      throw new Stage6ContractError(400, "invalid_cursor");
    }
    return decoded as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Stage6ContractError) throw error;
    throw new Stage6ContractError(400, "invalid_cursor");
  }
}

export function encodeStage6Cursor(mode: string, payload: Record<string, unknown>) {
  return encodeCursor({ v: STAGE_6_CURSOR_VERSION, mode, ...payload });
}

export function decodeStage6IdCursor(value: string | null, mode: string): { id: string } | null {
  if (!value) return null;
  const decoded = decodeCursor(value);
  if (decoded.v !== STAGE_6_CURSOR_VERSION || decoded.mode !== mode || typeof decoded.id !== "string" || !decoded.id) {
    throw new Stage6ContractError(400, "invalid_cursor");
  }
  return { id: decoded.id };
}

export function paginateByCreatedThenId<T extends { id: string; createdAt?: string; occurredAt?: string }>(
  items: T[],
  cursor: string | null,
  limit: number,
  mode: string,
): { items: T[]; nextCursor: string | null; limit: number } {
  const sorted = [...items].sort((left, right) => {
    const leftTime = left.occurredAt || left.createdAt || "";
    const rightTime = right.occurredAt || right.createdAt || "";
    if (leftTime === rightTime) return left.id.localeCompare(right.id);
    return leftTime < rightTime ? -1 : 1;
  });
  const cursorId = decodeStage6IdCursor(cursor, mode)?.id;
  const start = cursorId ? sorted.findIndex((item) => item.id === cursorId) : -1;
  if (cursorId && start < 0) {
    throw new Stage6ContractError(400, "invalid_cursor");
  }
  const sliceStart = cursorId ? start + 1 : 0;
  const page = sorted.slice(sliceStart, sliceStart + limit);
  const last = page.at(-1);
  return {
    items: page,
    nextCursor: sliceStart + page.length < sorted.length && last ? encodeStage6Cursor(mode, { id: last.id }) : null,
    limit,
  };
}

const CLIENT_PATCH_ALLOWLIST = new Set([
  "fullName",
  "primaryPhoneE164",
  "communicationLanguage",
  "selectedPersonaId",
  "aiMode",
  "aiStatus",
  "aiActiveFrom",
  "aiActiveUntil",
  "healthProfile",
  "dietPlan",
  "allergies",
  "restrictedFoods",
  "clinicalRiskNotes",
  "pinnedNotes",
  "channelPermission",
  "mandatorySafetyComplete",
  "safetyChecklist",
  "requestId",
  "expectedRevision",
]);

export function parseClientPatchEnvelope(body: unknown): {
  requestId: string;
  expectedRevision: number;
  patch: Partial<ClientRecord>;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Stage6ContractError(400, "invalid_request_body");
  }
  assertNoSpoofedTenantIdentity(body);
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!CLIENT_PATCH_ALLOWLIST.has(key)) {
      throw new Stage6ContractError(400, "unknown_field");
    }
  }
  const { requestId, expectedRevision, ...patch } = record;
  return {
    requestId: parseRequestId(requestId),
    expectedRevision: parseExpectedRevision(expectedRevision),
    patch: patch as Partial<ClientRecord>,
  };
}

export function parseClientCreateEnvelope(body: unknown): {
  requestId: string;
  fullName: string;
  channel: Channel;
  channelUserId: string;
  primaryPhoneE164?: string;
  communicationLanguage?: ClientRecord["communicationLanguage"];
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Stage6ContractError(400, "invalid_request_body");
  }
  assertNoSpoofedTenantIdentity(body);
  const record = body as Record<string, unknown>;
  const fullName = typeof record.fullName === "string" ? record.fullName.trim() : "";
  if (!fullName) throw new Stage6ContractError(400, "fullName_required");
  return {
    requestId: parseRequestId(record.requestId),
    fullName,
    channel: record.channel === "telegram" ? "telegram" : "whatsapp",
    channelUserId: typeof record.channelUserId === "string" ? record.channelUserId : "",
    primaryPhoneE164: typeof record.primaryPhoneE164 === "string" ? record.primaryPhoneE164 : undefined,
    communicationLanguage:
      typeof record.communicationLanguage === "string"
        ? (record.communicationLanguage as ClientRecord["communicationLanguage"])
        : undefined,
  };
}

export function parseFormSaveEnvelope(body: unknown): {
  requestId: string;
  clientId?: string;
  schemaId: string;
  answers: Record<string, unknown>;
  submittedPhoneE164?: unknown;
  expectedClientContextRevision: number;
  expectedSchemaRevision: number;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Stage6ContractError(400, "invalid_request_body");
  }
  assertNoSpoofedTenantIdentity(body);
  const record = body as Record<string, unknown>;
  if (!record.schemaId || typeof record.schemaId !== "string" || !record.answers || typeof record.answers !== "object") {
    throw new Stage6ContractError(400, "clientId_schemaId_answers_required");
  }
  return {
    requestId: parseRequestId(record.requestId),
    clientId: typeof record.clientId === "string" ? record.clientId : undefined,
    schemaId: record.schemaId,
    answers: record.answers as Record<string, unknown>,
    submittedPhoneE164: record.submittedPhoneE164,
    expectedClientContextRevision: parseExpectedRevision(record.expectedClientContextRevision, "expected_client_context_revision_required"),
    expectedSchemaRevision: parseExpectedRevision(record.expectedSchemaRevision, "expected_schema_revision_required"),
  };
}

export type Stage6FormSaveEnvelope = ReturnType<typeof parseFormSaveEnvelope>;

export function parseFoodRuleSaveEnvelope(body: unknown): {
  requestId: string;
  revision: number;
  profile: Record<string, unknown>;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Stage6ContractError(400, "invalid_request_body");
  }
  assertNoSpoofedTenantIdentity(body);
  const record = body as Record<string, unknown>;
  if (!record.profile || typeof record.profile !== "object") {
    throw new Stage6ContractError(400, "client_food_rule_profile_invalid");
  }
  return {
    requestId: parseRequestId(record.requestId),
    revision: parseExpectedRevision(record.revision, "client_food_rule_profile_invalid"),
    profile: record.profile as Record<string, unknown>,
  };
}

export function parseMenuCreateEnvelope(body: unknown): {
  requestId: string;
  templateType: string;
  title?: string;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Stage6ContractError(400, "invalid_request_body");
  }
  assertNoSpoofedTenantIdentity(body);
  const record = body as Record<string, unknown>;
  if (typeof record.templateType !== "string" || !record.templateType) {
    throw new Stage6ContractError(400, "client_menu_plan_invalid");
  }
  return {
    requestId: parseRequestId(record.requestId),
    templateType: record.templateType,
    title: typeof record.title === "string" ? record.title : undefined,
  };
}

export function parseMenuSaveEnvelope(body: unknown): {
  requestId: string;
  revision: number;
  plan: Record<string, unknown>;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Stage6ContractError(400, "invalid_request_body");
  }
  assertNoSpoofedTenantIdentity(body);
  const record = body as Record<string, unknown>;
  if (!record.plan || typeof record.plan !== "object") {
    throw new Stage6ContractError(400, "client_menu_plan_invalid");
  }
  return {
    requestId: parseRequestId(record.requestId),
    revision: parseExpectedRevision(record.revision, "client_menu_plan_invalid"),
    plan: record.plan as Record<string, unknown>,
  };
}

export function parseMenuActivateEnvelope(body: unknown): {
  requestId: string;
  expectedPlanRevision: number;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Stage6ContractError(400, "invalid_request_body");
  }
  assertNoSpoofedTenantIdentity(body);
  const record = body as Record<string, unknown>;
  return {
    requestId: parseRequestId(record.requestId),
    expectedPlanRevision: parseExpectedRevision(record.expectedPlanRevision, "expected_plan_revision_required"),
  };
}

export function parseContextCreateEnvelope(body: unknown): {
  requestId: string;
  source: ClientContextUpdateRecord["source"];
  occurredAt?: string | null;
  title: string;
  summary: string;
  details?: string;
  importance: ClientContextUpdateRecord["importance"];
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Stage6ContractError(400, "invalid_request_body");
  }
  assertNoSpoofedTenantIdentity(body);
  const record = body as Record<string, unknown>;
  if (typeof record.title !== "string" || typeof record.summary !== "string") {
    throw new Stage6ContractError(400, "context_update_title_and_summary_required");
  }
  return {
    requestId: parseRequestId(record.requestId),
    source: record.source as ClientContextUpdateRecord["source"],
    occurredAt: typeof record.occurredAt === "string" || record.occurredAt === null ? (record.occurredAt as string | null) : undefined,
    title: record.title,
    summary: record.summary,
    details: typeof record.details === "string" ? record.details : undefined,
    importance: record.importance as ClientContextUpdateRecord["importance"],
  };
}

export function parseAiActivateEnvelope(body: unknown): {
  requestId: string | null;
  requestedAiMode?: "copilot" | "autopilot";
  expectedConversationRevision: number;
  expectedClientContextRevision: number;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Stage6ContractError(400, "invalid_request_body");
  }
  assertNoSpoofedTenantIdentity(body);
  const record = body as Record<string, unknown>;
  return {
    requestId: parseOptionalRequestId(record.requestId),
    requestedAiMode:
      record.requestedAiMode === "copilot" || record.requestedAiMode === "autopilot"
        ? record.requestedAiMode
        : undefined,
    expectedConversationRevision: parseExpectedRevision(
      record.expectedConversationRevision,
      "expected_conversation_revision_required",
    ),
    expectedClientContextRevision: parseExpectedRevision(
      record.expectedClientContextRevision,
      "expected_client_context_revision_required",
    ),
  };
}

export function parseReleaseTakeoverEnvelope(body: unknown): { requestId: string | null } {
  if (body == null || body === "") return { requestId: null };
  if (typeof body !== "object" || Array.isArray(body)) {
    throw new Stage6ContractError(400, "invalid_request_body");
  }
  assertNoSpoofedTenantIdentity(body);
  const record = body as Record<string, unknown>;
  return { requestId: parseOptionalRequestId(record.requestId) };
}

export function assertExpectedRevision(
  actual: number,
  expected: number,
  sourceType: Stage6RevisionSource,
) {
  if (actual !== expected) {
    throw new Stage6ContractError(409, STAGE_6_REVISION_CONFLICT, sourceType, actual);
  }
}

export function mapStage6PersistenceError(error: unknown, sourceType?: Stage6RevisionSource, currentRevision?: number) {
  if (error instanceof Stage6ContractError) return error;
  if (error instanceof AppDomainError) {
    if (STALE_CODES.has(error.message)) {
      return new Stage6ContractError(409, STAGE_6_REVISION_CONFLICT, sourceType, currentRevision);
    }
    return new Stage6ContractError(error.status, error.message, sourceType, currentRevision);
  }
  return error;
}

export function stage6ErrorJson(error: Stage6ContractError) {
  return {
    error: error.code,
    ...(error.code === STAGE_6_REVISION_CONFLICT
      ? {
          sourceType: error.sourceType,
          currentRevision: error.currentRevision ?? null,
        }
      : {}),
  };
}

export function assertResponseHasNoBroadState(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value) && "state" in value) {
    throw new Error("broad_state_forbidden");
  }
}

export function buildWorkspaceCapabilities(role: TenantRole): Stage6WorkspaceCapabilities {
  const contextRole = role;
  const can = (capability: AppCapability) => hasCapability(contextRole, capability);
  return {
    canUpdateClient: can("update_client"),
    canReleaseTakeover: can("release_takeover"),
    canExportClient: can("export_client"),
  };
}

export function toRosterItem(client: ClientRecord): Stage6RosterItem | null {
  if (client.lifecycleStatus !== "active") return null;
  return {
    id: client.id,
    fullName: client.fullName,
    lifecycleStatus: "active",
    aiStatus: client.aiStatus,
    aiMode: client.aiMode,
    channel: client.channel,
    contextRevision: client.contextRevision,
    createdAt: client.createdAt,
  };
}

export function buildWorkspaceSummary(
  client: ClientRecord,
  context: Pick<AppTenantContext, "role">,
  extras: {
    conversation: ConversationRecord | null;
    contextUpdateCount: number;
    menuPlanCount: number;
    formResponseCount: number;
  },
): Stage6WorkspaceSummary {
  return {
    clientId: client.id,
    fullName: client.fullName,
    lifecycleStatus: client.lifecycleStatus,
    contextRevision: client.contextRevision,
    capabilities: buildWorkspaceCapabilities(context.role),
    counts: {
      contextUpdates: extras.contextUpdateCount,
      menuPlans: extras.menuPlanCount,
      formResponses: extras.formResponseCount,
    },
    aiControl: {
      aiStatus: client.aiStatus,
      aiMode: client.aiMode,
      humanTakeoverLocked: client.humanTakeoverLocked,
      conversationId: extras.conversation?.id ?? null,
      conversationRevision: extras.conversation?.revision ?? null,
    },
  };
}

export function buildFormRead(clientId: string, schema: ClientFormSchemaRecord | null, response: ClientFormResponseRecord | null): Stage6FormRead {
  return {
    clientId,
    schema: schema
      ? {
          id: schema.id,
          title: schema.title,
          version: schema.version,
          languageCode: schema.languageCode,
          fields: schema.fields,
        }
      : null,
    response: response
      ? {
          id: response.id,
          schemaId: response.schemaId,
          schemaVersion: response.schemaVersion,
          updatedAt: response.updatedAt,
          answers: response.answers,
        }
      : null,
    schemaRevision: schema?.version ?? null,
    responseRevision: response ? Date.parse(response.updatedAt) || 0 : null,
  };
}

export function scopedMutation<T>(
  kind: Stage6MutationKind,
  clientId: string,
  payload: T,
  revisions: Stage6RevisionMap,
  requestId: string | null = null,
): ClientScopedMutationResponse<T> {
  const response: ClientScopedMutationResponse<T> = {
    kind,
    clientId,
    requestId,
    payload,
    revisions,
  };
  assertResponseHasNoBroadState(response);
  return response;
}

const idempotencyStore = new Map<string, ClientScopedMutationResponse<unknown>>();

export function idempotencyLookup<T>(tenantId: string, requestId: string | null): ClientScopedMutationResponse<T> | null {
  if (!requestId) return null;
  const hit = idempotencyStore.get(`${tenantId}:${requestId}`);
  return (hit as ClientScopedMutationResponse<T>) ?? null;
}

export function idempotencyRemember<T>(tenantId: string, requestId: string | null, response: ClientScopedMutationResponse<T>) {
  if (!requestId) return;
  idempotencyStore.set(`${tenantId}:${requestId}`, response as ClientScopedMutationResponse<unknown>);
}

export function resetStage6IdempotencyForTests() {
  idempotencyStore.clear();
}
