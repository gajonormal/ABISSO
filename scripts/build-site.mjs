import { cp, lstat, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const output = path.join(root, 'dist');
const existing = await lstat(output).catch((error) => {
  if (error.code !== 'ENOENT') throw error;
  return null;
});
if (existing) {
  if (existing.isSymbolicLink() || !existing.isDirectory() || (await realpath(output)) !== output) {
    throw Error('Refusing to replace an unexpected dist path.');
  }
  if (path.relative(root, output) !== 'dist') throw Error('Output must remain inside the project.');
  await rm(output, { recursive: true });
}
await mkdir(output);

const rootFiles = [
  'index.html',
  'abisso.js',
  'abisso.css',
  'landing-boot.js',
  'environment.js',
  'environment.css',
  'fishing-scrollbar.js',
  'controls.css',
  'cursor.js',
  'cursor.css',
];
for (const file of rootFiles) await cp(path.join(root, file), path.join(output, file));
for (const directory of ['engine', 'assets']) {
  await cp(path.join(root, directory), path.join(output, directory), {
    recursive: true,
    filter: async (source) => {
      const info = await lstat(source);
      if (info.isSymbolicLink()) throw Error('Site assets must not contain symbolic links.');
      return !path.basename(source).startsWith('.');
    },
  });
}
await writeFile(path.join(output, '.nojekyll'), '');
console.log('Static site ready in dist/.');
