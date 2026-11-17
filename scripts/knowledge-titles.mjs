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
const files = [
  path.join(root, 'shared', 'knowledge.json'),
  path.join(root, 'shared', 'knowledge-sources.json')
];

function rewriteList(list) {
  let renamed = 0;
  let toGeneral = 0;
  const out = list.map(card => {
    const next = normalizeCardNaming(card);
    if (next.role === '综合' && card.role !== '综合' && card.role !== '版本') toGeneral++;
    else if (next.title !== card.title) renamed++;
    return next;
  });
  return {
    out,
    renamed,
    toGeneral
  };
}

for (const file of files) {
  const list = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(list)) throw new Error(file + ' must be an array');
  const {
    out,
    renamed,
    toGeneral
  } = rewriteList(list);
  await writeFile(file, JSON.stringify(out, null, 2) + '\n');
  console.log(path.relative(root, file) + ': renamed ' + renamed + ', moved to 综合 ' + toGeneral);
}
