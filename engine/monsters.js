import * as T from './vendor/three.module.js';

export function buildMonsterTraits({ gene, dimensions, add, material, white, black, shine }) {

  const rawAdd = add;
  let tag = null,
    binding = null;
  add = (...args) => {
    const mesh = rawAdd(...args);

    if (tag) {
      mesh.userData.mutationTag = tag;
      mesh.userData.mutationAttachment = { ...binding };
    }
    return mesh;
  };

  const attach = (kind, key, anchor, radius = 0.012, flex = 0, phase = 0) => {
    tag = kind;
    binding = { key, anchor: [...anchor], radius, flex, phase };
  };

  const [x, y, z] = dimensions,
    size = gene.mutationSize ?? 1;
  const mutations = new Set([gene.mutation, gene.mutation2]);
  const tube = (points, radius, mat = material) =>
    add(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        20,
        radius,
        6,
        false,
      ),
      mat,
    );

  if (gene.species === 'angler') {
    const lure = tube(
      [
        [x * 0.35, y * 0.8, 0],
        [x * 0.5, y + 0.25, 0],
        [x * 1.15, y + 0.2, 0],
        [x * 1.3, y * 0.8, 0],
      ],
      0.012,
    );

    lure.userData.monsterLure = true;
    const light = new T.MeshBasicMaterial({ color: new T.Color(gene.accent).multiplyScalar(2.5) });
    const bulb = add(new T.SphereGeometry(0.042, 12, 8), light, [x * 1.3, y * 0.8, 0]);
    bulb.userData.monsterGlow = new T.Color(gene.accent);
  }

  if (mutations.has('extraEyes')) {
    const pairs = T.MathUtils.clamp(Math.round(gene.eyePairs ?? 2), 1, 4);

    for (let i = 0; i < pairs; i++)
      for (const side of [-1, 1]) {
        const nx = 0.45 - i * 0.14,
          ny = 0.32 + 0.12 * Math.sin(i * 1.4),
          surface = Math.sqrt(Math.max(0.15, 1 - nx * nx - ny * ny));
        const radius =
          (gene.species === 'snail' ? 0.022 : 0.032) * (gene.eyeSize ?? 1) * (1 - i * 0.09);
        const position =
          gene.species === 'snail'
            ? [x * (0.5 - i * 0.5), y * 0.05, side * z * 0.6]
            : [x * nx, y * ny, side * z * surface];
        attach('extraEyes', 'eye:' + i + ':' + side, position, radius);
        const eye = add(new T.SphereGeometry(radius, 12, 8), white, position);
        eye.userData.extraEye = true;
        add(new T.SphereGeometry(radius * 0.6, 10, 8), black, [
          position[0] + radius * 0.15,
          position[1],
          position[2] + side * radius * 0.76,
        ]);
        add(new T.SphereGeometry(radius * 0.18, 6, 4), shine, [
          position[0] + radius * 0.17,
          position[1] + radius * 0.24,
          position[2] + side * radius * 1.1,
        ]);
      }
  }

  if (mutations.has('horns'))

    for (const side of [-1, 1]) {
      const points = [
        [x * 0.55, y * 0.65, side * z * 0.55],
        [x * 0.5, y + 0.18 * size, side * (z + 0.08 * size)],
        [x * 0.15, y + 0.3 * size, side * (z + 0.1 * size)],
      ];
      attach('horns', 'horn:' + side, points[0], 0.018 * size);
      tube(points, 0.018 * size);
      const tip = add(new T.ConeGeometry(0.018 * size, 0.09 * size, 7), material, points[2]);
      tip.rotation.z = 0.9;
    }

  if (mutations.has('tendrils'))

    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1,
        row = i % 3,
        base = [x * 0.65, y * (0.25 - row * 0.12), side * z * 0.7];
      attach('tendrils', 'tendril:' + i, base, 0.009 * size, 0.025, i);
      const tendril = tube(
        [
          base,
          [x * 0.85, y + 0.05, side * (z + 0.07)],
          [x * 0.75 - 0.05 * row, y + 0.16 * size, side * (z + 0.16 * size)],
          [x * 0.3 - 0.07 * row, y + 0.12 * size, side * (z + 0.23 * size)],
        ],
        0.009 * size,
      );

      tendril.userData.monsterFlex = tendril.geometry.attributes.position.array.slice();
      tendril.userData.flexIndex = i;
      tendril.userData.flexBase = new T.Vector3(...base);
    }

  if (mutations.has('finFilaments'))

    for (let i = 0; i < 3; i++) {
      const base = [-x * 0.8, y * (i - 1) * 0.35, 0];
      attach('finFilaments', 'filament:' + i, base, 0.007, 0.024, i);
      const filament = tube(
        [
          base,
          [-x - 0.12 * size, y * (i - 1) * 0.55, 0.04],
          [-x - 0.32 * size, y * (i - 1) * 0.65, 0.06],
        ],
        0.007,
      );
      filament.userData.finFilament = true;
    }

  if (mutations.has('frill'))
    
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const base = [x * 0.12, y * (i - 1) * 0.25, side * z * 0.85];
        attach('frill', 'frill:' + side + ':' + i, base, 0.013, 0.018, i + side);
        const tip = [x * 0.04, y * (i - 1) * 0.25 + 0.08 * size, side * (z + 0.15 * size)];
        const frill = tube(
          [base, [x * 0.03, y * (i - 1) * 0.25 + 0.04, side * (z + 0.08)], tip],
          0.013,
        );
        frill.userData.branchGill = true;

        for (const offset of [-1, 1])
          tube([tip, [tip[0] - 0.055, tip[1] + offset * 0.04, tip[2] + side * 0.04]], 0.006);
      }
}

export function animateMonsterTrait(child, fish, time) {

  if (child.userData.monsterGlow) {
    const color = child.material.color || child.material.uniforms?.uColor?.value;
    color
      ?.copy(child.userData.monsterGlow)
      .multiplyScalar(2.0 + 0.7 * Math.sin(time * 2 + fish.gene.phase));
  }

  if (child.userData.monsterFlex) {
    const a = child.geometry.attributes.position,
      rest = child.userData.monsterFlex,
      base = child.userData.flexBase;

    for (let i = 0; i < a.count; i++) {
      const distance = Math.hypot(
          rest[i * 3] - base.x,
          rest[i * 3 + 1] - base.y,
          rest[i * 3 + 2] - base.z,
        ),
        weight = Math.min(1, distance / 0.3);
      a.setY(
        i,
        rest[i * 3 + 1] +
          Math.sin(time * 3.2 - distance * 8 + child.userData.flexIndex) * weight * 0.025,
      );
      a.setZ(
        i,
        rest[i * 3 + 2] +
          Math.cos(time * 2.6 - distance * 8 + child.userData.flexIndex) * weight * 0.025,
      );
    }
    
    a.needsUpdate = true;
    child.geometry.computeVertexNormals();
    child.geometry.computeBoundingBox();
  }
}
