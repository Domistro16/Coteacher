import { expect, type Page, type TestInfo } from '@playwright/test';
import { companionMessages, type LessonRecording } from '@coteacher/shared';
import type { Snapshot } from '../../apps/student/src/storage';
import { preparedClip } from '../../apps/student/src/Narrator';

/** Recognition alone is simulated. Native teacher/companion audio, clocks, SW,
 * source material, storage and the later school receipts are real application paths. */
export async function verifyCompanionConversation(page: Page, recording: LessonRecording, info: TestInfo, read: () => Promise<Snapshot>) {
  const teacher = page.locator('.recorded-lesson audio'), spoken = page.locator('[data-companion-audio]');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true }));
  await teacher.evaluate((audio: HTMLAudioElement) => audio.play());
  await page.getByText('Offline voice options', { exact: true }).click();
  await page.locator('.lesson-voice-control').getByRole('button', { name: 'Enable offline voice mode' }).click();
  await expect(page.locator('.lesson-voice-control')).toContainText('Offline voice is unavailable');
  expect(await teacher.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(false);
  await teacher.evaluate((audio: HTMLAudioElement) => audio.pause());

  await page.evaluate(() => {
    class SimulatedRecognition {
      processLocally = false; lang = ''; continuous = false; interimResults = false;
      onresult: any = null; onerror: any = null; onend: any = null; onstart: any = null;
      static available = async (options: unknown) => { (window as any).__companionAvailability = options; return 'available'; };
      start() { (window as any).__companionRecognition = this; this.onstart?.(); }
      abort() { (window as any).__companionAborts = ((window as any).__companionAborts ?? 0) + 1; }
      emit(transcript: string) { this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: true, 0: { transcript, confidence: .99 } } } }); }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: SimulatedRecognition, configurable: true });
  });
  await page.locator('.lesson-voice-control').getByRole('button', { name: 'Enable offline voice mode' }).click();
  await expect(page.locator('.lesson-voice-control')).toContainText('Microphone on · listening locally');
  expect(await page.evaluate(() => (window as any).__companionAvailability)).toEqual({ langs: ['en-US'], processLocally: true });
  expect(await page.evaluate(() => (window as any).__companionRecognition.processLocally)).toBe(true);
  await teacher.evaluate(async (audio: HTMLAudioElement, ms) => { audio.currentTime = ms / 1000 + .2; await audio.play(); }, recording.cues[1].offsetMs);
  await page.evaluate(() => (window as any).__companionRecognition.emit('The pencil stays straight.'));
  await expect(page.locator('.learning-dialog')).toHaveCount(0);
  const captured = await teacher.evaluate((audio: HTMLAudioElement) => {
    (window as any).__companionRecognition.emit("Coteacher, I don't understand this");
    // Read the stopped media clock. A read before pause can differ by a native
    // audio frame even though both operations occur in one JavaScript task.
    return audio.currentTime * 1000;
  });
  const dialog = page.getByRole('region', { name: 'Coteacher lesson companion', exact: true });
  await expect(dialog).toBeVisible(); await expect(dialog).toHaveAttribute('data-concept-id', 'refraction');
  await expect(dialog).toHaveAttribute('data-recorded-position-ms', String(Math.round(captured)));
  expect(await teacher.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
  const paused = await teacher.evaluate((audio: HTMLAudioElement) => audio.currentTime);
  const before = await read();
  const alternatives = before.lesson.concepts.find(concept => concept.id === 'refraction')!.variants.filter(variant => variant.type !== 'tryit').map(variant => variant.content);
  await expect.poll(async () => alternatives.includes((await dialog.locator('.companion-caption').textContent())!), { timeout: 15000 }).toBe(true);
  await expect(dialog.locator('.companion-speech-status')).toHaveAttribute('data-backend', 'clip');
  await expect.poll(() => spoken.evaluate((audio: HTMLAudioElement) => !audio.paused && audio.currentTime > .1 && audio.duration > 0)).toBe(true);
  await expect(dialog.locator('.coteacher-avatar')).toHaveAttribute('data-state', 'speaking');
  const mouth = dialog.locator('.coteacher-avatar ellipse[cy="86"]');
  const firstMouth = await mouth.getAttribute('ry');
  await expect.poll(() => mouth.getAttribute('ry')).not.toBe(firstMouth);
  await expect(page.locator('.recorded-help')).toHaveAttribute('data-support-asset-id', 'refraction-pencil');
  await expect(dialog.locator('.companion-voice-mode')).toContainText('Microphone paused while Coteacher speaks');
  // Capture the actual decoded clip signal without replacing Audio/play/clock.
  const energy = await spoken.evaluate(async (audio: HTMLAudioElement) => {
    const stream = (audio as HTMLAudioElement & { captureStream(): MediaStream }).captureStream();
    const context = new AudioContext(); await context.resume();
    const input = context.createMediaStreamSource(stream), analyser = context.createAnalyser(); input.connect(analyser);
    const samples = new Float32Array(analyser.fftSize); let peak = 0;
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 50)); analyser.getFloatTimeDomainData(samples);
      peak = Math.max(peak, Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length));
    }
    input.disconnect(); await context.close(); stream.getTracks().forEach(track => track.stop()); return peak;
  });
  expect(energy).toBeGreaterThan(.0001);
  await expect.poll(async () => Number(await page.locator('.recorded-help svg').getAttribute('data-motion-time-ms'))).toBeGreaterThan(250);
  expect(await teacher.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBe(paused);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: info.outputPath('companion-320-speaking.png') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await dialog.locator('.companion-eyes').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await expect(mouth).toHaveAttribute('ry', '3');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dialog.evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: info.outputPath('companion-desktop-speaking.png') });

  // The prompt and each answer finish naturally; voice listening resumes only
  // after real clip playback ends, not an artificial media event.
  await expect(dialog.locator('.companion-caption')).toHaveText(companionMessages.understanding, { timeout: 30000 });
  await expect(dialog.locator('.companion-voice-mode')).toContainText('Microphone on · listening locally', { timeout: 15000 });
  await expect(page.locator('.recorded-help svg')).toHaveAttribute('data-motion-phase', '0.90000');
  expect(await page.locator('.recorded-help [data-build]').evaluateAll(elements => elements.every(element => element.getAttribute('data-build-progress') === '1.0000'))).toBe(true);
  const followup = 'Why does the pencil seem crooked in water?';
  await page.evaluate(text => (window as any).__companionRecognition.emit(text), followup);
  const prepared = before.lesson.questionBank.find(question => question.id === 'question-bent')!;
  await expect(dialog.locator('.companion-caption')).toHaveText(prepared.answer);
  await expect(spoken).toHaveAttribute('src', preparedClip(prepared.answer)!);
  await expect(dialog.locator('.help-response')).toContainText('Prepared offline answer');
  await expect.poll(async () => (await read()).progress.events.some(event => event.type === 'question-matched' && event.originalText === followup && event.recordedContext?.positionMs === Math.round(captured))).toBe(true);
  await expect(dialog.locator('.companion-voice-mode')).toContainText('Microphone on · listening locally', { timeout: 30000 });
  const unexpected = '  Could a pencil taste like the Moon?  ';
  await page.evaluate(text => (window as any).__companionRecognition.emit(text), unexpected);
  await expect(dialog.locator('.companion-caption')).toHaveText(companionMessages.pending);
  await expect(spoken).toHaveAttribute('src', preparedClip(companionMessages.pending)!);
  await expect.poll(() => spoken.evaluate((audio: HTMLAudioElement) => !audio.paused && audio.currentTime > .1)).toBe(true);
  await expect.poll(async () => (await read()).progress.queuedQuestions.some(question => question.text === unexpected)).toBe(true);
  const pending = (await read()).progress.queuedQuestions.find(question => question.text === unexpected)!;
  expect(pending).toMatchObject({ answered: false, recordedContext: { studentId: before.lesson.studentId, lessonId: before.lesson.lessonId, conceptId: 'refraction', recordingId: recording.id, positionMs: Math.round(captured) } });
  expect(await teacher.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBe(paused);
  await expect(dialog.locator('.companion-voice-mode')).toContainText('Microphone on · listening locally', { timeout: 30000 });

  const attempts = (await read()).progress.events.filter(event => event.type === 'quiz-answered').length;
  await dialog.getByLabel('Which part of this recorded concept is unclear?').fill('It makes sense now');
  await dialog.getByRole('button', { name: 'Ask Coteacher', exact: true }).click();
  await expect(dialog.locator('.companion-caption')).toHaveText(companionMessages.checkOffer);
  expect((await read()).progress.events.filter(event => event.type === 'quiz-answered')).toHaveLength(attempts);
  await dialog.getByRole('button', { name: 'Try a quick check' }).click();
  const quizDialog = page.getByRole('region', { name: 'Coteacher lesson companion', exact: true });
  await expect(quizDialog.locator('.quiz-card')).toContainText('Why does the pencil appear bent');
  await expect.poll(() => spoken.evaluate((audio: HTMLAudioElement) => !audio.paused && audio.currentTime > .1)).toBe(true);
  await expect(quizDialog.locator('.companion-voice-mode')).toContainText('Microphone on · listening locally', { timeout: 25000 });
  await page.evaluate(() => (window as any).__companionRecognition.emit('Option two'));
  await expect(quizDialog.locator('.quiz-feedback')).toContainText('You’ve got it');
  await expect.poll(async () => (await read()).progress.events.some(event => event.type === 'quiz-answered' && event.quizId === 'quiz-bent' && event.correctness)).toBe(true);
  await quizDialog.getByRole('button', { name: 'Turn offline voice off' }).click();
  await expect(quizDialog.locator('.companion-voice-mode')).toContainText('Microphone off');
  await quizDialog.getByRole('button', { name: 'Return to recorded lesson' }).click();
  expect(await spoken.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
  await expect.poll(() => teacher.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(paused + .15);
  await teacher.evaluate((audio: HTMLAudioElement) => audio.pause());
  expect(await page.evaluate(() => (window as any).__companionAborts)).toBeGreaterThan(0);
  await page.setViewportSize({ width: 320, height: 900 });
  return pending;
}
