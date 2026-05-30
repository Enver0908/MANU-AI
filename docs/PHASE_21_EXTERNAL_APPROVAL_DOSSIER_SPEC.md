# Phase 21 External Approval Dossier Spec

## Goal

Move MANU-AI from local pilot-foundation evidence to an external approval-ready dossier without approving launch gates or connecting real production systems.

## Scope

- Create a single production-pilot gate closure dossier.
- Update planning and handoff docs so Phase 21 is the next unambiguous step.
- Record the latest local release verification result from 2026-05-28.
- Keep every production-pilot launch gate open unless external approval evidence is provided by the user.
- Keep R-405 visible as a production launch blocker.

## Out Of Scope

- No real WhatsApp Business Cloud API or Telegram Bot API integration.
- No real Gemini, external LLM, email, push, monitoring, analytics, or secret manager integration.
- No real client health data connection.
- No launch-gate approval, legal claim, clinical sign-off, vendor acceptance, or R-405 acceptance.
- No dependency upgrade, canary Next.js move, invalid npm override, or `npm audit fix --force`.

## Edge Cases

- Stale evidence must show its verification date instead of being presented as current.
- Missing external reviewer names or sign-offs must remain placeholders.
- Example packets must not include real client identifiers, raw health messages, secrets, prompts, or channel identifiers.
- Internal tests and runbooks must not be treated as legal, clinical, provider, platform, or security approval.
- If npm publishes a stable Next.js/PostCSS fix later, it must be evaluated separately before changing dependencies.

## Done Criteria

- `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md` lists all 8 launch gates with required evidence, internal evidence, missing external decisions, acceptable artifacts, and status.
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `PLAN.md`, `PROJECT_PLAN.md`, and `HANDOFF_FOR_NEXT_CODEX.md` point to Phase 21 as the next step.
- Git/checkpoint documentation no longer says the workspace has no Git repository.
- `npm run release:verify` remains the verification command for the dossier baseline.
