import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { decryptPayload, encryptPayload, initialTutorState, validTutorState, validateProgressReceipt, progressDigest, recoverReceivedProgress, mergeCheckAttempts, mergeTutorChecks, type TutorState, type TutorCheckRequest } from '@coteacher/shared';
import type { Snapshot } from './storage';

const emptyController = { online: false, status: '', enabled: false, ready: false, enable: (_: boolean) => {}, retry: () => {}, transcribe: async (_: Blob): Promise<string> => { throw new Error('Connected voice is unavailable. Please type.'); },
  requestCheck: async (_: Omit<TutorCheckRequest, 'enabled'>, _signal: AbortSignal): Promise<TutorState> => { throw new Error('A connected check is unavailable.'); },
  connectLive: async (_sdp: string, _positionMs: number, _signal: AbortSignal, _progress?: (message: string) => void): Promise<{ session: { id: string }; transport: { sdp: string }; model?: string }> => { throw new Error('Live voice is unavailable. Please type.'); } };
export const ConnectedTutorContext = createContext(emptyController);
export const useTutor = () => useContext(ConnectedTutorContext);
/** Opt-in only, receipt-backed, profile-scoped. No network dependency on offline learning. */
export function useConnectedTutor(session: { id: string; pin: string } | null, snapshot: Snapshot | null, online: boolean, saved: string, update: (next: Snapshot) => void, live?: { current: Snapshot | null }, reconnect?: () => void) {
  const [status, updateStatus] = useState('');
  const connectionStatus = useRef('');
  function setStatus(value: string) { connectionStatus.current = value; updateStatus(value); }
  const [ready, updateReady] = useState(false);
  const readiness = useRef(false);
  const acknowledged = useRef('');
  function setReady(value: boolean) { readiness.current = value; updateReady(value); }
  const [retry, setRetry] = useState(0);
  const rendered = useRef(snapshot); rendered.current = snapshot;
  const latest = live ?? rendered;
  const saving = useRef(saved); saving.current = saved;
  const updating = useRef(update); updating.current = update;
  const retryRequested = useRef(false);
  const wake = useRef<() => void>(() => {});
  const enabled = snapshot?.tutor?.enabled ?? false;
  const scope = session?.id + '/' + snapshot?.lesson.recording?.id;
  useEffect(() => {
    setStatus('');
    setReady(false);
    acknowledged.current = '';
    if (!session || !snapshot?.lesson.recording || !online || !enabled) return;
    const learner = session, recordingId = snapshot.lesson.recording.id;
    let active = true, running = false, timer: number | undefined, request: AbortController | undefined;
    let submitted = '', etag = '';
    const currentScope = () => active && latest.current?.lesson.studentId === learner.id && latest.current?.lesson.recording?.id === recordingId && latest.current?.tutor?.enabled;
    const schedule = (delay = 2000) => { clearTimeout(timer); if (active) timer = window.setTimeout(() => void sync(), delay); };
    async function sync() {
      if (running || !currentScope()) return;
      if (saving.current !== 'Saved on this device') { schedule(); return; }
      running = true; request = new AbortController();
      const controller = request, timeout = window.setTimeout(() => controller.abort(), 15000);
      try {
        const current = latest.current!, endpoint = `/api/tutor/${learner.id}/${recordingId}`;
        let state: unknown;
        let returnedEtag = '';
        const signature = JSON.stringify([current.progress, current.tutor?.liveTurns, current.tutor?.checkAttempts]);
        if (submitted !== signature || retryRequested.current) {
          setStatus('Connecting your saved question and learning history…');
          const record = { ...current.progress, exportedAt: new Date().toISOString() }, sha = await progressDigest(record);
          const body = await encryptPayload({ enabled: true, retry: retryRequested.current, progress: record, ...(current.tutor?.liveTurns ? { liveTurns: current.tutor.liveTurns } : {}), ...(current.tutor?.checkAttempts ? { checkAttempts: current.tutor.checkAttempts } : {}) }, learner.pin);
          if (!currentScope()) return;
          const response = await fetch(endpoint, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          const value = await response.json();
          if (!response.ok) {
            if (String(value.error).includes('newer or different learning records')) {
              const received = await fetch(`/api/progress/${learner.id}/${recordingId}`, { signal: controller.signal });
              if (!received.ok) throw new Error('Your saved school history could not be recovered. Nothing was replaced.');
              const record = await decryptPayload(await received.json(), learner.pin);
              if (!currentScope() || controller.signal.aborted) return;
              const { sync: _oldReceipt, ...currentLocal } = latest.current!;
              const recovered = { ...currentLocal, progress: recoverReceivedProgress(currentLocal.progress, record, currentLocal.lesson) };
              latest.current = recovered; updating.current(recovered); submitted = ''; etag = '';
              setStatus('Your saved school history was recovered. Saving before reconnecting…');
              return;
            }
            throw new Error(value.error ?? 'Connected tutoring unavailable.');
          }
          if (!validateProgressReceipt(value.receipt) || value.receipt.sha256 !== sha || value.receipt.studentId !== learner.id || value.receipt.lessonId !== current.lesson.lessonId || value.receipt.recordingId !== recordingId) throw new Error('The school did not acknowledge your learning history.');
          state = await decryptPayload(value.state, learner.pin); submitted = signature; retryRequested.current = false;
          if (currentScope()) {
            const next = { ...latest.current!, sync: { receipt: value.receipt, eventIds: record.events.map(event => event.eventId!), questionIds: record.queuedQuestions.map(question => question.id) } };
            latest.current = next; updating.current(next);
          }
        } else {
          const response = await fetch(endpoint, { signal: controller.signal, headers: etag ? { 'If-None-Match': etag } : {} });
          if (response.status === 304) return;
          if (!response.ok) throw new Error('The connected tutor cannot be reached. Your question stays saved.');
          returnedEtag = response.headers.get('ETag') ?? '';
          state = await decryptPayload(await response.json(), learner.pin);
        }
        if (!currentScope()) return;
        if (controller.signal.aborted) throw new DOMException('The connection check timed out.', 'AbortError');
        const currentState = latest.current!;
        if (!validTutorState(state, currentState.lesson, currentState.progress)) throw new Error('The returned answer did not match your learner and lesson context.');
        etag = returnedEtag;
        setReady(state.enabled);
        acknowledged.current = submitted;
        const turns = [...((state as TutorState).liveTurns ?? [])];
        for (const turn of currentState.tutor?.liveTurns ?? []) if (!turns.some(item => item.id === turn.id) && turns.length < 200) turns.push(turn);
        const merged: TutorState = { ...state, enabled: currentState.tutor!.enabled, ...(turns.length ? { liveTurns: turns } : {}), checks: mergeTutorChecks(state.checks, currentState.tutor?.checks), checkAttempts: mergeCheckAttempts(state.checkAttempts, currentState.tutor?.checkAttempts) };
        if (!validTutorState(merged, currentState.lesson, currentState.progress)) throw new Error('The combined tutor history failed validation. Nothing was replaced.');
        if (JSON.stringify(merged) !== JSON.stringify(currentState.tutor)) {
          const next = { ...currentState, tutor: merged }; latest.current = next; updating.current(next);
        }
        setStatus(state.replies.some(reply => reply.status === 'queued') ? 'Coteacher is preparing a sourced answer…' : 'Your connected answers and learning history are saved.');
      } catch (error) {
        // A failed check invalidates readiness. The retry must fetch and validate
        // a full response: 304 cannot restore a readiness flag that was cleared.
        etag = '';
        if (currentScope()) { setReady(false); setStatus((error as Error).message + ' Your question remains on this device.'); }
      }
      finally { clearTimeout(timeout); running = false; request = undefined; schedule(5000); }
    }
    wake.current = () => { if (!running) schedule(800); }; schedule(800);
    return () => { active = false; clearTimeout(timer); request?.abort(); wake.current = () => {}; };
  }, [scope, online, enabled, retry]);
  useEffect(() => { if (saved === 'Saved on this device') wake.current(); }, [snapshot?.progress, snapshot?.tutor?.liveTurns, snapshot?.tutor?.checkAttempts, saved]);
  return { online, status: enabled && !online ? 'Prepared help is ready offline. New questions wait for connection.' : status, enabled, ready,
    enable(value: boolean) {
      const current = latest.current; if (!current?.lesson.recording) return;
      const next = { ...current, tutor: { ...(current.tutor ?? initialTutorState(current.lesson)), enabled: value } };
      latest.current = next; updating.current(next);
      if (!value && online && session) {
        const owner = current.lesson.studentId;
        void encryptPayload({ enabled: false }, session.pin).then(body => fetch(`/api/tutor/${owner}/${current.lesson.recording!.id}/consent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) })).then(response => {
          if (!response.ok) throw new Error('The school could not stop queued tutor jobs. Reconnect and retry turning the coach off.');
        }).catch(error => { if (latest.current?.lesson.studentId === owner) setStatus((error as Error).message); });
      }
    },
    retry() { reconnect?.(); retryRequested.current = true; setRetry(value => value + 1); },
    async requestCheck(request: Omit<TutorCheckRequest, 'enabled'>, signal: AbortSignal): Promise<TutorState> {
      const current = latest.current;
      if (!online || !session || !current?.tutor?.enabled) throw new Error('Connect and enable Coteacher to prepare a check for your question. Downloaded checks still work offline.');
      const owner = current.lesson.studentId, recordingId = current.lesson.recording!.id;
      const sameScope = () => latest.current?.lesson.studentId === owner && latest.current.lesson.recording?.id === recordingId && latest.current.tutor?.enabled;
      const deadline = Date.now() + 45000;
      wake.current();
      while (sameScope() && (saving.current !== 'Saved on this device' || !readiness.current || acknowledged.current !== JSON.stringify([latest.current!.progress, latest.current!.tutor?.liveTurns, latest.current!.tutor?.checkAttempts]))) {
        if (signal.aborted) throw new DOMException('Check cancelled.', 'AbortError');
        if (Date.now() >= deadline) throw new Error('Your question and attempts are still waiting for the school connection. They remain saved.');
        await new Promise<void>(resolve => { const timer = setTimeout(done, 300); function done() { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); } signal.addEventListener('abort', done, { once: true }); });
      }
      if (signal.aborted || !sameScope()) throw new DOMException('Check cancelled.', 'AbortError');
      const body = await encryptPayload({ enabled: true, ...request }, session.pin);
      const response = await fetch(`/api/tutor/${owner}/${recordingId}/check`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.any([signal, AbortSignal.timeout(50000)]) });
      if (!response.ok) throw new Error((await response.json()).error ?? 'A reliable check is not available for your question.');
      const state = await decryptPayload(await response.json(), session.pin);
      if (signal.aborted || !sameScope()) throw new DOMException('Check cancelled.', 'AbortError');
      const local = latest.current!;
      if (!validTutorState(state, local.lesson, local.progress)) throw new Error('The returned check did not match your question and learner.');
      const tutor: TutorState = { ...state, enabled: local.tutor!.enabled, liveTurns: [...(local.tutor?.liveTurns ?? [])], checks: mergeTutorChecks(state.checks, local.tutor?.checks), checkAttempts: mergeCheckAttempts(state.checkAttempts, local.tutor?.checkAttempts) };
      // Preserve returned turns as well as new local finals during the request.
      for (const turn of state.liveTurns ?? []) if (!tutor.liveTurns!.some(t => t.id === turn.id)) tutor.liveTurns!.push(turn);
      if (!validTutorState(tutor, local.lesson, local.progress)) throw new Error('Combined check history failed validation. Nothing was replaced.');
      const next = { ...local, tutor }; latest.current = next; updating.current(next); return tutor;
    },
    async connectLive(sdp: string, positionMs: number, signal: AbortSignal, progress?: (message: string) => void) {
      const current = latest.current;
      if (!online || !session || !current?.tutor?.enabled) throw new Error('Enable connected tutoring while online to start live voice. Text and prepared help still work.');
      const owner = current.lesson.studentId, recordingId = current.lesson.recording!.id;
      // Native microphone permission is requested by the live controller first.
      // The existing receipt-backed sync loop retries temporary aborted requests;
      // wait for its acknowledgement rather than disabling the student's action.
      while (!readiness.current) {
        if (signal.aborted) throw new DOMException('Live connection cancelled.', 'AbortError');
        if (latest.current?.lesson.studentId !== owner || latest.current.lesson.recording?.id !== recordingId || !latest.current.tutor?.enabled) throw new Error('The learner or voice permission changed.');
        progress?.(saving.current !== 'Saved on this device'
          ? 'Microphone on · waiting for your learning to finish saving. ' + saving.current
          : 'Microphone on · waiting for your school connection. ' + (connectionStatus.current || 'Retrying the connection…'));
        await new Promise<void>((resolve, reject) => {
          const cancelled = () => { clearTimeout(timer); reject(new DOMException('Live connection cancelled.', 'AbortError')); };
          const timer = setTimeout(() => { signal.removeEventListener('abort', cancelled); resolve(); }, 500);
          signal.addEventListener('abort', cancelled, { once: true });
        });
      }
      if (signal.aborted) throw new DOMException('Live connection cancelled.', 'AbortError');
      progress?.('Microphone on · requesting the live conversation…');
      const body = await encryptPayload({ enabled: true, sdp, positionMs }, session.pin);
      const response = await fetch(`/api/tutor/${owner}/${recordingId}/live`, { method: 'POST', signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error((await response.json()).error ?? 'Live voice could not connect. Please type.');
      const value = await decryptPayload(await response.json(), session.pin) as { session: { id: string }; transport: { sdp: string }; model?: string };
      if (latest.current?.lesson.studentId !== owner || latest.current.lesson.recording?.id !== recordingId) throw new Error('The learner changed. Live voice was cancelled.');
      return value;
    },
    async transcribe(blob: Blob) {
      const current = latest.current;
      if (!online || !session || !current?.tutor?.enabled) throw new Error('Connected voice requires an enabled online tutor. Please type your question.');
      const owner = current.lesson.studentId, recordingId = current.lesson.recording!.id;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
      const envelope = await encryptPayload({ enabled: true, audioBase64: btoa(binary), mime: blob.type }, session.pin);
      const response = await fetch(`/api/tutor/${owner}/${recordingId}/voice`, { method: 'POST', signal: AbortSignal.timeout(55000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(envelope) });
      if (!response.ok) throw new Error((await response.json()).error ?? 'Voice could not connect. Please type.');
      const value = await decryptPayload(await response.json(), session.pin) as { text: string };
      if (latest.current?.lesson.studentId !== owner || latest.current.lesson.recording?.id !== recordingId) throw new Error('The learner changed. Voice text was discarded.');
      return value.text;
    }
  };
}
