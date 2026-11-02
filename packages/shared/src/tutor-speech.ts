import type { TutorState, TutorReply } from './generated/tutor-state';

/** Response projection only. The durable school snapshot retains every clip. */
export function deferTutorSpeech(state: TutorState): TutorState {
  return { ...state, replies: state.replies.map(reply => ({ ...reply, speechBase64: null })) };
}

function answerIdentity(reply: TutorReply) {
  const { speechBase64: _speech, updatedAt: _time, ...content } = reply;
  return JSON.stringify(content);
}

/** Keep a downloaded clip only for the identical answer and teacher review state. */
export function restoreDeferredTutorSpeech(received: TutorState, local?: TutorState): TutorState {
  if (!local) return received;
  if (received.studentId !== local.studentId || received.lessonId !== local.lessonId || received.recordingId !== local.recordingId) {
    throw new Error('Deferred speech belongs to a different learner or lesson.');
  }
  return { ...received, replies: received.replies.map(reply => {
    if (reply.speechBase64 || reply.status !== 'answered' || reply.review === 'flagged') return reply;
    const previous = local.replies.find(saved => saved.questionId === reply.questionId);
    return previous?.speechBase64 && answerIdentity(previous) === answerIdentity(reply)
      ? { ...reply, speechBase64: previous.speechBase64 } : reply;
  }) };
}
