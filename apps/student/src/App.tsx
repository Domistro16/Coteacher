import { useEffect, useMemo, useRef, useState } from 'react';
import { activityCaptions, chooseQuiz, decryptPayload, demoLessons, downloadFile, emptyProgress, encryptPayload, mergeReturnedAnswers, profiles, quizCaption, quizFeedback, readTransferFile, validateLessonPackage, voiceMessages, type LessonPackage, type ProgressEvent, type QuizItem, type TryItVariant } from '@coteacher/shared';
import { readStoredProfile, saveStoredProfile, type Snapshot } from './storage';
import { Visual } from './Visual';
import { createSpeechInput } from './speech';
import { handleStudentRequest, type StudentResponse } from './help';
import { Narrator, type NarratorHandle } from './Narrator';
import type { NarrationFrame } from './narration';
import {
  initialPlayerState, selectedVariant, transitionPlayer, variantLabels,
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
          <div className="activity-actions">
            <button type="button" onClick={() => dispatch({ type: 'previous-instruction' })}>Previous instruction</button>
            <button className="primary" type="button" onClick={() => dispatch({ type: 'complete-activity' })}>Done — return to teacher</button>
          </div>
        </>}
      </>}
    </div>
  );
}

function LessonPlayer({ snapshot, update }: { snapshot: Snapshot; update: (next: Snapshot) => void }) {
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
  const [quizOpen, setQuizOpen] = useState(false);
  const speech = useMemo(createSpeechInput, []);
  useEffect(() => {
    const stop = () => speech.stop();
    const visibility = () => { if (document.hidden) stop(); };
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', visibility);
    return () => { stop(); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', visibility); };
  }, [speech]);
  const stamp = () => new Date().toISOString();
  function record(events: ProgressEvent[], player = state) {
    update({ ...snapshot, player, progress: { ...progress, events: [...progress.events, ...events] } });
  }
  function dispatch(action: PlayerAction) {
    const next = transitionPlayer(model, state, action, stamp());
    if (next.player === state) return;
    record(next.events, next.player);
    setResponse({});
    setAnnouncement(null);
  }
  function requestHelp(text: string) {
    const next = handleStudentRequest(model, state, progress, text, stamp(), () => 'queued-' + crypto.randomUUID());
    if (next.response.command === 'pause') { narrator.current?.pause(); return; }
    if (next.response.command === 'repeat' || next.response.command === 'replay') { narrator.current?.replay(); return; }
    if (next.response.command === 'quiz') {
      setQuizOpen(true); setAnnouncement(chooseQuiz(lesson, progress).map(item => ({ text: quizCaption(item), refs: item.sourceRefs }))); return;
    }
    update({ ...snapshot, player: next.player, progress: next.progress });
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
  const quiz = chooseQuiz(lesson, progress);
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
    setQuizOpen(!quizOpen);
    setAnnouncement(quizOpen ? null : quiz.map(item => ({ text: quizCaption(item), refs: item.sourceRefs })));
  }
  function answerQuiz(item: QuizItem, index: number) {
    const correctness = index === item.correctIndex;
    record([{ type: 'quiz-answered', timestamp: stamp(), conceptId: item.conceptId, quizId: item.id, correctness }]);
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
    <header className="lesson-header"><p className="eyebrow">{lesson.subject} · Your classroom, again</p><h1>{lesson.title}</h1><details className="objective" onToggle={e => { if (e.currentTarget.open) setAnnouncement([{ text: lesson.objective.text, refs: [...new Set(lesson.concepts.flatMap(c => c.sourceRefs))] }]); }}><summary>What you will learn</summary><p>{lesson.objective.text}</p></details></header>
    <Narrator ref={narrator} frames={frames} sources={refs => <Sources lesson={lesson} sourceRefs={refs}/>}/>
    <section className="lesson-step" aria-labelledby="concept-title" data-step-id={current.step.id}>
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
      <details className="teacher-words" onToggle={e => { if (e.currentTarget.open) setAnnouncement([{ text: current.step.teacherSaid, refs: current.step.sourceRefs }]); }}><summary>Your teacher's words</summary><blockquote>{current.step.teacherSaid}</blockquote><Sources lesson={lesson} sourceRefs={current.step.sourceRefs}/></details>
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
      {quizOpen && quiz.map(item => { const answered = [...progress.events].reverse().find(e => e.type === 'quiz-answered' && e.quizId === item.id); return <article className="content-card quiz-card" key={item.id}><h3>{item.prompt}</h3><div className="quiz-options">{item.options.map((option, index) => <button key={option} onClick={() => answerQuiz(item, index)}>{option}</button>)}</div>{answered?.type === 'quiz-answered' && <p role="status">{quizFeedback(item, answered.correctness)}</p>}<Sources lesson={lesson} sourceRefs={item.sourceRefs}/></article>; })}
    </section>
    {progress.queuedQuestions.length > 0 && <section className="queued"><h2>Your saved questions</h2>{progress.queuedQuestions.map(q => <article key={q.id}><h3>{q.text}</h3>{q.answered ? <><span className="badge">Simulated returned answer</span><p>{q.answer}</p><Sources lesson={lesson} sourceRefs={q.sourceRefs}/><button onClick={() => setAnnouncement([{ text: q.answer, refs: q.sourceRefs }])}>Hear this answer</button></> : <p>Pending · Bring your progress file back to school.</p>}</article>)}</section>}
  </>;
}

export function App() {
  const [profileId, setProfileId] = useState<string>(profiles[0].id);
  const [pin, setPin] = useState('');
  const [session, setSession] = useState<{ id: string; pin: string } | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');
  const [offlineReady, setOfflineReady] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const saveQueue = useRef(Promise.resolve());
  const revision = useRef(0);
  useEffect(() => {
    const updateNetwork = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateNetwork); window.addEventListener('offline', updateNetwork);
    let active = true;
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(() => { if (active) setOfflineReady(true); }).catch(() => { if (active) setError('Offline setup failed. Keep the app open and try reloading while connected.'); });
    }
    return () => { active = false; window.removeEventListener('online', updateNetwork); window.removeEventListener('offline', updateNetwork); };
  }, []);
  useEffect(() => {
    if (!snapshot || !session) return;
    const currentRevision = ++revision.current;
    setSaved('Saving on this device…');
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveStoredProfile(session.id, session.pin, snapshot)).then(() => {
      if (currentRevision === revision.current) setSaved('Saved on this device');
    }).catch((e: Error) => { if (currentRevision === revision.current) { setSaved('Not saved — retry before leaving'); setError(e.message); } });
  }, [snapshot, session]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (saved !== 'Saved on this device' && snapshot) { e.preventDefault(); } };
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [saved, snapshot]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'This action could not be completed.'); } finally { setBusy(false); }
  }
  async function unlock() {
    const profile = profiles.find(p => p.id === profileId)!;
    const stored = await readStoredProfile(profile.id, pin);
    if (!stored && pin !== profile.pin) throw new Error('That PIN does not unlock this demo profile.');
    setSession({ id: profile.id, pin }); setSnapshot(stored); setPin('');
  }
  function collect(lesson: LessonPackage) {
    if (!session || lesson.studentId !== session.id || !lesson.simulated) throw new Error('This package belongs to a different profile or is not simulated.');
    if (snapshot) throw new Error('A lesson is already collected. Your existing progress has been preserved.');
    const model = createPlayerModel(lesson);
    const player = initialPlayerState(model);
    const progress = emptyProgress(lesson);
    progress.events.push({ type: 'variant-viewed', timestamp: new Date().toISOString(), conceptId: model.steps[0].concept.id, timelineStepId: model.steps[0].step.id, variantId: player.variantId });
    setSnapshot({ lesson, progress, player });
  }
  async function importFile(file: File) {
    if (!session) return;
    const value = await decryptPayload(await readTransferFile(file), session.pin);
    const lesson = validateLessonPackage(value);
    if (lesson.valid) { collect(lesson.data); return; }
    if (!snapshot) throw new Error('Collect your lesson before importing returned answers.');
    const progress = mergeReturnedAnswers(snapshot.progress, value as Snapshot['progress'], snapshot.lesson);
    setSnapshot({ ...snapshot, progress });
  }
  async function lock() {
    window.dispatchEvent(new Event('coteacher-lock'));
    await saveQueue.current;
    if (snapshot) await saveStoredProfile(session!.id, session!.pin, snapshot);
    revision.current++; setSession(null); setSnapshot(null); setSaved(''); setError('');
  }
  return <main className="workspace">
    <div className="brand-row"><p className="brand">Coteacher<span>Another chance at the lesson</span></p><span className="badge">Simulated demo</span></div>
    <div className="device-status" role="status"><span>{online ? 'Connected' : 'Offline'}</span><span>{offlineReady && snapshot && saved === 'Saved on this device' ? 'Ready offline' : import.meta.env.DEV ? 'Development preview · offline reopening requires build' : 'Collect and save your lesson for offline use'}</span></div>
    {error && <div className="safety" role="alert">{error}{snapshot && saved.startsWith('Not saved') && <button onClick={() => setSnapshot({ ...snapshot })}>Retry save</button>}</div>}
    {!session ? <section className="welcome content-card"><p className="eyebrow">Your place in the lesson is waiting</p><h1>Welcome back.</h1><p>Choose your profile. Each learner has their own place, questions, and progress.</p><form onSubmit={e => { e.preventDefault(); void run(unlock); }}><label htmlFor="profile">Your profile</label><select id="profile" value={profileId} onChange={e => setProfileId(e.target.value)}>{profiles.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select><label htmlFor="pin">Six-digit PIN</label><input id="pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={e => setPin(e.target.value)}/><button className="primary" disabled={busy}>Unlock my profile</button></form><details><summary>Demo profiles</summary><p>Student A: 111111 · Student B: 222222. These profiles and PINs are simulated.</p></details></section> : <>
      <div className="profile-bar"><span>{profiles.find(p => p.id === session.id)?.label}</span><button disabled={busy} onClick={() => void run(lock)}>Lock / switch learner</button></div>
      {!snapshot && <section className="welcome content-card"><p className="eyebrow">Collect at school. Learn anywhere.</p><h1>Bring your lesson with you.</h1><p>Import the package your teacher approved, or collect the reviewed simulated lesson.</p><button className="primary" disabled={busy} onClick={() => void run(async () => collect(demoLessons().find(l => l.studentId === session.id)!))}>Collect demo lesson</button></section>}
      {snapshot && <LessonPlayer snapshot={snapshot} update={setSnapshot}/>}
      <section className="transfer"><h2>{snapshot ? 'Bring your questions back' : 'Collect a lesson file'}</h2><p>{snapshot ? 'Export your progress at school. Import the returned file to collect any sourced answers.' : 'Choose your encrypted personal lesson file and unlock it with this profile’s PIN.'}</p><label htmlFor="import-file">{snapshot ? 'Import returned answers' : 'Import lesson file'}</label><input id="import-file" type="file" accept=".json" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void run(() => importFile(file)); }}/>
        {snapshot && <><button disabled={busy || saved !== 'Saved on this device'} onClick={() => void run(async () => { const progress = { ...snapshot.progress, exportedAt: new Date().toISOString() }; downloadFile('progress-' + session.id + '.json', await encryptPayload(progress, session.pin)); })}>Export my progress</button><p role="status">{saved}</p></>}
      </section>
    </>}
  </main>;
}
