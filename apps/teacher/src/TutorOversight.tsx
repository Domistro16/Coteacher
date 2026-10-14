import { useEffect, useState } from 'react';
import { profiles, type TutorState } from '@coteacher/shared';
import { TutorSources } from '../../student/src/TutorSources';
import { clock } from '../../student/src/student-ui';

/** Teacher oversight of actual generated responses, separate from seeded classroom analytics. */
export function TutorOversight({ lessonId, onStates }: { lessonId: string; onStates?: (states: TutorState[]) => void }) {
  const [states, setStates] = useState<TutorState[]>([]), [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    try {
      const response = await fetch('/api/tutor/overview');
      if (!response.ok) throw new Error('Connected tutor records are unavailable.');
      const value = await response.json(), received = value.states.filter((state: TutorState) => state.lessonId === lessonId); setStates(received); onStates?.(received);
      setStatus(value.provider === 'mock' ? 'Mock provider · test responses. Learner interactions are actual demo events.' : value.provider === 'openai' ? 'OpenAI integration configured · inspect each response origin below.' : 'OpenAI is not configured. Prepared learning and school transfers remain available.');
    } catch (error) { setStatus((error as Error).message); } finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, [lessonId]);
  return <section className="content-card"><p className="eyebrow">CONNECTED COACH OVERSIGHT</p><h2>Answers and observed learning needs</h2><p>Fictional learner profiles. Memory reflects received interactions, not permanent learning styles or proven mastery. AI replies are logged without individual preapproval; prepared packages remain teacher-approved.</p><button disabled={busy} onClick={() => void refresh()}>Refresh tutor records</button><p role="status">{status}</p>
    {!states.some(state => state.replies.length || state.memory.observations.length || state.liveTurns?.length || state.checks?.length) && <p>No connected tutor interactions received yet.</p>}
    {states.map(state => <article key={state.studentId}><h3>{profiles.find(profile => profile.id === state.studentId)?.label}</h3><p>{state.memory.observations.length} observed interactions · memory revision {state.memory.revision}</p>{state.memory.recommendations.map(entry => <p key={entry.conceptId}><strong>{entry.conceptId}</strong> · {entry.reason} ({entry.evidenceEventIds.length} evidence events; approved visual {entry.visualAssetId})</p>)}
      {state.replies.map(reply => <details key={reply.questionId}><summary>{reply.originalText} · {reply.status} · {reply.engine === 'mock' ? 'Mock test response' : reply.engine} · {reply.review}</summary><p>{reply.conceptId} · {clock(reply.positionMs)} · {reply.model}</p><p>{reply.text}</p>{reply.citations.length > 0 && <TutorSources reply={reply}/>}<button disabled={busy || reply.review === 'flagged'} onClick={async () => { setBusy(true); try { const response = await fetch(`/api/tutor/flag/${state.studentId}/${reply.questionId}`, { method: 'POST' }); if (!response.ok) throw new Error('Flag could not be saved.'); await refresh(); } catch (error) { setStatus((error as Error).message); } finally { setBusy(false); } }}>Flag for teacher review</button></details>)}
      {Boolean(state.liveTurns?.length) && <details><summary>Live voice conversation log ({state.liveTurns!.length} entries)</summary><p>Device-reported speech transcripts. The voice model paraphrases checked backend results; transcript accuracy and every spoken word are not independently verified. Sources below are the supplied result context. Teaching output awaiting backend checks is muted; brief checking acknowledgements may play. The log can include suppressed speech.</p>{state.liveTurns!.map(turn => <article key={turn.id}><strong>{turn.role === 'student' ? 'Learner' : 'AI avatar'} · {turn.conceptId} · {clock(turn.positionMs)}</strong><p>{turn.text}</p><small>{turn.model} · {turn.observedAt}{turn.sourceRefs.length ? ' · Source context: ' + turn.sourceRefs.join(', ') : ' · No source context attached; inspect before reusing'}</small></article>)}</details>}
      {state.checks?.map(check => <details key={check.id}><summary>Question-focused check · {check.originalText} · {check.engine === 'mock' ? 'Mock test check' : 'AI-generated check'}</summary>
        <p>{check.prompt}</p><ol>{check.options.map(option => <li key={option}>{option}</li>)}</ol><p>{check.explanation}</p><p>{check.personalization.reason}</p><TutorSources reply={check}/>
        <p>{state.checkAttempts?.filter(a => a.checkId === check.id).length ?? 0} saved attempts</p>{state.checkAttempts?.filter(a => a.checkId === check.id).map(attempt => <p key={attempt.id}>Option {attempt.selectedIndex + 1} · {attempt.correctness ? 'Correct attempt' : 'Incorrect attempt'} · {attempt.answeredAt}</p>)}
      </details>)}
    </article>)}
  </section>;
}
