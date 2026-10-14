import { loadEnv, type ProxyOptions } from 'vite';
import { resolve } from 'node:path';

export function deliveryProxy(mode: string, teacher = false): Record<string, ProxyOptions> {
  const env = { ...loadEnv(mode, resolve(import.meta.dirname, '..'), ''), ...process.env };
  return { '/api': { target: env.COTEACHER_DELIVERY_URL ?? 'http://127.0.0.1:8787', changeOrigin: true,
    ...(teacher ? { configure(proxy) { proxy.on('proxyReq', (request, incoming) => {
      const publication = incoming.method === 'POST' && incoming.url === '/api/lessons';
      const overview = incoming.method === 'GET' && incoming.url === '/api/progress';
      const answers = incoming.method === 'POST' && incoming.url?.startsWith('/api/progress/answers/');
      const tutoring = incoming.url === '/api/tutor/overview' || incoming.method === 'POST' && incoming.url?.startsWith('/api/tutor/flag/');
      if (publication || overview || answers || tutoring) request.setHeader('Authorization', `Bearer ${env.COTEACHER_PUBLISH_TOKEN ?? 'local-demo-publisher'}`);
    }); } } : {}),
  } };
}
