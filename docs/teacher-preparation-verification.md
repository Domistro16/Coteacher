# Teacher preparation verification

2026-10-09. Extended the existing teacher workspace and bounded generator for the
single light/refraction demo. No new dependency, framework, backend or live AI.

The teacher selects the supplied Science / Light and refraction lesson, labelled
JSS 2 (simulated demo), loads the two supplied source files, generates a draft,
reviews the original source text, concept explanations, SVG visuals, checks,
answers and safe activity, acknowledges review and approves. Only then can the
teacher export either encrypted personal package for learner collection.

| Acceptance | Implementation and evidence |
| --- | --- |
| Lesson identity/objectives | Required subject, topic, classLevel and shared objective in the contract and selected-lesson panel. This fixed class level is a simulated choice, not verified curriculum alignment. |
| Identifiable material | Existing teacher/activity notes and citations retained; actual uploaded/selected source text is viewable and saved. |
| Stable segments | Existing light-path/refraction concept and timeline IDs retained. Each concept shows sourceRefs, its original/alternative explanations, SVG and sourced understanding check. |
| Teacher review | Existing explicit review acknowledgement reused. Prepared bank, quiz answers and activity safety remain available for inspection. No factual verification is claimed from ID/schema validation. |
| Actual approval | publication transitions from draft to approved with teacher-review and an ISO timestamp in both packages. The complete preparation is saved before enabling export. |
| Learner gate | Collection, teacher/CLI export and student snapshot save/restore revalidate approved publication. Browser tests supply a valid encrypted draft directly and verify rejection with no collected lesson. |
| Persistence | Source text, both personal drafts and approval survive teacher reload/tab close/reopening on the same origin. Restore compares saved packages with fixed content assembled from the stored sources; corruption fails visibly. |
| Same objectives | Approval rejects differing instructional content/objectives across learner files. Both exported packages have identical concepts/objective and different routes. |

Source replacement, regeneration and revoking review clear approval for new
exports. Persistence failures leave the draft unapproved and export disabled.
The browser regression also exercises back-to-back source uploads; asynchronous
reads merge with the latest saved state so neither source overwrites the other.

## Verification

- `npm.cmd test`: 314 tests passed across 9 files, plus generated-type freshness
  and TypeScript checks.
- `npm.cmd run pipeline -- --lesson fixtures/demo-lesson`: passed.
- `npm.cmd run test:e2e`: both production builds and all 15 browser tests passed
  in the final run (2.2 minutes); main school/offline/answer-return journey passed
  in 25.6 seconds. Teacher preparation/collection and failure journeys passed.
- Added six unit tests and two browser journeys for approval, source grounding,
  source/content consistency, persistence and failure handling. Existing full
  demo covers teacher-file collection, offline reload, separate learners,
  progress insights and answer return. Its multi-transfer test now has an explicit
  90-second budget instead of the previous 30-second limit.
- First browser run: 14 passed, one failed on a source-upload race introduced by
  combining preparation state. Fixed by merging completed file reads into the
  latest committed state; the final complete suite passed after that fix.
- Inspected the approved preparation screenshot at mobile width; existing
  green/cream styling, SVGs, controls and disclosures are preserved.

## Changed files

- Teacher: `apps/teacher/src/App.tsx`, `preparation.ts`, `styles.css`,
  `apps/teacher/README.md`.
- Learner publication enforcement: `apps/student/src/App.tsx`, `storage.ts`.
- Contract/shared/CLI: `schemas/lesson-package.schema.json`,
  `packages/shared/src/generated/lesson-package.ts`,
  `packages/shared/src/publication.ts`, `packages/shared/src/sprint.ts`,
  `packages/shared/src/index.ts`, `pipeline/src/generate-cli.ts`.
- Fixtures: `fixtures/demo-lesson/lesson-package.json` and the five lesson fixtures
  in `fixtures/invalid`: `correct-index-out-of-range.json`,
  `missing-source-refs.json`, `nonexistent-source.json`,
  `real-looking-student-name.json`, `tryit-without-safety-notes.json`.
- Tests: `tests/preparation.test.ts`, `tests/sprint.test.ts`,
  `tests/e2e/teacher-preparation.spec.ts`, `tests/e2e/full-demo.spec.ts`.
- Documentation: `docs/architecture.md`, `contracts.md`, `demo-acceptance.md`, `demo-review.md`,
  `sprint-status.md`, this report and `PROMPTS.md`.

Pre-existing `docs/technical-audit.md` was left unchanged; the existing prompt log
was preserved and this task appended. No commit, deployment or external
publication was requested or performed.

## Remaining limits

- One fixed manually prepared lesson and the two supplied text sources only;
  no general curriculum authoring, content editor, PDF extraction or live AI.
- References are structurally checked. Teachers remain responsible for accuracy,
  citations, diagrams and safe instruction. No fabricated external references
  were added.
- Bundled collection is an explicitly pre-approved simulated seed, separate from
  teacher drafts. Approval metadata is a local workflow gate with public demo
  PINs, not signed teacher identity or server authorization.
- Browser storage is local to the browser/origin and can be cleared or evicted.
  Imported teacher progress remains session-only. Tab reopening is automated;
  physical Android/browser-process/OS restart testing remains unverified.
- Already exported/collected approved files cannot be recalled offline. Revoking
  review affects future exports; there is no remote revocation service.
- Older 1.0.0 lesson files/snapshots missing the newly required metadata and
  approval fail validation. Regenerate/reapprove package files; no historical
  teacher approval is inferred, and no legacy snapshot migration was built.
