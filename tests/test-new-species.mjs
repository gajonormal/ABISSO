import assert from 'node:assert/strict';
import { fishGene, sanitize, aquarium } from '../engine/genes.js';
import { createFish, initialMotion, steerFish } from '../engine/fish.js';
import { Box3, Vector3 } from '../engine/vendor/three.module.js';
for (const species of ['seahorse', 'swordfish', 'monkfish'])
  for (const mutation2 of ['none', 'splitTail', 'spines'])
    for (const proportion of [0.82, 1.18]) {
      const gene = {
        ...fishGene('new-anatomies', 0, species),
        bodyHeight: proportion,
        bodyWidth: proportion,
        mutation: 'none',
        mutation2,
      };
      assert.deepEqual(sanitize({ ...aquarium('new-anatomies', 1), fish: [gene] }).fish[0], gene);
      const fish = createFish(gene);
      fish.motion = initialMotion('new-anatomies', gene);
      const parts = [];
      fish.root.traverse((p) => parts.push(p));
      if (species !== 'seahorse')
        assert.equal(
          parts.filter((p) => p.userData.predatorTail).length,
          mutation2 === 'splitTail' ? 2 : 1,
        );
      if (species === 'seahorse') {
        assert(parts.some((p) => p.userData.seahorseBody));
        assert(parts.some((p) => p.userData.seahorseSnout));
        const tails = parts.filter((p) => p.userData.seahorseTail);
        assert.equal(tails.length, mutation2 === 'splitTail' ? 2 : 1);
        for (const time of [0, 1, 3]) {
          steerFish(fish, [fish], time, 1 / 30);
          for (const tail of tails) {
            const a = tail.geometry.attributes.position,
              rest = tail.userData.seahorseRest;
            for (let i = 0; i < tail.userData.seahorseTailRoots * 3; i++)
              assert(
                Math.abs(a.array[i] - rest[i]) < 1e-7,
                'The coiled tail must stay attached to the trunk',
              );
          }
        }
        const fins = parts.filter((p) => p.userData.seahorseFin),
          tailTips = [],
          finTips = [];
        for (let frame = 0; frame < 60; frame++) {
          steerFish(fish, [fish], frame / 30, 1 / 30);
          const tail = tails[0].geometry.attributes.position;
          tailTips.push(tail.getX(tail.count - 1));
          for (const fin of fins) {
            const { weights, rest } = fin.userData.seahorseFin,
              a = fin.geometry.attributes.position;
            for (let i = 0; i < a.count; i++)
              if (weights[i] === 0)
                for (let k = 0; k < 3; k++)
                  assert(
                    Math.abs(a.array[i * 3 + k] - rest[i * 3 + k]) < 1e-7,
                    'Fin strokes must preserve their embedded roots',
                  );
          }
          const dorsal = fins.find((p) => p.userData.seahorseFin.side === 0).geometry.attributes
            .position;
          finTips.push(dorsal.getZ(dorsal.count - 1));
        }
        assert(
          Math.max(...tailTips) - Math.min(...tailTips) > 0.025,
          'The coil must visibly curl and extend during swimming',
        );
        assert(
          Math.max(...finTips) - Math.min(...finTips) > 0.035,
          'Dorsal propulsion must be visible at pixel-art scale',
        );
      }
      if (species === 'swordfish') {
        const bill = parts.find((p) => p.userData.swordBill),
          head = parts.find((p) => p.userData.openHead);
        assert(bill);
        const a = bill.geometry.attributes.position,
          b = head.geometry.attributes.position;
        assert(
          Math.max(...Array.from({ length: a.count }, (_, i) => a.getX(i))) >
            Math.max(...Array.from({ length: b.count }, (_, i) => b.getX(i))) * 1.7,
          'The sword must extend well beyond the head',
        );
      }
      if (species === 'monkfish') {
        assert(parts.some((p) => p.userData.monkLure));
        assert.equal(parts.filter((p) => p.userData.monkPectoral).length, 2);
        const skin = parts.find((p) => p.userData.openHead),
          cavity = parts.find((p) => p.userData.mouthCavity);
        for (let i = 0; i < 25; i++)
          for (const axis of ['getX', 'getY', 'getZ'])
            assert(
              Math.abs(
                skin.geometry.attributes.position[axis](i) -
                  cavity.geometry.attributes.position[axis](i),
              ) < 1e-7,
              'The broad mouth must remain part of the skin',
            );
        skin.geometry.computeBoundingBox();
        const size = skin.geometry.boundingBox.getSize(new Vector3());
        assert(size.z > size.y * 1.8, 'Monkfish head must be broad and flattened');
      }
      for (let i = 0; i < 900; i++) {
        steerFish(fish, [fish], i / 30, 1 / 30);
        if (i % 90 === 0) {
          const b = new Box3().setFromObject(fish.root);
          assert(b.min.y > 0.16 && b.max.y < 3.7);
          assert(b.min.x > -3.5 && b.max.x < 3.5);
          assert(b.min.z > -2.15 && b.max.z < 2.15);
          fish.root.traverse((p) => {
            if (p.geometry) assert(p.geometry.attributes.position.array.every(Number.isFinite));
          });
        }
      }
      fish.dispose();
    }
console.log(
  'OK: 18 new anatomy/mutation variants; generation, mouth and tail joins, sword silhouette and swimming bounds.',
);
