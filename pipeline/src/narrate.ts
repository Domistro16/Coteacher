import { createHash } from 'node:crypto';
import { mkdir, writeFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { preparedNarrationTexts } from '../../packages/shared/src/narration-content';
import { demoLessons, simulatedAnswerProvider, queuedDemoQuestion, validateLessonPackage } from '@coteacher/shared';

// Generation is optional tooling. Builds/playback use checked-in clips on any OS.
if (process.platform !== 'win32') throw new Error('Clip regeneration needs local Windows SAPI and FFmpeg. Existing clips work on other systems.');
const audioDir = resolve('apps/student/public/audio');
const manifestPath = resolve('fixtures/demo-lesson/narration.json');
await mkdir(audioDir, { recursive: true });
const temporaryRoot = resolve('pipeline');
const temporary = await mkdtemp(join(temporaryRoot, '.narration-'));
const captions = new Set<string>();
for (const lesson of demoLessons()) {
  if (!validateLessonPackage(lesson).valid) throw new Error('Narration needs a validated lesson.');
  preparedNarrationTexts(lesson).forEach(text => captions.add(text));
}
const returned = simulatedAnswerProvider.answer({ id: 'audio-demo', text: queuedDemoQuestion, askedAt: '2026-10-09T00:00:00Z', timelineStepId: 'step-refraction', answered: false });
if (returned.answered) captions.add(returned.answer);
const clips: Record<string, string> = {};
const jobs = [...captions].map(text => {
  const name = createHash('sha256').update(text).digest('hex').slice(0, 20);
  clips[text] = `audio/${name}.mp3`;
  return { text, wav: join(temporary, `${name}.wav`), mp3: join(audioDir, `${name}.mp3`) };
});
try {
  const jobsPath = join(temporary, 'jobs.json');
  await writeFile(jobsPath, JSON.stringify(jobs));
  // Paths travel in arguments; text travels only in JSON, never shell code.
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', '& ([scriptblock]::Create((Get-Content -LiteralPath $env:COTEACHER_NARRATION_SCRIPT -Raw -Encoding UTF8))) -JobsPath $env:COTEACHER_NARRATION_JOBS'], {
    encoding: 'utf8', windowsHide: true,
    env: { ...process.env, COTEACHER_NARRATION_SCRIPT: resolve('pipeline/src/narrate.ps1'), COTEACHER_NARRATION_JOBS: jobsPath },
  });
  if (result.status !== 0) throw new Error(result.stderr || 'Local voice generation failed.');
  for (const job of jobs) {
    const encoding = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', job.wav, '-ac', '1', '-ar', '24000', '-codec:a', 'libmp3lame', '-b:a', '32k', job.mp3], { encoding: 'utf8', windowsHide: true });
    if (encoding.status !== 0) throw new Error(encoding.stderr || 'Audio compression failed.');
    if ((await stat(job.mp3)).size < 100) throw new Error('An audio clip is empty.');
  }
  await writeFile(manifestPath, JSON.stringify({ simulated: true, voice: 'Microsoft Zira Desktop (generic system narrator, no teacher imitation)', format: 'mono MP3, 24 kHz, 32 kbps', clips }, null, 2) + '\n');
  const bytes = (await Promise.all(jobs.map(async job => (await stat(job.mp3)).size))).reduce((sum, size) => sum + size, 0);
  console.log(`${jobs.length} local narration clips generated; ${(bytes / 1024).toFixed(0)} KiB total. ${result.stdout.trim()}`);
} finally {
  // Only remove this generator's verified workspace temporary directory.
  const target = resolve(temporary);
  if (!target.startsWith(temporaryRoot + '\\') || !target.includes('.narration-')) throw new Error('Unexpected temporary path.');
  await rm(target, { recursive: true, force: true });
}
