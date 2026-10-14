# Working demo acceptance

Use production previews from README.md. Developer previews do not register a
service worker. Learner histories, prepared generation and class statistics are
simulated and visibly labelled. Classroom audio is explicitly captured, reviewed
and published; it is not a generated voice or a transcript.

## Primary journey: recorded classroom lesson

Start `npm.cmd run delivery:start` alongside the app previews. Prepare/approve
the reviewed lesson, then open Teach / projector and Start presentation. Open
projector display, move the clean window to the projector, and press F for fullscreen.
Use the studio's visible recording and visual controls. Focus studio is the
single-screen fallback. Check microphone access, then explicitly enable and start
recording while manually changing visuals. Pause/mute during discussion; choose
Stop and save recording to enter review, replay and approve the audio and both
personalized sequences. Open Recording review, inspect default/A/B scenes with the selector, then choose
Publish packages → Publish recorded lesson.

Unlock A to the personalized home and select the published card's Watch Now.
Play and seek the actual streamed voice with
concrete diagrams; switch to B for the same audio with ordered ray annotations.
Download each complete personal lesson and wait for completion and Ready offline:
opening the streaming player alone must not show readiness. Both use one shared
local recording. Disconnect, reload/reopen, play and seek local audio, request
prepared help at the exact current concept, do its safe activity/check and return
to the original recording. Lock/switch/return to verify independent progress.
See recorded-delivery-verification.md for the complete demonstration and limits.
If no teacher recording is published, Home/Library report that explicitly; they must not
silently substitute notes. No cloud upload is claimed by the local service.
Existing saved notes-only profiles also reopen on Home. Their saved content is
under Profile → Open saved prepared-content lesson; school import/export lives
under Profile → School & device. Those options restore their existing work and
identify prepared-content readiness without claiming a classroom recording.
See student-redesign-verification.md for the separate student screens and tests.

## Prepared-content compatibility and progress-return journey

Student file transfer is now under Profile → School & device. After collection
or a subsequent unlock, use Profile → Open saved prepared-content lesson to enter
this explicit compatibility journey. The normal home/library/player flow is the
recorded classroom replay described above.

1. In the teacher workspace, load the reviewed demo materials or upload
   fixtures/demo-lesson/teacher-notes.md and activity-notes.md. Generate the
   simulated draft, inspect variants/questions/quiz/activity safety, acknowledge
   review and approve.
   Check the subject, topic, simulated class level and shared objective. Expand
   each source preview and concept understanding check. Reload a draft: it remains
   unavailable for export. Approve, close/reopen the teacher tab: sources, concepts
   and approval remain available. Regeneration or changing a source requires review
   again. The learner rejects an encrypted draft even if supplied outside the UI.
2. Open Teach / projector and Start presentation. Advance visuals with a tap;
   demonstrate the refraction moment and its sources, step backward and forward,
   and open the dedicated projector display (or Focus studio on one screen).
   Sources and visit history are under Lesson notes & sources. Reload/reopen:
   the same current concept and classroom
   visits restore. Open Sync & Transfers and export Student A's encrypted
   package after teaching to include the recorded classroom timeline. Open Class
   insights to show the 18 seeded learners, variant observations and nudge.
3. In the student app, choose Student A, unlock with 111111, import the personal
   file, and wait for Saved on this device and Ready offline. Enable narration
   once after unlocking; captions remain visible with Play/Pause/Replay/Speed.
4. Disable the connection. Reload or close/reopen the student app. It asks for a
   PIN and restores the lesson. Expand Revisit the classroom timeline and choose
   the refraction moment: its original explanation, visual, source and teacher's
   words match the classroom step. Return to the first moment and advance to
   refraction, then type
   "Pause here. I understand this part, but I don't understand this" or tap
   Pause here / explain again. The different explanation shows its source and
   original lesson moment. "put it another way" and "explain that again" show the next
   unseen text variants in the learner's route order without advancing the step.
   After all text variants have been seen, "break it down" shows honest
   exhaustion and offers Try it separately or typing a specific question.
   Enable narration again after an offline reload/unlock. Hear explanations
   while the connection is disabled, pause/resume/replay them and change speed.
5. Run the safe Try it using adult help, an unsharpened pencil, a plastic cup,
   room-temperature water, and a towel. Read why it works and return to the
   teacher's original moment. Interrupt/reopen midway to verify saved position.
   Completion automatically opens the approved refraction check. Reload offline
   before answering: it remains pending. Choose the physically-bent misconception,
   inspect sourced feedback, then Retry this concept check and choose the light
   direction answer. Verify two attempts, a separate reported-completion status
   and a latest correct response. Reopen offline and revisit the exact teacher
   concept. Neither completion nor the check claims long-term learning.
6. Ask "Why does the pencil look broken?" for a sourced match. Ask
   "Should I use a glass cup for this activity?" for an honest no-match and queue.
   Ask "How does a rainbow form?" to show an unsupported question staying pending.
7. Use the activity follow-up or take the quiz selected from the pause point.
   Feedback cites sources. Wait for
   saving, then export the encrypted progress record. Prompts/options and both
   correct/incorrect feedback have captions and narration.
8. Lock/switch to Student B (222222), expand Prepared-content compatibility demo,
   collect the older demo lesson, and see stepwise
   refraction first. "can you say it differently" shows B's unseen teacher
   original, even after A has exhausted explanations. Student A's explanation
   history, position, questions and quiz remain separate.
9. Restore connectivity. In Sync & Transfers, enter 111111 and import A's progress, then open Class insights.
   Select Received demo interactions: A's exact-concept signals, variant use and
   pending-question total appear. Select Simulated class: its 18 seeded learners
   remain separate, with 4/18 refraction support signals (incorrect checks), not
   12/18 pauses labelled as confusion. Importing the same file again is rejected.
10. Expand Review imported queued questions, run simulated answer return, and
    export the encrypted returned file. Only the plastic-cup safety question gets
    a sourced prepared answer; the rainbow question remains pending.
11. Unlock A and import returned answers. The sourced answer appears in saved
    questions without losing newer local progress. Connection alone never implies
    that a file was transferred.

## Teacher recording journey

Prepare/approve the lesson and start its presentation. Confirm the microphone is
off, enable capture of the teacher only, and Start audio recording. Grant browser
permission and verify the visible live status. Advance a visual, Pause recording,
move back while paused, then Resume recording and advance again. The paused period
must neither lengthen saved audio nor separate equal-time paused/resume cues.
Stop releases the microphone and saves a private review draft. Refresh: audio and
all stable step/concept/source references restore. Replay, seek backward/forward,
and verify visuals follow audio time. Pending audio prevents export. After playing
and acknowledging accuracy/privacy review, approve the recording separately.
Export stays blocked until both personalized visual sequences have also been
reviewed and approved. A receives concrete ray/pencil diagrams; B receives ordered
annotated ray diagrams. Both use the same complete recorded voice, cues and objective.
Collect a file in the learner app, wait for offline readiness, disconnect and reopen.
Play the actual saved audio with synchronized SVGs, seek to refraction, and Study
this exact concept. The player's step ID must be step-refraction, not a topic page.
Permission denial leaves manual presentation available; failed saves retain a
replayable in-memory draft with retry and block export until saved/reviewed.
Native streaming Opus tests encode/decode 121 seconds, verify audible signal,
finite duration, seeking past 120 seconds, compression and corrupted-page rejection.
The complete browser journey plays A then B, verifies one encrypted local audio row,
independent positions, offline audible playback and exact-concept help/activity/quiz/
questions, then reloads and resumes. Media quota failure commits neither profile nor
audio and cannot show Ready offline. Missing/damaged media can be recollected without
losing either profile's progress. Static source-only fixtures are labelled honestly.

Inspect About my visual presentation to explain A/B's simulated-history decision;
in teacher review also preview the default sequence for insufficient history.
At refraction, use Which part of this recorded concept is unclear? with
"Why does the pencil look broken?" A's recording pauses at that exact timestamp,
the short sourced explanation appears, and prepared ordered annotations offer a
different representation. Reload offline and unlock A: the saved explanation,
paused support and audio position restore. Check this concept, answer correctly,
then Return to recorded lesson. The same teacher audio resumes and A's assigned
pencil diagram replaces paused support. B retains its ordered playback, independent
position and empty A-help history. No fixed learner-type label is assigned; later
help uses only that learner's previously explored representations/explanations.

## Second journey: bundled collection and sharing one device

Unlock A, Collect demo lesson, wait for Ready offline, disable connectivity,
advance and pause, save, close the tab, reopen offline, and unlock again. Wrong
PINs fail; progress restores. Switch learners and demonstrate independent routes
and progress on the same device. Export questions/progress for the next visit.

For explicit isolation verification, give A and B different saved questions and
opposite answers to the same quiz. Leave A at activity instruction 2 and B at
instruction 1. Lock before handing over, then reopen offline and unlock each:
their exact instructions, questions and quiz results restore separately. The
other learner's PIN must fail without exposing a lesson. An unsent draft must
not appear for the next learner. See shared-device-verification.md for automated
storage checks and privacy limits; use one learner tab at a time.

## Automated evidence

Real cached MP3 playback is tested with networking disabled, without mocking
Audio.play or media time. Tests check decoded duration and advancing time,
pause/resume/replay/speed, the complete preparation queue, every activity
instruction and its why, quiz feedback, matched/no-match replies, reload,
microphone fallback and locking/switching profiles. Speech-synthesis unit tests
cover local voices, delayed voice availability, remote-only rejection, media
errors, autoplay restrictions and cancellation races.

Help acceptance covers unscripted current-step words, normalization of curly
apostrophes/capitalization/spacing, manual views, optional refresher views, and
history after navigation and offline reload. Specific text after "but I don't
understand" is sent to the unchanged matcher at the current step: sourced
answers show their own lesson moment without moving the player; specific
no-matches are queued without the help command prefix. Generic "this", "that",
"it" and "this part" suffixes do not create empty questions for the teacher.
Unrelated questions and command near-misses such as "Why do we repeat the
experiment?", "I didn't get that parcel" and "Explain how a rainbow forms again?"
use the matcher or honest no-match without activating a command. Unscripted
confusion such as "The bit with the water still makes no sense" is passed intact
as matcher context. On no-match it is saved and a sourced unseen explanation is
offered as related material. Exhaustion offers an activity
only where a safe Try it exists, and the typing action focuses the question box.

Teacher preparation tests exercise source previews, every concept's diagram,
original/alternative explanations and understanding checks, persistent draft and
approval state, both encrypted exports, same-objective routes, rejected draft
collection, review revocation, regeneration/source replacement, storage failure,
and corrupt-state recovery. The longer full demo explicitly allows 90 seconds
for its multiple encrypted transfers and offline reloads.

Presentation acceptance records forward/backward classroom visits, checks approval
gating, manual keyboard controls and projector layout, compares content before/
after presentation, restores the last teacher moment across reload/tab reopening,
exports the identical classroom record to both learners, and reopens the exact
concept offline with matching step/concept IDs, explanation, diagram and sources.
Unit tests also distinguish repeated timeline steps belonging to one concept.
Save failures keep the previously saved moment visible; revoking/reapproving
clears stale presentation state. Teacher speech APIs are blocked in the browser
test and no recognition/transcription path is added.

npm run test:e2e builds both apps and runs the main journey, bundled offline
reopening, profile/file/source/storage error cases, narrow layouts, keyboard/touch
navigation, activity exit, and unavailable-speech typing. It enables service
workers and blocks student application network APIs in the main journey. The
in-process preview servers close normally on Windows.

npm test checks generated types, app/pipeline types, contracts, local generation,
matcher negatives/paraphrases, encryption, quiz selection, snapshot imports,
answer merging, and local speech adapter behavior.

A real low-end Android installation/performance/speech check remains unverified;
see docs/sprint-status.md. Typing is the reliable fallback when local speech is
unavailable. Generation and answer return do not invoke live AI.

## Redesigned teacher and direct school return

Open Dashboard → Prepare lesson → Lesson details → Teaching materials. Drop or
choose the supported reviewed .md/.txt notes, inspect source previews, generate
the labelled simulated draft, review concepts one at a time and approve. Ready
to record leads to Teach / projector. Capture, pause/mute, advance manually, stop
and choose Review your lesson. Play/seek the original native recording, approve
audio, switch default/A/B visual previews at the same position, inspect packaged
help assets and approve personalized playback. Publish packages lists actual
readiness and missing approvals. Only a confirmed service response marks it
published. Dashboard/My Lessons display saved draft/recording/publication state.

After collecting/downloading, study offline and save an unmatched question.
Reconnect while unlocked, or use Try school sync in Profile if the last offline
hint remains after a closed-app reconnect. Wait for school received your progress;
connected alone is insufficient. Open teacher Class insights/Questions to receive
the new snapshots automatically, or Check school connection in Sync & Transfers.
Filter questions by status/concept and reopen the exact concept. Review Student A
questions, Run simulated answer return for the supported plastic-cup question,
then Return reviewed answers through school service. The next A sync merges
that sourced answer while B remains independent. Other questions stay pending.
Wrong/missing acknowledgements, an unavailable service or conflicting histories
retain the local ledger and offer retry/manual transfer. Refresh both sides and
verify the same records, cue and audio position.

Manual encrypted lesson/progress/returned-answer files remain in teacher Sync &
Transfers and learner Profile → School & device. Teacher imports are durable;
PINs are not stored. Teacher authentication, arbitrary lesson authoring, PDFs,
production cloud sync and free-form online answering are not implemented.

## Recorded offline questions

Download the complete recording, disable network access and open Explain this.
Verify native audio pauses at the captured moment. Ask why the pencil looks broken:
the prepared answer appears immediately with teacher-note sources. Ask two unsupported
questions, including punctuation/newlines, and verify honest Pending teacher review
states. Close the dialog and verify the recording remains paused at the same position;
Return to recorded lesson resumes there. Reload/reopen offline and use Your questions
inside the player to recover all entries. Lock A, unlock B, ask at another concept,
and return to A: their original text, IDs, timestamps and queues remain separate.
Reconnect and require school acknowledgement before receipt is claimed. Unsupported
questions stay pending until sourced guidance is actually returned.

Reconnection acceptance also checks durable received event/question IDs, repeated
sync without duplicate events, a delayed real HTTP receipt while the learner adds
a new question, and that only the submitted prefix is marked received. Return the
labelled plastic-cup demo guidance through the teacher school route. Verify it
appears in the correct learner's recorded-player history with sources, survives
another offline reopen, and leaves the other learner's progress and receipt untouched.

## Concept-level teacher insight acceptance

Open Class insights and select the light/refraction demo lesson. Select Simulated
class: the 18 fabricated records are clearly labelled and separate from received
activity. Refraction has four learners with incorrect-check signals; the 12
refraction pauses and six straight-path pauses remain context, not diagnoses.
Select refraction, expand a contributing learner, inspect its actual check result
and explanation view, and inspect the table's explicitly limited later-check
observations. A learner counts once per concept, while retries remain attempts.

Download the actual recorded package, study as A/B offline, ask for help and submit
an incorrect check. Reconnect and require the school's real receipts. Refresh
teacher records: Received demo interactions shows the two attributed snapshots
and exact-concept events, while the seeded cohort remains at 18. Inspect original
step IDs, captured recording cue times, raw questions and approved visual assets.
Review this activity opens refraction-tryit in preparation, including sources and
safety; the original approved content, recording and classroom visits stay intact.
All indicators are observations from simulated profiles, never mastery or causal
effectiveness claims. See teacher-insights-verification.md for details.

## Prepared conversational companion

In an offline downloaded recording, pause at refraction with Explain this. Hear
the approved alternative, watch its prepared visual and ask why the pencil looks
crooked. Check the sourced offline answer. Ask an unsupported question: the exact
text stays pending with learner, lesson, concept and recording position. Confirm
understanding, complete the quick check, then return to the teacher's audio at the
saved position. Reload and switch learners to check isolation. Voice mode is an
explicit option, enabled only when a local recognition model is already available;
tap/text are always alternatives. This is prepared tutoring, not live generative
AI. See companion-acceptance.md and companion-verification.md for evidence and
device limitations.
