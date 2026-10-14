import { describe, expect, it } from 'vitest';
import { approveLessons, demoLessons, requirePublishedLesson, validateLessonPackage, type LessonPackage, type TryItVariant } from '@coteacher/shared';
import fixture from '../fixtures/demo-lesson/lesson-package.json';

const activity = (lesson: LessonPackage) => lesson.concepts.flatMap(concept => concept.variants).find(variant => variant.type === 'tryit') as TryItVariant;
describe('reviewed sprint content at collection/publication boundaries', () => {
  it.each([
    ['unsafe materials', (lesson: LessonPackage) => { activity(lesson).items[0] = 'A sharp knife and a glass cup'; }],
    ['unsafe instructions', (lesson: LessonPackage) => { activity(lesson).steps[0] = 'Heat the water on a stove without an adult.'; }],
    ['removed safety guidance', (lesson: LessonPackage) => { activity(lesson).safetyNotes[0] = 'No supervision is needed.'; }],
    ['unreviewed explanation', (lesson: LessonPackage) => { lesson.concepts[0].variants[0].content = 'A newly invented instructional claim.'; }],
    ['invented source claim', (lesson: LessonPackage) => { lesson.sources[0].citation = 'A textbook page that was never supplied.'; }],
    ['altered quiz answer', (lesson: LessonPackage) => { lesson.quiz[0].correctIndex = (lesson.quiz[0].correctIndex + 1) % lesson.quiz[0].options.length; }],
    ['altered objective', (lesson: LessonPackage) => { lesson.objective.text = 'A different learning objective.'; }],
    ['unreviewed narration asset', (lesson: LessonPackage) => { lesson.concepts[0].variants[0].audioAssetPath = 'audio/unreviewed.mp3'; }],
  ])('rejects %s even with valid source IDs and an approval marker', (_name, edit) => {
    for (const original of [demoLessons()[0], approveLessons(demoLessons(), true)[0]]) {
      const changed = structuredClone(original); edit(changed);
      expect(validateLessonPackage(changed).valid).toBe(true); // structural checks alone cannot verify reviewed text
      expect(() => requirePublishedLesson(changed)).toThrow(/reviewed teaching materials/);
    }
  });
  it('keeps reviewed seed, optional prepared narration and both learner routes usable', () => {
    expect(requirePublishedLesson(fixture).lessonId).toBe('light-and-refraction');
    for (const original of [...demoLessons(), ...approveLessons(demoLessons(), true)]) {
      expect(requirePublishedLesson(original)).toBeDefined();
    }
  });
});
