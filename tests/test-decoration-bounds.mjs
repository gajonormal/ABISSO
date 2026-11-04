import assert from 'node:assert/strict';
import * as T from '../engine/vendor/three.module.js';
import { AquariumViewer } from '../engine/tank.js';
import { environment } from '../engine/ecology.js';
import { DECORATION_LIMITS as limits } from '../engine/decoration-bounds.js';
let cases = 0;
for (const format of ['classic', 'panorama', 'tall'])
  for (let seed = 0; seed < 20; seed++) {
    const viewer = {
      scene: new T.Scene(),
      environment: new T.Group(),
      config: environment({ format, plants: 1, decoration: 'mixed' }),
      plantTime: { value: 0 },
    };
    AquariumViewer.prototype.buildEnvironment.call(viewer, 'bounds-' + seed);
    viewer.environment.updateMatrixWorld(true);
    assert.equal(
      new Set(
        viewer.environment.children.map((o) => o.geometry?.userData.reliefKind).filter(Boolean),
      ).size,
      3,
      'stone relief shapes must be mixed',
    );
    assert.equal(
      new Set(viewer.plants.map((o) => o.userData.plantKind)).size,
      6,
      'vegetation must include different growth forms',
    );
    for (const plant of viewer.plants) {
      const n = plant.geometry.attributes.normal;
      let nx = 0,
        nz = 0;
      for (let i = 0; i < n.count; i++) {
        nx = Math.max(nx, Math.abs(n.getX(i)));
        nz = Math.max(nz, Math.abs(n.getZ(i)));
      }
      assert(
        nx > 0.4 && nz > 0.4,
        'leaf faces must point along different horizontal axes: ' +
          plant.userData.plantKind +
          ' seed ' +
          seed +
          ' ' +
          nx +
          ' ' +
          nz,
      );
    }

    const solids = viewer.environment.children
      .filter((o) => o.userData.solidDecoration)
      .map((o) => {
        o.geometry.computeBoundingBox();
        o.updateMatrix();
        return o.geometry.boundingBox.clone().applyMatrix4(o.matrix);
      });
    assert(solids.length >= 7, 'solid decoration bounds must be present');
    const scale = viewer.environment.scale;
    for (const object of viewer.environment.children) {
      if (!(
        object.isInstancedMesh ||
        object.isGroup ||
        ['IcosahedronGeometry', 'TorusGeometry'].includes(object.geometry?.type)
      ))
        continue;
      const box = new T.Box3().setFromObject(object);
      assert(
        box.min.x >= -limits.x * scale.x - 1e-5 && box.max.x <= limits.x * scale.x + 1e-5,
        'decoration crosses side glass',
      );
      assert(
        box.min.z >= -limits.z * scale.z - 1e-5 && box.max.z <= limits.z * scale.z + 1e-5,
        'decoration crosses end glass',
      );
      assert(box.min.y >= limits.floor * scale.y - 1e-5, 'decoration crosses bottom');
    }
    for (const leaf of viewer.plants)
      for (let step = 0; step < 16; step++) {
        const time = step * 1.3,
          phase = leaf.userData.phase,
          angle = Math.sin(time * 0.85 + phase) * 0.05 + Math.sin(time * 1.65 + phase * 1.3) * 0.02;
        const positions = leaf.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const p = new T.Vector3().fromBufferAttribute(positions, i);
          p.x += Math.sin(time * 0.9 + p.y * 3 + phase) * 0.065 * p.y * p.y;
          p.multiply(leaf.scale)
            .applyAxisAngle(new T.Vector3(0, 0, 1), angle)
            .add(leaf.position);
          assert(
            !solids.some((box) => box.containsPoint(p)),
            'animated plant grows inside rock or cave',
          );
          assert(
            Math.abs(p.x) <= limits.x &&
              Math.abs(p.z) <= limits.z &&
              p.y >= limits.floor &&
              p.y <= limits.top,
            'moving leaf crosses glass',
          );
        }
      }
    viewer.environment.traverse((o) => {
      o.geometry?.dispose();
      if (o.material)
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    });
    cases++;
  }
const zoom = { minZoom: 0.55, maxZoom: 1.5, camera: { zoom: 1, updateProjectionMatrix() {} } };
AquariumViewer.prototype.setZoom.call(zoom, 100);
assert.equal(zoom.camera.zoom, 1.5);
console.log(
  'OK: ' +
    cases +
    ' real generated scenes; stones, gravel, caves, corals and animated plant vertices remain inside; zoom capped at 1.5.',
);

const { buriedRockGeometry } = await import('../engine/decoration-bounds.js');
const buried = buriedRockGeometry(0.6, () => 0.4);
assert.equal(buried.boundingBox.min.y, 0);
assert(buried.boundingBox.max.y < 1.2);
assert(
  Array.from(buried.attributes.position.array)
    .filter((_, i) => i % 3 === 1)
    .filter((y) => y === 0).length > 3,
);
buried.dispose();
