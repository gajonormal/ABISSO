import assert from 'node:assert/strict';
import { fishGene } from '../engine/genes.js';
import { createFish } from '../engine/fish.js';
import { animateFishMouth } from '../engine/mouth.js';

let count = 0;
for (const shape of ['oval', 'round', 'slender', 'diamond', 'radiant'])
  for (const mouthSize of [0.65, 1, 1.5])
    for (const mouthStyle of ['native', 'round', 'wide']) {
      const gene = {
        ...fishGene('gar-seam', 0, 'gar'),
        shape,
        mouthSize,
        mouthStyle,
        bodyHeight: 1.3,
        bodyWidth: 0.75,
        mutation: 'none',
        mutation2: 'none',
      };
      const fish = createFish(gene),
        parts = [];
      fish.root.traverse((p) => parts.push(p));
      const body = parts.find((p) => p.userData.openHead),
        jaw = parts.find((p) => p.userData.garSurface?.lower);
      const { rows, segments } = body.userData.garSurface,
        p = body.geometry.attributes.position;
      const x = fish.material.uniforms.uLength.value,
        y = fish.material.uniforms.uHeight.value;
      // The old shoulder jumped from half a jaw section to a full torso ring.
      // Measure the actual upper silhouette through that transition.
      for (let i = 1; i <= rows; i++) {
        const a = (i - 1) * (segments + 1),
          b = i * (segments + 1),
          s = p.getX(b) / x;
        if (s > 0.2 && s < 1.5)
          assert(
            Math.abs(p.getY(b) - p.getY(a)) < y * 0.07,
            'Abrupt step between cheek and rostrum',
          );
      }
      assert(p.getX(p.count - 1) > x * 1.8, 'Retain the characteristic long rostrum');
      const rest = jaw.geometry.attributes.position.array.slice();
      let previous;
      for (const time of [0, 0.3, 1, 2]) {
        for (const part of parts) animateFishMouth(part, fish, time);
        const a = jaw.geometry.attributes.position;
        for (let j = 0; j <= jaw.userData.garSurface.segments; j++)
          for (let k = 0; k < 3; k++)
            assert.equal(
              a.array[j * 3 + k],
              rest[j * 3 + k],
              'Mandible hinge must remain buried and fixed',
            );
        const tip = a.getY(a.count - 1);
        if (previous !== undefined)
          assert(Math.abs(tip - previous) < y * 0.2, 'Jaw motion must be continuous');
        previous = tip;
        assert(a.array.every(Number.isFinite));
      }
      assert.notEqual(
        jaw.geometry.attributes.position.getY(jaw.geometry.attributes.position.count - 1),
        rest.at(-2),
        'Lower jaw must breathe',
      );
      for (const tooth of parts.filter((p) => p.userData.mouthTooth))
        for (const key of ['uTime', 'uPhase', 'uSwimPace', 'uLength', 'uMutation'])
          assert.equal(
            tooth.material.uniforms[key],
            fish.material.uniforms[key],
            'Teeth must share the jaw swim field',
          );
      fish.dispose();
      count++;
    }
console.log(
  `OK: ${count} gar anatomies; continuous cheek/rostrum profile; fixed jaw hinges; animated mandible and teeth.`,
);
