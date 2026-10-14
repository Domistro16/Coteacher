# Concept-level teacher insights

Implemented on 2026-10-09 for the existing reviewed light/refraction demo. This
screen uses the shared student/teacher visual system and existing school return
and encrypted teacher persistence. No backend, schema or learner record format
was replaced.

## What the dashboard measures

Choose the demo lesson and either **Simulated class · 18 seeded learners** or
**Received demo interactions**. These cohorts are never added together. Received
activity means actual application interactions from simulated A/B profiles,
delivered through the acknowledged school service or validated encrypted files.
The separate summary cards retain the source and pending received-question counts.

Each heatmap row uses the original stable concept ID and its lesson timeline
steps. A learner contributes one support signal count per concept if their record
contains an explanation request, an incorrect understanding check, a check retry,
a question requiring follow-up or a currently pending question. The row also
shows raw explanation-request, incorrect-check, retry and pending-question counts.
Retries are every additional attempt at the same quiz by the same learner. A pause
alone is shown as context, not a struggle signal. Warm highlighting marks the
largest observed learner count in the selected cohort; it is not a significance
threshold or diagnosis.

The seeded refraction data has **4/18 learners with support signals**, from four
incorrect checks. Its 12 pauses and the other concept's six pauses remain visible
as context. Previous 12/18 pause-only heatmap totals are deliberately no longer
presented as evidence of difficulty. Imports/sync do not change the seeded 18.

The selected concept reveals original teacher explanation text, stable step IDs,
sources and all matching timestamps from the actual saved recording's cues.
Repeated classroom appearances map to the same concept. Seed observations have
prepared step IDs rather than invented audio timestamps. Received questions and
visual exploration events expose their actual recording position when supplied.
Expandable learner rows show contributing events, quiz outcomes and chosen answers,
exact question text, pending/answered state, stable event IDs where available and
export times. No learner completion or mastery is inferred from these records.

## Explanation evidence and teaching materials

For each explanation, the table reports explicit views, unique viewers, later
check attempts and correct attempts. Checks are attributed to the most recently
viewed explanation for that concept, in the append-only event order. Checks before
any explicit view remain in concept indicators and are excluded from this table.
Retries are counted as attempts, not independent learners. Small self-selected
samples and simulated observations cannot establish effectiveness, significance,
causation or long-term learning; the interface says this explicitly.

Explicit alternative-visual explorations are counted separately from the visual
assigned to normal playback. When the recording's visual catalog is teacher
approved, the actual prepared assets can be expanded with their source references.
No unreviewed visual is shown as an approved student representation.

The suggestion follows the selected concept and uses an existing sourced activity
or stepwise explanation. It describes its observed basis or honestly reports no
signals. **Review this activity/explanation** opens that exact concept and variant
in the preparation studio, including materials, instructions, safety and sources.
This action does not append classroom visits, overwrite audio, change the learning
objective or invalidate approval. Preparation is required before this action is
enabled. Suggestions are deterministic prepared teaching options, not AI findings.

## Files and integration

- `apps/teacher/src/insights.ts`: pure latest-snapshot, stable-event deduplication,
  concept indicators, explanation evidence and inspectable event descriptions.
- `apps/teacher/src/TeacherInsights.tsx`: cohort/lesson selection, heatmap,
  contributing records, original classroom context, approved visual inspection
  and concept-specific material action.
- `apps/teacher/src/App.tsx`: replaces inline analytics and opens the exact
  preparation variant with keyboard focus; retains transfer/answer-return panels.
- `apps/teacher/src/TeacherShell.tsx` and `teacher-theme.css`: accurate source
  labels and responsive layouts using the existing visual identity.
- `tests/teacher-insights.test.ts`, `tests/e2e/teacher-design.spec.ts`,
  `tests/e2e/full-demo.spec.ts`, `tests/e2e/delivered-replay.ts`: aggregation,
  responsive material review, validated file ingestion and actual school-sync
  dashboard assertions.
- Acceptance criteria, this report, product status/architecture/teacher README
  and `PROMPTS.md` document the change. Student UI and server code are unchanged.

## Verification

- `npm.cmd test`: **387 tests across 19 files pass**, including eight new
  aggregation tests, generated-contract freshness and TypeScript checks. Repeated
  after the final UI changes; no lint script is configured.
- `npm.cmd run build`: both production apps pass. The teacher app was rebuilt
  after the final source-label/mobile-table changes. Its main bundle is 504.51 kB
  (151.01 kB gzip), generating a non-failing Vite 500 kB chunk warning.
- `npm.cmd run pipeline -- --lesson fixtures/demo-lesson`: valid sourced,
  simulated lesson.
- Complete Playwright run: **36 scenarios pass in 5.5 minutes**, including the
  actual non-silent Chromium microphone capture, original recording review,
  A/B personalized playback, offline help/checks, real acknowledged school sync,
  teacher insights, returned answers and encrypted reload/reopen persistence.
- The native journey receives A and B's actual demo interactions through the real
  isolated HTTP service. Refraction shows **2/2 learners with support signals**,
  including **one incorrect check**, A's exact plastic-cup question and actual
  classroom cue times. Approved visual assets open correctly. Changing to the
  seeded cohort still shows **4/18**; reviewing the exact activity leaves the
  stored teacher preparation/classroom timeline byte-for-byte unchanged.
- Manual transfer journey: validated import updates received signals, seeded
  totals stay unchanged, duplicate import is rejected, and sourced returned
  answers arrive at the correct learner.
- Five teacher design/accessibility cases were rerun after the final label/table
  correction: **all pass** at 320, 360, 768 and 1440 pixels, with no page overflow,
  readable horizontally scrollable table columns, keyboard scrolling, empty
  received-data states, contributor inspection and exact approved activity review.
  Desktop/mobile screenshots were visually inspected. `git diff --check` passes.
- Existing live development endpoints return HTTP 200 at teacher port 5174 and
  student port 5175; `/api/health` on 8787 confirms the local lesson service.

An initial browser run caught that replacing the old analytics block also removed
adjacent transfer panels. The panels were restored before final verification;
the connected answer-return and manual transfer journeys pass. Final screenshot
review prompted the readable mobile table and accurate generic source badge;
both were rebuilt and retested. No remaining blocker was found for this sprint flow.

## Remaining limits

One fixed source-grounded lesson, two simulated profiles and 18 fabricated seed
records demonstrate the flow. There is no real classroom dataset, causal evaluation
or trained recommendation system. Local school sync is real but loopback-only;
production authentication, public cloud hosting and deployment remain unconfigured.
Conflicting device histories still need reconciliation, rather than speculative
merging. Physical Android hardware and human microphone quality are not verified
by browser emulation. These analytics cannot establish lasting learning.
