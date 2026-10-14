import type { LessonPackage, ProgressRecord, TutorReply } from '@coteacher/shared';
import { TutorSources } from './TutorSources';
import { Sources } from './Visual';
import { clock } from './student-ui';

/** Question reading and answers stay in the contextual recorded player. */
export function PlayerQuestions({ lesson, progress, saved, open, replies = [], conceptId, onHear }: { lesson: LessonPackage; progress: ProgressRecord; saved: string; open: boolean; replies?: TutorReply[]; conceptId?: string; onHear?: (reply: TutorReply) => void }) {
  const prepared = progress.events.flatMap((event, index) => {
    if (event.type !== 'question-matched' || !event.originalText || !event.recordedContext) return [];
    const answer = lesson.questionBank.find(question => question.id === event.questionId);
    return answer ? [{ key: 'prepared-' + index, text: event.originalText, askedAt: event.timestamp,
      conceptId: event.recordedContext.conceptId, positionMs: event.recordedContext.positionMs,
      state: 'Prepared offline answer', answer: answer.answer, refs: answer.sourceRefs }] : [];
  });
  const pending = progress.queuedQuestions.map(question => ({ key: question.id, text: question.text, askedAt: question.askedAt,
    conceptId: question.recordedContext?.conceptId ?? lesson.timeline.find(step => step.id === question.timelineStepId)?.conceptId,
    positionMs: question.recordedContext?.positionMs,
    state: question.answered ? question.answerOrigin === 'simulated-prepared' ? 'Answered · prepared demo response' : 'Answered · returned guidance' : 'Saved · waiting for connection',
    answer: question.answered ? question.answer : '', refs: question.answered ? question.sourceRefs : [] }));
  const questions = [...prepared, ...pending].sort((a, b) => Date.parse(b.askedAt) - Date.parse(a.askedAt));
  if (!questions.length) return null;
  return <details className="player-questions" open={open}><summary>Your lesson questions · {questions.length}</summary>
    <p className="helper-note" role="status">{saved === 'Saved on this device' ? 'Your questions are saved on this device.' : saved || 'Saving your questions…'}</p>
    {questions.map(question => { const reply = question.answer ? undefined : replies.find(reply => reply.questionId === question.key); return <article key={question.key}>
      <span className="status-pill">{reply ? reply.review === 'flagged' ? 'Needs teacher review' : reply.status === 'answered' ? reply.engine === 'mock' ? 'Answered · mocked test response' : 'Answered · AI-generated guidance' : reply.status === 'deferred' ? 'Needs teacher guidance · insufficient support' : reply.status === 'failed' ? 'Saved · retry needed' : 'Checking lesson sources' : question.state}</span><h3>{question.text}</h3>
      <p className="helper-note">{lesson.concepts.find(concept => concept.id === question.conceptId)?.title}
        {' · '}{question.positionMs === undefined ? 'Earlier question · playback time unavailable' : `At ${clock(question.positionMs)} (${question.positionMs} ms)`}
        {' · '}<time dateTime={question.askedAt}>{new Date(question.askedAt).toLocaleString()}</time></p>
      {reply && reply.review !== 'flagged' ? <><p>{reply.text}</p>{reply.status === 'answered' && <><TutorSources reply={reply}/>{reply.speechBase64 && onHear && <button disabled={conceptId !== reply.conceptId} onClick={() => onHear(reply)}>Hear saved answer</button>}{conceptId !== reply.conceptId && <p>Open this question's concept to hear its explanation.</p>}</>}</> : question.answer ? <><p>{question.answer}</p><details><summary>Answer sources</summary><Sources lesson={lesson} refs={question.refs}/></details></>
        : <p>There isn’t a prepared offline answer for this question. It stays pending until reviewed guidance is returned. Keep learning while you wait.</p>}
    </article>; })}
  </details>;
}
