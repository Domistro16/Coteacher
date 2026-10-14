import { readFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { validateLessonPackage } from '@coteacher/shared';

export interface CliOutput {
  stdout(message: string): void;
  stderr(message: string): void;
}

const usage = 'Usage: npm run pipeline -- --lesson <JSON file or lesson directory>';

/** Validate a local package without generating or modifying files. */
export async function runValidationCli(
  args: readonly string[],
  output: CliOutput,
  cwd = process.cwd(),
): Promise<0 | 1 | 2> {
  if (args.length === 1 && args[0] === '--help') {
    output.stdout(usage);
    return 0;
  }
  if (args.length !== 2 || args[0] !== '--lesson' || !args[1].trim() || args[1].startsWith('--')) {
    output.stderr(usage);
    return 2;
  }

  let lessonPath = resolve(cwd, args[1]);
  let contents: string;
  try {
    if ((await stat(lessonPath)).isDirectory()) lessonPath = join(lessonPath, 'lesson-package.json');
    contents = await readFile(lessonPath, 'utf8');
  } catch (error) {
    output.stderr('Cannot read lesson file ' + lessonPath + ': ' + (error instanceof Error ? error.message : String(error)));
    return 2;
  }

  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    output.stderr('Invalid JSON in lesson file ' + lessonPath);
    return 2;
  }

  const result = validateLessonPackage(value);
  if (!result.valid) {
    for (const issue of result.issues) {
      output.stderr(issue.stage + ' ' + issue.code + ' ' + (issue.path || '/') + ': ' + issue.message);
    }
    return 1;
  }
  output.stdout('Valid lesson: ' + result.data.lessonId + ' (simulated: ' + result.data.simulated + ')');
  return 0;
}
