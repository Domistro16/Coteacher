# Safe activity and targeted understanding check

The existing approved light/refraction lesson now connects explanation, physical
activity, reflection, concept check and feedback in one offline flow. The sprint
continues to use its reviewed pencil-and-water activity rather than adding an
unreviewed fractions experiment or changing the shared objective.

## Learner flow

1. Pause at refraction, request a prepared explanation and choose Try it. The
   activity is tied to `refraction`, with `returnToStep: step-refraction`.
2. Read the prepared materials and safety notes: an unsharpened pencil, clear
   plastic cup, room-temperature water and towel, with adult help. No glass,
   heat, chemicals or sharp tools are introduced. Follow all four instructions.
3. Read Why it works, which explains that the pencil stays straight while the
   direction of light changes. The explanation cites the original approved notes.
4. Done — return to teacher reports completion, restores the exact original
   concept and opens its prepared check. The application asks “What did the
   activity demonstrate?” and shows completion separately from understanding.
   A completion event alone creates no correct response or mastery status.
5. Answer “Why does the pencil appear bent at the water surface?” This existing
   approved check targets the demonstrated refraction misconception and shared
   objective. Other concepts' checks do not replace it, even when difficulty
   history points elsewhere. Existing general quiz selection still uses pause/help
   history; the activity follow-up explicitly targets its own concept.
6. Incorrect feedback explains why, with sources, and offers another attempt.
   Correct feedback records the latest response as correct. Attempt counts and
   choices remain visible. Connect it to your classroom concept reopens the
   prepared activity explanation; Revisit the teacher’s concept opens the exact
   original step. Recorded playback remains available at its preserved position.

The reflection uses the prepared multiple-choice question and explanation. There
is no AI evaluation of a learner's physical observation, free-form reflection or
actual experiment performance. Neither the self-report nor a correct check proves
long-term learning; the UI explicitly says this.

## Persistence and contracts

Every new `quiz-answered` event now stores `selectedIndex` and `sourceRefs` in
addition to the existing timestamp, quiz ID, concept ID and correctness. Each retry
appends an event; it does not replace the previous answer. Context validation rejects
out-of-range choices, correctness that disagrees with the selected prepared answer,
and source references that differ from the question. Older events without the new
optional fields remain valid; no answer choice is invented for them.

Completion is the existing `tryit-completed` event, not an understanding result.
The activity progress summary counts concept-check events after the latest reported
completion, using event order. A prior correct answer cannot complete a new activity's
check, and repeating the activity makes its follow-up pending again without deleting
older attempts. The quiz card also shows the total saved attempts for that question.
Pending checks automatically reopen after an offline refresh; completed results and
retry actions are reconstructed from saved progress after tab reopening.

The existing PIN-encrypted per-profile IndexedDB snapshots contain these records.
Question options, feedback, activity instructions, safety and original explanations
come from the collected approved package, without student network calls. There is
no new instructional dataset, external AI request or media download. Activity actions
preserve the existing recording resume position. All fixtures and automated learners
are explicitly simulated.

## Verification

- `npm.cmd test`: all 356 tests across 15 files passed, including generated-type
  freshness and full TypeScript checks.
- `npm.cmd run test:e2e`: both production builds and all 25 browser scenarios
  passed in the final 3.2-minute run. An initial regression showed that forcing
  the teacher-words panel open changed the returned narration caption. Keeping
  expansion optional restored the original prepared narration; the full rerun
  passed the native voice, recorded replay and new activity/check journeys.
- Final `npm.cmd run typecheck`, demo pipeline validation and `git diff --check`
  passed. The 360px activity/check feedback screenshot was reviewed. Existing
  teacher/student dev servers and the refreshed production student preview
  remain available for manual testing.

Eight new unit tests cover pending versus reported status, exact concept selection,
exclusion of prior/unrelated answers, wrong-answer/retry retention, reconstruction
from saved records, profile ownership, unavailable options, changed correctness or
citations, legacy events and a newly repeated activity's pending check.

The new browser journey blocks application network APIs and disconnects after
collection. A requests help, follows all prepared instructions, reports completion,
reloads offline with a pending concept check, answers incorrectly, reviews why,
retries correctly and saves both attempts. It inspects real encrypted database rows.
B performs the same activity with an independent wrong answer; A's complete snapshot
remains unchanged. Closing/reopening offline restores A's attempt count, latest result,
selected option and exact original concept. Existing activity narration and recorded
audio journeys remain regression checks.

Browser automation exercises the UI and persistence; it cannot verify that a child
performed the physical steps, assess supervision or establish durable understanding.
No real children or classroom experiment were used. Physical low-end Android testing
remains unverified; public demo PIN and single-tab privacy limits are unchanged.

## Changed files

- `schemas/progress-record.schema.json` and generated shared progress type.
- `packages/shared/src/validation.ts`: prepared answer/source integrity checks.
- New `apps/student/src/activity-check.ts`: answer writes and activity progress.
- `apps/student/src/App.tsx`: automatic concept follow-up, persisted answer choices,
  retry/progress UI, original-concept links and corrected exact-recorded-concept selection.
- New unit/browser activity-check tests; full-demo and student-player assertions
  updated for the automatic follow-up alongside the original-concept explanation.
- Contracts, safety, architecture, acceptance, sprint status, browser README,
  repository README, this report and the complete user prompt in PROMPTS.md.

Prior shared-device and visual-adaptation work remains intact. The unrelated
untracked technical audit was not changed.
