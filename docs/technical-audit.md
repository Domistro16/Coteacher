# Technical foundation audit

2026-10-09 · inspected `6c3c76e` on `feat/coteacher-offline-voice-poc`.

Reuse the existing offline demo: tests exercise storage, encryption, matching,
activities, imports and real audio. The standard browser command is timing-sensitive
and the teacher preview recipe is broken. This audit changed documentation only.

## Current technology

| Area | Actual implementation and location |
| --- | --- |
| Frontend | Two React 19 / TypeScript / Vite 7 apps: `apps/student` and `apps/teacher`. Native React state; no URL router. Green/cream CSS and inline SVGs in `apps/student/src/styles.css`, `Visual.tsx`; teacher imports the shared styles. |
| Backend | None. `pipeline/src/cli.ts` is local Node/TypeScript tooling, not an API server. Vite serves static builds for the demo. |
| Database / offline data | Native IndexedDB database `coteacher-sprint`, version 1, `profiles` store keyed by learner ID. `apps/student/src/storage.ts` stores encrypted `{ lesson, progress, player }` snapshots; teacher drafts/imports are React memory only. No server database. |
| Authentication | Student PIN unlock/decryption, with two public simulated profiles in `packages/shared/src/sprint.ts`. No accounts, sessions service, teacher login, or access-control backend. `transfer.ts` uses PBKDF2-SHA256 (210,000 iterations) and AES-256-GCM with fresh salt/IV. |
| Service worker | `apps/student/vite.config.ts` generates `dist/sw.js`: versioned Cache Storage, complete build/audio precache, cached navigation fallback, old-cache cleanup. `App.tsx:220` registers it only in production. Uncached same-origin assets may fall back to fetch; the fixed core path uses bundled assets. |
| AI / voice | No LLM SDK, paid API, remote embedding, or deployed model. `LessonGenerator` and `QueuedAnswerProvider` in `sprint.ts` are deterministic simulations. `matcher.ts` is local token matching. `speech.ts` permits already-installed local recognition only, otherwise typing. `Narrator.tsx` / `narration.ts` use 40 bundled MP3s, then local English synthesis only. Optional `pipeline/src/narrate.ts` uses Windows SAPI and installed FFmpeg; ordinary builds need neither. |
| Contracts / checks | Four JSON schemas in `schemas/`, generated types in `packages/shared/src/generated/`, Ajv and cross-reference validation in `validation.ts`. Vitest, Playwright, strict TypeScript; npm workspaces and committed lockfile. |

## Journey map

Each app has one `/` entry point. Teacher tabs and student lesson positions are
component state, not separate URL routes. Development ports: student 5173,
teacher 5174. Documented production-preview ports: 4173/4174; tests: 4273/4274.

| Journey | Components / services | Data |
| --- | --- | --- |
| Teacher prepares → reviews → approves → exports | `apps/teacher/src/App.tsx` (`screen='prepare'`); file upload → `localLessonGenerator.generate` → `validateLessonPackage` → explicit review checkbox/approval → `encryptPayload` / `downloadFile` | Two `LessonPackage` values, same objective, distinct variant orders/refresher. Only the two supplied reviewed text sources are accepted. |
| Teacher teaches with projector | Teacher `App.tsx` (`screen='teach'`); tap-driven timeline and shared `Visual` / `Sources` | `LessonPackage.timeline`, concepts and citations; two concept diagrams. |
| Student unlocks → collects → reopens offline | `apps/student/src/App.tsx:208`, `unlock`, `collect`, `importFile`; `storage.ts`; generated worker | `Snapshot`: validated lesson, `ProgressRecord`, `PlayerState`. Saves are serialized; Ready offline also requires successful saving. |
| Student revisits → asks → tries → checks understanding | `LessonPlayer` in student `App.tsx:69`; `player.ts`; `help.ts` → `matcher.ts`; `Narrator`; `sprint.ts:46` (`chooseQuiz`) | Exact-step events, per-profile viewed-variant history, queued questions, activity phase/index, quiz correctness and `sourceRefs`. |
| Student exports → teacher imports → insights | Student export; teacher `screen='insights'`, `importProgress`; `decryptPayload`, `validateProgressRecord`, `upsertSnapshot`, `seededRecords` | Encrypted `ProgressRecord`; 18 simulated seed records plus imported learner snapshots. Newer snapshots replace older ones; duplicate/older imports fail. |
| Teacher returns answer → student merges | Teacher `simulatedAnswerProvider` and returned-file export; student `mergeReturnedAnswers` | Only the prepared plastic-cup safety question gets an answer. Matching question identities merge without replacing newer local events; unsupported questions remain pending. |

Models: `LessonPackage` contains sourced content, timeline, bank, quiz and route;
`ProgressRecord` contains identity, events and queued answers; `PlayerState` holds
position/activity; `EncryptedTransfer` wraps ciphertext. Their schemas live in
`schemas/`; reuse the validators at file boundaries.

## Requirement status

| Status | Requirement and evidence / limit |
| --- | --- |
| Implemented | Offline reload/tab reopening, separate PIN profiles/routes, save failure feedback, encrypted files, timeline/variant switching, unseen explanation rotation/exhaustion, sourced matches, honest no-match queue, safe activity with why/return, pause-based quiz and answer merge. Exercised by unit tests and browser journeys, not inferred from buttons. |
| Implemented | Captions, controls, sequencing and cached narration. Browser voice tests decode actual MP3s and check advancing playback time with networking disabled; synthesis fallback uses unit fixtures. |
| Implemented, simulated | Fixed-source generation, teacher approval/export, seeded histories, heatmap updates, descriptive variant counts and previous-cohort nudge. Full journey verifies 12/18 → 13/19 after importing progress. These are not live AI or causal effectiveness measurements. |
| Incomplete vs broader brief | A and B have the same question bank; distinct personalized predicted questions are not demonstrated. `localLessonGenerator` clones the bank and changes the route only. |
| Incomplete vs broader brief | Explanation text varies, but `Visual` takes only `conceptId`, so variants share a diagram. Different visual-aid versions and their comparisons are not demonstrated. |
| Incomplete / bounded demo | Generation rejects arbitrary sources; teacher review is acknowledgement rather than an editor. Teacher drafts/imports disappear on reload. Fixed one-question return works through deliberate files, not automatic reconnect. |
| Missing | Automatic sync, general source-grounded online answering and online intent classification. Connected mode uses the same local matcher/audio path; the network indicator does not add these services. Greater online smoothness has not been measured. No backend is required for the accepted file-based demo. |
| Missing tooling | No lint script/configuration or committed CI workflow. Type-checking and tests exist; neither should be presented as a lint run. |
| Unverifiable here | Physical low-end Android installation, storage eviction, performance, microphone recognition, real local synthesis and Nigerian-accent/narrator suitability. Mobile Chromium emulation and synthesis fixtures do not prove these. |
| Intentionally deferred | Automatic teacher speech following, exam mode, local-language models, answer notifications, owner view and local-network transfer have named `available:false` interfaces in `sprint.ts`. Preserve them; `docs/scope.md` says not to build them. |

## Fresh verification

Windows, Node 24.14.0, npm 11.9.0. Caches/temp files were directed to D:; expensive
checks ran sequentially. Existing dependencies/browser were reused.

| Command | Result |
| --- | --- |
| `npm.cmd test` | Passed: generated types current, `tsc --noEmit` passed, 308 tests across 8 files. Matcher: 0 false positives among 11 negatives in a 17-query suite; this is not a general language-quality benchmark. |
| `npm.cmd run test:e2e` | Both production builds passed. Browser suite: **12 passed, 1 failed**; complete main journey exceeded its default 30-second test budget while awaiting returned-answer visibility. |
| `node node_modules/@playwright/test/cli.js test tests/e2e/full-demo.spec.ts --grep complete --timeout=90000 --output=test-results/audit-targeted` | Unchanged main journey passed in 26.6 seconds. This supports a timing/headroom diagnosis, but does not turn the standard failing run into a pass. |
| `npm.cmd run pipeline -- --lesson fixtures/demo-lesson` | Passed: valid simulated `light-and-refraction` package. |
| README teacher `npm.cmd run preview --workspace @coteacher/teacher ...` | Failed: **Missing script: "preview"**. Teacher package defines only dev/build. Test servers use Vite's preview API directly and are unaffected. |
| Lint | Not run: no available lint command/configuration; no dependency added for the audit. |

Original timeout artifacts remain under
`test-results/full-demo-complete-school--e32c7-and-simulated-answer-return/`
(`error-context.md`, screenshots, `trace.zip`). The targeted run uses its own
output directory. Prior 13-pass statements in sprint documents describe earlier
runs; this audit records the current result explicitly.

## Risks, blockers and smallest next order

1. **Repair handoff reliability.** Correct the teacher preview recipe/script with
   existing Vite, investigate timing and budget the long journey explicitly.
   Acceptance: documented previews start and standard checks pass. These two
   issues are the immediate blockers; no broken core behavior was demonstrated.
2. **Verify on Android.** Serve the production build over HTTPS at the origin root;
   collect, install/reopen offline, switch profiles, check speech fallback/audio,
   interrupted activity and exports. Worker/audio URLs assume root hosting;
   development mode has no worker. Dependency: a target device and secure hosting.
3. **Close content gaps if required for judging.** Reviewed sourced visual variants
   and per-profile questions come first; reuse `visualAssetPath`, selection and
   matcher contracts, then rendering, regenerated clips and acceptance assertions.
   Keep the objective fixed. Propose schema changes only if existing fields fail.
4. **Persist teacher data only if continuity requires it.** Reuse native storage
   and validators, preserving approval and snapshot semantics. Otherwise keep the
   teacher tab open and disclose the limit.
5. **Keep broader online answering separate.** Reuse `QueuedAnswerProvider` and
   answer merging; define approved sources/no-answer behavior before expansion.
   Paid AI, automatic sync and production authentication are unnecessary for the
   accepted one-lesson file-based demo.

Source-reference validation checks identity/structure, not whether prose is
factually entailed by a source; curated content and teacher review supply that
assurance. Public demo PINs are not production identity protection. Browser
storage remains subject to device eviction, and the generic narrator is not a
verified youthful student persona. Keep these limits visible in the demo.
