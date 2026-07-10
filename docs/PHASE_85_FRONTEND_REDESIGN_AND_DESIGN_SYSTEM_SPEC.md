# Phase 85: SiriusAI Frontend Redesign And Design System Spec

Date: 2026-07-07
Status: Stage 1 design foundation, Stage 2 shared component system, Stage 3 public/commercial entry integration, and Stage 4A Danisan Kontrol Paneli complete; Stage 3 is deployed to the hosted sandbox at `https://siriusai.store`. P85-IF is the mandatory cross-cutting foundation program between Stage 4A and Stage 4B. P85-IF-A through P85-IF-I are complete, and R4 context-intake Supabase remediation is complete. After the approved remediation sequence closes, work returns to Stage 4B Uyari ve Bildirimler.
Production pilot: NO-GO.
Clinical production GO: not in scope for Phase 85.
R-405: Open unless technically remediated through the Phase 22 procedure or formally accepted by external engineering/security approval.
R-406: Phase 50/52 local baseline mitigated; current R4 local Supabase/RLS evidence passed 25/25 on 2026-07-10.

## Goal

Rebuild the SiriusAI frontend into a professional warm clinical SaaS experience across the public website, commercial auth/onboarding surfaces, admin surface, dashboard, and mobile PWA.

Phase 85 exists because the current Phase 83/84 frontend is functionally complete but does not meet the desired premium product quality bar. The redesign must preserve all clinical safety, entitlement, auth, onboarding, PWA, sandbox billing, and fail-closed production readiness boundaries while replacing the visual system, information hierarchy, and UX polish.

The user-approved implementation order is now restructured into the following stage ladder:

1. Design system foundation.
2. Full component system.
3. Public website and commercial entry surfaces.
4A. Danisan Kontrol Paneli Mimari ve Hizmet Akisi Plani.
IF. Phase 85 Interstage Foundation - trusted clinical communication and memory.
4B. Uyari ve Bildirimler.
4C. Diyetisyen Icin AI Chat.
4D. Ayarlar / Hesap.
5. Dashboard and Mobile PWA Shell.
6. Dashboard Core Workflows.
7. Visual QA, Polish, Accessibility, and Closure.

Phase 85 must proceed by explicit user approval at each major design decision and implementation sub-phase.

## Stage 4A - Danisan Kontrol Paneli Mimari ve Hizmet Akisi Plani

Stage 4A was added on 2026-07-08 after code-level review of the existing danisan kontrol paneli foundations. The user prioritized the per-client service surface before broad dashboard shell/workflow polish. The canonical Stage 4A plan is `docs/PHASE_85_STAGE_4A_DANISAN_KONTROL_PANELI_MIMARI_VE_HIZMET_AKISI_PLANI.md`.

Stage 4A locks four implementation sub-phases; all are **implemented 2026-07-08**:

1. Stage 4A.1 Danisan Formu Paneli, using the active Phase 77C schema/response path.
2. Stage 4A.2 Aktif Beslenme Plani, using Client Food Rule Profile V2 and the 12/113/518 master catalog.
3. Stage 4A.3 Menu, using the four Menu Plan V1 template types and existing MANU-only export route.
4. Stage 4A.4 AI Asistan Kontrolu, using persona, active/passive, mode, schedule, safety checklist, takeover, preflight, and risk-lock semantics.

Stage 4A changed dashboard danisan kontrol paneli UI only. It does not alter backend APIs, auth, entitlement, PWA install, billing, provider/channel paths, launch gates, R-405, R-406, or production pilot status.

## Stage 4B - Uyari ve Bildirimler

Status: pending and blocked on P85-IF closure. This stage resumes as the next Phase 85 planning target after P85-IF-I.

Stage 4B must be planned with the user after P85-IF closure and before implementation. P85-IF owns the underlying actor, transcript, retrieval, human-control, risk-resolution, and alert-versus-notification contracts plus minimal verification visibility. Stage 4B owns the complete dashboard alert/notification service surface, including notification priority, acknowledgement/read flows, clinically relevant blockers, handoff visibility, navigation, filters, grouping, mobile/PWA ergonomics, and final visual design. No Stage 4B runtime work is approved until P85-IF closes and the Stage 4B action plan is explicitly approved.

## Stage 4C - Diyetisyen Icin AI Chat

Status: pending. This stage will be planned only after Stage 4B is completed and closed.

Stage 4C must define the dietitian-facing AI chat experience without weakening internal copilot safety, data isolation, prompt visibility, clinical boundaries, provider gates, or real-provider disablement. No Stage 4C runtime work is approved until its action plan is created and explicitly approved.

## Stage 4D - Ayarlar / Hesap

Status: pending. This stage will be planned only after Stage 4C is completed and closed.

Stage 4D must define settings/account workflows while preserving auth, membership, entitlement, onboarding, admin, billing, PWA install, and sandbox-only constraints. No Stage 4D runtime work is approved until its action plan is created and explicitly approved.

## Scope Lock

These rules are fixed for Phase 85:

- Keep the public brand name `SiriusAI`.
- Do not use the previous Phase 83/84 visual style as a design reference, except for functional behavior and existing safety/entitlement contracts.
- Preserve production pilot `NO-GO`.
- Do not activate real WhatsApp, Telegram, Gemini, external LLM, live Stripe charging, production webhooks beyond existing sandbox Stripe behavior, monitoring, backup provider, secret manager, or real client health-data paths.
- Do not self-approve launch gates, R-405, R-406, Phase 81 eligibility, Phase 82 readiness, or production GO.
- Preserve PWA v1 scope. No App Store, Play Store, IPA, APK, or native app distribution work in Phase 85.
- Preserve subscriber-only PWA install behavior, network-only `/api/*` service worker policy, and no-PHI-cache rules.
- Preserve Supabase magic-link auth/onboarding behavior, admin allowlist behavior, and sandbox-only commercial billing guards.
- Every implementation sub-phase must start from a canonical spec update or this spec section update, then run targeted tests, `git diff --check`, and relevant build/visual checks.

## User-Approved Design Direction

### Brand Positioning

SiriusAI should feel like a warm clinical SaaS product:

- Warm dietitian-client relationship first.
- Corporate and premium, not casual wellness influencer.
- AI is supportive and controlled, not the visual or narrative center.
- The core promise is safe client communication and clinical workflow control.

Approved public hero message direction:

> Client communication managed with trust inside a clinical workspace.

In Turkish product copy, the same idea should map to: "Danisan iletisimini guvenle yoneten klinik calisma alani."

### Color System

Approved runtime palette after the user-provided `public-website-redesign.zip` color correction:

```text
Paper background: oklch(0.985 0.003 85) / approx #FBFAF8
Surface:          #FFFFFF
Ink:              oklch(0.18 0.01 280) / approx #111116
Muted text:       oklch(0.52 0.01 280) / approx #777174
Primary plum:     oklch(0.41 0.14 310) / approx #612E82
Primary hover:    oklch(0.37 0.14 310) / approx #562175
Soft plum bg:     #EFEAF3
Soft plum alt:    #E6DDEC
Sage accent:      oklch(0.60 0.08 155) / approx #578F6B
Warm accent:      oklch(0.72 0.18 85) / approx #D79800
```

Color roles:

- `oklch(0.18 0.01 280)`: primary text, headings, premium editorial surfaces.
- `oklch(0.41 0.14 310)`: primary CTA, brand signature, login/admin critical actions, and visible purple text accents.
- `#EFEAF3` / `#E6DDEC`: selected tabs, chips, subtle plum backgrounds only.
- `oklch(0.60 0.08 155)`: health, care, balance, safe support, secondary positive signals.
- `oklch(0.72 0.18 85)`: sparse warmth for human relationship cues.
- Avoid pure black, neon purple, bright gradients, abstract AI orbs, bokeh blobs, and one-note purple pages.

Accessibility:

- Normal text targets WCAG 2.2 contrast minimum of 4.5:1.
- UI must not rely on color alone for risk or status meaning.
- Clinical green/yellow/red risk semantics remain distinct from generic brand colors.

### Typography

Approved font direction:

```text
Display / editorial headings: Fraunces
UI / body / dashboard:        Geist Sans
```

Usage rules:

- Fraunces is for hero headings, section headings, premium brand moments, and selective editorial emphasis.
- Geist Sans is for navigation, buttons, tables, forms, dashboard panels, charts, status labels, and body copy.
- Do not scale fonts with viewport width.
- Letter spacing must remain `0` unless a component has a specific accessibility-safe reason.

### Layout Density

Approved density model: hybrid.

- Public website: editorial, spacious, premium, warm.
- Dashboard/PWA: compact, scannable, professional, optimized for repeated daily use.

### Shape And Surface Language

Approved shape language:

- General card/panel radius: 8px maximum.
- Inputs/buttons: 6px-8px.
- Larger editorial media areas may use 10px-12px when they are not nested cards.
- Use thin borders, restrained shadows, and typography hierarchy instead of heavy decorative cards.
- Avoid cards inside cards.
- Avoid floating card-heavy page sections.

### Visual Asset Direction

Approved visual direction: hybrid.

- Public site can use human/dietitian relationship imagery plus real product UI compositions.
- Avoid generic stock wellness photography and over-smiling lifestyle cliches.
- Avoid abstract AI visuals as the primary brand signal.
- Dashboard/PWA should use functional iconography and status signals, not decorative illustrations.

## Product Surfaces In Scope

1. Public marketing site (`/`).
2. Login and auth callback surfaces (`/login`, `/auth/callback` bridge UI as applicable).
3. Purchase and subscription surfaces (`/purchase`, `/purchase/success`, `/purchase/cancel`) while preserving Stripe sandbox-only rules.
4. Onboarding claim surface (`/onboarding`).
5. Admin surface (`/admin`, `/commercial-admin` redirect/emergency only as already defined).
6. Authenticated dashboard (`/dashboard`).
7. Mobile PWA shell and install center (`/app-install`).

## Non-Goals

- No clinical safety logic rewrite.
- No provider/channel activation.
- No production billing activation.
- No launch gate closure.
- No R-405 or R-406 closure.
- No new native app distribution path.
- No broad data model, Supabase migration, or orchestration rewrite unless a later approved sub-phase proves a frontend contract requires a surgical change.

## Six-Stage Phase Breakdown

### Stage 1 - Design System Foundation

Goal: record the user-approved design direction, implementation order, boundaries, and implement the approved palette/font foundation.

Status: complete on 2026-07-07.

Completed scope:

- This canonical spec exists.
- Continuity docs point to Phase 85 as the next frontend/design track.
- `app/src/app/layout.tsx` loads Fraunces alongside Geist Sans and Geist Mono through `next/font/google`.
- `app/src/app/globals.css` exposes Phase 85 paper, surface, ink, muted text, primary plum, hover plum, soft plum, sage, warm accent, border, and focus tokens through CSS variables and Tailwind theme variables.
- `.font-display` is available for future editorial headings.
- Global focus, skip-link, body, and text selection foundation use the Phase 85 palette.
- `app/src/components/ui/tokens.ts` records the approved Phase 85 palette and moves primary command button foundation to semantic `primary` / `primary-hover` tokens.
- Keep clinical green/yellow/red status colors semantically separate from brand accents.
- Focused design-system tests cover the approved palette and radius constraints.
- Production pilot remains `NO-GO`.

Out of scope for this sub-phase:

- Full shared component redesign.
- Public website redesign.
- Dashboard/PWA shell or panel redesign.
- Bulk replacement of existing page-level emerald/stone classes.

### Stage 2 - Full Component System

Goal: rebuild shared UI primitives before page and dashboard redesign.

Status: complete on 2026-07-07.

Completed scope:

- Buttons, links, inputs, selects, textareas, labels, hints, validation messages.
- Badges, status pills, origin/risk badges, health/safety state indicators.
- Tabs, segmented controls, toolbar controls, and icon button foundation.
- Tables, timelines, lists, cards/panels, alert banners.
- Dialog, sheet, empty state, error state, loading/skeleton state.
- App shell primitives and mobile navigation primitives.
- Use lucide icons where icons are needed.
- Ensure text fits inside buttons/cards on mobile and desktop.
- Keep card radius at 8px or less.
- Preserve clinical green/yellow/red risk semantics.
- Do not redesign public pages or dashboard workflows yet, except where a primitive preview/test fixture requires a tiny isolated surface.

Implementation notes:

- `components/ui/tokens.ts` now exposes `plum`, `sage`, and `warm` generic UI tones while keeping `emerald` as a backwards-compatible alias for `sage` and `amber` as a backwards-compatible alias for `warm`.
- Clinical message risk green/yellow/red remains isolated in `MESSAGE_RISK`; generic UI tones must not introduce green/yellow risk aliases.
- Shared form, card, tab, segmented-control, table, dialog, sheet, and app-shell primitives now use the approved paper/surface/ink/plum/sage/warm language.
- Added shared `Alert`, `EmptyState`, and `LoadingBlock` primitives for later page/dashboard work.
- Broad page-level/dashboard-level class replacement remains deferred to Stages 3-5.

Verification:

- `npx vitest run src/components/ui/ui-design-system.test.ts --no-file-parallelism --maxWorkers=1` passed with 8/8 tests.

No further Stage 2 implementation approval is pending.

### Stage 3 - Public Website And Commercial Entry Surfaces

Goal: rebuild the public website and commercial entry surfaces around warm clinical SaaS positioning.

Status: implemented and deployed on 2026-07-07 using the user-provided `public-website-redesign.zip` visual direction while preserving current project API/auth/onboarding/admin behavior.

Hosted sandbox verification: release `phase85-stage3-redesign-20260707225306` is live on `https://siriusai.store`; `/`, `/login`, `/purchase`, `/purchase/success`, `/app-install`, and `https://admin.siriusai.store` returned 200. Live browser computed styles confirmed paper `oklch(0.985 0.003 85)` and primary CTA `oklch(0.41 0.14 310)`.

Canonical implementation plan: `docs/PHASE_85_STAGE_3_PUBLIC_COMMERCIAL_ENTRY_ACTION_PLAN.md`.

Locked commercial model:

- SiriusAI access is invite-led, not open self-serve signup.
- Dietitian leaves an access/contact request.
- Team/admin evaluates the request.
- Admin creates an invite code from the admin console.
- Dietitian starts only with approved email + invite code.
- Purchase/checkout, magic-link login, onboarding claim, dashboard, and PWA access remain gated by the existing Phase 83/84 contracts.

Locked public navbar:

```text
SiriusAI | Nasil calisir | Guvenlik | Mobil | Iletisim | Giris yap | Davet koduyla basla
```

Locked route/anchor mapping:

- `SiriusAI` -> `/`
- `Nasil calisir` -> `#nasil-calisir`
- `Guvenlik` -> `#guvenlik`
- `Mobil` -> `#mobil`
- `Iletisim` -> `#iletisim`
- `Giris yap` -> `/login`
- `Davet koduyla basla` -> `/purchase`

Expected implementation scope:

- First viewport must signal `SiriusAI` clearly.
- Main message centers invite-led dietitian-client communication, trust, and clinical workspace.
- AI appears as supervised support, not the hero subject.
- Use human/editorial and product UI visual language.
- Avoid marketing filler, abstract gradients, and generic SaaS decoration.
- Redesign `/`, `/login`, `/purchase`, `/purchase/success`, `/purchase/cancel`, `/onboarding`, `/app-install`, and admin entry surfaces.
- Preserve Phase 84 magic-link/session fragment behavior.
- Preserve Phase 83/84 entitlement and sandbox billing gates.
- Improve failure, empty, pending, revoked, past-due, consumed-invite, and duplicate-claim states.
- Keep admin token emergency path visibly secondary.

Required implementation phases:

1. Public information architecture and shared shell.
2. Landing page redesign.
3. Commercial entry surface redesign.
4. State, copy, and failure-mode polish.
5. Visual/responsive acceptance.
6. Verification and continuity closure.

Requires implementation after the user asks to proceed from this approved action plan.

### Stage 5 - Dashboard And Mobile PWA Shell

Goal: redesign the authenticated shell for professional daily use.

Expected scope:

- Compact desktop shell.
- Mobile-first PWA navigation with full dashboard parity.
- Clear active client/workflow context.
- Strong status hierarchy for entitlement, AI mode, client safety, channel readiness, and handoff state.
- No nested cards or decorative dashboard sections.

Requires user approval before implementation.

### Stage 6 - Dashboard Core Workflows

Goal: redesign high-use dashboard panels without changing clinical logic.

Expected scope:

- Overview, clients, conversation, simulator, handoffs, forms, copilot, voice, food rules, menu, critical context, and export panels.
- Preserve data-test ids where tests depend on them unless tests are updated in the same sub-phase.
- Improve scan hierarchy, form ergonomics, status grouping, mobile reachability, and empty/error states.

Requires user approval before implementation.

### Stage 7 - Visual QA, Polish, Accessibility, And Closure

Goal: close the frontend redesign track with visual, accessibility, build, and continuity evidence.

Expected verification:

- Targeted unit tests.
- Visual tests across desktop, tablet, and mobile.
- Production build.
- `git diff --check`.
- Secret/token scan.
- Continuity docs updated with exact verification counts.

Production pilot remains `NO-GO`.

## Acceptance Criteria

Phase 85 can close only when:

- The approved palette and typography are implemented consistently.
- Public site, auth/onboarding surfaces, admin surface, dashboard, and PWA share one coherent design system.
- Public website feels warm, premium, and credible for dietitians.
- Dashboard/PWA is compact, scannable, and usable for repeated operational work.
- Clinical safety, entitlement, onboarding, auth, PWA cache, and sandbox billing behavior remain intact.
- Visual QA does not show overlapping text, broken mobile nav, unreadable contrast, or amateur decorative patterns.
- Production pilot remains `NO-GO`.

## Current Next Step

Proceed to Stage 4B Uyari ve Bildirimler planning only after explicit user approval. Stage 4C, Stage 4D, Stage 5, Stage 6, and Stage 7 remain unplanned until each prior stage is closed.
