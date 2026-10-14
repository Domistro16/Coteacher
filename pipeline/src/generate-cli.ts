import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { approveLessons, requirePublishedLesson, encryptPayload, localLessonGenerator, profiles } from '@coteacher/shared';
import type { CliOutput } from './validate-cli';

const usage = 'Usage: npm run pipeline -- --generate --notes <file> --activity <file> --out <directory> --approve-reviewed';
export async function runGenerationCli(args: readonly string[], output: CliOutput, cwd = process.cwd()): Promise<0 | 1 | 2> {
  if (args.length !== 8 || args[0] !== '--generate' || args[1] !== '--notes' || args[3] !== '--activity' || args[5] !== '--out' || args[7] !== '--approve-reviewed' || [args[2], args[4], args[6]].some(a => !a.trim() || a.startsWith('--'))) {
    output.stderr(usage); return 2;
  }
  try {
    const notes = await readFile(resolve(cwd, args[2]), 'utf8');
    const activity = await readFile(resolve(cwd, args[4]), 'utf8');
    const lessons = approveLessons(localLessonGenerator.generate(notes, activity), true);
    const directory = resolve(cwd, args[6]);
    await mkdir(directory, { recursive: true });
    for (const lesson of lessons) {
      const profile = profiles.find(p => p.id === lesson.studentId)!;
      // Exclusive creation prevents accidental replacement of a collected package.
      await writeFile(join(directory, 'lesson-' + lesson.studentId + '.json'), JSON.stringify(await encryptPayload(requirePublishedLesson(lesson), profile.pin), null, 2), { flag: 'wx' });
    }
    output.stdout('Generated two encrypted simulated packages from reviewed sources. Demo PINs: A 111111, B 222222.');
    return 0;
  } catch (e) { output.stderr(e instanceof Error ? e.message : String(e)); return 1; }
}
