# Phase 36 / Completion Roadmap Phase 7 - Provider Vendor Review Packet Spec

Date: 2026-05-31

## Goal

Prepare the `provider_vendor_review` launch gate for external vendor, legal, and security review.

This phase creates a review packet only. It does not approve real Gemini or external LLM use, does not add provider credentials, and does not connect any real provider path.

## Scope

In scope:

- Map the current local/mock provider controls to the required provider/vendor review decisions.
- Document the missing vendor-risk, retention, logging, training-use, region, access-control, and incident-obligation decisions.
- Separate internal engineering evidence from external approval artifacts.
- Update the production pilot dossier, evidence pack, approval intake, risk register, provider requirements, plans, and handoff notes.

Out of scope:

- Real Gemini or external LLM SDK integration.
- Provider credentials, secret manager configuration, environment variables, or production provider routing.
- Prompt/completion logging to any external vendor.
- Internal copilot egress to a real provider.
- Dietitian context update egress to a real provider.
- Runtime behavior, schema, dependency, channel, launch-gate approval, or real-client-data changes.

## Current Technical Baseline

- `app/src/lib/ai-provider.ts` uses deterministic local/mock provider behavior only.
- Phase 28 no-call paths record `providerAttempted=false`, `providerStatus=not_called`, `providerId=null`, and `model=null`.
- Actual local/mock provider attempts record provider id, model, prompt version, provider status, and provider error metadata.
- Provider input is built from allowlisted PromptContext segments and guarded at runtime.
- Red-risk and unsafe payloads fail closed before provider use.
- Internal copilot and dietitian context updates remain local/mock only unless separately approved for provider egress.

## Required External Decisions

External review must decide:

- Whether the provider terms permit the intended healthcare/nutrition support use case.
- Whether health-data retention is disabled, contractually bounded, or otherwise acceptable.
- Whether prompts and completions are excluded from provider training.
- Whether provider logs may contain any raw health messages, and under what legal basis and retention duration.
- Which model ids and provider regions are approved for pilot use.
- Which cross-border transfer, access-control, support-access, and subprocessors are acceptable.
- Which incident and breach notification obligations apply.
- Whether internal copilot provider egress is allowed, and under what separate minimization rules.
- Whether dietitian context update provider egress is allowed, and under what clinical, privacy, and minimization rules.

## Edge Cases

- Local/mock provider evidence is not vendor approval.
- A successful `npm run release:verify` result does not approve external provider egress.
- Provider-attempt audit metadata must not be interpreted as proof that a real provider was called.
- Red-risk no-call behavior must remain intact if a real provider is later added.
- Prompt/completion logging must remain disabled or unimplemented until legal/vendor/security review explicitly permits it.
- R-405 and R-406 remain independent launch blockers.

## Done Criteria

- `docs/PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md` exists.
- The external approval intake references the provider review packet while keeping `provider_vendor_review` open.
- The production pilot dossier and evidence pack include the packet as internal evidence, not approval.
- Plans, provider requirements, risk register, and handoff notes reflect Phase 36.
- `npm run release:verify` passes with only documented R-405 findings.

## Verification

`npm run release:verify` passed on 2026-05-31 after the Phase 36 documentation update:

- Core package tests: 49/49 passed.
- App tests: 103/103 passed.
- App lint: passed.
- Production build: passed.
- Production dependency audit: passed with only documented R-405 findings.
