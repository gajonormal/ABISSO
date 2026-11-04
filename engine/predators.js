import * as T from './vendor/three.module.js';

export function buildPredatorDetails({
  gene,
  dimensions,
  add,
  material,
  polygon,
  white,
  black,
  shine,
}) {
  const [x, y, z] = dimensions,
    f = gene.finSize ?? 1;

  if (gene.species === 'swordfish') {
    const bill = new T.ConeGeometry(1, 1, 12, 12),
      p = bill.attributes.position;

    for (let i = 0; i < p.count; i++) {
      
      const t = p.getY(i) + 0.5;
      p.setXYZ(i, x * (0.8 + t * 1.15), y * 0.15 + p.getX(i) * y * 0.11, p.getZ(i) * z * 0.2);
    }
    bill.computeVertexNormals();
    add(bill).userData.swordBill = true;
    add(
      polygon([
        [x * 0.9, -y * 0.15, 0],
        [x * 1.16, -y * 0.03, 0],
        [x * 0.96, -y * 0.28, 0],
      ]),
    );
    add(
      polygon([
        [x * 0.16, y * 0.94, 0],
        [-x * 0.16, y * (2.1 + 0.25 * f), 0],
        [-x * 0.26, y * 1.2, 0],
        [-x * 0.64, y * 0.82, 0],
      ]),
    ).userData.predatorDorsal = true;

    for (const side of [-1, 1])
      add(
        polygon([
          [x * 0.18, -y * 0.25, side * z * 0.75],
          [-x * 0.4, -y * 0.52, side * z * (2.2 + 0.25 * f)],
          [-x * 0.17, -y * 0.15, side * z * 0.82],
        ]),
      );
    const back = -x * 0.82,
      length = x * 0.65 * (gene.tailLength ?? 1);

    for (const side of [gene.mutation, gene.mutation2].includes('splitTail') ? [-1, 1] : [0]) {
      const points = [
        [back, y * 0.1, 0],
        [back - length * 0.76, y * 2.1 * f, 0],
        [back - length * 0.48, y * 0.5, 0],
        [back - length * 0.25, 0, 0],
        [back - length * 0.48, -y * 0.5, 0],
        [back - length * 0.76, -y * 2.1 * f, 0],
        [back, -y * 0.1, 0],
      ];
      points.forEach(
        (p) => (p[2] = side * z * (0.12 + 0.35 * Math.min(1, (back - p[0]) / length))),
      );
      add(polygon(points)).userData.predatorTail = true;
    }
  }

  if (gene.species === 'monkfish') {

    for (const side of [-1, 1]) {
      add(
        polygon([
          [x * 0.15, -y * 0.2, side * z * 0.63],
          [-x * 0.07, -y * 0.2, side * z * (1.45 + 0.1 * f)],
          [-x * 0.42, -y * 0.25, side * z * 1.28],
          [-x * 0.35, -y * 0.12, side * z * 0.6],
        ]),
      ).userData.monkPectoral = true;
      const eye = 0.037 * (gene.eyeSize ?? 1),
        position = [x * 0.43, y * 0.78, side * z * 0.47];
      add(new T.SphereGeometry(eye, 12, 8), white, position);
      add(new T.SphereGeometry(eye * 0.62, 10, 8), black, [
        position[0] + eye * 0.2,
        position[1] + eye * 0.55,
        position[2] + side * eye * 0.3,
      ]);
      add(new T.SphereGeometry(eye * 0.18, 6, 4), shine, [
        position[0] + eye * 0.22,
        position[1] + eye * 0.8,
        position[2] + side * eye * 0.3,
      ]);

      for (let i = 0; i < 5; i++) {

        const px = x * (0.65 - i * 0.26),
          points = [
            new T.Vector3(px, 0, side * z * 0.85),
            new T.Vector3(px - x * 0.08, -y * 0.15, side * z * 1.08),
            new T.Vector3(px - x * 0.16, -y * 0.1, side * z * 1.12),
          ];
        add(new T.TubeGeometry(new T.CatmullRomCurve3(points), 8, 0.007, 5, false));
      }
    }

    const lure = add(
      new T.TubeGeometry(
        new T.CatmullRomCurve3([
          new T.Vector3(x * 0.25, y * 0.8, 0),
          new T.Vector3(x * 0.35, y * 2.3, 0),
          new T.Vector3(x * 0.85, y * 2.2, 0),
          new T.Vector3(x * 0.93, y * 1.6, 0),
        ]),
        24,
        0.007,
        6,
        false,
      ),
    );

    lure.userData.monkLure = true;
    add(new T.SphereGeometry(0.019, 10, 8), material, [x * 0.93, y * 1.6, 0]);
    add(
      polygon([
        [-x * 0.25, y * 0.65, 0],
        [-x * 0.52, y * 1.15 * f, 0],
        [-x * 0.83, y * 0.25, 0],
      ]),
    );

    for (const side of [gene.mutation, gene.mutation2].includes('splitTail') ? [-1, 1] : [0]) {

      const points = [
        [-x * 0.83, y * 0.08, 0],
        [-x * 1.5, y * 0.75 * f, 0],
        [-x * 1.6, 0, 0],
        [-x * 1.5, -y * 0.75 * f, 0],
        [-x * 0.83, -y * 0.08, 0],
      ];
      points.forEach(
        (p) => (p[2] = side * z * (0.1 + 0.35 * Math.max(0, (-p[0] / x - 0.83) / 0.77))),
      );
      add(polygon(points)).userData.predatorTail = true;
    }
  }
}
