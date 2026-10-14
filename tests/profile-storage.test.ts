import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoLessons, emptyProgress } from '@coteacher/shared';
import { createPlayerModel, initialPlayerState } from '../apps/student/src/player';
import { saveStoredProfile, type Snapshot } from '../apps/student/src/storage';

const fixture = (): Snapshot => {
  const lesson = demoLessons()[0];
  return { lesson, progress: emptyProgress(lesson), player: initialPlayerState(createPlayerModel(lesson)) };
};
afterEach(() => vi.unstubAllGlobals());

describe('profile storage ownership before writes', () => {
  it.each([
    ['another learner row', (value: Snapshot) => value, 'student-b1c2d3e4'],
    ['foreign learner progress', (value: Snapshot) => { value.progress.studentId = 'student-b1c2d3e4'; return value; }],
    ['foreign lesson progress', (value: Snapshot) => { value.progress.lessonId = 'other-lesson'; return value; }],
    ['out-of-range position', (value: Snapshot) => { value.player.timelineIndex = 99; return value; }],
    ['another concept variant', (value: Snapshot) => { value.player.variantId = 'refraction-short'; return value; }],
    ['activity on an explanation', (value: Snapshot) => { value.player.activity = { phase: 'steps', instructionIndex: 0 }; return value; }],
    ['foreign audio position', (value: Snapshot) => { value.player.recording = { recordingId: 'other-recording', positionMs: 100 }; return value; }],
  ] as const)('rejects %s without touching IndexedDB', async (_name, mutate, id?: string) => {
    const open = vi.fn(() => { throw new Error('An invalid profile must never reach storage'); });
    vi.stubGlobal('indexedDB', { open });
    const value = mutate(fixture());
    await expect(saveStoredProfile(id ?? value.lesson.studentId, '111111', value)).rejects.toThrow(/invalid|does not belong/);
    expect(open).not.toHaveBeenCalled();
  });
});
