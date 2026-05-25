# MANU-AI Dataset Strategy

## Goal

The message dataset should improve reply quality without weakening privacy, tenant isolation, or clinical safety.

The key new signal is message provenance: the system knows whether a message was written by the client, by AI, or manually by the dietitian.

## Message Labels

Every message should have:

- `origin`: `client_inbound`, `ai_generated`, `dietitian_manual`, `system_event`, or `imported_unknown`
- `author_dietitian_id`: present for dietitian-written messages
- `generated_by_ai_decision_id`: present for AI-generated messages
- `approved_by_dietitian_id`: present when a dietitian approved an AI draft
- `source_message_id`: present when a manual reply or approved draft responds to a specific client message

## Highest-Value Training/Evaluation Examples

### 1. Client Message -> Dietitian Manual Reply

This is the best quality signal.

Use it to learn:

- dietitian-specific tone
- preferred brevity
- meal swap phrasing
- motivational style
- boundary phrasing
- when the dietitian chooses not to answer directly

Runtime use:

- retrieve similar past approved replies from the same dietitian
- inject 1 to 3 anonymized style examples into the prompt
- update the dietitian voice profile

### 2. AI Draft -> Dietitian Edited Reply

This is the best correction signal.

Use it to learn:

- what the AI over-explains
- what the dietitian deletes
- where the AI is too cold, too warm, too risky, or too generic
- which safety categories need stricter rules

Runtime use:

- build rejection/edit pattern analytics
- create regression tests
- improve prompt templates

### 3. AI Auto Reply -> Later Dietitian Follow-Up

This is a monitoring signal, not ground truth by default.

Use it to detect:

- possible AI incompleteness
- recurring client confusion
- cases where an auto reply should have been a draft

Runtime use:

- queue review samples
- refine safety classifier and quality guard

## What Not To Do Initially

- Do not fine-tune on raw client messages in MVP.
- Do not mix data across tenants for model training without legal approval.
- Do not treat AI-generated replies as ground truth.
- Do not send full message histories to a model to "learn style".
- Do not use messages from `imported_unknown` in evaluation datasets until reviewed.

## Recommended MVP Use

Start with retrieval and evaluation, not fine-tuning.

1. Store message provenance.
2. Build per-dietitian style examples from `dietitian_manual` replies.
3. Use only same-dietitian examples at runtime.
4. De-identify examples before prompt injection where possible.
5. Build a golden test set from manually reviewed message pairs.
6. Track edit distance between AI draft and final dietitian reply.
7. Use common edits to improve prompts and safety rules.

## Dataset Views

### `dietitian_style_examples`

Inputs:

- client message
- dietitian manual reply
- persona used
- client goal category
- risk level

Use:

- prompt examples
- voice profile refinement

### `ai_corrections`

Inputs:

- AI draft
- dietitian edited final reply
- quality guard result
- risk level
- model used

Use:

- prompt regression
- safety regression
- model-routing evaluation

### `handoff_outcomes`

Inputs:

- client message
- classifier risk level
- handoff reason
- dietitian final action

Use:

- improve red/yellow taxonomy
- reduce false positives and false negatives

## Privacy Rules

- Keep runtime retrieval scoped to the same tenant and preferably the same dietitian.
- Remove phone numbers, handles, addresses, and identifiers from examples.
- Do not include dietitian-only risk notes in examples.
- Keep a deletion path so removed clients disappear from future promptable datasets.
- Keep audit metadata even when promptable examples are deleted, if legally required.

## Quality Metrics

- Dietitian edit rate
- Average edit distance
- AI draft rejection rate
- Safety guard block rate
- Red/yellow false negative review rate
- Persona mismatch reports
- Manual takeover frequency after AI reply

