import assert from 'node:assert/strict';
import { createFish } from '../engine/fish.js';
import { fishGene } from '../engine/genes.js';
for (let seed = 0; seed < 24; seed++) {
  const gene = fishGene('neon-skin-' + seed, 0, 'neon');
  const fish = createFish(gene),
    body = fish.root.children.find((mesh) => mesh.userData.openHead);
  assert(body, 'neon must have a continuous body');
  assert.equal(body.material.defines.NEON_SKIN, 1, 'stripe must be applied directly to body skin');
  assert.equal(
    body.material.uniforms,
    fish.material.uniforms,
    'stripe and body must share animation uniforms',
  );
  assert.equal(
    body.material.vertexShader,
    fish.material.vertexShader,
    'stripe must follow the same body deformation',
  );
  const bars = fish.root.children.filter(
    (mesh) => mesh.geometry?.type === 'BoxGeometry' && mesh.material.color?.getHex() === 0xffffff,
  );
  assert.equal(bars.length, 0, 'neon must not have detached white stripe bars');
  fish.dispose();
}
console.log('OK: 24 neon anatomies; bands integrated in animated skin; no rigid white bars.');
