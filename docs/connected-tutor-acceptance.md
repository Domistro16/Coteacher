# Connected tutor sprint acceptance

Scope: existing local Node service; two fictional learners; optional OpenAI text,
transcription and MP3 speech; atomic encrypted files and one in-process worker.
Cross-lesson transfer and trained recommendation models are outside this sprint.

1. In the recorded player, pause at an exact audio timestamp/concept; opt in and
   ask an unmatched question. A genuine sourced OpenAI response and MP3 speech are
   required for a **live PASS**. Mock-provider tests must be reported separately.
2. Follow-ups include only the same learner/concept's prior unflagged replies;
   avatar offers the existing approved concept quiz and returns to the same audio.
3. Received stable event IDs update durable memory. Incorrect attempts and
   explicit representation choices can produce different approved suggestions.
   No seeded history, learning-style label or mastery assertion enters memory.
4. Retry and restart preserve questions, responses, evidence and learner isolation.
   No duplicate generation for already answered question IDs.
5. Offline approved prepared answers remain immediate; unmatched questions remain
   queued in encrypted IndexedDB. Reconnection resolves them after acknowledgment.
6. Connected voice requires explicit permission, visible status and a short bounded
   capture. Text works without microphone or network. Real recognition and AI speech
   must be checked separately from test audio/providers.
7. Teachers can inspect and flag AI replies; no flag edits approved lesson content.

Run type checking, contract generation check, unit tests, production builds, existing
recording/package/offline browser tests and the opt-in tutor browser test at 360px.
Verify desktop and narrow layout, raw question context and frozen teacher audio.
