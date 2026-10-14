# Question-grounded personalized quick check

The user explicitly requested a quiz modal on spoken acceptance. This supersedes
the earlier rule forbidding a modal quiz; the floating tutor remains in the existing
recorded player. No other redesign or infrastructure change is authorized.

- Spoken "I want to try a quick check" / "I would love to try a quick check" opens
  a focused modal immediately, stops live capture and companion audio, and retains
  the exact teacher recording position. Escape/close returns to the conversation;
  returning to the lesson resumes that position. Keyboard focus stays in the modal.
- With a question in the current conversation, use its unchanged text, stable
  question ID, learner, lesson, recording and timestamp. A checked connected answer
  and supplied citations ground a new check; never silently replace it with the
  generic paused-concept quiz. Unsupported/unanswered questions defer honestly.
- Use recent same-learner attempts and explicit representation choices to choose
  guided, standard or application support. Default when evidence is absent. Keep
  the lesson objective unchanged; do not infer permanent learning types or mastery.
- Persist sourced generated checks and immutable selected-answer attempts within
  the existing PIN-encrypted tutor record. Synchronization merges attempts by
  stable ID, rejects edits and profile/context mismatches, and retains newer local
  work. Teacher oversight can inspect questions, source context and attempts.
- Downloaded checks and attempts work locally offline. No network call is needed
  for their use. A question without a downloaded check gets an honest unavailable
  state. With no question, the existing approved concept check remains available.
- Tests: source/identity/answer-index rejection; evidence-backed A/B support and
  question-specific provider inputs; encrypted save/restart/append-only sync;
  production browser spoken acceptance with mocked live controls, actual modal
  interaction, narrow layout, source display, attempts, offline reuse and resume.
  Verify configured provider generation separately from mocked browser transport.
  Human hearing and recording/timing reports retain their existing evidence scope.
