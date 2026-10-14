# Working data contracts

Visual exploration now optionally carries `origin`: `learner-choice`,
`prepared-help` or `connected-help`. Existing events without origin remain valid
observations; missing/automatic origin must not be labelled an explicit preference.
Local memory is derived after stable event IDs are assigned, persists independently
of external-AI consent, and may select only approved same-concept representations.
School uploads acknowledge the submitted digest while retaining a monotonic received
snapshot time. Event timestamps and IDs are unchanged by reception.

The JSON Schemas in `schemas` are the source of truth. Both use draft 2020-12,
closed objects, and `schemaVersion: "1.0.0"`. Change a schema first, run
`npm run generate:types`, then update consumers and fixtures. Generated TypeScript
files in `packages/shared/src/generated` are committed; never edit them by hand.

## Commands

- Install: `npm install` (dependency downloads are allowed during setup).
- Generate types: `npm run generate:types`.
- Check generated types without writing: `npm run check:types`.
- Check TypeScript: `npm run typecheck`.
- Run all contract checks: `npm test`.
- Validate a local lesson through the CLI: `npm run pipeline -- --lesson fixtures/demo-lesson`.

On Windows PowerShell with script execution disabled, use `npm.cmd` instead of
`npm`. No execution-policy change is needed.

Generation resolves schema references locally only. Validation loads bundled
schemas synchronously, never fetches sources or assets, and has no network path.
Tests block networking in their workers. Tests and generation work offline after
dependencies are installed.

## Shared validation API

Import `LessonPackage`, `ProgressRecord`, `ValidationIssue`, `ValidationResult`,
`validateLessonPackage`, and `validateProgressRecord` from `@coteacher/shared`.
The workspace currently exports TypeScript source for TypeScript-aware consumers.

Validators accept unknown input and return `{ valid: true, data }` or
`{ valid: false, issues }`. Each issue has `stage` (`schema` or `integrity`), a
stable `code`, a JSON Pointer `path`, and a human-readable `message`.
Schema errors use `schema.<keyword>` codes; integrity codes identify the broken
relationship. Never use the human-readable message as a programmatic identifier.

`validateLessonPackage(value)` always performs schema validation followed by
referential-integrity validation. `validateProgressRecord(value)` validates the
record's structure and internal queued-question relationships;
`validateProgressRecord(value, lesson)` additionally validates the supplied lesson
and checks lesson/student identity, sources, entities, context, and matcher scores.
An invalid context lesson returns errors under `/lesson` rather than being used.
Successful validation returns the original object, without coercion or mutation.

## Contract conventions

- Student IDs match `student-` plus 8–32 lowercase hexadecimal characters. This
  rejects ordinary names but cannot establish that an ID was assigned anonymously.
- `simulated` is a required boolean. Every repository fixture must set it to true.
  The invalid name fixture uses a fabricated example, never a real child's data.
- Sources are citations, not long quoted passages. All concept, variant, timeline,
  question-bank, quiz, and answered queued-question content has nonempty source
  references. A concept's misconceptions are covered by its source references;
  Try it fields are covered by the variant's references.
- The objective contains text and concept IDs. The route must cover those concepts;
  personalization changes the route, not the objective. Comparing objectives across
  different students' files is enforced by the shared approval helper: original
  instructional content must agree; routes, identity and separately reviewed
  supporting visual selections may differ.
- Lesson identity includes subject, topic and classLevel. The fixed demo class
  level is a simulated authoring choice, not a verified curriculum alignment.
  contentOrigin is manually-prepared-demo: generation assembles existing hand-written
  content deterministically and never invokes live AI.
- publication is either a draft or approved with approvedAt and approvalKind.
  Newly generated packages are drafts. Teacher/CLI approval uses teacher-review;
  the bundled demo explicitly uses seeded-demo approval, allowed only with simulated
  data. Student collection and snapshot save/restore require approved publication.
  Teacher exports also revalidate this state, beyond the disabled-button UI.
- IDs are unique within sources, concepts, timeline, question bank, and quiz.
  Variant IDs are unique across all concepts. Queued question IDs are unique within
  a progress record.
- Route entries pair a concept with its ordered variants and a student-visible
  reason. Inserted refreshers identify their owning concept, a refresher variant,
  and the routed concept they precede.
- Navigation events use `pause`, `replay`, and `explain-again`; the other event types
  are `variant-viewed`, `tryit-completed`, `question-matched`, `question-no-match`,
  `quiz-answered`, `tryit-follow-up`, and `visual-explored`. All carry a timestamp and concept;
  all except quiz events also carry a timeline step. Follow-ups carry text.
- Matched question IDs refer to the lesson question bank. No-match question IDs
  and optional follow-up question IDs refer to the record's queued questions.
  Match scores must exceed the lesson threshold. Optional no-match scores must
  not exceed it. Scores and thresholds are between zero and one.
- New quiz-answered events retain selectedIndex and sourceRefs. When present,
  selectedIndex must address an actual option and agree with correctness;
  sourceRefs must equal the prepared question's references. Both are optional
  for existing legacy records. Each retry is a separate event. Activity completion
  is a self-report, with concept-check progress counted after the most recent
  completion of that activity; it does not certify understanding or retention.
- Queued answers require text and source references only when `answered` is true.
- Prepared visual/audio paths are relative package paths, with no URLs, drive prefixes,
  backslashes, or dot segments. Actual asset size and existence are checked by the
  future package publisher, not by these data validators.

## Fixture review and limits

`fixtures/demo-lesson` contains a hand-written light/refraction package, simulated
progress, and the cited teacher/activity notes. The single Try it uses a blunt,
unsharpened pencil, a plastic cup, room-temperature water, and a towel, with adult
help and spill precautions. It uses no glass, heat, chemicals, or sharp tools.

The six invalid fixtures each break one requirement. Tests assert the expected
validation stage, code, and path rather than just checking that validation fails.
Safety, factual accuracy, citation accuracy, and absence of personal data need
human review; structural validation cannot prove them.

## Sprint storage and transfer contracts

EncryptedTransfer is generated from encrypted-transfer.schema.json and validated
before decryption. It is a versioned closed envelope containing algorithm,
iterations, base64 salt, IV, and ciphertext. Personal lesson/progress payloads
remain the original validated contracts inside encryption, with no plaintext
identity in the envelope. Wrong PIN/tamper errors reveal no decrypted content.
File inputs and encrypted ciphertext strings are capped at 48 million bytes/characters.
Actual Opus media is bounded to 20 MB, allowing both base64 layers of an encrypted
standalone transfer. Existing source-only packages use the same envelope.

PlayerState is generated from player-state.schema.json. It describes the local
position/variant/activity and optional recordingId/positionMs inside an encrypted snapshot.
Optional recording.support holds timelineStepId/visualAssetId for paused help;
restore requires the asset's concept and step to match the cue at saved positionMs.
Storage validates the
player structure and lesson-specific index/variant/activity relationships, plus
the lesson and progress contracts, before resuming. The enclosing encrypted
snapshot uses the envelope's schema version; it is not an export format.

LessonPackage optionally carries classroomTimeline: sessionId, approvedAt,
startedAt, currentStepId and chronological visits with timelineStepId, conceptId
and presentedAt. Each visit resolves to an existing prepared timeline step and
its owning concept. The approval timestamp must match the approved package;
draft presentations, unknown steps/concepts, invalid time ordering and positions
that differ from the final visit are rejected. This is a record of manually
displayed moments, not a transcript or independent instructional dataset.

Presentation metadata is the only package field changed during teaching. Teacher
preparation validation compares instructional content to the supplied materials,
and additionally requires matching classroom records in both learner packages.
Reapproval clears presentation metadata; source replacement and regeneration
discard it with the former approval. New packages without classroomTimeline
remain valid and show the prepared concept timeline without claiming actual
classroom visits. Student revisit-step resolves a timelineStepId rather than
the first occurrence of a concept, shows the step's default explanation, clears
activity state and records the destination IDs in existing progress events.

LessonPackage optionally carries recording: capture identity, lessonId,
classroomSessionId, lessonApprovedAt, startedAt, durationMs, teacher-microphone
origin, complete inline audio and chronological visual cues. New recordings use
mono 48 kHz Ogg Opus; bounded 16 kHz WAV remains a legacy import format. New audio
carries a shared random mediaKey inside the encrypted transfer. Local snapshots
replace dataBase64 with mediaId/byteLength/mediaKey; these local references cannot
be imported as complete teacher transfers and must resolve before playback.
Delivered manifests instead use the closed audio alternative
`mediaUrl/sha256/byteLength/mediaKey`, constrained to the same-origin
`/api/recorded-lessons/{sha256}/audio?key={capability}` endpoint. Integrity checks
require the URL to address the declared checksum. This metadata is suitable for
streaming, not evidence that media is present offline. Downloads verify full
length, checksum and the inline audio contract before atomic local collection.
The configured delivery service only publishes complete, teacher-reviewed Opus
recordings and paired approved visual sequences, and stores one original binary.
Every cue holds offsetMs, timelineStepId, conceptId and the original step's
sourceRefs. The first offset is zero; all offsets are within the audio duration.
Equal offsets retain paused transitions and resolve to the final visual at that
instant. WAV checks include audible signal; Opus checks include page CRCs, headers,
sequence/framing and exact final sample duration. Capture rejects silent PCM before
encoding is finalized. These checks cannot establish speech, speaker identity or
citation accuracy. New media has a 20 MB budget, six-hour safety ceiling and 1,000
cues. Browser-reported Opus duration may include about 6.5 ms of codec priming;
decoded content and concept cues use the original captured-sample duration.

Recorded playback includes visualAssets and playback together. Each declarative
asset has stable ID, conceptId, title, sourceRefs and safe shape layers. The manifest
identifies recordingId/studentId, simulated=true, method, catalogVersion and a
sequence selecting visualAssetId for each exact captured cue. New
prepared-support-rules-v2 manifests require decision (difficulty, optional preference,
representation and basis) and include all reviewed help assets. Legacy
demo-history-rules-v1 manifests retain their original profile rule and selected
assets, with no decision. These method/decision relationships are enforced by the
shared integrity validator. Integrity checks reconstruct sequence/assets/reason/decision
from the reviewed catalog and rule inputs, preventing invented assets, changed timings
or unsourced imported geometry. An explicit empty history selects the default.
recording.visualReview is independently draft/approved with reviewedAt/catalogVersion;
publication rejects a playback manifest until both recording and visual review are
approved. New compressed recordings cannot publish without their playback manifest.

Recording review is independent of lesson publication: draft or approved with
reviewedAt. Draft recordings validate for teacher review storage but are rejected
by requirePublishedLesson at export, learner collection and snapshot restoration.
Reapproving instructional content strips recording, classroom and derived playback/asset metadata. The
teacher keeps audio and cues together in one IndexedDB transaction keyed by lesson
and approval timestamp, outside small text preparation in localStorage. Export
reads and validates this store and embeds only reviewed media into both personal
routes. Unknown/stale lesson/session/approval/source references fail validation.

The shared LessonGenerator produces only the two simulated packages from the
supplied reviewed text inputs. Their objective stays identical. The CLI and
teacher UI validate packages before encrypted export. The teacher approval gate
is an explicit human review, not proof of factual accuracy from schema checks.
New required lesson metadata/publication fields extend the sprint's 1.0.0 contract.
Earlier package files without them are rejected; regenerate and approve them.
No approval is inferred for legacy files. Approval metadata is a local workflow
gate, not a signed attestation or production authorization mechanism.

Teacher preparation persists source text and both personal packages together on
the teacher origin. Writes complete before React exposes approval. Restore checks
source/content agreement and matching approval across packages. Source replacement,
regeneration, or revoking review clears approval for subsequent exports. Files
already collected for offline use cannot be recalled by changing local teacher
state. The local delivery service holds an explicitly published revision; local
review changes do not recall it or existing downloads. No revocation service exists.

Visual-explored progress events require recordingId, positionMs, timelineStepId,
conceptId, visualAssetId and sourceRefs. Context validation checks the exact original
cue at that position and the approved asset's concept and sources. They are saved
learner interactions, never edits to a published lesson. Teacher import resolves
its prepared lesson and recording to validate these events, so the original recorded
revision must still be available there.

Progress imports are lesson/profile validated. Teacher snapshot replacement uses
parsed timestamps and rejects equal/older imports. Returned answers merge by
question ID, text, step, and asked time; local events and still-pending questions
are preserved. All repository demo data remains simulated.

## Local school progress acknowledgement

ProgressReceipt is generated from progress-receipt.schema.json. Its closed
versioned object contains studentId, lessonId, recordingId, the SHA-256 of the
submitted plaintext ProgressRecord, acceptedAt and simulated=true. The request
is the existing EncryptedTransfer, with owner and recording in the bounded route
`POST /api/progress/{studentId}/{recordingId}`. The server decrypts only the
matching public demo PIN, validates against the currently published personal
package, rejects divergent or shorter event histories, preserves existing teacher
answers, and writes encrypted progress before acknowledging. Retries preserve
the full append-only event ledger; student submissions cannot invent answered
queued questions. `GET` on the same route returns PIN-encrypted sourced answers.

Teacher-only `GET /api/progress` returns checked snapshots and their publication
revision; `POST /api/progress/answers/{studentId}` merges reviewed prepared answers
by immutable question identity. The existing teacher publication token guards
these routes, and only the teacher proxy injects it. Public fixture PINs/token
remain demo protection, not production identity verification. The local service
saves one encrypted received snapshot per learner. Different recording revisions
are never automatically combined. Watch positions remain in the learner
PlayerState; this event-return contract does not claim completed-watch analytics.

## Recorded question context

New recorded questions retain exact original text and recordedContext with
studentId, lessonId, conceptId, recordingId and millisecond positionMs. The same
context accompanies question-matched events with originalText; these two event
fields must occur together. Context is optional on older questions, whose native
playback time was never stored. Validators check the enclosing owner/lesson and,
with a lesson, the original recording, duration, cue concept and timeline step.
Server ingestion and returned-answer merging treat all these fields as immutable
question identity in addition to ID, text, step and askedAt. Removing context or
moving a question within the same concept cannot attach an answer to another moment.

## Event identity and local sync checkpoint

New learner events have eventId UUID values assigned before saving. IDs are optional
only to preserve existing ledgers; duplicates fail validation. School ingestion
accepts adding an ID to an unchanged legacy event once, then requires it to remain
unchanged. Ordered append-only comparison prevents stale or conflicting uploads.

ProgressSyncState is generated from progress-sync-state.schema.json and stored as
optional sync in the encrypted learner snapshot, outside the transferred progress
ledger. It contains the validated ProgressReceipt, received eventIds and questionIds.
Snapshot validation checks learner/lesson/recording identity, an ordered event prefix,
and existing question IDs. It marks receipt of precisely that prefix; later local
work remains pending. Questions are retained after acknowledgement.

Answered questions optionally carry answerOrigin=teacher-reviewed or
simulated-prepared. The current demo provider always sets simulated-prepared;
older answers without provenance remain readable without inventing their origin.
Already answered local questions are preserved when stale return files/server
snapshots arrive. Guidance revisions need an explicit future versioning workflow.

## Contextual quick checks

TutorState optionally contains server-authored checks (maximum 40) and append-only checkAttempts (maximum 200). Legacy snapshots remain valid. Each check binds the actual original question, owner/lesson/recording via its enclosing state, concept, timeline step and paused position. Prompt/options/feedback share nonempty checked sourceRefs and citations. Personalization records a support mode and actual same-learner evidence IDs; it does not alter the learning objective.

POST /api/tutor/{studentId}/{recordingId}/check accepts an encrypted TutorCheckRequest. The server resolves the acknowledged original question and checked answer, derives support from received evidence, generates/validates a check, and returns the encrypted TutorState. It never accepts check content or personalization from the device. Offline use reads already saved checks.

The existing tutoring POST optionally carries checkAttempts. The server merges stable attempt IDs, rejects modified content and invalid selections/correctness, and never replaces server-authored checks. Returned state is merged with newer device attempts before local saving. Quiz evidence is visible in teacher tutor oversight and learner memory, separate from legacy prepared-quiz progress events. Existing school progress prefix/answer safeguards are unchanged.
