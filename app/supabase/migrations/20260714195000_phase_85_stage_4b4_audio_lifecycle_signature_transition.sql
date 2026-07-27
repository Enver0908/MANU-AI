-- Phase 85 Stage 4B-4: prepare the media metadata redaction RPC for its
-- audio-aware return contract. PostgreSQL cannot change OUT parameters with
-- CREATE OR REPLACE, so the previous Stage 4B-3 signature must be removed first.

drop function if exists p85_stage_4b3_redact_client_media_metadata(
  uuid,
  uuid,
  timestamptz
);
