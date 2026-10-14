import fixture from '../../../fixtures/demo-lesson/lesson-package.json' with { type: 'json' };
import narration from '../../../fixtures/demo-lesson/narration.json' with { type: 'json' };
import type { LessonPackage } from './generated/lesson-package';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value);
}
function instruction(lesson: LessonPackage) {
  const { studentId, route, publication, classroomTimeline, recording, playback, visualAssets, ...content } = lesson;
  return { ...content, concepts: content.concepts.map(concept => ({ ...concept,
    variants: concept.variants.map(({ audioAssetPath, ...variant }) => variant),
  })) };
}
const expected = canonical(instruction(fixture as LessonPackage));

/** Bounded sprint allowlist, not a safety classifier or authenticated teacher signature. */
export function hasReviewedDemoInstruction(lesson: LessonPackage): boolean {
  if (canonical(instruction(lesson)) !== expected) return false;
  const clips = narration.clips as Record<string, string>;
  return lesson.concepts.every(concept => concept.variants.every(variant =>
    variant.audioAssetPath === undefined || variant.audioAssetPath === clips[variant.content]));
}
