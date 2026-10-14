# Core adaptive-learning demo acceptance — 2026-10-14

Goal: verify the existing A/B learning, offline storage, configured AI return and
teacher-feedback loop. Preserve the recorded player/floating avatar, approved
objective/media, local service, encrypted storage and current teacher interfaces.
Fix only confirmed blockers.

The actual browser journey must show independent A/B event ledgers; questions,
help requests and quiz attempts; different approved help recommendations citing
their observed events; persistent memory after app/backend restart; downloaded
recorded playback and unsupported question queue offline; real sourced OpenAI
resolution after reconnect; receipt-backed repeated sync without duplicated IDs;
and received teacher indicators and a sourced teaching suggestion. Seeded 18-learner
class data must remain separately labelled and unchanged.

Conflicts identified before changes: automatic prepared help emits visual-explored
events but memory labels them explicit selections; refraction help always selects
the same pencil regardless of memory; memory is computed by connected tutoring
instead of also persisting with local interactions. The minimal contract extension
is an optional visual-exploration origin. Legacy events remain valid and are
described as observations, never invented explicit preferences.

Validation: meaningful memory/provenance unit tests, generated schema types,
TypeScript and builds; an actual production-browser A/B/offline/reconnect/teacher
journey with real configured OpenAI, isolated school state and no fabricated user
events injected into storage. Restart includes a closed/reopened student page and
local service restart. Physical phone/OS behavior remains a separate limitation.
