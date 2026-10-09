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
explicitly simulated. Teacher data stays in memory for the current session.

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
