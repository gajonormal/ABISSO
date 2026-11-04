import assert from 'node:assert/strict';
import {
  aquarium,
  fishGene,
  sanitize,
  FINISHES,
  SPECIES,
  TRAITS,
  compatibleShapes,
  compatibleTails,
} from '../engine/genes.js';
import { createFish, initialMotion, steerFish } from '../engine/fish.js';
import { Box3, Vector3 } from '../engine/vendor/three.module.js';

const species = Object.keys(SPECIES);
for (const kind of species)
  for (let id = 0; id < 22; id++) {
    const gene = fishGene('repeatable', id, kind);
    assert.deepEqual(gene, fishGene('repeatable', id, kind));
    assert(compatibleShapes(kind).includes(gene.shape));
    assert(compatibleTails(kind).includes(gene.tail));
    for (const [key, [lo, hi]] of Object.entries(TRAITS))
      assert(gene[key] >= lo && gene[key] <= hi);
    assert.deepEqual(
      sanitize({ ...aquarium('generated', 1), fish: [gene], nextId: 100 }).fish[0],
      gene,
    );
  }
const oldFish = fishGene('legacy', 0, 'goldfish');
for (const key of [...Object.keys(TRAITS), 'finish', 'temperament', 'eyeColor'])
  delete oldFish[key];
const migrated = sanitize({ ...aquarium('legacy', 1), fish: [oldFish] }).fish[0];
assert.equal(migrated.bodyHeight, 1);
assert.equal(migrated.color, oldFish.color);
assert.equal(migrated.finSize, oldFish.finSize);
function geometry(gene) {
  const f = createFish(gene),
    positions = [];
  f.root.traverse((o) => {
    if (o.geometry) positions.push(Array.from(o.geometry.attributes.position.array));
  });
  f.dispose();
  return JSON.stringify(positions);
}
const base = fishGene('expression', 0, 'goldfish');
assert.notEqual(geometry({ ...base, shape: 'oval' }), geometry({ ...base, shape: 'round' }));
assert.notEqual(geometry({ ...base, tail: 'fan' }), geometry({ ...base, tail: 'fork' }));
assert.notEqual(geometry({ ...base, tail: 'fan' }), geometry({ ...base, tail: 'feather' }));
let checked = 0;
for (const kind of species)
  for (const finish of Object.keys(FINISHES)) {
    const gene = {
      ...fishGene('limits', checked, kind),
      finish,
      scale: 1.6,
      finSize: 1.4,
      bodyRatio: 1.25,
    };
    for (const [key, [, hi]] of Object.entries(TRAITS)) gene[key] = hi;
    const f = createFish(gene);
    f.motion = initialMotion('limits', gene);
    assert(f.clearance.horizontal < 2.05);
    assert(f.clearance.vertical < 1.69);
    if (kind === 'jellyfish') {
      const dome = f.root.children[0];
      assert(dome.material.isShaderMaterial);
      assert.equal(dome.material.uniforms.uTime, f.material.uniforms.uTime);
      assert.equal(dome.material.uniforms.uFinish, f.material.uniforms.uFinish);
    }
    for (let frame = 0; frame < 1800; frame++) {
      steerFish(f, [f], frame / 30, 1 / 30, new Vector3(1, 1.5, 0));
      if (frame % 120 === 0) {
        const box = new Box3().setFromObject(f.root, kind === 'shrimp');
        assert(box.min.x > -3.5 && box.max.x < 3.5);
        assert(box.min.z > -2.15 && box.max.z < 2.15);
        assert(
          box.min.y > 0.16 &&
            box.max.y < (f.gene.species === 'flyingfish' && f.motion.flight ? 5.1 : 3.7),
          `${kind} ${finish}: y=${box.min.y}..${box.max.y}`,
        );
      }
    }
    f.dispose();
    checked++;
  }
const positions = [];
for (const temperament of ['curious', 'shy', 'social', 'territorial', 'calm']) {
  const g = { ...base, temperament },
    f = createFish(g);
  f.motion = initialMotion('personality', g);
  const cursor = f.motion.position.clone().add(new Vector3(0.4, 0, 0));
  for (let i = 0; i < 120; i++) steerFish(f, [f], i / 30, 1 / 30, cursor);
  positions.push(
    f.motion.position
      .toArray()
      .map((v) => v.toFixed(4))
      .join(','),
  );
  f.dispose();
}
assert(new Set(positions).size >= 4);
console.log(
  `OK: ${species.length ** 2} genomas reproduzíveis; anatomia compatível; genes visíveis; migração; ${checked} acabamentos/anatomias extremas a nadar durante 60s; personalidades.`,
);
