import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Server } from 'node:http';
import { preview, type PreviewServer } from 'vite';
import { startDelivery } from '../delivery/server';

// One process serves the existing built apps and their same-origin API proxies.
// Credentials stay in the backend environment and are never printed here.
for (const file of ['.env.local', '.env']) {
  if (existsSync(resolve(file))) process.loadEnvFile(resolve(file));
}
const apps = [
  { name: 'school', port: 5175 },
  { name: 'teacher', port: 5174 },
  { name: 'student', port: 5173 },
] as const;
for (const app of apps) {
  if (!existsSync(resolve('apps', app.name, 'dist/index.html'))) {
    throw new Error('Build the three account apps first with npm run build.');
  }
}
if (process.env.COTEACHER_PUBLIC === 'true') {
  throw new Error('This loopback HTTP launcher is for local fictional-data verification. Use HTTPS hosting for public mode.');
}
const frontends: PreviewServer[] = [];
let backend: Server | undefined;
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await Promise.all([...frontends.map(frontend => frontend.httpServer), ...(backend ? [backend] : [])].map(server => new Promise<void>(resolve => {
    if ('closeAllConnections' in server) server.closeAllConnections();
    server.close(() => resolve());
  })));
}
try {
  const port = Number(process.env.COTEACHER_DELIVERY_PORT ?? 8787);
  backend = await startDelivery(resolve(process.env.COTEACHER_DELIVERY_DIR ?? '.coteacher-delivery'), port,
    process.env.COTEACHER_PUBLISH_TOKEN ?? 'local-demo-publisher');
  process.env.COTEACHER_DELIVERY_URL = `http://127.0.0.1:${port}`;
  for (const app of apps) {
    frontends.push(await preview({ root: resolve('apps', app.name),
      configFile: resolve('apps', app.name, 'vite.config.ts'),
      preview: { host: '127.0.0.1', port: app.port, strictPort: true, open: false } }));
    console.log(`${app.name}: http://127.0.0.1:${app.port}`);
  }
  console.log('Local account apps ready. Press Ctrl+C to stop all four servers.');
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void close().then(() => process.exit(0)); });
  }
} catch (error) {
  await close();
  const code = (error as NodeJS.ErrnoException).code;
  console.error(`Local startup failed${code && /^[A-Z0-9_]+$/.test(code) ? ' (' + code + ')' : ''}. Check provider settings and whether ports 5173, 5174, 5175 and the backend port are available.`);
  process.exit(1);
}
