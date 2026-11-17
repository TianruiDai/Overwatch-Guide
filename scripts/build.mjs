import {
  build
} from 'esbuild';
import {
  zipSync
} from 'fflate';
import {
  createHash
} from 'node:crypto';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import {
  fileURLToPath
} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.zip': 'application/zip'
};
async function tree(relative) {
  const entries = await readdir(path.join(root, relative), {
    withFileTypes: true
  });
  const names = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const name = relative + '/' + entry.name;
    if (entry.isDirectory()) names.push(...await tree(name));
    else if (entry.isFile()) names.push(name);
  }
  return names;
}
const lists = await Promise.all(['public', 'shared', 'server', 'scripts', 'tests', 'docs'].map(tree));
const files = [...lists.flat(), 'package.json', 'package-lock.json', 'README.md', '.env.example', '.gitignore'];
const sources = {},
  assets = {};

function addAsset(name, bytes) {
  assets[name] = {
    type: mime[path.extname(name)] || 'application/octet-stream',
    etag: '"' + createHash('sha256').update(bytes).digest('hex').slice(0, 24) + '"',
    data: Buffer.from(bytes).toString('base64')
  };
}
for (const name of files) {
  const bytes = await readFile(path.join(root, name));
  sources['overwatch-guide/' + name] = bytes;
  if (name.startsWith('public/')) addAsset('/' + name.slice(7), bytes);
  else if (name.startsWith('shared/')) addAsset('/' + name, bytes);
}
const sourceZip = zipSync(sources, {
  level: 6,
  mtime: new Date('2024-01-01T00:00:00Z')
});
addAsset('/downloads/overwatch-guide.zip', sourceZip);
await rm(dist, {
  recursive: true,
  force: true
});
await mkdir(path.join(dist, 'downloads'), {
  recursive: true
});
await writeFile(path.join(dist, 'downloads', 'overwatch-guide.zip'), sourceZip);
await build({
  entryPoints: [path.join(root, 'server/worker.mjs')],
  outfile: path.join(dist, 'server/index.js'),
  bundle: true,
  minify: false,
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  plugins: [{
    name: 'site-assets',
    setup(builder) {
      builder.onResolve({
        filter: /^#site-assets$/
      }, () => ({
        path: 'assets',
        namespace: 'embedded'
      }));
      builder.onLoad({
        filter: /.*/,
        namespace: 'embedded'
      }, () => ({
        contents: 'export default ' + JSON.stringify(assets),
        loader: 'js'
      }));
    }
  }]
});
const hosting = path.join(root, '.openai/hosting.json');
if (await access(hosting).then(() => true, () => false)) {
  await mkdir(path.join(dist, '.openai'), {
    recursive: true
  });
  await copyFile(hosting, path.join(dist, '.openai/hosting.json'));
}
console.log('Built Worker and portable source archive (' + Object.keys(assets).length + ' routes).');
