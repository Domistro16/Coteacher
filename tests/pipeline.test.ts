import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { runValidationCli } from '../pipeline/src/validate-cli';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'coteacher-cli-'));
const malformedPath = join(temporaryDirectory, 'malformed.json');
const spacedPath = join(temporaryDirectory, 'simulated lesson.json');
writeFileSync(malformedPath, '{ "simulated": true,');
writeFileSync(spacedPath, readFileSync(join(repoRoot, 'fixtures/demo-lesson/lesson-package.json')));
afterAll(() => {
  // Delete only the two exact files created here, then remove the empty directory.
  unlinkSync(malformedPath);
  unlinkSync(spacedPath);
  rmdirSync(temporaryDirectory);
});

async function run(args: readonly string[], cwd = repoRoot) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runValidationCli(args, {
    stdout: message => stdout.push(message),
    stderr: message => stderr.push(message),
  }, cwd);
  return { code, stdout, stderr };
}

describe('local lesson validation CLI', () => {
  it.each(['fixtures/demo-lesson', 'fixtures/demo-lesson/lesson-package.json'])('validates %s through the shared contract', async path => {
    expect(await run(['--lesson', path])).toEqual({
      code: 0,
      stdout: ['Valid lesson: light-and-refraction (simulated: true)'],
      stderr: [],
    });
  });

  it('accepts an absolute filename containing spaces', async () => {
    expect((await run(['--lesson', spacedPath])).code).toBe(0);
  });

  it('resolves relative paths against the provided working directory', async () => {
    const cwd = join(repoRoot, 'fixtures/demo-lesson');
    expect((await run(['--lesson', 'lesson-package.json'], cwd)).code).toBe(0);
    expect((await run(['--lesson', '.'], cwd)).code).toBe(0);
  });

  it('prints help without reading a lesson file', async () => {
    const result = await run(['--help']);
    expect(result.code).toBe(0);
    expect(result.stdout).toEqual(['Usage: npm run pipeline -- --lesson <JSON file or lesson directory>']);
    expect(result.stderr).toEqual([]);
  });

  it.each([
    [], ['--lesson'], ['--lesson', ''], ['--lesson', '   '],
    ['--unknown', 'fixtures/demo-lesson'], ['--lesson', '--help'],
    ['--lesson', 'fixtures/demo-lesson', 'extra'], ['--help', 'extra'],
  ].map(args => ({ args })))('returns usage error for %j', async ({ args }) => {
    const result = await run(args);
    expect(result.code).toBe(2);
    expect(result.stdout).toEqual([]);
    expect(result.stderr).toEqual(['Usage: npm run pipeline -- --lesson <JSON file or lesson directory>']);
  });

  it.each(['does-not-exist.json', 'fixtures/invalid'])('reports unreadable package %s', async path => {
    const result = await run(['--lesson', path]);
    expect(result.code).toBe(2);
    expect(result.stdout).toEqual([]);
    expect(result.stderr).toHaveLength(1);
    expect(result.stderr[0]).toContain('Cannot read lesson file');
    if (path === 'fixtures/invalid') expect(result.stderr[0]).toContain('lesson-package.json');
  });

  it('distinguishes malformed JSON from schema errors', async () => {
    const result = await run(['--lesson', malformedPath]);
    expect(result).toEqual({ code: 2, stdout: [], stderr: ['Invalid JSON in lesson file ' + malformedPath] });
  });

  it.each([
    ['missing-source-refs', 'schema schema.required /concepts/0/variants/0/sourceRefs:'],
    ['nonexistent-source', 'integrity reference.source /questionBank/0/sourceRefs/0:'],
    ['tryit-without-safety-notes', 'schema schema.required /concepts/1/variants/4/safetyNotes:'],
    ['correct-index-out-of-range', 'integrity quiz.correct-index /quiz/0/correctIndex:'],
    ['real-looking-student-name', 'schema schema.pattern /studentId:'],
  ])('reports the right contract failure for %s', async (name, expected) => {
    const result = await run(['--lesson', 'fixtures/invalid/' + name + '.json']);
    expect(result.code).toBe(1);
    expect(result.stdout).toEqual([]);
    expect(result.stderr.some(message => message.startsWith(expected))).toBe(true);
  });

  it('rejects a progress file as a lesson package', async () => {
    const result = await run(['--lesson', 'fixtures/demo-lesson/progress-record.json']);
    expect(result.code).toBe(1);
    expect(result.stdout).toEqual([]);
    expect(result.stderr.some(message => message.startsWith('schema schema.required /objective:'))).toBe(true);
  });

  it('leaves the input package unchanged', async () => {
    const before = readFileSync(spacedPath, 'utf8');
    expect((await run(['--lesson', spacedPath])).code).toBe(0);
    expect(readFileSync(spacedPath, 'utf8')).toBe(before);
  });
});
