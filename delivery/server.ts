import { maintainSchool } from './school-maintenance';
import { LearnerService } from './learner-service';
import { PreparationService } from './preparation-service';
import { LlamaTutor } from './local-tutor';
import { ResendGuardianDelivery } from './guardian-mail';
import { rankPreparedQuestions } from '../packages/shared/src/preparation';
import { SchoolTutor } from './school-tutor';
import { SupabaseIdentity } from './managed-auth';
import { EncryptedPrivateStorage, LocalPrivateStorage, R2Storage } from './private-storage';
import { SchoolLessons } from './school-lessons';
import { LocalSchoolRepository, SchoolService } from './school-store';
import { schoolHttp } from './school-http';
import { PostgresSchoolRepository } from './school-postgres';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { LessonDeliveryStore } from './store';
import { ProgressReturnStore } from './progress-store';
import { TutorStore } from './tutor-store';
import { OpenAITutor, type TutorProvider } from './tutor-provider';
import { OpenAILiveVoice, type LiveVoiceProvider } from './live-provider';
import { createHash } from 'node:crypto';
import { encryptPayload, profiles, deferTutorSpeech } from '@coteacher/shared';

function json(response: ServerResponse, status: number, value: unknown) {
  const bytes = Buffer.from(JSON.stringify(value));
  response.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': bytes.length, 'Cache-Control': 'no-store' }); response.end(bytes);
}
async function body(request: IncomingMessage) {
  let length = 0; const chunks: Buffer[] = [];
  for await (const chunk of request) { length += chunk.length; if (length > 60_000_000) throw new Error('Publication exceeds the media budget.'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
/** Real loopback HTTP delivery, including byte ranges for native seeking. */
export async function startDelivery(folder: string, port = 8787, publishToken = 'local-demo-publisher', provider?: TutorProvider, liveProvider?: LiveVoiceProvider) {
  const publicMode = process.env.COTEACHER_PUBLIC === 'true';
  if(process.env.COTEACHER_ALLOW_REAL_STUDENTS==='true'&&!publicMode)throw new Error('Real student accounts require the authenticated public deployment mode.');
  const required = ['COTEACHER_TUTOR_STORAGE_KEY', 'COTEACHER_SCHOOL_DATABASE_URL', 'COTEACHER_SUPABASE_URL', 'COTEACHER_SUPABASE_PUBLISHABLE_KEY', 'COTEACHER_R2_ENDPOINT', 'COTEACHER_R2_BUCKET', 'COTEACHER_R2_ACCESS_KEY_ID', 'COTEACHER_R2_SECRET_ACCESS_KEY', 'COTEACHER_SCHOOL_URL', 'COTEACHER_TEACHER_URL', 'COTEACHER_STUDENT_URL'];
  if (publicMode && required.some(key => !process.env[key])) throw new Error('Public mode requires Supabase, private R2 storage and all three app URLs. Missing: ' + required.filter(key => !process.env[key]).join(', '));
  const origins = [process.env.COTEACHER_SCHOOL_URL, process.env.COTEACHER_TEACHER_URL, process.env.COTEACHER_STUDENT_URL].filter((x): x is string => !!x);
  if (publicMode && origins.some(origin => !origin.startsWith('https://') || new URL(origin).origin !== origin)) throw new Error('Public app URLs must be exact HTTPS origins.');
  const schoolRepository = process.env.COTEACHER_SCHOOL_DATABASE_URL ? new PostgresSchoolRepository(process.env.COTEACHER_SCHOOL_DATABASE_URL) : new LocalSchoolRepository(folder);
  if (schoolRepository instanceof PostgresSchoolRepository) await schoolRepository.migrate();
  const schoolService = new SchoolService(schoolRepository);
  const identity = process.env.COTEACHER_SUPABASE_URL && process.env.COTEACHER_SUPABASE_PUBLISHABLE_KEY ? new SupabaseIdentity(process.env.COTEACHER_SUPABASE_URL, process.env.COTEACHER_SUPABASE_PUBLISHABLE_KEY, (process.env.COTEACHER_OPERATOR_EMAILS ?? '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)) : undefined;
  const rawPrivateStorage = process.env.COTEACHER_R2_ENDPOINT ? new R2Storage(process.env.COTEACHER_R2_ENDPOINT, process.env.COTEACHER_R2_BUCKET ?? '', process.env.COTEACHER_R2_ACCESS_KEY_ID ?? '', process.env.COTEACHER_R2_SECRET_ACCESS_KEY ?? '') : new LocalPrivateStorage(folder + '/private');
  const privateStorage=publicMode||!!process.env.COTEACHER_R2_ENDPOINT?new EncryptedPrivateStorage(rawPrivateStorage,process.env.COTEACHER_TUTOR_STORAGE_KEY??''):rawPrivateStorage;
  const schoolLessons=new SchoolLessons(schoolService,privateStorage);
  const selectedProvider=process.env.COTEACHER_TEXT_PROVIDER??'openai';
  if(!['openai','llama.cpp','none'].includes(selectedProvider))throw new Error('Choose an explicit supported text provider.');
  if(selectedProvider==='llama.cpp' && process.env.COTEACHER_LOCAL_MODEL_APPROVED!=='true')throw new Error('Evaluate and explicitly approve the local model before enabling learner generation.');
  const tutorProvider=provider??(selectedProvider==='llama.cpp'?new LlamaTutor(process.env.COTEACHER_LOCAL_MODEL??'',process.env.COTEACHER_LOCAL_MODEL_URL??'http://127.0.0.1:8081'):selectedProvider==='openai'&&process.env.OPENAI_API_KEY?new OpenAITutor(process.env.OPENAI_API_KEY):undefined);
  const liveProviderForSchool=liveProvider??(!provider&&selectedProvider==='openai'&&process.env.OPENAI_API_KEY?new OpenAILiveVoice(process.env.OPENAI_API_KEY):undefined);
  const guardianMail=process.env.COTEACHER_GUARDIAN_MAIL_MODE==='resend'?new ResendGuardianDelivery(process.env.COTEACHER_GUARDIAN_MAIL_KEY??'',process.env.COTEACHER_GUARDIAN_MAIL_FROM??'',process.env.COTEACHER_STUDENT_URL??''):undefined;
  const learners = new LearnerService(schoolService, process.env.COTEACHER_TUTOR_STORAGE_KEY ?? 'simulated-local-school-tutor-key-v1',undefined,guardianMail);
  const schoolTutor=new SchoolTutor(schoolService,schoolLessons,privateStorage,process.env.COTEACHER_TUTOR_STORAGE_KEY??'simulated-local-school-tutor-key-v1',tutorProvider,liveProviderForSchool,learners);
  const preparation = new PreparationService(schoolService,schoolLessons,privateStorage,tutorProvider);
  schoolLessons.preparedFor=async(actor,id)=>{
    const support=await preparation.current(actor,id);if(!support)return null;
    const snapshot=await schoolService.snapshot(actor);if(snapshot.account.role!=='student')return support;
    const memory=await learners.learningContext(actor);
    const relevant=memory.evidence.filter(e=>e.subjectKey===support.knowledge.subjectKey && (e.kind==='help'||e.kind==='assessment' && !e.correct)).map(e=>e.knowledgeKey);
    return {...support,candidates:rankPreparedQuestions(support,relevant)};
  };
  schoolLessons.replayFor=async actor=>{
    if((await schoolService.snapshot(actor)).account.role!=='student')return undefined;
    const memory=await learners.learningContext(actor);if(!memory.personalization)return undefined;
    if(memory.preferences.formats?.includes('steps'))return {preference:'ordered-annotations'};
    if(memory.preferences.formats?.includes('picture'))return {preference:'concrete-diagrams'};
    return undefined;
  };
  const handleSchool = schoolHttp(schoolService, { identity, preparation, learners, lessons: schoolLessons, tutor:schoolTutor, origins, schoolUrl: process.env.COTEACHER_SCHOOL_URL, teacherUrl: process.env.COTEACHER_TEACHER_URL, studentUrl: process.env.COTEACHER_STUDENT_URL });
  const store = new LessonDeliveryStore(folder); await store.restore();
  const progress = new ProgressReturnStore(folder, store);
  const tutor = new TutorStore(folder, progress, tutorProvider);
  const live = liveProviderForSchool;
  const returning = new Set<string>();
  let publishing = false;
  const server = createServer(async (request, response) => {
    try {
      if (await handleSchool(request, response)) return;
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (publicMode) {
        if (request.method === 'GET' && url.pathname === '/api/health') json(response, 200, { service: 'coteacher', cloud: true });
        else json(response, 404, { error: 'Use authenticated versioned endpoints.' });
        return;
      }
      if (url.pathname === '/api/tutor/overview' && request.method === 'GET') {
        if (request.headers.authorization !== `Bearer ${publishToken}`) { json(response, 403, { error: 'Teacher access is required.' }); return; }
        json(response, 200, { states: await tutor.overview(), provider: tutor.provider?.engine ?? 'unavailable', simulatedLearners: true }); return;
      }
      const flag = /^\/api\/tutor\/flag\/(student-[a-f0-9]{8,32})\/([a-zA-Z0-9_-]{1,100})$/.exec(url.pathname);
      if (flag && request.method === 'POST') {
        if (request.headers.authorization !== `Bearer ${publishToken}`) { json(response, 403, { error: 'Teacher access is required.' }); return; }
        json(response, 200, await tutor.flag(flag[1], flag[2])); return;
      }
      const coaching = /^\/api\/tutor\/(student-[a-f0-9]{8,32})\/([a-zA-Z0-9_-]{1,100})(\/voice|\/consent|\/live|\/check)?$/.exec(url.pathname);
      if (coaching && request.method === 'POST' && coaching[3] === '/check') {
        json(response, 200, await tutor.check(coaching[1], coaching[2], await body(request))); return;
      }
      // Voice transport reads acknowledged context but never writes the progress ledger.
      // It must not compete with background saving or hold its lock during provider I/O.
      if (coaching && request.method === 'POST' && (coaching[3] === '/voice' || coaching[3] === '/live')) {
        if (coaching[3] === '/live') {
          const started = Date.now();
          console.info('Coteacher live startup: request received.');
          try {
            const value = await tutor.live(coaching[1], coaching[2], await body(request), live);
            console.info(`Coteacher live startup: connection returned (${Date.now() - started} ms).`);
            json(response, 200, value);
          } catch (error) {
            console.error('Coteacher live startup failed:', (error as Error).message.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 500));
            throw error;
          }
        } else json(response, 200, await tutor.transcribe(coaching[1], coaching[2], await body(request)));
        return;
      }
      if (coaching && request.method === 'POST') {
        if (returning.has(coaching[1])) { json(response, 409, { error: 'Learning records are saving. Retry shortly.' }); return; }
        returning.add(coaching[1]);
        try { json(response, 200, coaching[3] === '/live' ? await tutor.live(coaching[1], coaching[2], await body(request), live) : coaching[3] === '/consent' ? await tutor.disable(coaching[1], coaching[2], await body(request)) : coaching[3] === '/voice' ? await tutor.transcribe(coaching[1], coaching[2], await body(request)) : await tutor.submit(coaching[1], coaching[2], await body(request), url.searchParams.get('speech') === 'defer')); }
        finally { returning.delete(coaching[1]); }
        return;
      }
      if (coaching && !coaching[3] && request.method === 'GET') {
        const complete = await tutor.current(coaching[1], coaching[2]);
        const state = url.searchParams.get('speech') === 'defer' ? deferTutorSpeech(complete) : complete;
        const etag = '"' + createHash('sha256').update(JSON.stringify(state)).digest('hex') + '"';
        response.setHeader('ETag', etag);
        if (request.headers['if-none-match'] === etag) { response.writeHead(304, { 'Cache-Control': 'no-store' }); response.end(); return; }
        json(response, 200, await encryptPayload(state, profiles.find(profile => profile.id === coaching[1])!.pin)); return;
      }
      if (url.pathname === '/api/health' && request.method === 'GET') { json(response, 200, { service: 'local-recorded-lessons', cloud: false }); return; }
      if (url.pathname === '/api/progress' && request.method === 'GET') {
        if (request.headers.authorization !== `Bearer ${publishToken}`) { json(response, 403, { error: 'Teacher access is required.' }); return; }
        json(response, 200, { records: await progress.overview(), ...await store.publicationInfo(), simulated: true }); return;
      }
      const answers = /^\/api\/progress\/answers\/(student-[a-f0-9]{8,32})$/.exec(url.pathname);
      const learning = /^\/api\/progress\/(student-[a-f0-9]{8,32})\/([a-zA-Z0-9_-]{1,100})$/.exec(url.pathname);
      if (answers && request.method === 'POST') {
        if (request.headers.authorization !== `Bearer ${publishToken}`) { json(response, 403, { error: 'Teacher access is required.' }); return; }
        if (returning.has(answers[1])) { json(response, 409, { error: 'Learning records are saving. Retry shortly.' }); return; }
        returning.add(answers[1]);
        try { json(response, 200, await progress.answer(answers[1], await body(request))); } finally { returning.delete(answers[1]); }
        return;
      }
      if (learning && request.method === 'POST') {
        if (returning.has(learning[1])) { json(response, 409, { error: 'Learning records are saving. Retry shortly.' }); return; }
        returning.add(learning[1]);
        try { json(response, 200, await progress.receive(learning[1], learning[2], await body(request))); } finally { returning.delete(learning[1]); }
        return;
      }
      if (learning && request.method === 'GET') { const value = await progress.returned(learning[1], learning[2]); json(response, value ? 200 : 404, value ?? { error: 'No learning records received yet.' }); return; }
      if (url.pathname === '/api/lessons' && request.method === 'POST') {
        if (request.headers.authorization !== `Bearer ${publishToken}`) { json(response, 403, { error: 'Teacher publication is required.' }); return; }
        if (publishing) { json(response, 409, { error: 'A publication is already saving. Try again.' }); return; }
        publishing = true;
        try { const value = await body(request); json(response, 201, await store.publish(value.lessons)); }
        finally { publishing = false; }
        return;
      }
      const personal = /^\/api\/lessons\/(student-[a-f0-9]{8,32})$/.exec(url.pathname);
      if (personal && request.method === 'GET') {
        const value = store.packageFor(personal[1]);
        json(response, value ? 200 : 404, value ?? { error: 'No recorded teacher lesson is published yet. Ask your teacher to record, review and publish it.' }); return;
      }
      const media = /^\/api\/recorded-lessons\/([a-f0-9]{64})\/audio$/.exec(url.pathname);
      if (media && (request.method === 'GET' || request.method === 'HEAD')) {
        const bytes = await store.audioFor(media[1], url.searchParams.get('key') ?? '');
        if (!bytes) { json(response, 404, { error: 'This recording is not available. Reopen the published lesson.' }); return; }
        let start = 0, end = bytes.length - 1, status = 200;
        if (request.headers.range) {
          const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
          if (!range || (!range[1] && !range[2])) { response.writeHead(416, { 'Content-Range': `bytes */${bytes.length}` }); response.end(); return; }
          if (range[1]) { start = Number(range[1]); if (range[2]) end = Math.min(end, Number(range[2])); }
          else start = Math.max(0, bytes.length - Number(range[2]));
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= bytes.length) { response.writeHead(416, { 'Content-Range': `bytes */${bytes.length}` }); response.end(); return; }
          status = 206;
        }
        response.writeHead(status, { 'Content-Type': 'audio/ogg', 'Content-Length': end - start + 1,
          'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${bytes.length}` } : {}) });
        response.end(request.method === 'HEAD' ? undefined : bytes.subarray(start, end + 1)); return;
      }
      json(response, 404, { error: 'Unknown lesson service endpoint.' });
    } catch (error) { if (!response.headersSent) json(response, request.method === 'POST' ? 400 : 503, { error: (error as Error).message }); else response.destroy(); }
  });
  let maintaining=false;const maintenance=setInterval(()=>{if(maintaining)return;maintaining=true;void maintainSchool(schoolRepository,privateStorage).catch(()=>{console.warn('School maintenance will retry superseded-object cleanup.');}).finally(()=>{maintaining=false;});},3600_000);maintenance.unref();
  server.once('close',()=>clearInterval(maintenance));
  server.once('close', () => { if (schoolRepository instanceof PostgresSchoolRepository) void schoolRepository.close(); });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, publicMode ? '0.0.0.0' : '127.0.0.1', resolve); });
  return server;
}
