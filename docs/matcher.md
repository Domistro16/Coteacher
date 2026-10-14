# Question matcher spec

- Input: the student's text (typed or speech-to-text), the current timeline step id, the question bank.
- Boost candidates tied to the current step.
- Output: `{ match, score }` or `{ noMatch: true }`. Use `matcher.confidenceThreshold` from the package.
- Start with fuzzy keyword matching (for example TF-IDF) and a tunable threshold. An in-browser embedding model is a stretch goal only if time allows.
- On no-match: show `matcher.noMatchMessage`, offer the nearest related explanation, add the question to `queuedQuestions`, and never block the student.
- Every matched answer shows its source (`sourceRefs`) and the relevant timeline step.
- Unit tests: at least 10 queries, including paraphrases, off-topic questions, and near-misses that must NOT match. Report precision on the near-misses.

## Student help routing

The player runs an offline, rule-based command detector before this matcher.
Six intents control pause, replay, explain differently, try it, quiz and repeat.
Conservative request patterns support varied wording and bounded correction of
one long command-word typo. Words inside a question never activate a control.
All other input is help context for the matcher, without a required phrase.

The explicit pause form still passes text after "but I don't understand" as extra context with the
current timeline step. The matcher and threshold remain unchanged. A match is
shown separately with sources and its own lesson moment; it never navigates the
player. Specific no-match suffixes are queued; generic "this/that/it/this part"
suffixes remain help requests without meaningless queued questions. Help,
matched/no-match and queue events are saved together in one snapshot update.

For ordinary input the full text is preserved. A sourced match is shown without
changing the lesson position. Unsupported text gets the honest no-match and is
queued verbatim; an unseen text variant can be shown/spoken as explicitly related
material, rather than an answer. Viewing that fallback is recorded for this
student/step, so later explanation requests skip it. Exhaustion is stated without
presenting a repeated explanation as new. Matcher scores and threshold are unchanged.

Seen variants come from the profile's existing `variant-viewed` events, grouped
by exact timeline step, plus the currently displayed variant. Initial and manual
views, navigation, activity returns and opened optional refreshers count.
Try it is offered separately. Exhaustion preserves current content and offers
a specific question or an available safe activity. No schema extension is needed.

## Recorded player questions

The contextual typed-question form bypasses the legacy command detector. It
matches the original text directly, including words such as replay or this,
against prepared questions belonging to the captured concept. It retains
punctuation, whitespace and newlines in matched events and the unmatched queue.
A match is labelled a prepared offline answer with sources; no-match stays
pending, separate from any related explanation. Native playback time and the
original cue are saved with every new recorded question. See
docs/offline-questions-verification.md for persistence and return behaviour.
# Recorded companion routing

The new recorded companion first handles only unambiguous whole-phrase procedural
responses (confirmation, another explanation, check, return and exact quiz option).
A question containing those words is passed unchanged to the existing scoped
question matcher. Its threshold/unknown-term guard stays intact; “seems crooked”
and the existing “looks bent” share explicit meaning aliases. This is prepared
deterministic matching, not neural semantic search or generative reasoning.
Supported answers carry sources and prepared audio; unsupported originals retain
the captured native timestamp and stable context in the encrypted pending queue.
See companion-verification.md for speech, privacy and target-device limitations.
