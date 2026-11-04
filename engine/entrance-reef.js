import * as T from './vendor/three.module.js';
import { fishGene } from './genes.js';
import { createFish, initialMotion, steerFish } from './fish.js';
import { createEntranceGardens } from './entrance-gardens.js';

export function createEntranceReef(root, toon, elevation) {
  let seed = 71337;
  const random = () => {
    seed ^= seed << 13;
    seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed / 4294967296;
  };

  const pick = (values) => values[Math.floor(random() * values.length)];
  
  const occupied = [];

  function place(x, z, radius) {
    let best = { x, z },
      bestGap = -Infinity;

    for (let i = 0; i < 120; i++) {
      const angle = i * 2.399963,
        distance = Math.sqrt(i) * 0.55,
        px = x + Math.cos(angle) * distance,
        pz = z + Math.sin(angle) * distance;

      if (Math.abs(px) > 16 || pz > 5 || pz < -13 || (Math.abs(px) < 1.5 && pz > -5)) continue;
      let gap = Infinity;

      for (const other of occupied)
        gap = Math.min(gap, Math.hypot(px - other.x, pz - other.z) - radius - other.radius);
      
      if (gap > bestGap) {
        best = { x: px, z: pz };
        bestGap = gap;
      }
      if (gap >= 0.22) break;
    }
    occupied.push({ ...best, radius });

    return best;
  }
  
  const gardensLayer = createEntranceGardens(root, toon, elevation, random, place);
  const leaves = [],
    swimmers = [],
    dummy = new T.Object3D();
  const gardens = Array.from({ length: 18 }, (_, i) => ({
    x: (i % 2 ? -1 : 1) * (2 + random() * 12),
    z: 5 - random() * 17,
  }));

  const garden = (radius = 0.5) => {
    const g = pick(gardens);
    return place(g.x + (random() - 0.5) * 2.7, g.z + (random() - 0.5) * 2.5, radius);
  };

  const plantMaterials = ['#519e91', '#65ad98', '#84c3b4', '#688faf'].map((color) =>
    toon(color, T.DoubleSide),
  );
  
  for (let i = 0; i < 38; i++) {
    const { x, z } = garden(),
      height = 0.5 + random() * 1.8,
      angle = random() * 6.28;

    for (let leaf = 0; leaf < 3; leaf++) {
      const geometry = new T.PlaneGeometry(
          0.18 + random() * 0.24,
          height * (0.55 + random() * 0.45),
          1,
          10,
        ),
        
        p = geometry.attributes.position;
      const length = geometry.parameters.height,
        bend = (random() - 0.5) * 0.8;

      for (let j = 0; j < p.count; j++) {
        const f = (p.getY(j) + length / 2) / length;
        p.setXYZ(
          j,
          p.getX(j) * Math.sin(f * Math.PI) + bend * f * f,
          length * f,
          Math.sin(f * 2.8) * 0.12,
        );
      }

      geometry.computeVertexNormals();
      const mesh = new T.Mesh(geometry, pick(plantMaterials));
      mesh.position.set(x, elevation(x, z), z);
      mesh.rotation.y = angle + leaf * 1.4;
      root.add(mesh);
      leaves.push({ mesh, rest: p.array.slice(), height: length, phase: random() * 6.28 });
    }
  }
  const rockGeometry = new T.IcosahedronGeometry(1, 0),
    rockMaterial = toon('#ffffff'),
    rocks = new T.InstancedMesh(rockGeometry, rockMaterial, 24);

  for (let i = 0; i < 24; i++) {
    const size = 0.25 + random() * 0.55,
      { x, z } = place((random() - 0.5) * 30, 5 - random() * 18, size * 1.5);
    dummy.position.set(x, elevation(x, z) + size * 0.2, z);
    dummy.rotation.set(random(), random() * 6.28, random());
    dummy.scale.set(size * (1 + random()), size * 0.65, size);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    rocks.setColorAt(i, new T.Color(pick(['#52677f', '#637b8b', '#748591', '#4b6077'])));
  }

  root.add(rocks);
  const pebbles = new T.InstancedMesh(new T.IcosahedronGeometry(0.07, 0), toon('#ffffff'), 400);

  for (let i = 0; i < 400; i++) {
    const x = (random() - 0.5) * 42,
      z = 7 - random() * 24;
    dummy.position.set(x, elevation(x, z) + 0.04, z);
    dummy.rotation.set(random() * 3, random() * 3, random() * 3);
    dummy.scale.setScalar(0.5 + random());
    dummy.updateMatrix();
    pebbles.setMatrixAt(i, dummy.matrix);
    pebbles.setColorAt(i, new T.Color(pick(['#c8bcab', '#a0afbe', '#bcc6d2', '#8b9cb0'])));
  }
  root.add(pebbles);

  const coralColors = ['#bc8bc5', '#e6a18d', '#82bac9', '#ad9bdb'],
    branches = coralColors.map(() => []),
    up = new T.Vector3(0, 1, 0);

  function branch(bucket, start, end, width) {
    const direction = end.clone().sub(start);
    dummy.position.copy(start).add(end).multiplyScalar(0.5);
    dummy.quaternion.setFromUnitVectors(up, direction.clone().normalize());
    dummy.scale.set(width, direction.length(), width);
    dummy.updateMatrix();

    bucket.push(dummy.matrix.clone());
  }

  for (let i = 0; i < 30; i++) {
    const { x, z } = garden(),
      base = new T.Vector3(x, elevation(x, z), z),
      height = 0.5 + random() * 1.05,
      bucket = branches[i % 4];
    branch(bucket, base, base.clone().add(new T.Vector3(0.05, height, 0)), 0.07);

    for (let arm = 0; arm < 5; arm++) {
      const angle = (arm / 5) * Math.PI * 2 + random() * 0.5,
        start = base.clone().add(new T.Vector3(0, height * (0.2 + arm * 0.11), 0));
      const elbow = start
          .clone()
          .add(new T.Vector3(Math.cos(angle) * 0.23, height * 0.1, Math.sin(angle) * 0.23)),
        tip = elbow
          .clone()
          .add(
            new T.Vector3(
              Math.cos(angle) * 0.07,
              height * (0.35 + random() * 0.3),
              Math.sin(angle) * 0.07,
            ),
          );
      branch(bucket, start, elbow, 0.05);
      branch(bucket, elbow, tip, 0.045);
    }
  }

  const coralGeometry = new T.CylinderGeometry(1, 1, 1, 6);
  branches.forEach((matrices, i) => {
    const mesh = new T.InstancedMesh(coralGeometry, toon(coralColors[i]), matrices.length);
    matrices.forEach((matrix, j) => mesh.setMatrixAt(j, matrix));
    root.add(mesh);
  });

  function instances(geometry, count, colors, place) {
    const mesh = new T.InstancedMesh(geometry, toon('#ffffff'), count);

    for (let i = 0; i < count; i++) {
      dummy.position.set(0, 0, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      place(i);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, new T.Color(pick(colors)));
    }
    root.add(mesh);

    return mesh;
  }

  const spongeGeometry = new T.CylinderGeometry(0.16, 0.23, 1, 8, 1, true);
  const tubes = [];

  for (let i = 0; i < 12; i++) {
    const { x, z } = garden(0.65);
    for (let j = 0; j < 3; j++) {
      const angle = (j * Math.PI * 2) / 3;
      tubes.push({
        x: x + Math.cos(angle) * 0.28,
        z: z + Math.sin(angle) * 0.28,
        h: 0.3 + random() * 0.8,
      });
    }
  }

  instances(spongeGeometry, tubes.length, ['#dc9e78', '#c180a7', '#a698d1'], (i) => {
    const t = tubes[i];
    dummy.position.set(t.x, elevation(t.x, t.z) + t.h / 2, t.z);
    dummy.scale.set(1, t.h, 1);
  });

  instances(
    new T.CircleGeometry(0.125, 8).rotateX(-Math.PI / 2),
    tubes.length,
    ['#624c73', '#785c74'],
    (i) => {
      const t = tubes[i];
      dummy.position.set(t.x, elevation(t.x, t.z) + t.h - 0.06, t.z);
    },
  );

  instances(new T.SphereGeometry(1, 9, 5), 35, ['#df9b87', '#a1c6b2', '#b4a2d5', '#d5b88a'], () => {
    const s = 0.22 + random() * 0.4,
      { x, z } = garden(s);
    dummy.position.set(x, elevation(x, z) + s * 0.55, z);
    dummy.scale.set(s, s * 0.65, s);
  });
  const plates = [];

  for (let i = 0; i < 15; i++) {
    const s = 0.3 + random() * 0.45,
      { x, z } = garden(s + 0.18);
    for (let j = 0; j < 3; j++)
      plates.push({ x: x + j * 0.09, z: z - j * 0.04, s: s * (1 - j * 0.2), y: 0.12 + j * 0.19 });
  }

  instances(
    new T.CylinderGeometry(1, 0.65, 0.12, 9),
    plates.length,
    ['#81c6bd', '#db9cac', '#a29ace'],
    (i) => {
      const p = plates[i];
      dummy.position.set(p.x, elevation(p.x, p.z) + p.y, p.z);
      dummy.scale.set(p.s, 1, p.s * 0.8);
      dummy.rotation.z = 0.1;
    },
  );

  const star = new T.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5,
      r = i % 2 ? 0.4 : 1;
    i
      ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      : star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }

  star.closePath();

  const starGeometry = new T.ExtrudeGeometry(star, { depth: 0.13, bevelEnabled: false, steps: 1 });
  starGeometry.rotateX(-Math.PI / 2);
  instances(starGeometry, 22, ['#dd997d', '#cfa4cb', '#d9bd86'], () => {
    const x = (random() - 0.5) * 28,
      z = 6 - random() * 15,
      s = 0.12 + random() * 0.13;
    dummy.position.set(x, elevation(x, z) + 0.025, z);
    dummy.scale.setScalar(s);
    dummy.rotation.y = random() * 6.28;
  });

  const shellGeometry = new T.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  instances(shellGeometry, 32, ['#e2cfc0', '#b6c9ca', '#c6afd0'], () => {
    const x = (random() - 0.5) * 28,
      z = 6 - random() * 15,
      s = 0.12 + random() * 0.13;
    dummy.position.set(x, elevation(x, z), z);
    dummy.scale.set(s, s * 0.35, s * 0.8);
    dummy.rotation.y = random() * 6.28;
  });

  for (let i = 0; i < 7; i++) {
    const gene = fishGene(
      'entrance-reef',
      i,
      ['neon', 'goldfish', 'neon', 'discus', 'neon', 'goldfish', 'neon'][i],
    );
    gene.color = ['#68c5cd', '#eaa387', '#92b8dd', '#b8a0d7', '#8dd2ba', '#efb97e', '#80bde0'][i];
    gene.accent = '#d9f1e7';
    gene.effect = 'natural';
    gene.finish = 'pearl';
    gene.mutation = gene.mutation2 = 'none';
    const fish = createFish(gene);
    fish.motion = initialMotion('entrance-reef', gene);
    const holder = new T.Group();
    holder.scale.setScalar(0.42 + random() * 0.2);
    holder.add(fish.root);
    root.add(holder);
    swimmers.push({ fish, holder, x: (i - 3) * 2.4, z: 1 - (i % 3) * 2, phase: i * 2.1 });
  }

  const shoalGeometry = new T.SphereGeometry(1, 6, 4),
    shoal = new T.InstancedMesh(shoalGeometry, toon('#82a4c4'), 30);
  const shoalTail = new T.InstancedMesh(
    new T.ConeGeometry(0.1, 0.18, 3).rotateZ(Math.PI / 2),
    toon('#90b6d4'),
    30,
  );

  root.add(shoal, shoalTail);

  return {
    update(time) {
      gardensLayer.update(time);
      for (const leaf of leaves) {
        const p = leaf.mesh.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const y = leaf.rest[i * 3 + 1],
            tip = y / leaf.height;
          p.setX(
            i,
            leaf.rest[i * 3] + Math.sin(time * 0.8 + leaf.phase + y * 1.4) * tip * tip * 0.19,
          );
          p.setZ(i, leaf.rest[i * 3 + 2] + Math.cos(time * 0.65 + leaf.phase) * tip * tip * 0.08);
        }
        p.needsUpdate = true;
      }

      for (const item of swimmers) {
        const phase = time * 0.25 + item.phase,
          x = item.x + Math.sin(phase) * 2,
          z = item.z + Math.sin(time * 0.18 + item.phase) * 0.7;
        steerFish(item.fish, [item.fish], time, 0);
        item.fish.root.position.set(0, 0, 0);
        item.fish.root.rotation.set(
          0,
          Math.cos(phase) < 0 ? Math.PI : 0,
          Math.sin(time * 0.7 + item.phase) * 0.05,
        );
        item.holder.position.set(
          x,
          elevation(x, z) + 1 + Math.sin(time * 0.6 + item.phase) * 0.15,
          z,
        );
      }

      for (let i = 0; i < 30; i++) {
        const school = Math.floor(i / 10),
          phase = time * 0.17 + school * 2.1,
          x = Math.sin(phase) * 7 + (i % 10) * 0.22,
          z = -7 + school * 2 + (i % 3) * 0.25,
          y = 1.8 + Math.sin(time * 0.7 + i * 0.8) * 0.09 + (i % 4) * 0.12,
          direction = Math.cos(phase) < 0 ? -1 : 1;
        dummy.rotation.set(0, 0, 0);
        dummy.position.set(x, y, z);
        dummy.scale.set(0.14, 0.055, 0.05);
        dummy.updateMatrix();
        shoal.setMatrixAt(i, dummy.matrix);
        dummy.position.x = x - direction * 0.17;
        dummy.scale.set(1, 1, 1);
        dummy.rotation.y = time * 4 + i;
        dummy.updateMatrix();
        shoalTail.setMatrixAt(i, dummy.matrix);
      }
      
      shoal.instanceMatrix.needsUpdate = true;
      shoalTail.instanceMatrix.needsUpdate = true;
    },
  };
}
