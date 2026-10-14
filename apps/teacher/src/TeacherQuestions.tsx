import { useState } from 'react';
import { profiles, type LessonPackage, type ProgressRecord, type TutorState } from '@coteacher/shared';
import { TutorSources } from '../../student/src/TutorSources';
import { Sources } from '../../student/src/Visual';
import { clock } from '../../student/src/student-ui';
import { TutorOversight } from './TutorOversight';

export function TeacherQuestions({ lesson, records, approved, onConcept, onReview, onTransfer }: {
  lesson: LessonPackage; records: ProgressRecord[]; approved: boolean;
  onConcept: (stepId: string) => void; onReview: (record: ProgressRecord) => void; onTransfer: () => void;
}) {
  const [status, setStatus] = useState('all');
  const [conceptId, setConceptId] = useState('all');
  const [tutorStates, setTutorStates] = useState<TutorState[]>([]);
  const questions = records.flatMap(record => record.queuedQuestions.map(question => ({ record, question, reply: tutorStates.find(state => state.studentId === record.studentId)?.replies.find(reply => reply.questionId === question.id && reply.status === 'answered' && reply.review !== 'flagged'), concept: lesson.concepts.find(concept => concept.id === lesson.timeline.find(step => step.id === question.timelineStepId)?.conceptId) })))
    .filter(entry => (status === 'all' || Boolean(entry.question.answered || entry.reply) === (status === 'answered')) && (conceptId === 'all' || entry.concept?.id === conceptId))
    .sort((a,b) => Date.parse(b.question.askedAt) - Date.parse(a.question.askedAt));
  return <section className="content-card question-inbox"><p className="eyebrow">YOUR CLASSROOM INBOX</p><h1>Student questions</h1><span className="badge">{lesson.title}</span><p>A good question is a chance to reconnect. Each question belongs to an exact classroom concept.</p>
    <div className="question-filters"><nav aria-label="Question status">{[['all','All questions'],['pending','Needs review'],['answered','Answered']].map(([value,title]) => <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>{title}</button>)}</nav><div><label htmlFor="question-concept">Lesson concept</label><select id="question-concept" value={conceptId} onChange={event => setConceptId(event.target.value)}><option value="all">All concepts</option>{lesson.concepts.map(concept => <option key={concept.id} value={concept.id}>{concept.title}</option>)}</select></div></div>
    {!questions.length && <p>{records.some(record => record.queuedQuestions.length) ? 'No questions match this view.' : 'No questions received yet.'}</p>}
    {questions.map(({ record, question, concept, reply }) => <article key={record.studentId + question.id}><span className="badge">{question.answered ? 'Answered' : reply ? reply.engine === 'mock' ? 'Answered · mocked test response' : 'Answered · AI guidance, unreviewed' : 'Needs teacher review'}</span><h3>{question.text}</h3><p>{profiles.find(profile => profile.id === record.studentId)?.label} · {concept?.title} · <time dateTime={question.askedAt}>{new Date(question.askedAt).toLocaleString()}</time></p>{question.recordedContext && <p className="helper-note">Recorded lesson · {clock(question.recordedContext.positionMs)}</p>}{question.answered && <><p>{question.answer}</p><Sources lesson={lesson} refs={question.sourceRefs}/></>}{reply && !question.answered && <><p>{reply.text}</p><TutorSources reply={reply}/></>}<div className="teacher-card-actions"><button disabled={!approved} onClick={() => onConcept(question.timelineStepId)}>Open this concept</button><button onClick={() => onReview(record)}>Review & return guidance</button></div></article>)}
    <button onClick={onTransfer}>Receive progress & return answers</button>
    <TutorOversight lessonId={lesson.lessonId} onStates={setTutorStates}/>
  </section>;
}
