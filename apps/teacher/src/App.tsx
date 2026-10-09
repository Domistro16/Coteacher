import { useEffect, useState } from 'react';
import { decryptPayload, demoLessons, downloadFile, encryptPayload, futureFeatures, localLessonGenerator, profiles, queuedDemoQuestion, readTransferFile, reviewedMaterials, seededRecords, simulatedAnswerProvider, simulatedHistory, upsertSnapshot, validateProgressRecord, type LessonPackage, type ProgressRecord } from '@coteacher/shared';
import { Sources, Visual } from '../../student/src/Visual';

type Screen = 'prepare' | 'teach' | 'insights';
export function App() {
  const [screen, setScreen] = useState<Screen>('prepare');
  const [notes, setNotes] = useState('');
  const [activity, setActivity] = useState('');
  const [drafts, setDrafts] = useState<LessonPackage[]>([]);
  const [approved, setApproved] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [step, setStep] = useState(0);
  const [records, setRecords] = useState<ProgressRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<ProgressRecord | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [projector, setProjector] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener('online', change); window.addEventListener('offline', change);
    return () => { window.removeEventListener('online', change); window.removeEventListener('offline', change); };
  }, []);
  const lesson = drafts[0] ?? demoLessons()[0];
  const classRecords = [...seededRecords(), ...records];
  const current = lesson.timeline[step];
  const concept = lesson.concepts.find(c => c.id === current.conceptId)!;
  async function run(action: () => Promise<void> | void) {
    setBusy(true); setError(''); setStatus('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'This action could not be completed.'); } finally { setBusy(false); }
  }
  function invalidate() { setDrafts([]); setApproved(false); setReviewed(false); setStep(0); }
  async function loadSource(file: File, kind: 'notes' | 'activity') {
    if (!/\.(md|txt)$/i.test(file.name) || file.size > 50000) throw new Error('Choose a Markdown or text file under 50 KB. This simulation supports the two supplied reviewed source files.');
    const text = await file.text(); invalidate();
    if (kind === 'notes') setNotes(text); else setActivity(text);
  }
  async function importProgress(file: File) {
    const value = await decryptPayload(await readTransferFile(file), pin);
    const personalLesson = demoLessons().find(l => l.studentId === (value as ProgressRecord)?.studentId);
    if (!personalLesson) throw new Error('Only the two simulated demo learners are supported.');
    const result = validateProgressRecord(value, personalLesson);
    if (!result.valid || !result.data.simulated) throw new Error('Progress failed lesson/profile checks. Only simulated records are supported.');
    setRecords(upsertSnapshot(records, result.data)); setSelectedRecord(result.data);
    setStatus('Progress imported. Class insights updated.');
  }
  return <main className={`workspace teacher ${projector ? 'projector' : ''}`}>
    <header className="brand-row"><p className="brand">Coteacher<span>Another chance to understand your class</span></p><span className="badge">Simulated demo</span></header>
    <div className="teacher-heading"><div><p className="eyebrow">Your classroom workspace</p><h1>Keep the lesson going.</h1><p>Prepare with care. Teach with clarity. See where to return.</p></div><span className="term-label">Science · Light & refraction</span></div>
    <nav className="teacher-nav" aria-label="Teacher workspace">{(['prepare', 'teach', 'insights'] as Screen[]).map(tab => <button key={tab} aria-pressed={screen === tab} onClick={() => setScreen(tab)}>{tab === 'prepare' ? 'Prepare lesson' : tab === 'teach' ? 'Teach / projector' : 'Class insights'}</button>)}</nav>
    {error && <div className="safety" role="alert">{error}</div>}{status && <p className="answer" role="status">{status}</p>}
    {screen === 'prepare' && <>
      <div className="teacher-grid"><section className="content-card"><p className="eyebrow">01 · Start with your own sources</p><h2>A lesson rooted in your classroom.</h2><p>The local generation simulation supports the reviewed refraction lesson only. No paid AI service is called.</p><button onClick={() => { invalidate(); setNotes(reviewedMaterials.teacherNotes); setActivity(reviewedMaterials.activityNotes); }}>Use reviewed demo materials</button>
        <label htmlFor="notes-file">Teacher notes (.md / .txt)</label><input id="notes-file" type="file" accept=".md,.txt" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void run(() => loadSource(file, 'notes')); }}/>
        <label htmlFor="activity-file">Approved activity source (.md / .txt)</label><input id="activity-file" type="file" accept=".md,.txt" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void run(() => loadSource(file, 'activity')); }}/>
        <p>{notes ? 'Teacher notes loaded' : 'Teacher notes not loaded'} · {activity ? 'Activity source loaded' : 'Activity source not loaded'}</p>
        <button className="primary" disabled={busy || !notes || !activity} onClick={() => void run(() => { setDrafts(localLessonGenerator.generate(notes, activity)); setApproved(false); setReviewed(false); setStatus('Simulated draft ready. Review content before approval.'); })}>Generate simulated lesson</button>
      </section><aside className="prep-aside"><p className="eyebrow">One objective. Two routes.</p><h2>Another way in, for every learner.</h2><Visual conceptId="refraction"/><p>Student A gets an optional refresher. Student B sees the steps first. Both work towards the same objective.</p><p className="small">History and personalization are simulated. Learners can always switch explanations.</p><Sources lesson={lesson} refs={['notes-light']}/></aside></div>
      {drafts.length > 0 && <section className="review-section"><p className="eyebrow">02 · Teacher review</p><h2>{lesson.title}</h2><p>{lesson.objective.text}</p><Sources lesson={lesson} refs={lesson.sources.map(s => s.id)}/>
        {lesson.concepts.map(c => <section key={c.id}><h3>{c.title}</h3><Visual conceptId={c.id}/>{c.variants.map(v => <details key={v.id}><summary>{v.type} explanation</summary><p>{v.content}</p>{v.type === 'tryit' && <><h4>Materials</h4><ul>{v.items.map(item => <li key={item}>{item}</li>)}</ul><h4>Instructions</h4><ol>{v.steps.map(instruction => <li key={instruction}>{instruction}</li>)}</ol><h4>Why it works</h4><p>{v.explainsWhy}</p><h4>Safety</h4><ul>{v.safetyNotes.map(note => <li key={note}>{note}</li>)}</ul><p>Returns to {v.returnToStep}</p></>}<Sources lesson={lesson} refs={v.sourceRefs}/></details>)}</section>)}
        <details><summary>Prepared answers and quizzes</summary>{lesson.questionBank.map(q => <article key={q.id}><h4>{q.question}</h4><p>{q.answer}</p><Sources lesson={lesson} refs={q.sourceRefs}/></article>)}{lesson.quiz.map(q => <article key={q.id}><h4>{q.prompt}</h4><ul>{q.options.map((o,i) => <li key={o}>{o}{i === q.correctIndex ? ' (correct)' : ''}</li>)}</ul><p>{q.explanation}</p><Sources lesson={lesson} refs={q.sourceRefs}/></article>)}</details>
        <div className="route-preview">{drafts.map(l => <article className="content-card" key={l.studentId}><h3>{profiles.find(p => p.id === l.studentId)?.label}</h3>{l.route.conceptRoutes.map(r => <p key={r.conceptId}>{r.reason}</p>)}</article>)}</div>
        <label className="check"><input type="checkbox" checked={reviewed} onChange={e => { setReviewed(e.target.checked); setApproved(false); }}/>I reviewed sources, explanations, diagrams, quiz answers, and activity safety.</label><button className="primary" disabled={!reviewed || busy} onClick={() => { setApproved(true); setStatus('Approved for the simulated classroom. Personal packages are ready.'); }}>Approve lesson</button>
        <div className="export-row">{profiles.map(profile => <button key={profile.id} disabled={!approved || busy} onClick={() => void run(async () => downloadFile('lesson-' + profile.id + '.json', await encryptPayload(drafts.find(l => l.studentId === profile.id)!, profile.pin)))}>Export {profile.label} package</button>)}</div><p className="small">Demo PINs: Student A 111111 · Student B 222222. Personal packages are encrypted.</p>
      </section>}
    </>}
    {screen === 'teach' && <section className="cue content-card"><div className="brand-row"><p className="eyebrow">Teacher’s timeline · Step {step + 1} of {lesson.timeline.length}</p><button onClick={() => setProjector(!projector)}>{projector ? 'Exit projector view' : 'Expand projector view'}</button></div><h2>{concept.title}</h2><Visual conceptId={concept.id}/><p className="explanation">{current.teacherSaid}</p><Sources lesson={lesson} refs={current.sourceRefs}/><nav className="timeline-navigation"><button disabled={step === 0} onClick={() => setStep(step - 1)}>Previous visual</button><button className="primary" disabled={step === lesson.timeline.length - 1} onClick={() => setStep(step + 1)}>Next visual</button></nav><p className="small">Tap to advance. Automatic following of speech is a future feature.</p></section>}
    {screen === 'insights' && <>
      <div className="insight-summary"><article><strong>{classRecords.length}</strong><span>Simulated learners</span></article><article><strong>{records.length}</strong><span>Imported demo snapshots</span></article><article><strong>{records.reduce((n,r) => n + r.queuedQuestions.filter(q => !q.answered).length,0)}</strong><span>Pending questions</span></article></div>
      <div className="teacher-grid"><section className="content-card"><p className="eyebrow">Where the class paused</p><h2>A map of the difficult moments.</h2><p className="small">18 seeded learners, plus imported demo activity. Counts show learners, not repeated taps.</p><div className="heatmap">{lesson.timeline.map(s => { const count = classRecords.filter(r => r.events.some(e => ['pause', 'explain-again', 'question-no-match'].includes(e.type) && 'timelineStepId' in e && e.timelineStepId === s.id)).length; return <div key={s.id} className="heat-row"><strong>{lesson.concepts.find(c => c.id === s.conceptId)?.title}</strong><span>{count} / {classRecords.length} learners paused or asked an unmatched question</span><div className="heat-track"><span style={{ width: `${count / classRecords.length * 100}%` }}/></div></div>; })}</div></section><aside className="nudge"><p className="eyebrow">For your next lesson · Simulated previous cohort</p><h2>Return to the water boundary.</h2><p>{simulatedHistory.nudge}</p><p className="small">12 of 18 previous-cohort learners paused at refraction; 6 paused at straight paths.</p><Sources lesson={lesson} refs={simulatedHistory.sourceRefs}/><button onClick={() => { setStep(1); setScreen('teach'); }}>Show this lesson moment</button></aside></div>
      <section className="content-card stats"><h2>Which explanations were explored?</h2><p>Simulated observations. Learners can view multiple versions; these counts do not establish which explanation caused improvement.</p><div className="table-wrap"><table><thead><tr><th>Explanation</th><th>Learners who viewed</th><th>Also answered correctly</th></tr></thead><tbody>{lesson.concepts[1].variants.map(v => { const viewed = classRecords.filter(r => r.events.some(e => e.type === 'variant-viewed' && e.variantId === v.id)); const correct = viewed.filter(r => r.events.some(e => e.type === 'quiz-answered' && e.conceptId === 'refraction' && e.correctness)); return <tr key={v.id}><td>{v.type}</td><td>{viewed.length}</td><td>{correct.length}</td></tr>; })}</tbody></table></div></section>
      <section className="content-card import-progress"><p className="eyebrow">Collect at the next school visit</p><h2>Bring progress back into the classroom.</h2><label htmlFor="teacher-pin">Learner’s six-digit PIN</label><input id="teacher-pin" type="password" inputMode="numeric" maxLength={6} autoComplete="off" value={pin} onChange={e => setPin(e.target.value)}/><label htmlFor="progress-file">Import encrypted progress</label><input id="progress-file" type="file" accept=".json" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void run(() => importProgress(file)); }}/><p className="small">Records stay in memory for this teacher session. Export returned answers before closing. Aggregates are shown by default.</p>
        <details><summary>Review imported queued questions</summary>{!records.length && <p>No progress imported yet.</p>}{records.map(r => <button key={r.studentId} onClick={() => setSelectedRecord(r)}>Review {profiles.find(p => p.id === r.studentId)?.label} questions</button>)}{selectedRecord && <><p>{selectedRecord.queuedQuestions.length} questions in the selected snapshot.</p>{selectedRecord.queuedQuestions.map(q => <article key={q.id}><h4>{q.text}</h4>{q.answered ? <><p>{q.answer}</p><Sources lesson={lesson} refs={q.sourceRefs}/></> : <p>Pending</p>}</article>)}<p>Local answer simulation supports one reviewed question: “{queuedDemoQuestion}” Other questions remain pending.</p><button disabled={busy || !online} onClick={() => { const updated = { ...selectedRecord, queuedQuestions: selectedRecord.queuedQuestions.map(q => simulatedAnswerProvider.answer(q)) }; setSelectedRecord(updated); setRecords(records.map(r => r.studentId === updated.studentId ? updated : r)); setStatus('Local simulation completed. Supported answers are sourced; other questions remain pending.'); }}>Run simulated answer return</button><button disabled={busy} onClick={() => void run(async () => { const expected = profiles.find(p => p.id === selectedRecord.studentId); if (pin !== expected?.pin) throw new Error('Enter the selected learner’s demo PIN before exporting.'); downloadFile('returned-' + selectedRecord.studentId + '.json', await encryptPayload({ ...selectedRecord, exportedAt: new Date().toISOString() }, pin)); })}>Export returned answers</button></>}</details>
      </section>
    </>}
    <footer className="future"><details><summary>Beyond this sprint</summary><ul>{Object.entries(futureFeatures).map(([name, feature]) => <li key={name}>{feature.description} · Described only</li>)}</ul></details></footer>
  </main>;
}
