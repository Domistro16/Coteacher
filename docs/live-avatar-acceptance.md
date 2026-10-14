# Connected GPT-Live avatar acceptance

One small extension to the existing contextual student companion, not a new app.
GPT-Live (`gpt-live-1`) handles connected speech; client delegation routes teaching
questions through the existing source-checking Responses tutor and learner memory.
The teacher's recording, native clock, approved visuals and offline packages stay
intact. The backend model remains independently configurable.

Acceptance:
- Talk with Coteacher opens the existing floating avatar inside the unchanged
  player and listens first. Opening alone never submits a question or reads an
  explanation. Prepared speech starts after a learner's actual request.
- The dock microphone action opens GPT-Live setup even without a local
  SpeechRecognition API. Help captures the actual paused lesson moment;
  external capture starts only after explicit consent and server acknowledgment.
- Local-only recognition controls explicitly say offline voice. Failed recognition
  preserves text input and prepared help; retry does not assume successful sync.
- Explicitly enable connected tutoring and start live voice inside paused help.
- Microphone status, stop, failure and text fallback are visible. Stop on close,
  profile lock/change, offline, hiding, activity/check navigation and page exit.
- Server creates WebRTC sessions with server-only credentials after validated
  learner/recording context and consent. No arbitrary client model/prompts/tools.
- Collect input transcript deltas before client delegation; never invent missing
  task text. Save questions using the existing exact moment and stable event IDs.
- Prepared matches return sourced approved content. New questions wait for the
  existing checked tutor response, durable storage and teacher oversight.
- Avatar speaks the delegated result and supports follow-ups/check/resume. No
  concurrent teacher audio or prepared clip playback during live voice.
- Explicit spoken requests such as "I want to try a quick check" and "Yeah, I
  would love to try a quick check" open the existing approved concept quiz,
  stop live capture and play only its prepared question/options. They must not
  enter the teaching-question queue or append an explanation understanding prompt.
- Window switching ends live capture without automatically playing a downloaded
  answer, including one arriving after capture stops. Retain the sourced answer
  for reading or explicit playback; keep the teacher's saved position unchanged.
- Text, prepared/connected answers, safe activities and saved questions stay in
  this dock. The user-requested question-grounded quick check opens a quiz modal
  over the retained player; no separate tutoring modal is opened. See
  contextual-quiz-acceptance.md for the superseding quiz behavior.
- Input and resume remain inside the visible dock at mobile/desktop widths;
  secondary connection/source details scroll separately from those controls.
- Session disconnect leaves original questions/progress intact. Live transport is
  online-only; prepared explanations and collected media remain available offline.
- Verify real GPT-Live session creation/audio separately from mocked transport
  lifecycle tests, and retain existing recorded/offline/quiz/profile regressions.

Transcript uncertainty, synthesized voice paraphrasing and real-device microphone
support must be disclosed. Memory uses observed events, not model retraining.
