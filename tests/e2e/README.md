# Browser acceptance

```sh
npx playwright install --only-shell chromium
npm run test:e2e
```

Use `npm.cmd` on restricted Windows PowerShell. The command builds both apps.
Global setup serves their production bundles in-process on ports 4273 and 4274;
teardown closes the HTTP servers without spawning a process tree. Keep those
ports free. Run checks sequentially on memory-constrained hosts.

Service workers are enabled. The full demo tests collect an encrypted teacher
export, disable networking, reopen the app, restore an interrupted activity,
match and queue questions, take a pause-based quiz, export progress, switch
learners, import teacher progress, update aggregates, and return a sourced
simulated answer. A second path closes the tab and reopens it offline after
bundled collection. Student application network APIs are blocked in the main
journey and legacy player tests. Browser requests for cached assets are expected
during offline navigation; those assets must be served by the worker.

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
