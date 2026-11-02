import { useEffect, useState } from "react";
import { PreparedSupportReview } from './PreparedSupportReview';
import {
  accountApi as api,
  type AccountSnapshot,
} from "../../shared/account-api";
export function SchoolPublications({
  state,
  refresh,
}: {
  state: AccountSnapshot;
  refresh: () => Promise<void>;
}) {
  const [lessons, setLessons] = useState<
    {
      id: string;
      title: string;
      offeringId: string;
      schoolId: string;
      publishedAt: string;
    }[]
  >([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void api("lessons")
      .then(setLessons)
      .catch((e) => setError(e.message));
  }, [state.publications]);
  return (
    <section className="content-card">
      <h1>Published lessons</h1>
      <p>
        School lessons are available to enrolled students. You choose whether a
        recording is also available to students with no school.
      </p>
      {error && <p role="alert">{error}</p>}
      {lessons.map((lesson) => {
        const external = state.publications.find(
          (p) => p.recordingId === lesson.id,
        )?.external;
        return (
          <article key={lesson.id}>
            <h2>{lesson.title}</h2>
            <p>
              {new Date(lesson.publishedAt).toLocaleDateString()} ·{" "}
              {external
                ? "Also shared with unaffiliated students"
                : "School audience only"}
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                if (
                  !external &&
                  !confirm(
                    "Share this reviewed recording with signed-in students who have no school? Downloaded copies cannot be recalled while offline.",
                  )
                )
                  return;
                setBusy(true);
                setError("");
                try {
                  await api("school/publication-audience", {
                    schoolId: lesson.schoolId,
                    offeringId: lesson.offeringId,
                    recordingId: lesson.id,
                    external: !external,
                    reviewed: true,
                  });
                  await refresh();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {external
                ? "Withdraw external sharing"
                : "Share with unaffiliated students"}
            </button>
            <PreparedSupportReview publicationId={lesson.id}/>
          </article>
        );
      })}
      {!lessons.length && (
        <p>
          No published recordings yet. Open an assigned class to prepare and
          record.
        </p>
      )}
    </section>
  );
}
