# Product brief demo review

Reviewed on 2026-10-08 against docs/product-brief.md, sprint scope, current code,
and fresh test runs. Updated on 2026-10-09 after implementing natural help and
per-profile unseen explanation rotation. The proof-of-concept matches the
brief's offline learning loop; the broader online and device limitations below
still apply.

## Resolved student interaction defects (2026-10-09)

1. **The brief's exact pause example now works.** Explicit command requests are
   detected before matching, and all other words are current-step help context
   without a required phrase. Specific confusion suffixes go to the
   unchanged matcher with current-step context; generic "this" is not queued.
   Off-topic questions and near-misses still use matching or honest no-match.
2. **Explain again now selects unseen text variants.** Both learners rotate in
   their route order, including an unseen original or refresher. Existing
   per-profile viewing events preserve history across navigation and offline
   reopening. Manual views, activity returns and opened optional refreshers
   count. Exhaustion preserves current content and offers a safe activity where
   available or a specific question. Try it is separate from text rotation.

The expanded main demo and dedicated help browser paths cover these fixes,
including Student B's unseen original after Student A has exhausted variants.
No schema, dependency, network service or matcher-threshold changes were needed.

## Online behavior: incomplete relative to the intended experience

The apps run while connected, but the student uses the same local matcher and
prepared answers in both modes. Its online event handler updates connection
status only; it does not resolve queued questions or request additional sourced
help. The teacher's online state enables a manually triggered local simulation
for one specific question. Answer return still requires progress export, teacher
import/action/export, and student import. No online answering service is present.

The accepted implementation plan made this bounded file loop explicit. It does
not demonstrate a richer, smoother connected student experience. A claim that
the entire brief's online behavior is complete would therefore be too broad.

For a faithful online demo, add an explicitly simulated zero-cost online answer
provider that preserves lesson context and approved sources, handles supported
questions beyond the offline bank, and processes queued questions after
reconnection. Show answering/pending/retry states and preserve questions after
failures. Verify online use and offline-to-online transitions independently.
School-file progress transfer remains the sprint architecture unless its scope
is deliberately revised. Online should reduce waits and manual answer-return
steps; offline lesson navigation should still be fast because it runs locally.

## Match against the brief

| Product promise | Current demo | Assessment |
| --- | --- | --- |
| One lesson, one safe activity, two learners, labelled simulated class data | Refraction lesson, pencil/plastic-cup activity, two profiles, 18 seeded class records | Matches sprint scope |
| Teacher uploads sources and approves grounded content | Upload/review/approval/export works for the exact two reviewed text sources | Accepted simulation; no general source ingestion or live generation |
| Tap-controlled teacher visuals and lesson timeline | Two sourced SVG concept diagrams and projector view | Matches |
| Offline personalized copies, including reopening | Encrypted files and IndexedDB snapshots; worker caches the shell; offline reload/tab reopening pass | Matches automated demo |
| Shared-device PIN profiles and separate progress | Both profiles restore independently, with different variant priorities and an optional refresher | Matches |
| Explain confusion at the exact teacher moment | Natural help and exact brief phrase work; unseen variants rotate independently by student and step, with honest exhaustion | Matches offline sprint behavior |
| Activity explains why and returns to the original moment | Guided steps, safety, explanation and return work; interrupted activity restores | Matches |
| Predicted offline questions and honest no-match | Sourced local bank and conservative matcher; no-match questions persist | Matches, with a small bank |
| Personalized predicted questions | A and B receive the same question bank; only routes differ | Not demonstrated distinctly |
| Quiz from pause/struggle points, common objective | Existing sourced questions are selected by confused concepts; both packages share the objective | Matches sprint behavior |
| Queued questions answered after reconnection | Manual school-file loop returns a prepared answer to one supported question; others stay pending | Accepted bounded simulation; not automatic online answering |
| Teacher heatmap, variant comparisons, next-lesson reminder | Imported progress updates aggregates; variant counts are descriptive; nudge is fixed seeded content | Fits seeded demo, with limits |
| Different visual aid versions | Reviewed recorded packages assign concrete diagrams to A and ordered ray annotations to B; SVG assets and choices are stored offline | Native teacher-to-two-profile playback, offline seek/resume and shared audio verified; rules and histories are explicitly simulated |
| Voice input/output and captions | Local-only input with typing fallback; cached MP3 output, local synthesis fallback, captions and playback/speed controls | Actual offline clip playback verified; physical-device input/synthesis/accent suitability unverified |
| Low-end Android use | Mobile/narrow Chromium layouts and offline behavior verified | Physical device installation/performance not verified |

Teacher sources, drafts and publication approval now persist on the device;
progress imports remain session-only. See teacher-preparation-verification.md for
the approval gate, refresh/reopening evidence and limits. Seeded nudges do not
change with imported records. Citation validation checks source references;
factual grounding rests on the curated content and teacher review.

## Verification evidence and presentation guidance

Latest verification is recorded in docs/sprint-status.md. Help unit tests cover
varied command wording, normalization, ordinary current-step help context,
command near-misses, specific/generic suffix handling, and student/step history.
The unchanged matcher checks cover 17 queries with no false positives among
11 negative queries. Browser evidence includes blocked application network APIs,
offline reopening, actual spoken playback, unseen rotation, exhaustion actions
and profile switching.

Present this as a working offline lesson-and-feedback proof of concept with
labelled simulations. Demonstrate typing, deliberate school-file transfer,
distinct learner routes, the safe activity, and teacher aggregate updates.
Disclose bounded source support, fixed answer/nudge simulations, and unverified
native voice/Android hardware. Students or judges can now try the brief's own
wording and repeated help requests in the offline demo.
