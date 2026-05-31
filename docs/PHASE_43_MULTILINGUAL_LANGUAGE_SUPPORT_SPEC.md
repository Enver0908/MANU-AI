# Phase 43 Multilingual Language Support Spec

Date: 2026-05-31

## Goal

Add deterministic multilingual support for English, Turkish, German, French, Spanish, Portuguese, and Czech without connecting real providers, real channels, or real client health data.

This phase keeps production pilot blocked. It does not approve any launch gate, resolve R-405, unblock R-406, or add external translation/LLM services.

## Scope

In scope:

- Add a canonical supported-language model using ISO-style codes: `tr`, `en`, `de`, `fr`, `es`, `pt`, and `cs`.
- Store each dietitian's dashboard UI language preference.
- Store each client's communication language and canonical E.164 phone identity.
- Store form schema and form response language metadata.
- Use the most recent saved form response language as the client's conversation language.
- Make provider-facing PromptContext include a bounded language instruction segment.
- Make local/mock AI replies and handoff safe acknowledgements follow the client's stored language.
- Expand clinical safety tests for supported languages.

Out of scope:

- Public client-facing form links.
- Automatic translation of form text or answers.
- Real Gemini, external LLM, translation API, WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, backup provider, or real client health-data processing.
- Production pilot approval or external clinical/legal/provider/channel approval.

## Decisions

- Default language is Turkish (`tr`) for existing records and new demo records.
- Dashboard UI language is stored per dietitian, not per tenant or browser.
- Client communication language is stored per client.
- The latest saved form response language wins over the prior client language.
- Form text is written by the dietitian in the selected schema language; the system records the language but does not translate.
- Canonical client phone is a separate `primaryPhoneE164` field and is not overloaded onto Telegram user ids.
- Phone normalization is strict: accepted values must match E.164-like `+` plus 8 to 15 digits. The system does not infer country codes.

## Data Model

App records:

- `DietitianRecord.uiLanguage`
- `ClientRecord.communicationLanguage`
- `ClientRecord.primaryPhoneE164`
- `ClientFormSchemaRecord.languageCode`
- `ClientFormResponseRecord.languageCode`
- `ClientFormResponseRecord.submittedPhoneE164`

Supabase additions:

- `dietitians.ui_language text not null default 'tr'`
- `clients.communication_language text not null default 'tr'`
- `clients.primary_phone_e164 text`
- `client_form_schemas.language_code text not null default 'tr'`
- `client_form_responses.language_code text not null default 'tr'`
- `client_form_responses.submitted_phone_e164 text`
- Tenant-scoped unique index on non-null client phone numbers.

## Prompt And Safety

- PromptContext includes a `conversation_language` segment before user/context segments.
- ContextManifest records `communicationLanguage` and `languageSource` as metadata only.
- Provider allowlist accepts `conversation_language`.
- Red risk still makes no provider call.
- Safe acknowledgement templates are static and localized for the seven supported languages.
- Clinical safety coverage includes supported-language cases for red/yellow/green behavior.

## Done Criteria

- Supported language codes are validated at API and state boundaries.
- Client creation and update can store phone and communication language.
- Form schema creation stores language.
- Form response save validates submitted phone, records response language, updates client communication language, increments context revision, and invalidates stale drafts.
- Local/mock provider replies in the client's stored language.
- Dashboard has a dietitian UI language selector and client/form language controls.
- Tests cover language metadata, phone validation, draft invalidation, prompt language segment, localized handoff acknowledgement, multilingual clinical routing, and provider output language.
- `npm run release:verify` passes with only documented R-405 findings.

## Non-Approval Statement

This phase does not approve production pilot launch, real health-data processing, real WhatsApp or Telegram messaging, real Gemini/external LLM use, provider risk acceptance, R-405 acceptance, R-406 mitigation, or any external launch gate.
