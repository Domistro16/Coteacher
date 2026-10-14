# Adaptive-learning demo verification — 2026-10-14

Verdict: **PASS for all ten requested core requirements**. The actual adaptive
browser journey and the existing real GPT-Live tutoring regression both exited 0.
No new platform, database or interface redesign was introduced.

## Confirmed blockers fixed

1. Automatic help was recorded as visual exploration and described as an explicit
   learner selection. Added optional `origin` to the progress schema first, generated
   types, then updated consumers. Automatic help is an observation, while deliberate
   choices are marked `learner-choice`; legacy events remain valid and are described
   as exploration. Incorrect checks and later deliberate choices drive recommendations.
2. Prepared refraction help always chose the pencil, ignoring observed memory.
   The existing player now uses the active learner's same-concept recommendation and
   exposes its reason, evidence count and approved sources under Approved alternatives.
   The original teacher audio, objective, cue chronology and UI layout are unchanged.
3. Memory depended on connected tutoring. It is now derived locally after stable event
   IDs are assigned, saved inside the existing encrypted snapshot, and available offline
   even when external AI is disabled. Observation validation rejects invented details.
4. Tutor uploads reused the original export time, causing the teacher to ignore appended
   offline events. Tutor upload copies now have current export time; the school retains
   a monotonic received-snapshot time without rewriting event/question timestamps or IDs.
   Receipts still hash exactly what the learner submitted. A regression covers old-time
   uploads with new events.
5. Teacher coach oversight omitted memory for learners who never enabled external AI.
   It now derives needs locally from already-received school events, without granting
   AI consent or initiating provider work. A regression verifies zero provider calls.

Secondary Profile disclosures now distinguish fictional profiles/initial seeded routes
from actual study actions and accurately disclose optional connected OpenAI processing.

## Actual end-to-end evidence

Command: `npm.cmd run verify:adaptive:live` (explicit real-provider network access).
Final adaptive run: **09:51:14–09:52:43 UTC**, approximately 90 seconds.
Artifact: [adaptive-learning-evidence.json](adaptive-learning-evidence.json).

All learner records originated from automated interactions through the real production
student UI, not storage injection or seeded question/quiz histories. Teacher setup used
the actual source preparation, approval, native capture, review and publication UI.
Its microphone input was **Chromium simulated audio**, not a human teacher. Backend,
encrypted IndexedDB, service worker, native media and API paths were actual implementations.

| # | Requirement | Result | Evidence |
|---|---|---|---|
| 1 | Independent A/B histories | PASS | Disjoint event UUIDs, separate PIN snapshots/questions and opposite quiz outcomes. |
| 2 | Record attempts/questions/struggles | PASS | A: two incorrect checks; B: one correct check plus help/question/choice events. School received 17 A events and 12 B events. |
| 3 | Different observed recommendations | PASS | A: `refraction-pencil`, citing its two incorrect-check IDs. B: `refraction-steps`, citing its explicit choice. Prepared help actually displayed these assets. Same objective and recording ID. |
| 4 | Memory survives restart | PASS | Student pages closed/reopened offline, exact memory/quiz evidence restored for both profiles; local backend also restarted from its saved school directory. |
| 5 | Offline recorded lesson after reopening | PASS | Full download, closed-page reopening with networking disabled, Blob-backed native audio and advancing playhead. |
| 6 | Unsupported offline question saved | PASS | Exact telescope-lens question, stable ID, learner/concept/recording/millisecond context and unanswered status survived another reopening. |
| 7 | Configured AI resolves on reconnect | PASS | Real source-checked OpenAI answer for the queued ID; HTTP 200 Responses and speech, engine `openai`, identifiable source references. |
| 8 | Sync without duplication | PASS | Actual school receipts, same received ledger posted twice, unchanged event UUID lists, unique question ID and two school snapshots. One Responses call for the queued question. |
| 9 | Teacher reflects received events | PASS | Existing Class insights displayed both snapshots, two incorrect checks and the newly returned question context; oversight showed both learners' evidence-based recommendations. |
| 10 | Relevant teaching recommendation | PASS | Received-evidence refraction nudge suggested the approved safe hands-on demonstration and its activity-note sources. |

The seeded cohort remained separately labelled at **18 learners / 4 refraction support
signals**. It was never combined with the two received profiles. Teacher pending-question
counts represent the separate teacher-guidance queue; an AI reply is logged separately
and does not automatically become teacher-approved returned guidance or published content.

Actual API IDs: Responses `req_4557e3c97d6849cb8c77913716ae997c`; speech
`req_d2be8af243654816995138aa7f90bb81`. The probe used an isolated school folder and
did not overwrite the existing publication or learner records.

Screenshots visually inspected: [received teacher view](screenshots/adaptive-teacher-received.png).
The [seeded view](screenshots/adaptive-teacher-seeded.png) is retained separately.

Initial test-helper failures came from reading before encrypted saving, using a stale
event count, or switching profiles before school receipt. Assertions now wait for the
owned saved profile/current receipt coverage. These were separate from the confirmed
teacher timestamp and disabled-learner oversight defects. A brief ECONNREFUSED during
deliberate backend restart was recovered by the normal retry path; it was not hidden.

## Regression checks

- Generated-type freshness and final TypeScript: PASS.
- Both production builds: PASS; existing chunk-size advisories remain.
- New memory, teacher insight and recorded-help units: 22/22 passed initially.
- Final targeted run: **24 passed / 8 intentionally skipped** across adaptive memory,
  teacher insights, progress sync and the two new tutor regressions. Together with the
  unchanged recorded-adaptation cases, 34 distinct relevant scenarios were checked.
- `npm.cmd run verify:tutoring:live`: PASS on the final build, all ten original tutoring
  flags passed, actual GPT-Live session HTTP 201 and three real Responses/TTS turns.
  It covers listen-first, one floating avatar, contextual follow-up, speech, understanding,
  concept quiz, exact resume, offline prepared help, queue return and profile consent.
- Whitespace checks on edited tracked contract/code/docs files: PASS.

The whole repository unit/browser suite was not rerun cleanly in this task. The earlier
unrelated tutor outage-test timeout remains unclosed. Physical microphone/speakers,
low-end Android installation/performance and full browser/OS termination are unverified.
There are no real children or human learning-outcome measurements. This is one bounded,
reviewed lesson with observed-event rules, not a trained recommender or production school
authentication/deployment. Source-ID checks cannot guarantee generated factual accuracy;
teacher oversight and safety review remain necessary.
