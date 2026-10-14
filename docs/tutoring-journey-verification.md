# Real tutoring journey verification — 2026-10-14

Latest verdict: **PASS for all ten requested requirements**, after the user resumed
the goal with a 15-minute limit. The final real-provider browser command exited
successfully and also passed its offline/reconnect and profile-consent assertions.
The earlier failed attempt is retained below as historical evidence.

## Resumed verification

- `npm.cmd run verify:tutoring:live`: **PASS**. Actual student player, Node backend,
  GPT-Live WebRTC and source-checked Responses. One live session, a novel spoken
  question and contextual typed follow-up, native decoded voice, understanding
  invitation, relevant quiz with saved evidence, immediate microphone shutdown and
  native teacher playback resuming at the captured timestamp. All ten requirement
  flags in [the final evidence](tutoring-journey-live-evidence.json) are **PASS**.
- Three real Responses calls returned HTTP 200: the two connected turns and the
  queued offline question after reconnect. The follow-up request included the
  first turn's history. Actual GPT-Live session creation returned HTTP 201.
- Download, disconnected reload, actual local teacher audio, sourced prepared
  speech, durable unmatched text across a second reload, receipt-backed reconnect
  and returned real AI reply passed. The school ledger contained the queued ID
  exactly once. Student B retained independent questions and did not silently
  enable connected AI by submitting text.
- Both production builds and final TypeScript passed. Focused unit checks:
  **4 passed**, **8 intentionally skipped**, across tutor/live-voice files; these
  cover provider payload/privacy, speech byte boundaries, client delegation and
  late permission cancellation. No clean full-suite result is claimed; the earlier
  outage-test timeout remains a separate regression limitation.
- Cached generated explanations now request at most 60 words and speech at 1.1
  speed, retaining MP3 and the existing 700,000-byte guard. This reduces the
  oversized-clip failure without changing source checks or substituting cached
  speech for GPT-Live. The final real speech requests returned HTTP 200.
- The extra offline test failure was a verification-helper issue: voice setup
  was open, and the helper toggled its menu closed instead of choosing the existing
  **Type instead** control. The helper now follows the actual fallback interaction.
  No student UI layout or backend infrastructure was rebuilt.
- The earlier transient Offline transition did not recur. Its original cause was
  not established; do not claim it was repaired or infer a host/network cause.

Actual provider requests/output are verified; microphone input is synthetic and
physical microphone/speaker hearing/Android remain unverified. Source checks do
not prove every generated statement factually correct. Desktop/mobile screenshots
remain under `docs/screenshots/single-avatar-live-{desktop,mobile}.png`.

## Historical interrupted attempt

The sections below describe the earlier incomplete run, not the final verdict.

## Changes

- Retained the existing floating avatar, single composer, player geometry, native recorded media and delegated GPT-Live/Responses integration.
- Connected typed questions now respect the existing explicit opt-in. Added a compact opt-in control to the same composer; submitting a question no longer enables tutoring automatically.
- The sourced live answer handoff includes the existing procedural understanding/check invitation. Approved prepared speech remains available after a real request.
- Added `npm.cmd run verify:tutoring:live`, extending the earlier actual-player probe with contextual follow-up, understanding/check/resume, offline restart/queue/reconnect and learner-consent assertions. It copies the reviewed publication to an isolated school directory and does not modify the existing school records.
- Updated listen-first acceptance and connected/offline disclosures. No schema, learning objective, recording, approved content or persistent learner format changed.

## Real API evidence

The final browser probe started at **08:00:23 UTC** and recorded its failed result at **08:03:51 UTC**. Artifact: [tutoring-journey-live-evidence.json](tutoring-journey-live-evidence.json).

- GPT-Live `/v1/live/sessions`: HTTP **201**, 1,564 ms.
- Actual Responses request: HTTP **200**, request ID `req_ea03ea6eed26432f8be0b9acca13531a`, 3,644 ms.
- Actual speech request: HTTP **200**, request ID `req_ae5eac9a735f4d348703f36b1465a96d`, 708 ms. HTTP success alone does not establish a usable cached clip.
- The novel spoken question concerned eyeglass lenses and the water lesson. The checked answer cited identifiable approved lesson/curated excerpts. GPT-Live output included the relevant refraction explanation and “Does that make sense? ... we can try a quick check.” Native decoded audio energy was verified for the greeting; the final answer-specific playback/energy assertion was not reached.
- The teacher recording stayed paused at **36.643928 seconds** at activation. Opening submitted no invented question and played no prepared explanation.
- Input was an existing **synthetic microphone fixture**, not a person. Backend requests and GPT-Live transport/output were real; no provider response was mocked. Physical microphone, speaker hearing and Android behavior remain unverified.

## Requirement results

FAIL below means the requested verification did not pass; it does not establish that every unvisited feature is broken.

| # | Requirement | Result | Evidence |
|---|---|---|---|
| 1 | One tutoring interface | PASS | Actual player has one avatar, no tutoring dialog/competing tools panel. |
| 2 | Recording pauses | PASS | Native audio paused at the captured activation timestamp. |
| 3 | Listens before answering | PASS | Listening greeting; zero opening questions; prepared audio remained paused. |
| 4 | Question reaches real OpenAI | PASS | Actual Responses HTTP 200 and sourced answer for recognized question. |
| 5 | Relevant spoken answer | FAIL — complete playback assertion unverified | Real live explanatory transcript exists; final answer-specific decoded-audio assertion was not reached. |
| 6 | Follow-up in same conversation | FAIL | Typed follow-up entered live context, was saved, but no second Responses request occurred; 150-second timeout waiting for a second answered reply. |
| 7 | Checks understanding | PASS | Actual GPT-Live transcript asks whether it makes sense and invites another question/check. |
| 8 | Relevant quick quiz | FAIL — not reached | Probe stopped before the existing concept-check action. |
| 9 | Resume saved timestamp | FAIL — not reached | End-to-end native resume assertion was not reached. |
| 10 | Real API test confirms full conversation | FAIL | First real turn succeeded; two-turn journey failed. |

## Exact blockers and separate text verification

1. Final UI showed **Offline** / “waiting for connection.” The second exact question remained in the learner's saved history. Live events contain its typed-context append followed by session closure, and the API trace contains only one Responses request. The cause of the connection-state change was **not established**; do not infer an API outage or a host-suspension cause.
2. `npm.cmd run verify:tutor:live`, run separately with network access, reached a real source-checked text response, then failed in `OpenAITutor.speak`: **“Spoken answer exceeds the download budget.”** Existing limit: **700,000 bytes**. This verifies the checked text stage, not successful cached speech or the text UI journey. The guard was preserved.
3. Initial fixture attempts produced a header-only 46-byte WAV and “Unable to decode audio data”; those attempts made no OpenAI calls. The existing valid synthetic fixture was reused. A subsequent sandbox attempt was denied with **EACCES**; the authorized real-provider probe then ran with network access. These are separate from the final follow-up failure.

## Other checks

- Generated types and TypeScript passed during `npm.cmd test` before the later probe-only additions.
- Both production app builds passed; existing >500 kB chunk advisories remain.
- Completed unit files: live voice **4/4**, delivery **9/9**, sprint/matcher **25/25**, recording **9/9**, teacher progress storage **2/2**, recorded adaptation **10/10**, contracts **136/136**. Tutor tests: **6 passed**, outage/citation/hazard test timed out after **120 seconds**. The broader run was stopped; no clean full-suite result is claimed.
- Whitespace check passed for edited tracked README/package/acceptance/browser-documentation files.
- New offline/profile/reconnect assertions and the final desktop/mobile geometry comparisons were not reached. Earlier evidence is historical, not proof of this revision.

Further work should target the lost connection state and the saved follow-up's dispatch, then repeat the same real two-turn/check/resume probe. No further functional changes were made after stopping investigation.
