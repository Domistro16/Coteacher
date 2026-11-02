import { resolve } from 'node:path';
import { startDelivery } from './server';
import { existsSync } from 'node:fs';

for (const file of ['.env.local', '.env']) {
  if (existsSync(resolve(file))) process.loadEnvFile(resolve(file));
}

const port = Number(process.env.PORT ?? process.env.COTEACHER_DELIVERY_PORT ?? 8787);
const server = await startDelivery(resolve(process.env.COTEACHER_DELIVERY_DIR ?? '.coteacher-delivery'), port,
  process.env.COTEACHER_PUBLISH_TOKEN ?? 'local-demo-publisher');
console.log(process.env.COTEACHER_PUBLIC === 'true' ? `Coteacher authenticated service listening on port ${port}.` : `Coteacher development service: http://127.0.0.1:${port}. Awaiting reviewed teacher publication.`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => process.exit(0)));
