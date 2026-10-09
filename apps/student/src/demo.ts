import { validateLessonPackage } from '@coteacher/shared';
import fixture from '../../../fixtures/demo-lesson/lesson-package.json';
import { createPlayerModel, type PlayerModel } from './player';

export type DemoLoadResult = { valid: true; model: PlayerModel } | { valid: false };
export function loadDemoLesson(value: unknown): DemoLoadResult {
  const result = validateLessonPackage(value);
  if (!result.valid || !result.data.simulated) return { valid: false };
  try { return { valid: true, model: createPlayerModel(result.data) }; }
  catch { return { valid: false }; }
}
// Static import and one validation at module initialization; nothing is fetched.
export const demo = loadDemoLesson(fixture);
