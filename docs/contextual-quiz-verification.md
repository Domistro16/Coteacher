# Contextual personalized quiz modal verification

The requested quiz opens in a native modal on spoken or typed quick-check
acceptance. The floating tutor and native recorded player remain mounted; capture
stops, keyboard focus stays in the quiz, Escape returns to the conversation and
Return to recorded lesson resumes the saved playback point.

Checks use the unchanged original question rather than the generic quiz at the
paused cue. The existing school service derives support from received same-learner
attempts and explicit representation choices, and supplies the question, checked
answer, approved/curated excerpts, actual selected answers and shared objective
to the configured Responses provider. Guided checks have two choices; limited
history uses the standard mode; two recent correct attempts may offer a new
supported example of the same objective. These observations are provisional,
not learning types or proof of mastery. The modal shows the original question,
source passages and a short explanation of the support chosen.

Optional checks and append-only attempts persist in the existing encrypted tutor
snapshot and school file. Attempt identities cannot be edited; correctness must
match the saved check. Local attempts survive returned states, refresh and offline
use. Teacher tutor oversight shows check content and actual selected answers.
The progress ledger/schema and server prefix/answer safeguards were not relaxed.
No lesson package, recording, existing answer clip or learner history was reset.

Already saved checks work offline, with locally saved attempts. An uncached
question gets an honest unavailable state rather than an unrelated prepared quiz.
With no conversation question, the original approved concept check is available.
Activity completion still opens its approved concept check. Generated question
speech uses one Coral request without the explanation understanding prompt;
missing audio leaves the sourced question readable. Late preparation while the
window is unfocused stays silent until explicit playback.

## Evidence

- `npm.cmd run generate:types` / `npm.cmd run check:types`: **PASS**; optional
  additions keep legacy encrypted tutor records valid.
- `npm.cmd run typecheck`: **PASS**. Both app builds **PASS**, with existing
  bundle-size advisories. The final rebuild contains the copy/focus refinements.
- `npm.cmd exec -- vitest run tests/contextual-quiz.test.ts tests/companion.test.ts
  tests/adaptive-memory.test.ts`: **20 PASS**. Identity/source/index rejection,
  actual-answer support, profile isolation, encrypted restart, immutable attempts
  and no appended understanding prompt for check speech.
- `npm.cmd exec -- vitest run tests/tutor.test.ts tests/progress-sync.test.ts
  tests/profile-storage.test.ts tests/recorded-adaptation.test.ts`: **40 PASS**.
  Existing consent, source checking, stale history recovery, profile validation
  and recorded adaptation remain covered.
- `npm.cmd exec -- tsx .task-tmp/verify-contextual-quiz.ts`: **PASS**, with
  production UI, IndexedDB, complete native media download and actual encrypted
  school HTTP synchronization. Microphone/live transport and generation are
  mocked. Browser networking is disabled for cached use, with an explicit offline
  status across service-worker reload; this is not a physical airplane-mode test.
  The native modal, source display, Tab/Escape behavior, unchanged desktop player
  dimensions, 360 px layout, stored attempts, resume, A guided/B standard support,
  offline reuse/reload and no unrelated fallback all passed. Source check posts
  returned HTTP 200. Transient concurrent HTTP 409 responses retried successfully.
  See `contextual-quiz-ui-evidence.json` and `.task-tmp/contextual-quiz-*.png`.
- `npm.cmd exec -- tsx .task-tmp/verify-contextual-quiz-provider.ts`: **PASS**.
  Two configured real Responses calls returned HTTP 200 with request/response IDs.
  The lens check tested bending passing light; the pencil check distinguished
  apparent bending from a physical change in the pencil. Both passed supplied
  quote/source/shape checks. This is provider-level text generation with simulated
  evidence, not a human microphone/speaker or live UI test. See
  `contextual-quiz-provider-evidence.json`.

An initial browser run timed out during initial download/sync contention before
testing the quiz. Setup now waits for a real tutoring acknowledgement. Subsequent
runs found and fixed modal Tab wrapping; a browser callback closure was corrected
in the test harness. The older expanded alternatives menu had a pointer occlusion
at a narrow width; the requested spoken/typed acceptance paths were verified
without redesigning that unrelated menu. Offline-status handling in the harness
was explicit to avoid counting a cached reload as connection proof. Earlier FAIL
runs were not reported as passing evidence.

Quote/source-reference checks verify supplied context, not every factual claim or
future generated question. Existing operator-confirmed hearing and teacher
recording/visual timing remain recorded as PASS for their tested setup. Human
verification of the newly requested modal and generated question audio remains
UNVERIFIED. Overall hackathon rehearsal remains PARTIAL.

The live backend process was verified through its current loopback listener and
D:\Coteacher delivery/start.ts command before restarting only that service.
Encrypted school records were copied to a local baseline first. After restart,
publication, 40 received events, ten questions, saved live history and downloaded
answers/audio were retained. The new check endpoint rejects a malformed probe
with HTTP 400 before any lesson/provider action. All three service URLs returned
HTTP 200. Student `index-CVFIIJos.js` and `StudentPlayer-DxRZgnbg.js` matched the
final build byte for byte. See contextual-quiz-service-evidence.json. The teacher
and student preview processes were not restarted; no browser data was cleared.
