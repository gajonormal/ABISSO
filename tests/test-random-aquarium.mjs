import assert from 'node:assert/strict';
import { randomAquarium } from '../engine/random-aquarium.js';
import { fishGene, sanitize, SPECIES } from '../engine/genes.js';
const { aquariumCapacity } = await import('../engine/ecology.js');
const themes = new Set(),
  formats = new Set(),
  decorations = new Set(),
  species = new Set(),
  lighting = new Set();
for (let i = 0; i < 150; i++) {
  const state = randomAquarium('maré ' + i);
  assert.deepEqual(state, randomAquarium('maré ' + i));
  assert.deepEqual(state, sanitize(state));
  assert(
    state.fish.length >= Math.ceil(aquariumCapacity(state.environment.format) * 0.65) &&
      state.fish.length <= aquariumCapacity(state.environment.format),
  );
  assert.equal(new Set(state.fish.map((f) => f.id)).size, state.fish.length);
  assert(state.fish.every((f) => f.id < state.nextId));
  themes.add(state.environment.theme);
  formats.add(state.environment.format);
  decorations.add(state.environment.decoration);
  lighting.add(state.night);
  state.fish.forEach((f) => species.add(f.species));
  assert.deepEqual(
    JSON.parse(
      decodeURIComponent(escape(atob(btoa(unescape(encodeURIComponent(JSON.stringify(state))))))),
    ),
    state,
  );
}
assert.equal(themes.size, 3);
assert.equal(formats.size, 3);
assert.equal(decorations.size, 4);
assert.equal(species.size, Object.keys(SPECIES).length);
assert.equal(lighting.size, 2);
const creature = fishGene('personal', 87432, 'betta');
const solo = randomAquarium('personal', { inhabitant: creature });
assert.equal(solo.fish.length, 1);
assert.deepEqual(solo.fish[0], creature);
assert(solo.nextId > creature.id);
const companions = randomAquarium('friends', { inhabitant: creature, count: 9 });
assert.equal(companions.fish.length, Math.min(9, aquariumCapacity(companions.environment.format)));
assert.deepEqual(companions.fish[0], creature);
assert.equal(new Set(companions.fish.map((f) => f.id)).size, companions.fish.length);
console.log(
  'OK: 150 reproducible random aquariums; ' +
    species.size +
    ' species; every habitat/format/decoration; solo creatures and companions; Unicode aquarium sharing.',
);

assert(aquariumCapacity('tall') < aquariumCapacity('classic'));
assert(aquariumCapacity('classic') < aquariumCapacity('panorama'));
