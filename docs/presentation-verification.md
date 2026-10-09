# Classroom presentation verification

2026-10-09. Reused the existing teacher Teach / projector tab, sourced SVGs,
LessonPackage.concepts/timeline and offline learner player. No dependency, separate
presentation content dataset, speech recognition or transcription was added.

## Acceptance

| Requirement | Result and implementation |
| --- | --- |
| Start approved lesson | Teach / projector shows Start presentation only as enabled after teacher approval. An unprepared or draft lesson cannot display the presentation. Shared helpers independently require approved publication. |
| Manual controls | Previous visual / Next visual respect boundaries; concept controls can select a specific prepared step. Keyboard Enter works through native buttons. Projector mode shows the concept, visual, prepared explanation, citations and manual controls. |
| Actual classroom timeline | Starting and moving append visits by existing timelineStepId/conceptId and timestamp. Backward/repeated visits remain in order. Reload/resume adds no invented visit. |
| Shared content | Optional classroomTimeline metadata lives inside the same LessonPackage. Both exported learner routes receive the identical record. There is no duplicate set of explanations or visuals. |
| Approved content preserved | Presentation modifies only classroomTimeline. Unit and browser checks compare all remaining fields before/after teaching, including approval, objective, concepts, original timeline, sources, question bank, quiz and routes. |
| Durable position | Teacher preparation persists the current classroom step and visits atomically before displaying the destination. Refresh/tab close/reopening restore the last step. A failed save leaves the former visible/saved moment in place. |
| Exact offline learner revisit | Revisit the classroom timeline selects a timelineStepId, opens that step's default explanation and teacher wording, and renders the matching diagram/source. The position and progress event retain that exact step and concept. Both learner routes are exercised with networking disabled. |
| Same-concept repeated moments | Unit checks add two timeline steps for refraction and select the second by its distinct step ID; navigation does not resolve merely the first concept or general lesson topic. |
| Approval/content changes | Revoking review, source replacement, regeneration or reapproval clear prior classroom metadata with the superseded approval. Invalid references, mismatched concept/step pairs, stale revision/timestamps and corrupted position are rejected. |

## Evidence

- `npm.cmd test`: 321 tests across 10 files passed, including generated-type
  freshness, TypeScript and seven new presentation/navigation tests.
- `npm.cmd run test:e2e`: both production builds and 17 browser tests passed.
  The two new presentation journeys cover actual teaching-to-offline-collection,
  persistent visits, both learner routes, exact source/explanation/diagram/IDs,
  keyboard/projector behavior, storage failures and approval invalidation.
- `npm.cmd run pipeline -- --lesson fixtures/demo-lesson`: passed.
- Checked projector and learner screenshots. After compacting the projector
  layout, rebuilt both apps and reran the two presentation journeys with an
  assertion that manual controls fit within the 1280 × 900 viewport: both passed
  in 22.1 seconds. The complete 17-test suite above passed before this CSS/text
  follow-up; the final rerun covers the affected projector and handoff paths.

## Files changed in this task

- Contract: `schemas/lesson-package.schema.json` and
  `packages/shared/src/generated/lesson-package.ts`.
- Shared presentation and validation: `packages/shared/src/presentation.ts`,
  `packages/shared/src/validation.ts`, `packages/shared/src/publication.ts`,
  `packages/shared/src/index.ts`.
- Teacher: `apps/teacher/src/Presentation.tsx`, `App.tsx`, `preparation.ts`,
  `styles.css`, `apps/teacher/README.md`.
- Learner: `apps/student/src/player.ts`, `App.tsx`, `styles.css`.
- Tests: `tests/presentation.test.ts`, `tests/e2e/presentation.spec.ts`,
  `tests/e2e/full-demo.spec.ts`, `tests/e2e/README.md`.
- Documentation: `docs/architecture.md`, `contracts.md`, `demo-acceptance.md`,
  `sprint-status.md`, this report and `PROMPTS.md`.

Changes and untracked files from earlier tasks were preserved. No commit or
deployment was requested.

## Limits and handoff

- Approve → Start presentation → teach with manual controls → return to Prepare
  lesson → export personal packages → learners import the files. Export after
  teaching to include the classroom record. Earlier exports/collected packages
  and the bundled seed do not automatically acquire it; their prepared concept
  timeline remains selectable without claiming a recorded classroom session.
- The record captures displayed moments and references the prepared teacher
  wording. It does not establish what was spoken, heard or understood in class.
- One current session for the single demo lesson is supported. A new approval
  starts a new presentation; no multi-class session archive or automatic sync.
- The current step and visit record persist on the same browser/origin;
  projector expansion and disclosure state are transient, so reopening restores
  normal teacher navigation. Device storage can be cleared/evicted. Native
  browser-process/OS restarts, physical projectors and low-end Android remain
  unverified; refresh and tab reopening are automated.
- Class/source content and identities remain simulated. Citation checks validate
  references, not factual accuracy. Teacher review and public demo PIN limitations
  from the prior preparation task still apply.
