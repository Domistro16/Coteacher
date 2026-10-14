# Coteacher — canonical hackathon user journeys

## Product promise
A student can return to their actual teacher's recorded explanation, with synchronized personalized educational motion graphics, request help at the exact moment of confusion, receive a contextual response, check understanding, and return to the recording. Learning evidence returns to the teacher. Do not substitute a generic chatbot or standalone content reader.

## Teacher journey
1. Sign in to the existing teacher workspace. Upload notes and approved references. Review lesson objectives, concept breakdown, approved visual variants and prepared questions. AI-generated material is a draft until approved for publication.
2. Open the classroom studio. Preview visuals and microphone. Launch a separate clean projector window if needed. Record the teacher's real voice; manually advance visual cues. Every transition is timestamped against the recorded media timeline. Pauses and backward navigation must be represented correctly.
3. Stop and review the actual audio with synchronized visuals; seek and verify cues. Approve recording before publication.
4. Publish two learner packages: same approved objective and teacher audio, different approved visuals/support based on evidence (or explicit default variants when history is empty). Make packages streamable when connected and downloadable for offline playback.
5. Receive synchronized student events: questions, difficulty points, quiz attempts, explanation choices and outcomes. See concept heatmap and evidence-backed suggestions. Distinguish observed events from AI hypotheses. No invented class statistics.

## Student journey
1. Unlock a separate learner profile on a shared device. Home greets learner by name and displays teacher-published lesson packages as attractive video-style cards with play/download states.
2. Open package: immersive lesson player plays real teacher audio with timeline-synchronized, personalized animated visuals. Show clear play/pause/seek, chapter navigation, download and progress. The educational visual is the focus.
3. Student selects Talk with Coteacher or an enabled spoken interruption. Pause teacher audio and preserve exact timestamp, concept and learner identity. Do not auto-read an explanation before hearing the student's question. Open one compact floating avatar and speech bubble INSIDE the player; do not resize the player or open a sidebar/modal.
4. Avatar listens (microphone only with consent) or accepts typed question. It responds in student-friendly language grounded in the current lesson, speaks when audio is available, and can refer to approved animation/visuals. Student asks follow-up in the same conversation. Do not show technical provider, API or transfer details in the primary child-facing UI.
5. Avatar asks whether the explanation helped; if not, try a different approved representation or a safe activity. Confirmation is not proof of mastery. Offer a short concept-specific quiz; record attempt and feedback.
6. End help session; stop companion audio, close overlay and resume teacher recording at saved position. Progress and question history persist separately per learner.
7. After reconnecting, queued unanswered questions are processed and sourced answers returned. Teacher sees aggregated learning evidence with clear demo labels.

## Avatar states
Closed → Connecting (connected voice only) → Listening → Thinking → Speaking → Listening; optional Quiz → Closed. Error/OfflinePrepared/Queued are explicit states. Closing or switching learner cancels/ignores late responses. Never play teacher audio and avatar audio simultaneously.

## Demo narrative
Teacher approves and records one science lesson; publishes packages; learner A interrupts, gets contextual spoken help, takes a check and later sees a different recommended visual; learner B's different real interactions lead to a different approved variant; one learner downloads, disconnects, watches, queues a novel question, reconnects and receives answer; teacher sees evidence. Fictional profiles and simulated events must be labelled; live provider tests must be identified separately.
