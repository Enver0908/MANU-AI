# Phase 28 AI Security Remediation Spec

Date: 2026-05-31

## Scope

Phase 28 closes the repo-level remediation items from the AI architecture/security audit without connecting real providers, real channels, monitoring, secret managers, or real health data.

## Implemented Controls

- `ai_decisions.provider_attempted` is now persisted and constrained so provider metadata is meaningful only when a provider call was actually attempted.
- No-call paths such as manual, paused, passive, red-risk, preflight, and context-budget blocks use `providerAttempted=false`, `model=null`, `providerId=null`, and `providerStatus=not_called`.
- Provider failure masking is narrowed to `MockProviderError`; app/core domain errors are no longer normalized as provider failures.
- PromptContext segments carry `sourceId`, `origin`, `createdAt`, and `authority` metadata.
- The newest dietitian-authored source is explicitly marked `authority: newest_dietitian_authored`; both manual messages and Critical Context updates participate in the same precedence rule.
- ContextManifest remains raw-text-free and stores only source metadata, token estimates, truncation, and exclusion data.
- Draft approve/edit-send now revalidates draft status, decision state, context revision, channel permission, takeover lock, AI mode/status, latest promptable message id, and memory version/revision/staleness before any client-facing send.
- Provider input is built through an allowlisted PromptContext segment boundary and rejects red risk, unknown segment types, overlong segments, extra keys, raw prompt payloads, capsules, and raw message/profile objects.
- Context shrink order drops oldest recent messages first, then truncates rolling summary, context updates, form summary, and pinned notes; current inbound message is never truncated.
- Channel identity and inbound idempotency uniqueness are tenant-aware.
- Supabase RLS now uses helper functions for tenant role, current dietitian, client read/write scope, conversation scope, and internal copilot scope.
- RLS policies align owner/admin, dietitian, assistant, viewer assignment, care-team assignment, auditor, and internal copilot access with service-layer behavior.
- The local TypeScript declaration for `dietitian-ai-assistant-architecture` now exposes concrete core result, PromptContext, ContextManifest, provider-attempt, activation, and mode decision types.

## Verification

- Core tests include no-provider audit metadata, PromptContext metadata and dietitian-source precedence, provider-boundary fail-closed behavior, and expanded clinical golden cases.
- App tests include no-provider decision metadata, narrow provider failure handling, draft send-time revalidation success/failure, tenant-aware idempotency behavior, and strict core declaration usage through production build.
- RLS integration tests cover assistant assigned-client read-only access, viewer read-only assignment, dietitian owned/care-team write access, unassigned denial, auditor raw-table denial, internal copilot scoping, and tenant-aware channel/idempotency uniqueness when local Supabase is configured.

## Remaining Non-Code Gates

Production pilot remains blocked until external legal/privacy, qualified dietitian clinical taxonomy, provider/vendor retention, WhatsApp/Telegram policy, operational ownership, backup/restore, secret rotation, and R-405 dependency decisions are completed or formally accepted.
