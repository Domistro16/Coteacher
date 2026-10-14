# Working data contracts

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
  different students' files remains the publisher's responsibility.
- IDs are unique within sources, concepts, timeline, question bank, and quiz.
  Variant IDs are unique across all concepts. Queued question IDs are unique within
  a progress record.
- Route entries pair a concept with its ordered variants and a student-visible
  reason. Inserted refreshers identify their owning concept, a refresher variant,
  and the routed concept they precede.
- Navigation events use `pause`, `replay`, and `explain-again`; the other event types
  are `variant-viewed`, `tryit-completed`, `question-matched`, `question-no-match`,
  `quiz-answered`, and `tryit-follow-up`. All carry a timestamp and concept;
  all except quiz events also carry a timeline step. Follow-ups carry text.
- Matched question IDs refer to the lesson question bank. No-match question IDs
  and optional follow-up question IDs refer to the record's queued questions.
  Match scores must exceed the lesson threshold. Optional no-match scores must
  not exceed it. Scores and thresholds are between zero and one.
- Queued answers require text and source references only when `answered` is true.
- Visual/audio paths are relative package paths, with no URLs, drive prefixes,
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
File inputs are capped at 3 MB for the proof of concept.

PlayerState is generated from player-state.schema.json. It describes the local
position/variant/activity inside an encrypted snapshot. Storage validates the
player structure and lesson-specific index/variant/activity relationships, plus
the lesson and progress contracts, before resuming. The enclosing encrypted
snapshot uses the envelope's schema version; it is not an export format.

The shared LessonGenerator produces only the two simulated packages from the
supplied reviewed text inputs. Their objective stays identical. The CLI and
teacher UI validate packages before encrypted export. The teacher approval gate
is an explicit human review, not proof of factual accuracy from schema checks.

Progress imports are lesson/profile validated. Teacher snapshot replacement uses
parsed timestamps and rejects equal/older imports. Returned answers merge by
question ID, text, step, and asked time; local events and still-pending questions
are preserved. All repository demo data remains simulated.
