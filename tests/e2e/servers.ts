import { LocalSchoolRepository, SchoolService } from '../../delivery/school-store';
import { preview, type PreviewServer } from 'vite';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { startDelivery } from '../../delivery/server';
import { MockTutor } from '../tutor-fixture';
import { seedLearning } from './seed-learning';

/** In-process servers avoid Windows child-process tree termination during cleanup. */
export default async function setup() {
  // Browser acceptance uses isolated fictional repositories and injected providers.
  // Never read project env files or inherit configured external storage/identity.
  process.env.COTEACHER_TEST_NO_ENV_FILES='true';
  for(const key of ['COTEACHER_SCHOOL_DATABASE_URL','COTEACHER_SUPABASE_URL','COTEACHER_SUPABASE_PUBLISHABLE_KEY','COTEACHER_R2_ENDPOINT','COTEACHER_GUARDIAN_MAIL_KEY','COTEACHER_GUARDIAN_MAIL_FROM','OPENAI_API_KEY'])delete process.env[key];
  process.env.COTEACHER_PUBLIC='false';process.env.COTEACHER_ALLOW_REAL_STUDENTS='false';process.env.COTEACHER_TEXT_PROVIDER='none';process.env.COTEACHER_GUARDIAN_MAIL_MODE='simulated';
  // Match seedLearning's public fictional key; never use a configured real key.
  process.env.COTEACHER_TUTOR_STORAGE_KEY='simulated-local-school-tutor-key-v1';process.env.COTEACHER_PUBLISH_TOKEN='local-demo-publisher';
  const servers: PreviewServer[] = [];
  const deliveryFolder = resolve('test-results', 'delivery-' + randomUUID());
  const schools = new SchoolService(new LocalSchoolRepository(deliveryFolder));
  const operator = await schools.register({ name: 'Fictional reviewer', email: 'reviewer@fictional.invalid', password: 'fictional-reviewer-password', role: 'owner', simulated: true });
  await schools.repository.transaction(s => { s.accounts.find(a => a.id === operator.id)!.role = 'operator'; });
  if(process.env.COTEACHER_TEST_TUTOR==='mock')await seedLearning(schools,deliveryFolder);
  process.env.COTEACHER_SCHOOL_URL='http://127.0.0.1:4275';
  process.env.COTEACHER_TEACHER_URL='http://127.0.0.1:4274';
  process.env.COTEACHER_STUDENT_URL='http://127.0.0.1:4273';
  const delivery = await startDelivery(deliveryFolder, 0, 'local-demo-publisher', process.env.COTEACHER_TEST_TUTOR === 'mock' ? new MockTutor() : undefined);
  const address = delivery.address();
  if (!address || typeof address === 'string') throw new Error('Lesson service did not start');
  process.env.COTEACHER_DELIVERY_URL = `http://127.0.0.1:${address.port}`;
  try {
    for (const [app, port] of [['student', 4273], ['teacher', 4274], ['school', 4275]] as const) {
      servers.push(await preview({ root: resolve('apps', app), configFile: resolve('apps',app,'vite.config.ts'),envDir:false,
        build: process.env.COTEACHER_E2E_BUILD_ROOT ? { outDir: resolve(process.env.COTEACHER_E2E_BUILD_ROOT, app) } : undefined,
        preview: { host: '127.0.0.1', port, strictPort: true, open: false } }));
    }
  } catch (e) { for (const server of servers) server.httpServer.close(); delivery.close(); throw e; }
  return async () => {
    await Promise.all(servers.map(server => new Promise<void>((resolve, reject) => {
      if ('closeAllConnections' in server.httpServer) server.httpServer.closeAllConnections();
      server.httpServer.close(error => error ? reject(error) : resolve());
    })));
    delivery.closeAllConnections();
    await new Promise<void>((resolve, reject) => delivery.close(error => error ? reject(error) : resolve()));
  };
}
