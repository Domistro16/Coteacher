# Real tutoring journey acceptance — 2026-10-14

Goal: finish the existing floating-avatar conversation within a 30-minute investigation budget. Preserve the player layout, teacher media clock, approved source checks, prepared offline speech, independent learner memory and durable question history. No infrastructure or unrelated UI redesign.

Done when the actual student player has one tutoring interface, pauses native teacher audio, listens without an opening explanation or invented question, sends a novel consented question to real OpenAI, speaks the sourced result through GPT-Live, handles a contextual follow-up in the same session, checks understanding, offers the current concept's approved quiz and resumes at the saved timestamp. A real-provider browser probe must record HTTP outcomes, source references, decoded live audio, preserved geometry/time, quiz evidence and microphone shutdown. Distinguish simulated input from real model/voice output and physical hardware.

Conflicts found before changes: older live-avatar/docked acceptance requires an automatic prepared opening explanation; the canonical hackathon rules require listening first. The existing text submission enables connected tutoring without the explicit opt-in setting. Follow canonical listen-first and consent requirements, keeping prepared speech available after an actual request.

Validation: generated-contract/type checks, relevant unit tests and production builds; real-provider browser probe in an isolated copy of the published school lesson; offline prepared/unmatched questions, encrypted restart and profile isolation; relevant mocked error paths separately. If live service is blocked, record its exact failure and verify real connected text tutoring separately. Stop investigation at 30 minutes.
