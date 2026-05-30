# Phase 24 Dietitian Voice Sample Infrastructure Spec

## Goal

Collect approved dietitian message examples after onboarding and generate a reusable dietitian voice profile for MANU-AI replies.

## Scope

- Support paste/TXT-style sample intake in the app state and API layer.
- Store samples separately from the generated voice profile.
- Require approved samples before profile generation.
- Use the existing `buildDietitianVoiceProfile(samples)` core function.
- Keep real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, and real health data disconnected.

## Decisions

- Minimum profile generation threshold: 10 approved samples.
- Recommended operating band: 20-50 approved samples.
- Maximum samples used for one generated profile: 100.
- Maximum single sample length: 1,000 characters.
- Duplicate samples are rejected by normalized body hash.
- Sample statuses: `draft`, `approved`, `rejected`.
- Profile statuses: `default`, `generated`, `needs_samples`.

## Edge Cases

- Empty paste produces no samples.
- Very long samples are rejected.
- Duplicate samples are ignored.
- Fewer than 10 approved samples blocks profile generation.
- Rejected samples are never used for profile generation.
- Profile generation writes audit evidence and does not change clinical safety behavior.

## Done Criteria

- The app can store, approve/reject, and generate from dietitian samples.
- Generated profile is passed to the core orchestrator when available.
- Tests cover parsing, duplicate handling, minimum threshold, and simulator profile usage.
