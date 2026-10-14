export const lessonMotionLoopMs = 5000;
/** Smooth construction, computed solely from the existing media clock. */
export function buildProgress(phase: number, start: number, end: number) {
  const fraction = Math.max(0, Math.min(1, (phase - start) / (end - start)));
  return fraction * fraction * (3 - 2 * fraction);
}
export function explainerMotion(elapsedMs: number, reduced = false) {
  const { phase } = lessonMotion(elapsedMs);
  const constructionPhase = reduced ? .9 : phase;
  return {
    phase,
    progress: (start: number, end: number) => buildProgress(constructionPhase, start, end),
    // Hold the finished diagram, then fade out before reconstructing it.
    opacity: reduced ? 1 : 1 - buildProgress(phase, .96, 1),
  };
}
/** Cue-relative media time is the clock. Never increment a playback-only timer. */
export function lessonMotion(elapsedMs: number) {
  const time = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const phase = (time % lessonMotionLoopMs) / lessonMotionLoopMs;
  return { phase };
}
