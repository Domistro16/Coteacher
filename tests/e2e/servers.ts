import { preview, type PreviewServer } from 'vite';
import { resolve } from 'node:path';

/** In-process servers avoid Windows child-process tree termination during cleanup. */
export default async function setup() {
  const servers: PreviewServer[] = [];
  try {
    for (const [app, port] of [['student', 4273], ['teacher', 4274]] as const) {
      servers.push(await preview({ root: resolve('apps', app), configFile: resolve('apps',app,'vite.config.ts'),
        preview: { host: '127.0.0.1', port, strictPort: true, open: false } }));
    }
  } catch (e) { for (const server of servers) server.httpServer.close(); throw e; }
  return async () => {
    await Promise.all(servers.map(server => new Promise<void>((resolve, reject) => {
      if ('closeAllConnections' in server.httpServer) server.httpServer.closeAllConnections();
      server.httpServer.close(error => error ? reject(error) : resolve());
    })));
  };
}
