import * as T from './vendor/three.module.js';

export function createEntranceGardens(root, toon, elevation, random, place) {
  const positions = [],
    normals = [],
    colors = [],
    anchors = [],
    sways = [];

  const matrix = new T.Matrix4(),
    normalMatrix = new T.Matrix3(),
    point = new T.Vector3(),
    normal = new T.Vector3(),
    dummy = new T.Object3D();

  const palette = {
    kelp: ['#397f78', '#4a9f8b', '#78b39a'],
    fern: ['#3d8d9c', '#64ada9', '#89c5b0'],
    red: ['#a65e91', '#c682a7', '#de9fae'],
    fan: ['#c97f95', '#e7a393', '#b195ce'],
    grass: ['#659e84', '#8cbaa0'],
  };

  function add(geometry, color, origin, strength = 1) {
    dummy.updateMatrix();
    matrix.copy(dummy.matrix);
    normalMatrix.getNormalMatrix(matrix);

    const g = geometry.index ? geometry.toNonIndexed() : geometry,
      p = g.attributes.position,
      n = g.attributes.normal,
      c = new T.Color(color);

    for (let i = 0; i < p.count; i++) {
      point.fromBufferAttribute(p, i).applyMatrix4(matrix);
      normal.fromBufferAttribute(n, i).applyMatrix3(normalMatrix).normalize();
      positions.push(point.x, point.y, point.z);
      normals.push(normal.x, normal.y, normal.z);
      colors.push(c.r, c.g, c.b);
      anchors.push(origin.x, origin.y, origin.z);
      sways.push(strength);
    }

    if (g !== geometry) g.dispose();
  }

  function transform(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.set(sx, sy, sz);
  }

  const stem = new T.CylinderGeometry(0.025, 0.045, 1, 5),
    blade = new T.PlaneGeometry(1, 1, 2, 10);
  const p = blade.attributes.position;

  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) + 0.5,
      x = p.getX(i);
    p.setXYZ(
      i,
      x * Math.pow(Math.sin(t * Math.PI), 0.75) * (1 + 0.16 * Math.sin(t * 22)),
      t,
      0.3 * t * t + Math.sin(t * 8) * 0.035,
    );
  }

  blade.computeVertexNormals();
  function segment(a, b, color, origin, width = 1) {
    const d = b.clone().sub(a);
    dummy.position.copy(a).add(b).multiplyScalar(0.5);
    dummy.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize());
    dummy.scale.set(width, d.length(), width);
    add(stem, color, origin, 0.65);
  }

  function plant(x, z, height, type, index, rng = random) {
    ({ x, z } = place(x, z, type === 'grass' ? 0.28 : type === 'fern' ? 0.65 : 0.6));
    const origin = new T.Vector3(x, elevation(x, z), z),
      base = origin.y,
      angle = rng() * Math.PI * 2,
      pal = palette[type],
      color = pal[index % pal.length];

    if (type === 'grass') {
      for (let i = 0; i < 7; i++) {
        transform(
          x,
          base,
          z,
          0.07 + rng() * 0.1,
          height * (0.5 + rng() * 0.5),
          1,
          0,
          i * 0.9,
          (i - 3) * 0.13,
        );
        add(blade, color, origin, 1.6);
      }

      return;
    }

    let previous = origin.clone();

    for (let j = 1; j <= 8; j++) {
      const t = j / 8,
        next = new T.Vector3(
          x + Math.sin(t * 2.2 + angle) * 0.22 * t,
          base + height * t,
          z + Math.sin(t * 2.6) * 0.12,
        );
      segment(previous, next, color, origin);
      previous = next;
    }
    const count = type === 'fern' ? 12 : 8;

    for (let j = 0; j < count; j++) {
      const t = 0.15 + (j / count) * 0.8,
        tip = Math.sin(t * Math.PI) * 0.7 + 0.25,
        side = j % 2 ? -1 : 1,
        px = x + Math.sin(t * 2.2 + angle) * 0.22 * t;

      if (type === 'fern') {

        for (let side = -1; side <= 1; side += 2) {
          transform(
            px,
            base + height * t,
            z + Math.sin(t * 2.6) * 0.12,
            0.12 + tip * 0.14,
            tip * 0.8,
            1,
            0,
            angle,
            side * 1.05,
          );
          add(blade, color, origin, 0.65);
        }

      } else {
        transform(
          px,
          base + height * t,
          z + Math.sin(t * 2.6) * 0.12,
          type === 'red' ? 0.28 : 0.3 + tip * 0.3,
          tip * (type === 'red' ? 0.8 : 1.15),
          1,
          0.2,
          angle + j * 0.75,
          side * (0.65 + rng() * 0.3),
        );
        add(blade, color, origin, 0.65);
      }
    }
  }

  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? -1 : 1,
      x = side * (6 + random() * 7),
      z = -9 + random() * 13,
      height = 1.7 + random() * 1.2;
    plant(x, z, height, i % 4 === 0 ? 'red' : i % 3 === 0 ? 'fern' : 'kelp', i);
  }

  for (let i = 0; i < 30; i++) {
    const x = (random() - 0.5) * 27,
      z = -9 + random() * 15;
    plant(x, z, 0.35 + random() * 0.75, 'grass', i);
  }

  for (let i = 0; i < 10; i++) {
    const x = (i % 2 ? -1 : 1) * (2.8 + random() * 9),
      z = -7 + random() * 11;
    plant(x, z, 0.8 + random() * 0.9, i % 2 ? 'fern' : 'red', i);
  }
  
  let accentSeed = 81;
  const accentRandom = () => {
    accentSeed = (Math.imul(accentSeed, 1664525) + 1013904223) >>> 0;

    return accentSeed / 4294967296;
  };
  [
    [-5, -2, 3.4],
    [-4.1, -1, 3],
    [-3.4, -3, 3.6],
    [3.6, 0, 3.1],
    [4.3, -2, 3.6],
    [5.2, 1, 3.3],
  ].forEach(([x, z, h], i) => plant(x, z, h, i % 3 === 0 ? 'fern' : 'kelp', i, accentRandom));

  for (let i = 0; i < 6; i++) {
    const height = 1.1 + random(),
      width = height * (0.65 + random() * 0.2),
      { x, z } = place((i % 2 ? -1 : 1) * (5 + random() * 8), -7 + random() * 9, width),
      origin = new T.Vector3(x, elevation(x, z), z),
      yaw = (random() - 0.5) * 1.2,
      color = palette.fan[i % 3];
    const fanPoint = (a, t) =>
      new T.Vector3(
        x + Math.cos(yaw) * Math.sin(a) * width * t,
        origin.y + 0.25 + Math.cos(a) * height * t,
        z + Math.sin(yaw) * Math.sin(a) * width * t,
      );

    segment(origin, fanPoint(0, 0.25), color, origin, 1.4);

    for (let ray = 0; ray < 11; ray++) {
      const a = (ray / 10 - 0.5) * 2.5;
      let previous = fanPoint(a, 0.12);
      for (let j = 1; j <= 5; j++) {
        const t = 0.12 + j * 0.176,
          next = fanPoint(a, t);
        segment(previous, next, color, origin, 0.6 - j * 0.065);

        if (ray > 0 && j > 1) segment(next, fanPoint(a - 0.25, t - 0.06), color, origin, 0.27);
        previous = next;
      }
    }
  }

  const bulb = new T.SphereGeometry(1, 6, 4);

  for (let i = 0; i < 18; i++) {
    const { x, z } = place((random() - 0.5) * 25, -7 + random() * 12, 0.35),
      origin = new T.Vector3(x, elevation(x, z), z),
      color = ['#c7a4db', '#e7b89b', '#9ad5c6'][i % 3];
    transform(x, origin.y + 0.07, z, 0.25, 0.09, 0.25);
    add(bulb, '#627f86', origin, 0);

    for (let j = 0; j < 9; j++) {
      const angle = (j / 9) * Math.PI * 2,
        tip = origin
          .clone()
          .add(
            new T.Vector3(Math.cos(angle) * 0.25, 0.25 + random() * 0.25, Math.sin(angle) * 0.25),
          );
      segment(origin, tip, color, origin, 0.7);
      transform(tip.x, tip.y, tip.z, 0.055, 0.07, 0.055);
      add(bulb, color, origin, 1.4);
    }
  }

  const geometry = new T.BufferGeometry();

  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aGardenRoot', new T.Float32BufferAttribute(anchors, 3));
  geometry.setAttribute('aGardenSway', new T.Float32BufferAttribute(sways, 1));

  const material = toon('#ffffff', T.DoubleSide);
  material.vertexColors = true;

  const time = { value: 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGardenTime = time;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `
          #include <common>
          uniform float uGardenTime;
          attribute vec3 aGardenRoot;
          attribute float aGardenSway;
        `,
      )
      .replace(
        '#include <begin_vertex>',
        `
          #include <begin_vertex>
          float gardenHeight = max(0., position.y - aGardenRoot.y);
          float gardenWave = sin(uGardenTime * .65 + aGardenRoot.x * .7 + gardenHeight * .9);
          float rightCurrent = smoothstep(2.5, 5.5, aGardenRoot.x);
          transformed.x += rightCurrent * .65 + (gardenWave * .018 * aGardenSway + rightCurrent * .11) *
                                                    gardenHeight * gardenHeight;
          transformed.z +=
              cos(uGardenTime * .5 + aGardenRoot.z + gardenHeight) * gardenHeight * .025 * aGardenSway;
        `,
      );
  };

  material.customProgramCacheKey = () => 'entrance-garden-current-v3';

  const mesh = new T.Mesh(geometry, material);
  mesh.frustumCulled = false;
  root.add(mesh);
  stem.dispose();
  blade.dispose();
  bulb.dispose();
  
  return {
    update(t) {
      time.value = t;
    },
  };
}
