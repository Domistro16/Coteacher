# Schema requirements

Codex creates the schemas in `/schemas` in the first task, from this spec. Use JSON Schema (draft 2020-12). Set `additionalProperties: false` on objects and include a `schemaVersion` on both schemas.

## 1. Lesson package (one student, one lesson)

The file a student loads and studies offline. It must contain:

- **Metadata:** lesson id, title, subject, language, a `simulated` flag, a pseudonymous student id (never a real name).
- **Learning objective:** one objective, identical for every student.
- **Sources:** the teacher's notes, textbooks, and references, each with an id, title, kind, and a citation (book and page). Cite, do not reproduce long passages.
- **Concepts:** each with an id, title, prerequisite concept ids, likely misconceptions, source references, and several variants.
- **Variants** of a concept: types `original`, `short`, `analogy`, `stepwise`, `refresher`, `tryit`. Each has content text, optional visual and audio asset paths (small files only), and source references.
- **Try it** variants also have: household items, steps, an explanation of why it works, safety notes, and the timeline step to return to.
- **Timeline:** ordered lesson steps, each tied to a concept, with what the teacher said (from the notes) and a default variant. Steps advance by tap in the sprint.
- **Question bank:** question, alternate phrasings, answer, concept, timeline step, source references, and audience (`class` for everyone, `student` for this student's predictions).
- **Quiz:** prompt, options, correct option, explanation, concept, the misconception it targets, and source references.
- **Route:** this student's route to the same objective: concept order, variant order per concept, inserted refreshers, and a short reason per concept shown to the student.
- **Matcher settings:** confidence threshold and the friendly no-match message ("Hmm, I'm not sure I have that yet, but once I'm online I'll get back to you on that pronto.").

## 2. Progress record (exported by the student app, imported by the teacher view)

- Lesson id, pseudonymous student id, export time, `simulated` flag.
- **Events:** pause, replay, explain-again, variant viewed, Try it completed, question matched, question no-match, quiz answered, and follow-up question after Try it. Each has a timestamp and, where relevant, timeline step, concept, variant, question or quiz id, correctness, and the matcher score.
- **Queued questions:** unmatched questions with id, text, time asked, timeline step, and whether answered (with the answer and source references once answered).

## 3. Checks JSON Schema cannot do

Write code (in `/packages/shared`) for referential integrity, run on every package:

- Every `sourceRefs` id exists in `sources`; no content item may have empty `sourceRefs`.
- Every concept id, timeline step id, and variant id referenced anywhere exists.
- A Try it's `returnToStep` is a real timeline step.
- Quiz `correctIndex` is within the options.
- The route only uses concepts and variants that exist, and covers the objective's concepts.

## 4. Required tests

- The hand-written demo fixture passes both schema validation and the integrity checks.
- Separate invalid fixtures each fail for the right reason: missing `sourceRefs`, a reference to a nonexistent source, a Try it without safety notes, a `correctIndex` out of range, a real-looking name in `studentId`, and a progress record with an unknown event type.
