import assert from 'node:assert/strict';
import { fishGene, aquarium, sanitize, FINISHES, finishIndex } from '../engine/genes.js';
import { RARE_FINISHES, RARE_FINISH_CHANCE } from '../engine/rare-finishes.js';
import { createFish } from '../engine/fish.js';
assert.equal(Object.keys(RARE_FINISHES).length, 11);
assert(!Object.hasOwn(FINISHES, 'livingInk'));
assert(!Object.hasOwn(FINISHES, 'ink'));
assert.equal(finishIndex('hologram'), 9);
assert.equal(finishIndex('radioactive'), 12);
assert.equal(finishIndex('storm'), 22);
const oldInk = { ...fishGene('old-ink', 0), finish: 'ink', effect: 'cosmic' };
assert.equal(sanitize({ ...aquarium('old-ink', 1), fish: [oldInk] }).fish[0].finish, 'matte');
const counts = Object.fromEntries(Object.keys(RARE_FINISHES).map((key) => [key, 0]));
let total = 0;
for (let i = 0; i < 20000; i++) {
  const gene = fishGene('rare-frequency', i, 'neon');
  if (Object.hasOwn(counts, gene.finish)) {
    counts[gene.finish]++;
    total++;
  }
}
assert(total / 20000 > RARE_FINISH_CHANCE - 0.006 && total / 20000 < RARE_FINISH_CHANCE + 0.006);
for (const [finish, count] of Object.entries(counts)) {
  assert(count > 0, finish);
  const gene = { ...fishGene('rare-save', 0, 'angler'), finish };
  assert.equal(sanitize({ ...aquarium('rare-save', 1), fish: [gene] }).fish[0].finish, finish);
  const fish = createFish(gene);
  assert.equal(fish.material.uniforms.uFinish.value, finishIndex(finish));
  assert(fish.material.fragmentShader.includes('Tempestade eléctrica'));
  fish.dispose();
}
console.log(
  `OK: 11 rare skins; ${total}/20000 generated (${(total / 200).toFixed(2)}%); deterministic generation and save/load.`,
);
