import assert from 'node:assert/strict';
import { aquariumLink } from '../engine/aquarium-link.js';
import { specimen } from '../engine/specimens.js';
import { randomAquarium } from '../engine/random-aquarium.js';
import { sanitize } from '../engine/genes.js';

for (const seed of ['abisso', 'João 🐟', '4148744030']) {
  const gene = specimen(seed);
  const state = randomAquarium(seed, { inhabitant: gene });
  const link = new URL(aquariumLink(state), 'https://abisso.example/');
  const decoded = sanitize(
    JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(link.hash.slice(3)), (value) => value.charCodeAt(0)),
      ),
    ),
  );
  assert.equal(link.pathname, '/engine/index.html');
  assert.equal(link.searchParams.get('view'), 'aquarium');
  assert.equal(link.searchParams.get('selected'), String(gene.id));
  assert.deepEqual(decoded, state);
}
const habitat = randomAquarium('vários habitantes', { count: 8 });
const link = new URL(
  aquariumLink(habitat, { view: 'aquarium', selected: habitat.fish[3].id }),
  'https://abisso.example/',
);
assert.equal(link.searchParams.get('selected'), String(habitat.fish[3].id));
assert.equal(link.searchParams.get('view'), 'aquarium');
console.log('Landing → editor: criatura, habitat, seleção e caracteres Unicode preservados.');

assert.equal(
  new URL(aquariumLink(habitat, { view: 'studio' }), 'https://abisso.example').searchParams.get(
    'view',
  ),
  'aquarium',
);
