# Architecture

## Working stack

- Student PWA and teacher workspace: Vite + React + TypeScript.
- Service worker: a small Vite build plugin generates a complete static app-shell
  precache, including bundled SVG/icon/manifest assets. Native IndexedDB stores
  encrypted learner snapshots. No extra Workbox/idb dependencies are needed for
  the single-lesson sprint.
- Pipeline: local Node + TypeScript validation and bounded simulated generation.
- Contracts: draft 2020-12 JSON schemas, Ajv validation and referential-integrity
  checks; committed types generated with json-schema-to-typescript.
- Personal storage/transfers: Web Crypto PBKDF2-SHA256 (210,000 iterations,
  independent 16-byte salt) and AES-256-GCM (independent 12-byte IV).
- Tests: Vitest, Playwright, and in-process Vite preview servers.

Use Node.js 22.12 or later. The .npmrc caps Node lifecycle tool heaps to help on
memory-constrained hosts. Run expensive checks sequentially.

## Data flow

Teacher reviewed text sources -> deterministic simulated generator -> schema and
source-reference checks -> explicit teacher review/approval -> two encrypted
packages. The CLI uses the same generator with --approve-reviewed.

Student unlock -> collected package + encrypted IndexedDB snapshot -> local
lesson/variants/activity -> local matching/quiz -> encrypted progress file.
School visit -> teacher PIN unlock/import -> aggregate insights -> explicit
simulated queued answer -> encrypted returned progress -> student answer merge.
No automatic sync, server, external LLM, or remote asset loading.

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

Standalone encrypted files contain complete audio, sources, chosen assets/sequence,
explanations, activities and quizzes. On collection, IndexedDB v2 stores one binary
AES-GCM audio record shared by both profiles. The media ID combines SHA-256 audio
content and a key fingerprint; the random media key remains inside each PIN-encrypted
snapshot, never in the shared media row. Profile metadata and required media commit
together. Restore authenticates/decrypts/checksums the media before playback; missing
or damaged audio offers same-package recollection preserving progress. Audio uses a
local Blob URL, visuals render from stored shapes, and the service worker caches the
static player and generic explanation clips. There is no remote media stream.

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

Teacher aggregates use distinct learners per lesson moment. Newer imported
snapshots replace older ones by timestamp; duplicate/older snapshots are rejected.
Seeded class records, variant observations, and previous-cohort nudges are
explicitly simulated. Teacher notes, activity sources, personal drafts and
publication approval persist in localStorage on the teacher origin. These contain
only public simulated demo materials. Restoring them validates contracts and
compares content to the fixed source-derived generator output. Approval is saved
before export is enabled. Teacher progress imports stay in memory for the session.

## Layout

/schemas: lesson-package, progress-record, encrypted-transfer, player-state.
/packages/shared: generated types, validators, generator, matcher, transfer crypto,
simulated profiles/seed records, quiz selection, snapshot/answer merge helpers.
/apps/student: mobile offline player, storage, speech adapter, sourced SVG visuals.
/apps/teacher: preparation/approval, tap-controlled projection, aggregate insights.
/pipeline: validation CLI and reviewed-source generation CLI.
/fixtures: sourced simulated lesson, reviewed materials, invalid contract examples.
/tests: contract/unit checks and both full browser journeys.
/docs: product, safety, scope, contracts, demo and phase status.

## Working rules

- Change schemas first, regenerate types, then update consumers and fixtures.
- Transfers are ordinary encrypted files; do not build a sharing system.
- Student core interactions never call network APIs after collection.
- Keep packages small; SVG/CSS and text, no video or external fonts.
- Described-only capabilities stay behind named unavailable interfaces.
- See docs/sprint-status.md for proof-of-concept limits and unverified Android work.
