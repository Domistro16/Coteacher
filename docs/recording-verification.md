# Teacher recording and synchronized classroom replay

Historical first recording iteration. The two-minute WAV limit and common visual
replay described below are superseded by streaming Opus, reviewed personal scenes
and shared encrypted media storage. See [the current verification report](personalized-replay-verification.md).

Implemented for the existing source-grounded, approved refraction demo. Manual
presentation is reused; audio is optional and never inferred from slideshow visits.
There is no recognition, transcription, speech following, AI generation or voice
cloning. Both learners keep the original objective and approved instructional content.

## Working journey

1. Prepare/review/approve the lesson and start its existing presentation.
2. Explicitly enable capture of the teacher only and Start audio recording. Browser
   permission is required. Live status and elapsed captured audio time stay visible,
   including in projector view. An unanswered permission request can be cancelled;
   a microphone granted later is immediately released.
3. Advance the existing visuals manually. Pause recording for student speech and
   discussions. Pausing disables the microphone track and audio sampling; resume
   enables capture and tags the currently displayed approved moment.
4. Stop releases the microphone. Audio and the complete visual cue list are stored
   together in native IndexedDB as a private draft. A save failure keeps replayable
   media in memory, blocks navigation/export and offers retry. Silent/empty media
   cannot be approved as a recorded lesson. Hiding the tab automatically pauses.
5. Replay the saved WAV, seek to recorded moments and inspect matching approved
   SVGs, explanations and citations. Captions are prepared visual aids, explicitly
   labelled as not being a transcript. Play the recording and acknowledge source,
   timing and privacy review before approving it separately for learners.
6. Export personal packages after review. Export re-reads/validates stored audio;
   requirePublishedLesson rejects unreviewed recordings even outside the UI. Both
   routes receive identical recording/cues, while their original objectives remain
   unchanged. Reapproval of lesson content invalidates its previous media association.
7. Collect/save a personal package, disconnect, reopen and unlock. The student
   plays its embedded audio through an offline Blob URL. Recorded visual buttons
   seek to audio offsets; Study this exact concept opens the original timelineStepId,
   original explanation and teacher aid, rather than a general subject/topic page.

## Synchronization

getUserMedia feeds an AudioWorklet on the browser audio thread. The worklet counts
only captured mono samples. Visual messages receive offsetMs from that same sample
count; neither wall-clock time, chunk delivery timing nor elapsed pause time is used.
Transitions are reported after the presentation changes its persisted current step.
The worklet buffers samples, flushes before stopping and outputs silence to speakers
to prevent feedback. At the active two-minute sample limit it stops automatically.

Paused visual transitions remain in the cue list at the frozen audio offset, with a
resume cue for the current step. Several visuals at one offset have zero audio
duration; replay resolves that instant to the last cue. All transitions remain
inspectable. Message/render scheduling adds small browser-dependent boundary latency;
this is a manual classroom synchronization system, not frame-accurate video editing.

Native-rate input is downsampled by sample averaging to mono 16 kHz, 16-bit PCM WAV.
Duration comes from the encoded sample count; cue offsets are bounded to that duration.
This has finite decoded duration and native seeking, avoiding differing compressed
browser recording containers. The maximum WAV is 3,840,044 bytes; inline base64 and
encryption fit below the 8 MB transfer limit. Conversion helpers process base64 in
bounded blocks rather than building a character object for every byte.

Playback resolves the last cue at audio.currentTime, updating on time/seek events
and animation frames while playing. Existing concept IDs select the existing SVGs;
existing exact step IDs select the approved explanation and source references.
Pause and seeking do not mutate content. Native media playback pauses the recorded
audio when another HTML audio element starts; starting classroom audio pauses the
learner narrator. Returning to study pauses the recording.

## Files changed for this request

| Area | Files | Purpose |
| --- | --- | --- |
| Contracts | schemas/lesson-package.schema.json; schemas/encrypted-transfer.schema.json; packages/shared/src/generated/lesson-package.ts | Optional recording contract, independent review state, bounded media/cues and transfer size |
| Shared logic | packages/shared/src/recording.ts; validation.ts; publication.ts; transfer.ts; index.ts | PCM WAV encoding/checks, source/revision/time integrity, cue resolution, review and enforced collection/export gate; bounded base64 conversion |
| Teacher capture | apps/teacher/audio-capture-worklet.js; src/microphone-recorder.ts; src/recording-storage.ts; src/RecordingPanel.tsx; src/App.tsx; src/styles.css | Microphone permission/cancellation, sample clock, manual cue capture, pause/mute, save/retry, review and export integration |
| Learner replay | apps/student/src/RecordedLesson.tsx; src/App.tsx; src/styles.css | Shared teacher/learner synchronized audio/visual player, offline media and exact step study |
| Tests | tests/recording.test.ts; tests/e2e/recording.spec.ts | Audio/contract/clock/maximum-size checks and complete browser capture/review/export/offline playback plus failure recovery |
| Documentation | README.md; apps/teacher/README.md; docs/architecture.md; contracts.md; demo-acceptance.md; safety-and-data.md; sprint-status.md; recording-verification.md; tests/e2e/README.md; PROMPTS.md | Workflow, updated teacher-audio privacy scope, acceptance, limits and prompt/verification records |

Existing preparation/presentation work and the pre-existing technical audit remain
in the workspace; the table describes this recording request specifically.

## Verification

Unit tests exercise WAV encoding/downsampling, invalid/empty/silent audio, source and
revision mismatches, chronological and in-duration cues, same-time resolution,
independent recording review, clearing media on lesson reapproval, the real worklet's
sample count through a ten-second pause, final flush, two-minute automatic stop and
a maximum-size encrypted package round trip under the import cap.

Chromium browser tests use its simulated microphone and permission-dialog flags.
The actual getUserMedia/AudioWorklet/WAV/native audio path runs; media time and
Audio.play are not mocked. No physical microphone, people or children are recorded.
The permission-denial negative injects a NotAllowedError because the fake dialog
auto-allows; the quota negative injects a recording-store write failure. A deferred
permission test verifies cancellation releases an input that is subsequently granted.

The complete journey verifies a live projector, manually displayed forward/backward
concepts, muted/frozen pause time, equal paused/resume offsets, ended microphone
tracks, unchanged content/objective, saved draft and approval after refresh, decoded
duration and advancing playback time, matching visuals during play and seek,
both encrypted personal exports, rejected unreviewed learner audio, offline
reload/play/seek with application network APIs blocked, and exact refraction study.
Teacher review and offline learner screenshots were inspected.

The final npm test run passes **328 tests across 11 files**, generated-type
freshness and full TypeScript checking. **npm run test:e2e passes all 21 browser
journeys** and rebuilds both production apps. The full browser run completed in
3.1 minutes. The demo package also passes
npm run pipeline -- --lesson fixtures/demo-lesson. git diff --check is clean.

## Limits and browser behavior

- One recording per approved demo revision, at most two minutes of active audio
  and 1,000 visual cues. Delete the current recording before another take. WAV is
  larger than compressed speech; recording/conversion memory and performance on
  low-end devices remain unmeasured. This is the foundation, not a long-lesson editor.
- Stopped audio and review state survive reload/tab reopening. An unfinished
  recording is held in memory; a tab/process crash or forced refresh loses it.
  beforeunload warns and normal workspace navigation is blocked while capturing or
  recovering an unsaved draft. Saved browser storage can still be evicted or cleared;
  export reviewed packages for backup. Playback restarts at zero after reopening.
- Microphone capture needs a secure context (HTTPS or localhost), user permission,
  AudioContext and AudioWorklet. Permission denial, missing input and unsupported
  browsers report errors; manual presentation remains available. Native playback
  can require a user gesture. Backgrounding pauses capture; mobile OS interruptions
  and browser audio-device failures can interrupt input and need device testing.
  See [getUserMedia requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
  and [AudioWorklet audio processing](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process).
- Only automated Chromium capture/replay is verified. Physical Android/Windows
  microphones, Safari and Firefox are not verified by emulation. Hardware input
  latency and projector latency are not measured.
- A browser microphone cannot distinguish teachers from nearby speakers. Use a
  close teacher microphone, pause for discussions and delete contaminated recordings.
  Teacher storage is local and not encrypted; learner exports/snapshots are PIN
  encrypted. Human review acknowledges accuracy/privacy; validators do not prove
  speaker identity, speech content or actual source verification.
- Earlier collected packages are not automatically updated/recalled. Export and
  collect reviewed audio after class. There is no backend, automated transfer,
  multi-session recording library, transcription or personalized audio generation.
  Earlier revision recordings remain in teacher browser storage; changing content
  prevents their reuse/export but does not erase them. Clear teacher site storage
  to erase those older revisions. Personalization continues to change study routes
  and explanations only.
