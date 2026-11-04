import * as T from './vendor/three.module.js';

function sweep(curve, radius, depth, segments = 48, sides = 12) {
  const points = [],
    indices = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments,
      c = curve.getPoint(t),
      tangent = curve.getTangent(t),
      n = new T.Vector3(tangent.y, -tangent.x, 0).normalize();

    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      points.push(
        c.x + n.x * Math.cos(a) * radius(t),
        c.y + n.y * Math.cos(a) * radius(t),
        c.z + Math.sin(a) * depth(t),
      );
    }
  }
  
  for (let i = 0; i < segments; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j,
        b = a + sides + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  g.setIndex(indices);
  g.computeVertexNormals();

  return g;
}

export function buildSeahorse({ gene, dimensions, add, material, white, black, shine }) {

  const [x, y, z] = dimensions,
    f = gene.finSize ?? 1;
  const curve = new T.CatmullRomCurve3(
    [
      [-0.1, -0.55],
      [0.2, -0.28],
      [0.23, 0.05],
      [-0.25, 0.43],
      [-0.34, 0.7],
      [-0.05, 0.88],
    ].map(([a, b]) => new T.Vector3(a * x, b * y, 0)),
  );

  const radius = (t) => x * (0.2 + 0.68 * Math.sin(Math.PI * t) ** 1.1),
    depth = (t) => z * (0.24 + 0.7 * Math.sin(Math.PI * t));
  const torso = add(sweep(curve, radius, depth));
  torso.userData.seahorseBody = true;

  function ellipsoid(center, scale, mat, rotation = 0) {
    const g = new T.SphereGeometry(1, 20, 12);
    g.scale(...scale);
    g.rotateZ(rotation);
    g.translate(...center);

    return add(g, mat);
  }

  ellipsoid(
    [x * 0.17, y * 0.8, 0],
    [x * 0.65, y * 0.24, z * 0.65],
    material,
    -0.38,
  ).userData.seahorseHead = true;
  const mouthSize = gene.mouthSize ?? 1;
  const snout = new T.CatmullRomCurve3([
    new T.Vector3(x * 0.48, y * 0.78, 0),
    new T.Vector3(x * 0.96, y * 0.69, 0),
    new T.Vector3(x * (1.35 + 0.16 * mouthSize), y * 0.59, 0),
  ]);

  const muzzle = add(
    sweep(
      snout,
      () => x * 0.15 * mouthSize,
      () => z * 0.23 * mouthSize,
      16,
      12,
    ),
  );

  muzzle.userData.seahorseSnout = true;
  const tip = snout.getPoint(1),
    opening = material.clone();
  opening.uniforms = {
    ...material.uniforms,
    uColor: { value: new T.Color('#292534') },
    uAccent: { value: new T.Color('#292534') },
    uPattern: { value: 0 },
    uFinish: { value: 0 },
    uEffect: { value: 0 },
  };

  const mouth = ellipsoid(
    tip.toArray(),
    [x * 0.04, y * 0.042 * mouthSize, z * 0.19 * mouthSize],
    opening,
  );

  mouth.userData.seahorseMouth = true;

  for (let i = 1; i < 11; i++) {
    const t = i / 12,
      c = curve.getPoint(t),
      v = curve.getTangent(t),
      n = new T.Vector3(v.y, -v.x, 0).normalize(),
      points = [];

    for (let j = 0; j <= 24; j++) {
      const a = (j / 24) * Math.PI * 2;
      points.push(
        c
          .clone()
          .addScaledVector(n, Math.cos(a) * radius(t) * 1.025)
          .add(new T.Vector3(0, 0, Math.sin(a) * depth(t) * 1.025)),
      );
    }
    add(new T.TubeGeometry(new T.CatmullRomCurve3(points), 24, x * 0.022, 5, false));
  }

  const tails = [gene.mutation, gene.mutation2].includes('splitTail') ? [-1, 1] : [0];

  for (const side of tails) {
    const points = [curve.getPoint(0), new T.Vector3(-x * 0.2, -y * 0.82, side * z * 0.18)];
    for (let i = 0; i <= 36; i++) {
      const t = i / 36,
        a = -Math.PI - t * Math.PI * 2,
        r = (1 - t * 0.85) * (gene.tailLength ?? 1);
      points.push(
        new T.Vector3(
          x * (0.48 + Math.sin(a) * 0.65 * r),
          y * (-0.99 + Math.cos(a) * 0.26 * r),
          side * z * 0.24,
        ),
      );
    }

    const tailCurve = new T.CatmullRomCurve3(points),
      geometry = sweep(
        tailCurve,
        (t) => x * 0.22 * (1 - 0.93 * t),
        (t) => z * 0.3 * (1 - 0.93 * t),
        64,
        10,
      ),
      tail = add(geometry);
    tail.userData.seahorseTail = true;
    tail.userData.seahorseRest = geometry.attributes.position.array.slice();
    tail.userData.seahorseTailRoots = 11;
    tail.userData.seahorseTailAnchor = curve.getPoint(0).toArray();
  }

  const fin = (base, tip, side = 0) => {
    const points = [],
      weights = [],
      indices = [],
      rows = 12,
      columns = 6;
      
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      for (let j = 0; j <= columns; j++) {
        const v = j / columns;
        points.push(
          base[0] + (tip[0] - base[0]) * v,
          base[1] + (t - 0.5) * y * 0.45,
          base[2] + (tip[2] - base[2]) * v,
        );

        weights.push(v * v);
      }
    }

    for (let i = 0; i < rows; i++)
      for (let j = 0; j < columns; j++) {
        const a = i * (columns + 1) + j,
          b = a + columns + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }

    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(points, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    const m = add(g);
    m.userData.seahorseFin = {
      rest: g.attributes.position.array.slice(),
      weights,
      side,
      rows,
      columns,
      height: y,
    };
  };

  fin([-x * 0.53, y * 0.1, 0], [-x * (0.9 + 0.18 * f), y * 0.1, 0]);

  for (const side of [-1, 1])
    fin(
      [x * 0.14, y * 0.6, side * z * 0.47],
      [-x * 0.18, y * 0.6, side * z * (0.9 + 0.2 * f)],
      side,
    );

  for (let i = 0; i < 3; i++) {
    const g = new T.ConeGeometry(x * (0.13 - i * 0.025), y * (0.19 + i * 0.025) * f, 7);
    g.rotateZ(0.25);
    g.translate(x * (-0.3 + i * 0.22), y * (1.04 - i * 0.025), 0);
    add(g);
  }

  const eye = (gene.eyeSize ?? 1) * 0.028;

  for (const side of [-1, 1]) {
    const center = [x * 0.44, y * 0.84, side * z * 0.57];
    add(new T.SphereGeometry(eye, 12, 8), white, center);

    add(new T.SphereGeometry(eye * 0.57, 10, 8), black, [
      center[0] + eye * 0.23,
      center[1],
      center[2] + side * eye * 0.72,
    ]);

    add(new T.SphereGeometry(eye * 0.17, 6, 4), shine, [
      center[0] + eye * 0.28,
      center[1] + eye * 0.25,
      center[2] + side * eye,
    ]);
  }
}

export function animateSeahorse(part, fish, time) {

  const activity = Math.min(
    1.6,
    fish.motion?.velocity?.length() / Math.max(0.05, fish.gene.speed) || 0.6,
  );

  const effort = 0.65 + activity * 0.35,
    phase = fish.gene.phase;

  if (part.userData.seahorseRest) {
    const a = part.geometry.attributes.position,
      rest = part.userData.seahorseRest,
      rows = 64,
      columns = 11;
    const [ax, ay] = part.userData.seahorseTailAnchor;

    for (let i = 0; i < a.count; i++) {
      const t = Math.floor(i / columns) / rows,
        w = T.MathUtils.smoothstep(t, 0, 1);
      
      const angle =
        (Math.sin(time * 2.7 + phase - t * 2.5) * 0.22 + Math.sin(time * 1.3 + phase) * 0.09) *
        w *
        effort;

      const dx = rest[i * 3] - ax,
        dy = rest[i * 3 + 1] - ay,
        c = Math.cos(angle),
        s = Math.sin(angle);
      a.setXYZ(
        i,
        ax + dx * c - dy * s,
        ay + dx * s + dy * c,
        rest[i * 3 + 2] + Math.sin(time * 2.4 + phase - t * 3) * w * 0.025 * effort,
      );
    }

    a.needsUpdate = true;
  }

  if (part.userData.seahorseFin) {
    const a = part.geometry.attributes.position,
      { rest, weights, side, height } = part.userData.seahorseFin;
      
    for (let i = 0; i < a.count; i++) {
      const w = weights[i],
        wave =
          Math.sin(
            time * (side ? 17 : 24) + phase + (rest[i * 3 + 1] / height) * 10 - Math.sqrt(w) * 2.8,
          ) *
          w *
          effort;
      a.setXYZ(
        i,
        rest[i * 3] + wave * height * 0.025,
        rest[i * 3 + 1] + wave * height * 0.025,
        rest[i * 3 + 2] + wave * height * (side ? 0.08 : 0.13),
      );
    }
    a.needsUpdate = true;
  }
}
