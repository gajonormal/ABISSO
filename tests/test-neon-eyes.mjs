import assert from 'node:assert/strict';
import { createFish } from '../engine/fish.js';
import { fishGene } from '../engine/genes.js';
let cases = 0;
for (const bodyWidth of [0.65, 1.4])
  for (const bodyHeight of [0.7, 1.4])
    for (const style of ['round', 'oval', 'cross', 'ring', 'compound'])
      for (const mutation of ['none', 'twist', 'melt', 'eyeStalks']) {
        const gene = {
          ...fishGene('neon-eyes', 0, 'neon'),
          bodyWidth,
          bodyHeight,
          eyeStyle: style,
          mutation,
          mutation2: 'none',
        };
        const fish = createFish(gene),
          eyes = [];
        fish.root.traverse((mesh) => {
          if (mesh.userData.neonEye) eyes.push(mesh);
        });
        assert(eyes.length >= 6, 'both complete eyes must be present');
        for (const eye of eyes) {
          assert(
            eye.userData.neonEyeBound || eye.userData.mutationBind,
            'every styled eye must follow the head',
          );
          assert.equal(
            eye.material.uniforms.uTime,
            fish.material.uniforms.uTime,
            'eye and body animation clocks must match',
          );
          assert.equal(
            eye.material.uniforms.uMutation,
            fish.material.uniforms.uMutation,
            'eyes must follow twist and melt',
          );
          assert.equal(eye.material.vertexShader, fish.material.vertexShader);
          assert(eye.geometry.attributes.position.array.every(Number.isFinite));
        }
        fish.dispose();
        cases++;
      }
console.log(
  'OK: ' + cases + ' neon anatomies; both eyes and all styles attached to animated head.',
);
