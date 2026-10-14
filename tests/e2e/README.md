# Browser acceptance

`npm.cmd run verify:adaptive:live` performs the real-provider adaptive demo against
an isolated empty school service: native simulated teacher capture/approval,
actual A/B UI questions and checks, distinct evidence-based prepared help, local
memory without AI consent, downloads, closed-page offline reopening, backend
restart, real OpenAI return, repeated acknowledged uploads and teacher indicators/
recommendations. Configure the existing server key and build both apps first.
This explicitly incurs API calls; no learner events are injected into storage.
See `docs/adaptive-learning-evidence.json` and its verification report. Microphone
input is synthetic and physical phone/OS restart behavior is not established.

```sh
npx playwright install --only-shell chromium
npm run test:e2e
```

Use `npm.cmd` on restricted Windows PowerShell. The command builds both apps.
Global setup serves their production bundles in-process on ports 4273 and 4274;
it also starts a real persistent delivery service on an ephemeral loopback port
with an empty isolated publication directory. Teardown closes the HTTP servers
without spawning a process tree. Keep those
ports free. Run checks sequentially on memory-constrained hosts.

For the explicitly billable real-provider journey, build both apps, configure a
server-only `OPENAI_API_KEY` in `.env.local` or `.env`, and publish a reviewed demo
recording first. Run `npm.cmd run verify:tutoring:live`. This reuses the actual
student player/backend with an isolated copy of the publication. Only microphone
input is simulated; GPT-Live WebRTC, Responses, speech and school receipts are
real. The probe checks two-turn context, understanding/quiz/resume, prepared offline
answers, queued questions across restart/reconnect and independent consent/records.
Evidence is saved in `docs/tutoring-journey-live-evidence.json`; screenshots are in
`docs/screenshots`. It does not prove physical microphone or Android behaviour.

Service workers are enabled. The full demo tests collect an encrypted teacher
export, disable networking, reopen the app, restore an interrupted activity,
match and queue questions, take a pause-based quiz, export progress, switch
learners, import teacher progress, update aggregates, and return a sourced
simulated answer. A second path closes the tab and reopens it offline after
bundled collection. Student application network APIs are blocked in the main
journey and legacy player tests after collection. Connected empty-home catalogue
discovery is acquisition, and is tested separately against the actual service.
Browser requests for cached assets are expected
during offline navigation; those assets must be served by the worker.

Student screen tests cover PIN failure, the authenticated greeting, separate home,
library, downloads, progress and profile routes, browser-back and keyboard
navigation at 320, 360, 768 and 1440 pixels. Compatibility helpers explicitly open
the secondary Profile transfer/prepared-content route. The native recording test
also streams the real publication through the immersive player, checks speed and
fullscreen, captures real-library/mobile/desktop screenshots, verifies personalized
SVGs and complete downloads, then performs contextual help, the safe activity,
incorrect/correct checks, question saving, offline restart and independent profiles.
Both legacy and new player chunks/fonts are included in the PWA precache.

Teacher screen checks reuse the student visual system at 320, 360, 768 and 1440
pixels. They exercise guided uploads, invalid file feedback, persisted preparation,
concept review, approval, studio navigation, heatmap selection, question filters,
publication readiness, keyboard focus and reduced motion. The native recording
journey additionally checks the Default/A/B preview on the same audio clock and
the real progress-return service: offline questions/events, rejected malformed
acknowledgement, genuine durable receipt, both isolated learners in teacher
insights, approved prepared answer return and encrypted restoration after reload.
Chromium's offline emulation reports online after cached navigation; the test
emits a reconnect event only after restoring transport. All successful publication
and progress-return responses come from the real isolated HTTP service.

Presentation tests block teacher speech APIs, record actual forward/backward
display visits, verify the projector view and persistent position, compare
approved content before/after teaching, export both learner routes with identical
classroom records, and open the exact recorded concept with networking disabled.
The source explanation, diagram, lesson ID, concept ID and timeline step all match.
Save failures and reapproval invalidation are covered as well.

Dedicated help tests also block student network APIs. They cover the brief's
natural wording, unseen text rotation, manual/refresher viewing history,
exhaustion actions, suffix matches/no-match queues, question near-misses, offline
reload and independent histories for both profiles.

Voice tests use real, decoded, cached MP3s with networking disabled. They check
advancing playback time/duration, captions and sources, pause/resume/replay/speed,
each Try it instruction, preparation sequencing, correct/incorrect quiz feedback,
matched/no-match answers, microphone fallback, offline reload and profile locking.
Synthesis fallback is unit-tested with local/remote/late voice fixtures; no real
browser microphone or installed synthesis voice is assumed. Captions mean some
text appears twice; content assertions scope to the relevant caption or card.

On Windows, TEMP, TMP and npm_config_cache may be pointed at `.task-tmp` on the
workspace drive before running tests. Audio generation keeps WAV intermediates
inside `pipeline/.narration-*` and removes only that verified temporary directory.

Additional checks cover wrong PINs/profiles, corrupted files, unsupported
materials, duplicate imports, storage failure, touch targets, keyboard controls,
320px layouts, and deterministic unavailable-speech typing fallback. Separate
unit tests exercise the local-speech adapter without assuming a headless browser
has a real microphone or local model.

Failures retain traces/screenshots under ignored `test-results`. The main journey
also saves student and teacher screenshots for visual review. Run `npm test` for
contracts, generation, matcher, speech, encryption, and progress merge checks.

Mobile Chromium emulation is not a physical low-end Android performance or
installation test. That check remains explicitly unverified without a device.

Recording tests enable Chromium's fake microphone and permission dialog flags:
the real getUserMedia → AudioWorklet → streaming WebCodecs → Ogg Opus → native audio playback path runs with
simulated input. No physical microphone or people are recorded. Checks cover
pause/mute and active sample time, manual transitions and exact IDs, draft restore,
native seeking/synchronized playback, separate review approval, both encrypted
exports, rejected unreviewed learner audio and offline replay/exact concept study.
The permission rejection is injected as NotAllowedError because the fake dialog
auto-allows; quota failures are injected only at IndexedDB writes. Existing voice
tests still exercise the separately cached generic narration clips. The recording
journey now reviews both personalized visual sequences, plays both profiles,
checks one shared encrypted media row, blocks incomplete collection, disconnects,
resumes after restart and restores missing/damaged audio without losing progress.
The Opus test bundles the actual encoder module using Vite's esbuild dependency,
feeds 121 seconds of simulated sine-wave PCM through the native codec, decodes it
and plays/seeks using native browser audio. No speech or media-clock mocks are used.

The recording journey also pauses A at refraction with a specific question,
checks an approved alternative representation and explanation, reloads offline to
restore both, completes that concept's check, and resumes the assigned visuals.
Encrypted snapshot inspection verifies exact recording/cue/source/timestamp IDs,
an unchanged manifest and no A help history in B's record. See
docs/visual-adaptation-verification.md for the two-layer personalization rules.
The same journey reconnects after offline verification and imports A's encrypted
help/quiz progress into the teacher workspace against the original recorded lesson.

Shared-device profile tests verify two independent questions, different quiz results
and exact activity instruction positions through offline locking, refresh and tab
reopening. They inspect real encrypted rows, reject wrong PINs and misplaced foreign
snapshots, compare A's complete saved record before/after B studies, and check that
selecting another profile discards authenticated media-recovery state. See
docs/shared-device-verification.md for the public demo PIN and single-tab privacy limits.

The activity-check journey covers explanation → safe prepared activity → completion
self-report → automatically targeted concept check, incorrect feedback and correct
retry. It blocks student network APIs, restores a pending check after offline reload,
inspects selected options/sources in encrypted progress, compares A's snapshot before
and after B's independent activity/check, and reopens A offline with its exact
attempt history and original concept. Physical execution and durable learning are
not assessed by browser automation. See docs/activity-check-verification.md.

The main native recording test now also publishes that captured, reviewed audio
through the actual teacher proxy and Node service, opens both personal streamed
manifests, verifies exact original audio bytes and audible decoded signal, tests
HTTP ranges and native seek/cue synchronization, and downloads the complete media.
The second profile reuses one shared encrypted audio row. With network disabled
and application network APIs blocked, it reloads/reopens the PWA, plays local Blob
audio, restores paused support, answers the exact concept check and resumes.
Truncated/checksum failures are injected at browser fetch responses (page routes
cannot intercept requests forwarded by the active service worker); the successful
stream/download uses actual HTTP. A storage-quota failure preserves streaming
metadata and progress and cannot claim readiness. A separate delivery-boundary
scenario verifies an empty service never substitutes notes, rejects unrecorded
publication and rejects publication through the student endpoint. Another
checks that existing saved notes-only profiles reopen folded, preserve questions
and distinguish prepared-content readiness from classroom audio. Legacy coverage
explicitly opens the compatibility section after unlock. See
docs/recorded-delivery-verification.md.

The native capture journey also tests contextual offline questions with transport
disabled and network APIs blocked: immediate prepared answers with citations,
two verbatim pending questions, exact recorded owner/concept/time, paused-close
position, offline history restoration and a separate B question at another cue.
Question history is checked within the lesson player rather than Progress. Unit
and service checks reject changing or removing the saved context on answer return.
See docs/offline-questions-verification.md.

The same native journey's delivered-replay helper verifies durable sync checkpoints,
stable unique event IDs, rejection of a malformed acknowledgement, real HTTP receipts
held while new local work is added, prefix acknowledgement, repeated sync, teacher
receipt and source-grounded prepared demo response. It checks the returned answer
inside the recorded player and reopens offline with A/B records and receipts intact.
Only delivery of real responses is delayed; no successful service response is mocked.
See docs/reconnection-sync-verification.md for the local-service and answer limits.

Teacher insights coverage keeps seed/received cohorts separate, inspects original
concept and recording-cue context, shows an incorrect-check contributor, tests
empty received records and opens the exact approved activity at 320, 360, 768
and 1440px. The native recording/reconnection journey verifies both received
learners' support signals and approved assets, unchanged seed totals and unchanged
teacher preparation when following a recommendation. Pure aggregation cases are
in tests/teacher-insights.test.ts.


Safety audit regression also attempts to import an encrypted lesson with altered
unsafe activity instructions and existing approval. Rejection preserves the prior
learner question through reload. The native offline recording journey now checks
320px readable approved visual annotations, SVG descriptions, 44px media controls,
keyboard opening/help focus containment, Escape focus/paused-position return and
mandatory typed input when local speech recognition is unavailable. No successful
voice recognizer or offline answer is mocked. See docs/sprint-safety-audit.md for
scope, remaining privacy/deployment risks and current check results.

The classroom studio now uses a dedicated visual-only popup, synchronized by
local BroadcastChannel. projector.spec.ts checks viewport-fit controls, clean
display/source linkage, offline forward/back/keyboard changes, fullscreen,
studio/display reload, close/reopen, lost closure notifications and blocked-popup/
unsupported-channel fallback. A guard on projector reload verifies zero microphone
requests. recording-lock.spec.ts rejects a competing recorder and a stale overwrite,
then checks explicit rerecord and lock release. The native recording scenario opens,
focuses, closes and reopens the projector during capture, checks 320px live controls,
and runs the full personal-package/real-service/offline/reconnection journey.
See docs/recording-studio-verification.md for current results and hardware limits.

lesson-motion.spec.ts verifies five-second classroom/projector motion, local
offline synchronization, entry transitions and reduced-motion static diagrams.
motion-assertions.ts checks watermark containment/text clearance and deterministic
native seeks at 0.8/5.8 seconds. The native recording test retains an intro long
enough to check a complete loop, compares frozen studio/projector clocks, and
reuses the exact captured audio through review, A/B delivery and offline replay.
Longer audio controls use the actual recorded timeline rather than assuming the
ten-second position always belongs to refraction. See docs/lesson-motion-verification.md.
# Progressive science explainers

The motion helpers now compare actual layer construction at 0.8, 4.5 and 5.8
cue-relative seconds, not only a phase attribute. Native capture retains full
cycles for both concepts. Both learner variants and offline replay produce early
and completed screenshot pairs. Reduced motion verifies complete static geometry
and labels. See docs/explainer-animation-verification.md for current evidence.

## Prepared speaking companion

The native microphone scenario calls companion-conversation.ts during actual
offline delivered playback. Only speech-recognition input is simulated. Teacher
audio capture, bundled companion MP3 decoding (including measured audio energy),
pause position, animated approved representations, questions, quiz records and
subsequent school receipts use real application paths. It also tests unavailable
recognition, exact spoken interruption, reduced motion and 320px/desktop layouts.
The longer scenario allows ten minutes for natural spoken turns and school replay;
it does not impose an arbitrary maximum recording duration. Real-device offline
recognition and physical microphone/speaker checks remain manual requirements.
