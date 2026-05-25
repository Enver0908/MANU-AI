# MANU-AI Plan Gap Audit

## Scope

This audit reviews `PROJECT_PLAN.md` for gaps that could block a production-grade AI assistant for dietitians.

The audit intentionally excludes the content of client-facing legal and permission documents because those will be prepared separately. It does require the application to have integration points that can enforce those documents once they exist.

## Pass 1: Architecture and Product Risk

### Findings

- No explicit legal and safety gate before handling real health data.
- MVP did not require opt-in/opt-out state per channel.
- Data retention, deletion, export, and request workflows were missing.
- RBAC was too broad for clinic teams with assistants or multiple dietitians.
- AI provider retention and healthcare eligibility were not explicit.
- Product claims needed a stronger boundary against "autonomous dietitian" positioning.

### Corrections

- Added Milestone 0.
- Added non-negotiable launch gates.
- Added data governance and privacy operations milestone.
- Added AI provider retention and vendor-risk requirements.
- Added default pilot rule: no fixed copilot waiting period; autopilot requires mandatory safety fields and explicit client-level enablement.

## Pass 2: Messaging Platform Risk

### Findings

- WhatsApp opt-in, opt-out, template, and 24-hour service-window rules were underdeveloped.
- WhatsApp healthcare-use feasibility was not explicit.
- Telegram bot privacy policy setup was missing.
- Duplicate webhook and retry behavior could duplicate-send messages.
- Phone number reuse and ambiguous client matching were not handled.

### Corrections

- Added WhatsApp healthcare-use feasibility gate.
- Added WhatsApp opt-in/out, approved template, service-window, human escalation, and account-quality requirements.
- Added Telegram privacy policy requirement.
- Added idempotency, outbound state machine, retry, dead-letter, and stale-job controls.
- Added channel identity quarantine and phone-number reuse confirmation.

## Pass 3: Clinical Safety and Operations

### Findings

- Clinical governance was too light for nutrition/health messaging.
- Human takeover race condition was not explicit.
- Prompt, model, and classifier rollback were missing.
- Voice, image, PDF, lab-result, and prescription interpretation exclusions were not explicit.
- Incident response, breach handling, backup restore, and secret rotation were missing.

### Corrections

- Added clinical governance and evaluation milestone.
- Added human takeover lock.
- Added prompt/classifier/model versioning and rollback.
- Explicitly excluded voice, image, PDF, and lab-result interpretation from MVP.
- Added security operations milestone and incident response requirements.

## Pass 4: Ambiguity Removal

### Findings

- The plan had a list of open questions that made the build direction less deterministic.

### Corrections

- Converted open questions into default decisions and validation points.
- Removed unresolved question marks from the plan.
- Added default decisions for MVP channel, tenant model, intake owner, mandatory fields, autopilot, notification channel, Google Gemini retention mode, production geography, assistant roles, and review rate.

## Pass 5: Healthcare Classification and Professional Scope

### Findings

- The plan needed a clearer gate for medical-device or clinical-decision-support classification.
- Licensed-professional involvement was implied but not operationalized enough.
- Dietitian credential verification was missing from production onboarding.
- Minor safety needed stronger handling for body image, dieting, and exercise behavior.
- Raw health messages and prompts needed an explicit log-redaction rule.

### Corrections

- Added medical-device and clinical-decision-support classification review.
- Added licensed-professional involvement memo and policy.
- Added dietitian credential verification workflow.
- Added minors, body-image, and eating-disorder safety tests.
- Added log redaction policy for raw messages, prompts, profile fields, and provider payloads.

## Remaining Conditional Risks

These are not plan gaps; they are external validation dependencies:

- Legal counsel must approve the data-processing model before real client health data.
- WhatsApp production use must pass healthcare-use feasibility for the launch geography.
- AI provider terms and retention settings must be acceptable for health data.
- A qualified dietitian must approve the clinical taxonomy and golden test set.
- Legal counsel must confirm whether the system triggers medical-device or clinical-decision-support obligations.
- Production tenants must pass dietitian credential verification requirements.
- Pilot data must be reviewed before increasing autopilot scope.

## Final Audit Position

The revised plan is strong enough to start implementation of the local SaaS prototype and simulator.

It is not cleared for real production health-data messaging until the launch gates in `PROJECT_PLAN.md` are complete.
