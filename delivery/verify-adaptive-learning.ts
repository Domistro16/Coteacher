import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect, type Page } from '@playwright/test';
import { preview, type PreviewServer } from 'vite';
import { decryptPayload, encryptPayload, type ProgressRecord } from '@coteacher/shared';
import type { Snapshot } from '../apps/student/src/storage';
import { startDelivery } from './server';
import { OpenAITutor } from './tutor-provider';
import { teacherSources } from '../tests/e2e/teacher-navigation';

/** Explicit billable real-provider acceptance. All learner events come through UI.
 * Native teacher capture uses Chromium's synthetic microphone, not a human. */
for (const file of ['.env.local', '.env']) if (existsSync(file)) process.loadEnvFile(file);
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured. No real-provider request made.');
await mkdir(resolve('.task-tmp'), { recursive: true });
await mkdir(resolve('docs/screenshots'), { recursive: true });
const folder = await mkdtemp(resolve('.task-tmp/adaptive-learning-'));
const proof: any = { result: 'UNVERIFIED', startedAt: new Date().toISOString(), fictionalProfiles: true,
  learnerEvents: 'Actual automated interactions through the student UI; no storage injection',
  teacherMicrophone: 'Chromium simulated input through native capture/encoding', api: [], requirements: {} };
const request: typeof fetch = async (input, init) => {
  const response = await fetch(input, init), path = new URL(String(input)).pathname;
  proof.api.push({ path, status: response.status, requestId: response.headers.get('x-request-id') });
  console.log(JSON.stringify({ stage: 'real-provider', path, status: response.status })); return response;
};
let server = await startDelivery(folder, 0, 'local-demo-publisher', new OpenAITutor(process.env.OPENAI_API_KEY, request));
const address = server.address(); if (!address || typeof address === 'string') throw new Error('Test school service did not start');
const schoolPort = address.port;
process.env.COTEACHER_DELIVERY_URL = `http://127.0.0.1:${schoolPort}`;
const apps: PreviewServer[] = [];
for (const [app, port] of [['student', 4413], ['teacher', 4414]] as const) apps.push(await preview({ root: resolve('apps', app), configFile: resolve('apps', app, 'vite.config.ts'), preview: { host: '127.0.0.1', port, strictPort: true, open: false } }));
const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const teacherContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['microphone'] });
const studentContext = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'allow', reducedMotion: 'reduce' });
const teacher = await teacherContext.newPage(); let student = await studentContext.newPage();
teacher.setDefaultTimeout(30000); student.setDefaultTimeout(30000);
const timer = setTimeout(() => { console.error('FAIL: adaptive acceptance exceeded ten minutes'); void browser.close(); }, 600000);
const stage = (value: string) => { proof.stage = value; console.log(JSON.stringify({ stage: value })); };
async function saved(id = 'student-a1b2c3d4', pin = '111111'): Promise<Snapshot> {
  const envelope = await student.evaluate(id => new Promise<unknown>((resolve, reject) => {
    const open = indexedDB.open('coteacher-sprint'); open.onsuccess = () => {
      const db = open.result, get = db.transaction('profiles').objectStore('profiles').get(id);
      get.onsuccess = () => { db.close(); resolve(get.result); }; get.onerror = () => reject(get.error);
    };
  }), id); return await decryptPayload(envelope, pin) as Snapshot;
}
async function unlock(id = 'student-a1b2c3d4', pin = '111111') {
  await student.getByLabel('Your profile', { exact: true }).selectOption(id);
  await student.getByLabel('Six-digit PIN').fill(pin); await student.getByRole('button', { name: 'Unlock my profile' }).click();
  await student.getByRole('button', { name: /Watch Now|Continue Watching|Watch Offline/, exact: true }).first().click();
  await expect(student.locator('.immersive-player')).toBeVisible();
  await expect(student.getByText('Saved on this device', { exact: true }).first()).toBeVisible();
  await student.locator('.chapters [data-concept-id="refraction"]').click();
  await expect(student.locator('.recorded-lesson')).toHaveAttribute('data-recorded-concept-id', 'refraction');
}
const dock = () => student.getByRole('region', { name: 'Coteacher lesson companion', exact: true });
async function help() {
  await student.getByRole('button', { name: 'Talk with Coteacher', exact: true }).click();
  await expect(dock()).toBeVisible();
}
async function composer() {
  const input = dock().getByLabel('Which part of this recorded concept is unclear?', { exact: true });
  if (!await input.isVisible()) {
    const menu = dock().getByRole('button', { name: 'Ask or explore this concept', exact: true });
    if (await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
    const type = dock().getByRole('button', { name: 'Type instead', exact: true });
    if (await type.isVisible()) await type.click();
  }
  await expect(input).toBeVisible(); return input;
}
async function ask(text: string) { await (await composer()).fill(text); await dock().getByRole('button', { name: 'Ask Coteacher', exact: true }).click(); }
async function closeHelp() { await dock().getByRole('button', { name: 'Close learning panel', exact: true }).click(); }
async function alternatives() { const detail = dock().locator('.companion-more'); if (!await detail.evaluate(node => (node as HTMLDetailsElement).open)) await detail.locator('summary').first().click(); return detail; }
async function quiz(correct: boolean) {
  await student.getByRole('button', { name: 'Check this concept', exact: true }).click();
  const item = (await saved(studentId, studentPin)).lesson.quiz.find(item => item.conceptId === 'refraction')!;
  const selected = correct ? item.correctIndex : (item.correctIndex + 1) % item.options.length;
  await student.getByRole('button', { name: item.options[selected], exact: true }).click();
  await expect(student.locator('.companion-learning-task .quiz-feedback')).toContainText(correct ? 'Nice thinking!' : 'Let’s try another way.');
  await closeHelp();
}
async function receiveTeacher() {
  await teacher.getByRole('button', { name: 'Class insights', exact: true }).click();
  await teacher.getByRole('button', { name: 'Refresh school records', exact: true }).click();
  await expect(teacher.getByText('School connection checked · received learning records saved.', { exact: true })).toBeVisible({ timeout: 60000 });
  await teacher.getByLabel('Learning records').selectOption('received');
}
let studentId = 'student-a1b2c3d4', studentPin = '111111';
try {
  stage('native-teacher-prepare-record-review-publish');
  await teacher.goto('http://127.0.0.1:4414'); await teacherSources(teacher);
  await teacher.getByRole('button', { name: 'Use reviewed demo materials' }).click();
  await teacher.getByRole('button', { name: 'Generate simulated lesson' }).click(); await teacher.getByRole('checkbox').check();
  await teacher.getByRole('button', { name: 'Approve lesson', exact: true }).click();
  await teacher.getByRole('button', { name: 'Teach / projector', exact: true }).click();
  await teacher.getByRole('button', { name: 'Start presentation', exact: true }).click();
  await teacher.getByLabel('Record my explanation only.', { exact: false }).check();
  await teacher.getByRole('button', { name: 'Start audio recording' }).click();
  await expect(teacher.getByText('Recording teacher microphone', { exact: false })).toBeVisible();
  await teacher.waitForTimeout(1200); await teacher.getByRole('button', { name: 'Next visual' }).click(); await teacher.waitForTimeout(1800);
  await teacher.getByRole('button', { name: 'Stop and save recording', exact: true }).click();
  await expect(teacher.getByText('Recording saved · review before publishing', { exact: true })).toBeVisible();
  const review = teacher.locator('.recording-review > .recorded-lesson audio');
  await review.evaluate((audio: HTMLAudioElement) => audio.play()); await expect.poll(() => review.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(.1);
  await review.evaluate((audio: HTMLAudioElement) => audio.pause());
  await teacher.getByLabel('I reviewed the audio and visual timing', { exact: false }).check();
  await teacher.getByRole('button', { name: 'Approve recording for learners' }).click();
  await teacher.getByLabel('I reviewed both personalized visual sequences', { exact: false }).check();
  await teacher.getByRole('button', { name: 'Approve personalized playback' }).click();
  await teacher.getByRole('button', { name: 'Publish packages', exact: true }).click(); await teacher.getByRole('button', { name: 'Publish recorded lesson', exact: true }).click();
  await expect(teacher.getByText('Recorded lesson published to the local lesson service for both learners. They can stream it or download it for offline use.')).toBeVisible();

  stage('learner-a-incorrect-checks-and-prepared-question');
  await student.goto('http://127.0.0.1:4413'); await unlock(); await quiz(false); await quiz(false);
  await help(); await ask('Why does the pencil look broken?');
  await expect.poll(async () => (await saved()).progress.events.filter(e => e.type === 'question-matched').length).toBe(1);
  const aMemory = (await saved()).tutor!.memory, aRecommendation = aMemory.recommendations.find(r => r.conceptId === 'refraction')!;
  expect(aRecommendation.visualAssetId).toBe('refraction-pencil'); expect(aRecommendation.evidenceEventIds).toHaveLength(2);
  const optionsA = await alternatives(); await expect(optionsA.locator('[data-recommended-visual-id="refraction-pencil"]')).toBeVisible();
  await optionsA.getByRole('button', { name: 'Prepared explanation', exact: true }).click();
  await expect(student.locator('.recorded-help')).toHaveAttribute('data-support-asset-id', 'refraction-pencil');
  await composer(); await student.getByLabel('Use connected AI answers', { exact: true }).check();
  await closeHelp(); await student.getByRole('button', { name: 'Download for offline use', exact: true }).click();
  await expect(student.getByText('Ready offline', { exact: true }).first()).toBeVisible();
  await expect.poll(async () => { const latest = await saved(); return Boolean(latest.sync && latest.progress.events.every(event => latest.sync!.eventIds.includes(event.eventId!))); }, { timeout: 60000 }).toBe(true);
  await student.getByRole('button', { name: 'Lock / switch learner', exact: true }).click();

  stage('learner-b-correct-check-and-explicit-stepwise-choice');
  studentId = 'student-b1c2d3e4'; studentPin = '222222'; await unlock(studentId, studentPin); await quiz(true);
  await help(); await ask('Why does the pencil look broken?');
  await expect.poll(async () => (await saved(studentId, studentPin)).progress.events.filter(e => e.type === 'question-matched').length).toBe(1);
  const optionsB = await alternatives(), bBefore = await saved(studentId, studentPin);
  const title = bBefore.lesson.visualAssets!.find(v => v.id === 'refraction-steps')!.title;
  await optionsB.getByRole('button', { name: title, exact: true }).click();
  await expect.poll(async () => (await saved(studentId, studentPin)).tutor?.memory.recommendations[0]?.visualAssetId).toBe('refraction-steps');
  await optionsB.getByRole('button', { name: 'Prepared explanation', exact: true }).click();
  await expect(student.locator('.recorded-help')).toHaveAttribute('data-support-asset-id', 'refraction-steps');
  let bSaved = await saved(studentId, studentPin); const aSaved = await saved();
  expect(bSaved.tutor!.enabled).toBe(false); expect(bSaved.lesson.objective).toEqual(aSaved.lesson.objective);
  expect(bSaved.lesson.recording!.id).toBe(aSaved.lesson.recording!.id);
  const aIds = new Set(aSaved.progress.events.map(e => e.eventId));
  expect(bSaved.progress.events.every(e => !aIds.has(e.eventId))).toBe(true);
  expect(aSaved.progress.events.filter(e => e.type === 'quiz-answered')).toHaveLength(2);
  expect(bSaved.progress.events.filter(e => e.type === 'quiz-answered')).toHaveLength(1);
  proof.requirements[1] = proof.requirements[2] = proof.requirements[3] = 'PASS';
  proof.recommendations = { a: aSaved.tutor!.memory.recommendations, b: bSaved.tutor!.memory.recommendations };
  await closeHelp(); await student.getByRole('button', { name: 'Download for offline use', exact: true }).click();
  await expect(student.getByText('Ready offline', { exact: true }).first()).toBeVisible();
  await expect.poll(async () => { const latest = await saved(studentId, studentPin); return Boolean(latest.sync && latest.progress.events.every(event => latest.sync!.eventIds.includes(event.eventId!))); }, { timeout: 60000 }).toBe(true);
  bSaved = await saved(studentId, studentPin);
  await receiveTeacher(); await expect(teacher.locator('[data-stat="received"] strong')).toHaveText('2');
  await student.getByRole('button', { name: 'Lock / switch learner', exact: true }).click();

  stage('offline-closed-page-reopen-play-and-queue');
  studentId = 'student-a1b2c3d4'; studentPin = '111111'; await unlock();
  await studentContext.setOffline(true); await student.evaluate(() => window.dispatchEvent(new Event('offline')));
  await student.close(); student = await studentContext.newPage(); student.setDefaultTimeout(30000);
  await student.goto('http://127.0.0.1:4413'); await unlock();
  expect((await saved()).tutor!.memory.recommendations[0]!.visualAssetId).toBe('refraction-pencil');
  const localAudio = student.locator('.recorded-lesson audio'); await localAudio.evaluate((audio: HTMLAudioElement) => { audio.currentTime = 0; return audio.play(); });
  await expect.poll(() => localAudio.evaluate((audio: HTMLAudioElement) => !audio.paused && audio.currentTime > .1)).toBe(true);
  await localAudio.evaluate((audio: HTMLAudioElement) => audio.pause());
  expect(await localAudio.getAttribute('src')).toMatch(/^blob:/); proof.requirements[5] = 'PASS';
  await student.locator('.chapters [data-concept-id="refraction"]').click(); await help();
  const unexpected = 'How does a telescope lens use the same bending of light as this water lesson?'; await ask(unexpected);
  await expect.poll(async () => (await saved()).progress.queuedQuestions.some(q => q.text === unexpected)).toBe(true);
  const offlineSnapshot = await saved(), queued = offlineSnapshot.progress.queuedQuestions.find(q => q.text === unexpected)!;
  expect(queued.answered).toBe(false); expect(queued.recordedContext?.conceptId).toBe('refraction'); proof.requirements[6] = 'PASS';
  await student.close(); student = await studentContext.newPage(); await student.goto('http://127.0.0.1:4413'); await unlock();
  expect((await saved()).progress.queuedQuestions.find(q => q.id === queued.id)).toEqual(queued);
  expect((await saved()).tutor!.memory).toEqual(offlineSnapshot.tutor!.memory);

  stage('backend-restart-and-second-learner-offline-restoration');
  server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  server = await startDelivery(folder, schoolPort, 'local-demo-publisher', new OpenAITutor(process.env.OPENAI_API_KEY, request));
  await student.getByRole('button', { name: 'Lock / switch learner', exact: true }).click();
  studentId = 'student-b1c2d3e4'; studentPin = '222222'; await unlock(studentId, studentPin);
  const bRestart = await saved(studentId, studentPin);
  expect(bRestart.tutor!.memory).toEqual(bSaved.tutor!.memory); expect(bRestart.progress.queuedQuestions).toHaveLength(0);
  expect(bRestart.progress.events.filter(e => e.type === 'quiz-answered')).toEqual(bSaved.progress.events.filter(e => e.type === 'quiz-answered'));
  proof.requirements[4] = 'PASS';
  await student.getByRole('button', { name: 'Lock / switch learner', exact: true }).click();
  studentId = 'student-a1b2c3d4'; studentPin = '111111'; await unlock();

  stage('real-ai-return-acknowledged-repeat-sync-and-teacher-update');
  await studentContext.setOffline(false); await student.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(async () => (await saved()).tutor?.replies.find(r => r.questionId === queued.id)?.status, { timeout: 60000 }).toBe('answered');
  const reply = (await saved()).tutor!.replies.find(r => r.questionId === queued.id)!;
  expect(reply.engine).toBe('openai'); expect(reply.sourceRefs.length).toBeGreaterThan(0); proof.requirements[7] = 'PASS';
  proof.returned = { question: queued.text, questionId: queued.id, context: queued.recordedContext, engine: reply.engine, answer: reply.text, sourceRefs: reply.sourceRefs };
  await expect.poll(async () => (await saved()).sync?.questionIds.includes(queued.id), { timeout: 30000 }).toBe(true);
  await receiveTeacher(); await expect(teacher.locator('[data-stat="received"] strong')).toHaveText('2');
  await teacher.locator('.heat-row[data-concept-id="refraction"] button').click();
  await expect(teacher.locator('.heat-row[data-concept-id="refraction"]')).toContainText('2 incorrect checks');
  await teacher.locator('.contributing-events details').first().locator('summary').click();
  await expect(teacher.locator('.contributing-events')).toContainText(unexpected);
  await expect(teacher.locator('.contributing-events')).toContainText('Understanding check · incorrect'); proof.requirements[9] = 'PASS';
  const nudge = teacher.locator('[data-recommendation-concept-id="refraction"]');
  await expect(nudge).toContainText('support signals'); await expect(nudge).toContainText('approved hands-on demonstration');
  await expect(nudge.locator('.sources')).toContainText('activity-notes.md'); proof.requirements[10] = 'PASS';
  await teacher.getByRole('button', { name: 'Refresh tutor records', exact: true }).click();
  await expect(teacher.locator('body')).toContainText('approved visual refraction-pencil');
  await expect(teacher.locator('body')).toContainText('approved visual refraction-steps');
  const records = async (): Promise<ProgressRecord[]> => (await (await teacher.request.get('http://127.0.0.1:4414/api/progress')).json()).records;
  const before = await records();
  await student.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Profile', exact: true }).click();
  await student.getByRole('button', { name: 'Try school sync', exact: true }).click();
  const unchanged = await saved();
  for (let attempt = 0; attempt < 2; attempt++) {
    const envelope = await encryptPayload(unchanged.progress, studentPin);
    const acknowledgement = await student.request.post(`http://127.0.0.1:4413/api/progress/${studentId}/${unchanged.lesson.recording!.id}`, { data: envelope });
    expect(acknowledgement.ok()).toBe(true);
    expect((await acknowledgement.json()).studentId).toBe(studentId);
  }
  await receiveTeacher(); const repeated = await records();
  expect(repeated).toHaveLength(2);
  for (const record of repeated) {
    expect(new Set(record.events.map(e => e.eventId)).size).toBe(record.events.length);
    expect(record.events.map(e => e.eventId)).toEqual(before.find(r => r.studentId === record.studentId)!.events.map(e => e.eventId));
  }
  expect(repeated.find(r => r.studentId === 'student-a1b2c3d4')!.queuedQuestions.filter(q => q.id === queued.id)).toHaveLength(1);
  expect(proof.api.filter((r: any) => r.path === '/v1/responses')).toHaveLength(1); proof.requirements[8] = 'PASS';
  proof.received = repeated.map(r => ({ studentId: r.studentId, events: r.events.length, questionIds: r.queuedQuestions.map(q => q.id) }));
  await teacher.screenshot({ path: 'docs/screenshots/adaptive-teacher-received.png', fullPage: true });
  await teacher.getByLabel('Learning records').selectOption('seeded'); await expect(teacher.getByText('4 / 18 learners with support signals', { exact: true })).toBeVisible();
  await teacher.screenshot({ path: 'docs/screenshots/adaptive-teacher-seeded.png', fullPage: true });
  proof.seededClass = { separate: true, learners: 18, refractionSupport: 4 }; proof.result = 'PASS';
} catch (error) {
  proof.result = 'FAIL'; proof.error = (error as Error).message;
  proof.studentText = await student.locator('body').innerText().catch(() => ''); proof.teacherText = await teacher.locator('body').innerText().catch(() => '');
  await student.screenshot({ path: '.task-tmp/adaptive-learning-failure.png', fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  clearTimeout(timer); proof.finishedAt = new Date().toISOString();
  await writeFile(resolve('docs/adaptive-learning-evidence.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ result: proof.result, stage: proof.stage, error: proof.error?.slice(0, 400), requirements: proof.requirements, api: proof.api }));
  await browser.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  for (const app of apps) { if ('closeAllConnections' in app.httpServer) app.httpServer.closeAllConnections(); await new Promise<void>(resolve => app.httpServer.close(() => resolve())); }
}
