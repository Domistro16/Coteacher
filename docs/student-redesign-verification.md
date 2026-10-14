# Student experience redesign

Acceptance criteria for this vertical task: separate home/library/player/help/downloads/progress/profile screens; keep the real recorded audio clock, approved visual sequence, complete-media downloads, encrypted shared-device records, sourced questions/checks/activities, and school transfers; verify narrow mobile and desktop layouts plus the actual teacher-publication-to-offline-replay journey. No instructional or persistence schema changes are needed for navigation and presentation.

## Screens and files

The student app uses hash routes to keep the existing Vite/React PWA and its
offline navigation. Unlock always opens the active learner's home, including
after a refresh; continuing a lesson then restores that learner's exact position.

| Screen | Route | Implementation |
| --- | --- | --- |
| PIN login | Locked app | `apps/student/src/App.tsx`, real existing PIN/decryption checks |
| Home | `#/home` | `StudentShell.tsx`: actual profile label, original illustrated welcome, recorded lesson card and saved-position Continue Learning |
| Library | `#/lessons` | Real approved personal manifest; one-lesson subject filter, source-asset thumbnail, actual duration/availability |
| Watch | `#/watch` | `StudentPlayer.tsx` and immersive branch of the existing `RecordedLesson.tsx` |
| Context support | Modal on Watch | Exact native recording time, prepared explanation/visual choices, typing/local voice fallback, activity/check tabs |
| Downloads | `#/downloads` | Actual counted/verified download, saved media and PWA readiness, failure/retry feedback |
| Progress | `#/progress` | Saved recording position, concept/quiz attempt counts, reported activity completion, private pending/returned questions |
| Profile | `#/profile` | Actual label, session lock/switch, secondary school transfer and privacy/demo details |
| Old prepared content | `#/prepared` | Lazy `PreparedLesson.tsx`, retained for explicit compatibility and school-transfer regression coverage |

`student-ui.tsx` supplies original code-native decorative artwork, brand, SVG icons
and clock formatting. `student-theme.css`, `styles.css`, local `public/fonts` (two
Nunito TTF files and OFL licence), `public/icon.svg`, `public/manifest.webmanifest`
and `index.html` define the violet/orange/yellow/mint identity. Font data is about
251 KB combined. All assets are local, including dynamically loaded player and
compatibility chunks. The build's existing service worker precaches them.

The old student stylesheet is preserved as `legacy-styles.css`; the teacher's
stylesheet now imports that file. This prevents the student redesign from
changing the teacher dashboard. Shared replay visuals get an optional compact
caption mode; their approved instructional shapes and original teacher rendering
are retained. No domain schema, recording, source, lesson objective, approved
visual content or encryption format was changed for this redesign.

## Working functionality reused and integrated

An empty connected home retrieves and validates the actual PIN-encrypted personal
manifest from `/api/lessons/{learnerId}`. Downloaded profiles use their already
validated saved lesson and make no catalogue request. Failed discovery gives an
honest empty/error state. Cards are never fabricated, nor described as cloud data.
The application retains the single published lesson supported by the sprint's
existing distribution/storage model. Acquiring a new recording preserves compatible
existing questions, activity/check events and progress; incompatible replacements
fail visibly instead of erasing a saved lesson.

The player reuses the original native audio element, original recording bytes and
`recordingCueAt` clock. Each cue selects the assigned approved SVG asset by stable
step/concept IDs. Native time drives seeks, play/pause, +/-10 seconds, section
replay, saved position and the ten-frame-per-second illustration loop. Playback
rate and native fullscreen/expanded fallback are now accessible player controls.
Prepared diagrams have their existing animated highlights; this is an audio-plus-
timed-visual replay, not an MP4 and not word-level speech following.

Help reads native audio time after pausing, invokes `adaptRecordedMoment` and
`exploreRecordedVisual`, and leaves the audio element mounted. The native modal
traps keyboard focus, closes with Escape and returns focus. Explanations and
representation choices use only approved concept content; sources are folded
away from the main player. Exhausted alternatives are reported honestly.
Activities use the existing safe instructions and transition reducer, including
restoring an interrupted activity. Completion is self-reported, followed by the
same concept's source-linked check. Check attempts/retries append to the existing
profile's progress. Questions without a confident matcher result remain saved for
the existing school-return workflow. Returning to the recording preserves time
and restores the assigned sequence. Unsupported voice falls back to typing.

Downloads still count received bytes, validate length/checksum/container, and
save the original audio atomically in encrypted IndexedDB. Both profiles share
one encrypted audio binary and retain separate manifests/progress. A lesson is
Ready offline only after its complete local media and the PWA shell are ready;
streaming and development-only availability are identified separately. Failure
messages do not claim a completed download. School export/import and returned
answers remain under Profile, and the explicit old prepared-content screen.

The interface uses 44-pixel primary touch controls, keyboard focus indicators,
native range/select controls, original decorative SVGs, mobile bottom navigation,
responsive cards, restrained transitions and reduced-motion styling. No remote
font/illustration is required after collection. Player and old notes support are
split into precached lazy chunks to keep the main bundle below Vite's 500 KB
warning threshold.

## Verification

Verified on 2026-10-09:

| Check | Result |
| --- | --- |
| `npm.cmd test` | Generated contracts current, TypeScript passes, 363 unit tests in 16 files pass |
| `npm.cmd run test:e2e -- --reporter=line` | Both production builds pass; all 31 browser scenarios pass in the complete regression run (7.8 minutes on this host) |
| `npm.cmd run pipeline -- --lesson fixtures/demo-lesson` | Valid simulated, sourced demo package |
| `git -c core.safecrlf=false diff --check` | No whitespace errors |
| Final contrast adjustment | Secondary text contrast: 5.37:1 on white, 5.06:1 on the page background, 4.52:1 on the active chapter background; both final production builds and all four responsive screen cases pass (23.6 seconds) |

The four screen cases exercise 320, 360, 768 and 1440 pixels, actual PIN rejection,
separate greetings, keyboard navigation, a skip link that preserves the active
route, browser-back, all main screens, secondary transfer discovery, reduced-motion
rendering, empty/error states and absence of horizontal overflow. They deliberately
inject a 404 to isolate unavailable-lesson UI; they do not claim a mocked success.

The complete native microphone browser case prepares/reviews/approves the lesson,
captures a non-silent simulated microphone signal, manually advances the visuals,
pauses with the microphone muted, then saves/reviews/approves and publishes both
personal manifests to the real test HTTP service. It verifies range responses and
decoded original audio energy/duration, actual advancing native playback time,
A/B visual asset differences on identical original bytes, UI seeking/back/forward/
section replay, speed and fullscreen. It verifies incomplete/checksum/quota failure
states and real download byte completion before local readiness. Both learners
reuse one encrypted binary and preserve independent progress.

The disconnected/restart journey blocks application fetch/XHR/WebSocket APIs.
Local Blob-backed audio still plays/seeks/resumes with the correct cue/visual;
contextual help restores its selected representation and timestamp after restart.
The safe activity, incorrect/correct checks, saved question and returned answers
survive school transfer, profile switches and reopening. Missing/corrupt media
fails clearly and recollection preserves interactions. The existing recorded-media
test also verifies native capture beyond two minutes. Teacher preparation,
projector, legacy prepared narration, question matching, old progress and shared-
device security-boundary scenarios continue passing.

Initial test runs caught outdated single-page selectors, a normalized question's
punctuation expectation, and assumptions that a resumed/cleared help dialog would
still be open after media recovery. Those assertions now follow the new screens.
An immediate-visibility check raced hash navigation in the compatibility helper;
it now waits for the destination heading and saved-content summary. Recommended
AGENTS rule: after UI navigation, wait for a destination landmark before branching
on visibility, and use web-first assertions for asynchronous media initialization.
No underlying learner data was reset to make these checks pass.

Inspected screenshots of the populated mobile/desktop home and desktop player
are retained in `.task-tmp/student-home-real-mobile.png`,
`.task-tmp/student-home-real-desktop.png` and
`.task-tmp/student-player-real-desktop.png`. They come from the actual native-
recording/publication journey, with simulated microphone input and profiles.
The shared teacher appearance was also inspected in the native review/projector
captures. No physical Android test or human speech recording is claimed.

The final app shell is approximately 2.17 MB of uncompressed assets, including
prepared narration clips, local fonts and lazy chunks; classroom recording media
is stored separately. The main student JavaScript bundle is approximately 472.5 KB
uncompressed / 142.5 KB gzip. Local student development on port 5175, teacher
development on port 5174 and student production preview on port 4173 all return
HTTP 200; the preview's real `/api/health` identifies the local delivery service
and `cloud: false`. Use the production preview for offline reopening tests, and
publish an actual reviewed teacher recording before expecting a library card.

## Remaining limitations

- The local distribution service must contain an actual teacher-published,
  reviewed microphone recording. It starts empty; the redesign does not supply
  fabricated classroom speech or replace audio with TTS. Native automated tests
  use Chromium's simulated microphone signal, not real people or children's data.
- Only the existing one-lesson/two-simulated-profile model is supported. Profile
  labels are the authenticated display names. Teacher names are absent from the
  current contract, so the UI uses the role “Your classroom teacher”.
- Personalization is the existing deterministic prepared-support system, with
  two meaningfully different approved visual sequences. No trained recommendation
  model, live generation or speech following was added.
- Recorded speech captions/transcripts are unavailable. Approved written aids
  are not presented as transcripts. Existing narrated prepared-content captions
  remain in the secondary compatibility experience.
- The subsequent teacher workspace extension adds acknowledged automatic local
  progress/question return and retrieval of reviewed prepared answers. Manual
  school transfer stays in Profile. Public cloud synchronization remains
  unconfigured; connectivity alone is not a successful sync. See
  [teacher workspace verification](teacher-redesign-verification.md).
- Progress reflects saved playback position and actual interactions, not
  watch-attention tracking, permanent completion certificates or long-term mastery.
  The recording-finished count reflects the current saved end position; revisiting
  an earlier point changes it.
- Native fullscreen and local voice support depend on the browser. Current
  Chromium is tested; real Android hardware, Safari/Firefox, installation and
  performance remain unverified. Storage may be evicted; missing/damaged media
  still requires recollecting the complete personal package.
- Streaming works through the configured loopback backend. Public hosting still
  needs HTTPS, a deployed `/api` proxy, durable media storage and production
  authentication/authorization. Public simulated PINs are not complete device
  security. The existing backend stores one current publication and plaintext
  server audio; learner-side media and records remain encrypted.
- There is no lint script or configured linter in this repository. Generated
  contracts, TypeScript, builds, unit tests, browser tests and whitespace checks
  are the available checks.

Product inspiration: the approachable library/playback emphasis of
[uLesson](https://ulesson.com/); Coteacher's brand, artwork, layout and UI code
are original and no proprietary illustration/screenshot was used.
