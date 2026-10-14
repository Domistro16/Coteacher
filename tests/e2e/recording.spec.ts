import { teacherSources, teacherReview, teacherTransfers, expectTeacherExport } from './teacher-navigation';
import { openPreparedCompatibility } from './compatibility';
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { decryptPayload, encryptPayload, requirePublishedLesson, type LessonRecording } from '@coteacher/shared';
import type { Snapshot } from '../../apps/student/src/storage';
import { verifyDeliveredReplay } from './delivered-replay';
import { assertStudioFits } from './studio-assertions';
import { assertPlaybackMotion, assertWatermark } from './motion-assertions';

// Native browser microphone graph with Chromium's simulated input. No real people.
test.use({ contextOptions: { reducedMotion: 'no-preference' }, launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

async function prepare(page: Page) {
  await page.goto('http://127.0.0.1:4274');
  await teacherSources(page);
  await page.getByRole('button', { name: 'Use reviewed demo materials' }).click();
  await page.getByRole('button', { name: 'Generate simulated lesson' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Approve lesson', exact: true }).click();
  await page.getByRole('button', { name: 'Teach / projector' }).click();
  await page.getByRole('button', { name: 'Start presentation' }).click();
  // The studio is lazy-loaded; wait for usable controls rather than assuming
  // its chunk and saved recording initialize within the default five seconds.
  await expect(page.getByText('Microphone off', { exact: true })).toBeVisible({ timeout: 25000 });
}
async function savedRecording(page: Page): Promise<LessonRecording> {
  return page.evaluate(() => new Promise<any>((resolve, reject) => {
    const open = indexedDB.open('coteacher-teacher-recordings', 1);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('recordings').objectStore('recordings').getAll();
      request.onsuccess = () => { db.close(); resolve(request.result[0]); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
    open.onerror = () => reject(open.error);
  }));
}
async function savedLearner(page: Page, id: string, pin: string): Promise<Snapshot> {
  const row = await page.evaluate(id => new Promise<any>((resolve, reject) => {
    const open = indexedDB.open('coteacher-sprint');
    open.onsuccess = () => {
      const db = open.result, request = db.transaction('profiles').objectStore('profiles').get(id);
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
    open.onerror = () => reject(open.error);
  }), id);
  return await decryptPayload(row, pin) as Snapshot;
}

test('native microphone capture excludes pauses, persists cues and replays exact visuals in both personal offline packages', async ({ page, context }, info) => {
  // Includes native media, naturally spoken companion turns and school return.
  test.setTimeout(600_000);
  await context.grantPermissions(['microphone'], { origin: 'http://127.0.0.1:4274' });
  await page.addInitScript(() => {
    const nativeEncoder = window.AudioEncoder;
    window.AudioEncoder = class extends nativeEncoder {
      constructor(options: AudioEncoderInit) {
        const stats = { samples: 0, packets: 0, encodedSamples: 0, skip: 0, durations: {} as Record<string, number> };
        (window as any).__nativeEncoderStats = stats;
        super({ ...options, output: (chunk, metadata) => {
          stats.packets++; stats.encodedSamples += Math.round((chunk.duration ?? 20000) * 48 / 1000);
          stats.durations[String(chunk.duration)] = (stats.durations[String(chunk.duration)] ?? 0) + 1;
          const description = metadata?.decoderConfig?.description;
          if (description) {
            const header = ArrayBuffer.isView(description) ? new Uint8Array(description.buffer, description.byteOffset, description.byteLength) : new Uint8Array(description);
            stats.skip = new DataView(header.buffer, header.byteOffset, header.byteLength).getUint16(10, true);
          }
          options.output(chunk, metadata);
        } });
      }
      encode(frame: AudioData) { (window as any).__nativeEncoderStats.samples += frame.numberOfFrames; super.encode(frame); }
    };
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await original(constraints);
      Object.defineProperty(window, '__teacherStream', { value: stream, configurable: true });
      return stream;
    };
    Object.defineProperty(window, 'SpeechRecognition', { value: () => { throw new Error('No transcription permitted'); } });
  });
  await prepare(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole('button', { name: 'Start audio recording' })).toBeDisabled();
  const prepared = await page.evaluate(() => JSON.parse(localStorage.getItem('coteacher-teacher-preparation-v1')!).drafts);
  await page.getByRole('button', { name: 'Check microphone access' }).click();
  await expect(page.getByText('Microphone access checked · microphone off', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__teacherStream.getTracks().every((track: MediaStreamTrack) => track.readyState === 'ended'))).toBe(true);
  expect(await savedRecording(page)).toBeUndefined();
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open projector display' }).click();
  let projector = await popup;
  await expect(projector.locator('.classroom-projector')).toHaveAttribute('data-presentation-step-id', 'step-light');
  await expect(projector.locator('button,input,audio,nav,.sources,.recording-panel')).toHaveCount(0);
  await page.getByLabel('Record my explanation only.', { exact: false }).check();
  await page.getByRole('button', { name: 'Start audio recording' }).click();
  // Native microphone/AudioWorklet initialization is asynchronous; still require
  // actual recording status rather than treating a permission request as capture.
  await expect(page.getByText('Recording teacher microphone', { exact: false })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Prepare lesson', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Focus studio', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 640 });
  await assertStudioFits(page, true);
  await page.screenshot({ path: info.outputPath('studio-live-320.png') });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(6200);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Next visual' }).click();
  await expect(projector.locator('.classroom-projector')).toHaveAttribute('data-presentation-step-id', 'step-refraction');
  await context.setOffline(false);
  await projector.bringToFront();
  await expect(page.getByRole('button', { name: 'Pause recording', exact: true })).toBeVisible();
  await projector.close();
  const reopenedProjector = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open projector display' }).click();
  projector = await reopenedProjector;
  await expect(projector.locator('.classroom-projector')).toHaveAttribute('data-presentation-step-id', 'step-refraction');
  await expect(page.getByText('Recording teacher microphone', { exact: false })).toBeVisible();
  expect(await page.getByRole('navigation', { name: 'Presentation controls' }).evaluate(element => element.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
  await page.screenshot({ path: info.outputPath('projector-live-recording.png'), fullPage: true });
  // Capture a full construction cycle for refraction as well as the first concept.
  await page.waitForTimeout(6200);
  await page.getByRole('button', { name: 'Pause recording', exact: true }).click();
  await expect(page.getByText('Recording paused · microphone muted', { exact: false })).toBeVisible();
  const studioPhase = page.locator('.studio-canvas-space svg');
  const projectionPhase = projector.locator('.teaching-canvas svg');
  await expect.poll(async () => await projectionPhase.getAttribute('data-motion-time-ms')).toBe(await studioPhase.getAttribute('data-motion-time-ms'));
  const frozen = await studioPhase.getAttribute('data-motion-phase');
  await assertWatermark(page.locator('.studio-canvas-space'));
  await page.waitForTimeout(350);
  expect(await studioPhase.getAttribute('data-motion-phase')).toBe(frozen);
  expect(await projectionPhase.getAttribute('data-motion-phase')).toBe(frozen);
  const pausedStatus = await page.locator('.recording-status').innerText();
  expect(await page.evaluate(() => (window as any).__teacherStream.getAudioTracks()[0].enabled)).toBe(false);
  await page.getByRole('button', { name: 'Previous visual' }).click();
  await expect(projector.locator('.classroom-projector')).toHaveAttribute('data-presentation-step-id', 'step-light');
  await page.waitForTimeout(2300);
  expect(await page.locator('.recording-status').innerText()).toBe(pausedStatus);
  await page.getByRole('button', { name: 'Resume recording', exact: true }).click();
  await expect(page.getByText('Recording teacher microphone', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__teacherStream.getAudioTracks()[0].enabled)).toBe(true);
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Next visual' }).click();
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Stop and save recording', exact: true }).click();
  try {
    await expect(page.getByText('Recording saved · review before publishing', { exact: true })).toBeVisible({ timeout: 30000 });
  } finally {
    const stats = await page.evaluate(() => (window as any).__nativeEncoderStats);
    console.log('Native classroom codec samples:', stats);
    await info.attach('native-classroom-codec-samples', { body: JSON.stringify(stats), contentType: 'application/json' });
  }
  await expect(page.getByRole('heading', { name: 'See what your learners will see.' })).toBeVisible();
  await projector.close();
  expect(await page.evaluate(() => (window as any).__teacherStream.getAudioTracks()[0].readyState)).toBe('ended');
  const recording = await savedRecording(page);
  expect(recording.review.status).toBe('draft');
  expect(recording.durationMs).toBeGreaterThan(5000);
  // UI/screenshot latency is genuine recorded time, not a 30s media limit.
  expect(Number.isFinite(recording.durationMs)).toBe(true);
  expect(recording.cues.map(cue => cue.timelineStepId)).toEqual(['step-light', 'step-refraction', 'step-light', 'step-light', 'step-refraction']);
  expect(recording.cues[2].offsetMs).toBe(recording.cues[3].offsetMs);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('coteacher-teacher-preparation-v1')!).drafts);
  for (let i = 0; i < stored.length; i++) {
    const { classroomTimeline, ...content } = stored[i];
    const { classroomTimeline: previous, ...before } = prepared[i];
    expect(content).toEqual(before);
  }
  await page.getByRole('button', { name: 'Prepare lesson', exact: true }).click();
  await expectTeacherExport(page, false);
  await page.reload();
  await page.getByRole('button', { name: 'Recording review', exact: true }).click();
  await expect(page.getByText('Recording saved · review before publishing', { exact: true })).toBeVisible();
  expect(await savedRecording(page)).toEqual(recording);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`teacher-recording-review-${width}.png`), fullPage: true });
  }
  const playback = page.locator('.recorded-lesson');
  const audio = playback.locator('audio');
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.duration)).toBeCloseTo(recording.durationMs / 1000, 1);
  await page.getByLabel('I reviewed the audio and visual timing', { exact: false }).check();
  await expect(page.getByRole('button', { name: 'Approve recording for learners' })).toBeDisabled();
  await assertPlaybackMotion(audio, playback.locator(':scope > .replay-stage'));
  await audio.evaluate((element: HTMLAudioElement, ms) => { element.currentTime = Math.max(0, ms / 1000 - .3); }, recording.cues[1].offsetMs);
  await audio.evaluate((element: HTMLAudioElement) => element.play());
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(recording.cues[1].offsetMs / 1000 + .15);
  await expect(playback).toHaveAttribute('data-recorded-step-id', 'step-refraction');
  await audio.evaluate((element: HTMLAudioElement) => element.pause());
  await page.locator('.recording-review [data-recorded-cue-index="0"]').click();
  await expect(playback).toHaveAttribute('data-recorded-step-id', 'step-light');
  await page.locator('.recording-review [data-recorded-cue-index="4"]').click();
  await expect(playback).toHaveAttribute('data-recorded-concept-id', 'refraction');
  await page.screenshot({ path: info.outputPath('teacher-recording-review.png'), fullPage: true });
  await page.getByRole('button', { name: 'Approve recording for learners' }).click();
  await page.getByRole('button', { name: 'Prepare lesson', exact: true }).click();
  await expectTeacherExport(page, false);
  await page.getByRole('button', { name: 'Recording review', exact: true }).click();
  await page.getByLabel('Preview learner presentation').selectOption('student-a1b2c3d4');
  const personalPreview = page.locator('.recording-review > .recorded-lesson');
  await expect(personalPreview).toBeVisible();
  const personalAudio = personalPreview.locator('audio');
  await expect.poll(() => personalAudio.evaluate((audio: HTMLAudioElement) => Number.isFinite(audio.duration))).toBe(true);
  await page.locator('.recording-review [data-recorded-cue-index="4"]').click();
  await expect(personalPreview.locator(':scope > .replay-stage')).toHaveAttribute('data-visual-asset-id', 'refraction-pencil');
  const previewPosition = await personalAudio.evaluate((audio: HTMLAudioElement) => audio.currentTime);
  const previewSource = await personalAudio.getAttribute('src');
  await page.getByLabel('Preview learner presentation').selectOption('student-b1c2d3e4');
  await expect(personalPreview.locator(':scope > .replay-stage')).toHaveAttribute('data-visual-asset-id', 'refraction-steps');
  expect(await personalAudio.getAttribute('src')).toBe(previewSource);
  expect(await personalAudio.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeCloseTo(previewPosition, 2);
  await page.getByLabel('I reviewed both personalized visual sequences', { exact: false }).check();
  await page.getByRole('button', { name: 'Approve personalized playback' }).click();
  await expect(page.getByText('Both personalized visual sequences approved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Recording reviewed · ready for export', { exact: true })).toBeVisible();
  const approvedRecording = await savedRecording(page);
  await page.getByRole('button', { name: 'Prepare lesson', exact: true }).click();
  const paths: string[] = [];
  for (const [label, pin] of [['Student A', '111111'], ['Student B', '222222']]) {
    const download = page.waitForEvent('download');
    await teacherTransfers(page);
    await page.getByRole('button', { name: `Export ${label} package` }).click();
    const path = (await (await download).path())!; paths.push(path);
    const lesson = requirePublishedLesson(await decryptPayload(JSON.parse(await readFile(path, 'utf8')), pin));
    expect(lesson.recording).toEqual(approvedRecording);
    expect(lesson.objective).toEqual(prepared[0].objective);
  }
  await page.getByRole('button', { name: 'Publish packages', exact: true }).click();
  await page.getByRole('button', { name: 'Publish recorded lesson' }).click();
  await expect(page.getByText('Recorded lesson published to the local lesson service for both learners. They can stream it or download it for offline use.')).toBeVisible({ timeout: 60000 });
  await verifyDeliveredReplay(context.browser()!, approvedRecording, info, page);
  await page.addInitScript(() => {
    if (location.port !== '4273') return;
    const put = IDBObjectStore.prototype.put;
    Object.defineProperty(window, '__failMediaSave', { value: false, writable: true });
    IDBObjectStore.prototype.put = function(...args: Parameters<typeof put>) {
      if (this.name === 'media' && (window as any).__failMediaSave) throw new DOMException('Simulated media quota failure', 'QuotaExceededError');
      return put.apply(this, args);
    };
    for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket']) Object.defineProperty(window, name, {
      value: () => { throw new Error('Recorded learner core path attempted networking'); },
    });
  });
  await page.goto('http://127.0.0.1:4273');
  await page.setViewportSize({ width: 360, height: 800 });
  async function unlockLearner(id = 'student-a1b2c3d4', pin = '111111') {
    await page.getByLabel('Your profile', { exact: true }).selectOption(id);
    await page.getByLabel('Six-digit PIN').fill(pin);
    await page.getByRole('button', { name: 'Unlock my profile' }).click();
    await expect(page.getByRole('heading', { name: /Hey, Student/ })).toBeVisible();
  }
  async function reopenReplay() {
    await unlockLearner();
    await page.getByRole('button', { name: 'Continue Watching', exact: true }).click();
  }
  async function lockLearner() {
    await page.getByRole('button', { name: 'Lock / switch learner' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  }
  await unlockLearner(); await openPreparedCompatibility(page);
  const approvedPayload = requirePublishedLesson(await decryptPayload(JSON.parse(await readFile(paths[0], 'utf8')), '111111'));
  const bPayload = requirePublishedLesson(await decryptPayload(JSON.parse(await readFile(paths[1], 'utf8')), '222222'));
  expect(bPayload.recording).toEqual(approvedPayload.recording);
  expect(bPayload.playback!.sequence).not.toEqual(approvedPayload.playback!.sequence);
  for (const [name, payload, message] of [
    ['draft', { ...approvedPayload, recording }, 'Review and approve the classroom recording'],
    ['visual-draft', { ...approvedPayload, recording: { ...approvedPayload.recording, visualReview: { status: 'draft' } } }, 'personalized visual sequences'],
    ['missing-asset', { ...approvedPayload, visualAssets: approvedPayload.visualAssets!.slice(0,1) }, 'incomplete or damaged'],
  ] as const) {
    await page.getByLabel('Import lesson file').setInputFiles({ name: name+'.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(await encryptPayload(payload,'111111'))) });
    await expect(page.getByRole('alert')).toContainText(message); await expect(page.locator('.recorded-lesson')).toHaveCount(0);
  }
  await page.evaluate(() => { (window as any).__failMediaSave = true; });
  await page.getByLabel('Import lesson file').setInputFiles(paths[0]);
  await expect(page.getByRole('alert')).toContainText('Complete lesson media could not be saved');
  await expect(page.getByText('Ready offline', { exact:true })).toHaveCount(0);
  await page.evaluate(() => { (window as any).__failMediaSave = false; });
  await page.getByRole('button', { name:'Retry save',exact:true }).click();
  await expect(page.getByText('Ready offline',{exact:true})).toBeVisible();
  const studentPlayback=page.locator('.recorded-lesson'), studentAudio=studentPlayback.locator('audio');
  await expect(studentAudio).toHaveAttribute('src',/^blob:/);
  const aPosition=recording.cues[4].offsetMs+100;
  await studentAudio.evaluate((audio:HTMLAudioElement,at)=>{audio.currentTime=at/1000},aPosition);
  await expect(studentPlayback.locator(':scope > .replay-stage')).toHaveAttribute('data-visual-asset-id','refraction-pencil');
  await lockLearner(); const savedA=await savedLearner(page,'student-a1b2c3d4','111111');
  await unlockLearner('student-b1c2d3e4','222222'); await openPreparedCompatibility(page);
  await page.getByLabel('Import lesson file').setInputFiles(paths[0]); await expect(page.getByRole('alert')).toContainText('PIN');
  await page.getByLabel('Import lesson file').setInputFiles(paths[1]);
  await expect(studentAudio).toHaveAttribute('src',/^blob:/);
  await expect(studentPlayback.locator(':scope > .replay-stage')).toHaveAttribute('data-visual-asset-id','light-path-steps');
  await studentPlayback.getByRole('button',{name:'Play lesson replay',exact:true}).click();
  await expect.poll(()=>studentAudio.evaluate((audio:HTMLAudioElement)=>audio.currentTime)).toBeGreaterThan(.3);
  await studentAudio.evaluate((audio:HTMLAudioElement)=>{audio.pause();audio.currentTime=1.2});
  await lockLearner();
  const savedB=await savedLearner(page,'student-b1c2d3e4','222222');
  expect(savedB.player.recording!.positionMs).toBeCloseTo(1200,-1);
  expect((await savedLearner(page,'student-a1b2c3d4','111111')).player.recording!.positionMs).toBe(savedA.player.recording!.positionMs);
  await context.setOffline(true); await page.reload(); await reopenReplay();
  await expect(studentAudio).toHaveAttribute('src',/^blob:/);
  await expect.poll(()=>studentAudio.evaluate((audio:HTMLAudioElement)=>audio.currentTime*1000)).toBeCloseTo(aPosition,-1);
  await page.locator('[data-recorded-cue-index="4"]').click();
  await page.getByRole('button',{name:'I don’t understand',exact:true}).click();
  await expect(page.locator('.recorded-help')).toHaveAttribute('data-support-step-id','step-refraction');
  await expect(page.locator('.recorded-help')).toHaveAttribute('data-support-asset-id','refraction-pencil');
  await expect(page.locator('.explanation-card[data-variant-id]')).toHaveAttribute('data-variant-id','refraction-short');
  const paused=await studentAudio.evaluate((audio:HTMLAudioElement)=>audio.currentTime*1000);
  await page.getByLabel('Which part of this recorded concept is unclear?').fill('Why does the pencil look broken?');
  await page.getByRole('button',{name:'Ask Coteacher',exact:true}).click();
  await expect(page.locator('.help-response')).toContainText('Prepared offline answer');
  await expect(page.locator('.help-response')).toContainText('The pencil is straight');
  await page.locator('.help-response').getByText('Explanation sources', {exact:true}).click();
  await expect(page.locator('.help-response .sources')).toContainText('teacher-notes.md');
  await page.getByRole('button',{name:'Try it',exact:true}).click();
  await expect(page.getByText('One clear plastic cup', {exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Start activity',exact:true}).click();
  const instructions=prepared[0].concepts[1].variants.find((variant:any)=>variant.type==='tryit').steps;
  for(let index=0;index<instructions.length;index++){
    await expect(page.locator('.activity-instruction')).toContainText(instructions[index]);
    await page.getByRole('button',{name:index+1===instructions.length?'See why it works':'Next instruction',exact:true}).click();
  }
  await page.getByRole('button',{name:'I’ve finished · check my understanding',exact:true}).click();
  await page.locator('.quiz-options button').first().click();
  await expect(page.locator('.quiz-feedback')).toHaveClass(/retry/);
  await page.getByRole('button',{name:'Light changes direction at the angled water-air boundary',exact:true}).click();
  await expect(page.locator('.quiz-feedback')).toHaveClass(/correct/);
  await page.getByRole('button',{name:'Explain',exact:true}).click();
  await page.getByLabel('Which part of this recorded concept is unclear?').fill('What does the Moon taste like?');
  await page.getByRole('button',{name:'Ask Coteacher',exact:true}).click();
  await expect(page.locator('.help-response')).toContainText('Saved on this device.');
  const secondQuestion='  Can light swim?\nPlease explain!  ';
  await page.getByLabel('Which part of this recorded concept is unclear?').fill(secondQuestion);
  await page.getByRole('button',{name:'Ask Coteacher',exact:true}).click();
  await expect(page.locator('.help-response')).toContainText('Pending · teacher review');
  await page.getByRole('navigation',{name:'Prepared concept representations'}).getByRole('button',{name:/step/i}).click();
  await expect(page.getByText('Saved on this device',{exact:true})).toBeVisible();
  const adaptedA=await savedLearner(page,'student-a1b2c3d4','111111');
  expect(adaptedA.progress.queuedQuestions.map(question=>question.text)).toEqual(['What does the Moon taste like?',secondQuestion]);
  expect(new Set(adaptedA.progress.queuedQuestions.map(question=>question.id)).size).toBe(2);
  for (const question of adaptedA.progress.queuedQuestions) expect(question).toMatchObject({ answered:false,
    recordedContext:{studentId:adaptedA.lesson.studentId,lessonId:adaptedA.lesson.lessonId,conceptId:'refraction',recordingId:recording.id,positionMs:Math.round(paused)} });
  expect(adaptedA.lesson.recording!.cues).toEqual(recording.cues); expect(adaptedA.lesson.playback).toEqual(approvedPayload.playback);
  expect(adaptedA.progress.events.some(event=>event.type==='tryit-completed')).toBe(true);
  await page.reload(); await reopenReplay();
  await expect(page.locator('.recorded-help')).toHaveAttribute('data-support-asset-id','refraction-steps');
  await expect.poll(()=>studentAudio.evaluate((audio:HTMLAudioElement)=>audio.currentTime*1000)).toBeCloseTo(paused,-1);
  await page.getByRole('button',{name:'Return to recorded lesson',exact:true}).click();
  await expect.poll(()=>studentAudio.evaluate((audio:HTMLAudioElement)=>audio.currentTime)).toBeGreaterThan(paused/1000+.15);
  await studentAudio.evaluate((audio:HTMLAudioElement)=>audio.pause());
  await expect(page.locator('.recorded-help')).toHaveCount(0);
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Progress',exact:true}).click();
  await expect(page.getByText('What does the Moon taste like?',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Return to lesson questions'}).click();
  await page.getByRole('button',{name:'Your questions',exact:true}).click();
  await expect(page.locator('.player-questions')).toContainText('What does the Moon taste like?');
  await expect(page.locator('.player-questions article')).toHaveCount(3);
  const beforeClose=await studentAudio.evaluate((audio:HTMLAudioElement)=>audio.currentTime);
  await page.getByRole('button',{name:'Close learning panel'}).click();
  expect(await studentAudio.evaluate((audio:HTMLAudioElement)=>audio.paused)).toBe(true);
  expect(await studentAudio.evaluate((audio:HTMLAudioElement)=>audio.currentTime)).toBeCloseTo(beforeClose,3);
  await lockLearner(); await unlockLearner('student-b1c2d3e4','222222');
  await expect(page.getByText('What does the Moon taste like?',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Continue Watching',exact:true}).click();
  await expect.poll(()=>studentAudio.evaluate((audio:HTMLAudioElement)=>audio.currentTime)).toBeCloseTo(1.2,2);
  expect((await savedLearner(page,'student-b1c2d3e4','222222')).progress.events.filter(event=>event.type==='visual-explored')).toEqual([]);
  await page.getByRole('button',{name:'I don’t understand',exact:true}).click();
  await page.getByLabel('Which part of this recorded concept is unclear?').fill('Can a ray of light sing?');
  await page.getByRole('button',{name:'Ask Coteacher',exact:true}).click();
  await expect(page.locator('.help-response')).toContainText('Pending · teacher review');
  await expect(page.getByText('Saved on this device',{exact:true})).toBeVisible();
  const questionedB=await savedLearner(page,'student-b1c2d3e4','222222');
  expect(questionedB.progress.queuedQuestions).toMatchObject([{text:'Can a ray of light sing?',recordedContext:{studentId:questionedB.lesson.studentId,conceptId:'light-path',positionMs:1200}}]);
  expect((await savedLearner(page,'student-a1b2c3d4','111111')).progress.queuedQuestions).toEqual(adaptedA.progress.queuedQuestions);
  await page.getByRole('button',{name:'Close learning panel'}).click();
  await lockLearner();
  for(const corrupt of [false,true]) {
    await page.evaluate(corrupt=>new Promise<void>(resolve=>{
      const request=indexedDB.open('coteacher-sprint');request.onsuccess=()=>{
        const db=request.result,tx=db.transaction('media','readwrite'),store=tx.objectStore('media');
        if(corrupt){const keys=store.getAllKeys();keys.onsuccess=()=>store.put({iv:new Uint8Array(12),ciphertext:new ArrayBuffer(1)},keys.result[0]);} else store.clear();
        tx.oncomplete=()=>{db.close();resolve()};
      };
    }),corrupt);
    await page.reload(); await page.getByLabel('Six-digit PIN').fill('111111'); await page.getByRole('button',{name:'Unlock my profile'}).click();
    await expect(page.getByRole('alert')).toContainText(corrupt?'incomplete or damaged':'Recorded audio is missing');
    await expect(page.locator('.recorded-lesson')).toHaveCount(0);
    await page.getByLabel('Recollect recorded package').setInputFiles(paths[0]);
    await expect(page.getByRole('heading',{name:'Hey, Student A!'})).toBeVisible();
    await page.getByRole('button',{name:'Continue Watching',exact:true}).click();
    await expect(studentAudio).toHaveAttribute('src',/^blob:/);
    // Resuming previously cleared paused support; media recovery restores the
    // saved player, rather than inventing an open help dialog.
    const close = page.getByRole('button',{name:'Close learning panel'});
    if (await close.isVisible()) await close.click();
    await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Progress',exact:true}).click();
    await page.getByRole('button',{name:'Return to lesson questions'}).click();
    await page.getByRole('button',{name:'Your questions',exact:true}).click();
    await expect(page.locator('.player-questions')).toContainText('What does the Moon taste like?');
    await expect(page.locator('.player-questions article')).toHaveCount(3);
    await page.getByRole('button',{name:'Close learning panel'}).click();
    if(!corrupt) await lockLearner();
  }
  await page.getByRole('button',{name:'Open profile'}).click();
  await page.getByText('Bring progress to school / transfer lesson',{exact:true}).click();
  const progressDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export my progress' }).click();
  const progressPath = (await (await progressDownload).path())!;
  const returnedProgress = await decryptPayload(JSON.parse(await readFile(progressPath, 'utf8')), '111111') as Snapshot['progress'];
  expect(returnedProgress.events.filter(event => event.type === 'visual-explored').length).toBeGreaterThan(0);
  expect(returnedProgress.events.filter(event => event.type === 'quiz-answered')).toEqual(expect.arrayContaining([expect.objectContaining({ conceptId: 'refraction', correctness: true })]));
  await context.setOffline(false);
  const teacher = await context.newPage();
  await teacher.goto('http://127.0.0.1:4274');
  await teacher.getByRole('button', { name: 'Class insights', exact: true }).click();
  await teacherTransfers(teacher);
  await teacher.getByLabel('Learner’s six-digit PIN').fill('111111');
  await teacherTransfers(teacher);
  await teacher.getByLabel('Import encrypted progress').setInputFiles(progressPath);
  await expect(teacher.getByText('Progress imported. Class insights updated.')).toBeVisible();
});

test('microphone permission failure leaves manual presentation available and never claims a recording', async ({ page, context }) => {
  await context.grantPermissions([], { origin: 'http://127.0.0.1:4274' });
  // Fake permission dialogs auto-allow; explicitly exercise the native rejection shape.
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Simulated permission denial', 'NotAllowedError'); };
  });
  await prepare(page);
  await page.getByLabel('Record my explanation only.', { exact: false }).check();
  await page.getByRole('button', { name: 'Start audio recording' }).click();
  await expect(page.getByRole('alert')).toContainText('Microphone permission was denied');
  await expect(page.getByText('Microphone off', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next visual' }).click();
  await expect(page.locator('.cue')).toHaveAttribute('data-presentation-step-id', 'step-refraction');
  expect(await savedRecording(page)).toBeUndefined();
});

test('failed audio save retains replayable media, blocks navigation/export, and retries the complete draft', async ({ page, context }) => {
  await context.grantPermissions(['microphone'], { origin: 'http://127.0.0.1:4274' });
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    Object.defineProperty(window, '__failAudioSave', { value: true, writable: true });
    IDBObjectStore.prototype.put = function(...args: Parameters<typeof put>) {
      if (this.name === 'recordings' && (window as any).__failAudioSave) throw new DOMException('Simulated quota failure', 'QuotaExceededError');
      return put.apply(this, args);
    };
  });
  await prepare(page);
  await page.getByLabel('Record my explanation only.', { exact: false }).check();
  await page.getByRole('button', { name: 'Start audio recording' }).click();
  await expect(page.getByText('Recording teacher microphone', { exact: false })).toBeVisible();
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: 'Stop and save recording', exact: true }).click();
  await expect(page.getByText('Recording not saved · keep this tab open', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare lesson', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Approve recording for learners' })).toBeDisabled();
  await expect.poll(() => page.locator('.recorded-lesson audio').evaluate((element: HTMLAudioElement) => element.duration)).toBeGreaterThan(1);
  await page.evaluate(() => { (window as any).__failAudioSave = false; });
  await page.getByRole('button', { name: 'Retry saving recording' }).click();
  await expect(page.getByText('Recording saved · review before publishing', { exact: true })).toBeVisible();
  expect((await savedRecording(page)).review.status).toBe('draft');
});

test('canceling a pending permission request releases a subsequently granted microphone without recording', async ({ page, context }) => {
  await context.grantPermissions(['microphone'], { origin: 'http://127.0.0.1:4274' });
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = constraints => new Promise(resolve => {
      Object.defineProperty(window, '__grantLater', { configurable: true, value: async () => {
        const stream = await original(constraints);
        Object.defineProperty(window, '__lateStream', { value: stream }); resolve(stream);
      } });
    });
  });
  await prepare(page);
  await page.getByLabel('Record my explanation only.', { exact: false }).check();
  await page.getByRole('button', { name: 'Start audio recording' }).click();
  await expect(page.getByText('Waiting for microphone permission…')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next visual' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel microphone request' }).click();
  await expect(page.getByText('Microphone off', { exact: true })).toBeVisible();
  await page.evaluate(async () => { await (window as any).__grantLater(); });
  await expect.poll(() => page.evaluate(() => (window as any).__lateStream.getAudioTracks()[0].readyState)).toBe('ended');
  expect(await savedRecording(page)).toBeUndefined();
  await expect(page.getByRole('button', { name: 'Next visual' })).toBeEnabled();
});
