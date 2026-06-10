# Phase 77C: Client Personal Form V2

Date: 2026-06-10
Status: Implemented locally; production pilot remains NO-GO.

## Goal

Load the first Phase 77 client personal form into the existing dynamic form system by combining the user-supplied field list with the safety and AI-quality fields needed by MANU-AI.

This phase implements only the personal client form. It does not implement the master food catalog, client food-rule profile v2, menu plan v1, Food Decision Engine V2, DOCX/PDF export, WhatsApp adapter, real provider egress, launch-gate closure, real-data handling, or R-405 remediation.

## Product Requirements

- The form must identify the client from the form itself, including phone and WhatsApp number.
- The form must include the user's requested personal, anthropometric, medical, lifestyle, nutrition-history, digestive, and goal fields.
- The form must include general flexibility and goal-based flexibility.
- Food-group flexibility must not live in this form; it belongs to Client Food Rule Profile V2.
- Meal flexibility must not live in this form; it belongs to Menu Plan V1.
- Sensitive fields such as phone, email, exact birth date, body measurements, medication details, surgery history, and exact weight/height must not be exposed in prompt summaries.
- Prompt-visible fields must be limited to useful, lower-risk context such as goal summary, nutrition history, diet model, lifestyle rhythm, food preferences, allergies, intolerances, and high-level flexibility.

## Implemented Form Sections

### 2.1 Identity, Contact, And Permission

- `first_name`
- `last_name`
- `date_of_birth`
- `adult_status`
- `email`
- `mobile_phone_e164`
- `whatsapp_phone_e164`
- `gender`
- `profession`
- `marital_status`
- `city`
- `communication_language`
- `timezone`
- `channel_permission_state`
- `sensitive_data_consent_status`
- `form_prompt_visibility_ack`
- `emergency_contact_policy_ack`

### 2.2 Body Measurements And Weight Change

- `current_weight_kg`
- `height_cm`
- `waist_circumference_cm`
- `hip_circumference_cm`
- `weight_change_period`
- `weight_change_direction`
- `weight_change_kg`
- `weight_change_intentionality`

### 2.3 Goal And Flexibility

- `primary_goal`
- `goal_type`
- `target_weight_kg`
- `goal_timeline`
- `goal_notes`
- `general_flexibility_score`
- `goal_flexibility_score`

Flexibility options are:

- `Kisitli`
- `Orta esnek`
- `Esnek`

### 2.4 Lifestyle

- `average_sleep_hours`
- `work_hours`
- `work_movement_level`
- `smoking_status`
- `alcohol_status`
- `sport_status`
- `sport_details`

### 2.5 Medical Background

- `diagnosed_condition_flag`
- `diagnosed_condition_details`
- `diabetes_or_glucose_flag`
- `medication_or_insulin_flag`
- `medication_details`
- `supplement_flag`
- `supplement_details`
- `surgery_history`

### 2.6 Women's Health And Sensitive Safety Flags

- `pregnancy_or_breastfeeding_flag`
- `children_count`
- `menstrual_cycle_regular`
- `eating_disorder_risk_flag`

These fields are intentionally system-rule or sensitive fields. They affect safety routing and future decision logic, but they are not exposed as ordinary prompt summary text.

### 2.7 Nutrition History

- `nutrition_history`
- `current_diet_type`
- `nutrition_model`
- `disliked_foods`
- `breakfast_habit`
- `daily_meal_count`
- `outside_eating_frequency`
- `daily_caffeine_cups`
- `daily_fluid_liters`
- `hot_drink_sugar_habit`

`daily_fluid_liters` replaces the duplicate "gunluk icilen sivi" entries from the draft list.

### 2.8 Food Sensitivities

- `allergies`
- `food_intolerances`

Client-specific allowed/forbidden catalog rules are intentionally deferred to Client Food Rule Profile V2.

### 2.9 Digestive Pattern

- `bowel_regular`
- `bristol_stool_scale`

The draft "Bristol Disk Olcegi" item is normalized to the Bristol stool scale concept.

### 2.10 Notes

- `client_public_preference_summary`
- `free_text_client_notes`
- `dietitian_only_notes`

## Technical Implementation

- Updated `app/src/lib/phase-70-form-registry.ts` so the active client form schema title is `Phase 77C client personal form v2`.
- Updated registry version to `phase-77c-client-personal-form-v2`.
- Replaced the active client form field list with the Phase 77C personal form fields.
- Removed Phase 76D structured food-rule fields from the active personal form schema.
- Kept legacy food-rule answer keys in demo seed answers only, so existing Phase 76 food-rule runtime tests remain compatible until the dedicated Phase 77E food-rule profile replaces them.
- Updated demo seed answers for the new required fields.
- Allowed the existing proposal compatibility lookup to recognize the new registry version until Phase 77B removes chat mutation runtime.
- Updated tests so answerability source checks use Phase 77C personal form fields.

## Prompt And Privacy Rules

- Prompt-visible:
  - `primary_goal`
  - `goal_type`
  - `goal_timeline`
  - `goal_notes`
  - `general_flexibility_score`
  - `goal_flexibility_score`
  - `average_sleep_hours`
  - `work_hours`
  - `work_movement_level`
  - `sport_status`
  - `sport_details`
  - `nutrition_history`
  - `current_diet_type`
  - `nutrition_model`
  - `disliked_foods`
  - `breakfast_habit`
  - `daily_meal_count`
  - `outside_eating_frequency`
  - `daily_caffeine_cups`
  - `daily_fluid_liters`
  - `hot_drink_sugar_habit`
  - `allergies`
  - `food_intolerances`
  - `client_public_preference_summary`

- Never prompt / internal-only:
  - phone numbers
  - email
  - exact date of birth
  - exact body measurements
  - exact target/current weight
  - medication details
  - supplement details
  - surgery history
  - diagnosis details
  - dietitian-only notes

## Edge Cases

- Custom goal text remains allowed through `primary_goal`; structured goal category is captured separately in `goal_type`.
- Pregnancy/emzirme and menstrual-cycle fields are present but should be conditionally displayed by UX in a later UI-focused pass.
- Children count may be zero or blank.
- Food allergies remain in the personal form because they are safety-critical, but allowed/forbidden food catalog rules are not part of this form.
- Legacy Phase 76 food-rule answers may exist in historical/demo responses without appearing in the active personal form schema.

## Verification

Required:

```text
cd app
npx vitest run src/lib/phase-70-form-hardening.test.ts src/lib/client-forms.test.ts src/lib/client-update-proposals.test.ts src/lib/food-rule-runtime.test.ts src/lib/phase-76d-food-rule-model.test.ts src/lib/phase-76j-food-rule-dashboard.test.ts
npm run release:verify
```

## Done Criteria

- Active client form schema uses the Phase 77C personal form v2 title and registry version.
- User-requested form fields are present.
- Phone and WhatsApp are required form fields.
- General and goal-based flexibility are present.
- Food-group and meal flexibility are not present in the personal form.
- Phase 76D food-rule fields are not embedded in the personal form schema.
- Prompt visibility preserves sensitive-field privacy.
- Local tests and release verification pass.
- Production pilot remains NO-GO.
