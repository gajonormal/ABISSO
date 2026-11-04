import assert from 'node:assert/strict';
import { specimen, encodeSpecimen, decodeSpecimen } from '../engine/specimens.js';
import { sanitizeCollection } from '../engine/collection.js';
import { SPECIES } from '../engine/genes.js';
const kinds = Object.keys(SPECIES),
  seen = new Set();
for (let id = 0; id < 289; id++) {
  const gene = specimen('maré 🐟', id, kinds[id % kinds.length]);
  assert.deepEqual(gene, specimen('maré 🐟', id, kinds[id % kinds.length]));
  seen.add(gene.species);
  assert.deepEqual(decodeSpecimen(encodeSpecimen('maré 🐟', gene)), { seed: 'maré 🐟', gene });
}
assert.equal(seen.size, kinds.length);
const gene = specimen('saved'),
  entry = { key: 'saved:0', seed: 'saved', gene };
for (const type of ['mare-collection', 'abisso-collection']) {
  const collection = sanitizeCollection({ type, version: 1, fish: [entry] });
  assert.deepEqual(collection.fish[0], entry);
  assert.deepEqual(sanitizeCollection(JSON.parse(JSON.stringify(collection))), collection);
}
assert.throws(() => decodeSpecimen('not-json'));
assert.throws(() => decodeSpecimen('x'.repeat(30001)));
console.log(
  'OK: 289 reproducible creatures, all 22 species, Unicode sharing and saved collections.',
);
