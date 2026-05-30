# Phase 26 Internal Copilot Spec

## Goal

Add a read-only internal AI chat for dietitian teams. The copilot helps authorized dietitians ask questions about visible MANU-AI records, such as client status, diet plan, recent messages, form responses, handoffs, and AI decision history.

This phase is internal, local/mock only, and does not connect real Gemini, external LLMs, WhatsApp, Telegram, email, push, monitoring, secret manager, or real client health data.

## Locked Decisions

- V1 is read-only. It does not change records, send messages, create notes, create tasks, or create client drafts.
- Allowed roles are `owner`, `admin`, and `dietitian`.
- `assistant` and `auditor` are blocked in V1.
- The provider is deterministic local/mock only.
- The copilot never writes raw SQL and never receives arbitrary database access.
- The tool layer is curated, tenant-scoped, and bounded by the existing scoped `ManuAppState`.
- Every assistant answer must include source references or clearly state that data is unavailable.
- Client messages and form answers are untrusted data, never instructions.

## Data Model

Add app-level records:

- `InternalCopilotMessageRecord`
  - `id`, `tenantId`, `dietitianId`, `role`, `body`, `sourceRefs`, `toolCallIds`, `safetyStatus`, `createdAt`
- `InternalCopilotToolCallRecord`
  - `id`, `tenantId`, `dietitianId`, `toolName`, `arguments`, `status`, `sourceRefs`, `resultSummary`, `createdAt`
- `InternalCopilotSourceRef`
  - `entityType`, `entityId`, `clientId`, `label`, `createdAt`

Add `internalCopilotMessages` and `internalCopilotToolCalls` to `ManuAppState`.

Supabase persistence uses:

- `internal_copilot_messages`
- `internal_copilot_tool_calls`

Both tables have tenant-scoped RLS policies. Service-layer scoping still uses the existing authenticated tenant context and scoped app state.

## API And RBAC

Add capability:

- `internal_copilot_chat`

Endpoint:

```text
POST /api/internal-copilot/messages
```

Request:

```ts
{ body: string }
```

Response:

- Updated `ManuAppState`.

Controlled errors:

- `internal_copilot_body_required`
- `internal_copilot_forbidden`

Ambiguous, unknown, missing-data, and unsupported questions are returned as grounded assistant messages instead of uncontrolled exceptions.

## Read-Only Tools

Initial tool registry:

- `resolveVisibleClientByName`
- `getClientSnapshot`
- `getClientDietPlan`
- `getClientRecentMessages`
- `getClientFormResponses`
- `getClientHandoffs`
- `getClientAiDecisionHistory`

Tool rules:

- Tools operate only on the already-visible scoped state.
- Tools accept resolved visible client IDs.
- Tools never write, update, delete, send, approve, dismiss, or create client-facing artifacts.
- Tools never return secrets, auth data, service role keys, environment variables, raw provider credentials, or external provider payloads.
- Tool results are bounded and source-referenced.

## Engine Behavior

Supported V1 intents:

- Client status summary
- Diet plan lookup
- Recent message summary
- Dynamic form response lookup
- Open handoff and risk review lookup
- AI decision history lookup
- Unsupported fallback

Answer rules:

- Ambiguous client names ask for clarification.
- Unknown or hidden clients produce a no-visible-client answer.
- Missing data is stated as unavailable in MANU-AI records.
- Clinical/risk answers summarize records and recommend dietitian review instead of making clinical decisions.
- The assistant never diagnoses, adjusts medication or supplement doses, manages emergencies, or independently changes diet plans.
- The assistant never uses "I remember" language unless the answer is directly grounded in retrieved records.

## Verification

- Unit tests cover intent classification, client resolution, source references, hidden-client behavior, prompt-injection-as-data behavior, and fallback persistence.
- API tests cover fallback persistence and controlled body validation.
- RBAC tests cover `internal_copilot_chat` role access.
- RLS integration tests cover tenant isolation for the new tables when local Supabase is available.
- `npm run release:verify` must pass.

Latest implementation verification on 2026-05-30 passed with core tests 39/39, app tests 96/96, app lint, production build, and only the documented R-405 production audit findings.

## Non-Approvals

This phase does not approve production pilot launch, real client health data, real WhatsApp/Telegram messaging, real Gemini or external LLM use, external notifications, monitoring, analytics, or secret-manager integrations.
