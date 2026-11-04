import assert from 'node:assert/strict';
import {
  fishGene,
  sanitize,
  EYES,
  MOUTHS,
  FINS,
  compatibleEyeStyles,
  compatibleMouthStyles,
  compatibleFinStyles,
} from '../engine/genes.js';
import { createFish, initialMotion, steerFish } from '../engine/fish.js';
import { Box3, Vector3 } from '../engine/vendor/three.module.js';
let models = 0;
for (const eyeStyle of Object.keys(EYES))
  for (const mouthStyle of Object.keys(MOUTHS))
    for (const finStyle of Object.keys(FINS)) {
      const gene = {
        ...fishGene('morphology', models, 'goldfish'),
        eyeStyle,
        mouthStyle,
        finStyle,
        mutation: 'eyeStalks',
        mutation2: 'frill',
        scale: 1.6,
        mouthSize: 1.3,
      };
      assert.deepEqual(
        sanitize({ version: 2, seed: 'morphology', nextId: models + 1, fish: [gene] }).fish[0],
        gene,
      );
      const fish = createFish(gene);
      fish.motion = initialMotion('morphology', gene);
      let stalks = 0,
        facets = 0;
      fish.root.traverse((mesh) => {
        if (mesh.userData.eyeStalk) stalks++;
        if (mesh.userData.eyeFacet) facets++;
      });
      assert.equal(stalks, 2);
      assert.equal(facets, eyeStyle === 'compound' ? 14 : 0);
      for (let i = 0; i < 120; i++) steerFish(fish, [fish], i / 30, 1 / 30);
      fish.root.traverse((mesh) => {
        for (const v of mesh.geometry?.attributes.position.array || []) assert(Number.isFinite(v));
      });
      const box = new Box3().setFromObject(fish.root, true);
      assert(
        box.min.x > -3.5 &&
          box.max.x < 3.5 &&
          box.min.z > -2.15 &&
          box.max.z < 2.15 &&
          box.min.y > 0.16 &&
          box.max.y < 3.7,
      );
      const parts = [];
      fish.root.traverse((p) => {
        if (p.userData.integratedMouth) parts.push(p);
      });
      const skin = parts.find((p) => p.userData.openHead),
        throat = parts.find((p) => p.userData.mouthCavity);
      for (let i = 0; i < 25; i++)
        for (const axis of ['getX', 'getY', 'getZ'])
          assert(
            Math.abs(
              skin.geometry.attributes.position[axis](i) -
                throat.geometry.attributes.position[axis](i),
            ) < 1e-7,
          );
      fish.dispose();
      models++;
    }
for (const species of ['gar', 'blobfish', 'flyingfish', 'shrimp', 'jellyfish'])
  for (let i = 0; i < 20; i++) {
    const gene = fishGene('generated-faces', i, species);
    assert(compatibleEyeStyles(species).includes(gene.eyeStyle));
    assert(compatibleMouthStyles(species).includes(gene.mouthStyle));
    assert(compatibleFinStyles(species).includes(gene.finStyle));
  }
const legacy = { ...fishGene('legacy-face', 0, 'goldfish') };
delete legacy.eyeStyle;
delete legacy.mouthStyle;
delete legacy.finStyle;
const restored = sanitize({ version: 2, seed: 'legacy-face', nextId: 1, fish: [legacy] }).fish[0];
assert.equal(restored.eyeStyle, 'round');
assert.equal(restored.mouthStyle, 'native');
assert.equal(restored.finStyle, 'native');
for (const species of ['crab', 'snail', 'ray'])
  for (const eyeStyle of Object.keys(EYES)) {
    const gene = {
        ...fishGene('eye-rigs', 0, species),
        eyeStyle,
        mutation: 'eyeStalks',
        mutation2: 'none',
      },
      fish = createFish(gene);
    fish.motion = initialMotion('eye-rigs', gene);
    for (let i = 0; i < 120; i++) steerFish(fish, [fish], i / 30, 1 / 30);
    const lenses = [],
      facets = [];
    fish.root.traverse((p) => {
      if (p.userData.compoundLens) lenses.push(p);
      if (p.userData.eyeFacet) facets.push(p);
    });
    if (eyeStyle === 'compound') {
      assert.equal(lenses.length, 2);
      assert.equal(facets.length, 14);
      if (species !== 'ray')
        for (const lens of lenses)
          assert.notEqual(
            lens.parent,
            fish.root,
            'Invertebrate eye variants must stay in their animated stalk groups',
          );
      assert(
        new Set(
          facets.map((p) =>
            new Box3()
              .setFromObject(p)
              .getCenter(new Vector3())
              .toArray()
              .map((v) => v.toFixed(6))
              .join(','),
          ),
        ).size >= 7,
        'Compound facets need a valid basis, including upward-facing eyes',
      );
    }
    fish.dispose();
  }
for (const species of [
  'goldfish',
  'angel',
  'puffer',
  'angler',
  'blobfish',
  'flyingfish',
  'eel',
  'catfish',
])
  for (const mouthStyle of Object.keys(MOUTHS)) {
    let smallFront;
    for (const mouthSize of [0.7, 1.3]) {
      const gene = {
        ...fishGene('curved-mouth', 0, species),
        mouthStyle,
        mouthSize,
        mutation: 'none',
        mutation2: 'none',
      };
      const fish = createFish(gene);
      fish.motion = initialMotion('curved-mouth', gene);
      const parts = [];
      fish.root.traverse((p) => parts.push(p));
      const skin = parts.find((p) => p.userData.openHead),
        cavity = parts.find((p) => p.userData.mouthCavity);
      assert(!parts.some((p) => p.userData.mouthLip), 'lips must belong to the continuous skin');
      const rim = Array.from({ length: 25 }, (_, i) => skin.geometry.attributes.position.getX(i));
      const min = Math.min(...rim),
        max = Math.max(...rim);
      assert(max - min > 1e-6, 'the aperture must follow the curved cheek instead of a plane');
      assert(
        cavity.geometry.attributes.position.getX(cavity.geometry.attributes.position.count - 1) <
          min,
        'throat must remain behind the entire curved rim',
      );
      if (mouthSize === 0.7) smallFront = min;
      else assert(min <= smallFront, 'larger apertures must retreat into the cheek');
      for (const time of [0, 0.7, 2.1, 4]) {
        steerFish(fish, [fish], time, 1 / 30);
        for (let i = 0; i < 25; i++)
          for (const axis of ['getX', 'getY', 'getZ'])
            assert(
              Math.abs(
                skin.geometry.attributes.position[axis](i) -
                  cavity.geometry.attributes.position[axis](i),
              ) < 1e-7,
              'curved mouth must stay welded while opening and swimming',
            );
      }
      fish.dispose();
    }
  }
console.log(
  `OK: ${models} combinações de olhos/bocas/barbatanas; 80 bocas curvas em tamanhos extremos; ligação animada; geração e migração.`,
);
