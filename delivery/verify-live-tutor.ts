import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { profiles } from '@coteacher/shared';
import { LessonDeliveryStore } from './store';
import { ProgressReturnStore } from './progress-store';
import { checkedAnswer, tutorSources } from './tutor-store';
import { OpenAITutor } from './tutor-provider';

/** Explicit live probe. This may incur API costs; never called by normal tests. */
for (const file of ['.env.local', '.env']) {
  if (existsSync(resolve(file))) process.loadEnvFile(resolve(file));
}
if (!process.env.OPENAI_API_KEY) {
  console.log('UNVERIFIED: OPENAI_API_KEY is not configured. No live API request was made.'); process.exitCode = 2;
} else {
  const folder = resolve(process.env.COTEACHER_DELIVERY_DIR ?? '.coteacher-delivery');
  const lessons = new LessonDeliveryStore(folder); await lessons.restore();
  const school = new ProgressReturnStore(folder, lessons), profile = profiles[0];
  const lesson = await school.lesson(profile.id);
  const cue = lesson.recording!.cues.find(cue => cue.conceptId === 'refraction');
  if (!cue) throw new Error('Publish an actual reviewed refraction recording first.');
  // Read-only against school records: a probe must not append unseen events and
  // make the learner's real local history stale.
  const question = 'How can a lens in eyeglasses bend light, and how does that connect to this water lesson?';
  const api = new OpenAITutor(process.env.OPENAI_API_KEY);
  const input = { question, objective: lesson.objective.text, concept: lesson.concepts.find(concept => concept.id === cue.conceptId)!.title, classLevel: lesson.classLevel,
    sources: tutorSources(lesson, cue.conceptId, question), visuals: (lesson.visualAssets ?? []).filter(asset => asset.conceptId === cue.conceptId).map(asset => ({ id: asset.id, title: asset.title, annotations: asset.layers.filter(layer => layer.kind === 'text').map(layer => layer.text) })), history: [], observations: [] };
  const answer = await api.answer(input), checked = checkedAnswer(answer, input);
  if (!checked) { console.log('FAIL: live answer was deferred by source/safety checks. No school records changed.'); process.exitCode = 1; }
  else {
    const speech = await api.speak(answer.text);
    await mkdir(resolve('.task-tmp'), { recursive: true });
    await writeFile(resolve('.task-tmp/live-tutor-probe.mp3'), speech);
    console.log(JSON.stringify({ provider: api.engine, model: api.model, citations: checked.citations.map(source => ({ title: source.title, locator: source.locator })), speechBytes: speech.length,
      result: 'PASS: real sourced answer and MP3 downloaded. Listen to .task-tmp/live-tutor-probe.mp3; this does not verify the live student UI journey.',
      answer: answer.text, microphoneTranscription: 'UNVERIFIED: test through the opt-in browser microphone. No school progress or question records were changed.' }, null, 2));
  }
}
