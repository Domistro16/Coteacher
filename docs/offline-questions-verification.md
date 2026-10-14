# Contextual offline questions

The recorded lesson player is the question entry point. Explain this pauses the
native audio element, reads its current time, resolves the original captured cue,
and opens the existing help dialog. Typed questions go directly to the local
matcher without being interpreted as playback commands. Both UI designs remain.

## Two answer paths

Prepared answers come only from the approved downloaded question bank. Candidates
must belong to the current recorded concept and exceed the package threshold.
The answer is labelled Prepared offline answer and exposes its source references.
This path makes no server call and does not generate text.

Unsupported questions receive the honest no-match message and a Pending teacher
review status. A separately labelled prepared explanation can still be available;
it is not an answer to the unmatched question. The original text, including
punctuation, whitespace and newlines, is saved with a unique ID, askedAt,
timelineStepId and recordedContext containing studentId, lessonId, conceptId,
recordingId and positionMs. Prepared question events also retain originalText
and this context. Native time is rounded to the nearest millisecond and bounded
by the captured duration. Validation rejects a different owner, lesson, recording,
cue or position. Older records remain valid without this optional context; no
timestamps are invented for them.

## Persistence and return

Questions use the existing per-learner encrypted IndexedDB snapshot. Saving needs
no connection. Feedback reflects the durable-storage status, including errors.
Multiple submissions append unique entries. The contextual history shows prepared
answers, pending questions and returned sourced guidance. Progress shows a pending
count and a route back to the player rather than another question interface.
Recorded packages cannot bypass the player through the older prepared-content route.

Closing the dialog removes its help overlay while retaining the same paused audio
position. Return to recorded lesson resumes the original recording there. Question
handling and alternatives do not change the teacher audio or captured cues.

Optional school synchronization sends encrypted progress after reconnection. Only
a valid durable server acknowledgement marks it received; failures preserve the
queue. Receipt does not mark a question answered. Returned answers must match the
complete immutable question identity, including its playback context. Manual
encrypted transfers remain. Teacher questions show the recorded moment within the
existing workspace layout.

## Verification

The native microphone browser journey records audible simulated input, captures
manual transitions, approves and publishes actual audio through the local service,
then tests downloaded playback with transport disabled and fetch, XMLHttpRequest
and WebSocket blocked. Assertions cover:

- A supported pencil/refraction question, immediate prepared answer and teacher-note
  citation.
- Two unsupported A questions with exact punctuation/whitespace/newlines, unique IDs
  and the original owner/lesson/concept/recording/time.
- Offline refresh and reopening, contextual history and unchanged paused time after
  closing the panel.
- B's separate question at another concept/time without changing A's saved queue,
  followed by A's restored history offline.
- Existing actual school return and sourced merging without replacing newer local
  progress or another profile's records.

Unit checks cover raw text, questions resembling commands, strict context validation,
legacy records, changed-time answer rejection, and service rejection of altered or
removed context. See tests/recorded-adaptation.test.ts, tests/delivery.test.ts and
tests/e2e/recording.spec.ts.

Final checks on 2026-10-09:

- npm.cmd test: 369 tests in 17 files passed, including generated-type freshness
  and TypeScript. The final run includes rejection of changed/removed context on
  both learner submissions and teacher answer return.
- npm.cmd run build: both production applications passed.
- npx.cmd playwright test --reporter=line: all 36 browser scenarios passed (6.3 min),
  including the native recorded question journey and 320/360/768/1440px UI checks.
  The focused native journey also passed independently before the full regression.
- npm.cmd run pipeline -- --lesson fixtures/demo-lesson: valid sourced simulated
  package. git diff --check passed. No lint command is configured in this repository.

The offline question assertions use real encrypted storage and the captured audio
pipeline, with audible simulated microphone input. The actual school return uses
the loopback HTTP service; its prepared answer is explicitly simulated. Neither
path substitutes generated speech for the classroom recording.

## Files and integrations

- schemas/progress-record.schema.json, generated/progress-record.ts and the shared
  index export add backwards-compatible exact recorded question context.
- packages/shared/src/validation.ts and sprint.ts validate context and immutable
  answer identity; delivery/progress-store.ts enforces it before acknowledging
  school receipt or returned guidance.
- apps/student/src/recorded-help.ts matches original typed text locally; help.ts
  adds explicit prepared/pending response status.
- StudentPlayer.tsx and PlayerQuestions.tsx integrate contextual entry/history and
  paused close; StudentShell.tsx routes recorded questions back to the player.
  student-theme.css provides scoped history styling using existing design tokens.
- apps/teacher/src/TeacherQuestions.tsx shows the captured time in the existing inbox.
- tests/recorded-adaptation.test.ts, delivery.test.ts and e2e/recording.spec.ts cover
  both paths, durability, exact context and independent learners.
- .npmrc raises the lifecycle TypeScript heap cap to 512 MB after the former
  256 MB setting exhausted the heap. PROMPTS.md and related contract, matcher,
  architecture, acceptance and browser-test documentation record the change.

This task reuses the native audio player, published package question bank,
conservative matcher, encrypted profile snapshots, acknowledged school service,
PIN isolation, source display, contextual dialog and manual transfers. It adds no
new AI provider or question storage service.

## Limits

One reviewed lesson and two labelled simulated learners are supported. There is no
general server AI answer service or free-form teacher answer editor. Reconnection
queues receipt/review and does not guarantee an answer. Only the existing prepared
plastic-cup answer-return simulation resolves its supported queued question;
others remain pending. No online response is disguised as an offline answer.

Typed input is fully offline; voice depends on an available local recognizer.
Physical Android microphones, storage eviction and Safari/Firefox remain unverified.
Public demo PINs and encrypted storage are not complete production authentication
or shared-device security. Original times for older questions cannot be recovered.
