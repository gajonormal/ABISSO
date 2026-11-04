import assert from 'node:assert/strict';
import { aquarium, fishGene, sanitize, EFFECTS, SPECIES } from '../engine/genes.js';
import { createFish, initialMotion, steerFish } from '../engine/fish.js';
import { Box3 } from '../engine/vendor/three.module.js';

assert.deepEqual(aquarium('recife'), aquarium('recife'));
assert.deepEqual(sanitize(aquarium('maré', 32)), aquarium('maré', 32));

const state = aquarium('teste', 7);
assert.equal(new Set(state.fish.map((f) => f.id)).size, 7);
assert.throws(() => sanitize({ ...state, fish: [state.fish[0], state.fish[0]] }));

let tested = 0;
for (const species of Object.keys(SPECIES)) {
  for (const effect of Object.keys(EFFECTS)) {
    for (const scale of [0.65, 1.6]) {
      const gene = { ...fishGene('teste', tested, species), effect, scale };
      const fish = createFish(gene);
      fish.motion = initialMotion('teste', gene);
      fish.root.traverse((o) => {
        for (const key of ['position', 'normal']) {
          const values = o.geometry?.attributes[key]?.array;
          if (values) for (const value of values) assert(Number.isFinite(value));
        }
      });
      for (let i = 0; i < 6000; i++) {
        steerFish(fish, [fish], i / 30, 1 / 30);
        assert(fish.root.position.toArray().every(Number.isFinite));
        if (i % 300 === 0) {
          const box = new Box3().setFromObject(fish.root, species === 'shrimp');
          assert(box.min.x > -3.5 && box.max.x < 3.5);
          assert(box.min.z > -2.15 && box.max.z < 2.15);
          assert(
            box.min.y > 0.16 &&
              box.max.y < (fish?.gene?.species === 'flyingfish' && fish.motion.flight ? 5.1 : 3.7),
            `${species} ${effect} scale=${scale}: y=${box.min.y}..${box.max.y}`,
          );
        }
      }
      fish.dispose();
      tested++;
    }
  }
}

const school = aquarium('recife', 32).fish.map((g) => {
  const f = createFish(g);
  f.motion = initialMotion('recife', g);
  return f;
});

for (let frame = 0; frame < 1800; frame++) {
  for (const f of school) steerFish(f, school, frame / 30, 1 / 30);
}
for (const f of school) {
  assert(f.root.position.toArray().every(Number.isFinite));
  f.dispose();
}

assert.equal(new Set(aquarium('recife', 12).fish.map((f) => f.species)).size, 12);

const old = {
  ...aquarium('recife', 4),
  version: 1,
  fish: aquarium('recife', 4).fish.map(({ species, finSize, bodyRatio, eyeSize, ...f }) => f),
};
assert.equal(sanitize(old).version, 2);
assert.equal(sanitize(old).fish.length, 4);

console.log(
  `OK: ${tested} combinacoes (${Object.keys(SPECIES).length} especies, 8 efeitos/mutacoes, 2 tamanhos); 200s movimento e cardume de 32 a 60s; integridade total.`,
);
