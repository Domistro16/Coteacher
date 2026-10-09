# Sprint phases and acceptance

The software proof of concept is implemented. This is one reviewed simulated
refraction lesson, not a general lesson-generation service. No paid API calls,
backend, or real children's data are used.

Verified on 2026-10-09 after personalized recorded replay and commit review: **334 unit tests across
12 files**, generated-type freshness and complete TypeScript checks, **22 browser
tests**, production builds for both apps and CLI demo-package validation. Browser
acceptance includes native simulated microphone capture, muted pause alignment,
saved draft/review, projector controls, synchronized playback/seeking, both personal
exports, unreviewed media rejection, exact offline recorded concept study, permission
denial/cancellation and failed-save retry, plus all previous demo journeys. Live
projector, recording review and learner screenshots were inspected. Native streaming
Opus encodes/decodes 121 seconds with audible signal and seeking past 120 seconds.
Both profiles play distinct reviewed scenes offline, share one encrypted media
record, resume independently, and recover missing/damaged audio without losing progress.
Media collection failure is atomic and cannot show Ready offline. See
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
| 3. Offline and profiles | Complete app-shell cache, encrypted IndexedDB snapshots, separate PIN profiles, safe import and save feedback | Offline reload, tab close/reopen, interrupted activity restore, wrong-PIN/profile and storage-failure checks |
| 4. Explanations and questions | Six command intents and unscripted matcher context, unseen text explanations, 40 cached narration clips, local synthesis fallback, captions/play/pause/replay/speed, sourced answers, typing/local input adapter, safe Try it | 61 help, 29 command/context and 14 narration unit tests; actual offline clip/quiz/activity playback; history/profile/exhaustion paths; matcher negatives and speech adapter tests |
| 5. Quizzes and return files | Pause-based quiz selection, progress events, encrypted transfers, one supported simulated queued answer, preserving newer local work | Quiz/merge/encryption tests and full answer-return browser journey |
| 6. Teacher insights | Heatmap, descriptive variant counts, previous-cohort nudge, deduplicated snapshot imports, named future interfaces | Aggregate updates, duplicate rejection, sourced return and UI inspection |
| 7. Verification and handoff | Automated full journeys, error scenarios, production builds, run instructions, prompt log | Unit/type/schema checks and full Playwright suite |

## Limits to state during the demo

- Only the supplied reviewed notes/activity sources are accepted by generation.
  Unsupported uploads produce an explicit error. Generation and answer return
  are local simulations, not live AI.
- The return-answer simulation supports “Should I use a glass cup for this
  activity?” with a citation to activity safety notes. Other questions stay pending.
- Voice input uses an already available local recognizer only; otherwise typing
  works. Spoken output uses approximately 1.3 MB of cached generic system-voice
  MP3 clips for the fixed demo. Text without a clip needs a local English
  synthesis voice; otherwise captions remain and unavailability is stated.
  Narrator style/accent suitability and real-device recognition/synthesis remain
  unverified. No teacher voice is imitated or cloned.
- Student snapshots persist encrypted on the device. Teacher sources, drafts and
  publication approval persist in localStorage; imported progress remains
  session-only, so reimport progress after reopening the teacher workspace.
- Teacher audio/cues persist in IndexedDB after stopping and need separate audio
  and personalized-visual review before export. New Opus media is limited to 20 MB,
  six hours and 1,000 cues; the transfer limit is 48 MB. Unfinished audio is
  lost on a tab crash/forced refresh. The browser cannot isolate teacher voices;
  use a close microphone, pause for discussions and review privacy. Physical
  microphone capture and Safari/Firefox/low-end Android behavior remain unverified.
- The demo PINs are public fixtures. Encryption is a working transfer safeguard,
  not a production authentication or security claim. PIN recovery is out of scope.
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
