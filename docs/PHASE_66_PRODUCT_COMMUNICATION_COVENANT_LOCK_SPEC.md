# Phase 66 Product Communication Covenant Lock Spec

Date: 2026-06-05

## Goal

Encode the post-Phase 65 product communication covenant into local prompt contracts, provider output safety, draft/send-time checks, tests, and continuity documentation.

This phase does not connect Gemini, connect WhatsApp, process real client health data, approve production launch, close any launch gate, accept R-405, or enable production traffic.

## Product Covenant

Client-facing AI output must preserve the dietitian-authored messaging experience.

The AI must never send client-facing text that:

- Discloses AI identity.
- Says it is acting "as an AI", "as a chatbot", or equivalent.
- Says it cannot provide medical advice or similar limitation disclaimers.
- Tells the client to ask, consult, contact, or defer to a doctor, dietitian, professional, expert, or specialist.
- Sends a safe boundary reply in yellow or red situations.

Yellow and red situations are handled through internal procedures only: yellow hold, handoff, manual takeover, notification, audit, and dietitian action. They do not create client-facing AI replies.

## Scope

- Add a reusable product communication covenant detector in the core output safety path.
- Cover Turkish plus the supported response languages: English, German, French, Spanish, Portuguese, and Czech.
- Apply the same covenant check to provider output, mock output, generated drafts, and send-time draft approval.
- Add prompt instructions that prohibit AI self-disclosure, AI limitation statements, referral/consultation language, and yellow/red client-facing boundary replies.
- Keep green autopilot send eligible only after normal safety and covenant checks pass.
- Keep yellow/red provider/channel behavior disconnected from production services.
- Keep AI-generated messages non-authoritative for future clinical source authority.

## Edge Cases

- Green provider output that says "as an AI" is blocked before send.
- Green provider output that tells the client to consult a doctor, dietitian, professional, expert, or specialist is blocked before send.
- Green provider output that says it cannot provide medical advice is blocked before send.
- Turkish equivalents such as "yapay zeka olarak", "diyetisyenine danis", "doktoruna danis", "uzmana basvur", and "tibbi tavsiye veremem" are blocked.
- Supported-language equivalents in English, German, French, Spanish, Portuguese, and Czech are blocked.
- Yellow and red outputs are not auto-sent.
- Yellow AI drafts cannot be approved into client-facing AI sends by the draft approval path.
- Dietitian manual messages are not blocked by the AI covenant guard because they are dietitian-authored, not AI-generated.
- Handoff safe acknowledgement text is internal-only and must not contain client-facing referral language.
- Missing historical context output remains blocked and opens handoff as before.
- Product covenant failure records provider output safety metadata and a send-blocked decision.

## Non-Goals

- No approved-source answerability engine. That is Phase 67.
- No green-max intent taxonomy. That is Phase 68.
- No pagination or 5,000-client load evidence. That is Phase 69.
- No user-supplied form hardening, official PDF ingestion, Gemini adapter, WhatsApp adapter, monitoring, secret manager, or real-data integration.
- No launch-gate approval or production pilot `GO`.

## Done Criteria

- Core tests prove forbidden phrases are blocked.
- App tests prove mock provider output stays covenant-clean.
- App tests prove green output is blocked if it violates the covenant.
- App tests prove yellow/red do not create client-facing AI sends.
- App tests prove yellow AI drafts cannot be approved into client-facing AI sends.
- Continuity docs record Phase 66 and keep production pilot `NO-GO`.
- `npm run release:verify` passes with only documented R-405 findings.
