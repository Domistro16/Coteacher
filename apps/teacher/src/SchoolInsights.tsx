import { useEffect, useState } from "react";
import { requirePublishedLesson, type LessonPackage, type ProgressRecord } from "@coteacher/shared";
import { accountApi as api } from "../../shared/account-api";
import { TeacherInsights } from "./TeacherInsights";
import { Sources } from "../../student/src/Visual";

interface PublishedLesson { id: string; title: string; offeringId: string }

/** Published context and received activity do not depend on this device's authoring draft. */
export function SchoolInsights({ offeringId }: { offeringId: string }) {
  const [catalog, setCatalog] = useState<PublishedLesson[]>([]);
  const [selected, setSelected] = useState("");
  const [lesson, setLesson] = useState<LessonPackage>();
  const [records, setRecords] = useState<ProgressRecord[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(true);
  const [revision, setRevision] = useState(0);
  const [review, setReview] = useState<{ conceptId: string; variantId: string }>();
  useEffect(() => {
    let active = true;
    void api("lessons").then((rows: PublishedLesson[]) => {
      if (!active) return;
      const available = rows.filter(row => row.offeringId === offeringId);
      setCatalog(available);
      setSelected(current => available.some(row => row.id === current) ? current : available[0]?.id ?? "");
      if (!available.length) setBusy(false);
    }).catch(error => { if (active) { setStatus(error.message); setBusy(false); } });
    return () => { active = false; };
  }, [offeringId]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setBusy(true);
    setStatus("Checking received learning activity…");
    void Promise.all([api("lessons/" + selected), api(`teaching/${offeringId}/progress`)])
      .then(([value, rows]) => {
        if (!active) return;
        setLesson(requirePublishedLesson(value));
        setRecords(rows.filter((row: { lessonId: string }) => row.lessonId === selected)
          .map((row: { progress: ProgressRecord }) => row.progress));
        setStatus("School learning records received.");
      }).catch(error => { if (active) setStatus(error.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [offeringId, selected, revision]);
  if (!lesson || !catalog.length) return <section className="content-card">
    <h2>{busy ? "Opening class insights…" : "No published lesson to review yet."}</h2>
    <p role="status">{status || "Publish a reviewed recording for this class to collect its learning activity."}</p>
  </section>;
  const concept = lesson.concepts.find(item => item.id === review?.conceptId);
  const variant = concept?.variants.find(item => item.id === review?.variantId);
  return <><TeacherInsights key={selected} schoolWorkspace schoolOfferingId={offeringId}
    schoolLessonId={selected} lesson={lesson} recording={lesson.recording!} records={records}
    approved busy={busy} syncStatus={status} onSync={() => setRevision(value => value + 1)}
    onReview={(conceptId, variantId) => setReview({ conceptId, variantId })} lessonOptions={catalog} onLessonChange={id => {
      setLesson(undefined); setRecords([]); setReview(undefined); setSelected(id);
    }}/>
    {concept && variant && <section className="content-card" aria-label="Published teaching material">
      <h2>{concept.title}: approved teaching material</h2>
      {variant.type === "tryit" ? <>
        <h3>Items</h3><ul>{variant.items.map(item => <li key={item}>{item}</li>)}</ul>
        <h3>Instructions</h3><ol>{variant.steps.map(step => <li key={step}>{step}</li>)}</ol>
        <p>{variant.explainsWhy}</p><p>{variant.safetyNotes}</p>
      </> : <p>{variant.content}</p>}
      <Sources lesson={lesson} refs={variant.sourceRefs}/>
      <button onClick={() => setReview(undefined)}>Close material review</button>
    </section>}
  </>;
}
