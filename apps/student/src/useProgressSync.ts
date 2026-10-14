import { useEffect, useRef, useState } from 'react';
import { decryptPayload, encryptPayload, mergeReturnedAnswers, pendingProgress, progressDigest, validateProgressReceipt, recoverReceivedProgress, type ProgressSyncState } from '@coteacher/shared';
import type { Snapshot } from './storage';
import { checkSchoolConnection } from './school-connection';
const offlineKey = 'coteacher-school-offline';
function savedOfflineHint() { try { return localStorage.getItem(offlineKey) === 'true'; } catch { return false; } }
function rememberOffline(value: boolean) { try { if (value) localStorage.setItem(offlineKey, 'true'); else localStorage.removeItem(offlineKey); } catch { /* Connectivity hints never block encrypted learning saves. */ } }

/** Receipt-backed background return. Never replaces local events or gates learning. */
export function useProgressSync(session: { id: string; pin: string } | null, snapshot: Snapshot | null, online: boolean, saved: string, update: (snapshot: Snapshot) => void, live?: { current: Snapshot | null }) {
  const [phase, setPhase] = useState<'waiting' | 'sending' | 'received' | 'failed'>('waiting');
  const [retry, setRetry] = useState(0);
  const [schoolOffline, setSchoolOffline] = useState(savedOfflineHint);
  const [schoolReachable, setSchoolReachable] = useState(false);
  const [connectionChecking, setConnectionChecking] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const connectionRequest = useRef<AbortController | null>(null);
  const rendered = useRef(snapshot); rendered.current = snapshot;
  const latest = live ?? rendered;
  const savedState = useRef(saved); savedState.current = saved;
  const updating = useRef(update); updating.current = update;
  const wake = useRef<() => void>(() => {});
  const recordingId = snapshot?.lesson.recording?.id;
  useEffect(() => {
    const disconnected = () => { connectionRequest.current?.abort(); rememberOffline(true); setSchoolOffline(true); setSchoolReachable(false); };
    const connected = () => { rememberOffline(false); setSchoolOffline(false); setConnectionError(''); };
    window.addEventListener('offline', disconnected); window.addEventListener('online', connected);
    return () => { connectionRequest.current?.abort(); window.removeEventListener('offline', disconnected); window.removeEventListener('online', connected); };
  }, []);
  async function reconnect() {
    if (connectionRequest.current) return;
    const controller = new AbortController(); connectionRequest.current = controller;
    setConnectionChecking(true); setConnectionError('');
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 5000);
    try {
      await checkSchoolConnection(controller.signal);
      if (controller.signal.aborted) return;
      rememberOffline(false); setSchoolOffline(false); setSchoolReachable(true);
      setRetry(value => value + 1);
    } catch {
      if (controller.signal.aborted && !timedOut) return;
      setConnectionError('The school connection is unavailable right now. Your saved learning stays on this device. Please try again.');
      rememberOffline(true); setSchoolOffline(true); setSchoolReachable(false);
    } finally { clearTimeout(timeout); connectionRequest.current = null; setConnectionChecking(false); }
  }
  // A remembered disconnection is a hint, not a permanent access restriction.
  // Recheck automatically only for setup/streaming, never a downloaded offline lesson.
  const needsNetwork = !snapshot || Boolean(snapshot.lesson.recording && 'mediaUrl' in snapshot.lesson.recording.audio);
  useEffect(() => {
    if (!session || !online || !schoolOffline || !needsNetwork) return;
    const timer = window.setTimeout(() => void reconnect(), 100);
    return () => { clearTimeout(timer); };
  }, [session?.id, online, schoolOffline, needsNetwork]);
  useEffect(() => {
    setPhase('waiting');
    if (!session || !recordingId || !(online || schoolReachable) || schoolOffline) { wake.current = () => {}; return; }
    const learner = session;
    let active = true, running = false;
    let timer: number | undefined, request: AbortController | undefined;
    function isCurrent() {
      return active && latest.current?.lesson.studentId === learner.id && latest.current.lesson.recording?.id === recordingId;
    }
    function schedule(delay = 1800) {
      if (!active || running) return;
      clearTimeout(timer); timer = window.setTimeout(() => void synchronize(), delay);
    }
    async function synchronize() {
      const current = latest.current;
      if (!active || running || !current || current.lesson.studentId !== learner.id || current.lesson.recording?.id !== recordingId) return;
      if (savedState.current !== 'Saved on this device') { schedule(30000); return; }
      running = true;
      let successful = false;
      request = new AbortController();
      const abort = request;
      const timeout = window.setTimeout(() => abort.abort(), 15000);
      const endpoint = `/api/progress/${learner.id}/${recordingId}`;
      try {
        const pending = pendingProgress(current.progress, current.sync);
        if (!current.sync || pending.events || pending.questions) {
          setPhase('sending');
          const record = { ...current.progress, exportedAt: new Date().toISOString() };
          const sha256 = await progressDigest(record), body = await encryptPayload(record, learner.pin);
          if (!isCurrent()) return;
          if (abort.signal.aborted) throw new Error('School sync timed out.');
          const response = await fetch(endpoint, { method: 'POST', signal: abort.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          const receipt: unknown = await response.json();
          if (!response.ok && String((receipt as { error?: string }).error).includes('newer or different learning records')) {
            const received = await fetch(endpoint, { signal: abort.signal });
            if (!received.ok) throw new Error('Saved school history could not be recovered.');
            const record = await decryptPayload(await received.json(), learner.pin);
            if (!isCurrent() || abort.signal.aborted) return;
            const { sync: _oldReceipt, ...currentLocal } = latest.current!;
            const recovered = { ...currentLocal, progress: recoverReceivedProgress(currentLocal.progress, record, currentLocal.lesson) };
            latest.current = recovered; updating.current(recovered);
            return;
          }
          if (!response.ok || !validateProgressReceipt(receipt) || receipt.studentId !== learner.id || receipt.lessonId !== current.lesson.lessonId || receipt.recordingId !== recordingId || receipt.sha256 !== sha256) throw new Error('School acknowledgement failed.');
          if (!isCurrent()) return;
          if (abort.signal.aborted) throw new Error('School sync timed out.');
          const previous = latest.current!;
          const sync: ProgressSyncState = { receipt, eventIds: record.events.map(event => event.eventId!), questionIds: record.queuedQuestions.map(question => question.id) };
          // Acknowledges the submitted prefix; work added during the request remains pending.
          const next = { ...previous, sync }; latest.current = next; updating.current(next);
        }
        const response = await fetch(endpoint, { signal: abort.signal });
        if (!response.ok) throw new Error('Returned guidance is unavailable.');
        const value = await decryptPayload(await response.json(), learner.pin);
        if (!isCurrent()) return;
        if (abort.signal.aborted) throw new Error('School sync timed out.');
        const previous = latest.current!;
        const progress = mergeReturnedAnswers(previous.progress, value as Snapshot['progress'], previous.lesson);
        if (JSON.stringify(progress.queuedQuestions) !== JSON.stringify(previous.progress.queuedQuestions)) {
          const next = { ...previous, progress }; latest.current = next; updating.current(next);
        }
        successful = true; setPhase('received');
      } catch { if (isCurrent()) setPhase('failed'); }
      finally {
        clearTimeout(timeout); running = false; request = undefined;
        const next = latest.current, pending = next && pendingProgress(next.progress, next.sync);
        schedule(successful && (pending?.events || pending?.questions) ? 1800 : 30000);
      }
    }
    wake.current = () => { if (!running) schedule(); };
    schedule();
    return () => { active = false; clearTimeout(timer); request?.abort(); wake.current = () => {}; };
  }, [session?.id, recordingId, online, schoolReachable, schoolOffline, retry]);
  useEffect(() => {
    if (saved !== 'Saved on this device' || !snapshot) return;
    const pending = pendingProgress(snapshot.progress, snapshot.sync);
    if (!snapshot.sync || pending.events || pending.questions) wake.current();
  }, [snapshot?.progress, saved]);

  const pending = snapshot ? pendingProgress(snapshot.progress, snapshot.sync) : { events: 0, questions: 0 };
  const summary = `${pending.events} learning events and ${pending.questions} questions waiting to sync.`;
  let status = 'Your progress is saved on this device.';
  if (session && recordingId) {
    if (!(online || schoolReachable) || schoolOffline) status = 'Saved on this device · waiting for connection. ' + summary;
    else if (saved !== 'Saved on this device') status = saved || 'Saving on this device…';
    else if (phase === 'failed') status = 'Saved on this device · school sync unavailable. Try again or transfer at school. ' + summary;
    else if (phase === 'sending') status = 'Sending your learning back to school…';
    else if (snapshot?.sync && !pending.events && !pending.questions) status = `Everything is up to date · school received your progress. ${snapshot.sync.eventIds.length} learning events received.`;
    else status = 'Saved on this device · waiting to sync. ' + summary;
  }
  return { status, offline: schoolOffline, schoolReachable, connectionChecking, connectionError, retry: () => { void reconnect(); } };
}
