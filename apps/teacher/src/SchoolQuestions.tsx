import { TutorOversight } from "./TutorOversight";
import { useEffect, useState } from "react";
import type { ProgressRecord, LessonPackage } from "@coteacher/shared";
import { accountApi as api } from "../../shared/account-api";
import type { TeacherWorkspace } from "./SchoolTeacher";
export function SchoolQuestions({
  workspace,
  onSync,
  lesson,
}: {
  workspace: TeacherWorkspace;
  lesson: LessonPackage;
  onSync: () => Promise<void>;
}) {
  const [rows, setRows] = useState<
    { lessonId: string; accountId: string; progress: ProgressRecord }[]
  >([]);
  const [sources, setSources] = useState<
    Record<string, LessonPackage["sources"]>
  >({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      const received = await api(`teaching/${workspace.offeringId}/progress`);
      setRows(received);
      const entries = await Promise.all(
        [
          ...new Set<string>(
            received.map((r: { lessonId: string }) => r.lessonId),
          ),
        ].map(async (id) => [id, (await api("lessons/" + id)).sources]),
      );
      setSources(Object.fromEntries(entries));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void refresh();
  }, [workspace.offeringId]);
  return (
    <section className="content-card">
      <h1>Student questions</h1>
      <p>Respond to the original question using the approved lesson sources.</p>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} onClick={refresh}>
        Refresh questions
      </button>
      {rows.flatMap((row) =>
        row.progress.queuedQuestions.map((q) => (
          <article key={row.lessonId + row.accountId + q.id}>
            <h3>{q.text}</h3>
            <p>
              {row.progress.studentId} · {q.timelineStepId}
            </p>
            {q.answered ? (
              <>
                <p>{q.answer}</p>
                <p>Sources: {q.sourceRefs.join(", ")}</p>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const values = new FormData(e.currentTarget);
                  setBusy(true);
                  setError("");
                  void api(`lessons/${row.lessonId}/answers`, {
                    studentId: row.accountId,
                    questionId: q.id,
                    answer: values.get("answer"),
                    sourceRefs: values.getAll("sourceRefs"),
                  })
                    .then(async () => {
                      await refresh();
                      await onSync();
                    })
                    .catch((e) => setError(e.message))
                    .finally(() => setBusy(false));
                }}
              >
                <label>
                  Teacher answer
                  <textarea name="answer" required maxLength={4000} />
                </label>
                <fieldset>
                  <legend>Supporting sources</legend>
                  {(sources[row.lessonId] ?? []).map((s) => (
                    <label key={s.id}>
                      <input name="sourceRefs" type="checkbox" value={s.id} />
                      {s.title} ({s.id})<small>{s.citation}</small>
                    </label>
                  ))}
                </fieldset>
                <button className="primary" disabled={busy}>
                  Return sourced guidance
                </button>
              </form>
            )}
          </article>
        )),
      )}
      {!rows.some((r) => r.progress.queuedQuestions.length) && (
        <p>No student questions received yet.</p>
      )}
      <TutorOversight
        lessonId={lesson.lessonId}
        schoolContext={{ offeringId: workspace.offeringId }}
      />
    </section>
  );
}
