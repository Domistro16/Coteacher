# Repeated tutoring answer: 14 October 2026

The operator reported the same general refraction/pencil answer in live speech and typed help. The saved fictional learner's records confirm that two different lens questions reached the real OpenAI provider and received answers that returned to the water/pencil introduction. This failed question relevance; it was not an API connection outage.

The first instruction-only correction failed its real API relevance test. The final correction sends the current question as a separate user message and prior user/assistant turns in order, supplies approved prerequisite explanations from the same lesson, retains the existing curated lens source for contextual follow-ups, and avoids forcing an answer to fit the pencil visual. Unsupported lens details remain explicitly outside the supplied source coverage. Existing records and downloaded answers are retained.

Acceptance: distinct supported questions receive relevant different answers, a follow-up retains applicable sources, and source-reference checks remain required. No microphone or recording substitution is permitted.

Evidence: [question-specific-ai-evidence.json](question-specific-ai-evidence.json) contains three real HTTP 200 Responses API requests, their request/response IDs, distinct answers, source checks and the configured model. The lens question, straight-path follow-up and pencil question passed. This is a provider-level text test; corrected human GPT-Live playback remains **UNVERIFIED** until the operator retries.

Regression: `npm.cmd exec -- vitest run tests/tutor.test.ts -t "durably queues|HTTP payloads|insufficient"` passed two selected tests (eight skipped), including durable jobs, deduplication/restart, contextual source retention and separate ordered conversation messages. `npm.cmd run typecheck` passed. The existing student/teacher build is checked separately. Source-reference validation does not independently prove every generated factual claim.

The real test was initially blocked by restricted network access and automatic approval review of decrypted content. A payload-only inspection established that the validated package was simulated, all transmitted passages were reviewed hand-written demo notes or the existing NASA excerpt, and history contained fixed test questions/generated answers rather than saved human interactions. Review then allowed the bounded real test. No API key, profile name, PIN or recording audio entered the test payload.

The backend was restarted with the correction. Reload the student page online (wait a few seconds and reload again if its prior service worker remains active), end any existing live conversation, and start a new one. Ask a fresh lesson question and a follow-up, then request the quick check. Old downloaded answers retain their original content; a new answer is needed to assess the correction.

Implementation reference: [official OpenAI prompt engineering documentation](https://developers.openai.com/api/docs/guides/prompt-engineering).

Final build result: npm.cmd run build passed for both apps; existing bundle-size advisories remain. Backend health returned HTTP 200 after restart.
