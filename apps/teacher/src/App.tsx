import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { personalizedReplay, approveLessons, presentStep, startPresentation, requirePublishedLesson, decryptPayload, demoLessons, downloadFile, encryptPayload, futureFeatures, localLessonGenerator, mergeReturnedAnswers, profiles, queuedDemoQuestion, readTransferFile, reviewedMaterials, simulatedAnswerProvider, upsertSnapshot, validateProgressRecord, type LessonPackage, type LessonRecording, type ProgressRecord } from '@coteacher/shared';
import { Sources, Visual } from '../../student/src/Visual';
import { emptyPreparation, readPreparation, savePreparation, type Preparation } from './preparation';
import { Presentation } from './Presentation';
import type { PresentationMotion } from './projector-channel';
import { TeacherShell, type Screen } from './TeacherShell';
const RecordingPanel = lazy(() => import('./RecordingPanel').then(module => ({ default: module.RecordingPanel })));
import { readRecording } from './recording-storage';
import { readTeacherProgress, saveTeacherProgress } from './progress-storage';
import { SourceUpload } from './SourceUpload';
import { TeacherQuestions } from './TeacherQuestions';
import { TeacherInsights } from './TeacherInsights';

export function App() {
  const [loaded] = useState(() => {
    try { return { preparation: readPreparation(window.localStorage), error: '' }; }
    catch { return { preparation: emptyPreparation(), error: 'Saved teacher preparation could not be restored. Reload the demo materials to prepare and review it again.' }; }
  });
  const [screen, setScreen] = useState<Screen>('dashboard');
  const screenRef = useRef(screen); screenRef.current = screen;
  const [stage, setStage] = useState<'details' | 'sources' | 'review' | 'ready'>(loaded.preparation.drafts.length ? 'review' : loaded.preparation.notes || loaded.preparation.activity ? 'sources' : 'details');
  const [conceptIndex, setConceptIndex] = useState(0);
  const [publication, setPublication] = useState('');
  const [recordingRevision, setRecordingRevision] = useState(0);
  const [savedRecording, setSavedRecording] = useState<LessonRecording | null>(null);
  const [syncStatus, setSyncStatus] = useState('Learning records are saved on this device.');
  const [reviewVariant, setReviewVariant] = useState('');
  const [preparation, setPreparation] = useState(loaded.preparation);
  const preparationRef = useRef(preparation);
  const { notes, activity, drafts } = preparation;
  const approved = drafts.length > 0 && drafts.every(lesson => lesson.publication.status === 'approved');
  const [reviewed, setReviewed] = useState(false);
  const [records, setRecords] = useState<ProgressRecord[]>([]);
  const recordsRef = useRef(records); recordsRef.current = records;
  const recordQueue = useRef(Promise.resolve());
  const [selectedRecord, setSelectedRecord] = useState<ProgressRecord | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(loaded.error);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [projector, setProjector] = useState(false);
  const [captureLocked, setCaptureLocked] = useState(false);
  const captureLockedRef = useRef(captureLocked); captureLockedRef.current = captureLocked;
  const [recordingPending, setRecordingPending] = useState(false);
  const [captureTransitionBusy, setCaptureTransitionBusy] = useState(false);
  const [captureMotion, setCaptureMotion] = useState<PresentationMotion | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener('online', change); window.addEventListener('offline', change);
    return () => { window.removeEventListener('online', change); window.removeEventListener('offline', change); };
  }, []);
  const lesson = drafts[0] ?? demoLessons()[0];
  function navigate(next: Screen) { if (!captureLocked) { setProjector(false); setScreen(next); window.scrollTo(0, 0); } }
  useEffect(() => {
    const change = () => { if (captureLockedRef.current) { history.replaceState(null, '', '#/' + screenRef.current); return; } const next = location.hash.slice(2) as Screen; if (['dashboard','lessons','prepare','teach','review','publish','insights','questions','transfers','settings'].includes(next)) setScreen(next); };
    change(); window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => { history.replaceState(null, '', '#/' + screen); }, [screen]);
  useEffect(() => { window.scrollTo(0, 0); }, [screen, stage]);
  useEffect(() => {
    if (screen !== 'prepare' || stage !== 'review' || !reviewVariant) return;
    const target = document.querySelector<HTMLDetailsElement>(`details[data-variant-id="${CSS.escape(reviewVariant)}"]`);
    target?.querySelector('summary')?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'center' });
  }, [screen, stage, reviewVariant, conceptIndex]);
  async function lessonFor(studentId: string) {
    let personal = preparationRef.current.drafts.find(lesson => lesson.studentId === studentId) ?? demoLessons().find(lesson => lesson.studentId === studentId);
    if (!personal) throw new Error('Unknown learner.');
    if (personal.classroomTimeline) { const recording = await readRecording(personal); if (recording) personal = personalizedReplay(personal, recording); }
    return personal;
  }
  async function persistRecords(change: (current: ProgressRecord[]) => ProgressRecord[] | Promise<ProgressRecord[]>) {
    recordQueue.current = recordQueue.current.catch(() => {}).then(async () => {
      const next = await change(recordsRef.current);
      if (next === recordsRef.current) return;
      await saveTeacherProgress(localStorage, next); recordsRef.current = next; setRecords(next);
    });
    await recordQueue.current;
  }
  useEffect(() => {
    let active = true;
    void readTeacherProgress(localStorage, lessonFor).then(values => { if (active && !recordsRef.current.length) { recordsRef.current = values; setRecords(values); } }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, []);
  async function receiveSchoolProgress() {
    if (!online) { setSyncStatus('Working offline · records remain saved on this device.'); return; }
    try {
      const recording = await readRecording(preparationRef.current.drafts[0] ?? lesson);
      if (!recording) { setSyncStatus('Publish a reviewed classroom recording to enable direct school synchronization.'); return; }
      setSyncStatus('Checking the school lesson service…');
      const response = await fetch('/api/progress');
      const value = await response.json();
      if (!response.ok || value.recordingId !== recording.id || value.lessonApprovedAt !== recording.lessonApprovedAt || !Array.isArray(value.records)) throw new Error('School service unavailable or a different recording is published.');
      const checked: ProgressRecord[] = [];
      for (const incoming of value.records) {
        const valid = validateProgressRecord(incoming, await lessonFor(incoming.studentId));
        if (!valid.valid || !valid.data.simulated) throw new Error('Received records failed lesson/profile validation.');
        checked.push(valid.data);
      }
      await persistRecords(async current => {
        let next = current;
        for (const record of checked) {
          const old = next.find(value => value.studentId === record.studentId);
          if (!old || Date.parse(record.exportedAt) > Date.parse(old.exportedAt)) {
            const preserved = old ? mergeReturnedAnswers(record, old, await lessonFor(record.studentId)) : record;
            next = [...next.filter(value => value.studentId !== record.studentId), preserved];
          }
        }
        return next;
      });
      setPublication(recording.id);
      setSyncStatus('School connection checked · received learning records saved.');
    } catch { setSyncStatus('School sync unavailable. Your records are safe here; try again or use a school transfer.'); }
  }
  useEffect(() => {
    if (!online || !approved || !['dashboard','insights','questions','transfers'].includes(screen)) return;
    void receiveSchoolProgress(); const timer = setInterval(() => void receiveSchoolProgress(), 15000);
    return () => clearInterval(timer);
  }, [online, approved, screen]);
  async function run(action: () => Promise<void> | void) {
    setBusy(true); setError(''); setStatus('');
    try { await action(); return true; } catch (e) { setError(e instanceof Error ? e.message : 'This action could not be completed.'); return false; } finally { setBusy(false); }
  }
  function persistPreparation(next: Preparation) {
    // Persist before exposing approval/export, including storage failure handling.
    savePreparation(window.localStorage, next);
    preparationRef.current = next;
    setPreparation(next);
  }
  function commitPreparation(next: Preparation) {
    persistPreparation(next); setReviewed(false); setProjector(false); setRecordingPending(false); setPublication(''); setRecordingRevision(n => n + 1);
  }
  function updatePresentation(next: LessonPackage) {
    persistPreparation({ ...preparationRef.current, drafts: preparationRef.current.drafts.map(draft => ({
      ...draft, classroomTimeline: next.classroomTimeline,
    })) });
  }
  async function loadSource(file: File, kind: 'notes' | 'activity') {
    if (!/\.(md|txt)$/i.test(file.name) || file.size > 50000) throw new Error('Choose a Markdown or text file under 50 KB. This simulation supports the two supplied reviewed source files.');
    const text = await file.text();
    commitPreparation({ ...preparationRef.current, [kind]: text, drafts: [] });
  }
  async function importProgress(file: File) {
    const value = await decryptPayload(await readTransferFile(file), pin);
    const studentId = (value as ProgressRecord)?.studentId;
    const prepared = preparationRef.current.drafts.find(l => l.studentId === studentId && l.publication.status === 'approved');
    let personalLesson = prepared ?? demoLessons().find(l => l.studentId === studentId);
    if (!personalLesson) throw new Error('Only the two simulated demo learners are supported.');
    if (personalLesson.classroomTimeline) {
      const recording = await readRecording(personalLesson);
      if (recording) personalLesson = personalizedReplay(personalLesson, recording);
    }
    const result = validateProgressRecord(value, personalLesson);
    if (!result.valid || !result.data.simulated) throw new Error('Progress failed lesson/profile checks. Only simulated records are supported.');
    await persistRecords(current => upsertSnapshot(current, result.data)); setSelectedRecord(result.data);
    setStatus('Progress imported. Class insights updated.');
  }
  async function publishRecording() {
    const lessons: LessonPackage[] = [];
    for (const draft of preparationRef.current.drafts) {
      const recording = await readRecording(draft);
      if (!recording) throw new Error('Record the complete lesson in Teach / projector, then review its audio and personalized visuals before publishing.');
      lessons.push(requirePublishedLesson(personalizedReplay(draft, recording)));
    }
    let response: Response;
    try { response = await fetch('/api/lessons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessons }) }); }
    catch { throw new Error('The local lesson service is unavailable. Start npm run delivery:start or configure the lesson service; no cloud upload has occurred.'); }
    const value = await response.json().catch(() => null);
    if (!response.ok || value?.recordingId !== lessons[0].recording?.id || !Number.isSafeInteger(value?.byteLength) || value.byteLength <= 0 || JSON.stringify([...value?.profiles ?? []].sort()) !== JSON.stringify(profiles.map(profile => profile.id).sort())) throw new Error(value?.error ?? 'The service did not confirm the complete publication. Start npm run delivery:start and try again.');
    setPublication(lessons[0].recording!.id);
    setStatus('Recorded lesson published to the local lesson service for both learners. They can stream it or download it for offline use.');
  }
  async function prepareReturnedAnswers(studentId: string) {
    let updated: ProgressRecord | null = null;
    await persistRecords(current => {
      const latest = current.find(record => record.studentId === studentId);
      if (!latest) throw new Error('Receive this learner’s progress before preparing answers.');
      updated = { ...latest, queuedQuestions: latest.queuedQuestions.map(question => simulatedAnswerProvider.answer(question)) };
      return current.map(record => record.studentId === studentId ? updated! : record);
    });
    setSelectedRecord(previous => previous?.studentId === studentId ? updated : previous);
    setStatus('Local simulation completed. Supported answers are sourced; other questions remain pending.');
  }
  return <TeacherShell screen={screen} navigate={navigate} locked={captureLocked} projector={projector}
    lesson={drafts[0] ?? (notes || activity ? lesson : null)} prepared={drafts.length > 0} approved={approved} recordingPending={recordingPending} recordingRevision={recordingRevision}
    published={approved && Boolean(publication && publication === savedRecording?.id)} records={records} online={online} onRecording={setSavedRecording}>
    {error && <div className="safety" role="alert">{error}</div>}{status && <p className="answer" role="status">{status}</p>}
    {busy && <p className="loading-line" role="status">Saving your classroom work…</p>}
    {screen === 'prepare' && <>
      <div className="studio-heading"><div><p className="eyebrow">LESSON CREATION STUDIO</p><h1>Build a lesson worth replaying.</h1><p>Your sources. Your teaching. More ways to understand.</p></div></div>
      <nav className="studio-steps" aria-label="Preparation steps">{(['details','sources','review','ready'] as const).map((step,index) => <button key={step} aria-current={stage === step ? 'step' : undefined} disabled={busy || step === 'review' && !drafts.length || step === 'ready' && !approved} onClick={() => setStage(step)}><span>{index+1}</span>{step === 'details' ? 'Lesson details' : step === 'sources' ? 'Teaching materials' : step === 'review' ? 'Prepare & review' : 'Ready to record'}</button>)}</nav>
      {stage === 'details' && <>

      <section className="content-card lesson-identity" aria-label="Selected demo lesson">
        <p className="eyebrow">Select one complete classroom lesson</p><h2>{lesson.title}</h2>
        <dl><dt>Subject</dt><dd>{lesson.subject}</dd><dt>Topic</dt><dd>{lesson.topic}</dd><dt>Class level</dt><dd>{lesson.classLevel}</dd></dl>
        <h3>Learning objectives</h3><p>{lesson.objective.text}</p>
        <p className="small">The demo uses this fixed lesson. Original and alternative explanations share these objectives for both learners.</p>
        <p className="badge">{approved ? 'Approved for learner collection' : drafts.length ? 'Draft · unavailable to learners' : 'Demo lesson selected · prepare sources below'}</p>
        {approved && lesson.publication.status === 'approved' && <p className="small">Teacher approved at {lesson.publication.approvedAt}. Changing sources or generating again requires a new review.</p>}
        <p className="small">{notes || activity ? 'Preparation saved on this device. Reopen this browser to continue.' : 'Select the reviewed materials or upload the supplied notes to start.'}</p>
      </section>
      <button className="primary" onClick={() => setStage('sources')}>Next: teaching materials</button></>}
      {stage === 'sources' && <div className="teacher-grid"><section className="content-card"><p className="eyebrow">01 · Start with your own sources</p><h2>A lesson rooted in your classroom.</h2><p>Add the notes and safe activity that will guide your classroom lesson.</p><details><summary>About this prepared demo</summary><p>The local generation simulation supports the reviewed refraction lesson only. The content is manually prepared; the deterministic simulation assembles it. No live AI service is called. References are checked structurally; the teacher reviews factual accuracy.</p></details><button disabled={busy} onClick={() => void run(() => { commitPreparation({ notes: reviewedMaterials.teacherNotes, activity: reviewedMaterials.activityNotes, drafts: [] }); setStage('sources'); })}>Use reviewed demo materials</button>
        <SourceUpload kind="notes" loaded={Boolean(notes)} busy={busy} onFile={file => run(() => loadSource(file, 'notes'))} onRemove={() => void run(() => commitPreparation({ ...preparationRef.current, notes: '', drafts: [] }))}/>
        <SourceUpload kind="activity" loaded={Boolean(activity)} busy={busy} onFile={file => run(() => loadSource(file, 'activity'))} onRemove={() => void run(() => commitPreparation({ ...preparationRef.current, activity: '', drafts: [] }))}/>
        <p>{notes ? 'Teacher notes loaded' : 'Teacher notes not loaded'} · {activity ? 'Activity source loaded' : 'Activity source not loaded'}</p>
        {notes && <details className="source-preview"><summary>Read teacher notes · notes-light</summary><pre>{notes}</pre></details>}
        {activity && <details className="source-preview"><summary>Read activity source · notes-activity</summary><pre>{activity}</pre></details>}
        <button className="primary" disabled={busy || !notes || !activity} onClick={() => void run(() => { commitPreparation({ notes, activity, drafts: localLessonGenerator.generate(notes, activity) }); setStage('review'); setConceptIndex(0); setStatus('Simulated draft ready. Review content before approval.'); })}>Generate simulated lesson</button>
      </section><aside className="prep-aside"><p className="eyebrow">One objective. Two routes.</p><h2>Another way in, for every learner.</h2><Visual conceptId="refraction"/><p>Student A gets an optional refresher. Student B sees the steps first. Both work towards the same objective.</p><p className="small">History and personalization are simulated. Learners can always switch explanations.</p><Sources lesson={lesson} refs={['notes-light']}/></aside></div>}
      {stage === 'review' && drafts.length > 0 && <section className="review-section"><p className="eyebrow">02 · Teacher review</p><h2>{lesson.title}</h2><span className="badge">{approved ? 'Approved for learner collection' : 'Draft · unavailable to learners'}</span><p>{lesson.objective.text}</p><Sources lesson={lesson} refs={lesson.sources.map(s => s.id)}/>
        <nav className="review-concepts" aria-label="Review concepts">{lesson.concepts.map((c,index) => <button key={c.id} aria-pressed={conceptIndex === index} onClick={() => setConceptIndex(index)}>{index+1}. {c.title}</button>)}</nav>
        {lesson.concepts.filter((_,index) => index === conceptIndex).map(c => <section key={c.id} data-concept-id={c.id}><h3>{c.title}</h3><p className="small">Concept: {c.id} | Learning objectives: {lesson.objective.text}</p><Sources lesson={lesson} refs={c.sourceRefs}/><Visual conceptId={c.id}/>{c.variants.map(v => <details key={v.id} data-variant-id={v.id} open={reviewVariant === v.id || undefined}><summary>{v.type} explanation</summary><p>{v.content}</p>{v.type === 'tryit' && <><h4>Materials</h4><ul>{v.items.map(item => <li key={item}>{item}</li>)}</ul><h4>Instructions</h4><ol>{v.steps.map(instruction => <li key={instruction}>{instruction}</li>)}</ol><h4>Why it works</h4><p>{v.explainsWhy}</p><h4>Safety</h4><ul>{v.safetyNotes.map(note => <li key={note}>{note}</li>)}</ul><p>Returns to {v.returnToStep}</p></>}<Sources lesson={lesson} refs={v.sourceRefs}/></details>)}<details><summary>Understanding check for {c.title}</summary>{lesson.quiz.filter(q => q.conceptId === c.id).map(q => <article key={q.id}><h4>{q.prompt}</h4><ul>{q.options.map((option, index) => <li key={option}>{option}{index === q.correctIndex ? " (correct)" : ""}</li>)}</ul><p>{q.explanation}</p><Sources lesson={lesson} refs={q.sourceRefs}/></article>)}</details></section>)}
        <details><summary>Prepared answers and quizzes</summary>{lesson.questionBank.map(q => <article key={q.id}><h4>{q.question}</h4><p>{q.answer}</p><Sources lesson={lesson} refs={q.sourceRefs}/></article>)}{lesson.quiz.map(q => <article key={q.id}><h4>{q.prompt}</h4><ul>{q.options.map((o,i) => <li key={o}>{o}{i === q.correctIndex ? ' (correct)' : ''}</li>)}</ul><p>{q.explanation}</p><Sources lesson={lesson} refs={q.sourceRefs}/></article>)}</details>
        <div className="route-preview">{drafts.map(l => <article className="content-card" key={l.studentId}><h3>{profiles.find(p => p.id === l.studentId)?.label}</h3>{l.route.conceptRoutes.map(r => <p key={r.conceptId}>{r.reason}</p>)}</article>)}</div>
        <label className="check"><input type="checkbox" checked={reviewed || approved} disabled={busy} onChange={e => void run(() => { if (approved) commitPreparation({ ...preparation, drafts: drafts.map(lesson => { const { classroomTimeline, ...content } = lesson; return { ...content, publication: { status: 'draft' as const } }; }) }); setReviewed(e.target.checked); })}/>I reviewed sources, explanations, diagrams, quiz answers, and activity safety.</label><button className="primary" disabled={!reviewed || approved || busy} onClick={() => void run(() => { commitPreparation({ ...preparation, drafts: approveLessons(drafts, reviewed) }); setStatus('Approved for the simulated classroom. Personal packages are saved and ready.'); })}>Approve lesson</button>
        {approved && <button className="primary" onClick={() => setStage('ready')}>Continue to recording</button>}
      </section>}
      {stage === 'ready' && <section className="content-card ready-card"><span className="ready-mark">✓</span><p className="eyebrow">APPROVED AND SAVED</p><h2>Time to bring your lesson to life.</h2><p>Your reviewed sources, explanations, visual aids and checks are ready. Record your voice as you advance through the concepts.</p><button className="primary" onClick={() => navigate('teach')}>Start recording this lesson</button><button onClick={() => setStage('review')}>Revisit approved materials</button></section>}
    </>}
    {screen === 'publish' && <><h1>Ready for your learners?</h1><p>Review the complete recording and both visual sequences before distribution.</p>
      <section className="content-card"><h2>{lesson.title}</h2><p>{lesson.subject} · {lesson.classLevel}</p><ul className="readiness-list"><li>{approved ? '✓' : '○'} Instructional materials approved</li><li>{lesson.classroomTimeline ? '✓' : '○'} Classroom concept timeline saved</li><li>{savedRecording ? `✓ Teacher microphone audio · ${(savedRecording.durationMs / 1000).toFixed(1)} seconds · ${savedRecording.cues.length} synchronized visual transitions` : '○ Teacher recording needed'}</li><li>{savedRecording?.review.status === 'approved' ? '✓ Recording reviewed' : '○ Audio review needed'}</li><li>{savedRecording?.visualReview?.status === 'approved' ? '✓ Personalized and default visuals reviewed' : '○ Personalized visual review needed'}</li><li>{lesson.concepts.length} concepts · {lesson.quiz.length} prepared understanding checks · {lesson.concepts.flatMap(concept => concept.variants.filter(variant => variant.type === 'tryit')).length} safe activities</li><li>Four prepared visual assets · source-grounded explanations and offline answers</li><li>Two simulated learner profiles · one original teacher recording</li><li>{publication && publication === savedRecording?.id ? '✓ Publication confirmed by the local lesson service' : '○ Not confirmed as published for this revision'}</li></ul><button onClick={() => navigate('review')}>Review synchronized recording</button></section>
        <section className="content-card"><h3>Publish the recorded classroom lesson</h3><p>Publish the approved audio, timeline and both visual sequences to the configured lesson service. The default service runs locally on this computer; this is not a cloud upload. Complete encrypted file export remains available.</p>
          <button className="primary" disabled={!approved || busy || recordingPending || captureLocked || !savedRecording || savedRecording.review.status !== 'approved' || savedRecording.visualReview?.status !== 'approved'} onClick={() => void run(publishRecording)}>Publish recorded lesson</button></section>
<button onClick={() => navigate('lessons')}>Back to My Lessons</button></>}
    {screen === 'transfers' && <section className="content-card"><h2>Send a lesson back to school</h2><p>Encrypted file transfer is available when a direct school connection is unavailable. Exports without a reviewed recording contain prepared content only.</p>        <div className="export-row">{profiles.map(profile => <button key={profile.id} disabled={!approved || busy || recordingPending || captureLocked || Boolean(savedRecording && (savedRecording.review.status !== 'approved' || savedRecording.visualReview?.status !== 'approved'))} onClick={() => void run(async () => {
          const personal = requirePublishedLesson(drafts.find(l => l.studentId === profile.id));
          const recording = await readRecording(personal);
          const payload = requirePublishedLesson(recording ? personalizedReplay(personal, recording) : personal);
          downloadFile('lesson-' + profile.id + '.json', await encryptPayload(payload, profile.pin));
        })}>Export {profile.label} package</button>)}</div>
</section>}
    {(screen === 'teach' || screen === 'review') && <div className={screen === 'teach' ? 'classroom-studio' : 'studio-review'}><div className="studio-presentation-slot" hidden={screen !== 'teach'}><Presentation lesson={approved ? lesson : null} busy={busy || captureTransitionBusy} projector={projector} motion={captureMotion}
      onProjector={() => setProjector(!projector)} onUpdate={transform => void run(() => updatePresentation(transform(preparationRef.current.drafts[0])))}
      onPrepare={() => { setStage('review'); navigate('prepare'); }}/></div>
      {approved && lesson.classroomTimeline && <Suspense fallback={<p role="status">Opening your recording studio…</p>}><RecordingPanel key={lesson.publication.status === 'approved' ? lesson.publication.approvedAt : ''}
        lesson={lesson} mode={screen === 'review' ? 'review' : 'studio'} onMotion={setCaptureMotion} onReview={() => { setProjector(false); setScreen('review'); window.scrollTo(0, 0); }} onRerecord={() => navigate('teach')} onChanged={() => setRecordingRevision(n => n + 1)} onLock={setCaptureLocked} onPending={setRecordingPending} onTransitionBusy={setCaptureTransitionBusy}/></Suspense>}
      {screen === 'review' && !lesson.classroomTimeline && <section className="content-card"><h2>No recording to review yet</h2><p>Approve your materials and start a classroom presentation first.</p><button className="primary" onClick={() => navigate('teach')}>Open recording studio</button></section>}
      {screen === 'review' && <button className="primary" disabled={!approved || recordingPending} onClick={() => navigate('publish')}>Continue to publication</button>}</div>}
    {screen === 'insights' && <TeacherInsights lesson={lesson} recording={savedRecording} records={records} approved={approved} busy={busy} syncStatus={syncStatus} onSync={() => void run(receiveSchoolProgress)} onReview={(conceptId, variantId) => {
      setConceptIndex(lesson.concepts.findIndex(concept => concept.id === conceptId)); setReviewVariant(variantId); setStage('review'); navigate('prepare');
    }}/>}
    {screen === 'transfers' && <section className="content-card"><h2>School connection</h2><p role="status">{syncStatus}</p><button disabled={busy} onClick={() => void run(receiveSchoolProgress)}>Check school connection</button><p className="small">Direct return uses the configured local lesson service. Only its acknowledgement confirms receipt; device connectivity alone does not.</p></section>}
    {screen === 'transfers' && <section className="content-card import-progress"><p className="eyebrow">Collect at the next school visit</p><h2>Bring progress back into the classroom.</h2><label htmlFor="teacher-pin">Learner’s six-digit PIN</label><input id="teacher-pin" type="password" inputMode="numeric" maxLength={6} autoComplete="off" value={pin} onChange={e => setPin(e.target.value)}/><label htmlFor="progress-file">Import encrypted progress</label><input id="progress-file" type="file" accept=".json" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void run(() => importProgress(file)); }}/><p className="small">Imported records are saved on this teacher device. Learner PINs are never saved. Aggregates are shown by default.</p>
      <details><summary>Review imported queued questions</summary>{!records.length && <p>No progress imported yet.</p>}{records.map(record => <button key={record.studentId} onClick={() => setSelectedRecord(record)}>Review {profiles.find(profile => profile.id === record.studentId)?.label} questions</button>)}
        {selectedRecord && <><p>{selectedRecord.queuedQuestions.length} questions in the selected snapshot.</p>{selectedRecord.queuedQuestions.map(question => <article key={question.id}><h4>{question.text}</h4>{question.answered ? <><p>{question.answer}</p>{question.answerOrigin === 'simulated-prepared' && <p className="small">Prepared demo response · simulated</p>}<Sources lesson={lesson} refs={question.sourceRefs}/></> : <p>Pending</p>}</article>)}<p>Local answer simulation supports one reviewed question: “{queuedDemoQuestion}” Other questions remain pending.</p>
          <button disabled={busy || !online} onClick={() => void run(() => prepareReturnedAnswers(selectedRecord.studentId))}>Run simulated answer return</button>
          <button disabled={busy || !online} onClick={() => void run(async () => {
            const current = recordsRef.current.find(record => record.studentId === selectedRecord.studentId);
            const profile = profiles.find(profile => profile.id === selectedRecord.studentId);
            if (!current || !profile) throw new Error('Receive this learner’s progress before returning answers.');
            const response = await fetch('/api/progress/answers/' + profile.id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await encryptPayload(current, profile.pin)) });
            const value = await response.json();
            if (!response.ok || value.saved !== true || value.studentId !== profile.id) throw new Error(value.error ?? 'The school service did not acknowledge these answers. Try again or export a returned-answer file.');
            setStatus('Reviewed prepared answers saved by the school service. This learner will receive them on their next sync.');
          })}>Return reviewed answers through school service</button>
          <button disabled={busy} onClick={() => void run(async () => {
            const profile = profiles.find(profile => profile.id === selectedRecord.studentId);
            if (pin !== profile?.pin) throw new Error('Enter the selected learner’s demo PIN before exporting.');
            const current = recordsRef.current.find(record => record.studentId === selectedRecord.studentId);
            if (!current) throw new Error('Receive this learner’s progress before exporting answers.');
            downloadFile('returned-' + current.studentId + '.json', await encryptPayload({ ...current, exportedAt: new Date().toISOString() }, pin));
          })}>Export returned answers</button></>}
      </details>
    </section>}
    {screen === 'questions' && <TeacherQuestions lesson={lesson} records={records} approved={approved} onConcept={stepId => void run(() => { updatePresentation(lesson.classroomTimeline ? presentStep(lesson, stepId) : startPresentation(lesson, stepId)); navigate('teach'); })} onReview={record => { setSelectedRecord(record); navigate('transfers'); }} onTransfer={() => navigate('transfers')}/>}
    {screen === 'settings' && <section className="content-card"><h1>Workspace settings</h1><p>This is a local teacher workspace. Teacher accounts and an authenticated display name are not configured.</p><h2>Storage & privacy</h2><p>Preparation and classroom recordings are saved on this browser. The configured delivery service stores published audio on the school computer. Keep encrypted lesson exports as a backup.</p><p>Only the two simulated learner profiles are supported. Public demo PINs are not production security.</p></section>}
    {screen === 'settings' && <footer className="future"><details><summary>Beyond this sprint</summary><ul>{Object.entries(futureFeatures).map(([name, feature]) => <li key={name}>{feature.description} · Described only</li>)}</ul></details></footer>}
  </TeacherShell>;
}
