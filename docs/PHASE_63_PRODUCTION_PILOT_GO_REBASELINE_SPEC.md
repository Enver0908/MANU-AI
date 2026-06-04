# Phase 63 Production Pilot GO Rebaseline Spec

Date: 2026-06-04

## Goal

Rebaseline the production-pilot path from a small local pilot assumption to a WhatsApp-first, Gemini-only production pilot program that can grow to 100 dietitians with at least 50 clients per dietitian.

This phase is documentation and execution-planning only. It does not approve production launch, connect real WhatsApp, connect Gemini, process real client health data, close launch gates, accept R-405, or change runtime behavior.

## Locked Pilot Decisions

- Target scale: up to 100 dietitians, each with 50 or more clients; plan for at least 5,000 active clients.
- Channel sequence: WhatsApp-first. Telegram remains later-stage and out of the initial production pilot.
- Provider sequence: Gemini-only for the initial production AI provider path.
- Automation posture: green autopilot may be used in production pilot only after all required gates are approved and only for selected clients with opt-in, completed safety checklist, active AI, approved WhatsApp policy coverage, and operational monitoring.
- Forms: the user will provide dietitian-facing and client-facing form definitions. The implementation must not invent final form content.
- Legal/privacy and clinical approval artifacts: the user will provide these externally. Repository docs may record sanitized references only.
- Clinical regulation source: the user will provide official health-regulation PDFs. They must be converted into a traceable, reviewed, versioned corpus before active production use.

## Production-Pilot Rebaseline

The current local app remains a prototype. The target production pilot now requires scale and evidence gates beyond the current local snapshot:

- Dashboard and internal-copilot broad reads must be replaced by bounded, paginated reads before the 100-dietitian / 5,000-client pilot.
- Client removal/anonymization must move to a dedicated transactional redaction contract before production data lifecycle use.
- The Phase 61 placeholder scope corpus is not acceptable for production routing. Official PDFs must be extracted, chunked, reviewed, approved, versioned, and covered by golden tests.
- The dynamic form infrastructure is acceptable as a base, but final dietitian and client form schemas must come from the user-supplied form definitions and legal/clinical approval artifacts.
- R-405 remains open unless a safe stable Next.js/PostCSS path appears or formal external risk acceptance is supplied.

## Regulation PDF Ingestion Contract

Official PDF ingestion is a mandatory future phase before clinical taxonomy approval can close:

- Store source metadata: document title, issuing authority, publication date, supplied file reference, checksum, language, and corpus version.
- Extract text with page and section references; use OCR fallback only when normal text extraction is insufficient.
- Split the text into traceable sections and candidate rules. Each derived rule must retain PDF page/section references.
- Keep extracted rules in `draft` until qualified clinical review approves them.
- Assign each approved rule an escalation level (`yellow` or `red`) and a clinical rationale. Green behavior is represented by absence of escalation plus existing safety checks, not by downgrade rules.
- Generate rule-level golden cases before activation: positive, negative, and boundary cases for each approved rule family.
- Block corpus activation when extraction confidence is low, page references are missing, rules conflict, or reviewer approval is incomplete.
- Keep real embedding/LLM retrieval disconnected until `clinical_taxonomy_approval`, `provider_vendor_review`, and explicit environment gating approve it.

## Form Contract

The user owns final form content. Implementation must provide safe schema machinery only:

- Dietitian-facing forms: credential, clinic, operational, legal/compliance, and pilot-readiness data as supplied by the user.
- Client-facing forms: intake, permission/opt-in, follow-up, safety profile, and language fields as supplied by the user.
- Each field must declare type, required status, options when applicable, and visibility classification.
- Prompt visibility must be explicit and conservative: `prompt_allowed` only when approved; otherwise non-promptable.
- Schema versions and response snapshots must remain immutable for historical responses.
- Prompt-affecting form changes must invalidate pending drafts and increment client context revision.

## Scale Contract

The 100-dietitian / 5,000-client target makes these future phases production prerequisites:

- Cursor pagination for clients, timelines, handoff queues, notifications, audit views, and internal-copilot source reads.
- Scoped client create/profile/AI-control reloads instead of tenant-wide state reloads.
- Load and visual evidence for large client lists, dense handoff queues, and mobile workflows.
- Tenant, dietitian, client, and channel scoped rate limits with production tuning.
- Operational health signals for open handoffs, stale drafts, provider failures, launch gates, corpus status, and rate-limit denials.

## Required User Inputs

The user must supply, outside the repo when sensitive:

- Official health-regulation PDF files and source metadata.
- Dietitian and client form definitions.
- Legal/privacy approval artifacts.
- Qualified dietitian clinical approval artifacts.
- Gemini provider/vendor approval artifacts.
- WhatsApp policy and opt-in/out approval artifacts.
- Incident/DSAR, backup/restore, secret rotation, and R-405 risk-acceptance artifacts.
- Pilot roster boundaries and rollout authorization for each ring.

## Non-Goals

- No code implementation for PDF ingestion, forms, pagination, Gemini, WhatsApp, evidence engine, or redaction RPC in this phase.
- No launch gate closure.
- No R-405 risk acceptance.
- No real provider, real channel, monitoring, backup provider, secret manager, or real health-data processing.
- No production pilot `GO` decision.

## Done Criteria

- This spec exists and records the new production-pilot target.
- Continuity docs record that Phase 63 is a rebaseline and that production remains `NO-GO`.
- Next-action guidance prioritizes artifact-backed gate closure, official PDF corpus ingestion, user-supplied forms, pagination/scale work, transactional redaction, Gemini, and WhatsApp integration as separate future phases.
- Risk register reflects the increased scale and the official-PDF corpus dependency.
