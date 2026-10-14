import type { LessonPackage, LessonRecording, VisualAsset, VisualLayer } from './generated/lesson-package';
import { profiles } from './learner-profiles';

export const visualCatalogVersion = 'refraction-visuals-v1' as const;
const layer = (kind: VisualLayer['kind'], values: Partial<VisualLayer>): VisualLayer => ({
  kind, x: 0, y: 0, w: 0, h: 0, d: '', text: '', fill: 'none', stroke: 'none', emphasis: false, ...values,
});
const text = (x: number, y: number, value: string) => layer('text', { x, y, text: value, fill: '#edf6fa' });
const ray = (d: string, color = '#ffce69') => layer('path', { d, stroke: color, emphasis: true });
const asset = (id: string, conceptId: string, title: string, layers: VisualLayer[]): VisualAsset =>
  ({ id, conceptId, title, sourceRefs: ['notes-light'], layers: layers as VisualAsset['layers'] });

/** Hand-prepared, source-linked diagrams. No AI, inferred transcript or numerical angles. */
export function visualCatalog(): VisualAsset[] {
  return [
    asset('light-path-diagram', 'light-path', 'Follow a straight ray through one material', [
      text(30, 45, 'Light travels in a straight path in one uniform material.'),
      layer('circle', { x: 65, y: 165, w: 24, fill: '#ffce69' }),
      ray('M 100 165 L 565 165 M 540 145 L 565 165 L 540 185'),
      text(65, 235, 'Light source'), text(320, 235, 'Ray: direction of travel'),
      text(45, 310, 'The moving highlight follows the ray; it is not light to scale.'),
    ]),
    asset('light-path-steps', 'light-path', 'Read the ray diagram in ordered steps', [
      text(30, 48, '1. Stay within one uniform material.'),
      text(30, 95, '2. Draw one straight path for the light.'),
      ray('M 60 170 L 550 170 M 525 150 L 550 170 L 525 190', '#76d8df'),
      text(30, 255, '3. The arrow shows the direction in which light travels.'),
      text(30, 310, 'A ray represents the path. It is a diagram, not a physical arrow.'),
    ]),
    asset('refraction-pencil', 'refraction', 'Compare the straight pencil and its apparent position', [
      layer('rect', { x: 40, y: 145, w: 560, h: 185, fill: '#183e56' }),
      text(45, 115, 'Air'), text(45, 190, 'Water'),
      layer('path', { d: 'M 40 145 L 600 145', stroke: '#76d8df' }),
      layer('path', { d: 'M 145 65 L 290 280', stroke: '#b8bec9' }),
      ray('M 145 65 L 199 145 L 340 280'),
      text(300, 80, 'Grey: the pencil stays straight.'),
      text(300, 118, 'Gold: its apparent position.'),
      text(45, 315, 'Changing direction at the air–water boundary changes what we see.'),
    ]),
    asset('refraction-steps', 'refraction', 'Follow the ray across the boundary step by step', [
      layer('rect', { x: 320, y: 145, w: 290, h: 175, fill: '#183e56' }),
      layer('path', { d: 'M 320 145 L 610 145', stroke: '#76d8df' }),
      ray('M 350 60 L 465 145 L 505 280 M 485 265 L 505 280 L 516 257', '#76d8df'),
      text(25, 65, '1. Light approaches at an angle.'), text(25, 122, '2. At the boundary, its speed changes.'),
      text(25, 200, '3. Its direction changes too.'), text(335, 130, 'Air'), text(340, 295, 'Water'),
      text(25, 345, 'This explains the apparent bend. The pencil itself has not bent.'),
    ]),
  ];
}

type Decision = NonNullable<NonNullable<LessonPackage['playback']>['decision']>;
export interface ReplayInput { difficulty?: Decision['difficulty']; preference?: Decision['preference'] }

/** Supplied history/preferences are sprint fixtures, never inferred learner types. */
export function personalizedReplay(lesson: LessonPackage, recording: LessonRecording, input?: ReplayInput): LessonPackage {
  return buildReplay(lesson, recording, input);
}
function buildReplay(lesson: LessonPackage, recording: LessonRecording, input?: ReplayInput, legacy = false): LessonPackage {
  const profile = profiles.find(entry => entry.id === lesson.studentId);
  if (legacy && !profile) throw new Error('This legacy simulated visual rule supports the two demo learners only.');
  const difficulty = input ? input.difficulty ?? 'insufficient-history' : profile?.recentDifficulty
    ? profile.replaySupport === 'concrete-diagrams' ? 'boundary-position' : 'boundary-steps' : 'insufficient-history';
  const representation = input?.preference ?? (difficulty === 'boundary-steps' ? 'ordered-annotations' : 'concrete-diagrams');
  const decision: Decision = { difficulty, ...(input?.preference ? { preference: input.preference } : {}), representation,
    basis: input?.preference ? 'learner-preference' : difficulty === 'insufficient-history' ? 'default' : 'simulated-history' };
  const diagram = legacy ? profile!.replaySupport === 'concrete-diagrams' : representation === 'concrete-diagrams';
  const catalog = visualCatalog();
  const sequence = recording.cues.map((cue, cueIndex) => {
    const visualAssetId = cue.conceptId === 'light-path'
      ? diagram ? 'light-path-diagram' : 'light-path-steps'
      : cue.conceptId === 'refraction' ? diagram ? 'refraction-pencil' : 'refraction-steps' : '';
    if (!visualAssetId) throw new Error('No reviewed visual is available for this recorded concept.');
    return { ...cue, cueIndex, visualAssetId };
  });
  const used = new Set(sequence.map(cue => cue.visualAssetId));
  const reason = legacy ? diagram ? 'Simulated profile A: diagram and concrete-observation support after difficulty at the boundary.'
    : 'Simulated profile B: ordered ray annotations after difficulty following the boundary steps.'
    : decision.basis === 'default' ? 'History is insufficient: use the prepared concrete-diagram default. All approved help visuals remain available.'
      : decision.basis === 'learner-preference' ? `Supplied simulated preference: ${representation}. The original voice, objective and timing stay the same.`
        : diagram ? 'Simulated history: interpreting apparent pencil position was difficult; use concrete diagrams.'
          : 'Simulated history: following the boundary steps was difficult; use ordered ray annotations.';
  return { ...lesson, recording, visualAssets: (legacy ? catalog.filter(entry => used.has(entry.id)) : catalog) as LessonPackage['visualAssets'], playback: {
    recordingId: recording.id, studentId: lesson.studentId, simulated: true, method: legacy ? 'demo-history-rules-v1' : 'prepared-support-rules-v2',
    catalogVersion: visualCatalogVersion,
    reason, ...(!legacy ? { decision } : {}),
    sequence: sequence as NonNullable<LessonPackage['playback']>['sequence'],
  } };
}

export function checkPersonalizedReplay(lesson: LessonPackage): boolean {
  if (!lesson.playback && !lesson.visualAssets) return true;
  if (!lesson.recording || !lesson.playback || !lesson.visualAssets) return false;
  if ((lesson.playback.method === 'prepared-support-rules-v2' && !lesson.playback.decision)
    || (lesson.playback.method === 'demo-history-rules-v1' && lesson.playback.decision)) return false;
  try {
    const expected = buildReplay(lesson, lesson.recording, lesson.playback.decision, lesson.playback.method === 'demo-history-rules-v1');
    return JSON.stringify(expected.playback) === JSON.stringify(lesson.playback)
      && JSON.stringify(expected.visualAssets) === JSON.stringify(lesson.visualAssets);
  } catch { return false; }
}

export function approvePersonalizedVisuals(recording: LessonRecording, acknowledged: boolean, reviewedAt = new Date().toISOString()): LessonRecording {
  if (!acknowledged || recording.review.status !== 'approved') throw new Error('Replay the recording and review both visual sequences before approving personalized playback.');
  return { ...recording, visualReview: { status: 'approved', reviewedAt, catalogVersion: visualCatalogVersion },
    audio: { ...recording.audio, mediaKey: recording.audio.mediaKey ?? btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))) } };
}
