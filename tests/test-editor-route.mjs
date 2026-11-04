import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { editorRoute } from '../engine/editor-route.js';
assert.equal(editorRoute(new URLSearchParams()), 'landing');
for (const view of [
  'aquarium',
  'single',
  'all',
  'tiers',
  'mix',
  'studio',
  'preview',
  'old',
  'legacy',
  'unknown',
]) {
  for (const state of [false, true])
    assert.equal(editorRoute(new URLSearchParams({ view }), state), 'aquarium');
}
assert.equal(editorRoute(new URLSearchParams({ view: 'door' }), true), 'landing');
assert.equal(editorRoute(new URLSearchParams({ c: 'creature' })), 'aquarium');
const html = await readFile(new URL('../engine/index.html', import.meta.url), 'utf8');
assert(
  !/id=["'](?:old|studio|preview|gallery|all|tiers|mix)["']/.test(html),
  'no control may restore an old interface',
);
for (const file of [
  'aquarium.html',
  'app.js',
  'features.js',
  'studio.js',
  'gallery.js',
  'specimen-viewer.js',
]) {
  await assert.rejects(access(new URL('../engine/' + file, import.meta.url)));
}
console.log(
  'OK: current and old URLs open only landing or current aquarium; no legacy UI files or buttons.',
);
