# Sprint phases and acceptance

Visual-motion verification on 2026-10-12: **400 unit tests / 21 files** and
**42/42 browser scenarios** pass, alongside contract/type checks and both builds.
Five-second instructional SVG cycles, cue-relative play/pause/seek, captured-sample
studio/projector timing, smooth entries, reserved watermarks and reduced motion
reuse the original lesson/audio/variant data. See
[motion verification](lesson-motion-verification.md) for files, evidence and limits.

The software proof of concept is implemented. This is one reviewed simulated
refraction lesson, not a general lesson-generation service. No paid API calls or
real children's data are used. A persistent loopback service now publishes and
streams the reviewed teacher recording; cloud/public hosting is not configured.

The teacher product workspace now matches the student brand and separates
dashboard/library, guided preparation, recording, synchronized default/A/B review,
publication readiness, concept insights, questions, transfers and settings.
The same local service now durably acknowledges encrypted progress and returns
reviewed prepared answers. Both manual transfers and independent offline student
records remain intact; teacher received records persist encrypted across reload.

The 2026-10-11 classroom studio additionally separates the teacher controller
from a clean same-origin projector window. Local display sync needs no internet;
viewport-fit controls and sample-timed recording/review/personal packages remain
connected. See [studio verification](recording-studio-verification.md) for tests,
changed files and real microphone/physical display limitations.

Studio verification on 2026-10-11: **396 unit tests / 20 files**, current contracts,
TypeScript, both production builds and demo package validation pass. All **40
browser scenarios** pass in the full regression; the final projector run passes
3 cases including one additional missing-close-message scenario (41 distinct
scenarios verified across those runs). Native microphone capture uses simulated
test input; actual human speech and a physical projector remain manual checks.

Verified on 2026-10-10: **396 unit tests across 20 files**, generated types and
TypeScript, both production builds, sourced fixture validation and **37 browser
scenarios** across the complete regression and corrected upload-test rerun. Additional production 320px native
capture/review/fullscreen playback verifies the final mobile control polish.
See [teacher workspace verification](teacher-redesign-verification.md) for
screens, changed files, actual/simulated integrations and outstanding account,
general-authoring, cloud and hardware limits.

The [safety/accessibility audit](sprint-safety-audit.md) adds reviewed-demo content
comparison at collection/publication boundaries, readable approved visual notes,
SVG descriptions and accurate privacy/data-flow wording. Offline media/help,
independent profiles, real acknowledged sync and manual answer return are verified.
The report distinguishes local sprint readiness from production account/security,
cross-tab privacy, recorded-speech captions and untested physical-phone limits.

Class insights keep fabricated seed observations separate from received demo
events. Concept support counts include requests, incorrect checks, retries and
questions, with original classroom cue context and exact approved material links.
See [concept insights verification](teacher-insights-verification.md) for measures,
actual sync evidence, changed files and the final mobile accessibility checks.

Recorded questions now stay within the interactive player's help panel. Prepared
matches answer offline with sources; unsupported text is saved verbatim with the
exact owner, lesson, concept, recording and millisecond position. Encrypted queues,
contextual history, paused closing and independent A/B restoration pass the native
offline journey. School ingestion and answer return reject altered question context.
Reconnection does not guarantee an answer; free-form AI resolution is unconfigured.
See [offline question verification](offline-questions-verification.md).

Reconnection now retains stable learner event UUIDs and encrypted received-prefix
checkpoints. Failed acknowledgements leave work pending; late valid receipts keep
newer local events/questions. Both learners' offline checks, real receipt retry,
teacher response return and offline answer reopening pass. Deferred answers remain
one explicitly labelled prepared simulation without an external AI service. See
[reconnection sync verification](reconnection-sync-verification.md).

The student product redesign now separates Home, My Lessons, Watch, Downloads,
Progress and Profile. Contextual help/activity/checks use a focused learning modal;
school transfer and old prepared content are secondary Profile tools. The teacher
workspace now reuses this brand; see teacher-redesign-verification.md. This earlier
student phase was verified
on 2026-10-09: **363 unit tests**, generated types/TypeScript, both production
builds, sourced fixture validation and **31 browser scenarios** including native
recording/publication, personalized playback, complete download, disconnected
restart, help/activity/checks, independent profiles and 320–1440px layouts.
See student-redesign-verification.md for current routes, files, evidence and limits.

Verified on 2026-10-09 after the primary player/delivery extension: **363 unit tests
across 16 files**, generated-type freshness and TypeScript checks, both production
builds and **27 browser scenarios in the final complete regression run (3.7 minutes)**.
The recorded journey verifies native simulated microphone capture, approval, real
HTTP publication/streaming/range seeking, meaningful A/B scenes on identical audio,
verified downloads, one shared encrypted audio row, failed-download handling,
legacy-progress preservation, offline replay/help/check/resume and reopening.
See recorded-delivery-verification.md for commands, changed files and limits.
Activity acceptance still verifies safe instructions, reported completion,
pending-check restoration, wrong/correct retries and independent histories.
Earlier recorded-help acceptance also verifies exact sourced support and return to
the same recording. Browser
acceptance includes native simulated microphone capture, muted pause alignment,
saved draft/review, projector controls, synchronized playback/seeking, both personal
exports, unreviewed media rejection, exact offline recorded concept study, permission
denial/cancellation and failed-save retry, plus all previous demo journeys. Live
projector, recording review and learner screenshots were inspected. Native streaming
Opus encodes/decodes 121 seconds with audible signal and seeking past 120 seconds.
Both profiles play distinct reviewed scenes offline, share one encrypted media
record, resume independently, and recover missing/damaged audio without losing progress.
Media collection failure is atomic and cannot show Ready offline. See
activity-check-verification.md, visual-adaptation-verification.md, shared-device-verification.md,
personalized-replay-verification.md, presentation-verification.md and
teacher-preparation-verification.md for changed files, tests and limits. Matcher
tests retain **0 false positives among 11 negative queries**. Browser-server cleanup
exits normally on Windows.

| Phase | Delivered | Acceptance evidence |
| --- | --- | --- |
| 1. Contracts, content, design | Versioned lesson/progress/encryption contracts, generated player-state type, distinct routes, labelled simulation, green/cream responsive UI and SVG diagrams | Contract/fixture tests; mobile and teacher screenshots reviewed |
| 2. Teacher preparation | Reviewed-source upload/preview, lesson identity, sourced concept reviews, persistent drafts/approval, enforced publication gate, encrypted exports, projector cues, generation CLI | Unit approval/storage checks; teacher refresh/reopening, failed-save/draft rejection and teacher-to-student browser transfer |
| 2a. Classroom presentation | Approved-only manual start/controls, sourced projector view, persistent display visits/current step, shared classroom timeline in learner exports, exact offline step selection | Presentation unit checks and two classroom-to-learner browser journeys; content remains unchanged, both routes revisit identical IDs/wording/visual/sources |
| 2b. Teacher audio | Explicit permission-gated microphone capture, sample-timed visual cues, pause/mute, stopped audio saved with timeline, synchronized review and independent media approval, offline learner replay/exact step study | Eight recording unit checks and four browser journeys using a simulated microphone; native capture/playback, review/export/rejection, save recovery and late-permission cancellation |
| 2c. Personalized recorded replay | Streaming mono Opus without the two-minute cap, separately reviewed diagram/annotation sequences, embedded offline assets, shared encrypted binary media, video-like synchronized stage, exact-concept help and separate saved positions | Five personalization unit checks, native 121-second encoder/decode/seek check, full teacher-to-A/B offline/restart journey with quota/missing/corrupt media recovery |
| 2d. Recorded help adaptation | Inspectable history/preference/default decisions, all approved representations packaged for paused help, exact audio-time confusion input, source-linked saved selections, concept checks and return to unchanged recording | Seven new unit checks; native offline help/check/resume after reload; stored cue/source/position inspection and independent A/B histories |
| 2e. Primary recorded playback and delivery | Recorded player first, paused study support, real local publication/HTTP ranges, encrypted personal manifests, byte-count/checksum download, atomic offline storage and shared audio reuse | Native recording-to-publication-to-A/B-stream-to-download-to-offline/reopen/help/resume; legacy-progress preservation, incomplete/corrupt/quota failure checks and persistent service tests; see recorded-delivery-verification.md |
| 3. Offline and profiles | Complete app-shell cache, encrypted IndexedDB snapshots, separate PIN profiles, ownership checks before read/write, cleared recovery state on profile selection, safe import and save feedback | Offline A/B questions, different quiz results and exact activity positions survive switch/refresh/reopening; foreign rows and wrong PINs rejected; seven storage ownership checks |
| 4. Explanations and questions | Six command intents and unscripted matcher context, unseen text explanations, 40 cached narration clips, local synthesis fallback, captions/play/pause/replay/speed, sourced answers, typing/local input adapter, safe Try it | 61 help, 29 command/context and 14 narration unit tests; actual offline clip/quiz/activity playback; history/profile/exhaustion paths; matcher negatives and speech adapter tests |
| 5. Quizzes and return files | Pause-based quiz selection, progress events, encrypted transfers, one supported simulated queued answer, preserving newer local work | Quiz/merge/encryption tests and full answer-return browser journey |
| 5a. Activity understanding | Approved safe activity followed automatically by its exact concept check, separate completion/check status, sourced selected choices, append-only retries and original-concept links | Eight new unit checks; disconnected A/B journey with pending-check reload, wrong/correct feedback, encrypted attempt inspection and isolated tab reopening |
| 6. Teacher insights | Separate seeded/received cohorts, concept support heatmap, inspectable events and recording cues, descriptive variant/check use, approved material suggestions | Eight aggregation tests; received A/B sync, stable source totals, exact activity review and 320–1440px browser inspection |
| 7. Verification and handoff | Automated full journeys, error scenarios, production builds, run instructions, prompt log | Unit/type/schema checks and full Playwright suite |

## Limits to state during the demo

- Only the supplied reviewed notes/activity sources are accepted by generation.
  Unsupported uploads produce an explicit error. Generation and answer return
  are local simulations, not live AI.
- Recorded visual choices use simulated difficulties and deterministic prepared
  rules. Help suggestions use the active learner's own viewed/explored history.
  Preference inputs are supported by the generation API, without a profile editor.
  Automatic package regeneration or learned visual-effectiveness models are future
  work. Importing recorded help progress requires its original teacher revision.
- The return-answer simulation supports “Should I use a glass cup for this
  activity?” with a citation to activity safety notes. Other questions stay pending.
- Voice input uses an already available local recognizer only; otherwise typing
  works. Spoken output uses approximately 1.3 MB of cached generic system-voice
  MP3 clips for the fixed demo. Text without a clip needs a local English
  synthesis voice; otherwise captions remain and unavailability is stated.
  Narrator style/accent suitability and real-device recognition/synthesis remain
  unverified. No teacher voice is imitated or cloned.
- Student snapshots persist encrypted on the device. Teacher sources, drafts and
  publication approval persist in localStorage; received progress snapshots now
  persist encrypted and are revalidated after reopening the teacher workspace.
- Teacher audio/cues persist in IndexedDB after stopping and need separate audio
  and personalized-visual review before export. New Opus media is limited to 20 MB,
  six hours and 1,000 cues; the transfer limit is 48 MB. Unfinished audio is
  lost on a tab crash/forced refresh. The browser cannot isolate teacher voices;
  use a close microphone, pause for discussions and review privacy. Physical
  microphone capture and Safari/Firefox/low-end Android behavior remain unverified.
- The demo PINs are public fixtures. Encryption is a working transfer safeguard,
  not a production authentication or security claim. PIN recovery is out of scope.
- No cloud bucket/public media deployment exists. Use the local recorded-lesson
  service or complete encrypted file exports. A deployed `/api` reverse proxy,
  HTTPS, production identity/authorization, storage and retention need configuration.
  The demo service stores teacher audio plaintext on disk and only one current
  publication, with public demo credentials; no cloud upload is claimed.
- Offline operation needs initial app/package collection and successful storage.
  The UI does not claim readiness after a storage failure. Browser storage can
  still be evicted by the device; recollecting is then necessary.
- No physical low-end Android phone was available. Mobile layout and offline
  behavior pass Chromium automation; phone performance, installation, and actual
  local speech remain unverified. A phone preview must be served over HTTPS;
  localhost is a secure-context exception on the development computer only.
- Automatic teacher speech following, exam practice, local-language speech models,
  notifications, school-owner views, and local-network transfer remain unavailable
  named interfaces, as required by sprint scope.

## Device check still to perform

On an available low-end Android device, serve the production student app over
HTTPS, install/open it, collect a lesson, and wait for Ready offline. Turn off
Wi-Fi/mobile data, close/reopen, restore both learners independently, finish the
activity and quiz, and export progress. Check readable diagrams, touch targets,
storage feedback, and typing when local speech is unavailable. Record device,
browser, installation result, and any delays; do not infer these from emulation.
