# Recorded lesson delivery and primary learner experience

The distribution/media evidence below remains current. The subsequent student
redesign separates Home/Library/Watch/Downloads/Progress/Profile; Watch Now on a
published card replaces the earlier Watch teacher’s lesson entry button. Transfers
and old prepared content are now secondary Profile tools. See
[student redesign verification](student-redesign-verification.md) for current UI
routes, screenshots, integrated help/activity/check flow and final test results.

## Implemented flow

The learner's primary experience is native playback of the actual captured
teacher audio with synchronized personalized SVG scenes. Notes, prepared
explanations, questions, activities and checks open as concept support when the
learner pauses. Returning continues the original recording from its saved time.
The older source-only fixture and existing saved notes-only lessons are explicitly
tucked under a compatibility demo. Reopening an existing notes-only profile shows
the recording entry point with notes folded away; explicit compatibility collection
or file import can still open the prepared material. Readiness for such packages
is labelled `Prepared-content demo ready offline`, never classroom-media readiness;
an empty service displays an error and never silently replaces a recording with
notes or synthesized speech.

Existing teacher preparation, presentation, AudioWorklet capture, WebCodecs Opus
encoding, sample-timed cues and independent audio/visual approvals are reused.
`Publish recorded lesson` reads the saved approved recording, creates the two
existing personal packages and explicitly submits them to the configured service.
The service revalidates publication, audio, sources and both visual manifests,
rejects source-only/seeded or unreviewed submissions, and requires the same
original recording and instructional content in both packages.

There was no distribution backend or cloud configuration in the repository.
The smallest working integration is a persistent loopback Node HTTP service.
It serves PIN-encrypted manifests and the actual original Ogg audio bytes, with
HTTP range support for native seeking. Vite dev and production-preview servers
proxy `/api`; the teacher proxy adds the publication token server-side. Successful
publication reports local delivery, never a cloud upload.

## Run and demonstrate

1. Run `npm.cmd run delivery:start`, `npm.cmd run dev:teacher` and
   `npm.cmd run dev:student` in separate terminals. For offline reopening, build
   and use the production preview commands in README instead of dev mode.
2. In the teacher workspace select the reviewed materials, generate the labelled
   simulated draft, review its sources and approve. Start Teach / projector.
3. Enable teacher-only recording, grant microphone permission and speak while
   advancing visuals manually. Pause/mute for discussion, resume and stop.
4. Replay the saved recording, check timing and privacy, approve the audio and
   review/approve both personalized sequences and prepared help representations.
5. In Prepare lesson choose Publish recorded lesson. This really saves the audio
   and paired encrypted manifests to the local service.
6. Unlock Student A (`111111`) and Watch teacher’s lesson. Play and seek: the
   matching concrete scene follows audio time. Pause to ask about that concept.
   Student B (`222222`) streams the same URL with ordered annotated scenes.
7. Download for offline use. The progress bar counts actual received bytes,
   then verifies and saves. Wait for download completion and Ready offline.
   Download B's manifest/media too; identical local audio is reused.
8. Disconnect, reload/reopen the PWA and unlock. Play, seek, pause for prepared
   help/activity/check and return to the recording. Lock/switch learners to verify
   their independent saved positions, questions and quiz attempts.

The delivery service starts empty until a teacher publishes; no canned classroom
voice is invented. Existing complete encrypted teacher-file exports remain a
fully offline distribution alternative.

## Package and synchronization

The encrypted manifest keeps the existing lesson ID, objective, original sources,
concept IDs, prepared timeline, classroom visit record, recording ID, duration
and captured cues. Each cue retains `offsetMs/timelineStepId/conceptId/sourceRefs`.
`visualAssets` stores all required reviewed declarative geometry, text and sources;
there are no remote images/fonts needed for these scenes. `playback.sequence`
chooses an actual visual asset for every captured cue. Explanations, the safe
activity, quizzes and the offline question bank are contained in the same package.

Remote audio is identified by `mediaUrl`, SHA-256, byte length, MIME/sample metadata
and a shared media key inside the encrypted manifest. Both learners address one
unchanged audio file. No transcription, speech following or MP4 rendering occurs.
The worklet's captured sample count omits paused time; resumed visuals are tagged
on that same clock. Native audio `currentTime` selects the last cue at or before
the current position, including seeks and equal-time pause transitions. Timed
highlights illustrate the concept, not individual spoken words.

Deterministic `prepared-support-rules-v2` uses two explicitly simulated histories:
A receives concrete ray/apparent-pencil diagrams; B receives ordered annotated
ray explanations. Insufficient history uses a reviewed default. The decision and
reason are inspectable; no trained recommendation model or fixed learning types
are claimed. Paused support uses exact audio time and that learner's own recorded
interactions, without editing the shared audio, objective or cue chronology.
Teacher review establishes compatibility with the recorded words; structural
checks cannot verify scientific truth or transcribe/validate what was spoken.

## Media and persistence

The service writes one content-addressed `.ogg` and atomically commits
`published.json` containing both encrypted manifests in `.coteacher-delivery`.
Restart reads and validates the index, media checksum and references. A publication
is unavailable until the complete pair saves. GET/HEAD audio supports byte ranges;
metadata and media are not silently precached by the service worker.

Opening a stream saves encrypted metadata and progress, with no offline-ready
claim. Download reads real response chunks, enforces complete declared length,
verifies SHA-256 and validates the actual Ogg framing/duration before saving.
IndexedDB commits binary AES-GCM audio and PIN-encrypted profile metadata together.
The content/key-derived media ID permits both profiles to share one encrypted
binary; the second download authenticates and reuses it without refetching audio.
Saved playback uses a local Blob URL. All visual geometry/help is local, and the
service worker precaches the full app and prepared help clips. Readiness requires
both successful package/media storage and an installed app shell. A failed,
incomplete or corrupt download keeps the streaming lesson and progress, reports
the error and offers retry. Existing missing/damaged local-media recollection
preserves progress and requires the same complete personal teacher package.

Independent encrypted profiles checkpoint recording positions every five seconds
and on pause/seek/lock. Restore seeks without autoplay. Lock flushes saves; profile
ownership/PIN validation and prior question/activity/check records are retained.

## Configuration and limits

Defaults: delivery `127.0.0.1:8787`, private directory `.coteacher-delivery`, public
demo publication token `local-demo-publisher`. Process environment variables:
`COTEACHER_DELIVERY_PORT`, `COTEACHER_DELIVERY_DIR`, `COTEACHER_PUBLISH_TOKEN`
configure the service; `COTEACHER_DELIVERY_URL` and the same publish token configure
Vite proxies. The app proxy can also read repo-root `.env.local`; the service CLI
reads process environment, so set matching shell variables for custom tokens.
No browser-bundled secret or arbitrary remote-media URL is added to a package.

This is one current published demo, not cloud storage, account authentication,
public-cloud sync, a production media CDN or hotspot distribution. The teacher
workspace extension now adds acknowledged local progress/answer return; see
[teacher workspace verification](teacher-redesign-verification.md). A static-only
deployment must configure an equivalent `/api` reverse proxy and deployed service
with HTTPS/authentication/storage; Vite preview proxy configuration alone does
not deploy a backend. Public hosting remains a configuration/deployment blocker.
The loopback service supports testing on this computer; physical Android delivery
needs a reachable secure deployment. Complete encrypted file import is available
without that service after loading the PWA shell.

Server audio is plaintext on disk; manifests are PIN encrypted. Public demo PINs,
the default demo token and random audio capabilities are not production security.
Local teacher review changes do not recall a previously published revision or
downloads. Republishing changes the capability and replaces the current manifest;
older streaming sessions can expire, while collected media remains available.
Superseded server audio files are not automatically purged. No real children or
classrooms are used in fixtures/tests. Browser capture cannot isolate voices.

Capture requires secure context/localhost, microphone permission, AudioWorklet
and a supported WebCodecs Opus encoder; current Chromium is the verified browser.
Safari, Firefox, physical microphone quality and low-end Android installation/
performance remain unverified. Autoplay may require a user gesture. Storage may
be full or evicted. Media is compressed mono at a 24 kb/s target, bounded to
20 MB, six hours and 1,000 cues; it has no two-minute cap. Download validation and
encryption use bounded in-memory buffers, and the demo server reads the bounded
file before responding to a range; these are not production large-media pipelines.

## Verification and changed files

Final automated results on 2026-10-09:

- `npm.cmd test`: generated types current, TypeScript passed, **363 tests in
  16 files passed**, including seven new persistent-delivery checks.
- `npm.cmd run test:e2e` built both production apps. Negative media tests wait
  for the actual completed profile lock before deleting/corrupting saved media;
  source-URL assertions wait for native media initialization. Earlier runs
  exposed those test races; they are corrected without mocking the player clock.
- Final `npm.cmd exec playwright test`: **all 27 scenarios passed in 3.7 minutes**
  using the current production bundles and actual local delivery service.
- The earlier truncated-download injection was moved from page routing to fetch
  response injection because an active service worker bypasses page routes.
  Successful streaming and downloads remain real HTTP; only negative cases are
  injected. The primary mobile recorded-player screenshot was inspected.
- Final TypeScript checks, demo package pipeline validation and whitespace checks
  passed. No schema or fixture is inferred to have verified the recorded words.

The local teacher dev server (`5174`), student dev server (`5175`), refreshed
offline-capable student preview (`4173`) and delivery service (`8787`) are running.
Both app proxies return the actual service health response with `cloud: false`.
The user-facing service remains empty until the teacher explicitly publishes;
automated simulated recording publications stay in isolated test directories.

The native browser journey in `tests/e2e/recording.spec.ts` invokes
`delivered-replay.ts`: native simulated microphone recording → saved sample cues →
review approvals → real HTTP publication → A stream → B stream with different
scenes → verified download → network disconnection → Blob audio replay and exact
concept help/check → resume after reload and tab reopening. It checks the original
audio bytes, decoded non-silent signal/duration, native advancing playback and
seeks, HTTP 206/416, actual download byte totals, one shared binary, independent
encrypted state and unchanged approved manifests. Truncated/checksum responses
and quota failures are injected only for negative download cases; successful media
comes from the real service. No speech synthesizer or mocked playback clock is
used. Audio input is Chromium's simulated microphone signal, not a verified human
teacher recording; physical voice quality requires a manual hardware check.

`distribution.spec.ts` verifies primary UI, honest empty-service errors, server
publication gates and existing notes-only records staying folded without losing
questions. `delivery.test.ts` checks paired manifests, original binary,
wrong PIN/capability, review/source-only rejection, persistence/restart, mismatched
recordings and corrupted/missing persisted media. Existing browser paths retain
legacy prepared-content coverage under the explicit compatibility option.

Primary changed files for this task: `schemas/lesson-package.schema.json` and its
generated type, shared validation, `delivery/{store,server,start}.ts`,
`apps/delivery-proxy.ts`, both Vite configs, teacher publication UI, student
`lesson-delivery.ts`, App/RecordedLesson/storage/media-storage/styles, package
scripts/tsconfig/ignore rules, the above tests and server setup. Documentation,
explicit compatibility test helper (`tests/e2e/compatibility.ts`), demo instructions
and PROMPTS.md record the behavior and limitations.
