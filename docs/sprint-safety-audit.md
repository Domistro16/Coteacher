# Sprint safety, accessibility and reliability audit

Audit date: 2026-10-10. Scope: the existing one-lesson, two-simulated-learner
hackathon journey. This is a repository/application audit, not a security
certification, formal accessibility conformance assessment or physical Android
device test. No real children's information or external AI service was used.

Additional mandatory recorded-playback verification is documented in
[the 15-requirement audit](recorded-playback-audit.md), with persisted test-run
metadata in [the evidence JSON](recorded-playback-audit-evidence.json).
The full software journey passes, but actual classroom readiness is **PARTIAL**:
human teacher speech and semantic agreement with its visuals remain unverified.
Simulated microphone input does not qualify a lesson as classroom READY.

## Material defects fixed

1. **Unsafe/unreviewed instruction could reuse approval.** New tests demonstrated
   that structurally valid edits to activity materials, steps or safety guidance,
   explanations, citations, quizzes, objectives and narration paths passed the
   old approval boundary. The shared collection/publication gate now compares
   instructional content with the supplied reviewed demo bundle. Optional
   narration must also match its prepared content. It allows existing personal
   routes, classroom timelines, recordings and reviewed visual sequences without
   changing instructional content. Import rejection preserves the saved learner
   record. Backend publication rejects the same edited activity.

   This is a bounded one-lesson allowlist, not an AI safety classifier,
   authenticated teacher signature or factual-verification service. Preparing
   arbitrary new instruction remains outside this sprint. The teacher still
   reviews facts, physical safety, recorded speech and classroom privacy.

2. **Visual annotation accessibility on narrow screens.** Some SVG labels become
   very small when the diagram scales to a phone. The main recorded player and
   paused concept help now expose the approved annotations as expandable readable
   text, with 16px notes and a 44px summary target. SVGs also have descriptions
   containing those annotations. The canvas now grows with expanded notes;
   fullscreen keeps notes scrollable and media controls visible. Thumbnails remain noninteractive. The notes are
   approved visual text, not a fabricated transcript of the teacher's recording.

3. **Overbroad privacy/capability wording.** Documentation and the secondary profile
   privacy panel describe device storage and transfer to the configured service,
   public demo credentials, optional local speech, manually prepared instruction
   and the absence of trained recommendations/external AI. School-exclusive data
   location is not promised for a future external-provider deployment. Small
   simulated check/variant observations do not establish effectiveness.

The student/teacher visual identity, existing navigation, databases, encryption,
recording, media storage, publication, transfer and sync APIs are preserved.

## Acceptance findings

| Area | Evidence and boundary |
| --- | --- |
| Narrow layouts | Existing screen tests cover 320, 360, 768 and 1440px; the recorded offline player additionally checks 320px diagram notes, no page overflow and 44px media buttons/seek target. |
| Accessible interaction | Named controls and SVG descriptions; semantic labels, keyboard navigation/skip links, modal focus containment, Escape returning focus without changing paused audio position, reduced-motion styles. No claim of complete WCAG conformance. |
| Offline playback | Production app shell, original captured audio, full visual manifests and prepared help/activity/check are stored locally; offline reload/reopen and local Blob playback are tested with transport disabled and application fetch/XHR/WebSocket blocked. Caching the interface alone is not marked ready. |
| Offline questions | Typed input works when speech recognition is unavailable. Prepared source-linked answers resolve locally; unsupported questions stay pending with exact text, learner/lesson/concept/recording/time context. Multiple questions persist independently. |
| Shared-device isolation | Wrong PIN/foreign snapshot rejection, separate encrypted A/B records, independent questions/checks/playback positions, exact restore and unchanged A records after B studies. Single active learner tab is required. |
| Safe instruction | Source and prepared variant references are validated. Teacher preparation accepts supported reviewed text sources; material revision invalidates approval. New shared-boundary tests prevent altered activity instructions reusing approval in collection or publication. |
| Recording and approval | Permission-gated microphone, visible status, muted pause, sample-count cue timing, real encoded audio review and separate visual review; unreviewed/missing recordings cannot be published or silently replaced with notes. Browser capture cannot isolate teacher and student voices. |
| Downloads/errors | Byte-length/checksum validation, full-media save and app-shell readiness are separate from connectivity. Missing/corrupt audio, truncated downloads and storage refusal show errors and preserve progress; retries are tested. |
| Reconnection | Actual local service validates attribution and persists before acknowledging a submitted digest. Failed/malformed receipts retain queued work; retry deduplication and delayed acknowledgements preserve newer local events. Returned answers retain owner/concept context. |
| Manual transfer | Existing encrypted progress import and answer return remain available in secondary transfer screens; invalid/duplicate/foreign files fail without claiming success. |
| Honest capabilities | Profiles, class seed data, prepared personalization and prepared deferred responses are visibly labelled simulated. Received demo interactions are separate from fabricated class totals. No external LLM, cloud speech, trained learner classifier, automated factual verification or proven mastery is claimed. |

## Verification

- `npm.cmd test`: **396 tests across 20 files passed**, including generated-type
  freshness and TypeScript. New content-boundary tests first reproduced eight
  failures before the fix. The first full run exceeded a 30-second budget in a
  long existing cryptographic sync scenario; its test-only budget is now 60
  seconds. The isolated rerun and final complete run pass; production timeouts,
  encryption strength and assertions were not weakened.
- `npm.cmd run build`: both production apps pass. Teacher main chunk is 505.69 kB
  minified / 151.45 kB gzip, producing the existing non-failing 500 kB warning.
- `npm.cmd run pipeline -- --lesson fixtures/demo-lesson`: reviewed simulated
  light/refraction fixture validates.
- Browser regression: **all 37 distinct scenarios verified**. The final broad
  run passed 36/37, including the complete native recording/offline/reconnection
  journey (2.7 minutes). Its remaining source-upload test raced a disabled input;
  after waiting for the first saved source and enabled second input,
  `npm.cmd exec -- playwright test --last-failed` passed that complete manual
  collection/offline/transfer/answer-return scenario (43.3 seconds). No failed
  scenario remains. The native journey also passed a targeted final run.
- During verification, screenshot inspection caught fixed-canvas clipping in the
  new notes view; the layout and visible-note/fullscreen assertions were corrected.
  Browser tests also needed a correctly serialized callback argument, a locator
  scoped to HTML notes rather than duplicate SVG text, and service-response waits
  matching the existing 15-second request budget. Answer-return persistence uses
  a 20-second test wait. Actual server responses were inspected; runtime timeouts,
  receipt validation, encryption and answer provenance were not weakened.
- `git diff --check` passes. Desktop/mobile screenshots were visually inspected;
  320px notes/fullscreen checks verify actual visibility, readable text, media
  controls and an offscreen unfocused skip link, rather than hidden text alone.
- No lint script or lint configuration is provided; lint was not claimed to pass.

Browser recording uses Chromium's simulated microphone input with the actual
AudioWorklet, native encoder, decoder and media playback. Tests compare original
audio bytes and non-silent decoded signal; they do not substitute speech synthesis
for the classroom recording or claim to have tested an actual human classroom.
Successful publication, streaming, downloads and synchronization use the actual
isolated loopback service. Explicit failure injections cover unavailable services,
corrupt/truncated media, storage refusal, malformed receipts and absent speech
recognition; successful responses are not invented.

## Remaining limitations and recommended fixes

Severity describes consequence outside the bounded synthetic-data demo; it is
not a claim of a demonstrated exploit in the tested single-tab journey.

| Severity | Limitation | Recommendation / sprint impact |
| --- | --- | --- |
| High | Public demo PINs/tokens, six-digit PIN entropy, no retry throttling or production teacher/learner authentication. Teacher audio is plaintext on the local service's filesystem; an unlocked session can access decrypted content. | Keep the sprint loopback-only with synthetic records. Require authenticated/authorized delivery, private credentials, retention/consent controls and protected teacher storage before real-school use. PIN separation alone is not security. |
| High | Other unlocked tabs are not locked on profile switching; concurrent writes to the same profile are not coordinated. Same-origin scripts/tools can read unlocked data. | Use one learner tab and explicitly lock before handing over the device. Add coordinated session locking and conflict handling before deploying shared-device accounts. |
| Medium | No captions/transcript of recorded teacher speech. Prepared visual notes/explanations are useful but not equivalent to the complete spoken lesson. | Supply a teacher-reviewed timed caption track for inclusive deployment. The player honestly reports unavailable captions; this audit does not claim full accessibility. |
| Medium | No public HTTPS/media hosting or school account provisioning is configured. Loopback on this computer is not an Android-accessible school server. | Configure a secure, authenticated deployment before a live phone demonstration. Current desktop/local-service demonstration works; public deployment is a separate prerequisite. |
| Medium | Physical low-end Android performance, battery use, browser/OS restart, storage eviction and real microphone quality are unverified. Larger recordings require multiple in-memory media copies during save/download. | Test an actual intended phone/browser and realistic recording length, including quota/eviction and interruption. Keep the sprint recording short; retain offline transfer/recollection recovery. Do not infer hardware performance from viewport emulation. |
| Medium | Browser recording requires supported secure-context audio APIs; optional local recognition depends on an installed browser model. | Capability errors must remain visible; typed questions are mandatory and tested. Verify recording on the chosen teacher browser before the demo. Other browsers/local languages are unverified. |
| Medium | Unexpected deferred questions do not receive arbitrary AI answers. The only automatic demo answer path uses an explicitly simulated, prepared, source-grounded provider; other questions remain pending. | Explain teacher review/manual return and do not promise an answer on reconnection. Any future external AI integration needs source grounding, review and data-flow disclosure. |
| Medium | Browser storage can be cleared/evicted; abrupt termination can lose changes not yet committed. Conflicting histories from multiple devices are rejected instead of automatically merged. | Lock/save before handover; keep teacher source/media and use school transfers where appropriate. Add backup/recovery and explicit reconciliation before wider use. |
| Low | One fixed manually prepared lesson, two simulated learners, small simulated class observations, limited source file support (.md/.txt). | Describe it as a bounded proof of concept. Future authoring requires a genuine review process for new sources/content, not relaxing the allowlist. No lasting-learning/causal claims. |
| Low | Teacher bundle exceeds Vite's advisory 500 kB chunk threshold. The student distribution currently totals 2,185,908 uncompressed bytes, including local fonts and prepared compatibility narration, before recording media. | Consider targeted lazy loading after profiling intended devices. This is a build-size measurement, not measured download cost or phone performance; no major bundling redesign was introduced. |

Offline learning still requires initial device access, complete setup/download,
storage and charging. School supervision and maintained distribution access
remain necessary; a PWA does not remove those access barriers.

## Unresolved sprint blockers

No open application blocker remains for the tested single-tab Chromium demo with
synthetic learner records and the configured loopback service. Initial complete
download/setup and teacher review remain prerequisites, not offline capabilities.
An educational demonstration needs a teacher's actual reviewed spoken explanation;
automated microphone tests deliberately use simulated input.

A live Android demonstration still needs secure hosting/service access and an
actual phone check. Real-school deployment remains blocked by the high-severity
access-control/privacy limitations above. A fully accessible recorded-speech
experience also needs reviewed captions; prepared visual notes are not a substitute.

## Files changed in this audit

- Shared safety boundary: `schemas/lesson-package.schema.json` (descriptive
  contract clarification), generated `packages/shared/src/generated/lesson-package.ts`,
  `packages/shared/src/reviewed-instruction.ts`, `packages/shared/src/publication.ts`.
- Readable visuals/privacy: `apps/student/src/ReplayVisual.tsx`,
  `RecordedLesson.tsx`, `StudentPlayer.tsx`, `StudentShell.tsx`, `student-theme.css`.
- Verification: `tests/approved-content-safety.test.ts`, `tests/delivery.test.ts`,
  `tests/e2e/distribution.spec.ts`, `tests/e2e/delivered-replay.ts`,
  `tests/e2e/full-demo.spec.ts`, browser test README.
- Documentation: this report, `docs/sprint-safety-audit-acceptance.md`,
  `docs/safety-and-data.md`, `docs/product-brief.md`, `docs/sprint-status.md`,
  root README and `PROMPTS.md`.

Earlier task changes and the user-owned `docs/technical-audit.md` were preserved.
