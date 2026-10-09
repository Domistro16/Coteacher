# Teacher workspace

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
prepared timeline steps and stable IDs as the learner package. Expand projector
view for larger text and fewer controls. The current moment and ordered display
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
ceiling. Leaving/hiding the tab pauses capture;
navigation is disabled during capture and unsaved-media recovery. Reloading during
capture warns, but an interrupted unfinished recording is not recoverable.

Replay the draft with its synchronized visuals and seek to any recorded moment.
Review it against the source notes and ensure no student/private conversations are
included, then Approve recording for learners. Replay both personal visual previews:
A gets concrete diagrams, B gets ordered annotations, from simulated histories.
Inspect their selected visuals and sources, acknowledge review, then Approve
personalized playback. Export both personal packages from
Prepare lesson; a pending recording blocks export, enforced independently of the
button state. Delete a recording to discard it or record a new attempt. Saved
recording drafts and review approvals restore after refresh/reopening. Learners
play the embedded audio offline and Study this exact concept opens the original
step. Captions are approved visual aids, not generated speech transcripts.

Recording requires HTTPS/localhost, browser microphone permission, AudioContext
AudioWorklet and WebCodecs Opus encoding (current Chrome/Edge target). Capture is local; no speech service or server is called. Tests
use a simulated microphone, not real classroom voices. Physical Android, Firefox
and Safari recording behavior is still unverified. See docs/personalized-replay-verification.md.

**Insights:** seeded class aggregates are visibly simulated. Unlock and import a
learner's encrypted progress file using their demo PIN. Newer snapshots replace
earlier imports; repeated/older imports are rejected. Heatmap counts are distinct
learners per moment. Variant statistics are descriptive observations, not causal
claims. The next-lesson nudge identifies its simulated previous-cohort evidence.

Queued questions are behind an explicit review disclosure. After reconnecting,
run the local answer simulation and export the encrypted returned file. Only
“Should I use a glass cup for this activity?” receives a sourced prepared answer.
Other questions remain pending. The student imports the file at their next visit.

Sources, drafts and approval persist in localStorage on this browser and origin.
Approval is saved before export is enabled; learners reject draft packages. The
bundled student demo has separately labelled seeded approval. Teacher progress
imports live only in memory for this session; export returned answers before closing.
No backend, real children's data, paid services, or automated file transfer.
