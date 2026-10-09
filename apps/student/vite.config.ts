import { defineConfig } from 'vite';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

function offlineShell() {
  let output = '';
  return { name: 'coteacher-offline-shell', apply: 'build' as const,
    configResolved(config: { root: string; build: { outDir: string } }) { output = join(config.root, config.build.outDir); },
    closeBundle() {
      const walk = (folder: string): string[] => readdirSync(join(output, folder), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(folder + entry.name + '/') : [folder + entry.name]);
      const files = walk('').filter(f => f !== 'sw.js');
      const version = createHash('sha256').update(files.map(f => readFileSync(join(output, f))).join('')).digest('hex').slice(0, 16);
      writeFileSync(join(output, 'sw.js'), `const CACHE='coteacher-${version}';
const FILES=${JSON.stringify(files.map(f => './' + f))};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('coteacher-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(caches.open(CACHE).then(async cache=>{const hit=await cache.match(event.request,{ignoreVary:true});if(hit)return hit;if(event.request.mode==='navigate')return cache.match('./index.html',{ignoreVary:true});return fetch(event.request)}))});`);
    },
  };
}

export default defineConfig({
  plugins: [offlineShell()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
