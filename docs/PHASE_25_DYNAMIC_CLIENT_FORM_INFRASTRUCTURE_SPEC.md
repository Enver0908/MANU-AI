# Phase 25 Dynamic Client Form Infrastructure Spec

## Goal

Allow MANU-AI to accept evolving client intake forms without code changes for each form content change.

## Scope

- Store form schemas as versioned records.
- Store client responses with the schema version and field snapshot used at save time.
- Include only prompt-allowed response fields in PromptContext.
- Invalidate pending AI drafts when a client form response changes promptable context.
- Keep real health data and real external providers disconnected.

## Decisions

- Schema statuses: `draft`, `published`, `archived`.
- Published schemas are immutable; edits create a new version.
- Field types: `text`, `textarea`, `number`, `boolean`, `select`, `multiselect`, `date`.
- LLM visibility: `never` or `prompt_allowed`.
- Responses keep a `schemaSnapshot` so old form answers remain readable after schema changes.
- Active form is the newest published schema by version.

## Edge Cases

- A client can have no response for the active form.
- A schema without fields cannot be published.
- Required fields must be present in responses.
- Select/multiselect responses must use configured options.
- Non-prompt fields never enter PromptContext.
- Saving a form response increments client context revision and invalidates pending drafts.

## Done Criteria

- Admin/dietitian APIs can create and publish schemas.
- Client form responses are validated and stored with snapshots.
- PromptContext can include a bounded `client_form_summary` segment.
- Tests cover schema versioning, validation, prompt allowlist, and draft invalidation.
