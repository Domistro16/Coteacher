import { useEffect, useMemo, useRef, useState } from 'react';
import { recordingCueAt, quizFeedback, quizCaption, activityCaptions, companionMessages, voiceMessages, initialTutorState, observedMemory, checkPersonalization, type TryItVariant, type LiveTutorTurn, type TutorCheck, type TutorCheckRequest, type QuizAnsweredEvent } from '@coteacher/shared';
import type { Snapshot } from './storage';
import { RecordedLesson } from './RecordedLesson';
import { Sources } from './Visual';
import { adaptRecordedMoment, exploreRecordedVisual } from './recorded-help';
import { answerUnderstandingCheck } from './activity-check';
import { createPlayerModel, selectedVariant, transitionPlayer, variantLabels, type PlayerAction } from './player';
import type { StudentResponse } from './help';
import { createSpeechInput } from './speech';
import { Icon, clock } from './student-ui';
import { PlayerQuestions } from './PlayerQuestions';
import { CompanionVoice } from './CompanionVoice';
import { CompanionDock } from './CompanionDock';
import { useCompanionSpeech } from './useCompanionSpeech';
import { createVoiceSession, type VoiceSessionState } from './voice-session';
import { companionIntent, isCompanionInterruption, spokenQuizOption } from './companion-intent';
import { useTutor } from './useConnectedTutor';
import { useConnectedVoice } from './useConnectedVoice';
import { TutorSources } from './TutorSources';
import { useLiveVoice } from './useLiveVoice';
import { QuizModal } from './QuizModal';

export function StudentPlayer({ snapshot, update, saved }: { snapshot: Snapshot; update: (next: Snapshot) => void; saved: string }) {
  const latest = useRef(snapshot); latest.current = snapshot;
  const { lesson, player, progress } = snapshot;
  const model = useMemo(() => createPlayerModel(lesson), [lesson]);
  const [panel, setPanel] = useState<'help' | 'activity' | 'check' | null>(player.recording?.support ? 'help' : null);
  const [response, setResponse] = useState<StudentResponse>({});
  const [draft, setDraft] = useState('');
  const [quizIndex, setQuizIndex] = useState(0);
  const [contextualCheck, setContextualCheck] = useState<TutorCheck | null>(null);
  const [checkPhase, setCheckPhase] = useState<'prepared' | 'loading' | 'error' | 'ready'>('prepared');
  const [checkError, setCheckError] = useState('');
  const checkRequest = useRef<AbortController | null>(null);
  const checkQuestion = useRef<Omit<TutorCheckRequest, 'enabled'> | null>(null);
  const [speechStatus, setSpeechStatus] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceSessionState>({ status: 'off', message: 'Microphone off · tap or type works too' });
  const [questionText, setQuestionText] = useState('');
  const [checkOffered, updateCheckOffered] = useState(false);
  const checkOffer = useRef(false);
  function setCheckOffered(value: boolean) { checkOffer.current = value; updateCheckOffered(value); }
  const [voiceSetupOpen, setVoiceSetupOpen] = useState(false);
  const speech = useMemo(createSpeechInput, []);
  const voice = useMemo(createVoiceSession, []);
  const companion = useCompanionSpeech();
  const tutor = useTutor();
  const sessionScope = lesson.studentId + '/' + lesson.recording!.id;
  const liveVoice = useLiveVoice(sessionScope, tutor.enabled && tutor.online);
  const connectedVoice = useConnectedVoice(tutor.transcribe, setDraft);
  const spokenReply = useRef('');
  const liveQuestions = useRef(new Set<string>());
  const voiceHandler = useRef<(text: string) => void>(() => {});
  const timestamp = () => new Date().toISOString();
  function commit(next: Snapshot) { latest.current = next; update(next); }
  useEffect(() => {
    const stop = () => { speech.stop(); voice.stop(); setVoiceEnabled(false); };
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', stop);
    window.addEventListener('coteacher-lock', stop); window.addEventListener('pagehide', stop);
    return () => { stop(); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', stop);
      window.removeEventListener('coteacher-lock', stop); window.removeEventListener('pagehide', stop); };
  }, [speech, voice]);
  useEffect(() => {
    if (!voiceEnabled || companion.state.status === 'playing' || companion.speaking || panel === 'activity' || panel === 'check') {
      voice.stop(); return;
    }
    void voice.start(text => voiceHandler.current(text), state => {
      setVoiceState(state);
      if (state.status === 'unavailable') setVoiceEnabled(false);
    });
    return () => voice.stop();
  }, [voiceEnabled, companion.state.status === 'playing', companion.speaking, panel, voice]);
  const position = player.recording?.positionMs ?? 0;
  const cue = recordingCueAt(lesson.recording!, position);
  const context = model.steps.find(entry => entry.step.id === cue.timelineStepId)!;
  const variant = selectedVariant(model, player);
  const activity = context.concept.variants.find((entry): entry is TryItVariant => entry.type === 'tryit');
  const quizzes = lesson.quiz.filter(entry => entry.conceptId === context.concept.id);
  const item = contextualCheck ?? (checkPhase === 'prepared' ? quizzes[Math.min(quizIndex, quizzes.length - 1)] : undefined);
  const attempts = contextualCheck ? snapshot.tutor?.checkAttempts?.filter(a => a.checkId === contextualCheck.id) ?? [] : item ? progress.events.filter((event): event is QuizAnsweredEvent => event.type === 'quiz-answered' && event.quizId === item.id) : [];
  const answer = attempts.at(-1);
  const supportAsset = lesson.visualAssets?.find(entry => entry.id === player.recording?.support?.visualAssetId && entry.conceptId === cue.conceptId);
  const recommendation = snapshot.tutor?.memory.recommendations.find(entry => entry.conceptId === cue.conceptId);
  const recommendedAsset = lesson.visualAssets?.find(entry => entry.id === recommendation?.visualAssetId && entry.conceptId === cue.conceptId);
  const teacherReply = progress.queuedQuestions.find(question => question.answered && question.text === questionText && question.recordedContext?.positionMs === position);
  const aiReply = teacherReply ? undefined : [...(snapshot.tutor?.replies ?? [])].reverse().find(reply => reply.originalText === questionText && reply.conceptId === cue.conceptId && reply.positionMs === position);
  useEffect(() => {
    if (!contextualCheck || !snapshot.tutor?.replies.some(r => r.questionId === contextualCheck.questionId && r.review === 'flagged')) return;
    checkRequest.current?.abort(); companion.stop(); setContextualCheck(null); setCheckPhase('error'); setCheckError('Your teacher flagged this answer. Use prepared lesson help for now.');
  }, [contextualCheck?.id, snapshot.tutor?.replies]);
  useEffect(() => {
    if (teacherReply?.answered) { companion.stop(); return; }
    if (aiReply?.review === 'flagged') { companion.stop(); liveVoice.stop(); return; }
    if (panel !== 'help' || !aiReply || aiReply.status !== 'answered') return;
    setCheckOffered(quizzes.length > 0);
    const key = sessionScope + '/' + aiReply.questionId + '/' + aiReply.updatedAt;
    if (spokenReply.current === key) return;
    spokenReply.current = key; voice.stop(); speech.stop();
    if (aiReply.visualAssetId) {
      const current = latest.current;
      // Support is a paused overlay; the original recording and its cue sequence stay intact.
      commit({ ...current, player: { ...current.player, recording: { ...current.player.recording!, support: { timelineStepId: aiReply.timelineStepId, visualAssetId: aiReply.visualAssetId } } } });
    }
    // A stopped/hidden live session must not turn a delayed reply into autoplay.
    // The sourced answer remains saved and can be read or explicitly replayed.
    if (liveVoice.isActive() || liveQuestions.current.has(aiReply.questionId)) { companion.stop(); return; }
    if (aiReply.speechBase64) companion.speakGenerated(aiReply.text, aiReply.speechBase64);
    else companion.stop();
  }, [aiReply?.questionId, aiReply?.updatedAt, aiReply?.review, teacherReply, panel, sessionScope, liveVoice.active, quizzes.length]);
  useEffect(() => {
    // Restoring a paused conversation prepares speech, never reenables its mic.
    liveQuestions.current.clear();
    checkRequest.current?.abort(); setContextualCheck(null); setCheckPhase('prepared');
    const restoredQuestion = player.recording?.support ? [...progress.queuedQuestions].reverse().find(q => q.recordedContext?.conceptId === cue.conceptId) : undefined;
    checkQuestion.current = restoredQuestion?.recordedContext ? { questionId: restoredQuestion.id, originalText: restoredQuestion.text, positionMs: restoredQuestion.recordedContext.positionMs } : null;
    voice.stop(); setVoiceEnabled(false); companion.stop(); setResponse({}); setDraft(''); setQuestionText(''); setCheckOffered(false);
    if (player.recording?.support) {
      companion.stop();
      setPanel('help');
    } else setPanel(null);
  }, [sessionScope]);
  useEffect(() => () => checkRequest.current?.abort(), []);
  function openSession(at: number) {
    if (panel) { if (tutor.online && tutor.enabled && !liveVoice.isActive()) startLive(true); return; }
    voice.stop(); speech.stop(); connectedVoice.cancel(); companion.stop();
    const current = latest.current;
    const moment = recordingCueAt(lesson.recording!, at);
    const destination = model.steps[current.player.timelineIndex].step.id === moment.timelineStepId ? { player: current.player, events: [] }
      : transitionPlayer(model, current.player, { type: 'revisit-step', timelineStepId: moment.timelineStepId }, timestamp());
    commit({ ...current, player: { ...destination.player, recording: { ...current.player.recording!, recordingId: lesson.recording!.id, positionMs: Math.round(at) } },
      progress: { ...current.progress, events: [...current.progress.events, ...destination.events] } });
    setResponse({}); setQuestionText(''); setCheckOffered(false); setPanel('help');
    checkQuestion.current = null;
    if (tutor.online) {
      if (tutor.enabled) startLive(true);
      else setVoiceSetupOpen(true);
    }
  }
  function help(at: number, detail = '') {
    voice.stop(); speech.stop(); connectedVoice.cancel();
    const current = latest.current;
    const moment = recordingCueAt(lesson.recording!, at);
    const memory = observedMemory(lesson, current.progress, current.tutor?.memory ?? initialTutorState(lesson).memory);
    const suggested = memory.recommendations.find(entry => entry.conceptId === moment.conceptId);
    const spokenVisual = suggested?.visualAssetId ?? (moment.conceptId === 'refraction' && lesson.visualAssets?.some(asset => asset.id === 'refraction-pencil') ? 'refraction-pencil' : undefined);
    const next = adaptRecordedMoment(lesson, current.player, current.progress, at, detail, timestamp(), () => 'queued-' + crypto.randomUUID(), spokenVisual);
    // Only an actual submitted question opts into connected text tutoring; never fabricate an opening question.
    const connected = Boolean(detail.trim() && tutor.online && tutor.enabled);
    commit({ ...current, player: next.player, progress: next.progress });
    setResponse(next.response); setPanel('help'); setQuestionText(detail); setCheckOffered(false);
    const chosen = selectedVariant(model, next.player);
    const active = model.steps.find(entry => entry.step.id === moment.timelineStepId)!;
    const explanation = chosen.type === 'tryit' ? active.original : chosen;
    const question = next.response.question;
    if (detail.trim() && question?.questionId) checkQuestion.current = { questionId: question.questionId, originalText: detail, positionMs: Math.round(at) };
    if (question?.status === 'pending' && connected) { companion.stop(); return next.response; }
    setCheckOffered(quizzes.length > 0 && (!question || question.status === 'prepared'));
    const frames = question ? [{ text: question.status === 'prepared' ? question.text : companionMessages.pending, refs: question.refs }]
      : [{ text: explanation.content, refs: explanation.sourceRefs }];
    if (liveVoice.isActive()) companion.prepare(frames);
    else companion.speak([...frames, { text: companionMessages.understanding, refs: [] }]);
    return next.response;
  }
  function openCheck(index = 0, preparedOnly = false) {
    setCheckOffered(false);
    liveVoice.stop();
    voice.stop(); speech.stop(); connectedVoice.cancel(); setVoiceEnabled(false); companion.stop();
    window.dispatchEvent(new Event('coteacher-pause-recording'));
    checkRequest.current?.abort(); setContextualCheck(null); setCheckError(''); setQuizIndex(index); setPanel('check');
    const current = latest.current, at = current.player.recording?.positionMs ?? 0;
    const requested = !preparedOnly && checkQuestion.current && recordingCueAt(lesson.recording!, checkQuestion.current.positionMs).conceptId === cue.conceptId ? checkQuestion.current : null;
    if (requested) {
      const personal = checkPersonalization(lesson, current.progress, cue.conceptId, current.tutor?.checks, current.tutor?.checkAttempts);
      const cached = [...(current.tutor?.checks ?? [])].reverse().find(c => c.questionId === requested.questionId && c.originalText === requested.originalText && c.positionMs === requested.positionMs
        && (!tutor.online || !tutor.enabled || JSON.stringify(c.personalization) === JSON.stringify(personal)));
      if (current.tutor?.replies.some(r => r.questionId === requested.questionId && r.review === 'flagged')) { setCheckPhase('error'); setCheckError('Your teacher flagged this answer. Use prepared lesson help for now.'); return; }
      if (cached) { setContextualCheck(cached); setCheckPhase('ready'); if (cached.speechBase64 && !document.hidden && document.hasFocus()) companion.speakGenerated(quizCaption(cached), cached.speechBase64); return; }
      if (!tutor.online || !tutor.enabled) { setCheckPhase('error'); setCheckError('No downloaded check matches your question yet. Connect and enable Coteacher to prepare one. Your place is saved.'); return; }
      setCheckPhase('loading');
      const request = new AbortController(); checkRequest.current = request;
      void tutor.requestCheck(requested, request.signal).then(state => {
        if (request.signal.aborted || checkRequest.current !== request) return;
        const check = [...(state.checks ?? [])].reverse().find(c => c.questionId === requested.questionId && c.originalText === requested.originalText && c.positionMs === requested.positionMs);
        if (!check) throw new Error('No reliable check was returned for your question.');
        setContextualCheck(check); setCheckPhase('ready'); if (check.speechBase64 && !document.hidden && document.hasFocus()) companion.speakGenerated(quizCaption(check), check.speechBase64);
      }).catch(error => { if (!request.signal.aborted && checkRequest.current === request) { setCheckPhase('error'); setCheckError((error as Error).message); } });
      return;
    }
    setCheckPhase('prepared');
    const moment = recordingCueAt(lesson.recording!, at);
    const question = lesson.quiz.filter(entry => entry.conceptId === moment.conceptId)[index];
    if (question) companion.speak([{ text: quizCaption(question), refs: question.sourceRefs }]);
    else companion.pause();
  }
  function answerQuiz(index: number) {
    if (!item) return;
    voice.stop(); speech.stop();
    const current = latest.current;
    if (contextualCheck) {
      if (!Number.isInteger(index) || index < 0 || index >= contextualCheck.options.length || (current.tutor?.checkAttempts?.length ?? 0) >= 200) return;
      const attempt = { id: 'check-attempt-' + crypto.randomUUID(), checkId: contextualCheck.id, selectedIndex: index, correctness: index === contextualCheck.correctIndex, answeredAt: timestamp() };
      commit({ ...current, tutor: { ...current.tutor!, checkAttempts: [...(current.tutor?.checkAttempts ?? []), attempt] } });
      companion.stop(); return;
    }
    commit({ ...current, progress: answerUnderstandingCheck(lesson, current.progress, item.id, index, timestamp()) });
    companion.speak([{ text: quizFeedback(item, index === item.correctIndex), refs: item.sourceRefs }]);
  }
  function respond(text: string) {
    if (!text.trim()) return;
    if (liveVoice.isActive()) { void liveVoice.ask(text); return; }
    voice.stop(); speech.stop();
    if (panel === 'check') {
      const option = item && spokenQuizOption(text, item.options);
      if (option !== undefined) { answerQuiz(option); return; }
    }
    const intent = companionIntent(text, checkOffer.current);
    if (intent === 'confirm') { setQuestionText(text); setCheckOffered(true); companion.speak([{ text: companionMessages.checkOffer, refs: [] }]); }
    else if (intent === 'check') openCheck();
    else if (intent === 'resume') resume();
    else if (intent === 'another') help(position);
    else help(position, text);
  }
  voiceHandler.current = text => {
    if (panel) respond(text);
    else if (isCompanionInterruption(text)) {
      voice.stop();
      window.dispatchEvent(new CustomEvent('coteacher-explain-recording', { detail: { recordingId: lesson.recording!.id } }));
    }
  };
  function dispatch(action: PlayerAction) {
    const current = latest.current;
    const next = transitionPlayer(model, current.player, action, timestamp());
    commit({ ...current, player: next.player, progress: { ...current.progress, events: [...current.progress.events, ...next.events] } });
    setResponse({});
    if (action.type === 'complete-activity') openCheck(0, true);
    else if (activity && next.player.activity) companion.speak(activityCaptions(activity, next.player.activity).map(text => ({ text, refs: activity.sourceRefs })));
  }
  function openActivity() {
    checkRequest.current?.abort();
    liveVoice.stop();
    if (!activity) return;
    if (latest.current.player.variantId !== activity.id) dispatch({ type: 'select-variant', variantId: activity.id }); setPanel('activity');
    voice.stop(); companion.speak(activityCaptions(activity, { phase: 'intro', instructionIndex: 0 }).map(text => ({ text, refs: activity.sourceRefs })));
  }
  function close() {
    checkRequest.current?.abort();
    setCheckOffered(false);
    liveVoice.stop();
    setVoiceSetupOpen(false);
    speech.stop(); companion.stop(); connectedVoice.cancel(); setPanel(null); checkQuestion.current = null;
    const current = latest.current;
    if (current.player.recording?.support) {
      const { support, ...recording } = current.player.recording;
      commit({ ...current, player: { ...current.player, recording } });
    }
  }
  function resume() { close(); window.dispatchEvent(new Event('coteacher-resume-recording')); }
  function closeCheck() { checkRequest.current?.abort(); companion.stop(); setPanel('help'); }
  function toggleVoice() { liveVoice.stop(); speech.stop(); if (voiceEnabled) { voice.stop(); setVoiceState({ status: 'off', message: 'Microphone off · tap or type works too' }); } setVoiceEnabled(!voiceEnabled); }
  function activateVoice() {
    if (liveVoice.isActive()) { liveVoice.stop(); return; }
    if (!navigator.onLine) { toggleVoice(); return; }
    if (tutor.enabled && tutor.online) { startLive(); return; }
    // Open the actual current-moment panel and its disclosure before any external voice capture.
    if (!panel) window.dispatchEvent(new CustomEvent('coteacher-explain-recording', { detail: { recordingId: lesson.recording!.id } }));
    voice.stop(); speech.stop(); setVoiceEnabled(false); setVoiceSetupOpen(true);
  }
  async function delegateLive(text: string, signal: AbortSignal) {
    const intent = companionIntent(text, checkOffer.current);
    if (intent === 'confirm') { setQuestionText(text); setCheckOffered(true); return { text: companionMessages.checkOffer, sourceRefs: [] }; }
    if (intent === 'resume') { resume(); return { text: 'Returning to your teacher at the saved position.', sourceRefs: [] }; }
    if (intent === 'check') { openCheck(); return { text: 'Your quick check is open. The teacher recording remains paused.', sourceRefs: [] }; }
    const current = latest.current, at = current.player.recording!.positionMs;
    const result = help(at, intent === 'another' ? '' : text);
    if (result?.question?.status === 'prepared') return { text: result.question.text + ' ' + companionMessages.understanding, sourceRefs: result.question.refs };
    if (intent === 'another') { const prepared = selectedVariant(model, latest.current.player); return { text: (prepared.type === 'tryit' ? context.original.content : prepared.content) + ' ' + companionMessages.understanding, sourceRefs: prepared.sourceRefs }; }
    const queued = [...latest.current.progress.queuedQuestions].reverse().find(entry => entry.text === text && entry.recordedContext?.positionMs === at);
    if (!queued) return { text: 'Please ask which part of the current concept is unclear, or use the prepared explanation.', sourceRefs: [] };
    liveQuestions.current.add(queued.id);
    // The existing durable queue, acknowledged sync and source checker own the answer.
    const deadline = Date.now() + 150000;
    while (!signal.aborted && Date.now() < deadline && latest.current.lesson.studentId + '/' + latest.current.lesson.recording!.id === sessionScope) {
      const answer = latest.current.progress.queuedQuestions.find(entry => entry.id === queued.id);
      if (answer?.answered) return { text: answer.answer + ' ' + companionMessages.understanding, sourceRefs: answer.sourceRefs };
      const reply = latest.current.tutor?.replies.find(entry => entry.questionId === queued.id && entry.status !== 'queued');
      if (reply) return { text: reply.review === 'flagged' ? 'Your teacher flagged this answer for review. Use prepared help for now.' : reply.text + (reply.status === 'answered' ? ' ' + companionMessages.understanding : ''), sourceRefs: reply.review === 'flagged' ? [] : reply.sourceRefs };
      await new Promise<void>(resolve => { const timer = setTimeout(done, 300); function done() { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); } signal.addEventListener('abort', done, { once: true }); });
    }
    throw new Error('Your question stays saved while the source-checked answer is pending.');
  }
  function startLive(sessionOpened = false) {
    if (!tutor.enabled || !tutor.online || liveVoice.isActive()) return;
    setVoiceSetupOpen(false);
    if (!panel && !sessionOpened) window.dispatchEvent(new CustomEvent('coteacher-explain-recording', { detail: { recordingId: lesson.recording!.id } }));
    companion.stop(); speech.stop(); voice.stop(); setVoiceEnabled(false); connectedVoice.cancel();
    const at = latest.current.player.recording!.positionMs;
    void liveVoice.start({ connect: (sdp, signal, progress) => tutor.connectLive(sdp, at, signal, progress), delegate: delegateLive,
      transcript: (sessionId, role, text, sourceRefs, model) => {
        const current = latest.current;
        if (current.lesson.studentId + '/' + current.lesson.recording!.id !== sessionScope || !current.tutor || current.tutor.liveTurns && current.tutor.liveTurns.length >= 200) return;
        const turn: LiveTutorTurn = { id: 'voice-' + crypto.randomUUID(), sessionId, conceptId: recordingCueAt(lesson.recording!, at).conceptId, positionMs: at, role, text, sourceRefs: sourceRefs.slice(0, 6) as LiveTutorTurn['sourceRefs'], model, observedAt: timestamp() };
        commit({ ...current, tutor: { ...current.tutor, liveTurns: [...(current.tutor.liveTurns ?? []), turn] } });
      }
    });
  }
  function prepareSpokenVisual() {
    if (aiReply?.status === 'answered' && aiReply.review !== 'flagged') return;
    const visualId = recommendedAsset?.id ?? (cue.conceptId === 'refraction' ? 'refraction-pencil' : undefined);
    if (panel !== 'help' || !visualId || supportAsset?.id === visualId || !lesson.visualAssets?.some(asset => asset.id === visualId)) return;
    const current = latest.current;
    commit({ ...current, ...exploreRecordedVisual(lesson, current.player, current.progress, position, visualId, timestamp(), 'prepared-help') });
  }
  const micStatus = !voiceEnabled ? voiceState.status === 'unavailable' ? voiceState.message : 'Microphone off · tap or type works too'
    : companion.state.status === 'playing' || companion.speaking ? 'Microphone paused while Coteacher speaks'
    : voiceEnabled && panel === 'activity' ? 'Microphone paused during the activity' : voiceState.message;
  const voiceActionLabel = liveVoice.active ? 'Turn live voice off' : navigator.onLine ? 'Talk by voice' : voiceEnabled ? 'Turn offline voice off' : 'Enable offline voice mode';
  const voiceActionStatus = liveVoice.active || navigator.onLine && liveVoice.state.status === 'error' ? liveVoice.state.message
    : voiceEnabled || !navigator.onLine ? micStatus : 'Microphone off · live voice requires a connection and your permission';
  const assistant = panel && <CompanionDock voiceActive={liveVoice.active} requestInput={voiceSetupOpen} toolMode={panel === 'check' ? 'help' : panel} lessonId={lesson.lessonId} conceptId={cue.conceptId} conceptTitle={context.concept.title} positionMs={position} onClose={close} onResume={resume}
    voice={<CompanionVoice docked compact={panel !== 'help'} live={liveVoice} lesson={lesson} speech={companion} prompt={questionText ? (teacherReply?.answered ? teacherReply.answer : '') || (aiReply?.review === 'flagged' ? 'Your teacher flagged this answer for review.' : aiReply?.text) || (response.question?.status === 'prepared' ? response.question.text : tutor.online && tutor.enabled ? tutor.status || 'Your question is saved. Checking the connected tutor…' : 'No prepared answer matches. Your question is saved. Connected answers require your permission.') : 'What is unclear about ' + context.concept.title.toLowerCase() + '? Ask by voice or type your question.'} beforeSpeech={prepareSpokenVisual} listening={connectedVoice.recording || voiceEnabled && voiceState.status === 'listening' && !companion.speaking && companion.state.status !== 'playing'} voiceEnabled={voiceEnabled || liveVoice.active} voiceStatus={voiceActionStatus} voiceActionLabel={voiceActionLabel} toggleVoice={activateVoice} label={!questionText ? 'Coteacher · ready to listen' : companion.generated ? aiReply?.engine === 'mock' ? 'Mocked tutor · test response' : aiReply?.engine === 'openai' ? 'AI coach · downloaded AI voice' : 'Downloaded sourced companion voice' : questionText ? response.question?.status === 'prepared' ? 'Prepared offline answer' : tutor.online && tutor.enabled ? 'Connected tutor' : 'Saved on this device' : 'Coteacher · ready to listen'}/>}
    composer={<>
      {!voiceSetupOpen && <div className="companion-voice-mode">
      <form className="companion-composer" onSubmit={event => { event.preventDefault(); if (draft.trim()) { respond(draft); setDraft(''); } }}>
        <label className="sr-only" htmlFor="moment-question">Which part is tricky?</label><textarea id="moment-question" aria-label="Which part of this recorded concept is unclear?" placeholder={panel === 'check' ? 'Ask about this question…' : 'Tell me what’s tricky…'} maxLength={1500} rows={1} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (draft.trim()) event.currentTarget.form?.requestSubmit(); } }}/>
        <button disabled={!draft.trim()} className="primary" aria-label="Ask Coteacher"><Icon name="arrow"/></button>
        <button type="button" aria-label={voiceActionLabel} title={voiceActionLabel} aria-pressed={voiceEnabled || liveVoice.active} onClick={activateVoice}><Icon name="mic"/></button>
      </form>
      <p role="status">{voiceActionStatus}</p><p className="companion-disclosure">Connected questions use OpenAI and your approved lesson sources. Answers are saved for teacher oversight.</p></div>}
      {!voiceSetupOpen && tutor.online && <label className="companion-disclosure"><input type="checkbox" checked={tutor.enabled} onChange={event => tutor.enable(event.target.checked)}/>Use connected AI answers</label>}
      {voiceSetupOpen && <div className="companion-connection" aria-label="Voice permission">
        <p>Voice sends microphone audio, questions and lesson excerpts to OpenAI. AI answers are saved for teacher oversight.</p>
        <label><input type="checkbox" checked={tutor.enabled} onChange={event => { tutor.enable(event.target.checked); if (event.target.checked) tutor.retry(); }}/>Enable connected tutoring and learning memory</label>
        <button disabled={!tutor.online || !tutor.enabled || liveVoice.active} onClick={() => startLive()}>Start live conversation</button>
        <button onClick={() => setVoiceSetupOpen(false)}>Type instead</button>
        <details><summary>Connection options</summary><p role="status">{tutor.status}</p><button onClick={tutor.retry}>Retry connection and questions</button>
          <button disabled={!tutor.online || !tutor.enabled || liveVoice.active} onClick={() => { companion.stop(); if (connectedVoice.recording) connectedVoice.stop(); else void connectedVoice.start(); }}>{connectedVoice.recording ? 'Stop voice question' : 'Record a voice question'}</button>
          <p role="status">{connectedVoice.status || speechStatus}</p>
        </details>
      </div>}

   </>}>
    {panel === 'help' && <>
      {questionText && <details className="companion-answer-details"><summary>Read answer & sources</summary>
        <p>{questionText}</p>
        {teacherReply?.answered ? <><p>{teacherReply.answer}</p><Sources lesson={lesson} refs={teacherReply.sourceRefs}/></> : aiReply ? <div data-tutor-status={aiReply.status} role="status"><p>{aiReply.review === 'flagged' ? 'Your teacher flagged this response for review.' : aiReply.text}</p>{aiReply.status === 'answered' && aiReply.review !== 'flagged' && <TutorSources reply={aiReply}/>}</div> : response.question && <><p>{response.question.status === 'prepared' ? response.question.text : tutor.online && tutor.enabled ? 'Your question is saved. Checking the connected tutor…' : 'No prepared answer matches. Saved for reconnection after connected answers are enabled.'}</p><Sources lesson={lesson} refs={response.question.refs}/></>}
      </details>}
      {(response.question?.status === 'prepared' || aiReply?.status === 'answered' || teacherReply?.answered || checkOffered) && <div className="companion-replies"><button onClick={() => respond('It makes sense now')}>It makes sense now</button>{checkOffered && quizzes.length > 0 && <button onClick={() => openCheck()}>Try a quick check</button>}{activity && <button onClick={openActivity}>Try it</button>}</div>}
      <details className="companion-more"><summary>Approved alternatives</summary>
        {recommendedAsset && recommendation && <section data-recommended-visual-id={recommendedAsset.id}><p>{recommendation.reason}</p><small>Based on {recommendation.evidenceEventIds.length} saved interaction{recommendation.evidenceEventIds.length === 1 ? '' : 's'}.</small><button onClick={() => { companion.pause(); const current = latest.current; commit({ ...current, ...exploreRecordedVisual(lesson, current.player, current.progress, position, recommendedAsset.id, timestamp()) }); }}>Try recommended visual</button><Sources lesson={lesson} refs={recommendedAsset.sourceRefs}/></section>}
        <button onClick={() => help(position)}>Prepared explanation</button>
        <details><summary>Read prepared explanation</summary><p>{variant.type === 'tryit' ? context.original.content : variant.content}</p><Sources lesson={lesson} refs={variant.type === 'tryit' ? context.original.sourceRefs : variant.sourceRefs}/></details>
        {lesson.visualAssets!.filter(entry => entry.conceptId === cue.conceptId).map(entry => <button key={entry.id} onClick={() => { companion.pause(); const current = latest.current; commit({ ...current, ...exploreRecordedVisual(lesson, current.player, current.progress, position, entry.id, timestamp()) }); }}>{entry.title}</button>)}
        {quizzes.length > 0 && <button onClick={() => openCheck()}>Quick check</button>}
        {activity && <button onClick={openActivity}>Try it activity</button>}
      </details>
      <PlayerQuestions lesson={lesson} progress={progress} saved={saved} open={false} replies={snapshot.tutor?.replies} conceptId={cue.conceptId} onHear={reply => {
        liveVoice.stop(); voice.stop(); speech.stop(); connectedVoice.cancel(); setQuestionText(reply.originalText);
        checkQuestion.current = { questionId: reply.questionId, originalText: reply.originalText, positionMs: reply.positionMs };
        if (reply.visualAssetId) { const current = latest.current; commit({ ...current, player: { ...current.player, recording: { ...current.player.recording!, support: { timelineStepId: reply.timelineStepId, visualAssetId: reply.visualAssetId } } } }); }
        companion.speakGenerated(reply.text, reply.speechBase64!);
      }}/>
    </>}
    {panel === 'activity' && <button className="text-action" onClick={() => { companion.stop(); setPanel('help'); }}>Back to our conversation</button>}
    {panel === 'activity' && activity && <section className="activity immersive-activity">
      {!player.activity || variant.type !== 'tryit' || player.activity.phase === 'intro' ? <><p>{activity.content}</p><h3>Gather these</h3><ul className="material-chips">{activity.items.map(entry => <li key={entry}>{entry}</li>)}</ul><div className="safety"><h3>Keep it safe</h3><ul>{activity.safetyNotes.map(entry => <li key={entry}>{entry}</li>)}</ul></div><button className="primary" onClick={() => dispatch({ type: 'start-activity' })}>Start activity</button></> : <>
        <details><summary>Materials and safety</summary><ul>{[...activity.items, ...activity.safetyNotes].map(entry => <li key={entry}>{entry}</li>)}</ul></details>
        {player.activity.phase === 'steps' ? <><p className="eyebrow">Step {player.activity.instructionIndex + 1} of {activity.steps.length}</p><p className="activity-instruction">{activity.steps[player.activity.instructionIndex]}</p><div className="activity-actions"><button onClick={() => dispatch({ type: 'previous-instruction' })}>Previous instruction</button><button className="primary" onClick={() => dispatch({ type: 'next-instruction' })}>{player.activity.instructionIndex + 1 === activity.steps.length ? 'See why it works' : 'Next instruction'}</button></div></> : <><h3>What did you notice?</h3><p>{activity.explainsWhy}</p><p className="helper-note">Finished trying it? Let’s check what it shows.</p><button className="primary" onClick={() => dispatch({ type: 'complete-activity' })}>I’ve finished · check my understanding</button></>}
      </>}<details><summary>Activity sources</summary><Sources lesson={lesson} refs={activity.sourceRefs}/></details>
    </section>}
  </CompanionDock>;
  return <div className="watch-page">
    {panel === 'check' && <QuizModal onClose={closeCheck} onResume={resume}>
      {checkPhase === 'loading' && <p role="status">Preparing a sourced check for the question you asked…</p>}
      {checkPhase === 'error' && <><p role="status">{checkError}</p>{tutor.online && tutor.enabled && <button onClick={() => openCheck()}>Try preparing this check again</button>}</>}
      {item && <section className="quiz-card"><p className="eyebrow">Question {contextualCheck ? 1 : quizIndex + 1} of {contextualCheck ? 1 : quizzes.length}</p>
        {contextualCheck && <><p className="helper-note">About your question: {contextualCheck.originalText}</p><details><summary>Why this check?</summary><p>{contextualCheck.personalization.reason}</p></details></>}
        <h3>{item.prompt}</h3><div className="quiz-options">{item.options.map((option, index) => <button key={option} aria-label={option} aria-pressed={answer?.selectedIndex === index} onClick={() => answerQuiz(index)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div>
        {answer && <div className={`quiz-feedback ${answer.correctness ? 'correct' : 'retry'}`} role="status"><strong>{answer.correctness ? 'Nice thinking!' : 'Let’s try another way.'}</strong><p>{quizFeedback(item, answer.correctness)}</p><small>{attempts.length} saved attempt{attempts.length === 1 ? '' : 's'}. {answer.correctness ? 'You can continue your lesson.' : 'Look back at the explanation, then try again.'}</small></div>}
        {contextualCheck?.speechBase64 && <button onClick={() => companion.state.status === 'playing' ? companion.pause() : companion.speakGenerated(quizCaption(contextualCheck), contextualCheck.speechBase64!)}>{companion.state.status === 'playing' ? 'Pause question audio' : 'Hear this check'}</button>}
        {!contextualCheck && quizIndex + 1 < quizzes.length && <button onClick={() => openCheck(quizIndex + 1, true)}>Next question</button>}
        {contextualCheck ? <TutorSources reply={contextualCheck}/> : <details><summary>Question sources</summary><Sources lesson={lesson} refs={item.sourceRefs}/></details>}
      </section>}
      {checkPhase === 'prepared' && !item && <p>No prepared check is available for this concept. Your place is saved.</p>}
    </QuizModal>}
    <audio ref={companion.audio} {...companion.mediaEvents} preload="none" data-companion-audio aria-hidden="true"/>
    <audio ref={liveVoice.audio} data-live-companion-audio aria-label="Coteacher live voice"/>
    <div className="watch-heading"><span className="subject-label">{lesson.subject} · {lesson.classLevel}</span><span className="status-pill">{'mediaUrl' in lesson.recording!.audio ? 'Streaming' : 'On this device'}</span></div>
    <h1>{lesson.title}</h1><p className="teacher-credit">Your classroom teacher <span>•</span> {clock(lesson.recording!.durationMs)} <span>•</span> Your personal replay</p>
    <div className="lesson-voice-control"><button onClick={() => window.dispatchEvent(new CustomEvent('coteacher-explain-recording', { detail: { recordingId: lesson.recording!.id } }))}><Icon name="spark"/>Talk with Coteacher</button><span>Let’s work through a tricky part together.</span>
      <details><summary>Offline voice options</summary><p>On-device recognition is optional and browser-dependent. With it enabled, say “Coteacher, I don’t understand this.” Connected voice is available inside the companion.</p><button aria-pressed={voiceEnabled} onClick={toggleVoice}>{voiceEnabled ? 'Turn offline voice off' : 'Enable offline voice mode'}</button><p role="status">{micStatus}</p></details>
    </div>
    <RecordedLesson immersive lesson={lesson} recording={lesson.recording!} positionMs={position} companion={assistant} support={player.recording?.support} supportTimeMs={liveVoice.active ? liveVoice.state.timeMs : companion.visualTimeMs} onPosition={positionMs => {
      // Seeking is still available. Changing the native moment ends the old
      // conversation so answers/checks cannot be attributed to a different cue.
      if (panel && positionMs !== latest.current.player.recording?.positionMs) close();
      const current = latest.current, support = current.player.recording?.support;
      const moment = recordingCueAt(lesson.recording!, positionMs);
      commit({ ...current, player: { ...current.player, recording: { recordingId: lesson.recording!.id, positionMs, ...(support?.timelineStepId === moment.timelineStepId ? { support } : {}) } } });
    }} onPlayed={() => { if (panel) close(); }} onExplainMoment={(_, at) => openSession(at)} onCheckMoment={() => { openSession(latest.current.player.recording?.positionMs ?? 0); openCheck(); }}/>
  </div>;
}
