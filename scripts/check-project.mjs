import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const ignored = new Set(['.git', 'node_modules', 'vendor', 'dist']);
async function walk(directory) {
  const files = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {

    if (ignored.has(entry.name)) continue;

    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(file)));

    else files.push(file);
  }

  return files;
}

const files = await walk(root),
  dependencies = new Map();
const sourceFiles = files.filter((file) => /\.(?:js|mjs|html|css)$/.test(file));

let references = 0;

for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8'),
    links = [];

  if (/\.(?:js|mjs)$/.test(file)) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });

    for (const pattern of [
      /\b(?:import|export)\s+(?:[^;'"()]*?\s+from\s*)?['"]([^'"]+)['"]/g,
      /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
      /\bnew URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g,
    ])

      for (const match of source.matchAll(pattern))
        if (match[1].startsWith('.')) links.push(match[1]);
  }

  if (file.endsWith('.html')) {
    const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);

    if (new Set(ids).size !== ids.length)
      throw Error('Duplicate HTML id: ' + path.relative(root, file));

    for (const match of source.matchAll(/\b(?:src|href)="([^"]+)"/g)) links.push(match[1]);
  }

  if (file.endsWith('.css'))

    for (const match of source.matchAll(/url\(\s*['"]?([^'"\s)]+)/g)) links.push(match[1]);
  const resolved = [];

  for (const link of links) {

    if (/^(?:[a-z]+:|\/\/|#)/i.test(link)) continue;
    const pathname = decodeURIComponent(link.split(/[?#]/)[0]);
    let target = pathname.startsWith('/')
      ? path.join(root, pathname)
      : path.resolve(path.dirname(file), pathname);

    if (pathname.endsWith('/') && file.endsWith('.html')) target = path.join(target, 'index.html');
    try {
      await access(target);
    } catch {
      throw Error(path.relative(root, file) + ': missing local reference ' + link);
    }

    resolved.push(target);

    references++;

  }
  dependencies.set(file, resolved);
}

const reachable = new Set();

function visit(file) {

  if (reachable.has(file)) return;
  reachable.add(file);

  for (const next of dependencies.get(file) || []) visit(next);
}
visit(path.join(root, 'index.html'));
visit(path.join(root, 'engine', 'index.html'));

const unused = files.filter(
  (file) =>
    path.dirname(file) === path.join(root, 'engine') &&
    /\.(?:js|html|css)$/.test(file) &&
    !reachable.has(file),
);

if (unused.length)

  throw Error(
    'Unreferenced engine files: ' + unused.map((file) => path.relative(root, file)).join(', '),
  );
  
console.log(
  'OK: ' +
    sourceFiles.length +
    ' source files; JavaScript syntax, unique HTML ids, ' +
    references +
    ' local references; no unreferenced engine files.',
);
