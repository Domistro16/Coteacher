# Coteacher — online/offline feature contract

The same student-facing interface is used online and offline. Change capabilities, not layouts. Never silently simulate an unavailable feature.

| Feature | Connected | Offline |
|---|---|---|
| Lesson library | Fetch teacher-published packages; stream or download | Show locally downloaded packages; unavailable remote packages clearly labelled |
| Recorded lesson | Stream or play local audio and synchronized visuals | Play cached teacher audio, approved visuals and animation assets after app restart |
| Personalized visuals | Choose approved, recording-compatible variants using actual learner evidence; download updates | Use last downloaded approved variants; no network dependence |
| Animated visuals | Full educational build-up animations, roughly five-second repeat where appropriate; smooth cue transitions | Same packaged animation assets; deterministic behavior on pause/seek; reduced-motion alternative |
| Voice activation | Explicit opt-in microphone; supported live voice session can listen and be interrupted | Never promise live GPT voice; offer typed questions and prepared local audio; device-supported offline speech input only if verified |
| Coteacher help | One floating in-player avatar; listen first; contextual grounded spoken responses and follow-ups via real connected provider when configured | Same avatar; approved prepared answers/audio only; unsupported questions queued honestly |
| Source retrieval | Teacher-approved passages first, curated educational sources if needed; validate citations | Only bundled approved source excerpts and prepared answers |
| Quizzes | Targeted concept checks; record actual attempts | Bundled checks work locally and sync later |
| Learner memory | Persist observed evidence and transparent hypotheses; select approved variants | Append local events per profile; update server-side after sync; no invented history |
| Progress sync | Sync idempotently with acknowledgements | Queue locally, retry on reconnection; never lose progress or mix profiles |
| Teacher insights | Show real received events, evidence and uncertainty | Teacher can view last available synced data; do not imply unsynced events arrived |
| Audio speech | Connected live voice for actual conversation where verified; pre-generated narration for approved content | Bundled audio for prepared explanations; text fallback when audio unavailable |

## Failure and fallback rules
- Internet connectivity does not prove OpenAI service availability. Show distinct connected/network, microphone, API, and deferred states.
- A connected novel question must attempt the configured grounded AI route. If it fails, show a truthful error or queued state, not an invented success.
- An offline novel question is saved with stable question ID, learner ID, recording revision, concept ID and playback timestamp. Process once on reconnect; duplicate submissions must not create duplicate answers.
- Never treat a newly generated online answer as teacher-approved offline content automatically.
- Preserve teacher audio and exact timeline when changing personalized visuals.
- Real user data is out of scope; use fictional learners, clear opt-in/disclosure for connected AI, and keep secrets server-side.
