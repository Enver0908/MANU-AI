# Phase 77J: DOCX/PDF Export And Data Lifecycle V1.2

Date: 2026-06-10
Status: In progress.
Depends on: Phase 77I (simplified dietitian UX).
Production pilot: NO-GO.

## Goal

Enable dietitians to download client-specific active menu plans as DOCX and PDF, and extend lifecycle/export/redaction coverage to Phase 77 manual source models.

## Design

### Client-facing menu export

- Source: active menu plan (or explicit plan id when provided).
- Formats: DOCX and PDF generated in memory.
- Content: client-facing notes, meal slots, optional recipes, preferred/avoid lists for simple guidance.
- Excluded: dietitian notes, catalog checksums, revision metadata, conflict codes, tenant/dietitian ids.
- `exportVisible=false` blocks delivery export.

### Dependencies

- `docx` for DOCX (Unicode/Turkish safe).
- `pdfkit` + `dejavu-fonts-ttf` for PDF with Turkish glyph support.
- Production audit gate must remain limited to documented R-405 findings.

### Lifecycle v1.2

Bump `PHASE_74_EXPORT_VERSION` to `phase74-export-v1.2` and add:

- `personal_form_v2.json` — field visibility metadata for client form answers.
- `catalog_version_refs.json` — catalog version references from profiles and menu plans.
- Deprecated proposal marker in proposal export metadata.

## API

`GET /api/clients/[id]/menu-plans/export?format=docx|pdf&includeRecipes=true|false&planId=optional`

Returns binary attachment with tenant-scoped auth (`export_client` capability).

## Tests

- DOCX/PDF buffer generation.
- Turkish character preservation in DOCX XML.
- Client export document excludes internal-only fields.
- Lifecycle v1.2 export files and version bump.
- Removed-client redaction still passes invariants.

## Verification

```text
git diff --check
npm run release:verify
```
