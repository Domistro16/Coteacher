# Teacher workspace

The workspace now shares the student app’s brand, Nunito, tokens, icons and
player. It opens on Dashboard; My Lessons resumes the saved preparation.
Prepare lesson is guided: details → materials → prepare/review → ready to record.
Recording review has one synchronized player and a Default/A/B selector.
Publish packages shows actual audio/visual readiness and server acknowledgement.
Class insights includes a selectable concept heatmap and contributing events;
seeded classroom observations and received A/B interactions have separate views.
Inspect explanation requests, incorrect checks, retries and pending questions,
recording cue times, explicit variant use and approved visuals. Suggestions reopen
the exact sourced concept material in preparation without changing the recording.
See [concept insights verification](../../docs/teacher-insights-verification.md).
Questions is a dedicated, filterable exact-concept inbox. Sync & Transfers owns
encrypted exports/imports, direct school connection status and reviewed answer
return. Settings identifies the local demo and unconfigured teacher accounts.

See [current verification](../../docs/teacher-redesign-verification.md).


Run `npm run dev:teacher` at http://127.0.0.1:5174.

**Prepare:** upload the supplied reviewed notes/activity sources or select the
demo materials, generate a labelled simulated draft, inspect content/sources and
both routes, acknowledge review, approve, and export encrypted personal packages.
The selected lesson shows subject, topic, simulated class level and the shared
learning objective. Expand the source text and each concept's original/alternative
explanations, SVG visual, citations and understanding check before acknowledging
review. Changed uploads or regeneration invalidate approval. Other materials are
rejected clearly. Generated content is manually prepared and assembled by a
deterministic simulation, with no live AI or automatic factual verification.

**Teach:** approve the lesson, then choose Start presentation. Move with Previous
visual / Next visual or select a concept. The explanation and SVG use the same
prepared timeline steps and stable IDs as the learner package. Open projector
display for a separate visual-only window; Focus studio keeps controls on one
screen. The current moment and ordered display
visits (including backward revisits) persist across refresh/tab reopening.
Export personal packages after teaching to include the classroom timeline for
offline learner review. Earlier exports and the bundled demo show their prepared
concept timeline; they do not automatically acquire a classroom session.
Automatic speech following remains a stub. Manual presentation also works with
the microphone off.

**Record:** after starting the approved presentation, explicitly enable teacher
capture and choose Start audio recording. Grant microphone permission. Pause for
student speech/discussions: paused input is muted and does not advance audio time.
Move visuals manually; each transition uses the captured audio sample clock.
Resume records the current visual. Stop recording releases the microphone and
saves audio/cues together as a private draft in IndexedDB. Streaming mono Opus
replaces the two-minute cap; recording has a 20 MB media budget and six-hour safety
ceiling. Switching between the studio and projector does not pause capture;
navigation is disabled during capture and unsaved-media recovery. Reloading during
capture warns, but an interrupted unfinished recording is not recoverable.

**Studio and projector:** Open projector display launches a separate same-origin
window with only the approved visual and instructional words. Move it to the
external display; press F or double-click its visual for fullscreen (Escape exits).
Control Previous/Next and recording from the studio. BroadcastChannel carries
display state locally without a network service. Closing/reloading/reopening the
projector restores the current visual and does not control the microphone.
Focus studio provides a compact single-screen fallback; it keeps recording controls.
Sources and classroom visit history are under Lesson notes & sources.
Check microphone access requests permission and immediately stops the test stream;
it does not create a recording or verify audio quality. Stop and save recording
enters review only after IndexedDB confirms saving. Failed saves remain recoverable.
Web Locks prevent simultaneous same-lesson captures in this browser origin.
Keep the teacher browser/device awake; browsers can suspend background audio.

Replay the draft with its synchronized visuals and seek to any recorded moment.
Review it against the source notes and ensure no student/private conversations are
included, then Approve recording for learners. Replay both personal visual previews:
A gets concrete diagrams, B gets ordered annotations, from simulated histories.
Inspect their selected visuals and sources, acknowledge review, then Approve
personalized playback. Export both personal packages from
Sync & Transfers; a pending recording blocks export, enforced independently of the
button state. Delete a recording to discard it or record a new attempt. Saved
recording drafts and review approvals restore after refresh/reopening. Learners
play the embedded audio offline and Study this exact concept opens the original
step. Captions are approved visual aids, not generated speech transcripts.

**Publish:** run `npm.cmd run delivery:start` in another terminal. After approving
the lesson, saved recording and personalized scenes, open Publish packages and
Publish recorded lesson. The loopback service persists one actual Ogg recording
and both encrypted manifests. Learners can Watch teacher’s lesson to stream, then
Download for offline use and wait for completion/Ready offline. Both dev and
production preview apps proxy this service; cloud hosting is not configured.
Complete encrypted exports remain an alternative. See
[recorded delivery verification](../../docs/recorded-delivery-verification.md).

Recording requires HTTPS/localhost, browser microphone permission, AudioContext
AudioWorklet and WebCodecs Opus encoding (current Chrome/Edge target). Capture is local; no speech service or server is called. Tests
use a simulated microphone, not real classroom voices. Physical Android, Firefox
and Safari recording behavior is still unverified. See docs/personalized-replay-verification.md.

**Insights:** seeded class aggregates are visibly simulated. Unlock and import a
learner's encrypted progress file using their demo PIN. Newer snapshots replace
earlier imports; repeated/older imports are rejected. Heatmap counts are distinct
learners per moment. Variant statistics are descriptive observations, not causal
claims. The next-lesson nudge identifies its simulated previous-cohort evidence.

Queued questions appear in Questions and the transfer review disclosure. Run
the local answer simulation, then return reviewed answers through the school
service or export the encrypted returned file. Only
“Should I use a glass cup for this activity?” receives a sourced prepared answer.
Other questions remain pending. Automatic student sync retrieves approved
returned answers; manual import remains available in Profile when needed.

Sources, drafts and approval persist in localStorage on this browser and origin.
Approval is saved before export is enabled; learners reject draft packages. The
bundled student demo has separately labelled seeded approval. Teacher progress
imports persist encrypted on this browser; restoration validates owner and lesson. Direct school return is also available through the configured local service.
The local recorded-demo delivery and acknowledged progress/answer return backend
is real. Connected learners return durable encrypted snapshots automatically;
teacher views check for received updates every 15 seconds. Sync & Transfers has
an explicit connection check and a validated manual fallback. Connectivity alone
never marks records synchronized. No real children's data, paid services or
configured cloud deployment.
