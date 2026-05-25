# AI Provider Requirements

## Current Status

MANU-AI uses only a deterministic local mock provider. No real Gemini or external LLM provider is connected.

## Requirements Before Real Health-Data Use

- Vendor terms must permit the intended healthcare/nutrition support use case.
- Health-data retention must be disabled or contractually bounded.
- Prompts and completions must not be used for provider training.
- Provider logs must exclude raw health messages unless a legal basis and retention policy are approved.
- Prompt version, model, provider id, and error metadata must be auditable.
- Red-risk flows must never call the provider.
- Provider failure must produce safe no-send or dietitian-review behavior.
- Provider input must be allowlist-built and runtime-guarded before any provider call.
- Raw prompts, full context capsules, channel identifiers, health profiles, clinical notes, message collections, memory objects, and secrets must not be passed as provider input.

## Launch Gate

Real Gemini or other LLM provider use with health data is blocked until vendor-risk, legal/privacy, and clinical safety reviews are complete.
