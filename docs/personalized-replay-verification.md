# Personalized offline recorded lesson replay

This report records the original replay implementation and its verification.
New exports use prepared-support-rules-v2, retain all four approved scenes for
paused help and include an inspectable decision. See
[visual adaptation verification](visual-adaptation-verification.md) for the
current behavior, additional tests and limits; legacy v1 packages remain valid.

The teacher preparation → manual classroom presentation → recorded audio/timeline
→ reviewed personal package → offline learner replay journey is implemented for
the existing light/refraction demo. Student A and B hear the same complete captured
audio but receive different instructional scenes. Source-only legacy fixtures remain
available, with an explicit label that they contain no classroom recording.

## Package and approval

Teacher export reads the current approved lesson revision's recording from existing
IndexedDB storage. Recording review and personalized visual review are independent
of original lesson approval. Pending audio or visuals block both export and student
collection through `requirePublishedLesson`, not merely disabled buttons. A complete
recorded package must cover each prepared lesson step. Reapproving a lesson clears
its classroom record, recording and derived personal playback metadata.

An encrypted standalone teacher file contains:

| Field | Purpose |
| --- | --- |
| Lesson identity, publication, objective, sources | Original approved lesson and stable concept/step/source IDs |
| `recording` | Capture ID, classroom session/revision, original audio, duration, captured cues, audio and visual approvals |
| `recording.audio` | Complete Ogg Opus base64 plus a shared random media key, inside PIN encryption |
| `visualAssets` | Actual safe declarative SVG geometry/text for that profile, with stable asset/concept IDs and sourceRefs |
| `playback` | Recording/profile IDs, simulated rule/catalog version, reason, and a selected asset for every captured cue |
| Concepts, route, question bank, activity, quiz | Existing source-linked original/alternative explanations, safe Try it, prepared checks and answers |

No remote media URL, generated transcript or invented citation is used. Validation
checks shape, IDs, assets, cue chronology and catalog agreement. Human review remains
responsible for the instructional meaning and correspondence with recorded speech.

## Personalization

The existing public simulated learner profiles now carry explicit support/history
fixtures. A has difficulty interpreting apparent position and receives a straight-ray
diagram plus a pencil/apparent-position comparison. B has difficulty following the
boundary steps and receives numbered ray annotations. These are different geometries
and instructional representations, not themes or learner labels.

Four scenes are manually prepared from `notes-light` (the original reviewed simulated
teacher notes). No numerical angles, new objective or unsourced physics is inserted.
The fixed `demo-history-rules-v1` selects assets once during teacher export and records
the choices in each package. The teacher can replay both sequences, inspect every
chosen scene and approve them before publication. Catalog edits require a version bump
and new review. There is no trained recommendation model or student-side generation.

## Capture and synchronization

Permission-gated getUserMedia feeds the existing AudioWorklet sample clock. Every
manual visual transition tags the same active sample count. Pausing disables input
and adds no samples; paused transitions retain equal offsets and resume tags the
current visual. Stopping releases microphone tracks immediately.

PCM chunks stream into native WebCodecs mono Opus encoding at 48 kHz and a 24 kb/s
target. Raw PCM is not accumulated for the full recording. Compressed packets are
placed in Ogg pages using the encoder's actual OpusHead/pre-skip and exact final sample
count. Page CRCs, stream order, framing and final duration are checked. Capture also
rejects silent input before publishing; these checks cannot prove speaker identity.
The container follows [Ogg Opus RFC 7845](https://www.rfc-editor.org/rfc/rfc7845.html)
and uses the browser's [WebCodecs Opus encoder](https://www.w3.org/TR/webcodecs-opus-codec-registration/).

There is no two-minute limit for new capture. Protective bounds are 20 MB compressed
audio, six hours of active samples and 1,000 visual transitions; files/ciphertext are
bounded to 48 MB to accommodate encrypted JSON/base64 expansion. Legacy short WAV
imports remain supported. Native Opus duration metadata can include approximately
6.5 ms of codec priming; decoded audio duration matches the captured sample duration.

During replay, native audio `currentTime` selects the final cue at/before that time
through binary search, including after backward/forward seek and equal-time transitions.
The selected cue indexes the stored personal asset. Moving highlights use that same
clock, freeze on pause and reset correctly on seek. Rendering is limited to ten
frames/second; reduced-motion settings suppress moving highlights. Highlights illustrate
concepts, not individual words in the recording. Readable HTML annotations accompany
the SVGs for narrow screens.

The player provides native audio controls, explicit play/pause, ±10-second controls,
a seek slider and recorded moment selection. Exact-concept study and explanation
pause the recording and use its actual step/concept IDs. Existing prepared explanations,
activity, quiz and queued questions remain offline. No silent-slideshow fallback is
represented as a recorded lesson.

## Local media, readiness and resume

Student IndexedDB upgrades to v2 with `profiles` and `media` stores, preserving existing
profiles. Each PIN-encrypted snapshot contains personal content/progress and a local
media reference. One shared AES-GCM encrypted binary audio record is addressed by the
audio SHA-256 digest plus a key fingerprint. The random media key remains inside each
PIN-encrypted profile, never in the shared row. Both recorded profile exports share
that key and produce exactly one local audio record. Standalone transfer files each
carry complete audio so they can be collected independently.

Media preparation/validation is cached for the current immutable recording, so progress
saves encrypt small metadata and do not copy/re-encrypt the full media at each checkpoint.
Required media and profile metadata commit in one transaction. A failed media write
aborts the profile write; shell caching alone cannot show Ready offline. Later progress
save status is separate from already completed media readiness.

Restore decrypts/authenticates media, checks its digest/length and validates its container
before creating a local Blob URL. SVG assets come from encrypted package data. The
existing service worker caches the app shell and generic explanation clips. Playback
does not stream from a server and calls no network API. Missing or damaged audio fails
clearly, with same-package recollection retaining the learner's position, events and
questions. No partial audio is presented as a complete lesson.

`PlayerState.recording` saves recordingId/positionMs separately per profile every five seconds
and on pause/seek/lock. Study navigation and alternative explanations preserve it. Lock
waits for the latest save; reopening restores the position without autoplay. An abrupt
process crash can lose the most recent unsaved position (normally up to five seconds plus
storage latency); stopped teacher media and completed student saves survive restart.

## Verification

- `npm.cmd test`: 334 unit tests across 12 files after commit review, generated-type freshness and TypeScript
  checks. New checks cover meaningful geometry differences, identical audio/objective/
  cue chronology, source retention, missing/altered assets, wrong-profile/timing/recording
  references, approval gates, omitted concepts and preserved playback state. The actual
  worklet test records 121 seconds without an automatic two-minute stop. Commit review
  also added a regression check that relabelling cached WAV audio as Opus reruns
  container validation and rejects the mismatched bytes.
- `npm.cmd run test:e2e`: 22 browser tests, with production builds of both applications.
  The complete recording test uses native getUserMedia/AudioWorklet/WebCodecs and
  Chromium's simulated microphone. It exercises pause/mute, backward/forward classroom
  transitions, saved draft/review, both review gates, both personal exports, A/B native
  playback with different scenes, shared media count, wrong PIN/profile isolation,
  network disconnection, offline reload/play/seek/exact help/activity/quiz/questions,
  independent restart/resume, atomic quota failure and missing/damaged media recovery.
- After the final incomplete-package message change, both apps were rebuilt and the
  affected profile/file boundary and complete recording journey were rerun. Recovery
  uses a bounded 20-second assertion because PIN crypto plus atomic storage exceeded
  the ordinary five-second deadline once on the contended Windows worker; the rerun
  preserved positions/questions and completed without an application persistence fix.
- The native encoder test feeds 121 seconds of simulated sine-wave PCM through the actual
  encoder module, decodes it with AudioContext to check duration/audibility, checks
  compression, rejects corrupted bytes and natively plays/seeks past 120 seconds.
- `npm.cmd run pipeline -- --lesson fixtures/demo-lesson`: original source-only package
  remains valid. `git diff --check`: no whitespace errors.

The recording journey captures projector, teacher review, A and B screenshots under
ignored `test-results`. Desktop projector controls and 360 px learner replay were
inspected. A 320 px original-player acceptance test also remains green. Native media
controls and actual decoded audio are used; media clocks are not mocked. Test input
is simulated audio, not a verified physical teacher voice or classroom conversation.

## Files changed in this task

- Contracts: `schemas/lesson-package.schema.json`, `schemas/player-state.schema.json`,
  `schemas/encrypted-transfer.schema.json`, generated lesson/player types.
- Shared behavior: `packages/shared/src/personalized-replay.ts`, `learner-profiles.ts`,
  `opus-container.ts`, `recording.ts`, `publication.ts`, `validation.ts`, `transfer.ts`,
  `sprint.ts`, `index.ts`.
- Teacher: `apps/teacher/audio-capture-worklet.js`, `src/opus-encoder.ts`,
  `src/microphone-recorder.ts`, `src/RecordingPanel.tsx`, `src/App.tsx`.
- Student: `apps/student/src/media-storage.ts`, `storage.ts`, `RecordedLesson.tsx`,
  `ReplayVisual.tsx`, `player.ts`, `App.tsx`, `styles.css`.
- Tests: `tests/personalized-replay.test.ts`, `tests/recording.test.ts`,
  `tests/e2e/recording.spec.ts`, `tests/e2e/opus.spec.ts` and browser-test instructions.
- Documentation: this report, architecture/contracts/demo acceptance/review/safety/scope/
  sprint status, historical recording report pointer, teacher README, root README and
  `PROMPTS.md`. Earlier teacher/presentation changes already in the workspace are retained.

## Remaining limitations

- One fixed, reviewed simulated science lesson and two fixed simulated histories. Other
  sources/profiles/visual catalogs require preparation and review; no curriculum system.
- Teacher capture targets browsers providing AudioWorklet, native Opus AudioEncoder and
  its delay header on HTTPS/localhost. Unsupported codecs fail explicitly; there is no
  short WAV fallback that silently truncates a class. Chromium automation passes; Firefox,
  Safari and physical low-end Android microphone/playback/performance remain unverified.
- Browser storage can be evicted. Keep standalone encrypted package files as backups.
  The subsequent [recorded delivery extension](recorded-delivery-verification.md)
  adds an explicit loopback publishing/streaming/download service. There is no
  automatic progress sync or signed teacher attestation. Public demo PINs are
  working workflow fixtures, not production authentication.
- A browser cannot isolate the teacher from nearby students. Use a close microphone,
  pause for discussion and review privacy. Unfinished capture is lost on a forced reload
  or crash; only stopped media is saved. No automatic transcription or speech following.
- This is synchronized captured audio plus SVG scenes/highlights, not an exported video
  file or word-level visual editor. The teacher must check that each selected scene fits
  their actual explanation; schema/source-reference validation cannot verify that meaning.
