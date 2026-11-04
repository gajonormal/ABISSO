import assert from 'node:assert/strict';
import { fishGene, sanitize, SPECIES } from '../engine/genes.js';
import { createFish, initialMotion, steerFish } from '../engine/fish.js';
import { animateUnusualFish, softBlobPoint } from '../engine/unusual-fish.js';
import { Box3 } from '../engine/vendor/three.module.js';

for (const species of ['gar', 'blobfish', 'flyingfish']) {
  assert(Object.hasOwn(SPECIES, species));
  const gene = { ...fishGene('new-anatomy', 0, species), mutation: 'none', mutation2: 'none' };
  assert.deepEqual(
    sanitize({ version: 2, seed: 'new-anatomy', nextId: 1, fish: [gene] }).fish[0],
    gene,
  );
  const fish = createFish(gene);
  fish.motion = initialMotion('new-anatomy', gene);
  const parts = [];
  fish.root.traverse((part) => parts.push(part));
  if (species === 'gar') {
    const body = parts.find((p) => p.userData.openHead),
      box = new Box3().setFromObject(body);
    assert(
      box.max.x > Math.abs(box.min.x) * 1.5,
      'Gar must have an elongated snout in the skin geometry',
    );
  }
  if (species === 'blobfish') assert(parts.some((p) => p.userData.blobNose));
  if (species === 'flyingfish')
    assert.equal(parts.filter((p) => p.userData.wingMembrane).length, 2);
  fish.dispose();
}

for (const format of [
  { x: 3.42, z: 2.05, top: 3.6, floor: 0.18 },
  { x: 2.67, z: 2.6, top: 3.6, floor: 0.18 },
  { x: 3.87, z: 1.6, top: 2.675, floor: 0.135 },
]) {
  const gene = {
    ...fishGene('flying-events', 1, 'flyingfish'),
    mutation: 'none',
    mutation2: 'none',
    temperament: 'calm',
  };
  const fish = createFish(gene);
  fish.motion = initialMotion('flying-events', gene);
  fish.tankBounds = format;
  let flights = 0,
    landings = 0,
    wasFlying = false,
    clearedWater = false;
  for (let i = 0; i < 18000; i++) {
    const previous = fish.motion.position.clone();
    steerFish(fish, [fish], i / 30, 1 / 30);
    const flying = Boolean(fish.motion.flight);
    if (flying && !wasFlying) flights++;
    if (!flying && wasFlying) {
      landings++;
      assert(fish.motion.position.y <= format.top - fish.clearance.vertical + 1e-6);
    }
    if (i < 2700) assert(!flying, 'Leaps must not be frequent');
    const box = new Box3().setFromObject(fish.root, true);
    assert(
      box.min.x >= -format.x - 0.01 && box.max.x <= format.x + 0.01,
      'Keep the airborne fish inside the side walls',
    );
    assert(box.min.z >= -format.z - 0.01 && box.max.z <= format.z + 0.01);
    assert(box.min.y > format.floor - 0.01);
    if (box.min.y > format.top + 0.1) clearedWater = true;
    if (i > 1)
      assert(
        fish.motion.position.distanceTo(previous) < 0.1,
        'Flight and landing must remain continuous',
      );
    wasFlying = flying;
  }
  assert(flights >= 2 && flights <= 6);
  assert(landings >= 2);
  assert(clearedWater, 'A leap must take the whole body above the water');
  fish.dispose();
}
console.log(
  'OK: três anatomias; focinho integrado; saltos raros, contínuos e com regresso em três formatos.',
);

assert(!Object.hasOwn(SPECIES, 'tripod'));
const retired = { ...fishGene('retired-tripod', 0, 'gar'), species: 'tripod' };
assert.equal(
  sanitize({ version: 2, seed: 'retired-tripod', nextId: 1, fish: [retired] }).fish[0].species,
  'gar',
);
const flyer = createFish({
  ...fishGene('hinges', 0, 'flyingfish'),
  mutation: 'none',
  mutation2: 'none',
});
flyer.motion = initialMotion('hinges', flyer.gene);
for (const spread of [0.2, 0.5, 1]) {
  flyer.motion.wingSpread = spread;
  flyer.root.traverse((mesh) => {
    if (!mesh.userData.flyingWing) return;
    animateUnusualFish(mesh, flyer, 2);
    assert.deepEqual(mesh.position.toArray(), [0, 0, 0]);
    assert.deepEqual(mesh.scale.toArray(), [1, 1, 1]);
    if (mesh.userData.wingMembrane) {
      const a = mesh.geometry.attributes.position,
        h = mesh.userData.wingHinge;
      for (let i = 0; i < 13; i++)
        assert(
          Math.hypot(a.getX(i) - h.x, a.getY(i) - h.y, a.getZ(i) - h.z) < 1e-7,
          'The wing attachment must stay fixed when folding',
        );
    }
  });
}
flyer.dispose();
assert.notDeepEqual(softBlobPoint(0.2, -0.1, 0.2, 0, 1), softBlobPoint(0.2, -0.1, 0.2, 2, 1));
const gelHeights = Array.from({ length: 120 }, (_, i) => softBlobPoint(0, 0.25, 0.1, i / 30, 0)[1]);
assert(
  Math.max(...gelHeights) - Math.min(...gelHeights) > 0.055,
  'Blobfish body must visibly squash and stretch while swimming',
);
const blob = createFish({
  ...fishGene('soft-body', 0, 'blobfish'),
  mutation: 'none',
  mutation2: 'none',
});
blob.motion = initialMotion('soft-body', blob.gene);
let parts = [];
blob.root.traverse((p) => {
  if (p.userData.integratedMouth) parts.push(p);
});
for (const time of [0, 1, 3]) {
  steerFish(blob, [blob], time, 1 / 30);
  const skin = parts.find((p) => p.userData.openHead),
    cavity = parts.find((p) => p.userData.mouthCavity);
  for (let i = 0; i < 25; i++)
    for (const axis of ['getX', 'getY', 'getZ'])
      assert(
        Math.abs(
          skin.geometry.attributes.position[axis](i) - cavity.geometry.attributes.position[axis](i),
        ) < 1e-7,
        'Gelatinous deformation must preserve the mouth seam',
      );
}
blob.dispose();

for (const shape of ['round', 'slender', 'diamond'])
  for (const mouthSize of [0.7, 1.3]) {
    const fish = createFish({
      ...fishGene('blob-attachments', 0, 'blobfish'),
      shape,
      mouthSize,
      mutation: 'none',
      mutation2: 'none',
    });
    fish.motion = initialMotion('blob-attachments', fish.gene);
    const fins = [];
    let skin,
      cavity,
      hoops = 0;
    fish.root.traverse((p) => {
      if (p.userData.blobFin) fins.push(p);
      if (p.userData.openHead) skin = p;
      if (p.userData.mouthCavity) cavity = p;
      if (p.userData.mouthLip) hoops++;
    });
    assert.equal(fins.length, 2);
    assert.equal(hoops, 0, 'Blobfish lip must be its skin boundary, not an external hoop');
    assert.equal(
      cavity.material.uniforms.uTime,
      skin.material.uniforms.uTime,
      'Throat and skin must render at the same animation time',
    );
    for (const fin of fins) {
      const side = fin.userData.finSide,
        anchor = fin.userData.finAttachment;
      assert(Number.isFinite(anchor.z) && Math.abs(anchor.z) > 0.05);
      const rest = fin.userData.softRest;
      const outward = Math.max(
        ...Array.from({ length: rest.length / 3 }, (_, i) => side * (rest[i * 3 + 2] - anchor.z)),
      );
      assert(outward > 0.07, 'The fin must protrude outside the skin');
      for (const time of [0, 1, 3]) {
        steerFish(fish, [fish], time, 1 / 30);
        const displacedAnchor = softBlobPoint(...anchor.toArray(), time, fish.gene.phase);
        const a = fin.geometry.attributes.position;
        assert(
          Math.max(
            ...Array.from({ length: a.count }, (_, i) => side * (a.getZ(i) - displacedAnchor[2])),
          ) > 0.06,
          'Gelatinous motion must preserve the external fin',
        );
        for (let i = 0; i < 25; i++)
          for (const axis of ['getX', 'getY', 'getZ'])
            assert(
              Math.abs(
                skin.geometry.attributes.position[axis](i) -
                  cavity.geometry.attributes.position[axis](i),
              ) < 1e-7,
            );
      }
    }
    fish.dispose();
  }
