import assert from 'node:assert/strict';
import { fishGene, SPECIES, MUTATIONS, SHELLS } from '../engine/genes.js';
import { createFish, initialMotion, steerFish } from '../engine/fish.js';
import { Vector3 } from '../engine/vendor/three.module.js';

let accessories = 0;
for (const species of Object.keys(SPECIES))
  for (const mutation of Object.keys(MUTATIONS)) {
    const gene = { ...fishGene('bind-audit', 0, species), mutation, mutation2: 'none' },
      fish = createFish(gene);
    fish.root.traverse((mesh) => {
      if (!mesh.userData.mutationTag) return;
      const binding = mesh.userData.mutationBind;
      assert(binding, species + ':' + mutation + ' needs an anatomical mount');
      const target = fish.root.getObjectByProperty('uuid', binding.target);
      assert.equal(mesh.parent, target);
      for (const uniform of ['uTime', 'uSwimType', 'uMutation'])
        assert.equal(
          mesh.material.uniforms[uniform],
          target.material.uniforms[uniform],
          species + ': accessories must share the skin deformation',
        );
      assert.deepEqual(mesh.position.toArray(), [0, 0, 0]);
      assert.deepEqual(mesh.scale.toArray(), [1, 1, 1]);
      accessories++;
    });
    fish.dispose();
  }
for (const shellType of Object.keys(SHELLS))
  for (const mutation of [
    'horns',
    'crystal',
    'antenna',
    'tendrils',
    'frill',
    'giantSpines',
    'eyeStalks',
  ]) {
    const gene = {
      ...fishGene('snail-mounts', 0, 'snail'),
      shellType,
      mutation,
      mutation2: mutation === 'giantSpines' ? 'splitTail' : 'none',
    };
    const fish = createFish(gene);
    fish.motion = initialMotion('snail-mounts', gene);
    const mounts = [];
    fish.root.traverse((mesh) => {
      if (mesh.userData.mutationBind) mounts.push(mesh);
    });
    assert(mounts.length);
    const roots = [];
    for (const mesh of mounts) {
      const data = mesh.userData.mutationAttachment,
        curve = mesh.geometry.parameters.path;
      if (!data || !curve || curve.getPoint(0).distanceTo(new Vector3(...data.anchor)) > 1e-6)
        continue;
      const count = mesh.geometry.parameters.radialSegments,
        center = new Vector3();
      for (let i = 0; i < count; i++)
        center.add(new Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i));
      center.divideScalar(count);
      assert(
        center.distanceTo(new Vector3(...mesh.userData.mutationBind.localAnchor)) < 1e-6,
        'The embedded root ring must meet the socket',
      );
      roots.push({ mesh, count, center });
    }
    for (const time of [0, 0.5, 1.5, 3]) {
      steerFish(fish, [fish], time, 1 / 30);
      fish.root.updateMatrixWorld(true);
      for (const { mesh, count, center } of roots) {
        const current = new Vector3();
        for (let i = 0; i < count; i++)
          current.add(new Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i));
        current.divideScalar(count);
        assert(
          current.distanceTo(center) < 1e-6,
          'Flexible appendage roots must not drift during crawling',
        );
      }
      for (const mesh of mounts)
        assert(mesh.geometry.attributes.position.array.every(Number.isFinite));
    }
    fish.dispose();
  }
for (const species of ['betta', 'eel', 'blobfish', 'seahorse', 'jellyfish']) {
  const gene = {
      ...fishGene('flex-mounts', 0, species),
      mutation: 'tendrils',
      mutation2: 'extraEyes',
    },
    fish = createFish(gene);
  fish.motion = initialMotion('flex-mounts', gene);
  let moving = false;
  const flex = [];
  fish.root.traverse((mesh) => {
    if (mesh.userData.mutationBind?.flex) flex.push(mesh);
  });
  for (const time of [0, 1, 2]) {
    steerFish(fish, [fish], time, 1 / 30);
    for (const mesh of flex) {
      const a = mesh.geometry.attributes.position.array,
        rest = mesh.userData.mutationBind.rest;
      if (a.some((v, i) => Math.abs(v - rest[i]) > 0.001)) moving = true;
    }
  }
  assert(moving, species + ': flexible mutations must animate');
  fish.dispose();
}
console.log(
  'OK: ' +
    accessories +
    ' surface-bound accessories across 22 species; 35 snail/shell mutation variants; animated roots and shared skin deformation.',
);
