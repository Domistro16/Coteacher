import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { decryptPayload, demoLessons, downloadFile, emptyProgress, encryptPayload, identifyProgressEvents, initialTutorState, observedMemory, mergeReturnedAnswers, profiles, readTransferFile, requirePublishedLesson, validateLessonPackage, type LessonPackage } from '@coteacher/shared';
import { MissingMediaError, readStoredProfile, saveStoredProfile, type Snapshot } from './storage';
import { downloadRecordedLesson, openPublishedRecording, type DownloadProgress } from './lesson-delivery';
import { createPlayerModel, initialPlayerState } from './player';
import { StudentShell } from './StudentShell';
import { Brand, LearningArt, Icon } from './student-ui';
import { useProgressSync } from './useProgressSync';
import { ConnectedTutorContext, useConnectedTutor } from './useConnectedTutor';
const PreparedLesson = lazy(() => import('./PreparedLesson').then(module => ({ default: module.PreparedLesson })));

export function App() {
  const [profileId, setProfileId] = useState<string>(profiles[0].id);
  const [pin, setPin] = useState('');
  const [session, setSession] = useState<{ id: string; pin: string } | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [catalogue, setCatalogue] = useState<LessonPackage | null>(null);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [catalogueError, setCatalogueError] = useState('');
  const [recovery, setRecovery] = useState<{ id: string; pin: string; snapshot: Snapshot } | null>(null);
  const snapshotRef = useRef(snapshot); snapshotRef.current = snapshot;
  function changeSnapshot(next: Snapshot | null) {
    if (next) {
      const progress = identifyProgressEvents(next.progress);
      if (progress !== next.progress) next = { ...next, progress };
      if (next.lesson.recording) {
        const tutor = next.tutor ?? initialTutorState(next.lesson);
        const memory = observedMemory(next.lesson, next.progress, tutor.memory, tutor.checks, tutor.checkAttempts);
        next = { ...next, tutor: { ...tutor, memory } };
      }
    }
    snapshotRef.current = next; setSnapshot(next);
  }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');
  const [offlineReady, setOfflineReady] = useState(false);
  const [packageReady, setPackageReady] = useState(false);
  const [download, setDownload] = useState<DownloadProgress | null>(null);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const saveQueue = useRef(Promise.resolve());
  const revision = useRef(0);
  const sync = useProgressSync(session, snapshot, online, saved, changeSnapshot, snapshotRef);
  const connected = !sync.offline && (online || sync.schoolReachable);
  const tutor = useConnectedTutor(session, snapshot, connected, saved, changeSnapshot, snapshotRef, sync.retry);
  useEffect(() => {
    setCatalogue(null); setCatalogueError('');
    if (!session || snapshot || !connected) { setCatalogueLoading(false); return; }
    let active = true;
    setCatalogueLoading(true);
    openPublishedRecording(session.id, session.pin).then(lesson => { if (active) setCatalogue(lesson); })
      .catch(error => { if (active) setCatalogueError((error as Error).message); })
      .finally(() => { if (active) setCatalogueLoading(false); });
    return () => { active = false; };
  }, [session, Boolean(snapshot), connected]);
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
      if (currentRevision === revision.current) { setSaved('Saved on this device'); setPackageReady(!snapshot.lesson.recording || !('mediaUrl' in snapshot.lesson.recording.audio)); }
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
    setRecovery(null);
    let stored: Snapshot | null;
    try { stored = await readStoredProfile(profile.id, pin); }
    catch (error) { if (error instanceof MissingMediaError) setRecovery({ id: profile.id, pin, snapshot: error.snapshot }); throw error; }
    if (!stored && pin !== profile.pin) throw new Error('That PIN does not unlock this demo profile.');
    setCatalogue(null); setCatalogueError(''); setSession({ id: profile.id, pin }); changeSnapshot(stored); setPackageReady(Boolean(stored && (!stored.lesson.recording || !('mediaUrl' in stored.lesson.recording.audio)))); setPin(''); setDownload(null); setLegacyOpen(false);
  }
  function selectProfile(id: string) {
    setProfileId(id); setPin(''); setRecovery(null); setError('');
  }
  async function watchPublished() {
    if (!session) return;
    const lesson = await openPublishedRecording(session.id, session.pin);
    const current = snapshotRef.current;
    if (current) {
      const content = (value: LessonPackage) => {
        const { publication, classroomTimeline, recording, playback, visualAssets, ...instruction } = value; return JSON.stringify(instruction);
      };
      if (content(current.lesson) !== content(lesson) || (current.lesson.recording && current.lesson.recording.id !== lesson.recording!.id)) throw new Error('A different lesson is saved. Your existing progress has been preserved; use its complete teacher package.');
      if (current.lesson.recording && !('mediaUrl' in current.lesson.recording.audio)) throw new Error('This teacher recording is already downloaded. Play your saved lesson below.');
      changeSnapshot({ ...current, lesson });
    } else {
      const model = createPlayerModel(lesson), player = initialPlayerState(model), progress = emptyProgress(lesson);
      changeSnapshot({ lesson, player, progress });
    }
    setPackageReady(false); setDownload(null);
  }
  async function downloadLesson() {
    const current = snapshotRef.current;
    if (!session || !current) return;
    try {
      const complete = await downloadRecordedLesson(current.lesson, setDownload);
      window.dispatchEvent(new Event('coteacher-pause-recording'));
      await saveQueue.current;
      const next = { ...snapshotRef.current!, lesson: complete };
      await saveStoredProfile(session.id, session.pin, next);
      changeSnapshot({ ...snapshotRef.current!, lesson: complete }); setPackageReady(true);
      setDownload(value => value && { ...value, phase: 'complete' });
    } catch (error) { setDownload(null); throw new Error('Offline download did not complete. Your streaming lesson and progress are preserved. ' + (error as Error).message); }
  }
  function collect(lesson: LessonPackage) {
    requirePublishedLesson(lesson);
    if (lesson.recording && !('dataBase64' in lesson.recording.audio)) throw new Error('This transfer is missing the complete recorded audio. Recollect the original teacher package.');
    if (!session || lesson.studentId !== session.id || !lesson.simulated) throw new Error('This package belongs to a different profile or is not simulated.');
    if (snapshot) throw new Error('A lesson is already collected. Your existing progress has been preserved.');
    const model = createPlayerModel(lesson);
    const player = initialPlayerState(model);
    const progress = emptyProgress(lesson);
    progress.events.push({ type: 'variant-viewed', timestamp: new Date().toISOString(), conceptId: model.steps[0].concept.id, timelineStepId: model.steps[0].step.id, variantId: player.variantId });
    setPackageReady(false); setLegacyOpen(!lesson.recording); changeSnapshot({ lesson, progress, player }); location.hash = lesson.recording ? "/watch" : "/prepared";
  }
  async function importFile(file: File) {
    if (!session) return;
    const value = await decryptPayload(await readTransferFile(file), session.pin);
    const lesson = validateLessonPackage(value);
    if (lesson.valid) { collect(lesson.data); return; }
    if (value && typeof value === 'object' && 'concepts' in value) throw new Error('This lesson package is incomplete or damaged. Recollect the complete teacher package, including its audio and visual assets.');
    if (!snapshot) throw new Error('Collect your lesson before importing returned answers.');
    const progress = mergeReturnedAnswers(snapshot.progress, value as Snapshot['progress'], snapshot.lesson);
    changeSnapshot({ ...snapshot, progress });
  }
  async function lock() {
    window.dispatchEvent(new Event('coteacher-lock'));
    await saveQueue.current;
    if (snapshotRef.current) await saveStoredProfile(session!.id, session!.pin, snapshotRef.current);
    revision.current++; setCatalogue(null); setCatalogueError(''); setSession(null); changeSnapshot(null); setPackageReady(false); setSaved(''); setError('');
    setDownload(null);
  }
  async function restoreMedia(file: File) {
    if (!recovery) return;
    const lesson = requirePublishedLesson(await decryptPayload(await readTransferFile(file), recovery.pin));
    const previous = recovery.snapshot.lesson;
    if (lesson.studentId !== recovery.id || lesson.recording?.id !== previous.recording?.id || lesson.lessonId !== previous.lessonId
      || JSON.stringify(lesson.playback) !== JSON.stringify(previous.playback)
      || JSON.stringify(lesson.visualAssets) !== JSON.stringify(previous.visualAssets)
      || JSON.stringify(lesson.objective) !== JSON.stringify(previous.objective)
      || lesson.recording?.audio.mediaKey !== previous.recording?.audio.mediaKey) throw new Error('Choose the same personal recorded package to restore media while preserving progress.');
    const restored = { ...recovery.snapshot, lesson };
    await saveStoredProfile(recovery.id, recovery.pin, restored);
    setSession({ id: recovery.id, pin: recovery.pin }); changeSnapshot(restored); setPackageReady(true); setPin(''); setRecovery(null);
  }
  const transfer = <section className="transfer"><details open={legacyOpen}><summary>{snapshot ? 'Bring progress to school / transfer lesson' : 'Transfer lesson from school'}</summary><p>{snapshot ? 'Export your progress at school. Import the returned file to collect any sourced answers.' : 'Choose your encrypted personal lesson file and unlock it with this profile’s PIN.'}</p><label htmlFor="import-file">{snapshot ? 'Import returned answers' : 'Import lesson file'}</label><input id="import-file" type="file" accept=".json" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void run(() => importFile(file)); }}/>
    {snapshot && <><button disabled={busy || saved !== 'Saved on this device'} onClick={() => void run(async () => { const progress = { ...snapshot.progress, exportedAt: new Date().toISOString() }; downloadFile('progress-' + session!.id + '.json', await encryptPayload(progress, session!.pin)); })}>Export my progress</button><p role="status">{saved}</p></>}
    {!snapshot && <details className="legacy-demo"><summary>Prepared-content compatibility demo</summary><p>This older simulated fixture has notes, activities and quizzes but no classroom recording. It is available only for testing prepared content.</p><button disabled={busy} onClick={() => void run(async () => collect(demoLessons().find(l => l.studentId === session!.id)!))}>Collect demo lesson</button></details>}
    </details></section>;
  if (session) return <ConnectedTutorContext.Provider value={tutor}><StudentShell key={session.id} id={session.id} snapshot={snapshot} catalogue={catalogue} catalogueLoading={catalogueLoading} catalogueError={catalogueError} update={changeSnapshot} online={connected} connectionChecking={sync.connectionChecking} connectionError={sync.connectionError} busy={busy} saved={saved} syncStatus={sync.status} onSync={sync.retry} error={error} offlineReady={offlineReady} packageReady={packageReady} download={download}
    onRefresh={() => void run(watchPublished)} onWatch={() => void run(async () => { await watchPublished(); location.hash = '/watch'; })}
    onDownload={() => void run(async () => { if (!snapshotRef.current?.lesson.recording) await watchPublished(); await downloadLesson(); })} onLock={() => void run(lock)} onRetrySave={() => { setError(''); changeSnapshot(snapshot && { ...snapshot }); }} transfer={transfer}
    prepared={snapshot && <details className="legacy-saved content-card" open={legacyOpen} onToggle={event => setLegacyOpen(event.currentTarget.open)}><summary>Saved prepared-content compatibility lesson</summary><p>This saved demo has no classroom audio. Its questions and progress are preserved.</p><span className="badge">Simulated demo</span><p role="status">{offlineReady && packageReady ? "Prepared-content demo ready offline" : "Saving prepared content…"}</p><Suspense fallback={<p role="status">Opening your prepared lesson…</p>}><PreparedLesson key={session.id + '-legacy'} snapshot={snapshot} update={changeSnapshot}/></Suspense>{transfer}</details>}/></ConnectedTutorContext.Provider>;
  return <main className="student-app auth-page"><header className="auth-header"><Brand/><span className="auth-tag">Your lesson. Your pace.</span></header><div className="auth-layout"><section className="auth-art"><span className="hero-pill"><Icon name="spark" size={16}/>A world of aha! moments</span><h1>Big ideas start<br/>with a little curiosity.</h1><LearningArt/><p>Watch your teacher’s lessons. Try a new explanation.<br/>Keep learning, even without internet.</p></section><section className="auth-card"><p className="eyebrow">LET’S PICK UP WHERE YOU LEFT OFF</p><h1>Welcome back.</h1><p>Choose your space. Your lessons are waiting.</p>
    {error && <div className="app-alert" role="alert">{error}</div>}
    {recovery && <section className="recovery-card"><h2>Restore the complete recording</h2><p>Your saved place and questions remain on this device. Import the same teacher package to restore its audio.</p><label htmlFor="restore-media">Recollect recorded package</label><input id="restore-media" type="file" accept=".json" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void run(() => restoreMedia(file)); }}/></section>}
    <form onSubmit={e => { e.preventDefault(); if (!busy) void run(unlock); }}><label htmlFor="profile">Your profile</label><select id="profile" value={profileId} disabled={busy} onChange={e => selectProfile(e.target.value)}>{profiles.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select><label htmlFor="pin">Six-digit PIN</label><input id="pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6} disabled={busy} value={pin} onChange={e => setPin(e.target.value)}/><button className="primary" disabled={busy}>{busy ? 'Unlocking…' : 'Unlock my profile'}<Icon name="arrow" size={18}/></button></form>
    <details className="demo-access"><summary>Trying the demo?</summary><p>Student A: 111111 · Student B: 222222. These profiles and PINs are simulated. A PIN helps separate records; it is not complete device security.</p></details><p className="auth-offline"><span className="connection-dot">{online && !sync.offline ? 'Connected' : 'Offline'}</span> Your downloaded lessons work offline.</p>
  </section></div></main>;
}
