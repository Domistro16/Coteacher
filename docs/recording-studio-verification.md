# Classroom studio and dedicated projector verification

2026-10-11. This change preserves the existing sample-timed microphone recorder,
approved lesson content, stable IDs, recording/package contracts, local delivery
backend and student interface. No transcription, speech-following, substitute
speech synthesis, new AI or backend service was introduced.

## Implemented workflow

Approve materials → Teach / projector → Start presentation → Check microphone
access → Open projector display → enable teacher-only capture → Start audio
recording → manually advance/revisit visuals → Pause/Resume → Stop and save
recording → synchronized review → approve recording and personal visuals → publish.

The studio uses the existing Nunito, violet brand, button/focus styles and tokens.
Its 16:9 canvas, visual number/concept, compact timeline and navigation occupy a
viewport layout with the recording bar underneath. Microphone status and an MM:SS
timer remain visible; preflight instructions collapse during capture. Notes,
source references and visit history open in a secondary native dialog. Arrow
shortcuts exclude controls, text inputs, editable content and the notes dialog.
Focus studio is a single-screen controller layout, not the audience projector.

Check microphone access requests an actual browser stream and immediately stops
its tracks. It verifies access, not sound quality, and does not save media. Capture
requires explicit consent and browser microphone permission. Start is guarded
against repeated requests. A Web Lock prevents simultaneous same-lesson capture
in another window of the same origin. A fresh saved-recording check also prevents
a stale studio from silently replacing a take saved in another window.

Stop/save enters the separate existing review screen only after the IndexedDB
transaction completes. A failed write retains playable media, disables navigation
and approval/export, and offers Retry saving. Review still requires playback and
explicit recording/visual approval. Delete recording and rerecord returns to the
studio; no unreviewed take is automatically published.

## Genuine projector display

Open projector display launches a same-origin window at
`?projector=<existing classroom session ID>`. Its entry point mounts only
ProjectorDisplay and TeachingCanvas. It contains the approved educational visual,
concept title and classroom instructional words, with source IDs retained as
metadata. It has no sidebar, forms, microphone controls, source panels, audio
player or learner records. Move this window onto the physical projector/external
display; press F or double-click for fullscreen, and Escape to leave fullscreen.

BroadcastChannel carries derived display frames using the existing lesson,
session, timeline step and concept IDs. The projector does not write lesson state,
change concepts itself or request a microphone. There is no second/disconnected
lesson dataset. Hello/latest-state messages recover missed startup or reload;
heartbeat/closure messages show connection loss; reopening receives the latest
frame. The saved session ID survives studio reload. A missing closure notification
also expires the parent's heartbeat status rather than falsely staying connected.

Blocked popups or missing BroadcastChannel show explicit errors and offer Focus
studio. Channel communication is local and works while application networking is
disabled. Initial window/application loading still needs the local app server or
available assets; this does not add a teacher PWA offline-shell guarantee.

Opening, focusing or closing the display does not control capture. The previous
visibility-change auto-pause was removed so a projector focus change does not
interrupt the lesson. Teachers must explicitly pause before discussions and keep
their browser/device awake; browser/OS suspension is a different limitation.

## Audio and package integrity

The existing AudioWorklet counts accepted 48 kHz input frames and timestamps both
audio chunks and visual cues from that count. Paused frames are excluded and the
microphone track is muted. Backward transitions are recorded too. Resume marks
the currently displayed approved step at the same paused offset. The projector
does not supply wall-clock timing or add recording cues.

The encoder, Ogg container, saved recording fields and source-linked cue model are
unchanged. Only a local concurrency guard was added around capture startup/release.
Review seeks still select the last applicable cue; A/B packages preserve original
audio bytes, objective and chronology with their approved different visual IDs.
Complete download, shared encrypted media, independent progress, contextual help,
acknowledged synchronization and source-grounded simulated answer return are reused.
No persisted schema/type contract changes were needed for ephemeral display frames.

## Acceptance evidence

Browser tests use native Chromium capture/encoding/playback with explicitly
simulated microphone input. They do not verify a human teacher's speech or invent
successful server responses. Successful publication, streaming and progress return
use the actual isolated local Node service.

| Requirements | Evidence |
| --- | --- |
| 1–3: approved lesson, dominant canvas, visible controls | Approved-only entry and 16:9 geometry; preparation at 320×640, 768×1024 and 1440×900; live capture at 320×640. Control bounds fit the viewport, document does not scroll, instructional text stays within the canvas. |
| 4–7: advance, status/timer, microphone errors, pause/resume/stop | Native capture follows forward/back controls. Pause timer freezes, input is muted, resume restores it, stop ends tracks and saves. Permission denial/cancellation and storage failure remain tested. |
| 8–13: separate clean display, teacher control, sync/fullscreen | Real popup, no administrative controls or audio/microphone UI; source references preserved. Forward/back/keyboard changes arrive with network disabled. F enters fullscreen; Escape exits. Display and studio reload recover the current step. |
| 14–15: uninterrupted recording and fallback | Native capture remains active through focus, close/reopen and single-screen focus mode. Popup-blocked and unsupported-channel failures retain a usable controller and readable error. |
| 16–20: saved media, cues, pause/back timing, personal packages | Actual Opus audio decodes to non-silent signal; persisted cue order and equal paused/resume offsets pass. Both packages retain the approved recording/objective and different prepared scenes. |
| 21–24: synchronized review, seeking, approval, publication | Automatic review after successful saving, native play/seek changes concepts, explicit audio and both-visual approval, encrypted export and real service publication/learner playback pass. |
| 25–28: shared design, unchanged student UI, regression | Existing typography/styles/components reused. Student source files were not edited in this task; its production main bundle remains index-B7vQ6g0J.js. Full check results are recorded below. |

## Checks

- `npm.cmd test`: **396 tests / 20 files pass**, generated contracts current and
  TypeScript passes. Recording sample-clock, source/approval validation, package
  generation, delivery, persistence, personalization, questions and sync included.
- Both production apps build. Teacher was rebuilt after studio changes; the
  existing advisory 500 kB chunk warning remains (approximately 512 kB main JS).
- Initial browser checks reproduced caption clipping with an error message and
  unreliable Escape behavior; these were fixed. Subsequent checks reproduced the
  lost window-close status after studio reload; closure messaging fixed it.
- A recorder-lock test initially stopped its second take before usable audio was
  captured and correctly hit silent-media rejection. It now captures 2.2 seconds
  before stopping; no audio/publication validation was relaxed.
- The complete native recording/package/offline/reconnection scenario passed
  during targeted regression (2.7 minutes), alongside manual presentation and
  microphone/save/cancellation recovery. Final broader/projector results follow.
- Full browser regression: **40/40 pass in 8.4 minutes**, including the complete
  native capture/projector/review/publication/personal-offline/feedback scenario
  (2.8 minutes) and cross-window recorder exclusion/review/rerecord.
- Final projector checks on the rebuilt teacher: **3/3 pass in 27.6 seconds**,
  including zero projector microphone requests and lost closure-message recovery.
  This verifies **41 distinct browser scenarios** across the full 40-scenario
  run and the final projector run (two repeated cases plus one additional case).
  The initial lost-notice test did not actually suppress the normal closure
  message; its failure injection was corrected to drop only that message. Real
  startup/state/heartbeat transport and successful recovery are not mocked.
- Final TypeScript and `npm.cmd run pipeline -- --lesson fixtures/demo-lesson`
  pass. The fixture remains source-linked and labelled simulated.
- `git diff --check` passes. No lint script/configuration exists.

Fresh projector/studio screenshots are in
`test-results/projector-clean-projector--91a4b-oad-and-studio-reconnection/`:
`studio-ready-320.png`, `studio-ready-768.png`, `studio-ready-1440.png` and
`clean-projector.png`. Desktop, projector and live 320px screenshots from the
native run were inspected. Browser test artifacts are temporary and replaced by
subsequent runs; the final projector run replaces the full-run live screenshots.

## Files changed in this task

- Studio integration: apps/teacher/src/App.tsx, TeacherShell.tsx, Presentation.tsx,
  RecordingPanel.tsx, microphone-recorder.ts and main.tsx.
- Display implementation: new projector-channel.ts, useProjector.ts,
  ProjectorDisplay.tsx and TeachingCanvas.tsx.
- Styles: new recording-studio.css, imported by styles.css; obsolete inline
  projector CSS removed from teacher-theme.css.
- Tests: recording.spec.ts and presentation.spec.ts updated; new projector.spec.ts,
  recording-lock.spec.ts and studio-assertions.ts.
- Documentation: this report, recording-studio-acceptance.md, teacher README,
  architecture/demo acceptance, browser README/sprint status and PROMPTS.md.

Prior workspace changes, recordings and the user-owned technical-audit.md were
preserved. All browser test data lives in an isolated synthetic test service.

## Manual checks and limitations

- **Human recording and physical projector remain UNVERIFIED.** Record a teacher,
  listen for clear speech, review both variants against the actual words, extend
  the desktop to the real projector and confirm framing/latency/fullscreen.
  Simulated microphone tests are not a READY verdict for that classroom lesson.
- Physical Android, microphone hardware, background/OS suspension and extended
  recording lengths need device testing. Supported secure-context browser audio
  APIs, Web Locks and microphone permission are required. A mobile browser may
  open a tab rather than a freely positioned window; Focus studio remains available.
- Recording remains in memory until stop/save. A crashed/terminated teacher tab
  loses an unfinished take. A browser cannot isolate teacher speech from other
  classroom voices. Pause explicitly before student conversations.
- BroadcastChannel is same-origin only. The projector is not a remote casting
  or internet service. It does not automatically choose a monitor. Teacher assets
  must be loaded before an offline communication test; this is not teacher-shell
  precaching or fully offline initial bootstrapping.
- The capture lock prevents duplicate active recording in a single origin; it
  is not account security or a general multi-window teacher-editing conflict
  system. Existing demo credentials/auth/privacy limits remain in the safety audit.
- Sources, two learner histories and personalized visual choices remain manually
  prepared/simulated and labelled. This redesign does not add learned AI,
  arbitrary deferred answers, transcription, captions of speech or cloud hosting.
