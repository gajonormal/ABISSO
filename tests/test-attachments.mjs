import assert from 'node:assert/strict';
import { fishGene, SHELLS } from '../engine/genes.js';
import { createFish, initialMotion, steerFish } from '../engine/fish.js';
import { Box3, Vector3, Ray } from '../engine/vendor/three.module.js';

function model(species, traits) {
  const gene = {
    ...fishGene('anatomical-joins', 0, species),
    mutation: 'none',
    mutation2: 'none',
    ...traits,
  };
  const fish = createFish(gene);
  fish.motion = initialMotion('anatomical-joins', gene);
  return fish;
}
function insidePosterior(point, skin) {
  const ray = new Ray(point, new Vector3(-1, 0.037, 0.011).normalize()),
    a = skin.geometry.attributes.position,
    index = skin.geometry.index;
  const va = new Vector3(),
    vb = new Vector3(),
    vc = new Vector3(),
    hit = new Vector3(),
    distances = [];
  for (let i = 0; i < index.count; i += 3) {
    va.fromBufferAttribute(a, index.getX(i));
    vb.fromBufferAttribute(a, index.getX(i + 1));
    vc.fromBufferAttribute(a, index.getX(i + 2));
    if (ray.intersectTriangle(va, vb, vc, false, hit)) distances.push(hit.distanceTo(point));
  }
  distances.sort((a, b) => a - b);
  return distances.filter((d, i) => i === 0 || d - distances[i - 1] > 1e-6).length % 2 === 1;
}
let checked = 0;
for (const shellType of Object.keys(SHELLS))
  for (const shellSpire of [0.65, 1.5])
    for (const mutation of ['none', 'splitTail']) {
      const fish = model('snail', {
        shellType,
        shellSpire,
        mutation,
        bodyHeight: 0.8,
        bodyWidth: 1.2,
      });
      const shells = fish.root.children.filter((p) => p.userData.snailShell),
        mantle = fish.root.children.find((p) => p.userData.snailMantle);
      assert.equal(shells.length, mutation === 'splitTail' ? 2 : 1);
      for (const time of [0, 0.7, 2, 4]) {
        steerFish(fish, [fish], time, 1 / 30);
        const socket = new Box3().setFromObject(mantle);
        for (const shell of shells) {
          const bounds = new Box3().setFromObject(shell);
          assert(
            bounds.min.y < socket.max.y - 0.002,
            'The shell base must remain embedded in the mantle',
          );
          assert(bounds.intersectsBox(socket), 'Every shell must touch its fleshy socket');
        }
      }
      if (shellType === 'spiral')
        assert(
          shells[0].children.some((p) => p.geometry?.type === 'SphereGeometry'),
          'The spiral needs a solid whorl',
        );
      fish.dispose();
      checked++;
    }
for (const shape of ['round', 'slender', 'diamond'])
  for (const tail of ['round', 'fork', 'fan', 'feather'])
    for (const mutation2 of ['none', 'splitTail']) {
      const fish = model('blobfish', {
        shape,
        tail,
        mutation2,
        bodyWidth: 1.3,
        bodyHeight: 0.8,
        tailLength: 1.4,
        finSize: 1.3,
      });
      const tails = fish.root.children.filter((p) => p.userData.blobTail),
        skin = fish.root.children.find((p) => p.userData.openHead);
      assert.equal(tails.length, mutation2 === 'splitTail' ? 2 : 1);
      for (const time of [0, 0.8, 2.4]) {
        steerFish(fish, [fish], time, 1 / 30);
        for (const tail of tails) {
          const a = tail.geometry.attributes.position;
          for (let i = 0; i < tail.userData.tailRootCount; i++)
            assert(
              insidePosterior(new Vector3().fromBufferAttribute(a, i), skin),
              'Both animated tail roots must stay inside the actual skin',
            );
        }
      }
      fish.dispose();
      checked++;
    }
for (const bodyWidth of [0.65, 1.4])
  for (const bodyHeight of [0.7, 1.4])
    for (const variant of ['ordinary', 'veil'])
      for (const mutation2 of ['none', 'splitTail']) {
        const fish = model('jellyfish', {
          bodyWidth,
          bodyHeight,
          variant,
          mutation2,
          tailLength: 1.4,
        });
        const bell = fish.root.children.find((p) => p.userData.jellyBell),
          a = bell.geometry.attributes.position;
        const tentacles = fish.root.children.filter(
          (p) => p.userData.jellyTentacle && !p.userData.jellyOral,
        );
        assert.equal(
          tentacles.length,
          (variant === 'veil' ? 12 : 8) + (mutation2 === 'splitTail' ? 4 : 0),
        );
        for (const tentacle of tentacles) {
          assert.equal(tentacle.material.uniforms.uTime, bell.material.uniforms.uTime);
          assert.equal(tentacle.material.uniforms.uSwimType, bell.material.uniforms.uSwimType);
          assert.deepEqual(tentacle.position.toArray(), [0, 0, 0]);
          assert.deepEqual(bell.position.toArray(), [0, 0, 0]);
          const anchor = tentacle.userData.jellyAnchor,
            angle = tentacle.userData.jellyAngle,
            row = tentacle.userData.jellyBellRow;
          // All standard tentacle angles coincide with explicit bell vertices.
          const column = (angle / (Math.PI * 2)) * 32;
          if (Math.abs(column - Math.round(column)) < 1e-6)
            assert(
              anchor.distanceTo(
                new Vector3().fromBufferAttribute(a, row * 33 + Math.round(column)),
              ) < 1e-7,
              'Tentacle origin must match the bell surface, including width variations',
            );
          const root = new Vector3(),
            p = tentacle.geometry.attributes.position,
            n = tentacle.userData.jellyRootCount - 1;
          for (let i = 0; i < n; i++) root.add(new Vector3().fromBufferAttribute(p, i));
          root.divideScalar(n);
          assert(
            root.distanceTo(anchor) < 1e-7,
            'The tentacle centre must start on its attachment',
          );
        }
        for (const time of [0, 1, 3]) {
          steerFish(fish, [fish], time, 1 / 30);
          fish.root.traverse((p) => {
            if (p.geometry) assert(p.geometry.attributes.position.array.every(Number.isFinite));
          });
        }
        fish.dispose();
        checked++;
      }
console.log(
  'OK: ' +
    checked +
    ' anatomy variants; shell sockets, animated blobfish tail roots and jellyfish bell attachments.',
);
