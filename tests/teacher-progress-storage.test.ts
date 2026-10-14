import { describe, expect, it } from 'vitest';
import { demoLessons, emptyProgress } from '@coteacher/shared';
import { readTeacherProgress, saveTeacherProgress } from '../apps/teacher/src/progress-storage';

describe('teacher received-record persistence', () => {
  it('restores both validated owners independently without storing PINs or plaintext questions', async () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    const lessons = demoLessons(), records = lessons.map(lesson => emptyProgress(lesson));
    records[0].events.push({ type: 'pause', timestamp: records[0].exportedAt, timelineStepId: 'step-refraction', conceptId: 'refraction' });
    await saveTeacherProgress(storage, records);
    expect(await readTeacherProgress(storage, async id => lessons.find(lesson => lesson.studentId === id)!)).toEqual(records);
    const saved = [...data.values()].join('');
    expect(saved).not.toContain('step-refraction'); expect(saved).not.toContain('student-a1b2c3d4');
    expect(saved).not.toContain('111111'); expect(saved).not.toContain('222222');
    await expect(saveTeacherProgress(storage, [records[0], records[0]])).rejects.toThrow('one snapshot');
    data.set([...data.keys()][0], '[{}]');
    await expect(readTeacherProgress(storage, async id => lessons.find(lesson => lesson.studentId === id)!)).rejects.toThrow('do not match');
    expect(data.get([...data.keys()][0])).toBe('[{}]'); // recovery never erases the encrypted input
  }, 10000);
  it('does not report success if browser storage refuses the received records', async () => {
    await expect(saveTeacherProgress({ setItem: () => { throw new Error('quota'); } }, [emptyProgress(demoLessons()[0])])).rejects.toThrow('could not be saved');
  });
});
