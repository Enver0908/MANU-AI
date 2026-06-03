# AI Provider Requirements

## Current Status

MANU-AI uses only deterministic local/mock provider behavior. No real Gemini or external LLM provider is connected.

Phase 26 internal copilot is also local/mock only. It may read already-visible tenant-scoped app state through curated read-only tools, but it does not send copilot questions, tool results, source refs, client records, or message history to an external provider.

Phase 27 dietitian context updates are local/mock prompt context only. They can enter bounded PromptContext for simulator/mock provider behavior, but real provider egress for these records remains blocked until legal/privacy, clinical, provider, and data-minimization review.

Phase 28 adds provider-attempt audit semantics and a stricter provider boundary: no-call safety/control paths must record `providerAttempted=false`, `providerStatus=not_called`, `providerId=null`, and `model=null`; actual provider attempts must be traceable with provider id/status/model metadata. Provider input is limited to allowlisted PromptContext segments and source metadata.

Phase 36 adds `PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md` for external vendor, legal, and security review. The packet is not an approval artifact, and real provider egress remains blocked.

## Prompt Token Budget (Future Integration)

Phase 59 documents that the local/mock `estimateTokens()` heuristic (`characters / 3`) in `context-compiler.js` is acceptable only for the current prototype.

Before any real Gemini or external LLM integration:

- Use provider-native token counting (for example Gemini `countTokens` or an approved provider-specific equivalent).
- Reconcile prompt budget, reserve, and segment truncation against real tokenizer output for Turkish and other supported languages.
- Do not treat local character-based estimates as production approval evidence.

## Requirements Before Real Health-Data Use

- Vendor terms must permit the intended healthcare/nutrition support use case.
- Health-data retention must be disabled or contractually bounded.
- Prompts and completions must not be used for provider training.
- Provider logs must exclude raw health messages unless a legal basis and retention policy are approved.
- Prompt version, model, provider id, and error metadata must be auditable.
- Provider-attempt state must be auditable; no-call paths must not be represented as successful or failed provider attempts.
- Red-risk flows must never call the provider.
- Provider failure must produce safe no-send or dietitian-review behavior.
- Provider input must be allowlist-built and runtime-guarded before any provider call.
- Provider input segment types must remain allowlisted; unknown segment types, overlong segments, extra keys, raw prompts, capsules, raw message collections, and red-risk payloads must fail closed.
- Raw prompts, full context capsules, channel identifiers, health profiles, clinical notes, message collections, memory objects, and secrets must not be passed as provider input.
- Internal copilot provider egress must have its own allowlist, source-ref policy, tool-result minimization policy, and legal/vendor/security review before any real provider is used.
- Dietitian context update egress must have explicit provider allowlist, retention, logging, and clinical safety approval before real provider use.

## Launch Gate

Real Gemini or other LLM provider use with health data is blocked until vendor-risk, legal/privacy, and clinical safety reviews are complete. This includes any future attempt to connect the Phase 26 internal copilot or Phase 27 dietitian context updates to a real provider.
