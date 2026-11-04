import * as T from './vendor/three.module.js';
import { hash, rng } from './genes.js';

export function buildSnailShell({ gene, dimensions, add, material }) {
  const [x, y, z] = dimensions,
    spire = gene.shellSpire ?? 1,
    type = gene.shellType || 'spiral';
  const shellMaterial = material.clone();
  shellMaterial.uniforms = {
    ...material.uniforms,
    uColor: { value: new T.Color(gene.shellColor || gene.color) },
    uAccent: {
      value:
        type === 'stone'
          ? new T.Color(gene.shellColor || gene.color).lerp(new T.Color('#c0c7c9'), 0.22)
          : material.uniforms.uAccent.value,
    },
    uPattern: { value: type === 'stone' ? 2 : material.uniforms.uPattern.value },
    uPatternScale: { value: type === 'stone' ? 2.2 : (gene.patternScale ?? 1) },
    uFinish: { value: type === 'stone' ? 0 : material.uniforms.uFinish.value },
    uMutation: { value: 0 },
  };

  const pieces = [];

  const put = (geometry, pos = [0, 0, 0], scale = [1, 1, 1], mat = shellMaterial) => {
    const m = add(geometry, mat, pos, scale);
    pieces.push(m);
    return m;
  };

  if (type === 'stone') {
    const random = rng(hash('stone:' + gene.id + ':' + gene.phase)),
      rockPhase = random() * Math.PI * 2,
      geometry = new T.IcosahedronGeometry(1, 1),
      a = geometry.attributes.position;

    for (let i = 0; i < a.count; i++) {
      const px = a.getX(i),
        py = a.getY(i),
        pz = a.getZ(i);
      const rough = 1 + 0.1 * Math.sin(px * 11 + py * 7 + pz * 9 + rockPhase);
      a.setXYZ(i, px * x * 1.1 * rough, (py + 1) * y * 1.1 * spire, pz * z * 1.15 * rough);
    }

    geometry.computeVertexNormals();
    put(geometry, [0, 0, 0], [0.92 + random() * 0.16, 1, 0.92 + random() * 0.16]);
  } else if (type === 'conical') {
    const points = [];

    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      points.push(
        new T.Vector2(
          y * Math.pow(1 - t, 0.8) * (0.95 + 0.055 * Math.sin(t * Math.PI * 10)),
          t * y * 2.1 * spire,
        ),
      );
    }

    const cone = new T.LatheGeometry(points, 32);
    cone.scale(1, 1, z / y);
    cone.rotateZ(0.3);
    put(cone);
    const coil = [];

    for (let i = 0; i <= 100; i++) {
      const t = i / 100,
        a = t * Math.PI * 10,
        r = y * 0.97 * Math.pow(1 - t, 0.8);
      coil.push(new T.Vector3(Math.cos(a) * r, t * y * 2.1 * spire, (Math.sin(a) * r * z) / y));
    }
    
    const ridge = new T.TubeGeometry(new T.CatmullRomCurve3(coil), 100, 0.004, 5, false);
    ridge.rotateZ(0.3);
    put(ridge);
  } else if (type === 'dome') {
    put(
      new T.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      [0, 0, 0],
      [x * 1.05, y * 1.5 * spire, z * 1.2],
    );
  } else if (type === 'scallop') {
    const geometry = new T.SphereGeometry(1, 32, 20),
      a = geometry.attributes.position;

    for (let i = 0; i < a.count; i++) {
      const px = a.getX(i),
        py = a.getY(i),
        pz = a.getZ(i),
        rib = 1 + 0.075 * Math.cos(Math.atan2(py, px) * 14);
      a.setXYZ(i, px * x * 1.12 * rib, (py + 1) * y * 1.0 * spire, pz * z * 0.55 * rib);
    }
    geometry.computeVertexNormals();
    put(geometry);
  } else {
    put(
      new T.SphereGeometry(1, 32, 20),
      [0, y * 1.16 * spire, 0],
      [x * 0.98, y * 1.16 * spire, z * 0.97],
    );
    const reliefMaterial = shellMaterial.clone();
    reliefMaterial.uniforms = {
      ...shellMaterial.uniforms,
      uColor: { value: shellMaterial.uniforms.uColor.value.clone().multiplyScalar(0.8) },
      uAccent: { value: shellMaterial.uniforms.uAccent.value.clone().multiplyScalar(0.8) },
    };

    for (const side of [-1, 1]) {
      const spiral = [];

      for (let i = 0; i <= 80; i++) {
        const t = i / 80,
          a = t * Math.PI * 4.5,
          r = 0.93 - t * 0.82;
        spiral.push(
          new T.Vector3(
            Math.cos(a) * x * 0.98 * r,
            y * 1.16 * spire + Math.sin(a) * y * 1.16 * spire * r,
            side * (z * 0.97 * Math.sqrt(1 - r * r) + 0.002),
          ),
        );
      }
      put(
        new T.TubeGeometry(new T.CatmullRomCurve3(spiral), 80, y * 0.065, 6, false),
        [0, 0, 0],
        [1, 1, 1],
        reliefMaterial,
      );
    }
  }

  const group = new T.Group();
  pieces[0].parent.add(group);

  group.userData.snailShell = true;
  group.userData.shellType = type;

  for (const m of pieces) group.add(m);

  const bounds = new T.Box3().setFromObject(group);

  for (const m of pieces) m.position.y -= bounds.min.y;

  group.position.set(-x * 0.24, -y * 0.28, 0);
  group.userData.shellSocketY = -y * 0.28;
  
  return group;
}
