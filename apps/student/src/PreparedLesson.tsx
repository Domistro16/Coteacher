import { useEffect, useMemo, useRef, useState } from 'react';
import { activityCaptions, chooseQuiz, quizCaption, quizFeedback, recordingCueAt, voiceMessages, type LessonPackage, type ProgressEvent, type QuizItem, type TryItVariant } from '@coteacher/shared';
import type { Snapshot } from './storage';
import { Visual } from './Visual';
import { RecordedLesson } from './RecordedLesson';
import { adaptRecordedMoment, exploreRecordedVisual } from './recorded-help';
import { activityCheckProgress, answerUnderstandingCheck } from './activity-check';
import { createSpeechInput } from './speech';
import { handleStudentRequest, type StudentResponse } from './help';
import { Narrator, type NarratorHandle } from './Narrator';
import type { NarrationFrame } from './narration';
import {
  selectedVariant, transitionPlayer, variantLabels,
  createPlayerModel, type PlayerAction, type PlayerState,
} from './player';

function Sources({ lesson, sourceRefs }: { lesson: LessonPackage; sourceRefs: readonly string[] }) {
  return (
    <div className="sources" role="group" aria-label="Sources">
      <p className="eyebrow">Sources</p>
      <ul>{sourceRefs.map(id => {
        const source = lesson.sources.find(item => item.id === id)!;
        return <li key={id}><strong>{source.title}</strong><span>{source.citation}</span></li>;
      })}</ul>
    </div>
  );
}

function TryIt({ variant, activity, dispatch }: {
  variant: TryItVariant;
  activity: NonNullable<PlayerState['activity']>;
  dispatch: (action: PlayerAction) => void;
}) {
  return (
    <div className="activity">
      <p className="explanation">{variant.content}</p>
      {activity.phase === 'intro' ? <>
        <h4>What you need</h4>
        <ul className="materials">{variant.items.map(item => <li key={item}>{item}</li>)}</ul>
        <section className="safety" aria-label="Safety notes">
          <h4>Before you start</h4>
          <ul>{variant.safetyNotes.map(note => <li key={note}>{note}</li>)}</ul>
        </section>
        <button className="primary" type="button" onClick={() => dispatch({ type: 'start-activity' })}>Start activity</button>
      </> : <>
        <details className="safety">
          <summary>Safety notes</summary>
          <ul>{variant.safetyNotes.map(note => <li key={note}>{note}</li>)}</ul>
        </details>
        {activity.phase === 'steps' ? <>
          <p className="eyebrow">Instruction {activity.instructionIndex + 1} of {variant.steps.length}</p>
          <p className="instruction">{variant.steps[activity.instructionIndex]}</p>
          <div className="activity-actions">
            <button type="button" onClick={() => dispatch({ type: 'previous-instruction' })}>Previous instruction</button>
            <button className="primary" type="button" onClick={() => dispatch({ type: 'next-instruction' })}>
              {activity.instructionIndex + 1 === variant.steps.length ? 'See why it works' : 'Next instruction'}
            </button>
          </div>
        </> : <>
          <h4>Why it works</h4>
          <p className="explanation">{variant.explainsWhy}</p>
          <p>When you have finished, return to the concept and check what the activity demonstrates. Reporting completion does not count as understanding.</p>
          <div className="activity-actions">
            <button type="button" onClick={() => dispatch({ type: 'previous-instruction' })}>Previous instruction</button>
            <button className="primary" type="button" onClick={() => dispatch({ type: 'complete-activity' })}>Done — return to teacher</button>
          </div>
        </>}
      </>}
    </div>
  );
}

export function PreparedLesson({ snapshot, update }: { snapshot: Snapshot; update: (next: Snapshot) => void }) {
  const latest = useRef(snapshot); latest.current = snapshot;
  function commit(next: Snapshot) { latest.current = next; update(next); }
  const { lesson, progress, player: state } = snapshot;
  const model = useMemo(() => createPlayerModel(lesson), [lesson]);
  const current = model.steps[state.timelineIndex];
  const variant = selectedVariant(model, state);
  const [draft, setDraft] = useState('');
  const [response, setResponse] = useState<StudentResponse>({});
  const [announcement, setAnnouncement] = useState<NarrationFrame[] | null>(null);
  const narrator = useRef<NarratorHandle>(null);
  const questionInput = useRef<HTMLTextAreaElement>(null);
  const [speechStatus, setSpeechStatus] = useState('Hold to talk, or type below.');
  const lastActivity = [...progress.events].reverse().find(event => event.type === 'tryit-completed');
  const pendingActivity = lastActivity && !progress.events.slice(progress.events.indexOf(lastActivity) + 1).some(event => event.type === 'quiz-answered' && event.conceptId === lastActivity.conceptId);
  const [quizOpen, setQuizOpen] = useState(Boolean(pendingActivity));
  const [quizConceptId, setQuizConceptId] = useState<string | null>(pendingActivity ? lastActivity!.conceptId : null);
  const [teacherWordsOpen, setTeacherWordsOpen] = useState(false);
  const [studyOpen, setStudyOpen] = useState(!lesson.recording || Boolean(state.recording?.support));
  const speech = useMemo(createSpeechInput, []);
  useEffect(() => {
    const stop = () => speech.stop();
    const visibility = () => { if (document.hidden) stop(); };
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', visibility);
    return () => { stop(); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', visibility); };
  }, [speech]);
  const stamp = () => new Date().toISOString();
  function record(events: ProgressEvent[], player = state) {
    commit({ ...snapshot, player, progress: { ...progress, events: [...progress.events, ...events] } });
  }
  function dispatch(action: PlayerAction) {
    const next = transitionPlayer(model, state, action, stamp());
    if (next.player === state) return;
    record(next.events, next.player);
    setTeacherWordsOpen(action.type === 'revisit-step');
    setResponse({});
    setAnnouncement(null);
    if (action.type === 'complete-activity') {
      const conceptId = model.steps[next.player.timelineIndex].concept.id;
      setQuizConceptId(conceptId); setQuizOpen(true);
    }
  }
  function requestHelp(text: string) {
    const next = handleStudentRequest(model, state, progress, text, stamp(), () => 'queued-' + crypto.randomUUID());
    if (next.response.command === 'pause') { narrator.current?.pause(); return; }
    if (next.response.command === 'repeat' || next.response.command === 'replay') { narrator.current?.replay(); return; }
    if (next.response.command === 'quiz') {
      setQuizConceptId(null); setQuizOpen(true); setAnnouncement(chooseQuiz(lesson, progress).map(item => ({ text: quizCaption(item), refs: item.sourceRefs }))); return;
    }
    commit({ ...snapshot, player: next.player, progress: next.progress });
    setResponse(next.response);
    setAnnouncement(null);
  }
  function pauseHere() { requestHelp('explain again'); }
  function submit() {
    const text = draft.trim();
    if (!text) return;
    requestHelp(text);
    setDraft('');
  }
  const activityStatus = state.activity ? state.activity.phase === 'intro' ? 'Before you start' : state.activity.phase === 'why' ? 'Why it works' : `Instruction ${state.activity.instructionIndex + 1} of ${variant.type === 'tryit' ? variant.steps.length : 0}` : '';
  const quiz = quizConceptId ? lesson.quiz.filter(item => item.conceptId === quizConceptId) : chooseQuiz(lesson, progress);
  const completedActivities = lesson.concepts.flatMap(concept => concept.variants.filter((entry): entry is TryItVariant => entry.type === 'tryit'))
    .map(variant => ({ variant, ...activityCheckProgress(lesson, progress, variant) })).filter(entry => entry.reported);
  const refresher = lesson.route.insertedRefreshers.find(r => r.beforeConceptId === current.concept.id);
  const refresherVariant = refresher && lesson.concepts.find(c => c.id === refresher.conceptId)?.variants.find(v => v.id === refresher.variantId);
  const activity = current.variants.find(v => v.type === 'tryit');
  const answer = response.question;
  const frames = useMemo<NarrationFrame[]>(() => {
    if (announcement) return announcement;
    const result: NarrationFrame[] = [];
    const add = (text: string, refs: readonly string[] = []) => result.push({ text, refs });
    if (response.notice) add(response.notice);
    if (response.question) add(response.question.text, response.question.refs);
    if (response.help && 'variant' in response.help) {
      if (response.question && !response.question.refs.length) add(voiceMessages.related);
      add(response.help.variant.content, response.help.variant.sourceRefs);
    }
    else if (response.help || (response.question && !response.question.refs.length && !response.question.related)) {
      add(voiceMessages.exhausted); add(activity ? voiceMessages.activityOffer : voiceMessages.questionOffer);
    }
    if (response.question?.related && !response.help) {
      add(voiceMessages.related); add(response.question.related.content, response.question.related.sourceRefs);
    }
    if (!result.length) {
      if (variant.type === 'tryit' && state.activity) activityCaptions(variant, state.activity).forEach(text => add(text, variant.sourceRefs));
      else add(variant.content, variant.sourceRefs);
    }
    return result;
  }, [announcement, response, variant, state.activity, activity]);
  const returnedSeen = useRef(new Set(progress.queuedQuestions.filter(q => q.answered).map(q => q.id)));
  useEffect(() => {
    const arrived = progress.queuedQuestions.filter(q => q.answered && !returnedSeen.current.has(q.id));
    if (arrived.length) {
      arrived.forEach(q => returnedSeen.current.add(q.id));
      setAnnouncement(arrived.flatMap(q => q.answered ? [{ text: q.answer, refs: q.sourceRefs }] : []));
    }
  }, [progress.queuedQuestions]);
  function speechFeedback(status: string) {
    setSpeechStatus(status);
    if (!status.startsWith('Listening')) { speech.stop(); setAnnouncement([{ text: status, refs: [] }]); }
  }
  function startSpeech() { narrator.current?.pause(); void speech.start(setDraft, speechFeedback); }
  function toggleQuiz() {
    setQuizConceptId(null);
    setQuizOpen(!quizOpen);
    setAnnouncement(quizOpen ? null : chooseQuiz(lesson, progress).map(item => ({ text: quizCaption(item), refs: item.sourceRefs })));
  }
  function answerQuiz(item: QuizItem, index: number) {
    const correctness = index === item.correctIndex;
    const current = latest.current;
    commit({ ...current, progress: answerUnderstandingCheck(lesson, current.progress, item.id, index, stamp()) });
    setAnnouncement([{ text: quizFeedback(item, correctness), refs: item.sourceRefs }]);
  }
  function markRefresherViewed(open: boolean) {
    if (!open || !refresher || !refresherVariant) return;
    setAnnouncement([{ text: refresherVariant.content, refs: refresherVariant.sourceRefs }]);
    const origin = model.steps.slice(0, state.timelineIndex + 1).reverse().find(entry => entry.concept.id === refresher.conceptId);
    if (!origin || progress.events.some(e => e.type === 'variant-viewed' && e.timelineStepId === origin.step.id && e.variantId === refresherVariant.id)) return;
    record([{ type: 'variant-viewed', timestamp: stamp(), conceptId: origin.concept.id, timelineStepId: origin.step.id, variantId: refresherVariant.id }]);
  }
  return <>
    {!lesson.recording && <p className="small">Legacy prepared-content demo · this saved package has no classroom recording. Open the published teacher lesson above to watch it.</p>}
    <header className="lesson-header"><p className="eyebrow">{lesson.subject} · Your classroom, again</p><h1>{lesson.title}</h1><details className="objective" onToggle={e => { if (e.currentTarget.open) setAnnouncement([{ text: lesson.objective.text, refs: [...new Set(lesson.concepts.flatMap(c => c.sourceRefs))] }]); }}><summary>What you will learn</summary><p>{lesson.objective.text}</p></details></header>
    {lesson.recording && <RecordedLesson lesson={lesson} recording={lesson.recording} onPlayed={() => {
      setStudyOpen(false);
      narrator.current?.pause();
      const current = latest.current;
      if (current.player.recording?.support) {
        const { support, ...recording } = current.player.recording;
        commit({ ...current, player: { ...current.player, recording } }); setResponse({}); setAnnouncement(null);
      }
    }} support={state.recording?.support}
      positionMs={state.recording?.recordingId === lesson.recording.id ? state.recording.positionMs : 0}
      onPosition={positionMs => {
        const current = latest.current, support = current.player.recording?.support;
        const cue = recordingCueAt(lesson.recording!, positionMs);
        commit({ ...current, player: { ...current.player, recording: { recordingId: lesson.recording!.id, positionMs,
          ...(support?.timelineStepId === cue.timelineStepId ? { support } : {}) } } });
      }}
      onOpenMoment={timelineStepId => {
        setStudyOpen(true);
        const current = latest.current;
        const next = transitionPlayer(model, current.player, { type: 'revisit-step', timelineStepId }, stamp());
        commit({ ...current, player: next.player, progress: { ...current.progress, events: [...current.progress.events, ...next.events] } });
        setTeacherWordsOpen(true); setResponse({}); setAnnouncement(null);
      }} onExplainMoment={(timelineStepId, positionMs, detail = '') => {
        setStudyOpen(true);
        const current = latest.current;
        if (lesson.playback) {
          const next = adaptRecordedMoment(lesson, current.player, current.progress, positionMs, detail, stamp(), () => 'queued-' + crypto.randomUUID());
          commit({ ...current, player: next.player, progress: next.progress }); setResponse(next.response); setTeacherWordsOpen(true); setAnnouncement(null);
          return;
        }
        const destination = transitionPlayer(model, current.player, { type: 'revisit-step', timelineStepId }, stamp());
        const progress = { ...current.progress, events: [...current.progress.events, ...destination.events] };
        const next = handleStudentRequest(model, destination.player, progress, 'explain again', stamp(), () => 'queued-' + crypto.randomUUID());
        commit({ ...current, player: next.player, progress: next.progress }); setResponse(next.response); setTeacherWordsOpen(true); setAnnouncement(null);
      }} onExploreVisual={lesson.playback ? (visualAssetId, positionMs) => {
        const current = latest.current;
        const next = exploreRecordedVisual(lesson, current.player, current.progress, positionMs, visualAssetId, stamp());
        commit({ ...current, ...next });
      } : undefined} onCheckMoment={timelineStepId => {
        setStudyOpen(true);
        const current = latest.current;
        const next = model.steps[current.player.timelineIndex].step.id === timelineStepId ? { player: current.player, events: [] }
          : transitionPlayer(model, current.player, { type: 'revisit-step', timelineStepId }, stamp());
        const progress = { ...current.progress, events: [...current.progress.events, ...next.events] };
        commit({ ...current, player: next.player, progress }); setQuizConceptId(model.steps[next.player.timelineIndex].concept.id); setQuizOpen(true);
        setAnnouncement(lesson.quiz.filter(item => item.conceptId === model.steps[next.player.timelineIndex].concept.id).map(item => ({ text: quizCaption(item), refs: item.sourceRefs })));
      }} onActivityMoment={timelineStepId => {
        const current = latest.current;
        const destination = transitionPlayer(model, current.player, { type: 'revisit-step', timelineStepId }, stamp());
        const activity = model.steps[destination.player.timelineIndex].variants.find(variant => variant.type === 'tryit');
        if (!activity) return;
        const next = transitionPlayer(model, destination.player, { type: 'select-variant', variantId: activity.id }, stamp());
        commit({ ...current, player: next.player, progress: { ...current.progress, events: [...current.progress.events, ...destination.events, ...next.events] } });
        setStudyOpen(true); setResponse({}); setAnnouncement(null);
      }}/>}
    <section className="study-support" aria-label="Concept help and practice" hidden={Boolean(lesson.recording) && !studyOpen}>
    {lesson.recording && <div className="support-heading"><h2>Explore this lesson moment</h2><button className="primary" onClick={() => window.dispatchEvent(new Event('coteacher-resume-recording'))}>Continue watching the teacher</button></div>}
    <Narrator ref={narrator} frames={frames} sources={refs => <Sources lesson={lesson} sourceRefs={refs}/>}/>
    <details className="lesson-timeline"><summary>{lesson.classroomTimeline ? 'Revisit the classroom timeline' : 'Revisit a lesson concept'}</summary>
      <p>{lesson.classroomTimeline ? 'These are the moments your teacher displayed, including moments revisited in class.' : 'Choose an exact moment from your lesson.'}</p>
      <nav aria-label="Learner concept timeline"><ol>{(lesson.classroomTimeline?.visits ?? lesson.timeline.map(step => ({ timelineStepId: step.id, conceptId: step.conceptId }))).map((entry, index) =>
        <li key={index}><button data-timeline-step-id={entry.timelineStepId} data-concept-id={entry.conceptId}
          aria-current={current.step.id === entry.timelineStepId ? 'step' : undefined}
          onClick={() => dispatch({ type: 'revisit-step', timelineStepId: entry.timelineStepId })}>
          {index + 1}. {lesson.concepts.find(concept => concept.id === entry.conceptId)!.title}
        </button></li>)}</ol></nav>
    </details>
    <section className="lesson-step" aria-labelledby="concept-title" data-step-id={current.step.id} data-concept-id={current.concept.id} data-lesson-id={lesson.lessonId}>
      <div className="step-header"><p className="eyebrow">Step {state.timelineIndex + 1} of {model.steps.length}</p><h2 id="concept-title">{current.concept.title}</h2></div>
      <div className="step-dots" aria-label="Lesson progress">{model.steps.map((entry, index) => <span key={entry.step.id} className={index === state.timelineIndex ? 'active' : ''}>{index + 1}</span>)}</div>
      <div className="original-action"><span>{variant.type === 'original' ? 'Following your teacher' : 'Explore another explanation'}</span><button onClick={() => dispatch({ type: 'original' })}>Teacher's original</button></div>
      <div className="variant-choices" role="group" aria-label="Explanation choices">{current.variants.map(item => <button key={item.id} aria-pressed={variant.id === item.id} onClick={() => dispatch(item.type === 'original' ? { type: 'original' } : { type: 'select-variant', variantId: item.id })}>{variantLabels[item.type]}</button>)}</div>
      <details className="route-reason" onToggle={e => { if (e.currentTarget.open) setAnnouncement([{ text: current.reason, refs: [] }]); }}><summary>Why these choices?</summary><p>{current.reason}</p></details>
      {refresherVariant && <details className="refresher" onToggle={e => markRefresherViewed(e.currentTarget.open)}><summary>Optional: remember the straight light path</summary><p>{refresherVariant.content}</p><p>You can skip this and continue below.</p><Sources lesson={lesson} sourceRefs={refresherVariant.sourceRefs}/></details>}
      <article className="content-card" aria-labelledby="variant-title" data-variant-id={variant.id}>
        <h3 id="variant-title">{variant.type === 'tryit' ? `Try it — ${activityStatus}` : variantLabels[variant.type]}</h3>
        <Visual conceptId={current.concept.id}/>
        {variant.type === 'tryit' && state.activity ? <TryIt variant={variant} activity={state.activity} dispatch={dispatch}/> : <p className="explanation">{variant.content}</p>}
        <Sources lesson={lesson} sourceRefs={variant.sourceRefs}/>
      </article>
      <details className="teacher-words" open={teacherWordsOpen} onToggle={e => { setTeacherWordsOpen(e.currentTarget.open); if (e.currentTarget.open) setAnnouncement([{ text: current.step.teacherSaid, refs: current.step.sourceRefs }]); }}><summary>Your teacher's words</summary><blockquote>{current.step.teacherSaid}</blockquote><Sources lesson={lesson} sourceRefs={current.step.sourceRefs}/></details>
      <nav className="timeline-navigation" aria-label="Lesson timeline"><button disabled={state.timelineIndex === 0} onClick={() => dispatch({ type: 'navigate', direction: -1 })}>Previous lesson step</button><button className="primary" disabled={state.timelineIndex === model.steps.length - 1} onClick={() => dispatch({ type: 'navigate', direction: 1 })}>Next lesson step</button></nav>
    </section>
    <section className="question-draft" aria-labelledby="question-title"><p className="eyebrow">Another way to understand</p><h2 id="question-title">Where did you get lost?</h2><p>Ask about this moment. Your answers come from the lesson collected at school.</p>
      <button className="primary" onClick={pauseHere}>Pause here / explain again</button>
      <label htmlFor="question">Type your question</label><textarea ref={questionInput} id="question" maxLength={1500} rows={3} value={draft} onChange={e => setDraft(e.target.value)}/>
      <div className="activity-actions"><button onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); startSpeech(); }} onPointerUp={() => speech.stop()} onPointerCancel={() => speech.stop()} onLostPointerCapture={() => speech.stop()} onBlur={() => speech.stop()} onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startSpeech(); } }} onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); speech.stop(); } }}>Hold to talk</button><button disabled={!draft.trim()} onClick={submit}>Send question</button></div><p role="status">{speechStatus}</p>
      {response.notice && <p role="status">{response.notice}</p>}
      {response.help && <div className="answer help-response" role="status">{'variant' in response.help ? <>{answer && !answer.refs.length && <p>{voiceMessages.related}</p>}<p>{response.help.variant.content}</p><Sources lesson={lesson} sourceRefs={response.help.variant.sourceRefs}/><p>Lesson moment: {current.step.teacherSaid}</p></> : <><p>You’ve seen all the prepared explanations for this step.</p><p>{activity ? 'Try the activity, or type a specific question about this moment.' : 'Type a specific question about this moment.'}</p><div className="activity-actions">{activity && <button onClick={() => dispatch({ type: 'select-variant', variantId: activity.id })}>Try the activity</button>}<button onClick={() => questionInput.current?.focus()}>Type a question</button></div></>}</div>}
      {answer && <div className="answer question-response" role="status"><p>{answer.text}</p>{answer.refs.length > 0 ? <><Sources lesson={lesson} sourceRefs={answer.refs}/><p>Lesson moment: {lesson.timeline.find(s => s.id === answer.step)?.teacherSaid}</p></> : response.help ? null : answer.related ? <><p>{voiceMessages.related}</p><p>{answer.related.content}</p><Sources lesson={lesson} sourceRefs={answer.related.sourceRefs}/></> : <><p>{voiceMessages.exhausted}</p><p>{activity ? voiceMessages.activityOffer : voiceMessages.questionOffer}</p><div className="activity-actions">{activity && <button onClick={() => dispatch({ type: 'select-variant', variantId: activity.id })}>Try the activity</button>}<button onClick={() => questionInput.current?.focus()}>Type a question</button></div></>}</div>}
    </section>
    <section className="quiz-section"><h2>A small check-in</h2><p>{progress.events.some(e => e.type === 'pause') ? 'Questions from the moments you paused.' : 'Check the lesson’s shared learning objective.'}</p><button onClick={toggleQuiz}>{quizOpen ? 'Close quiz' : 'Take my quiz'}</button>
      {completedActivities.map(entry => <section className="activity-progress content-card" key={entry.variant.id} aria-label="Activity and understanding progress" data-activity-id={entry.variant.id} data-concept-id={entry.step.conceptId}>
        <h3>What did the activity demonstrate?</h3>
        <p>Activity completion reported · {entry.attempts.length} check attempt{entry.attempts.length === 1 ? '' : 's'} since this activity.</p>
        <p>{entry.latest?.type === 'quiz-answered' ? entry.latest.correctness ? 'Your latest response to this check was correct.' : 'Your latest response needs another look.' : 'Understanding check pending. Completing the activity alone does not show understanding.'}</p>
        <details><summary>Connect it to your classroom concept</summary><p>{entry.variant.explainsWhy}</p><p>{lesson.concepts.find(concept => concept.id === entry.step.conceptId)!.title}</p><Sources lesson={lesson} sourceRefs={entry.variant.sourceRefs}/></details>
        <p className="small">This is a check of this concept now, not proof of long-term learning.</p>
        <button onClick={() => { setQuizConceptId(entry.step.conceptId); setQuizOpen(true); setAnnouncement(entry.checks.map(item => ({ text: quizCaption(item), refs: item.sourceRefs }))); }}>{entry.latest ? 'Retry this concept check' : 'Check what the activity demonstrates'}</button>
        <button onClick={() => { dispatch({ type: 'revisit-step', timelineStepId: entry.step.id }); setTeacherWordsOpen(true); }}>Revisit the teacher’s concept</button>
      </section>)}
      {quizOpen && quiz.map(item => { const attempts = progress.events.filter(e => e.type === 'quiz-answered' && e.quizId === item.id); const answered = attempts.at(-1); return <article className="content-card quiz-card" key={item.id}><h3>{item.prompt}</h3><div className="quiz-options">{item.options.map((option, index) => <button key={option} aria-pressed={answered?.type === 'quiz-answered' && answered.selectedIndex === index} onClick={() => answerQuiz(item, index)}>{option}</button>)}</div>{answered?.type === 'quiz-answered' && <><p role="status">{quizFeedback(item, answered.correctness)}</p><p className="small">{attempts.length} saved attempt{attempts.length === 1 ? '' : 's'}. {answered.correctness ? 'Next: revisit the teacher’s explanation or continue your recorded lesson.' : 'Next: review the explanation above, then choose an answer to try again.'}</p></>}<Sources lesson={lesson} sourceRefs={item.sourceRefs}/></article>; })}
    </section>
    {progress.queuedQuestions.length > 0 && <section className="queued"><h2>Your saved questions</h2>{progress.queuedQuestions.map(q => <article key={q.id}><h3>{q.text}</h3>{q.answered ? <><span className="badge">Simulated returned answer</span><p>{q.answer}</p><Sources lesson={lesson} sourceRefs={q.sourceRefs}/><button onClick={() => setAnnouncement([{ text: q.answer, refs: q.sourceRefs }])}>Hear this answer</button></> : <p>Pending · Bring your progress file back to school.</p>}</article>)}</section>}
    </section>
  </>;
}

