# Dietitian AI Assistant Architecture Kit

This folder contains a production-oriented reference architecture for a multi-tenant AI messaging assistant used by dietitians on WhatsApp or Telegram.

The implementation intentionally excludes the client-facing legal and permission documentation layer. The rest of the operating model is represented as testable service modules:

- Dietitian voice profile
- Client context capsule
- Safety classifier
- JSONL clinical golden-case evaluation
- Human handoff engine
- Conversation memory
- Response quality guard
- Per-client AI activation state: active, passive, and optional activation windows
- Per-client operating modes
- Message provenance for client, AI, dietitian, system, and imported messages
- Model routing: `gemini-1.5-flash` for green messages, `gemini-3` for yellow messages, and no LLM call for red messages
- End-to-end inbound message orchestration

## Run Checks

```bash
npm test
```

The core test suite includes clinical golden cases from `tests/clinical-golden-cases.jsonl`. These cases assert expected risk, action, model, provider-call behavior, and persona invariants. Red cases must not call a provider.

## Integration Shape

Webhook adapters should call `handleInboundMessage` with a resolved tenant, dietitian, client, conversation, selected persona, and memory. Channel-specific code should stay outside this core so WhatsApp and Telegram can share the same safety and orchestration rules.
