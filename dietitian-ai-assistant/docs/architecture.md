# Dietitian AI Assistant Core Architecture

## Product Positioning

The product is a supervised AI communication assistant for dietitians. It replies to low-risk routine client messages, keeps each client context isolated, and escalates clinical or ambiguous situations to the dietitian.

This document covers the core architecture layers after excluding the client-facing legal and permission documentation layer.

## 1. Dietitian Voice Profile

The AI should not use a generic chatbot tone. Each dietitian has a voice profile derived from approved sample messages:

- greeting style
- average message length
- emoji frequency
- formality level
- preferred motivational phrasing
- boundary style

The profile must affect expression only. It must never weaken clinical safety rules.

## 2. Client Context Capsule

Each model request receives a narrow context capsule:

- `tenantId`
- `dietitianId`
- `clientId`
- selected persona
- client profile
- allergies and restricted foods
- diet plan summary
- risk notes
- recent conversation window
- rolling memory summary

The capsule is constructed only after tenant and client ownership checks pass. No other client or dietitian context may enter the prompt.

## 3. Safety Classifier

Every inbound message is classified before generation:

- `green`: routine and can be answered automatically
- `yellow`: draft can be prepared, but dietitian approval is required
- `red`: AI must not answer; notify the dietitian immediately

Red examples include acute symptoms, allergic reactions, eating disorder danger signs, pregnancy complications, severe glucose issues, medication or insulin dosing, self-harm, and emergency language.

Yellow examples include supplement use, lab results, diagnosed conditions, fasting changes, plan changes, pregnancy/breastfeeding context, and unclear symptom questions.

The classifier is backed by JSONL clinical golden cases. Golden cases assert risk level, action, model routing, and whether provider generation is allowed. A taxonomy change is not releasable if these tests fail.

## 4. Human Handoff Engine

The handoff engine creates a structured review case:

- client and dietitian identifiers
- risk level and reasons
- original message
- safe acknowledgement text
- urgency
- recommended operator action
- whether autopilot should pause

For red cases, autopilot should pause until the dietitian resolves the case.

## 5. Conversation Memory

The system does not send the entire chat history to the model. It uses:

- latest inbound message
- a bounded recent message window
- structured client profile
- rolling summary
- pinned dietitian notes

The rolling summary keeps durable facts, preferences, recurring adherence issues, and previously resolved decisions. It should not store unrelated small talk as durable medical context.

## 6. Response Quality Guard

Every draft is checked after generation:

- no diagnosis
- no medication or supplement dosing
- no emergency handling
- no plan change beyond dietitian-approved rules
- no cross-client leakage
- message is short enough for WhatsApp
- answer follows selected persona and dietitian voice
- if uncertainty exists, it routes to handoff

If the guard fails, the message is not sent. The system creates or updates a human review case.

## 7. Mode System

AI control has two layers:

- `aiStatus`: whether AI is active or passive for that client
- `aiMode`: how AI behaves when active

The dietitian can set `aiStatus` to `active` or `passive` per client at any time. Optional `activeFrom` and `activeUntil` timestamps allow scheduled activation windows.

When `aiStatus` is `passive`, the system may still persist and classify the inbound message for audit, but it does not generate a reply, draft, or outbound AI message.

When AI is active, each client can have one of four modes:

- `autopilot`: green messages may be sent automatically
- `copilot`: AI drafts only; dietitian approves before send
- `manual`: no AI generation
- `paused`: AI is suspended due to risk, dietitian preference, or open case

Mode is stored per client, not globally per dietitian. This allows one dietitian to use one persona or mode for most clients and a different behavior for a single client.

## 8. Model Routing

Model selection is deterministic and tied to risk level:

- `green`: use `gemini-1.5-flash` for low-latency routine replies
- `yellow`: use `gemini-3` for review-required drafts
- `red`: do not call an LLM

Model routing is a fixed safety rule based only on the risk classifier output.

## 9. Message Provenance

Every message must carry origin metadata:

- `client_inbound`: written by the client
- `ai_generated`: generated and sent by MANU-AI
- `dietitian_manual`: written directly by the dietitian
- `system_event`: system status, handoff, or audit event
- `imported_unknown`: imported historical message with unknown author

This distinction is mandatory. The system must always know whether a WhatsApp or Telegram message was written by the dietitian or generated by AI.

Manual dietitian replies become high-value examples for voice modeling and response evaluation. AI-generated replies are not treated as ground truth unless the dietitian approved or edited them.

## End-to-End Flow

1. WhatsApp or Telegram webhook receives a message.
2. Channel adapter resolves `tenantId`, `dietitianId`, and `clientId`.
3. Core builds a client context capsule.
4. Safety classifier assigns green, yellow, or red.
5. AI activation gate checks whether the dietitian has enabled AI for this client and time window.
6. Mode system decides whether AI may answer.
7. If allowed, the LLM receives only the capsule context.
8. Response quality guard validates the draft.
9. Message is sent, queued for approval, escalated, or ignored because AI is passive.
10. Message origin, AI decision, audit events, and memory updates are written.

## Design Rule

Persona and voice change style. Safety, tenant isolation, and clinical boundaries do not change.

Clinical taxonomy changes require qualified dietitian review before pilot use. See `../../docs/CLINICAL_TAXONOMY_REVIEW_WORKFLOW.md`.
