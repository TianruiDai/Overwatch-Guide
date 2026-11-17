import {
  readFile,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import {
  fileURLToPath
} from 'node:url';
import {
  normalizeCardNaming
} from '../shared/card-title.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, 'shared', 'knowledge.json');
const incomingPath = process.argv[2];
if (!incomingPath) {
  console.error('用法: node scripts/knowledge-pack.mjs path/to/knowledge-pack.json');
  process.exit(1);
}
const [base, pack] = await Promise.all([
  readFile(target, 'utf8').then(JSON.parse),
  readFile(path.resolve(incomingPath), 'utf8').then(JSON.parse)
]);
if (!Array.isArray(base) || !Array.isArray(pack)) throw new Error('知识包必须是卡片数组。');
const byId = new Map();
const byUrl = new Map();
for (const card of [...base, ...pack]) {
  if (!card?.id || !card?.title || !card?.principle || !card?.application) continue;
  const clean = normalizeCardNaming({
    ...card
  });
  delete clean.excerpt;
  if (byId.has(clean.id)) {
    byId.set(clean.id, {
      ...byId.get(clean.id),
      ...clean
    });
    continue;
  }
  if (clean.url && byUrl.has(clean.url) && byUrl.get(clean.url).title === clean.title) {
    const prev = byUrl.get(clean.url);
    byId.set(prev.id, {
      ...prev,
      ...clean,
      id: prev.id
    });
    continue;
  }
  byId.set(clean.id, clean);
  if (clean.url) byUrl.set(clean.url, clean);
}
const merged = [...byId.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
await writeFile(target, JSON.stringify(merged, null, 2) + '\n');
console.log('Merged ' + pack.length + ' incoming cards into ' + merged.length + ' total at shared/knowledge.json');
