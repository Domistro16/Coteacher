import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';

const checking = process.argv.includes('--check');
for (const name of ['lesson-package', 'progress-record', 'encrypted-transfer', 'player-state']) {
  const schemaUrl = new URL('../schemas/' + name + '.schema.json', import.meta.url);
  const outputUrl = new URL('../packages/shared/src/generated/' + name + '.ts', import.meta.url);
  const schema = JSON.parse(await readFile(schemaUrl, 'utf8'));
  const output = await compile(schema, schema.title, {
    cwd: fileURLToPath(new URL('../schemas/', import.meta.url)),
    enableConstEnums: false,
    bannerComment: '/* Generated from schemas/' + name + '.schema.json. Do not edit; run npm run generate:types. */',
    $refOptions: { resolve: { http: false, file: false } },
  });
  if (checking) {
    const current = await readFile(outputUrl, 'utf8').catch(() => '');
    if (current !== output) {
      throw new Error(name + ' types are stale. Run npm run generate:types.');
    }
  } else {
    await mkdir(new URL('.', outputUrl), { recursive: true });
    await writeFile(outputUrl, output);
  }
}
console.log(checking ? 'Generated types are current.' : 'Generated shared types.');
