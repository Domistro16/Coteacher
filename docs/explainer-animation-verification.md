# Progressive science explainer verification

2026-10-12. This supersedes the earlier moving-highlight treatment documented in
lesson-motion-verification.md. The current science graphics are constructed in
ordered stages rather than displaying the finished drawing beneath an overlay.

## Implemented sequences

- Classroom straight path: source scales into place; the uniform-material label
  reveals; the ray draws from the source; its direction arrow completes; the
  direction label writes in.
- Classroom refraction: water and boundary arrive; air/water labels and the normal
  appear; the existing ray draws through its change in direction; the arrow and
  boundary annotation complete the explanation.
- Learner A straight path: source, drawn ray with travelling construction
  highlight, arrowhead, source/direction labels and the approved diagram caveat.
- Learner A refraction: water and boundary, the separate straight grey pencil,
  its grey annotation, the separate gold apparent path, gold annotation and the
  approved concluding explanation. The real pencil never bends or moves.
- Learner B: approved numbered instructions reveal in order while the straight
  ray or cross-boundary ray constructs, followed by the arrow and final note.

All sequences settle by 4.2 seconds, hold until 4.8, fade to reset and repeat at
5.0 seconds. These are illustrative teaching stages, not measured light speeds
or word-level synchronization with an inferred transcript. No instructional
wording, package geometry, source references, objectives or stable IDs changed.

## Shared rendering and clocks

Visual.tsx renders the original classroom graphics; ReplayVisual.tsx renders
the approved personalized catalog. Both use explainerMotion and the existing
cue-relative clock. ExplainerLayer reveals actual paths via normalized stroke
length, grows sources/media and writes text using SVG bounding-box clips.
Complete accessible descriptions and readable annotations remain available.

Native audio currentTime minus the active cue offset determines construction.
Pause freezes it; seek recomputes the same frame; playback speed follows audio.
The existing captured-sample clock and BroadcastChannel also drive studio and
projector without changing recorded cues or starting a second microphone.
Only visible standalone previews use a presentation clock. Existing ten-frame-
per-second updates limit rendering cost; no video, downloaded images or network
dependencies were added. Watermarks remain outside the animated content group.
Reduced motion shows the fully constructed diagram immediately with no loop,
reset fade or concept entry animation. Normal concept changes retain the keyed
240-ms fade/slide.

Longer browser capture exposed a pre-existing exact-seek floating-point boundary
issue: converting milliseconds to native seconds and back could select the
previous concept. recordingCueAt now tolerates only floating-point arithmetic
noise (four machine-epsilon units), not an earlier meaningful timestamp. Saved
cue timestamps are unchanged; a regression verifies both sides of the boundary.

## Changed files for this request

- apps/student/src/ExplainerLayer.tsx (new), lesson-motion.ts, lesson-motion.css,
  Visual.tsx and ReplayVisual.tsx.
- packages/shared/src/recording.ts: precise native cue selection.
- tests/lesson-motion.test.ts, tests/recording.test.ts,
  tests/e2e/lesson-motion.spec.ts, motion-assertions.ts, recording.spec.ts and
  delivered-replay.ts: construction, exact loops, media seeks and A/B/offline
  coverage; early/completed screenshot pairs.
- docs/explainer-animation-acceptance.md, this report, references in previous
  motion documentation and browser-test README; PROMPTS.md request/result log.

## Verification

| Check | Result and actual evidence |
| --- | --- |
| Complete construction and text reveal | PASS. Native player screenshots at 0.8 seconds show sources/partial labels with the ray absent; 4.5 seconds shows all geometry and labels complete. Browser assertions check actual ray opacity/dash offsets and removal of text clipping, alongside all layer progress. Inspected early/completed pairs for all four personalized assets and classroom projector refraction. |
| Five-second loop, pause and seeking | PASS. Units verify all catalog layers repeat at +5,000 ms and long recordings. Real native review/player seeks at cue-relative 0.8 and 5.8 seconds give identical construction frames. A paused frame stays unchanged; full geometry is present at 4.5 seconds. |
| Concept transitions and projector | PASS. Normal SVG entry fade/slide is active; reduced motion removes it. Offline next/back, popup close/reopen and studio/projector clock/frozen phase checks pass. |
| Studio, review and personalized student playback | PASS. Native microphone graph encodes non-silent seekable Opus, saves original cues through pause/back/resume, enters review, receives teacher approval and publishes through the isolated real loopback service. A/B receive different approved assets with the same recording bytes and objectives. |
| Offline, help and progress | PASS. Complete recording/visual packages are collected locally; source is a Blob rather than remote streaming. Networking is blocked, the production PWA reopens, seeks/replays both concept sequences, pauses for prepared help/checks and resumes. A/B progress remains separate; returned receipts/answers and teacher feedback use the actual local service. |
| Reduced motion and watermark | PASS. Classroom/projector show complete static ray and labels; no entry animation. Bounds checks prove one bottom-right watermark remains inside the SVG and below instructional text across teacher review and A/B playback. |

Final commands/results:

- `npm.cmd test`: **403 tests in 21 files pass**, including generated-contract
  check and TypeScript. 70.13 seconds.
- `npm.cmd run build`: both apps pass. Student main 486.98 kB / 147.31 kB gzip;
  teacher main 517.89 kB / 155.79 kB gzip. Existing teacher chunk-size advisory
  remains; it is not a build failure. No raster/video asset downloads were added.
- `npx.cmd playwright test`: **42/42 pass**, 9.0 minutes. Full native capture →
  review → approval → A/B packages → offline playback/help → restart → sync/
  teacher feedback scenario passes in 3.0 minutes using Chromium fake microphone
  input through the actual native capture/encoding pipeline.
- Final `npm.cmd run typecheck`: pass.
- `npm.cmd run pipeline -- --lesson fixtures/demo-lesson`: valid,
  `light-and-refraction`, explicitly simulated.
- `git diff --check`: pass after trimming two added documentation EOF blanks.
- No lint command is configured in this repository.
- Running teacher `http://127.0.0.1:5174/` and student
  `http://127.0.0.1:5175/` both return HTTP 200.

The initial targeted run passed four scenarios and failed at exact native cue
seeking in the longer recording. The precision fix above and its unit regression
are included in the final passing full suite. A strict TypeScript inference error
in the new ray helper was also corrected before final testing.

Screenshot evidence (generated in the final full browser run):

- `test-results/lesson-motion-studio-and-p-088df-reduced-motion-alternatives/`:
  `projector-refraction-building.png`, `animated-projector.png`.
- `test-results/recording-native-microphon-cd55a-h-personal-offline-packages/`:
  `explainer-{light-path-diagram,light-path-steps,refraction-pencil,refraction-steps}-{building,complete}.png`;
  live studio 320px and teacher review/student desktop/mobile screenshots.

Test artifacts are local, ignored by Git and replaced by future browser runs.

## Limitations

- Prepared SVG choreography and deterministic simulated learner variants remain
  explicitly prepared content; no new AI generation or speech-following exists.
- Synchronization follows concept cues, not individual spoken words. Loops may
  restart while the teacher is still discussing that same concept.
- Pausing during construction intentionally freezes the partial frame; accessible
  approved text annotations remain available. Reduced motion provides static full
  diagrams.
- Physical microphone, projector and low-end Android performance require manual
  hardware checks. Chromium fake microphone verifies the real browser encoder and
  audio pipeline, not human teacher speech or classroom acoustics.
- Existing installed PWAs must fetch the updated application shell while connected
  once before these new animations are available offline.
