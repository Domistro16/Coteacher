# Recognized question followed by silence

The operator's words appeared on screen, but the live answer did not play.
School records contain recognized pencil questions and source-checked answers.
The existing encrypted tutor snapshot was approximately 19 MB, largely saved
answer speech. Repeated full transfers, unchanged-state rewrites and queued local
saves competed with answering. A populated-history production control run timed
out at 65 seconds; another delivered the result after approximately 55 seconds.
A separate focused regression proved that an empty repeated delegation could
supersede and discard an answer already being prepared.

The live transport now requests answer text without resending historical speech.
Existing local clips remain attached only to identical answer/review content;
complete speech returns after capture ends. Live transcripts remain encrypted
locally and upload after capture ends, while question/progress receipts continue.
Unchanged tutor reads no longer rewrite the encrypted school file. Obsolete
queued local writes are skipped in favor of the latest cumulative durable save.
Only a delegation with an actual question supersedes the pending task.

No provider, lesson schema, progress safeguard, quiz objective or visual styling
changed. Backups and semantic comparisons confirm the original publication,
125 events, 29 questions, 131 live turns and saved answer audio were retained.

Validation: 32 focused cases passed across the main run and the corrected store
test rerun. Generated types, TypeScript and both builds passed with existing
bundle-size advisories. The final production browser control uses an isolated
copy of the actual history and real encrypted HTTP/IndexedDB: checked result,
repeated empty notice, preserved history/audio, spoken contextual quiz, saved
attempt, return and new answer speech after capture all passed. Microphone,
live transport and provider generation were mocked, not human audio proof.

The final control still took approximately 26 seconds from greeting to result
with a six-second mock provider. This is not proof of low conversation latency.
An earlier quiz assertion exposed inconsistent seed playback metadata; final
setup selects refraction through the actual UI. The initial HTTP unit attempt
was blocked by the no-network guard; it now tests stores without weakening that
guard, while the browser covers HTTP. See live-answer-handoff-evidence.json.

The running backend has network access and serves the fix. Student entry
index-qbYORbAP.js and StudentPlayer-aEFlPEKo.js match the built files byte for byte.
Human playback of the corrected question/quiz journey remains UNVERIFIED until
the operator retests. Do not declare the whole hackathon READY from these tests.
