/** Ephemeral same-origin display messages; never stores audio, sources or learner data. */
export interface ProjectorFrame {
  lessonId: string; sessionId: string; stepId: string; conceptId: string;
  title: string; conceptTitle: string; teacherSaid: string;
  sourceRefs: readonly string[];
  visualNumber: number; visualCount: number;
  motion: PresentationMotion;
}
export interface PresentationMotion { stepId: string; elapsedMs: number; running: boolean }
export function isPresentationMotion(value: unknown): value is PresentationMotion {
  if (!value || typeof value !== 'object') return false;
  const clock = value as PresentationMotion;
  return typeof clock.stepId === 'string' && Number.isFinite(clock.elapsedMs) && clock.elapsedMs >= 0 && typeof clock.running === 'boolean';
}
export const projectorChannelName = (session: string) => `coteacher-projector-${session}`;
export function isProjectorFrame(value: unknown): value is ProjectorFrame {
  if (!value || typeof value !== 'object') return false;
  const frame = value as ProjectorFrame;
  return ['lessonId', 'sessionId', 'stepId', 'title', 'conceptTitle', 'teacherSaid'].every(key =>
    typeof frame[key as keyof ProjectorFrame] === 'string' && String(frame[key as keyof ProjectorFrame]).length <= 4000)
    && ['light-path', 'refraction'].includes(frame.conceptId)
    && Array.isArray(frame.sourceRefs) && frame.sourceRefs.length > 0
    && frame.sourceRefs.every(ref => typeof ref === 'string' && ref.length > 0 && ref.length <= 120)
    && isPresentationMotion(frame.motion) && frame.motion.stepId === frame.stepId
    && Number.isInteger(frame.visualNumber) && Number.isInteger(frame.visualCount)
    && frame.visualNumber > 0 && frame.visualNumber <= frame.visualCount;
}
