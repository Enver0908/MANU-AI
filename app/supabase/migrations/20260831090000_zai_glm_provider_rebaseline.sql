-- Rebaseline active LLM provider from Gemini to Z.ai GLM-5.3-Flash.
-- This migration does not enable real AI provider egress.
-- Historical Gemini audit rows remain readable; new application code writes provider = 'zai'.

alter table ai_provider_egress_audit drop constraint if exists ai_provider_egress_audit_provider_check;
alter table ai_provider_egress_audit add constraint ai_provider_egress_audit_provider_check
  check (provider in ('zai', 'gemini', 'vision', 'ocr', 'transcription'));
