# Live startup recovery: 14 October 2026

Operator reproduction: start live tutoring with saved consent. Native microphone opens, then the interface remains on “Microphone on · connecting Coteacher. Retrying temporary connection delays…” without starting the conversation.

Read-only checks against the actual backend and student proxy returned HTTP 200, enabled consent and validated tutoring state. An isolated copy of the current populated history also acknowledged an identical submission successfully in 5,439 ms, without contacting OpenAI or changing the operator's records.

A browser test of the actual React hook and encryption reproduced a client failure: GET 200 cached an ETag; the next polling request aborted; retries received 304. The error handler had cleared readiness, but the 304 branch never restored it. Pending live startup consequently waited indefinitely and issued zero `/live` requests. This establishes a reproducible cause of the reported symptom; the operator browser's exact network sequence was not captured.

The fix commits ETags only after full state validation and clears them after errors. A late request abort also requires a fresh check. The next retry fetches and validates the state before releasing pending live startup. Consent, learner/recording checks, source validation and durable progress are retained.

After-fix browser evidence: GET 200 → aborted GET → GET 200; pending startup issued exactly one mocked live-session request. See [live-readiness-evidence.json](live-readiness-evidence.json). Test command: `npm.cmd exec -- tsx .task-tmp/verify-live-readiness.ts`. The test uses the actual hook in Chromium with mocked HTTP responses. It contains no microphone audio, synthesized input or real OpenAI connection and does not verify human hearing.

Human retest: reload the student page online, wait for the app update (reload again after a few seconds if necessary), then tap Talk with Coteacher once. Confirm the status changes to the connected listening state and that a spoken question receives an audible answer. Saved site data should be retained.

Status: recovery regression **PASS**; updated real human GPT-Live startup/audio **UNVERIFIED** until the operator reports the retest.

Final checks: TypeScript and both app builds passed. The running student preview returned HTTP200 and serves index-BMCBDRvP.js. Existing bundle-size advisories remain.
