# Reconnection and deferred guidance

This task extends the existing encrypted profile snapshots and local school
progress service. No new backend or external AI provider is introduced. The
student and teacher designs and manual school transfers are preserved.

## Synchronization

The learner controller assigns UUID eventId values once before persistence.
Learner, lesson, concept, step and recording identities remain the existing
contracts. Old ledgers can acquire IDs without losing their existing events;
the service accepts this migration only when the original event content agrees.
Established IDs cannot be dropped or changed, and duplicate IDs fail validation.

The downloaded lesson's events and original pending questions stay in encrypted
IndexedDB. Offline work never requires the school service. The app responds to
online/offline events; Profile also provides Try school sync. A persisted offline
hint prevents unwanted requests during cached offline reopening. If the browser
misses a reconnect while the app is closed, explicit retry clears that hint.

After a durable learner save, the sync hook submits the complete append-only
ledger through the existing encrypted POST route. The service validates ownership,
approved sources and recorded context, rejects conflicting/shorter history,
atomically saves encrypted progress and returns its SHA-256 receipt. The app checks
all receipt identities and the digest before acknowledging any submitted work.
Retries replace the same learner snapshot rather than adding another event batch.
The HTTP service serializes writes per learner; busy requests fail honestly for retry.

An optional ProgressSyncState checkpoint stores that receipt, acknowledged event
IDs and question IDs inside the learner's encrypted snapshot. Its schema and owner,
recording, ordered event prefix and question references are validated on restore.
New events/questions added during a request remain pending beyond that prefix.
There is no removal of learner events or queued questions on acknowledgement.
Receipt means received by school, not answered or understood.

Requests have a 15-second timeout and retry every 30 seconds while connected.
New durable work starts after a short quiet interval. Saving playback position no
longer cancels an in-flight sync. Locking, switching learners or disconnecting
cancels it. Every commit checks that the original learner and recording remain
active. Pending, sending, received and failed states use actual state; connectivity
alone is never success. Unchanged received ledgers poll for answers without uploading
the same event history again.

## Deferred responses

The teacher receives actual service snapshots in Questions and Class insights.
Existing Sync & Transfers provides Run simulated answer return and Return reviewed
answers through school service. The one supported pending question asks whether
to use a glass cup for the activity. Its prepared answer recommends a plastic cup
and cites approved activity safety notes. It carries answerOrigin=simulated-prepared
and is displayed as Answered · prepared demo response in the student player.
No external AI call or general answer generation is claimed. Other questions remain
pending; neither reconnection nor receipt promises an answer.

The learner GET route returns PIN-encrypted progress. Only matching original
question IDs/text/askedAt/step and recorded owner/lesson/concept/time can receive
an answer. Merging preserves the latest local player, events and new questions.
Previously answered local guidance wins over a stale server/file answer. Returned
sources and learner context are validated before saving. Responses remain available
in the contextual lesson-player history after offline reopening.

## Verification

Acceptance is in reconnection-sync-acceptance.md. The native captured-audio journey
in tests/e2e/recording.spec.ts calls delivered-replay.ts to verify actual publication,
complete downloads, disconnected A/B interaction, encrypted reopening, malformed
acknowledgement rejection, real reconnect, delayed HTTP receipts during new local
work, acknowledged prefixes, repeat sync, teacher receipt/review, sourced demo return,
student-player answer display and another offline tab reopening. Offline application
fetch/XHR/WebSocket are blocked as well as browser network transport.

Both learners have actual offline interaction ledgers: A requests help and answers
the refraction check correctly; B independently submits an incorrect answer before
reconnection. Each received checkpoint is compared to its own stored event IDs.

tests/progress-sync.test.ts checks stable ID assignment/migration, duplicate rejection,
receipt-schema agreement, ownership/revision/prefix validation, pending counters and
preserving answered guidance. tests/delivery.test.ts verifies repeated receipt handling,
durable server restoration, source/owner/recording checks, immutable context and
failure before acknowledgement.

Final checks on 2026-10-09:

- npm.cmd test: 379 tests across 18 files passed, including generated-type
  freshness and TypeScript.
- npm.cmd run build: both production apps passed; the final student build also
  includes the explicit active-learner guard on delayed responses.
- npx.cmd playwright test --reporter=line: all 36 browser scenarios passed in
  the final run (5.3 min), including the complete recorded reconnect journey and
  320/360/768/1440px student/teacher checks. The earlier focused native journey
  also passed independently (1.9 min).
- npm.cmd run pipeline -- --lesson fixtures/demo-lesson: valid sourced simulated
  lesson. git diff --check passed. No lint script is configured.

The complete tested sequence was captured audio and published packages, offline A
help/correct check plus B incorrect check, offline reopening, malformed receipt
failure, restored connection, real delayed acknowledgements during newer A work,
stable received IDs, duplicate-free retry, teacher receipt and prepared demo return,
correct question/concept answer display, then another disconnected reopening with
both learners' progress and receipts intact. Recording input was audible simulated
microphone data; no real people were recorded by these tests.

An initial full regression run passed 35 scenarios but the native journey's studio
loading assertion exceeded its five-second default. The trace showed the real
RecordingPanel chunk returned HTTP 200 after 15.3 seconds while the correct loading
message stayed visible. The test now allows 25 seconds for the lazy studio's usable
controls. No fixed sleep or successful response substitution was added.

## Changed files

- schemas/progress-record.schema.json: optional eventId for legacy compatibility,
  and optional answered-question provenance.
- schemas/progress-sync-state.schema.json and generated shared types: encrypted
  local receipt checkpoint, with generation registered in scripts/generate-types.mjs.
- packages/shared/src/progress-sync.ts and validation.ts: identity, checkpoint,
  duplicate validation and pending helpers; sprint.ts: stale-safe sourced answer merge
  and labelled simulated response.
- apps/student/src/App.tsx, storage.ts, useProgressSync.ts: assign/persist IDs,
  restore receipt state, bounded sync, safe late receipt/answer handling.
- apps/student/src/PlayerQuestions.tsx: label the prepared demo response.
- delivery/progress-store.ts: safe migration and immutable ID comparison.
- tests/progress-sync.test.ts, delivery.test.ts and e2e/delivered-replay.ts:
  regression and complete reconnect/return coverage.
- PROMPTS.md and architecture, contracts, acceptance, scope/status and browser docs:
  execution record and limits.

## Remaining limits

This is a loopback school service for one published recording and two explicitly
simulated learners, using public demo credentials. Production cloud deployment,
authentication, general AI answers and a free-form teacher answer editor are absent.
No external service processes questions. Conflicting independent tabs/devices or
different recording revisions require manual school reconciliation; silent merging
is avoided. Only the active unlocked learner synchronizes. Browser storage eviction
and actual physical Android installation/performance remain unverified. Service
receipts attest demo workflow receipt, not cryptographically signed school identity.

## Manual check

The teacher dev workspace is http://127.0.0.1:5174, student dev app is
http://127.0.0.1:5175, and the offline-capable production preview is
http://127.0.0.1:4173. The real local service is on port 8787. Publish your approved
recording from the teacher workspace first; test publications use isolated folders
and are not inserted into your school service. Demo PINs are A=111111 and B=222222.

Download on the production preview, disconnect and save a question in the recorded
player. Reconnect and observe Profile's received status or choose Try school sync.
For the supported glass-cup question, open teacher Sync & Transfers, review A,
Run simulated answer return and Return reviewed answers through school service.
After the next learner sync, view the labelled response under Your questions in
the player. Other questions stay pending. Reopen offline to verify the answer and
saved position; switch learners to inspect independent progress.
