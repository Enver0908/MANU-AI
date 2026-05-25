# Clinical Taxonomy Review Workflow

## Purpose

MANU-AI safety taxonomy changes must be reviewed as clinical governance changes, not styling changes.

## Required Review Before Pilot

- A qualified dietitian reviews every new or changed red/yellow/green rule.
- Golden JSONL cases must be updated before or with taxonomy code changes.
- Test failures block release until the taxonomy and expected behavior are reconciled.
- Persona changes must be tested against safety invariants.
- Red cases must prove that no provider generation call is made.

## Change Checklist

1. Describe the clinical scenario and risk category.
2. Add or update a JSONL golden case.
3. Add classifier or routing code only after the expected case is explicit.
4. Run core tests and app verification.
5. Record qualified dietitian review status before production or pilot use.

## Launch Gate

Pilot launch is blocked until the clinical taxonomy, golden cases, and escalation behavior are approved by a qualified dietitian.
