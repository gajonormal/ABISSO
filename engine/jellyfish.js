import * as T from './vendor/three.module.js';

export function buildJellyfish({ gene, dimensions, add, material }) {

  const [x, y, z] = dimensions,
    f = (gene.finSize ?? 1) * (gene.variant === 'veil' ? 1.18 : 1),
    length = gene.tailLength ?? 1;

  const segments = 32,
    rows = 14;

  const bellPoint = (row, angle, inner = false) => {
    const theta = ((row / rows) * Math.PI) / 2,
      s = Math.sin(theta),
      scallop = Math.cos(angle * 8),
      radius = s * (1 + 0.035 * scallop * s ** 6) * (inner ? 0.94 : 1);

    return new T.Vector3(
      x * radius * Math.cos(angle),
      y *
        (0.08 + Math.cos(theta) * (inner ? 0.87 : 0.98) - 0.08 * s ** 8 + 0.025 * scallop * s ** 8),
      z * radius * Math.sin(angle),
    );

  };

  function surface(points, rowCount, columnCount, mat) {
    const indices = [];
    for (let i = 0; i < rowCount - 1; i++)
      for (let j = 0; j < columnCount - 1; j++) {
        const a = i * columnCount + j,
          b = a + columnCount;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }

    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(points, 3));
    g.setIndex(indices);
    g.computeVertexNormals();

    return add(g, mat);
  }

  const bellMaterial = material.clone();

  bellMaterial.uniforms = { ...material.uniforms, uOpacity: { value: 0.64 } };
  bellMaterial.transparent = true;
  bellMaterial.depthWrite = false;
  bellMaterial.side = T.DoubleSide;

  const points = [];

  for (let i = 0; i <= rows * 2 + 1; i++)
    for (let j = 0; j <= segments; j++) {
      const inner = i > rows,
        row = inner ? rows * 2 + 1 - i : i;
      points.push(...bellPoint(row, (j / segments) * Math.PI * 2, inner).toArray());
    }

  const bell = surface(points, rows * 2 + 2, segments + 1, bellMaterial);
  bell.userData.jellyBell = true;
  bell.renderOrder = 2;

  const rim = [];

  for (const row of [rows - 1, rows])
    for (let j = 0; j <= segments; j++)
      rim.push(
        ...bellPoint(row, (j / segments) * Math.PI * 2)
          .multiply(new T.Vector3(1.008, 1, 1.008))
          .toArray(),
      );

  const skirt = surface(rim, 2, segments + 1, material);
  skirt.userData.jellyRim = true;

  const core = add(
    new T.SphereGeometry(1, 16, 10),
    material,
    [0, y * 0.22, 0],
    [x * 0.42, y * 0.3, z * 0.42],
  );

  core.userData.jellyCore = true;

  function trail(anchor, index, oral = false) {
    const angle = Math.atan2(anchor.z / z, anchor.x / x),
      extent =
        y * (oral ? 1.65 : 2.3) * f * length * (0.84 + 0.16 * Math.sin(index * 1.7 + gene.phase)),
      radius = (oral ? 0.022 : 0.01) * f;

    const curve = new T.CatmullRomCurve3(
      Array.from({ length: 7 }, (_, j) => {
        const t = j / 6,
          w = t * t;
        return anchor
          .clone()
          .add(
            new T.Vector3(
              Math.sin(t * 5 + index) * x * 0.25 * w,
              -extent * t,
              Math.cos(t * 4 + angle) * z * 0.25 * w,
            ),
          );
      }),

    );

    const steps = 32,

      radial = oral ? 8 : 6,
      geometry = new T.TubeGeometry(curve, steps, radius, radial, false),
      a = geometry.attributes.position;
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        center = curve.getPointAt(t),
        taper = (1 - 0.65 * t) * (oral ? 1 + 0.17 * Math.sin(t * 36 + index) * t : 1);

      for (let j = 0; j <= radial; j++) {
        const v = i * (radial + 1) + j;
        a.setXYZ(
          v,
          center.x + (a.getX(v) - center.x) * taper,
          center.y + (a.getY(v) - center.y) * taper,
          center.z + (a.getZ(v) - center.z) * taper,
        );
      }

    }

    geometry.computeVertexNormals();

    const mesh = add(geometry, material);

    mesh.userData.jellyTentacle = true;
    mesh.userData.jellyOral = oral;
    mesh.userData.jellyAnchor = anchor.clone();
    mesh.userData.jellyRootCount = radial + 1;

    return mesh;
  }

  const count =
    (gene.variant === 'veil' ? 12 : 8) +
    ([gene.mutation, gene.mutation2].includes('splitTail') ? 4 : 0);

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2,
      anchor = bellPoint(rows - 1, angle);
    const mesh = trail(anchor, i);
    mesh.userData.jellyBellRow = rows - 1;
    mesh.userData.jellyAngle = angle;
  }

  for (let i = 0; i < 4; i++) {

    const angle = (i * Math.PI) / 2;
    trail(new T.Vector3(Math.cos(angle) * x * 0.2, y * 0.18, Math.sin(angle) * z * 0.2), i, true);
  }
  
}
