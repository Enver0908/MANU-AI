# Phase 27 Dietitian Context Update Spec

## Goal

Let a dietitian add confirmed client context from outside WhatsApp or Telegram, such as phone, Zoom, or face-to-face conversations.

These records become the newest authoritative MANU-AI context for that client. They do not rewrite old WhatsApp messages, but they supersede older prompt context when future AI decisions are compiled.

## Decisions

- V1 uses a free-text workflow with structured metadata: source, occurred-at time, importance, title, summary, and details.
- The dietitian is treated as the authorized source when they save the record.
- New records are active immediately.
- Saving a record increments `client.contextRevision`.
- Saving a record invalidates pending AI drafts for that client.
- Active records are included in PromptContext as bounded `dietitian_context_update` segments.
- Superseded records remain in the database but are excluded from PromptContext.

## Data Model

Add `ClientContextUpdateRecord` to app state and `client_context_updates` to Supabase.

Fields:

- `id`
- `tenantId`
- `clientId`
- `dietitianId`
- `source`: `phone`, `zoom`, `in_person`, or `other`
- `occurredAt`
- `title`
- `summary`
- `details`
- `importance`: `routine`, `important`, or `critical`
- `status`: `active` or `superseded`
- `supersedesUpdateId`
- `createdAt`

## PromptContext Rules

- Include at most 5 active context updates per client.
- Sort newest first by `occurredAt`.
- Do not include superseded updates.
- Context update text may enter PromptContext, but never `ContextManifest` raw metadata.
- The manifest records only source id, segment type, truncation, and token estimate.
- If context update content conflicts with old WhatsApp messages or rolling summary, the dietitian-entered context update is treated as the newer authority.
- If a newer `dietitian_manual` WhatsApp/Telegram/manual message conflicts with an older context update, the newer dietitian-authored message wins.
- The provider-facing system instruction states that the newest dietitian-authored source in PromptContext is authoritative.

## API And UI

Add:

```text
POST /api/clients/[id]/context-updates
```

The dashboard adds a Critical Context panel under the selected client detail surface.

The endpoint uses the existing `update_client` capability. Owner, admin, and dietitian roles can write in Supabase mode; assistant and auditor remain blocked.

## Safety And Governance

- No client-facing message is sent when a context update is saved.
- No diet plan or health-profile field is automatically rewritten.
- The feature is local/mock and does not connect real WhatsApp, Telegram, Gemini, email, push, monitoring, secret manager, or real client health data.
- Client export includes context update history.
- Client anonymization redacts context update text and marks affected records as superseded.

## Verification

- Core tests cover PromptContext inclusion, manifest raw-text exclusion, current message id preservation, and superseded update exclusion.
- Core tests cover latest dietitian-authored source precedence when a later manual message follows an older context update.
- App tests cover create, audit, context revision increment, draft invalidation, export inclusion, and anonymization redaction.
- App lint, unit tests, core tests, production build, and release verification must pass.
