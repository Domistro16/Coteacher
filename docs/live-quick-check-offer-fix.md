# Explicit spoken quick-check invitation

The operator heard an explanation without the expected quick-check question.
Previously the returned text ended with an understanding question and a softer
"we can try a quick check" suggestion. GPT-Live could paraphrase or omit that
suggestion. The instruction-only correction was tested against the real provider
and still produced the old softer ending; that attempt was not accepted as proof.

Supported live explanations now include a direct question: "Would you like to
try a quick check on that, or ask another question?" The same return path sets the
current check-offer ref before accepting a following "Yes, I would like to".
The live server instruction also tells the voice to preserve the invitation and
wait for acceptance. Deferred and flagged replies do not get this invitation.
Sources, teaching content, quiz generation/personalization and the existing
recording player are preserved. No schema, offline audio or stored history changes.

The configured real GPT-Live WebRTC test returned the explicit invitation in its
generated speech transcript, with decoded unmuted answer audio. It used synthetic
microphone input and a delayed fixture teaching answer, not a human conversation
or a live Responses source check. See live-quick-check-offer-real-evidence.json.
The complete corrected human invitation remains UNVERIFIED.

Validation: 20 focused live, companion and contextual-quiz unit tests passed;
TypeScript and student production build passed. The existing bundle-size advisory
remains. The student preview serves the new entry index-CYKw5yDV.js and player
StudentPlayer-B_VJLkt8.js, verified against dist by file hash. The backend was
restarted with network access and the updated voice instruction. The student
preview was restarted on port 4173. No school data was reset or overwritten.

The official OpenAI documentation distinguishes instructions from commentary:
commentary can be paraphrased, and an accepted command does not prove speech.
That is why this correction was checked against generated speech and decoded
audio, rather than treating a successful append as delivery.
Source: https://developers.openai.com/api/docs/guides/live-conversations

The first production-UI run confirmed the new invitation, then stopped at an
older handoff diagnostic's fixed 1 MB deferred-payload assertion. Current retained
history makes that payload approximately 1.17 MB. The diagnostic now compares
against the actual full encrypted record and requires the deferred response to be
less than one quarter of that size. No product validation or history was changed.

The rerun confirmed the direct invitation, retained original events and answer
audio, and opened the quiz modal on "Yes, I would like to". It did NOT complete
quiz generation: the UI reported "Your question and attempts are still waiting
for the school connection. They remain saved." The existing 45-second
acknowledgement deadline expired; the trace contains aborted full tutor requests
and HTTP 409 responses while progress reception eventually succeeded. This run
does not establish the underlying cause or prove a new human failure. No sync
validation was relaxed, and no additional sync changes were made in this task.
See live-quick-check-offer-ui-evidence.json. Invitation: PASS in real-provider
synthetic-input testing. Modal acceptance: PASS with mocked live controls.
Quiz completion/resume in this latest run: FAIL/UNVERIFIED respectively.
Overall current journey: PARTIAL; corrected human hearing remains UNVERIFIED.
