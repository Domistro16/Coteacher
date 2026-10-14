# Architecture

## Working stack

- Student PWA and teacher workspace: Vite + React + TypeScript.
- Service worker: a small Vite build plugin generates a complete static app-shell
  precache, including bundled SVG/icon/manifest assets. Native IndexedDB stores
  encrypted learner snapshots. No extra Workbox/idb dependencies are needed for
  the single-lesson sprint.
- Pipeline: local Node + TypeScript validation and bounded simulated generation.
- Delivery: a loopback Node HTTP service persists one reviewed recorded demo and
  two encrypted personal manifests; Vite dev/preview proxy exposes `/api`.
- Contracts: draft 2020-12 JSON schemas, Ajv validation and referential-integrity
  checks; committed types generated with json-schema-to-typescript.
- Personal storage/transfers: Web Crypto PBKDF2-SHA256 (210,000 iterations,
  independent 16-byte salt) and AES-256-GCM (independent 12-byte IV).
- Tests: Vitest, Playwright, and in-process Vite preview servers.

Use Node.js 22.12 or later. The .npmrc caps Node lifecycle tool heaps to help on
memory-constrained hosts. Run expensive checks sequentially.

## Data flow

### Classroom studio and local projector

`Presentation` renders the approved active timeline step in a shared teacher-only
`TeachingCanvas`. A separate `?projector=<classroomSessionId>` entry mounts only
`ProjectorDisplay`; it never mounts the workspace or microphone recorder.
BroadcastChannel distributes a minimal instructional frame (stable lesson/session/
step/concept/source IDs, approved words and visual number), with hello/latest-state,
heartbeat and closure messages. No audio, raw source material, learner records or network
service is sent/used by this channel. Studio reload preserves the session ID;
display reload/reopening requests the current frame. Missing browser capability
or blocked popups show an honest Focus studio fallback.

The studio keeps a 16:9 canvas and grouped controls inside the viewport; sources
and visit history are secondary. Stop/save enters the existing review only after
durable saving succeeds. Web Locks prevent concurrent same-lesson capture in one
browser origin, and the studio rechecks saved recording state before a new take.
Changing focus/window visibility no longer implicitly pauses recording: Pause
remains explicit. Browser/device suspension is a separate hardware limitation.

### Lesson distribution

Visual motion is a renderer concern: approved layer data and saved recording
contracts are unchanged. Recorded playback uses cue-relative native media time
for a 5,000 ms cycle. The studio publishes ambient presentation time or actual
captured-sample/cue-relative time to its local projector; the projector does not
invent a second clock. Lightweight SVG tracing/approved-step emphasis, bounded
updates, visibility-aware standalone previews, reduced-motion static views and
reserved SVG watermarks share one implementation across the apps.

Teacher reviewed text sources -> deterministic simulated generator -> schema and
source-reference checks -> explicit teacher review/approval -> two encrypted
packages. The CLI uses the same generator with --approve-reviewed.

Teacher microphone + sample-timed cues -> saved private review -> recording and
personalized visual approval -> explicit local service publication.
Student unlock -> personal encrypted manifest -> native streamed audio + timed
SVG visuals -> explicit complete download + encrypted IndexedDB snapshot ->
offline recorded replay/help/activity/check -> encrypted progress file.
School visit -> teacher PIN unlock/import -> aggregate insights -> explicit
simulated queued answer -> encrypted returned progress -> student answer merge.
The existing loopback service now also accepts PIN-encrypted event snapshots
for its published recording. It validates owner, lesson, source references and
recording revision, writes the encrypted snapshot atomically, then returns a
schema-validated SHA-256 receipt. Only that receipt confirms synchronization.
Teacher requests retrieve validated snapshots; prepared reviewed answers return
to the matching learner on a subsequent background sync. No external LLM or
production cloud synchronization is implemented. An empty connected learner home
discovers the published personal manifest; playing/downloading are explicit.
An already-collected profile needs no catalogue call, and the downloaded student
core path remains entirely local.

Recorded playback leads the learner interface. Textual support opens when pausing
for concept help/activity/checks and folds when the original recording resumes.
The old fixture and existing saved notes-only lessons require explicit compatibility
selection; their records are retained and their readiness label describes prepared
content, without claiming a downloaded classroom recording.

The teacher timeline remains shared. Personalized routes select and order
variants and offer optional refreshers; the learning objective is identical.
An optional classroomTimeline in the same lesson package records manual display
visits by existing timelineStepId/conceptId, with an approval revision and current
step. Presentation never edits the prepared timeline, explanations or objectives.
Both personal packages carry the identical classroom record. Teacher writes save
before displaying a new moment; reopening resumes its last step. Learners can
select exact classroom steps offline, using the teacher's default explanation.

Teacher microphone capture uses permission-gated getUserMedia and AudioWorklet.
The worklet's captured sample count timestamps both audio and visual messages.
Paused input is muted and contributes no samples/time; resume tags the current
approved visual. It outputs silence to speakers, preventing microphone feedback.
PCM chunks feed native WebCodecs Opus encoding as they arrive (mono 48 kHz,
24 kb/s target). Only compressed packets accumulate. A small RFC 7845 Ogg muxer
uses the encoder's actual OpusHead delay and final sample count to preserve
chronology and trim padding. There is no two-minute stop; a 20 MB media budget,
six-hour safety ceiling and 1,000-cue bound protect device/transfer memory. Stop
releases the microphone immediately; audio and cues save atomically as a draft.
Teacher review approves captured audio and, separately, both prepared personalized
visual sequences before export. No automatic speech following is implemented.

The fixed simulated profile histories choose concrete ray/pencil diagrams for A
and ordered annotated rays for B. A versioned, hand-prepared catalog contains safe
declarative SVG shapes with sourceRefs. Each recorded cue selects an actual asset
in that learner's package; objective, audio, cue chronology and stable IDs remain
identical. Validation rejects missing/modified assets and wrong-profile sequences.
Catalog changes require a version bump and new teacher visual review.

New prepared-support-rules-v2 manifests explain the history/preference/default
decision and package all four approved representations, while assigning distinct
scenes to A and B's cues. Empty history uses a concrete-diagram default. Paused help
reads native audio time to find the exact concept, rotates prepared explanations
and unseen representations using only the active learner's events, and stores
recording.support plus sourced visual-explored events in the encrypted snapshot.
Resume restores the assigned sequence without altering audio or approved content.
Teacher review includes default/help assets; progress imports use the saved recorded
revision. See visual-adaptation-verification.md for simulation and regeneration limits.

Standalone encrypted files contain complete audio, sources, playback/help assets and sequence,
explanations, activities and quizzes. On collection, IndexedDB v2 stores one binary
AES-GCM audio record shared by both profiles. The media ID combines SHA-256 audio
content and a key fingerprint; the random media key remains inside each PIN-encrypted
snapshot, never in the shared media row. Profile metadata and required media commit
together. Restore authenticates/decrypts/checksums the media before playback; missing
or damaged audio offers same-package recollection preserving progress. Audio uses a
local Blob URL, visuals render from stored shapes, and the service worker caches the
static player and generic explanation clips. Streaming metadata references a
same-origin `/api/recorded-lessons/{sha256}/audio?key=…` URL. The delivery service
provides the original Ogg bytes with HTTP range support; native audio remains the
clock for both streaming and local Blob playback. Opening a stream saves its
encrypted metadata and progress, but does not claim offline readiness.

Downloads count response bytes, enforce declared length and SHA-256, validate
the actual Ogg container/duration, then commit media and profile metadata
together. The second learner reuses authenticated identical local media instead
of fetching another audio copy. Publication writes audio first and atomically
replaces the paired encrypted manifest index last. Service restart verifies the
saved checksum and manifests. An empty/unconfigured service never invents a
recording or substitutes the legacy notes fixture.

There is no configured cloud bucket, public delivery deployment or production
teacher authentication. The local service uses a server-side publication token
and a random media capability; the default token and PINs are public fixtures.
Server audio is plaintext on the local filesystem. See recorded-delivery-verification.md.

Native audio currentTime selects the last cue at/before that time, including after
seek and equal-time paused transitions. Highlights derive from the same clock;
rendering is limited to ten frames/second and reduced-motion users see static geometry.
Per-profile encrypted PlayerState stores recordingId/positionMs every five seconds and on
pause/seek/lock. Reopening seeks there without autoplay. Offline readiness reflects
successful full collection separately from the status of subsequent progress saves.

Two public simulated PIN profiles keep local progress separate. Saves are
serialized and readiness is shown only after a complete shell cache and snapshot
save. Wrong-profile imports are rejected before writes. Return files merge only
answers for matching queued questions and preserve newer local events.
Storage validates snapshot ownership and progress/player relationships before
both reads and writes. Selecting a different learner clears PIN input and any
authenticated missing-media recovery state; unlock freezes the identity fields.
Lock flushes pending saves before dropping the active session. No entered PIN is
persisted. Fixed demo credentials remain public fixtures, not production secrets;
one learner tab at a time is supported. See shared-device-verification.md.

The matcher normalizes keyword/alternate-phrase tokens, requires full query-token
coverage, and adds a small current-step bonus after relevance checks. Its score
must strictly exceed the package threshold. No-match questions are saved and a
sourced current-moment explanation is clearly labelled as related material.

SpeechInput checks an already available local recognition capability. It sets
processLocally, listens only during the press, stops on release/cancel/blur, and
asks for typed input on unsupported/uncertain recognition. It downloads no model
and stores no audio. Native-device behavior still needs a hardware check.

Narration uses checked-in compressed clips generated offline from the reviewed
captions with Windows SAPI/FFmpeg. The service worker caches the entire audio
directory. Existing variant audioAssetPath fields and an internal exact-caption
manifest select clips. One playback controller sequences replies and cancels
obsolete output; it falls back only to local browser synthesis voices. Captions
and sources survive failures. Narration enablement/rate are transient per-session
UI state and are not added to the encrypted progress/player contracts.

Student input recognizes six conservative command intents with bounded typo
correction. All remaining text is matcher context for the current lesson step.
No-match responses remain honest and show an unseen sourced explanation only
as related material. Its view is recorded at the current step without navigating.

Try it completion returns to its exact original step and automatically opens the
approved concept check. A pending check restores from saved completion/answer
events. Each quiz retry appends the selected option, correctness and prepared
sources to the learner's existing encrypted progress. The activity summary separates
self-reported completion from the latest check result and shows attempts since its
last completion. General quizzes retain pause-based selection. See
activity-check-verification.md for the offline journey and learning-evidence limits.

Teacher aggregates use distinct learners per lesson moment. Newer imported
snapshots replace older ones by timestamp; duplicate/older snapshots are rejected.
Seeded class records, variant observations, and previous-cohort nudges are
explicitly simulated. Teacher notes, activity sources, personal drafts and
publication approval persist in localStorage on the teacher origin. These contain
only public simulated demo materials. Restoring them validates contracts and
compares content to the fixed source-derived generator output. Approval is saved
before export is enabled. Teacher progress imports are now encrypted and persisted on the teacher origin;
restore revalidates their lesson and learner before showing insights.

## Layout

/schemas: lesson-package, progress-record, progress-receipt, encrypted-transfer, player-state.
/packages/shared: generated types, validators, generator, matcher, transfer crypto,
simulated profiles/seed records, quiz selection, snapshot/answer merge helpers.
/apps/student: mobile offline player, storage, speech adapter, sourced SVG visuals.
/apps/teacher: preparation/approval, tap-controlled projection, aggregate insights.
/pipeline: validation CLI and reviewed-source generation CLI.
/delivery: persistent recorded-demo publication and actual HTTP media delivery.
/fixtures: sourced simulated lesson, reviewed materials, invalid contract examples.
/tests: contract/unit checks and both full browser journeys.
/docs: product, safety, scope, contracts, demo and phase status.

## Working rules

- Change schemas first, regenerate types, then update consumers and fixtures.
- Progress/answers use encrypted files or the acknowledged local school return
  route. Recorded demo distribution uses the bounded local service.
- Student core playback and interaction never require network APIs after
  collection. Optional background return pauses while offline or locked.
- Keep packages small; SVG/CSS and text, no video or remote runtime fonts.
  The student Nunito font is self-hosted with its OFL licence and precached.
- Described-only capabilities stay behind named unavailable interfaces.
- See docs/sprint-status.md for proof-of-concept limits and unverified Android work.

## Teacher product workspace

TeacherShell reuses student-ui.tsx, student-theme.css and self-hosted Nunito.
teacher-theme.css only arranges the professional workspace. App retains the
preparation/publication/transfer controller. SourceUpload accepts bounded text
materials; TeacherQuestions filters the exact-concept inbox. RecordingPanel is
lazy-loaded and retains native capture/review state between studio and review.
Its single RecordedLesson player switches default/A/B visuals without rebuilding
the audio element or changing its clock. Teacher hash routes are dashboard,
lessons, prepare, teach, review, publish, insights, questions, transfers and
settings. Capture and unsaved audio lock navigation, including hash changes.

The student useProgressSync hook is optional background work: a 1.8-second quiet
period after durable saving, 15-second request timeout, retry every 30 seconds
while connected, and explicit retry in Profile. Playback saves do not cancel
an in-flight request. A persisted offline hint suppresses return after offline
reopening until a reconnect event or explicit retry. Receipt identity and digest
are checked before storing an encrypted ProgressSyncState checkpoint containing
the received event/question IDs. New work beyond that prefix remains pending.
Returned answers merge against the latest active profile, never an old unlocked
session, preserving existing answered guidance. Playback stays local.
Teacher ingestion serializes file imports and school updates to protect newer
records and prepared answers from asynchronous replacement.

Recorded typed questions enter through StudentPlayer's existing help dialog and
recorded-help.ts, which resolves native time to the original cue before matching.
PlayerQuestions reads prepared, pending and returned entries inside that dialog.
Progress provides a count/link rather than a separate question form. The existing
encrypted snapshot and school return services carry the optional recordedContext;
schema and immutable identity checks protect the owner and original moment.

Lifecycle Node tooling uses a 512 MB old-space cap and 4 MB semi-space in .npmrc.
The former 256 MB cap exhausted TypeScript's heap with the expanded contracts.

App assigns stable event UUIDs before persistence. Legacy records can acquire IDs
once without changing original content; established IDs cannot change or disappear,
and duplicates fail validation. Received unchanged ledgers poll for returned guidance
without re-uploading. The prepared answer demo carries explicit simulated provenance.
See reconnection-sync-verification.md for the complete disconnected return journey.

Teacher concept insights derive observations from the existing validated progress
contract. The newest snapshot per learner and stable event IDs prevent duplicate
counts. Seeded class data and received demo interactions are separate selectable
cohorts. Original concept/step IDs and saved recording cues supply classroom
context; explanation checks use append-only event order, not a causal model.
Material actions navigate to the exact approved preparation variant without
changing classroom visits or recorded media. See teacher-insights-verification.md.
# Recorded-lesson companion integration

StudentPlayer retains the native RecordedLesson and existing modal/support/check
models. Explicit local VoiceSession finals dispatch a recording-scoped interruption;
RecordedLesson captures/persists its native pause moment. The companion clip engine
reuses createNarration/preparedClip without synthesis fallback. Its own clip clock
animates approved help graphics while the original recording clock is frozen.
Existing variant/visual/quiz/queued-question contracts hold all durable interaction
records. New conversation controls and self-reports have no invented mastery state.
The complete speech manifest remains in the existing production app-shell precache.
No teacher speech-following, new backend, live tutoring AI or cloud recognition is
introduced. See companion-verification.md for implementation and tested scope.
