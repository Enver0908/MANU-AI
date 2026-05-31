# MANU-AI Project Plan v2

## Confidence Position

This plan has been hardened after a gap audit against clinical safety, multi-tenant SaaS requirements, WhatsApp/Telegram platform constraints, AI-provider data handling, and KVKK/GDPR-style privacy expectations.

No serious health-data SaaS plan can be guaranteed with literal 100 percent certainty before legal review, provider contract review, clinical validation, and a live pilot. The correct engineering target is: no known unaddressed product, safety, privacy, platform, or operational blocker remains before implementation starts.

## 1. Product Definition

### Goal

MANU-AI is a supervised AI messaging assistant for dietitians. It answers routine client messages through WhatsApp and Telegram, uses each client's dietitian-approved profile and plan, preserves strict client isolation, and escalates risky or clinical situations to the dietitian.

### Core Promise

Dietitians save time on repetitive client communication while staying in control of clinical decisions, plan changes, and sensitive health conversations.

### Product Boundary

MANU-AI is not an autonomous dietitian and does not diagnose, prescribe, manage emergencies, or independently change a nutrition plan. It is a communication and follow-up assistant operating under dietitian-defined rules.

### Non-Negotiable Launch Gates

- Legal and privacy review completed before real client health data is processed.
- Medical-device or clinical-decision-support classification review completed before production pilot.
- WhatsApp and Telegram policies reviewed before external channel launch.
- WhatsApp healthcare-use feasibility approved before WhatsApp pilot.
- Client-facing legal and permission documentation completed before production messaging.
- Red-risk messages never receive autonomous AI-generated advice.
- Unknown or ambiguous channel identities never reach the LLM.
- Every production AI decision is auditable.
- Every external provider that may receive health data is approved through a vendor-risk process.
- Autopilot is disabled by default for pilot tenants unless explicitly enabled per client.

## 2. Current Foundation

The current architecture package already includes:

- Multi-tenant reference schema
- Six communication personas
- Dietitian voice profile builder
- Client context capsule
- Conversation memory model
- Dietetic safety classifier
- Human handoff engine
- Response quality guard
- Per-client AI mode system
- End-to-end orchestration tests

The first client-facing legal and permission documentation layer is intentionally excluded because it will be prepared separately.

## 3. MVP Scope

### Must Have

- Dietitian account and workspace
- Responsive web dashboard plus installable mobile PWA shell
- Client creation and profile form intake
- Client-specific WhatsApp or Telegram identity mapping
- Explicit opt-in/opt-out state for each messaging channel
- Per-client AI activation state: `active` or `passive`
- Optional per-client AI activation window
- Per-client persona selection
- Per-client AI mode: `autopilot`, `copilot`, `manual`, `paused`
- Conversation inbox
- AI draft generation for routine messages
- Automatic send only for safe green messages in autopilot mode
- Human review queue for yellow and red messages
- Dietitian handoff notifications
- Full audit trail for AI decisions
- Webhook idempotency and duplicate-message protection
- Data retention, deletion, and export workflow
- Role-based access control for clinic and dietitian teams
- Basic dashboard metrics

### Should Have

- Dietitian voice profile setup from sample messages
- Conversation memory summaries
- Client risk notes
- Message delivery status
- Manual pause/resume for a client
- Clear message labels showing whether each message was written by the client, AI, or dietitian
- Message provenance dataset for improving prompts and evaluation
- Admin-visible safety decision history

### Out Of MVP

- Native iOS and Android App Store apps in the first MVP. The MVP still includes an installable PWA/mobile app shell.
- Direct electronic health record integrations
- Payment/subscription billing
- Advanced analytics
- Fine-tuning
- Automated medical document interpretation
- Voice note, image, PDF, and lab-result interpretation
- Autonomous plan generation
- Automated emergency triage beyond safe acknowledgement and human escalation
- Multi-language clinical personalization beyond Turkish-first support

## 4. Architecture Milestones

### Milestone 0: Product, Legal, and Safety Gate

Complete this before building production messaging.

Deliverables:

- Product claims matrix: what MANU-AI does, does not do, and must never imply.
- Medical-device and clinical-decision-support classification memo.
- Licensed-professional involvement memo: how dietitian review, responsibility, and scope limits work.
- KVKK/GDPR role map: tenant, dietitian, platform, AI provider, messaging provider.
- Data category inventory: ordinary personal data, health data, channel metadata, audit logs, model metadata.
- Legal basis matrix for each processing activity.
- Vendor-risk checklist for Google Gemini or any model provider, Supabase, Meta, Telegram, email, monitoring, and analytics vendors.
- WhatsApp healthcare-use feasibility memo: country availability, regulated-vertical restrictions, telemedicine boundary, age restrictions, and business account risk.
- Legal and permission integration points ready for the documentation you will prepare separately.
- Clinical safety policy approved by a qualified dietitian.
- Pilot-mode rule: no fixed copilot waiting period. Each client's mode is selected directly by the dietitian, and `autopilot` requires mandatory safety fields plus explicit client-level enablement.

Acceptance Criteria:

- No real health data enters the app before this milestone is complete.
- Every data flow has a lawful basis and retention owner.
- Every external processor/subprocessor is listed.
- Product copy avoids "replaces dietitian" positioning.
- The product is classified as supervised communication support, or legal counsel documents any additional regulatory obligations.
- Dietitian license/credential verification requirements are defined for production tenants.
- The app can enforce legal/permission state once your documentation is added.
- WhatsApp is not used for production health-data messaging until the healthcare-use feasibility memo is approved.

### Milestone 1: Application Shell

Build a real app around the current core package.

Deliverables:

- Next.js application scaffold inside `MANU-AI`
- Supabase project integration
- Auth-protected dashboard
- Mobile-first responsive shell
- PWA manifest and installable app setup
- Push-notification readiness for urgent handoffs
- Tenant and dietitian membership model
- Environment configuration
- Basic layout: dashboard, clients, conversations, handoff queue, settings

Acceptance Criteria:

- A dietitian can sign in.
- The app knows which tenant the dietitian belongs to.
- Protected routes block unauthenticated users.
- Local development runs with one command.
- The dashboard works cleanly on desktop and mobile widths.
- The app can be installed to a phone home screen as a PWA.

Implementation Status (2026-05-25):

- Next.js application scaffold exists with local Supabase integration.
- `proxy.ts` acts as native Next.js 16 middleware protecting `/dashboard` routes.
- Server-side auth resolution in dashboard resolves user → membership → dietitian profile.
- Controlled error states exist for unauthenticated (redirect), no membership (403 UI), and missing dietitian profile (403 UI).
- Membership badge shows authenticated user name and role in dashboard header.
- Demo sign-in creates Supabase Auth session and tenant membership.
- Fallback mode works without Supabase for local development.
- PWA manifest and service worker are configured.
- Dashboard works on desktop, tablet, and mobile widths (verified by Playwright visual tests).

### Milestone 1B: Mobile App Strategy

Deliverables:

- PWA-first mobile experience for MVP.
- Mobile screens for urgent handoffs, draft approvals, AI active/passive toggle, and conversation review.
- Push notification architecture for urgent handoffs.
- Native app decision record for later React Native/Expo build.

Acceptance Criteria:

- Dietitian can use core workflows from a phone.
- Urgent handoff notification path is designed for mobile use.
- The PWA does not block future native iOS/Android apps.

### Milestone 2: Database and Tenant Isolation

Turn the reference SQL into real migrations.

Deliverables:

- Supabase migrations for tenants, dietitians, clients, conversations, messages, memories, handoff cases, AI decisions, and audit events
- Row Level Security policies
- Membership roles: owner, admin, dietitian, assistant, auditor
- Per-client access scope
- Client AI activation state and activation event history
- Message provenance fields for AI-generated, dietitian-manual, client-inbound, and system messages
- Encrypted fields for sensitive health profile values
- Retention policy tables and deletion jobs
- Processed webhook event table for idempotency
- Seed data for local development
- Database access helpers
- Tenant ownership validation utilities

Acceptance Criteria:

- A user can access only their own tenant data.
- A dietitian cannot see another dietitian's clients unless explicitly allowed by membership role.
- Clinic assistants can access only assigned clients or explicitly delegated queues.
- A client starts with AI passive unless a dietitian explicitly activates it.
- AI activation and passive transitions are audited.
- Every message records whether it was written by the client, by AI, or by the dietitian.
- Audit logs record who viewed, edited, exported, deleted, or generated from client data.
- Client context cannot be built from mismatched tenant, dietitian, or conversation records.
- Tests cover tenant isolation failures.
- RLS tests run in CI and fail closed.

Channel Permission Governance Status (Phase 3, 2026-05-25):

- Only `channelPermission === "ready"` allows AI generation. Pending, blocked, and opted_out all block.
- Identity quarantine blocks AI for empty channelUserId and unknown adultStatus.
- Permission changes are audited with previous/new values and distinct opt-out event type.
- `PermissionState` type extended with `opted_out` value.

### Milestone 3: Client Profile and Intake Form

Create the structured profile system that feeds the AI.

Deliverables:

- Client creation form
- Dietitian-entered or imported client intake data
- Health profile fields
- Nutrition goal fields
- Allergies and restricted foods
- Diet type and plan summary
- Clinical risk notes
- Pinned notes
- Channel identity fields
- Data-quality warnings for missing high-impact fields
- Separate "LLM-allowed" and "dietitian-only" field classification

Recommended Initial Profile Sections:

- Personal basics
- Primary goal
- Height, weight, age range, and activity level
- Diet type
- Current meal plan
- Allergies
- Foods avoided for preference or medical reason
- Diagnosed conditions
- Medication/supplement note placeholder
- Pregnancy/breastfeeding status
- Eating disorder risk note
- Dietitian-only notes
- Minor/guardian status
- Guardian contact and permission status when the client is a minor
- Preferred language
- Emergency contact policy note, if legally appropriate

Acceptance Criteria:

- A dietitian can create and edit a client.
- Every client belongs to one tenant and one dietitian.
- Each client has one selected persona and one AI mode.
- AI context receives only structured fields allowed for generation.
- Sensitive fields excluded from LLM prompts remain usable by the dietitian in the dashboard.
- The system blocks AI activation for autopilot if mandatory safety fields are missing.

### Milestone 4: Persona and Voice System

Make AI replies feel consistent with the dietitian's communication style while keeping safety constant.

Deliverables:

- Persona selection UI
- Persona descriptions in dashboard
- Dietitian sample message input
- Voice profile generation
- Voice profile preview
- Per-client override support

Acceptance Criteria:

- A dietitian can assign different personas to different clients.
- Persona affects tone, length, warmth, and emoji behavior.
- Persona does not change safety classification.
- Voice profile is included in prompt construction.

### Milestone 5: Conversation Inbox

Build the operator surface where dietitians actually work.

Deliverables:

- Client conversation list
- Message timeline
- AI decision badges
- Current mode indicator
- Current AI activation status
- Persona indicator
- Message author/origin label
- Manual message send
- AI draft preview
- Approve/edit/send workflow for copilot messages
- Pause/resume AI button

Acceptance Criteria:

- Dietitian can inspect recent messages and AI decisions.
- Dietitian can distinguish client messages, AI messages, and dietitian-written messages at a glance.
- Yellow messages appear as drafts requiring approval.
- Red messages appear as handoff cases.
- Manual dietitian replies are saved in the same conversation timeline.
- When a dietitian takes over a conversation, AI cannot auto-send until the handoff lock is released.
- Drafts are invalidated if the underlying client profile or recent conversation changes.

### Milestone 6: Safety and Handoff Operations

Make clinical risk handling operationally reliable.

Deliverables:

- Expanded risk taxonomy
- Handoff case dashboard
- Urgency labels
- Case assignment
- Case resolution
- Safe acknowledgement templates
- Notification channel abstraction
- Audit logging for every handoff

Risk Categories:

- Emergency symptoms
- Allergic reaction
- Eating disorder warning signs
- Self-harm language
- Pregnancy complications
- Diabetes/glucose concerns
- Medication or insulin dosing
- Lab result interpretation
- Supplement dosing
- Diagnosed condition management
- Plan change request
- Missing or ambiguous context

Acceptance Criteria:

- Red messages never produce an AI-generated client answer.
- Yellow messages do not auto-send.
- Red cases pause autopilot for that client.
- Resolving a case can resume the previous mode when the dietitian chooses.
- Dietitian can switch a client to passive mode at any time.
- Passive mode prevents AI generation, drafts, and auto-send for that client.
- Urgent handoff notifications have an SLA target and fallback channel.
- Off-hours behavior is explicit: safe acknowledgement plus queued urgent notification.
- Repeated borderline messages from the same client increase review priority.

### Milestone 7: WhatsApp Integration

Start with one production channel before adding the second.

Recommended Order:

1. WhatsApp Business Cloud API
2. Telegram Bot API

WhatsApp Deliverables:

- Webhook verification endpoint
- Inbound message normalization
- Phone number to client mapping
- WhatsApp opt-in and opt-out handling
- Approved template management for messages outside the 24-hour customer-service window
- Human escalation path visible and available
- Healthcare-use policy gate before connecting a production WhatsApp number
- Explicit no-commerce rule for medical or healthcare products inside chat
- Age and geography gating if any regulated vertical rule applies
- Provider message persistence
- Outbound send adapter
- Delivery status webhook
- Retry and failure logging
- Provider error taxonomy and account-quality monitoring

Acceptance Criteria:

- A WhatsApp message from a known client creates a message record.
- Unknown numbers are quarantined and never sent to AI.
- Reused or changed phone numbers require dietitian confirmation before matching to a client.
- STOP/opt-out requests disable outbound automation for that channel.
- Known client messages run through the orchestrator.
- Safe autopilot messages send through WhatsApp.
- Messages outside the allowed service window use approved templates or are held for operator action.
- WhatsApp Business App is not used for the automated assistant; production uses WhatsApp Business Platform only.
- Messages do not sell, promote, or facilitate restricted healthcare products.
- If the client is under 18, WhatsApp production use is blocked unless legal/platform review explicitly approves the exact flow.
- Provider delivery status appears in the dashboard.

### Milestone 8: Telegram Integration

Add Telegram after WhatsApp architecture is stable.

Deliverables:

- Telegram webhook endpoint
- Telegram user ID mapping
- Bot privacy policy link and command support
- Inbound normalization
- Outbound send adapter
- Bot command handling for basic start/help flows

Acceptance Criteria:

- Telegram messages use the same core orchestrator.
- Telegram and WhatsApp conversations stay separate.
- The same client can have one or both channels when explicitly configured.

### Milestone 9: AI Provider Integration

Replace mock generation with real LLM calls.

Deliverables:

- AI provider module
- Structured prompt builder
- Model configuration
- Google Gemini provider configuration and data-retention review
- `store: false` or equivalent no-storage configuration where supported
- PHI/health-data provider eligibility review
- Timeout handling
- Retry policy
- Token/cost logging
- Guardrails before and after generation

Acceptance Criteria:

- LLM receives only the client context capsule.
- LLM output always passes the quality guard before sending.
- Failed generation creates a safe no-send decision.
- Prompt and response metadata are auditable without exposing unnecessary sensitive data.
- Model and prompt versions are recorded for every decision.
- Prompt changes are reversible through versioned releases.
- No fine-tuning or eval upload uses real client data unless separately approved.

### Milestone 10: Memory System

Move from simple recent messages to durable memory.

Deliverables:

- Rolling conversation summary job
- Durable facts extraction
- Recent window selection
- Dietitian-editable pinned notes
- Memory invalidation when profile changes
- Memory correction and deletion workflow

Acceptance Criteria:

- Prompt does not include unlimited chat history.
- Important client-specific facts persist.
- Memory is scoped to exactly one client and one conversation.
- Dietitian can correct pinned notes.
- Deleted client data is removed from active memory and excluded from future prompts.

### Milestone 11: Notifications

Make handoff usable in real practice.

Deliverables:

- In-app notification center
- Email notification option
- Optional Telegram/WhatsApp notification to dietitian for urgent cases
- Notification preferences
- Quiet hours
- Escalation fallback if urgent notification is not acknowledged

Acceptance Criteria:

- Red cases notify the dietitian quickly.
- Yellow cases appear in queue without noisy alerting by default.
- Notifications include reason, client, and message preview.
- Sensitive content is limited in external notifications.
- Urgent cases remain visible until acknowledged or resolved.

Notification Architecture Status (Phase 4, 2026-05-25):

- `NotificationRecord` added with `read` and `acknowledge` capabilities.
- Dashboard includes a Bell icon with an unread badge and dropdown panel showing recent notifications.
- Red handoffs queue a safe-text notification in the simulator without exposing raw client health messages.
- Future milestone tasks: Email/Push integration, user preferences, and notification database tables.

### Milestone 12: Audit, Observability, and Admin

Build operational confidence through traceability.

Deliverables:

- AI decision logs
- Message delivery logs
- Handoff logs
- Safety classifier version tracking
- Admin metrics
- Error monitoring
- Basic cost monitoring

Core Metrics:

- Automated replies
- Drafts requiring approval
- Handoff cases
- Red risk events
- Average response time
- Dietitian time saved estimate
- AI send failure rate
- Quality guard block rate

Acceptance Criteria:

- Every automated decision can be reconstructed.
- Admin can see system health.
- Dietitian can understand why AI did or did not answer.

### Milestone 13: Data Governance and Privacy Operations

Deliverables:

- Data retention schedule by table and data category.
- Client data export workflow.
- Client deletion/anonymization workflow.
- Consent/permission state integration points.
- Subprocessor registry.
- Data residency decision record.
- Analytics minimization policy.
- DSAR-style request handling process.
- Backup retention and restore testing.

Acceptance Criteria:

- The app can report data inventory, processing purpose, storage location, recipient list, and deletion schedule.
- Deletion removes active profile, memory, channel mapping, and promptable context while preserving legally necessary audit records in minimized form.
- Production analytics never include raw health messages unless explicitly approved.

### Milestone 14: Messaging Reliability and Channel Policy

Deliverables:

- Inbound event idempotency table keyed by provider event/message ID.
- Outbound message state machine: queued, sent, delivered, failed, held, cancelled.
- Dead-letter queue for failed automation decisions.
- WhatsApp template registry.
- Channel opt-out and unsubscribe handling.
- Provider backoff and retry policy.
- Manual override for delivery failures.

Acceptance Criteria:

- Duplicate webhooks do not create duplicate AI replies.
- Provider retries are safe.
- A delayed webhook cannot trigger stale autopilot if the dietitian has taken over.
- Every outbound message has a final known state or a visible failure.

### Milestone 15: Clinical Governance and Evaluation

Deliverables:

- Clinical safety taxonomy owned by a qualified dietitian.
- Licensed-professional involvement policy.
- Dietitian credential verification workflow for production onboarding.
- Golden test set for routine, yellow, and red messages.
- Persona regression tests.
- Prompt injection and jailbreak test set.
- Body-image, eating-disorder, and minors safety test set.
- Red-team scenarios for health-data leakage and unsafe advice.
- Release checklist for classifier and prompt changes.
- Human review sampling policy for autopilot replies.
- Message provenance dataset strategy.
- Per-dietitian style example retrieval from dietitian-written replies.
- AI draft correction dataset from dietitian-edited drafts.

Acceptance Criteria:

- No prompt or classifier change ships without passing clinical golden tests.
- No prompt or classifier change ships without passing eating-disorder, minors, and body-image safety tests.
- Autopilot samples are reviewed during pilot.
- Safety failures create tracked corrective actions.
- A rollback path exists for prompt, model, and classifier versions.
- AI-generated messages are never treated as ground-truth examples unless approved or edited by the dietitian.

### Milestone 16: Security Operations

Deliverables:

- Threat model for webhooks, tenant isolation, LLM prompts, dashboard access, and provider integrations.
- Secret rotation procedure.
- Encryption key management plan.
- Log redaction policy for messages, prompts, profile fields, tokens, and provider payloads.
- Rate limiting and abuse detection.
- Admin action audit logging.
- Incident response playbook.
- Breach notification workflow.
- Dependency scanning and update policy.

Acceptance Criteria:

- Public webhooks reject unsigned or invalid requests where provider verification is available.
- Secrets are never stored in source code or logs.
- Raw messages, prompts, and health-profile fields are not written to application logs by default.
- Incident response can identify affected tenants and clients.
- Restore procedure is tested before pilot.

### Milestone 17: Commercial Readiness

Deliverables:

- Plan limits: clients, messages, AI credits, team seats.
- Cost guardrails and monthly tenant spend caps.
- Tenant suspension and billing hold behavior.
- Onboarding checklist.
- Support runbook.
- SLA statement for pilot and paid tiers.

Acceptance Criteria:

- One tenant cannot exhaust shared AI or messaging budget.
- Failed billing cannot silently break urgent handoffs.
- Support can inspect delivery and AI decision state without viewing unnecessary health content.

## 5. Technical Stack Recommendation

### Frontend

- Next.js
- TypeScript
- React server components where appropriate
- Tailwind CSS
- Lucide icons
- Responsive web dashboard
- PWA install support for mobile use
- Future native app path: React Native with Expo after SaaS workflow validation

### Backend

- Next.js API routes for MVP
- Supabase Postgres
- Supabase Auth
- Row Level Security
- Queue worker for message processing, handoff notifications, retries, and memory compaction
- Scheduled jobs for retention, summaries, and stale-case alerts

### AI

- Google Gemini API through a provider abstraction
- Green routine messages use `gemini-1.5-flash`
- Yellow review-required messages use `gemini-3`
- Red-risk messages do not call an LLM
- Deterministic safety classifier before LLM
- LLM generation only after green/yellow routing
- Quality guard after LLM
- Provider data-retention controls configured before real client data
- Versioned prompt, model-routing, and classifier registry

### Messaging

- WhatsApp Business Cloud API first
- Telegram Bot API second
- Shared normalized message interface

## 6. Data Flow

1. Client sends message through WhatsApp or Telegram.
2. Provider webhook receives the event.
3. Adapter verifies webhook and checks idempotency.
4. Adapter normalizes payload.
5. System resolves tenant, dietitian, client, conversation, and channel.
6. Unknown, inactive, or ambiguous channel identity is quarantined.
7. Inbound message is persisted.
8. Current legal/permission state is checked through the integration point.
9. Context capsule is built from allowed data only.
10. Safety classifier runs.
11. AI activation state is checked.
12. Mode system chooses action only if AI is active.
13. LLM generates only when allowed.
14. Quality guard validates the draft.
15. Human takeover lock and stale-context check run before send.
16. System sends, queues for approval, creates handoff, holds, or records `no_ai` because the client is passive.
17. Message origin, AI decision, provider state, and audit event are persisted.
18. Memory and dataset views are updated asynchronously after safety checks.

## 7. Security and Compliance Workstream

### Required Controls

- Tenant-scoped database rows
- RLS on every tenant table
- Separate channel identity mapping
- No cross-client memory access
- No raw full-history prompt stuffing
- Audit event for every AI action
- Encryption strategy for highly sensitive profile fields
- Secrets in environment variables only
- Webhook signature verification where supported
- Rate limiting on public endpoints
- Idempotency for inbound webhooks and outbound retries
- Least-privilege service keys
- Field-level classification: prompt-allowed, dashboard-only, encrypted-only
- Backup and restore policy
- Data retention and deletion policy
- Subprocessor registry
- Incident response playbook
- Access review for clinic team members

### Clinical Safety Controls

- AI cannot diagnose.
- AI cannot prescribe.
- AI cannot adjust medication.
- AI cannot handle emergencies.
- AI cannot independently change the diet plan.
- AI must escalate ambiguous symptoms.
- AI must escalate high-risk client categories unless explicitly reviewed.
- AI must not interpret lab documents, meal photos, prescriptions, or voice notes in MVP.
- AI must not infer a diagnosis from weight, symptoms, labs, or medical history.
- AI must not recommend restrictive fasting, purging, laxatives, or unsafe rapid weight-loss behavior.
- AI must not continue autopilot after red-risk handoff until the case is resolved.
- AI must not promote unhealthy dieting, body shaming, or unsafe exercise behavior, especially for minors.
- AI must keep licensed-professional involvement in the loop for tailored advice that requires professional judgment.

### Compliance Readiness Checklist

- KVKK privacy notice and processing inventory prepared.
- Special-category health data controls reviewed.
- Cross-border transfer position reviewed.
- Medical-device or clinical-decision-support classification reviewed.
- Dietitian license/credential onboarding reviewed.
- Client-facing legal and permission flow integrated.
- WhatsApp opt-in and opt-out process implemented.
- Telegram bot privacy policy configured.
- Google Gemini/provider retention and healthcare eligibility reviewed.
- Legal counsel review completed before production pilot.
- WhatsApp healthcare-use feasibility reviewed, including whether the use case is permitted for the launch geography and age group.

## 8. Dashboard Structure

### Overview

- Today's messages
- AI replies sent
- Pending approvals
- Urgent handoffs
- Time saved estimate

### Clients

- Client list
- Client detail
- Profile form
- AI active/passive toggle
- Activation window controls
- Persona selection
- AI mode selection
- Risk notes
- Channel mappings

### Conversations

- Inbox
- Conversation timeline
- Message origin labels
- AI decision panel
- Draft approval panel
- Manual reply composer

### Handoffs

- Open cases
- Urgency filters
- Reason filters
- Resolve flow
- Pause/resume controls

### Settings

- Dietitian profile
- Voice profile
- Notification preferences
- Messaging channel setup
- Safety preferences within allowed limits

## 9. Testing Strategy

### Unit Tests

- Safety classifier
- AI activation resolver
- Mode decision
- Context capsule tenant checks
- Quality guard
- Persona loading
- Voice profile builder
- Data-field prompt allowlist
- Webhook idempotency helpers
- Opt-out state decisions
- Human takeover lock
- Message provenance mapping

### Integration Tests

- Inbound WhatsApp webhook to AI decision
- Unknown number quarantine
- Green autopilot send
- Yellow draft approval
- Red handoff and autopilot pause
- Passive client blocks generation
- Scheduled activation window blocks generation before start
- Message origin is persisted for client, AI, and dietitian messages
- Tenant isolation across clients
- Duplicate webhook does not duplicate-send
- Stale draft cannot be sent after profile update
- Dietitian takeover prevents autopilot send
- Deleted client memory cannot be used in prompt
- Provider send failure appears in dashboard

### Manual QA

- Dietitian creates client
- Client sends routine meal swap question
- Client asks symptom question
- Client sends allergic reaction message
- Dietitian edits and approves a draft
- Dietitian pauses AI for one client
- Dietitian activates AI for one client
- Dietitian sets AI passive for one client
- Dietitian sends a manual WhatsApp reply in a mixed AI/manual conversation
- Client sends STOP/opt-out request
- Unknown phone number sends message
- Provider webhook arrives twice
- Dietitian takes over while AI job is queued
- Urgent notification is not acknowledged

## 10. Build Sequence

### Phase 0: Risk and Compliance Foundation

1. Create data inventory and legal basis matrix.
2. Define data controller/processor roles.
3. Finalize product claims and forbidden claims.
4. Configure legal/permission integration points.
5. Create clinical safety taxonomy v1.
6. Create vendor-risk checklist.

### Phase 1: Product Core

1. Scaffold Next.js app.
2. Add Supabase auth.
3. Create database migrations.
4. Add tenant and membership model.
5. Build dashboard shell.
6. Add responsive mobile layout.
7. Add PWA manifest and installable shell.

### Phase 2: Client Management

1. Build client list.
2. Build client detail page.
3. Add profile form.
4. Add persona and mode controls.
5. Add AI active/passive controls.
6. Add voice profile settings.

### Phase 3: Conversation Core

1. Add conversations and messages tables.
2. Add message provenance fields.
3. Build inbox UI.
4. Wire current orchestrator into internal test endpoint.
5. Add AI activation state handling.
6. Add AI decision persistence.
7. Add handoff queue.

### Phase 4: WhatsApp MVP

1. Add webhook verification.
2. Normalize inbound messages.
3. Add idempotency and event persistence.
4. Resolve client by phone number.
5. Enforce opt-in/opt-out state.
6. Call orchestrator.
7. Send safe responses inside allowed service-window rules.
8. Store delivery statuses.
9. Add template registry for messages outside the service window.

### Phase 5: Production Hardening

1. Add rate limits.
2. Add queue worker and retry/dead-letter handling.
3. Add audit views.
4. Add error monitoring.
5. Add notification preferences.
6. Add retention/deletion workflows.
7. Expand safety tests.
8. Run pilot with direct per-client mode selection and no fixed copilot waiting period.

### Phase 6: Telegram and Growth Features

1. Add Telegram adapter.
2. Add native app planning package for React Native/Expo.
3. Add subscription billing.
4. Add onboarding flows.
5. Add team roles.
6. Add analytics and reports.

## 11. Pilot Plan

### Pilot Setup

- 3 to 5 dietitians
- 10 to 30 clients per dietitian
- No fixed copilot waiting period.
- Per-client mode is selected by the dietitian.
- Per-client AI activation is selected by the dietitian.
- Autopilot is available only when mandatory safety fields are complete and the dietitian explicitly enables it for that client.

### Pilot Success Metrics

- 40 percent or more routine messages drafted
- 20 percent or more safe messages auto-sent after explicit dietitian enablement
- Zero known cross-client context leaks
- Zero red-risk auto replies
- Dietitians report meaningful time savings
- Clients report conversation still feels natural and helpful

### Pilot Review Outputs

- Most commonly escalated message categories.
- Preferred personas by dietitian and client segment.
- Reply patterns that feel generic or off-brand.
- Intake fields that most improve answer quality.
- Main reasons dietitians reject or edit an AI reply.

## 12. Immediate Next Sprint

### Sprint Goal

Turn the architecture kit into a working local SaaS prototype with dashboard, database migrations, and client profile management.

### Implementation Update - 2026-05-22

The first local SaaS prototype is now in `app`.

Completed:

- Next.js 16 app scaffold with TypeScript, Tailwind, lucide icons, and webpack-based scripts.
- Demo-protected `/dashboard` route through `src/proxy.ts`.
- Installable PWA shell with manifest, service worker, and app icon.
- Supabase migration converted from the reference schema and extended with tenant memberships, permission state, takeover lock, idempotency table, RLS policies, and persona seeds.
- Local dashboard shell with overview, client controls, conversation timeline, simulator, and handoff queue.
- Local simulator wired to the existing `handleInboundMessage` core package.
- Local tests for green auto-send, yellow draft, red handoff, passive mode, scheduled activation, duplicate simulation idempotency, human takeover lock, and mandatory safety field gating.

### Implementation Update - 2026-05-23

Started the Supabase foundation plan.

Completed:

- Added `docs/NEXT_SUPABASE_FOUNDATION_SPEC.md` with goal, scope, success criteria, and edge cases.
- Added local Supabase config at `app/supabase/config.toml`.
- Added schema fix migration for message status, AI decision reasons, client safety checklist, dietitian auth uniqueness, and membership-based RLS policy cleanup.
- Replaced dashboard `localStorage` state loading with API-backed state loading.
- Added API endpoints for app state, client create/update, simulator, manual messages, and handoff resolve/dismiss.
- Added dev fallback store so the dashboard remains usable before local Supabase credentials are connected.
- Expanded app tests from 8 to 12.

Remaining for the next implementation slice:

- Add RLS integration tests against local Supabase.

### Implementation Update - Supabase Store Wiring - 2026-05-23

Completed:

- Added `app/src/lib/supabase-store.ts`.
- API routes now use Supabase persistence when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured.
- The dev fallback store still works when Supabase env vars are missing.
- Supabase store auto-seeds demo tenant data and supports app state load/reset, client create/update, manual replies, simulator persistence, and handoff resolve/dismiss.
- Build, lint, app tests, and core tests pass after the store wiring.

### Implementation Update - Live Local Supabase Verification - 2026-05-23

Completed:

- Started local Supabase successfully for project `manu-ai-local`.
- Applied local migrations to Supabase Postgres.
- Created `app/.env.local` with the generated local Supabase URL, publishable key, and service secret.
- Verified Supabase services:
  - API: `http://127.0.0.1:54321`
  - Studio: `http://127.0.0.1:54323`
  - Database: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Verified `http://127.0.0.1:3000/api/app-state` returns seeded demo state from live Supabase.
- Verified `http://127.0.0.1:3000/dashboard` returns HTTP 200.
- Verified `/api/simulator` writes a simulated inbound message, AI-generated reply, AI decision, idempotency key, and audit event to Supabase.
- Verified `/api/messages/manual` writes a dietitian manual reply to Supabase.
- Reset demo state back to seed data after the write tests.
- Re-ran `npm run lint`, `npm test`, and `npm run build` in `app`; all passed.

### Implementation Update - Supabase Auth Wiring - 2026-05-23

Completed:

- Added Supabase SSR browser/server client helpers.
- Demo sign-in now creates or reuses `demo@manu.local` when Supabase is configured.
- Demo sign-in links the auth user to the demo tenant through `tenant_memberships` and `dietitians.auth_user_id`.
- `/dashboard` now requires a verified Supabase Auth user when Supabase is configured.
- Supabase-backed API routes resolve tenant/dietitian context from the verified auth user.
- Supabase-backed API routes return `401` without a session and `403` without tenant/dietitian membership.
- Verified unauthenticated `/api/app-state` returns `401`, unauthenticated `/dashboard` redirects to `/`, demo sign-in creates a session, `/api/app-state` returns demo tenant data, and `/api/simulator` still processes a green demo message.
- Added `npm run test:rls` with local Supabase integration coverage for tenant-member reads, membership-less reads, and cross-tenant write blocking.
- Added draft approval/edit-send/dismiss workflow and verified persistence against local Supabase.
- Added explicit human takeover release workflow and verified that release restores green autopilot behavior after a takeover block.
- Added detailed safety checklist validation for autopilot readiness and verified missing checklist keys block simulator generation.

Operational note:

- Codex in-app browser could not open localhost because of its own URL policy. The app itself was verified through HTTP checks, and the Windows/default browser was opened to `http://localhost:3000/dashboard`.

Next focus:

- Add browser visual regression checks once browser access is stable.

### Implementation Update - Pilot Foundation Hardening - 2026-05-23

Completed:

- Added `docs/PILOT_FOUNDATION_HARDENING_SPEC.md`.
- Added migration `app/supabase/migrations/20260524000000_restore_auxiliary_rls_policies.sql`.
- Restored tenant-scoped RLS policies for `client_ai_status_events`, `conversation_memories`, and `risk_assessments`.
- Expanded `npm run test:rls` from 3 to 5 tests.
- Fixed Supabase simulator persistence so processed idempotency events use the simulated client's channel.
- Supabase-backed AI control updates now persist `client_ai_status_events` and `client_ai_control_updated` audit events.
- Verified `npm run lint`, `npm test`, `npm run test:rls`, and core `npm test`.

Next focus:

- Expand browser visual regression coverage beyond the dashboard smoke test.
- Expand handoff notification architecture beyond the current in-app audit stub.

### Implementation Update - Pilot Foundation Execution - 2026-05-25

Completed:

- Added `docs/PILOT_FOUNDATION_EXECUTION_SPEC.md`.
- Added `risk_assessments` state and Supabase persistence for simulator inbound messages.
- Added migration `app/supabase/migrations/20260525000000_risk_assessment_message_uniqueness.sql`.
- Added `MANU_DEV_FALLBACK_STORE=true` support at Supabase config resolution for proxy/API/test fallback mode.
- Guarded RLS integration tests so remote Supabase execution requires `MANU_ALLOW_REMOTE_RLS_TESTS=true`.
- Added core safety golden tests for green/yellow/red dietetic risk examples and quality guard blocks.
- Added Playwright dashboard smoke tests for desktop, tablet, and mobile Chromium viewports.
- Added `handoff_notification_queued` audit events as the first in-app handoff notification stub.

Additional Phase 1 hardening completed on 2026-05-25:

- Expanded Playwright fallback visual coverage for draft controls, manual long replies, red handoff, safety-checklist-blocked states, handoff queue visibility, and mobile/tablet overflow checks.
- Added controlled API error handling for known simulator, manual reply, draft, handoff, and takeover failures.
- Added app tests for forced fallback mode and controlled API errors.
- Verified the Phase 1 suite: core tests, app lint, app unit tests, RLS guard, build, and visual tests.

Next focus:

- Keep launch gates open for clinical taxonomy approval, provider/legal review, real-channel policy review, operational ownership, and R-405 clearance.
- Follow `docs/NEXT_PHASE_EXECUTION_PLAN.md` as the canonical phased execution plan.

Additional Phase 2-8 execution completed on 2026-05-25:

- Phase 2 added production-style auth/onboarding shell states for no-membership and missing-dietitian-profile users.
- Phase 3 added opt-out permission governance and identity quarantine. A follow-up migration added `opted_out` to the Supabase `permission_state` enum.
- Phase 4 added in-app notification records, read/acknowledge actions, and safe-text handoff notification rules.
- Phase 5 added retention placeholders, tenant/client-scoped export, client anonymization, promptable-context invalidation, and data-governance tests.
- Phase 6 added clinical golden JSONL cases, risk/action/model/provider-call assertions, expanded persona invariants, safety classifier v0.2.0, and the qualified-dietitian taxonomy review workflow.
- Phase 7 added normalized mock channel adapter contracts, known/unknown/ambiguous identity handling, duplicate event idempotency, permission/opt-out channel tests, and provider metadata redaction rules without connecting real channels.
- Phase 8 added a deterministic mock AI provider, prompt/provider metadata on AI decisions, timeout/error taxonomy, safe provider-failure no-send behavior, and provider requirements docs without connecting real Gemini or external LLMs.

Phase 9 pilot readiness closure completed on 2026-05-25:

- Local Git checkpoint foundation and root ignore rules were added.
- Classifier metadata was aligned with `dietetic-risk-v0.2.0`.
- Supabase notification persistence was added for safe-text in-app notification records.
- Notification read and acknowledge endpoints now persist in Supabase and remain tenant-scoped.
- Local Supabase migrations were applied and RLS integration tests passed 5/5 against local Supabase with fallback disabled.
- Dependency audit risk R-405 remains open by explicit decision: no safe stable Next.js/PostCSS path exists yet, and breaking/canary/invalid-tree options were rejected.
- Real providers, real channels, push/email adapters, and real health data remain disconnected.

Phase 10 production readiness gates completed on 2026-05-25:

- Added `docs/PHASE_10_PRODUCTION_READINESS_GATES_SPEC.md`.
- Added a production-pilot launch gate evaluator covering legal/privacy, clinical taxonomy, provider/vendor, channel policy, incident response, backup/restore, secret rotation, and dependency audit clearance.
- Default launch state is blocked; unknown approval keys are ignored.
- App tests now include 54 passing tests.
- No real providers, real channels, push/email adapters, or real health data were connected.

Phase 11 operational evidence readiness completed on 2026-05-25:

- Added required evidence labels to every production-pilot launch gate.
- Added draft incident response, backup/restore, and secret rotation runbooks.
- Added `docs/PHASE_11_OPERATIONAL_EVIDENCE_READINESS_SPEC.md`.
- App tests now include 55 passing tests.
- No real providers, real channels, monitoring vendor, secret manager, push/email adapters, or real health data were connected.

Phase 12 RBAC authorization completed on 2026-05-25:

- Added typed tenant roles and app capabilities.
- Supabase-backed API routes now enforce capability checks before current production actions.
- Owner/admin/dietitian retain existing access; assistant/auditor are fail-closed beyond read-only app-state until scoped assignment and auditor views are added.
- App tests now include 58 passing tests.
- No real providers, real channels, monitoring vendor, secret manager, push/email adapters, or real health data were connected.

Phase 13 client assignment and scoped access completed on 2026-05-25:

- Added `client_assignments` migration and tenant-scoped RLS policy.
- Added role/assignment-based Supabase app-state filtering.
- Owner/admin remain tenant-wide; dietitians see owned plus assigned clients; assistants see assigned clients only; auditors receive no raw client/message state.
- RLS integration covers assignment tenant isolation.
- App tests now include 62 passing tests.
- No assignment UI, minimized auditor dashboard, real providers, real channels, push/email adapters, or real health data were connected.

Phase 14 DSAR, retention, and legal ops ledger completed on 2026-05-25:

- Added `data_requests` migration and `DataRequestRecord` app-state entries.
- Fallback and Supabase export/anonymization paths now record completed legal ops requests.
- Client export bundles include only the target client's data request history.
- RLS integration covers `data_requests` tenant isolation.
- App tests now include 63 passing tests.
- No automatic deletion scheduler, final retention durations, real providers, real channels, push/email adapters, or real health data were connected.

Phase 15 safe observability and operational health completed on 2026-05-25:

- Added safe operational health snapshot generation.
- Snapshot reports aggregate counts for handoffs, provider failures, unread notifications, pending/stale drafts, passive clients, and launch-gate blockage.
- Added monitoring policy draft defining allowed and prohibited payloads.
- App tests now include 66 passing tests.
- No external monitoring, analytics, logging, email, push, real providers, real channels, secret manager, or real health data were connected.

Phase 16 channel policy simulation hardening completed on 2026-05-25:

- Added a channel policy hardening spec.
- Mock channel events now fail closed for missing provider event ids and empty message bodies before client lookup or AI processing.
- Matched-client opt-out commands update channel permission to `opted_out` without entering the AI path.
- Channel policy audit metadata stays minimized and excludes raw bodies and channel identifiers.
- App tests now include 70 passing tests.
- No real WhatsApp, Telegram, Gemini, monitoring, email, push, secret manager, or real health data were connected.

Phase 17 provider policy guard and prompt boundary completed on 2026-05-25:

- Added a provider policy guard and prompt boundary spec.
- Mock provider input is built through an allowlist containing only `risk` and `client.dietPlan.summary`.
- Runtime provider guard rejects raw prompt, capsule, message, memory, channel identity, health profile, clinical note, and pinned-note leakage.
- Red-risk provider calls fail closed at the provider boundary as defense in depth.
- Provider policy violations become controlled safe no-send simulator decisions.
- App tests now include 75 passing tests.
- No real Gemini, external LLM, monitoring, analytics, real channel, secret manager, or real health data was connected.

Phase 18 notification SLA and internal escalation completed on 2026-05-25:

- Added a notification SLA and internal escalation spec.
- Added aggregate SLA detection for unacknowledged open handoff notifications.
- Urgent handoff notifications breach after 15 minutes and count as internal escalation due.
- Standard handoff notifications breach after 4 hours.
- Operational health now includes safe aggregate SLA breach and urgent escalation counts.
- App tests now include 78 passing tests.
- No real email, push, WhatsApp, Telegram, monitoring, analytics, secret manager, or real health data was connected.

Phase 19 release verification, CI script, and dependency gate completed on 2026-05-25:

- Added a release verification and dependency gate spec.
- Added `npm run release:verify`.
- Release verification runs core package tests, lint, app tests, production build, and production dependency audit.
- The dependency gate allows only the documented R-405 Next.js/PostCSS production audit finding.
- Unknown production audit findings and high/critical production vulnerabilities fail closed.
- `npm audit fix --force` remains blocked.
- Phase 19 verification passed with 35 core tests and 78 app tests while reporting R-405 as an open production launch blocker.

Phase 20 pilot readiness evidence pack completed on 2026-05-25:

- Added a pilot readiness evidence pack spec.
- Added `docs/PILOT_READINESS_EVIDENCE_PACK.md`.
- Mapped all eight production-pilot launch gates to internal evidence and remaining blockers.
- Recorded the latest release verification result.
- Confirmed production pilot remains blocked until external approvals and R-405 resolution or formal acceptance.
- No real provider, real channel, external notification, monitoring, secret manager, or real health data was connected.

### Sprint Tasks

1. Create `MANU-AI/docs/RISK_REGISTER.md`.
2. Create `MANU-AI/docs/DATA_INVENTORY.md`.
3. Create a Next.js app under `MANU-AI/app`.
4. Install TypeScript, Supabase, Tailwind, and UI dependencies.
5. Convert `data-model.sql` into Supabase migrations.
6. Add auth-protected dashboard layout.
7. Add client list and create-client form.
8. Add persona and AI mode selectors.
9. Add AI active/passive selector.
10. Add a local "simulate inbound message" screen.
11. Call the existing orchestrator from the simulator.
12. Show the resulting AI action: sent, draft, handoff, or no AI.
13. Show whether each message is client, AI, dietitian, or system.
14. Add tests for the simulator path.
15. Add duplicate inbound simulation test.
16. Add human-takeover lock simulation.
17. Add passive AI and scheduled activation tests.

### Sprint Definition Of Done

- App runs locally.
- Dietitian can create a client.
- Dietitian can activate or deactivate AI per client.
- Dietitian can choose persona and AI mode per client.
- A simulated client message produces the correct orchestration result.
- Green autopilot, yellow draft, and red handoff are visible in the UI.
- Duplicate simulated inbound messages do not duplicate AI actions.
- Human takeover blocks auto-send.
- Missing mandatory safety fields block autopilot.
- Passive AI state blocks generation.
- Conversation timeline distinguishes AI-written and dietitian-written messages.
- No real WhatsApp credentials are required yet.

## 13. Default Decisions and Validation Points

These defaults remove planning ambiguity. They can change only through an explicit decision record.

- MVP channel: WhatsApp first, Telegram second.
- Tenant model: one clinic or solo dietitian per tenant; multiple dietitians and assistants can belong to one tenant.
- Client intake owner: dietitian enters or approves the profile before AI can use it.
- Mandatory v1 intake fields: name, channel identity, goal, diet plan summary, allergies, restricted foods, diagnosed-condition flag, medication/supplement flag, pregnancy/breastfeeding flag, eating-disorder risk flag, dietitian-only risk notes, preferred language, and adult/minor status.
- Autopilot pilot default: disabled until mandatory safety fields are complete and the dietitian explicitly enables it. There is no fixed copilot waiting period.
- Urgent handoff notification default: in-app plus email. WhatsApp/Telegram notification to dietitian is added only after channel policy review.
- AI provider retention default: no real health data goes to Google Gemini or any model provider until data-retention controls and vendor terms are approved.
- LLM field default: only allowlisted profile, diet plan, allergies, restricted foods, pinned notes, and recent message summary. Raw full profile is never sent.
- First production geography default: Turkey-only pilot until cross-border transfer and EU/US obligations are separately reviewed.
- Clinic assistant access default: supported through limited roles, but no assistant sees a client unless assigned or tenant admin grants access.
- Human review rate default: sample autopilot replies retrospectively during pilot and adjust the review rate after safety review. Automation is rule-gated by risk level, safety fields, and explicit dietitian enablement.

## 14. Recommended Next Action

Continue from the Phase 31 evidence state: Completion Roadmap Phase 2 attempted local Supabase RLS evidence on 2026-05-31, but Docker Desktop's Linux engine pipe was unavailable, local Supabase could not start, and `npm run test:rls` skipped 10 guarded tests. R-406 remains blocked until Docker/local Supabase is available and the expanded RLS suite passes locally. After that evidence is produced, use `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md` to collect legal/privacy, qualified dietitian, provider/vendor, WhatsApp/Telegram policy, incident/DSAR, backup/restore, secret rotation, internal copilot provider-egress, dietitian context update provider-egress, RLS local execution, and dependency audit evidence.

Phase 23 adds a stricter AI context foundation: provider calls must use a bounded `PromptContext`, context manifests must exclude raw text, missing historical context must fail closed with `[ERROR: missing_historical_context]`, and `send_status="send_blocked"` must route the conversation to dietitian takeover instead of sending or drafting to the client.

Phase 26 adds a read-only internal dietitian copilot using curated tenant-scoped database tools over already-visible app state. It is local/mock only, source-referenced, blocks assistant/auditor access in v1, and adds no raw SQL, mutation tools, real provider, real channel, external notification, monitoring, secret manager, or real health data path.

Phase 27 adds dietitian-entered Critical Context records for phone, Zoom, in-person, or other non-chat conversations. These records are local/mock app context, increment client context revision, invalidate pending drafts, and enter bounded PromptContext as `dietitian_context_update` segments without rewriting old WhatsApp messages or automatically changing diet plans. Phase 28 marks the newest dietitian-authored source across manual messages and Critical Context updates as authoritative through source metadata.

Phase 28 adds provider-attempt audit semantics, send-time draft revalidation, provider segment allowlist fail-closed checks, tenant-aware channel/idempotency uniqueness, scoped RLS/RBAC helpers, strict core TypeScript declarations, and expanded clinical golden cases. Latest local release verification on 2026-05-31 passed with core tests 49/49, app tests 103/103, lint, production build, and only the known R-405 production audit findings.

Phase 29 adds pilot gate closure and evidence hardening without runtime behavior changes. It records that stable `next@latest` is still 16.2.6 with `postcss@8.4.31`, that `eslint-config-next@latest` is still 16.2.6, and that the expanded RLS suite remains environment evidence to rerun against local Supabase when available. `npm run release:verify` passed after Phase 29 with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings. All eight production-pilot launch gates remain open.

Phase 31 records the Completion Roadmap Phase 2 RLS evidence attempt. The RLS guard remained safe for non-local Supabase URLs, but local Supabase startup failed because Docker Desktop's Linux engine pipe was unavailable. `npm run test:rls` skipped 1 file and 10 tests, so no passing RLS evidence was produced. R-406 remains blocked and must not be marked mitigated until the expanded suite passes against local Supabase. `npm run release:verify` passed after Phase 31 documentation with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Phase 32 records the Completion Roadmap Phase 3 R-405 stable patch recheck. Stable `next@latest` remains `16.2.6` with nested `postcss@8.4.31`, `eslint-config-next@latest` remains `16.2.6`, and production audit still reports only the known moderate `next`/`postcss` findings. No dependency files were changed because the accepted stable patch path is still unavailable. R-405 remains an open production launch blocker. `npm run release:verify` passed after Phase 32 documentation with core tests 49/49, app tests 103/103, lint, production build, and only documented R-405 findings.

Phase 33 records the Completion Roadmap Phase 4 external approval evidence intake. It adds a structured intake packet for all eight production-pilot launch gates, mapped to the canonical launch gate ids, required evidence, approval owner, acceptable artifact, current status, and notes. No external approval artifacts were supplied, so all launch gates remain open; R-405 remains open and R-406 remains blocked.

Phase 34 records the Completion Roadmap Phase 5 legal and privacy review packet. It adds a counsel-facing packet for the `legal_privacy_review` gate, maps internal evidence to required legal/privacy decisions, and lists missing decisions for lawful basis, privacy notice, permission flow, medical-device/CDS classification, retention, DSAR/deletion, internal copilot records, dietitian context updates, provider dependency, and channel dependency. No legal/privacy approval artifact was supplied, so the gate remains open.

Phase 35 records the Completion Roadmap Phase 6 clinical taxonomy review packet. It adds a qualified-dietitian-facing packet for the `clinical_taxonomy_approval` gate, summarizes current green/yellow/red golden case coverage, maps tests and workflow evidence to required sign-off, and lists missing qualified dietitian decisions. No clinical approval artifact was supplied, so the gate remains open.

Phase 36 records the Completion Roadmap Phase 7 provider vendor review packet. It adds a vendor/legal/security-facing packet for the `provider_vendor_review` gate, maps current local/mock provider controls to required vendor, retention, logging, training-use, region, access-control, incident-obligation, internal copilot egress, and dietitian context update egress decisions, and confirms that no provider approval artifact was supplied. Real provider egress remains blocked.

Phase 37 records the Completion Roadmap Phase 8 channel policy review packet. It adds a platform/policy-facing packet for the `channel_policy_review` gate, maps current mock WhatsApp/Telegram controls to required WhatsApp healthcare-use, Telegram bot/privacy, opt-in/out, template, service-window, webhook, delivery-status, account-quality, and fallback decisions, and confirms that no channel approval artifact was supplied. Real WhatsApp and Telegram traffic remains blocked.

Phase 38 records the Completion Roadmap Phase 9 incident and DSAR review packet. It adds an operations/legal/privacy/clinical-facing packet for the `incident_response_runbook` gate, maps the draft incident runbook, export/anonymization skeleton, legal ops ledger, and safe operational health evidence to required owner, escalation, breach, notification, DSAR/deletion, and re-enable decisions, and confirms that no incident/DSAR approval artifact was supplied.

Phase 39 records the Completion Roadmap Phase 10 backup restore review packet. It adds an operations/security/legal-facing packet for the `backup_restore_test` gate, maps the draft backup/restore runbook to required provider, region, retention, restore-drill, encryption, legal-hold, tenant-isolation, RLS, data-governance, and drill evidence decisions, and confirms that no backup/restore approval artifact or restore-drill evidence was supplied.

Do not connect real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, dietitian context updates to a real provider, or real client health data until the relevant launch gates are externally approved. Keep Phase 28 provider-attempt, PromptContext, send-revalidation, and RLS/RBAC invariants intact before any provider/channel work. Keep Phase 29 evidence packet status current before external review. R-405 remains a production launch blocker until a safe stable Next.js/PostCSS patch path exists or formal risk acceptance is provided.

For R-405 specifically, follow `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`: update `next` and `eslint-config-next` only when a stable Next.js release bundles `postcss >= 8.5.10`, then require a clean production audit and `npm run release:verify`. Do not use canary Next.js, `npm audit fix --force`, invalid npm overrides, or major downgrades.

## 15. Gap Audit Result

### Initial Gaps Found

- The first plan did not explicitly require a legal/product risk gate before production messaging.
- Data retention, deletion, export, and DSAR-style workflows were underspecified.
- KVKK/GDPR role mapping and subprocessor governance were missing.
- WhatsApp opt-in, opt-out, approved templates, 24-hour service-window behavior, and human escalation requirements were underdeveloped.
- Telegram bot privacy policy setup was missing.
- Google Gemini/provider retention mode, healthcare eligibility, and prompt storage controls were not explicit.
- Webhook idempotency, duplicate prevention, stale job prevention, and dead-letter handling were not explicit.
- Human takeover locking was missing.
- Clinical governance, golden tests, prompt rollback, and safety change management were too light.
- Incident response, breach workflow, backup/restore, and secret rotation were missing.
- Minors/guardian handling was missing from intake planning.
- Voice, image, PDF, and lab-result handling needed to be explicitly excluded from MVP.

### Corrections Applied

- Added Milestone 0 for product/legal/safety gate.
- Added data governance, messaging reliability, clinical governance, security operations, and commercial readiness milestones.
- Strengthened MVP requirements around opt-in/out, idempotency, retention, RBAC, and auditability.
- Strengthened WhatsApp and Telegram launch requirements.
- Added Google Gemini/provider data retention and healthcare eligibility controls.
- Added duplicate webhook, stale draft, human takeover, deleted-memory, and opt-out tests.
- Updated immediate sprint to include risk register, data inventory, idempotency, and takeover simulation.

## 16. Confidence Gate

The plan is implementation-ready only when these statements are true:

- Product claims are conservative and do not position MANU-AI as an autonomous healthcare provider.
- Legal/privacy documentation is complete and mapped to actual data flows.
- The app can enforce channel permission state even though client-facing legal copy is prepared separately.
- Tenant isolation is covered by RLS, service-layer checks, and tests.
- Unknown or ambiguous channel identities are quarantined.
- Red-risk messages cannot produce autonomous AI advice by design.
- Yellow-risk messages cannot auto-send by design.
- Duplicate webhooks cannot duplicate-send.
- Dietitian takeover prevents queued AI auto-send.
- Prompt context is built from an allowlist, not raw database objects.
- Google Gemini/provider retention settings and contracts are acceptable for health-data use.
- A rollback path exists for prompt, model, and classifier changes.
- Incident response and deletion workflows exist before pilot.
