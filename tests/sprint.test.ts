import { describe, expect, it } from 'vitest';
import { decryptPayload, demoLessons, emptyProgress, encryptPayload, localLessonGenerator, matchQuestion, mergeReturnedAnswers, queuedDemoQuestion, reviewedMaterials, seededRecords, simulatedAnswerProvider, upsertSnapshot, validateEncryptedTransfer, validateLessonPackage, validateProgressRecord, chooseQuiz } from '@coteacher/shared';
import { runGenerationCli } from '../pipeline/src/generate-cli';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('bounded generation and simulated data', () => {
  it('generates different routes to an identical sourced objective', () => {
    const [a,b] = demoLessons();
    expect(a.objective).toEqual(b.objective);
    expect(a.route).not.toEqual(b.route);
    for (const lesson of [a,b]) expect(validateLessonPackage(lesson).valid).toBe(true);
    expect(localLessonGenerator.generate(reviewedMaterials.teacherNotes.replace(/\r\n/g,'\n'), reviewedMaterials.activityNotes)).toHaveLength(2);
    expect(() => localLessonGenerator.generate('unreviewed topic', reviewedMaterials.activityNotes)).toThrow('supports only');
  });
  it('all seeded records are simulated and pass their corresponding lesson context', () => {
    for (const record of seededRecords()) {
      const lesson = { ...demoLessons()[0], studentId: record.studentId };
      expect(record.simulated).toBe(true);
      expect(validateProgressRecord(record, lesson).valid).toBe(true);
    }
  });
  it('generates encrypted files through the CLI only with explicit review acknowledgement', async () => {
    const directory = await mkdtemp(join(tmpdir(),'coteacher-generation-'));
    const output = { stdout: () => {}, stderr: () => {} };
    const args = ['--generate','--notes','fixtures/demo-lesson/teacher-notes.md','--activity','fixtures/demo-lesson/activity-notes.md','--out',directory,'--approve-reviewed'];
    try {
      expect(await runGenerationCli(args.slice(0,-1),output)).toBe(2);
      expect(await runGenerationCli(args,output)).toBe(0);
      const encrypted = JSON.parse(await readFile(join(directory,'lesson-student-a1b2c3d4.json'),'utf8'));
      const lesson = await decryptPayload(encrypted,'111111');
      const result = validateLessonPackage(lesson);
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.data.publication).toMatchObject({ status: 'approved', approvalKind: 'teacher-review' });
      expect(await runGenerationCli(args,output)).toBe(1);
    } finally { await rm(directory,{recursive:true,force:true}); }
  });
});

describe('conservative question matching', () => {
  const queries: [string, boolean][] = [
    ['Why does the pencil look bent in water?', true],
    ['Why does the pencil look broken?', true],
    ['What makes the underwater part look shifted?', true],
    ['Is the light path straight in one medium?', true],
    ['Does light travel straight before reaching the water surface?', true],
    ['Why pencil looks bent water', true],
    ['How does a rainbow form?', false],
    ['Why does a pencil burn?', false],
    ['Why does the pencil look bent in a mirror?', false],
    ['Does sound travel straight in water?', false],
    ['Why is my pencil broken after falling?', false],
    ['Why does the pencil look bent in boiling water?', false],
    ['Why does the pencil look bent in magical water?', false],
    ['Does light travel straight before reaching the sound water surface?', false],
    [queuedDemoQuestion, false],
    ['water', false], ['hello', false],
  ];
  for (const [text, matched] of queries) it(`${matched ? 'matches' : 'rejects'}: ${text}`, () => {
    const lesson = demoLessons()[0]; const result = matchQuestion(text,'step-refraction',lesson);
    expect('match' in result).toBe(matched);
    if ('match' in result) expect(result.score).toBeGreaterThan(lesson.matcher.confidenceThreshold);
    else expect(result.score).toBeLessThanOrEqual(lesson.matcher.confidenceThreshold);
  });
  it('reports the near-miss false positive rate', () => {
    const negatives = queries.filter(([,matched]) => !matched);
    const falsePositives = negatives.filter(([text]) => 'match' in matchQuestion(text,'step-refraction',demoLessons()[0])).length;
    console.info(`Matcher negative-query specificity: ${(1-falsePositives/negatives.length)*100}%; false positives ${falsePositives}/${negatives.length}.`);
    expect(falsePositives).toBe(0);
  });
});

describe('encrypted transfer and progress return', () => {
  it('uses fresh randomness; detects wrong PINs, tampering, and invalid envelopes', async () => {
    const lesson = demoLessons()[0];
    const one = await encryptPayload(lesson,'111111'); const two = await encryptPayload(lesson,'111111');
    expect(one).not.toEqual(two); expect(validateEncryptedTransfer(one)).toBe(true);
    expect(await decryptPayload(one,'111111')).toEqual(lesson);
    await expect(decryptPayload(one,'222222')).rejects.toThrow('Cannot unlock');
    await expect(decryptPayload({...one,iv:two.iv},'111111')).rejects.toThrow('Cannot unlock');
    await expect(decryptPayload({...one,iterations:1},'111111')).rejects.toThrow('invalid');
    await expect(encryptPayload(lesson,'123')).rejects.toThrow('six-digit');
  });
  it('prioritizes paused concepts and covers the objective with no pause', () => {
    const lesson = demoLessons()[0]; const progress = emptyProgress(lesson);
    expect(chooseQuiz(lesson,progress)).toHaveLength(2);
    progress.events.push({type:'pause',timestamp:progress.exportedAt,conceptId:'refraction',timelineStepId:'step-refraction'});
    expect(chooseQuiz(lesson,progress).map(q => q.id)).toEqual(['quiz-bent']);
  });
  it('returns only the supported sourced answer without replacing newer local events', () => {
    const lesson = demoLessons()[0]; const progress = emptyProgress(lesson);
    progress.queuedQuestions = [{id:'q1',text:queuedDemoQuestion,askedAt:progress.exportedAt,timelineStepId:'step-refraction',answered:false},
      {id:'q2',text:'How does a rainbow form?',askedAt:progress.exportedAt,timelineStepId:'step-refraction',answered:false}];
    const returned = {...progress,queuedQuestions:progress.queuedQuestions.map(q => simulatedAnswerProvider.answer(q))};
    progress.events.push({type:'pause',timestamp:progress.exportedAt,conceptId:'light-path',timelineStepId:'step-light'});
    const merged = mergeReturnedAnswers(progress,returned,lesson);
    expect(merged.events).toEqual(progress.events); expect(merged.queuedQuestions[0].answered).toBe(true);
    expect(merged.queuedQuestions[1].answered).toBe(false);
    expect(validateProgressRecord(merged,lesson).valid).toBe(true);
    expect(() => mergeReturnedAnswers(progress,{...returned,studentId:demoLessons()[1].studentId},lesson)).toThrow('profile');
    expect(mergeReturnedAnswers(merged,returned,lesson)).toEqual(merged);
  });
  it('snapshot import rejects repeats and older records, replaces newer ones', () => {
    const record = emptyProgress(demoLessons()[0]); const records = upsertSnapshot([],record);
    expect(() => upsertSnapshot(records,record)).toThrow('already imported');
    const next = {...record,exportedAt:'2099-01-01T00:00:00.000Z'};
    expect(upsertSnapshot(records,next)).toEqual([next]);
    expect(() => upsertSnapshot([next],record)).toThrow('older');
    expect(() => upsertSnapshot([{...record,exportedAt:'2026-01-01T10:00:00Z'}],{...record,exportedAt:'2026-01-01T11:00:00+01:00'})).toThrow('already imported');
  });
});
