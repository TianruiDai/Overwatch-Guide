import {
  readFile,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import {
  fileURLToPath
} from 'node:url';
import {
  normalizeLibraryRole
} from '../shared/domain.mjs';
import {
  humanizeCoachCard
} from '../shared/humanize-coach.mjs';
import {
  normalizeCardNaming
} from '../shared/card-title.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, 'shared', 'knowledge.json');
const sourcesPath = path.join(root, 'shared', 'knowledge-sources.json');

function cleanCard(raw) {
  if (!raw?.id || !raw?.title || !raw?.principle || !raw?.application) return null;
  const role = normalizeLibraryRole(raw.role) || '综合';
  const card = humanizeCoachCard({
    id: raw.id,
    title: raw.title,
    author: raw.author || '未署名',
    sourceTitle: raw.sourceTitle || raw.title,
    url: raw.url || '',
    role,
    heroes: Array.isArray(raw.heroes) ? raw.heroes : [],
    maps: Array.isArray(raw.maps) ? raw.maps : undefined,
    stage: raw.stage || '团战',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    principle: raw.principle,
    application: raw.application,
    kind: raw.kind || (role === '版本' ? '官方机制' : '观摩索引')
  });
  if (!card.maps?.length) delete card.maps;
  return normalizeCardNaming(card);
}

const [base, sources] = await Promise.all([
  readFile(target, 'utf8').then(JSON.parse),
  readFile(sourcesPath, 'utf8').then(JSON.parse)
]);
if (!Array.isArray(base) || !Array.isArray(sources)) throw new Error('knowledge files must be arrays');

const byId = new Map();
for (const card of base) {
  const migrated = cleanCard({
    ...card,
    role: normalizeLibraryRole(card.role) || card.role
  });
  if (migrated) {
    if (migrated.id === 'guxue-winston-matchups') {
      migrated.author = '孤雪 · OA-Guxue8';
    }
    byId.set(migrated.id, migrated);
  }
}
let added = 0;
for (const src of sources) {
  const card = cleanCard(src);
  if (!card) continue;
  if (byId.has(card.id)) {
    byId.set(card.id, {
      ...byId.get(card.id),
      ...card
    });
  } else {
    byId.set(card.id, card);
    added++;
  }
}

const merged = [...byId.values()].sort((a, b) => String(a.id).localeCompare(String(b.id), 'en'));
await writeFile(target, JSON.stringify(merged, null, 2) + '\n');
console.log('Seeded knowledge.json: ' + merged.length + ' cards (' + added + ' new from sources)');
