import { preview, type PreviewServer } from 'vite';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { startDelivery } from '../../delivery/server';
import { MockTutor } from '../tutor-fixture';

/** In-process servers avoid Windows child-process tree termination during cleanup. */
export default async function setup() {
  const servers: PreviewServer[] = [];
  const delivery = await startDelivery(resolve('test-results', 'delivery-' + randomUUID()), 0, 'local-demo-publisher', process.env.COTEACHER_TEST_TUTOR === 'mock' ? new MockTutor() : undefined);
  const address = delivery.address();
  if (!address || typeof address === 'string') throw new Error('Lesson service did not start');
  process.env.COTEACHER_DELIVERY_URL = `http://127.0.0.1:${address.port}`;
  try {
    for (const [app, port] of [['student', 4273], ['teacher', 4274]] as const) {
      servers.push(await preview({ root: resolve('apps', app), configFile: resolve('apps',app,'vite.config.ts'),
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
