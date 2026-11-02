import { build } from 'vite';
import { resolve, relative, isAbsolute } from 'node:path';
// No project env files, configured services or normal app outputs are used.
const [kind, outputArg] = process.argv.slice(2);
if (!['account', 'demo'].includes(kind) || !outputArg)
  throw new Error('Usage: node scripts/build-isolated-acceptance.mjs account|demo .task-tmp/<new-output-folder>');
const workspace = resolve('.task-tmp'), output = resolve(outputArg), inside = relative(workspace, output);
if (!inside || inside.startsWith('..') || isAbsolute(inside))
  throw new Error('Use a dedicated output folder inside this workspace .task-tmp directory.');
process.env.COTEACHER_TEST_NO_ENV_FILES = 'true';
for (const app of ['student', 'teacher', 'school']) {
  const root = resolve('apps', app);
  await build({ root, configFile: resolve(root, 'vite.config.ts'), envDir: false,
    mode: kind === 'demo' && app !== 'school' ? 'demo' : 'production',
    build: { outDir: relative(root, resolve(output, app)), emptyOutDir: false } });
}
console.log('Isolated acceptance build: ' + output);
