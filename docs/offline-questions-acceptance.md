# Recorded player question acceptance

- The existing contextual player panel opens only after native audio is paused,
  with the exact millisecond position and stable concept/step IDs.
- Prepared, source-grounded package answers are matched locally above threshold.
- Unexpected typed text is saved verbatim with owner, lesson, concept, recording,
  playback position and submission time; no forced answer or network save dependency.
- Pending/returned/prepared question states live inside the recorded player panel.
- Close returns to the same paused position; explicit return resumes from there.
- Encrypted persistent storage survives refresh, tab reopening, multiple questions
  and A/B switching. Existing question records and transfer flows remain valid.
- Contract validation and returned-answer merge reject changed question context.

Validate both paths with network transport disabled and fetch/XHR/WebSocket blocked,
then reopen/switch profiles. Check native audio position, exact original text,
prepared citations, saved statuses, returned-answer identity and storage failure.
Preserve the student and teacher visual systems. Server AI remains unconfigured;
pending questions are not promised an automatic generated answer.
