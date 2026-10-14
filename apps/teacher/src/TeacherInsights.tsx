import { useState } from 'react';
import { profiles, seededRecords, visualCatalog, type LessonPackage, type LessonRecording, type ProgressRecord } from '@coteacher/shared';
import { Sources } from '../../student/src/Visual';
import { ReplayVisual } from '../../student/src/ReplayVisual';
import { clock } from '../../student/src/student-ui';
import { describeInsightEvent, lessonInsights, questionPosition } from './insights';
import { TutorOversight } from './TutorOversight';

export function TeacherInsights({ lesson, recording, records, approved, busy, syncStatus, onSync, onReview }: {
  lesson: LessonPackage; recording: LessonRecording | null; records: ProgressRecord[]; approved: boolean; busy: boolean;
  syncStatus: string; onSync: () => void; onReview: (conceptId: string, variantId: string) => void;
}) {
  const [source, setSource] = useState<'seeded' | 'received'>(records.some(record => record.lessonId === lesson.lessonId) ? 'received' : 'seeded');
  const seeded = lessonInsights(lesson, seededRecords()), received = lessonInsights(lesson, records);
  const data = source === 'seeded' ? seeded : received;
  const [selected, setSelected] = useState(() => data.concepts.reduce((highest, item) => item.learnersWithSignals > highest.learnersWithSignals ? item : highest).concept.id);
  const detail = data.concepts.find(item => item.concept.id === selected) ?? data.concepts[0];
  const highestSignals = Math.max(...data.concepts.map(item => item.learnersWithSignals));
  const concept = detail.concept;
  const suggested = concept.variants.find(variant => variant.type === 'tryit') ?? concept.variants.find(variant => variant.type === 'stepwise') ?? concept.variants[0];
  const cues = recording?.lessonId === lesson.lessonId ? recording.cues.filter(cue => cue.conceptId === concept.id) : [];
  const assets = recording?.visualReview?.status === 'approved' ? visualCatalog().filter(asset => asset.conceptId === concept.id) : [];
  return <>
    <section className="content-card insights-filter" aria-label="Insights data source">
      <div><label htmlFor="insights-lesson">Lesson</label><select id="insights-lesson" defaultValue={lesson.lessonId} key={lesson.lessonId}><option value={lesson.lessonId}>{lesson.title}</option></select><p className="small">{lesson.subject} · {lesson.classLevel} · One-lesson sprint demo</p></div>
      <div><label htmlFor="insights-source">Learning records</label><select id="insights-source" value={source} onChange={event => setSource(event.target.value as typeof source)}><option value="received">Received demo interactions</option><option value="seeded">Simulated class · 18 seeded learners</option></select><p className="small">{source === 'seeded' ? 'Fabricated classroom observations for demonstration.' : 'Actual app interactions from simulated learner profiles; received by school sync or validated file transfer.'} These sources are never combined.</p></div>
      <div><button disabled={busy} onClick={onSync}>Refresh school records</button><p className="small" role="status">{syncStatus}</p></div>
    </section>
    <div className="insight-summary"><article><strong>{seeded.records.length}</strong><span>Seeded learners · simulated</span></article><article data-stat="received"><strong>{received.records.length}</strong><span>Received learner snapshots</span></article><article><strong>{received.concepts.reduce((sum, item) => sum + item.pendingQuestions, 0)}</strong><span>Pending received questions</span></article></div>
    {!data.records.length && <section className="teacher-empty"><h2>No received learning records yet.</h2><p>Sync a learner’s saved progress or receive a school transfer. You can explore the separately labelled simulated class meanwhile.</p></section>}
    <div className="teacher-grid"><section className="content-card">
      <p className="eyebrow">{source === 'seeded' ? 'SIMULATED CLASS' : 'RECEIVED DEMO INTERACTIONS'}</p><h2>A map of the difficult moments.</h2>
      <p className="small">Support signals: explanation requests, incorrect checks, retries, questions needing follow-up or pending questions. Each learner counts once per concept. A pause alone is context, not a struggle signal.</p>
      <div className="heatmap" aria-label="Concept support signals">{data.concepts.map(item => <div className="heat-row" key={item.concept.id} data-concept-id={item.concept.id} data-highest-signals={item.learnersWithSignals > 0 && item.learnersWithSignals === highestSignals}>
        <button aria-pressed={concept.id === item.concept.id} onClick={() => setSelected(item.concept.id)}>{item.concept.title}</button>
        <span>{item.learnersWithSignals} / {data.records.length} learners with support signals</span>
        {item.learnersWithSignals > 0 && item.learnersWithSignals === highestSignals && <span>Most learners with signals in this group</span>}
        <div className="heat-track" aria-hidden="true"><span style={{ width: `${data.records.length ? item.learnersWithSignals / data.records.length * 100 : 0}%` }}/></div>
        <p className="small">{item.explanationRequests} explanation requests · {item.incorrectChecks} incorrect checks · {item.retries} retries · {item.pendingQuestions} pending questions</p>
      </div>)}</div>
    </section><aside className="nudge" data-recommendation-concept-id={concept.id}>
      <p className="eyebrow">NEXT TIME YOU TEACH · {source === 'seeded' ? 'SIMULATED EVIDENCE' : 'RECEIVED DEMO EVIDENCE'}</p>
      <h2>{detail.learnersWithSignals ? 'Give this moment another look.' : 'Keep this material close.'}</h2>
      <p>{detail.learnersWithSignals ? `${detail.learnersWithSignals} learner${detail.learnersWithSignals === 1 ? '' : 's'} showed support signals for ${concept.title.toLowerCase()}.` : 'No support signals recorded for this concept in the selected group. This is an available teaching option, not a data-based finding.'}</p>
      <p>{suggested.type === 'tryit' ? 'Revisit the approved hands-on demonstration, ask learners what it shows, then connect their observation to the original explanation.' : 'Revisit the prepared explanation and ray diagram, then use the concept’s understanding check.'}</p>
      <p className="small">Same learning objective: {lesson.objective.text}</p>
      <Sources lesson={lesson} refs={suggested.sourceRefs}/>
      <button disabled={!approved || busy} onClick={() => onReview(concept.id, suggested.id)}>Review this {suggested.type === 'tryit' ? 'activity' : 'explanation'}</button>
      {!approved && <p className="small">Prepare and approve this lesson to reopen the material in your teaching studio.</p>}
      <p className="small">A prepared teaching suggestion, not evidence of effectiveness.</p>
    </aside></div>
    <section className="content-card insight-context" aria-label="Original classroom context">
      <h2>{concept.title}: classroom context</h2><p className="small">Concept ID: {concept.id} · {detail.steps.map(step => step.id).join(', ')}</p>
      {detail.steps.map(step => <blockquote key={step.id}>{step.teacherSaid}</blockquote>)}
      <p>{cues.length ? `Recorded classroom appearances: ${cues.map(cue => clock(cue.offsetMs)).join(', ')}. Repeated appearances share this concept ID.` : 'No captured recording timeline for this concept yet. The original prepared lesson steps are shown.'}</p>
      <Sources lesson={lesson} refs={concept.sourceRefs}/>
    </section>
    <section className="content-card contributing-events"><h2>{concept.title}: observed learning events</h2>
      <p className="small">{source === 'seeded' ? 'Simulated seed observations.' : 'Received demo interactions.'} These indicators suggest a follow-up; they do not diagnose difficulty or establish mastery. {detail.pauses} pauses recorded separately.</p>
      {!detail.contributors.length && <p>No interactions recorded for this concept in the selected group.</p>}
      {detail.contributors.map(item => <details key={item.record.studentId}><summary>{profiles.find(profile => profile.id === item.record.studentId)?.label ?? `Seeded learner ${item.record.studentId.slice(-4)}`} · {item.events.length} events · {item.pendingQuestions} pending questions</summary>
        <p className="small">Snapshot exported: {new Date(item.record.exportedAt).toLocaleString()} · Learner ID: {item.record.studentId}</p>
        <ul>{item.events.map((event, index) => <li key={event.eventId ?? index}>{describeInsightEvent(event, lesson)}<small>{new Date(event.timestamp).toLocaleString()}{event.eventId ? ` · Event ${event.eventId}` : ' · Legacy event (no event ID)'}</small></li>)}</ul>
        {item.questions.map(question => <article className="insight-question" key={question.id}><strong>{question.answered ? question.answerOrigin === 'simulated-prepared' ? 'Answered · prepared demo response' : 'Answered' : 'Pending'} · {question.timelineStepId}{questionPosition(question)}</strong><p>{question.text}</p>{question.answered && <><p>{question.answer}</p><Sources lesson={lesson} refs={question.sourceRefs}/></>}</article>)}
      </details>)}
    </section>
    <section className="content-card stats"><h2>Which explanations were explored?</h2>
      <p className="small">{source === 'seeded' ? 'Simulated observations' : 'Received demo observations'} only. Checks are attributed to the most recently viewed explanation of this concept, in recorded event order. Counts include retries. Learners can view several versions; small, self-selected samples do not establish effectiveness, statistical significance, causation or long-term learning.</p>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Explanation use table; scroll to see all columns"><table><caption>Explanation use for {concept.title}</caption><thead><tr><th>Explanation</th><th>Learners who viewed</th><th>Views</th><th>Later checks</th><th>Correct checks</th></tr></thead><tbody>{detail.variants.map(item => <tr key={item.variant.id}><td>{item.variant.type}</td><td>{item.viewers}</td><td>{item.views}</td><td>{item.checks}</td><td>{item.correct}</td></tr>)}</tbody></table></div>
      <p className="small">Checks without a prior explanation-view event are excluded from this table and remain in the concept indicators above. Assigned playback visuals are not counted as explicit explanation requests.</p>
      {!!assets.length && <div className="insight-visuals"><h3>Approved visual representations</h3>{assets.map(asset => {
        const events = detail.contributors.flatMap(item => item.events.filter(event => event.type === 'visual-explored' && event.visualAssetId === asset.id));
        const learners = detail.contributors.filter(item => item.events.some(event => event.type === 'visual-explored' && event.visualAssetId === asset.id)).length;
        const choices = events.filter(event => event.type === 'visual-explored' && event.origin === 'learner-choice').length;
        return <details key={asset.id}><summary>{asset.title} · {learners} learners · {events.length} views · {choices} explicit choices</summary><ReplayVisual asset={asset}/><Sources lesson={lesson} refs={asset.sourceRefs}/></details>;
      })}</div>}
    </section>
    <TutorOversight lessonId={lesson.lessonId}/>
  </>;
}
