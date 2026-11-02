# Live answer delivery with populated histories

Confirmed operator failure: recognized speech is followed by silence or repeated
source-checking messages. The school has saved a checked answer. The current
encrypted tutor record is approximately 19 MB, mostly existing saved speech.
An isolated production UI run failed to return a result within 65 seconds; a
second returned it after approximately 55 seconds with a six-second mock tutor.
These tests use mocked live transport, not human audio or OpenAI generation.

Acceptance:

- A repeated client delegation with no new question cannot replace a pending
  delegation and discard its source-checked result.
- During a live conversation, the existing encrypted tutor GET/POST may request
  `speech=defer`. The response retains the existing TutorState schema, sources,
  question identities, memory and histories, with answer speechBase64 set to null
  only in the response. Quiz audio remains included. The stored school record is
  never stripped.
- The client retains previously downloaded speech only when all associated
  answer/check content and review state match. It fetches complete speech after
  live capture ends. Deferred transport never means Ready offline.
- Preserve receipts, progress prefix validation, original teacher recordings,
  independent profiles, quiz binding and all saved histories. No new provider,
  cache infrastructure or quota/experience changes.
- Coalesce obsolete queued local saves; the latest complete cumulative snapshot
  must still save durably, and failure must remain visible.
- Live transcripts remain in the encrypted local snapshot during capture and
  upload after it ends. Question/progress acknowledgement continues during live;
  repeated transcript uploads cannot hold the tutor worker's write lock.
- Verify with focused control/transport tests, type/build checks and the actual
  production player using an isolated copy of the current populated history.
  Require a checked result to reach live commentary and the quiz to remain usable.
  Human hearing after the fix remains unverified until the operator retests.
