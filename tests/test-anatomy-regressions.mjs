import assert from 'node:assert/strict';
import {
  aquarium,
  fishGene,
  sanitize,
  SPECIES,
  MUTATIONS,
  FINISHES,
  SHELLS,
} from '../engine/genes.js';
import { createFish, initialMotion, steerFish } from '../engine/fish.js';
import { Vector3, Box3, Raycaster, Matrix3 } from '../engine/vendor/three.module.js';
import { obstacleForce, resolveObstacles } from '../engine/behavior.js';
import { animateFishMouth } from '../engine/mouth.js';

// An actual aperture: skin and throat share a boundary even while chewing.
for (const species of ['goldfish', 'angler', 'lionfish', 'ribbonfish'])
  for (const mouthSize of [0.7, 1.3]) {
    const gene = {
      ...fishGene('mouth-seams', 0, species),
      mutation: 'fangs',
      mutation2: 'none',
      mouthSize,
    };
    const fish = createFish(gene),
      parts = [];
    fish.root.traverse((mesh) => {
      if (mesh.userData.integratedMouth) parts.push(mesh);
    });
    const skin = parts.find((p) => p.userData.openHead),
      cavity = parts.find((p) => p.userData.mouthCavity);
    assert(skin && cavity, 'Fish must have an open skin and inset throat');
    assert(
      cavity.geometry.attributes.position.getX(150) < cavity.geometry.attributes.position.getX(0),
      'Throat must recede into the head',
    );
    for (const targetFood of [null, {}])
      for (const time of [0, 0.7, 2, 5]) {
        fish.targetFood = targetFood;
        parts.forEach((mesh) => animateFishMouth(mesh, fish, time));
        for (let i = 0; i < 25; i++)
          for (const axis of ['getX', 'getY', 'getZ']) {
            assert(
              Math.abs(
                skin.geometry.attributes.position[axis](i) -
                  cavity.geometry.attributes.position[axis](i),
              ) < 1e-7,
              'Animated mouth seam must stay welded',
            );
          }
        for (const part of parts)
          assert([...part.geometry.attributes.position.array].every(Number.isFinite));
      }
    assert.equal(parts.filter((p) => p.userData.mouthTooth).length, 10);
    fish.dispose();
  }
assert(!Object.hasOwn(SPECIES, 'hammerhead'));
const retired = {
  ...fishGene('retired', 0, 'goldfish'),
  species: 'hammerhead',
  color: '#123456',
  mutation: 'horns',
};
const migrated = sanitize({ version: 2, seed: 'retired', nextId: 1, fish: [retired] }).fish[0];
assert.equal(migrated.species, 'goldfish');
assert.equal(migrated.color, retired.color);
assert.equal(migrated.mutation, retired.mutation);
const obstacles = [{ position: new Vector3(0, 1, 0), radius: 0.4 }];
const inside = new Vector3(0, 1, 0);
resolveObstacles(inside, obstacles, 0.2);
assert(inside.distanceTo(obstacles[0].position) > 0.6);
const crawler = new Vector3(0.01, 1, 0);
resolveObstacles(crawler, obstacles, 0.2, 1);
assert.equal(crawler.y, 1);
assert(crawler.x > 0.6);
assert(obstacleForce(new Vector3(0.5, 1, 0), new Vector3(-1, 0, 0), obstacles, 0.2).length() > 0);
// Lateral gait keeps the crab facing forward, including direction reversals.
{
  const gene = fishGene('lateral', 0, 'crab'),
    f = createFish(gene);
  f.motion = initialMotion('lateral', gene);
  f.motion.position.set(0, 0.4, 0);
  const startZ = f.motion.position.z;
  let left = false,
    right = false;
  for (let i = 0; i < 3600; i++) {
    steerFish(f, [f], i / 30, 1 / 30, new Vector3(0, 1, 1.5));
    assert.equal(f.motion.position.z, startZ);
    assert.equal(f.motion.velocity.z, 0);
    assert(Math.abs(f.root.rotation.y - Math.PI / 2) < 1e-10);
    left ||= f.motion.velocity.x < 0;
    right ||= f.motion.velocity.x > 0;
  }
  assert(left && right, 'crab must reverse sideways');
  const barrier = {
    position: new Vector3(f.motion.position.x, f.motion.position.y, 0),
    radius: 0.3,
  };
  steerFish(f, [f], 121, 1 / 30, null, { obstacles: [barrier] });
  assert.equal(f.motion.position.z, startZ);
  assert(f.motion.position.distanceTo(barrier.position) > 0.3);
  f.dispose();
}
for (const species of ['crab', 'shrimp', 'snail']) {
  const gene = fishGene('gait', 0, species),
    f = createFish(gene);
  f.motion = initialMotion('gait', gene);
  steerFish(f, [f], 0, 1 / 30);
  const joints = [];
  f.root.traverse((o) => {
    if (o.userData.articulation) joints.push(o);
  });
  const before = joints.map((o) => o.rotation.toArray().slice(0, 3));
  for (let i = 1; i < 30; i++) steerFish(f, [f], i / 30, 1 / 30);
  assert(
    joints.some((o, i) =>
      o.rotation
        .toArray()
        .slice(0, 3)
        .some((a, k) => Math.abs(a - before[i][k]) > 0.01),
    ),
    species + ' articulations must move',
  );
  assert.equal(
    sanitize({ ...aquarium('gait', 1), fish: [gene] }).fish[0].antennaLength,
    gene.antennaLength,
  );
  f.dispose();
}
// Shrimp abdomen joints stay connected: animation changes angles, never
// independent segment translations. The tail fan belongs to the final joint.
{
  const gene = { ...fishGene('shrimp-rig', 0, 'shrimp'), mutation: 'none' },
    f = createFish(gene);
  f.motion = initialMotion('shrimp-rig', gene);
  const parts = {};
  f.root.traverse((o) => {
    const part = o.userData.articulation?.part;
    if (part) (parts[part] ??= []).push(o);
  });
  assert.equal(parts.shrimpAbdomen.length, 6);
  assert.equal(parts.shrimpLeg.length, 10);
  assert.equal(parts.shrimpKnee.length, 10);
  assert.equal(parts.shrimpAntenna.length, 4);
  assert.equal(parts.shrimpFan[0].children.length, 5);
  assert.equal(parts.shrimpBody.length, 1);
  assert.equal(parts.shrimpEyes.length, 2);
  assert.equal(parts.shrimpBody[0].children.includes(parts.shrimpAbdomen[0]), true);
  const positions = parts.shrimpAbdomen.map((o) => o.position.clone());
  for (let i = 1; i < 6; i++)
    assert.equal(parts.shrimpAbdomen[i].parent, parts.shrimpAbdomen[i - 1]);
  assert.equal(parts.shrimpFan[0].parent, parts.shrimpAbdomen[5]);
  for (let i = 0; i < 300; i++) {
    steerFish(f, [f], i / 30, 1 / 30);
    parts.shrimpAbdomen.forEach((o, k) => assert(o.position.equals(positions[k])));
  }
  f.dispose();
}
const shellSilhouettes = new Set();
// Monster traits combine physically, persist and expose the requested eye count.
for (const species of ['goldfish', 'angler', 'ribbonfish'])
  for (const eyePairs of [1, 4]) {
    const gene = {
      ...fishGene('monster', 0, species),
      mutation: 'extraEyes',
      mutation2: 'giantSpines',
      eyePairs,
      mutationSize: 1.8,
      scale: 1.6,
    };
    const f = createFish(gene);
    f.motion = initialMotion('monster', gene);
    let eyes = 0,
      spines = 0;
    f.root.traverse((o) => {
      if (o.userData.extraEye) eyes++;
      if (o.userData.giantSpine) spines++;
    });
    assert.equal(eyes, eyePairs * 2);
    assert.equal(spines, 18);
    const saved = sanitize({ ...aquarium('monster', 1), fish: [gene] }).fish[0];
    assert.equal(saved.mutation2, 'giantSpines');
    assert.equal(saved.eyePairs, eyePairs);
    for (let i = 0; i < 600; i++) {
      steerFish(f, [f], i / 30, 1 / 30);
      if (i % 30 === 0) {
        const box = new Box3().setFromObject(f.root, true);
        assert(box.min.y > 0.16 && box.max.y < 3.7);
        assert(box.min.x > -3.5 && box.max.x < 3.5);
        assert(box.min.z > -2.15 && box.max.z < 2.15);
      }
    }
    f.dispose();
  }
{
  const gene = { ...fishGene('legacy-monster', 0, 'goldfish') };
  delete gene.mutation2;
  delete gene.eyePairs;
  delete gene.mutationSize;
  const old = sanitize({ ...aquarium('legacy-monster', 1), fish: [gene] }).fish[0];
  assert.equal(old.mutation2, 'none');
  assert.equal(old.eyePairs, 2);
  assert.equal(old.mutationSize, 1);
}
for (const shellType of Object.keys(SHELLS))
  for (const scale of [0.65, 1.6]) {
    const gene = {
      ...fishGene('shell-variety', 0, 'snail'),
      shellType,
      shellColor: '#8b929f',
      mutation: 'none',
      scale,
      shellSpire: 1.35,
    };
    const f = createFish(gene);
    f.motion = initialMotion('shell-variety', gene);
    const shell = f.root.children.find((o) => o.userData.snailShell),
      foot = f.root.children.find((o) => o.userData.footRest);
    const size = new Box3().setFromObject(shell).getSize(new Vector3());
    if (scale === 0.65)
      shellSilhouettes.add(
        size
          .toArray()
          .map((n) => n.toFixed(4))
          .join(','),
      );
    for (let i = 0; i < 180; i++) {
      steerFish(f, [f], i / 30, 1 / 30);
      f.root.updateMatrixWorld(true);
      const a = foot.geometry.attributes.position,
        rest = foot.userData.footRest;
      for (let k = 0; k < a.count; k++)
        if (rest[k * 3 + 1] <= -0.649)
          assert(
            Math.abs(
              new Vector3().fromBufferAttribute(a, k).applyMatrix4(foot.matrixWorld).y - 0.181,
            ) < 1e-6,
          );
      const bounds = new Box3().setFromObject(f.root);
      assert(bounds.min.y > 0.16 && bounds.max.y < 3.7);
    }
    const saved = sanitize({ ...aquarium('shell-variety', 1), fish: [gene] }).fish[0];
    assert.equal(saved.shellType, shellType);
    assert.equal(saved.shellColor, '#8b929f');
    f.dispose();
  }
assert.equal(shellSilhouettes.size, 5, 'each cover needs its own silhouette');
{
  const old = { ...fishGene('migration', 0, 'snail') };
  delete old.shellType;
  delete old.shellColor;
  const migrated = sanitize({ ...aquarium('migration', 1), fish: [old] }).fish[0];
  assert.equal(migrated.shellType, 'spiral');
  assert.equal(migrated.shellColor, old.color);
}
// Snail sole remains flush with the sand through turns, growth and mutations.
// A ground shrimp extends its abdomen and plants the tips of its walking legs.
for (const scale of [0.65, 1.6])
  for (const growth of [0.35, 1]) {
    const gene = { ...fishGene('walking', 0, 'shrimp'), scale, growth, mutation: 'none' },
      f = createFish(gene);
    f.motion = initialMotion('walking', gene);
    f.motion.phase = 0;
    const abdomen = [];
    f.root.traverse((o) => {
      if (o.userData.articulation?.part === 'shrimpAbdomen') abdomen.push(o);
    });
    let contacts = 0,
      lifts = 0;
    for (let i = 0; i < 120; i++) {
      steerFish(f, [f], i / 30, 1 / 30);
      assert.equal(f.motion.swimBlend, 0);
      assert(
        abdomen.every((j) => Math.abs(j.rotation.z) < 0.025),
        'walking abdomen must stay extended',
      );
      for (const leg of f.walkingLegs) {
        const knee = leg.children.find((o) => o.userData.articulation?.part === 'shrimpKnee');
        const toe = leg.userData.walkLower.clone().applyMatrix4(knee.matrixWorld);
        assert(toe.y >= 0.18, 'walking foot must not pierce sand');
        if (!leg.userData.step.swing) {
          assert(
            toe.distanceTo(leg.userData.step.foot) < 0.003,
            `stance foot must stay planted: ${scale}/${growth}/${i}/${leg.userData.articulation.index} error=${toe.distanceTo(leg.userData.step.foot)}`,
          );
          contacts++;
        } else if (toe.y > 0.19) lifts++;
      }
    }
    assert(contacts > 0 && lifts > 0, 'walking requires support and lifted steps');
    f.dispose();
  }
for (const growth of [0.35, 1])
  for (const mutation of ['none', 'melt']) {
    const gene = {
      ...fishGene('sole', 0, 'snail'),
      growth,
      mutation,
      scale: 1.6,
      shellSpire: 1.35,
    };
    const f = createFish(gene);
    f.motion = initialMotion('sole', gene);
    const foot = f.root.children.find((o) => o.userData.footRest),
      rest = foot.userData.footRest;
    for (let i = 0; i < 180; i++) {
      steerFish(f, [f], i / 30, 1 / 30);
      f.root.updateMatrixWorld(true);
      const a = foot.geometry.attributes.position;
      for (let k = 0; k < a.count; k++)
        if (rest[k * 3 + 1] <= -0.649) {
          const sole = new Vector3().fromBufferAttribute(a, k).applyMatrix4(foot.matrixWorld);
          assert(Math.abs(sole.y - 0.181) < 1e-6, 'snail sole must stay on the sand');
        }
      assert(Math.hypot(f.motion.velocity.x, f.motion.velocity.z) <= gene.speed * 0.17 + 1e-10);
      assert.equal(f.root.rotation.x, 0);
      assert.equal(f.root.rotation.z, 0);
    }
    f.dispose();
  }
{
  const gene = { ...fishGene('swimming', 0, 'shrimp'), mutation: 'none' },
    f = createFish(gene);
  f.motion = initialMotion('swimming', gene);
  f.motion.phase = 0;
  let lowest = Infinity,
    highest = -Infinity;
  const heights = [];
  for (let i = 0; i < 720; i++) {
    steerFish(f, [f], i / 30, 1 / 30);
    heights.push(f.motion.position.y);
    lowest = Math.min(lowest, f.motion.position.y);
    highest = Math.max(highest, f.motion.position.y);
  }
  assert(highest - lowest > 0.2, 'shrimp must leave the bottom to swim');
  assert(heights[719] < heights[400] - 0.1, 'shrimp must settle back down');
  const facing = f.motion.currentYaw;
  steerFish(f, [f], 24, 1 / 30, null, {
    disturbance: { position: f.motion.position.clone(), until: 26 },
  });
  assert(f.motion.escapeUntil > 24);
  assert(
    f.motion.velocity.dot(new Vector3(Math.cos(facing), 0, -Math.sin(facing))) < 0,
    'tail flip must propel shrimp backwards',
  );
  assert(Math.abs(f.root.rotation.y - facing) < 0.01, 'escape keeps the head facing forward');
  f.dispose();
}
let models = 0;
for (const species of Object.keys(SPECIES))
  for (const mutation of Object.keys(MUTATIONS)) {
    const gene = {
      ...fishGene('mutations', models, species),
      mutation,
      scale: 1.6,
      bodyHeight: 1.18,
      bodyWidth: 1.18,
      finSize: 1.4,
      bodyRatio: 1.25,
    };
    const f = createFish(gene);
    f.motion = initialMotion('mutations', gene);
    f.root.traverse((o) => {
      const a = o.geometry?.attributes.position?.array;
      if (a) for (const x of a) assert(Number.isFinite(x));
    });
    for (let i = 0; i < 120; i++) {
      steerFish(f, [f], i / 30, 1 / 30);
      const box = new Box3().setFromObject(f.root, species === 'shrimp');
      assert(
        box.min.y > 0.16 && box.max.y < 3.7,
        `${species}/${mutation}: y=${box.min.y}..${box.max.y}`,
      );
    }
    f.dispose();
    models++;
  }
const f = createFish(fishGene('reactions', 0, 'goldfish'));
f.motion = initialMotion('reactions', f.gene);
steerFish(f, [f], 1, 1 / 30, null, {
  disturbance: { position: f.motion.position.clone(), until: 2 },
});
assert.equal(f.motion.action, 'Startled');
f.motion.phase = 0;
steerFish(f, [f], 80, 1 / 30, null, { shelters: [new Vector3(0, 1, 0)] });
assert.equal(f.motion.action, 'Resting in the plants');
f.dispose();
assert.equal(Object.keys(FINISHES).length, 22);
for (const species of ['goldfish', 'angel', 'betta', 'angler', 'puffer', 'eel', 'blobfish', 'gar'])
  for (const mutation of ['spines', 'giantSpines']) {
    const fish = createFish({
        ...fishGene('surface-spines', 0, species),
        mutation,
        mutation2: 'none',
        mutationSize: 1.8,
      }),
      parts = [];
    fish.root.updateMatrixWorld(true);
    fish.root.traverse((p) => parts.push(p));
    const body = parts.find((p) => p.userData.openHead),
      spines = parts.filter((p) => p.userData.bodySpine);
    assert.equal(spines.length, mutation === 'spines' ? 14 : 18);
    const matrix = new Matrix3().getNormalMatrix(fish.root.matrixWorld);
    for (const spine of spines) {
      const { anchor, normal, burial, length } = spine.userData.bodySpine;
      const world = fish.root.localToWorld(anchor.clone()),
        direction = normal.clone().applyMatrix3(matrix).normalize();
      const ray = new Raycaster(
        world.clone().addScaledVector(direction, 0.01),
        direction.clone().negate(),
      );
      const hit = ray.intersectObject(body, false)[0];
      assert(
        hit && hit.point.distanceTo(world) < 1e-5,
        `${species}/${mutation}: spine anchor distance ${hit?.point.distanceTo(world)}`,
      );
      assert(burial > 0 && length <= 0.3, 'roots must be embedded and large spines bounded');
      assert.equal(spine.material.uniforms.uTime, fish.material.uniforms.uTime);
    }
    assert(spines.some((p) => p.userData.bodySpine.normal.y > 0.2));
    assert(spines.some((p) => p.userData.bodySpine.normal.y < -0.2));
    fish.dispose();
  }
console.log(`OK: ${models} modelos/mutações; obstáculos; reações; anatomia e mutações.`);
