# Local package pipeline

From the repository root, validate a package without writing:

```sh
npm run pipeline -- --lesson fixtures/demo-lesson
npm run pipeline -- --lesson fixtures/demo-lesson/lesson-package.json
```

Generate the two simulated learners' encrypted packages:

```sh
npm run pipeline -- --generate --notes fixtures/demo-lesson/teacher-notes.md --activity fixtures/demo-lesson/activity-notes.md --out test-results/generated --approve-reviewed
```

Generation uses the same `LessonGenerator` as the teacher workspace. It supports
only the supplied reviewed source content, ignoring line-ending differences.
Review the sources and fixture before acknowledging approval. Other content is
rejected; no source is fetched and no LLM is called. Generated lessons pass schema
and referential-integrity checks before encryption. PINs: A 111111, B 222222.

Output files use exclusive creation: existing files are not overwritten. An I/O
failure can leave the first package written; retry into a fresh directory.

Validation exit codes: 0 success/help, 1 invalid contract, 2 arguments/file/JSON
error. Generation: 0 success, 1 generation or I/O failure, 2 missing/invalid
arguments or review acknowledgement. Use `npm.cmd` on restricted PowerShell.
