# Spoken quick-check invitation

Operator report: an explanation finished without inviting the learner to try a
quick check. The application already includes that invitation in its returned
text, but the live voice can paraphrase it away.

- After a checked explanation, explicitly ask whether the learner wants to try
  a quick check or ask another question. Do not end only with an understanding
  question, and do not claim the learner already understood.
- Wait for acceptance; keep the existing question-grounded personalized modal,
  checked sources, microphone shutdown and saved recording position.
- Deferred, flagged or unsupported answers must not promise a supported quiz.
- Check the server instruction contract, the existing production UI quiz journey
  with mocked transport, and real configured voice output with synthetic input.
  Human hearing of the corrected invitation remains unverified until reported.
- Restart the local backend and student preview without changing school histories.
