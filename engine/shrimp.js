import * as T from './vendor/three.module.js';

export function buildShrimp({ gene, dimensions, add, material, white, black }) {

  const [x, y, z] = dimensions,
    antennaLength = gene.antennaLength ?? 1;
  const body = add(
    new T.SphereGeometry(1, 24, 14),
    material,
    [x * 0.18, y * 0.14, 0],
    [x * 0.62, y * 1.02, z],
  );

  const root = body.parent;

  body.userData.shrimpCarapace = true;
  body.userData.restScale = body.scale.clone();

  const group = (parent, position, part, index = 0, angle = 0) => {
    const g = new T.Group();
    g.position.set(...position);
    g.rotation.z = angle;
    g.userData.articulation = { part, index, restAngle: angle };
    parent.add(g);

    return g;
  };
  
  const mesh = (parent, geometry, mat = material, position = [0, 0, 0], scale = [1, 1, 1]) => {
    const m = add(geometry, mat, position, scale);
    parent.add(m);

    return m;
  };

  const tube = (parent, points, radius) =>
    mesh(
      parent,
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        18,
        radius,
        6,
        false,
      ),
    );

  const leaf = (parent, length, width, position, angle = 0) => {
    const shape = new T.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(-length * 0.28, width, -length * 0.9, width * 0.75, -length, 0);
    shape.bezierCurveTo(-length * 0.9, -width * 0.75, -length * 0.28, -width, 0, 0);
    const geometry = new T.ShapeGeometry(shape, 10);
    geometry.rotateX(Math.PI / 2);
    const m = mesh(parent, geometry, material, position);
    m.rotation.y = angle;
    m.userData.flexRest = geometry.attributes.position.array.slice();
    m.userData.flexLength = length;
    m.userData.flexPhase = angle;

    return m;
  };

  const rostrum = mesh(
    root,
    new T.ConeGeometry(y * 0.27, x * 0.65, 10),
    material,
    [x * 0.94, y * 0.38, 0],
    [1, 1, 0.55],
  );

  rostrum.rotation.z = -Math.PI / 2;
  tube(
    root,
    [
      [x * -0.25, y * 0.94, 0],
      [x * 0.18, y * 1.16, 0],
      [x * 0.68, y * 0.83, 0],
      [x * 1.22, y * 0.52, 0],
    ],
    0.005,
  );

  let parent = root;

  const segmentLength = x * 0.245;

  for (let i = 0; i < 6; i++) {
    const joint = group(
      parent,
      i === 0 ? [-x * 0.34, y * 0.1, 0] : [-segmentLength, 0, 0],
      'shrimpAbdomen',
      i,
      0.1 + i * 0.045,
    );

    const taper = 1 - i * 0.105;
    mesh(
      joint,
      new T.SphereGeometry(1, 18, 10),
      material,
      [-segmentLength * 0.52, 0, 0],
      [segmentLength * 0.68, y * 0.91 * taper, z * 0.94 * taper],
    );
    const rim = [];

    for (let j = 0; j <= 14; j++) {
      const a = -0.3 + (Math.PI * 1.2 * j) / 14;
      rim.push([
        -segmentLength * 0.84,
        Math.sin(a) * y * 0.92 * taper,
        Math.cos(a) * z * 0.95 * taper,
      ]);
    }
    tube(joint, rim, 0.0035);

    if (i < 4)
      for (const side of [-1, 1]) {
        const paddle = group(
          joint,
          [-segmentLength * 0.4, -y * 0.55 * taper, side * z * 0.5 * taper],
          'shrimpSwimmer',
          i + (side > 0 ? 4 : 0),
        );
        leaf(paddle, x * 0.14, z * 0.22, [0, 0, 0]);
        paddle.rotation.z = -0.75;
        paddle.userData.articulation.restAngle = -0.75;
      }
    parent = joint;
  }
  const tail = group(parent, [-segmentLength, 0, 0], 'shrimpFan');

  for (let i = -2; i <= 2; i++)
    leaf(tail, x * (i === 0 ? 0.4 : 0.36) * (gene.tailLength ?? 1), z * 0.32, [0, 0, 0], i * 0.38);

  for (const side of [-1, 1]) {

    const eyes = group(root, [x * 0.6, y * 0.46, side * z * 0.52], 'shrimpEyes', side);
    tube(
      eyes,
      [
        [0, 0, 0],
        [x * 0.19, y * 0.26, side * z * 0.23],
      ],
      0.008,
    );
    mesh(eyes, new T.SphereGeometry(0.026 * (gene.eyeSize ?? 1), 14, 10), black, [
      x * 0.19,
      y * 0.26,
      side * z * 0.23,
    ]);
    mesh(eyes, new T.SphereGeometry(0.007, 8, 6), white, [x * 0.2, y * 0.38, side * z * 0.32]);
    const feeler = group(root, [x * 0.65, -y * 0.25, side * z * 0.18], 'shrimpFeeler', side);
    tube(
      feeler,
      [
        [0, 0, 0],
        [x * 0.2, -y * 0.3, side * z * 0.18],
        [x * 0.3, -y * 0.05, side * z * 0.28],
      ],
      0.004,
    );

    for (let i = 0; i < 5; i++) {
      const leg = group(
        root,
        [x * (0.52 - i * 0.17), -y * 0.39, side * z * 0.58],
        'shrimpLeg',
        i + (side > 0 ? 5 : 0),
      );

      leg.userData.walkUpper = new T.Vector3(x * 0.12, -y * 0.6, side * z * 0.37);
      leg.userData.walkLower = new T.Vector3(-x * 0.08, -y * 0.58, side * z * 0.17);
      tube(
        leg,
        [
          [0, 0, 0],
          [x * 0.12, -y * 0.6, side * z * 0.37],
        ],
        0.006,
      );
      const knee = group(
        leg,
        [x * 0.12, -y * 0.6, side * z * 0.37],
        'shrimpKnee',
        i + (side > 0 ? 5 : 0),
      );
      tube(
        knee,
        [
          [0, 0, 0],
          [-x * 0.08, -y * 0.58, side * z * 0.17],
        ],
        0.004,
      );
    }

    for (let i = 0; i < 2; i++) {
      const antenna = group(
        root,
        [x * 0.73, y * 0.22, side * z * 0.3],
        'shrimpAntenna',
        side * (i + 1),
      );
      const length = x * (i === 0 ? 1.55 : 0.88) * antennaLength;
      tube(
        antenna,
        [
          [0, 0, 0],
          [length * 0.35, y * 0.05, side * z * 0.35],
          [length * 0.72, -y * 0.18, side * z * 0.85],
          [length, -y * 0.65, side * z * 1.3],
        ],
        i === 0 ? 0.0035 : 0.0045,
      );
      const mesh = antenna.children[0];
      mesh.userData.flexRest = mesh.geometry.attributes.position.array.slice();
      mesh.userData.flexLength = length;
      mesh.userData.flexPhase = side * (i + 1);
    }
  }

  const bodyRoot = new T.Group();
  bodyRoot.userData.articulation = { part: 'shrimpBody', index: 0 };
  const pieces = [...root.children];
  root.add(bodyRoot);

  for (const piece of pieces) bodyRoot.add(piece);
}

export function groundShrimpFeet(fish, ground) {

  if (fish.gene.species !== 'shrimp') return;
  const m = fish.motion;
  const legs = fish.walkingLegs ?? (fish.walkingLegs = []);

  if (!legs.length)
    fish.root.traverse((o) => {

      if (o.userData.articulation?.part === 'shrimpLeg') legs.push(o);
    });

  if (m.swimBlend >= 0.02) {

    for (const leg of legs) delete leg.userData.step;

    return;
  }

  fish.root.updateMatrixWorld(true);
  const scale = fish.root.scale.x,
    stride = (fish.walkStride * scale) / fish.adultScale.x;
  const forward = new T.Vector3(Math.cos(m.currentYaw), 0, -Math.sin(m.currentYaw));

  for (const leg of legs) {

    const index = leg.userData.articulation.index;
    const phase =
      (((m.gaitPhase + (index % 5) * Math.PI * 0.4 + (index >= 5 ? Math.PI : 0)) % (Math.PI * 2)) +
        Math.PI * 2) %
      (Math.PI * 2);
    const swing = phase < Math.PI;
    const upper = leg.userData.walkUpper,
      lower = leg.userData.walkLower;
    const nominal = leg.position.clone().add(upper).add(lower).applyMatrix4(leg.parent.matrixWorld);
    nominal.y = ground + 0.001 + 0.004 * scale;
    let step = leg.userData.step;

    if (!step) {
      step = leg.userData.step = { foot: nominal.clone(), swing };

      if (swing) {
        step.start = nominal.clone().addScaledVector(forward, -stride * 0.25);
        step.goal = nominal.clone().addScaledVector(forward, stride * 0.25);
      }
    }
    
    if (swing && !step.swing) {
      step.start = step.foot.clone();
      step.goal = nominal
        .clone()
        .addScaledVector(forward, stride * 0.45)
        .addScaledVector(m.velocity, (stride * 0.28) / Math.max(0.01, m.velocity.length()));
      step.goal.y = nominal.y;
    }

    if (swing) {
      const t = phase / Math.PI,
        ease = t * t * (3 - 2 * t);
      step.foot.copy(step.start).lerp(step.goal, ease);
      step.foot.y += Math.sin(Math.PI * t) ** 2 * stride * 0.23;

    } else if (step.swing) step.foot.copy(step.goal);
    step.swing = swing;
    const l1 = upper.length(),
      l2 = lower.length();
    let target = leg.parent.worldToLocal(step.foot.clone()).sub(leg.position);

    if (target.length() > l1 + l2 - 0.0001) {

      const hip = leg.position.clone().applyMatrix4(leg.parent.matrixWorld);
      const max = (l1 + l2 - 0.0002) * scale,
        dy = step.foot.y - hip.y;
      const reach = Math.sqrt(Math.max(0, max * max - dy * dy)),
        dx = step.foot.x - hip.x,
        dz = step.foot.z - hip.z,
        d = Math.hypot(dx, dz);

      if (d > reach && d > 0) {
        step.foot.x = hip.x + (dx * reach) / d;
        step.foot.z = hip.z + (dz * reach) / d;
      }
      target = leg.parent.worldToLocal(step.foot.clone()).sub(leg.position);
    }
    const distance = T.MathUtils.clamp(
      target.length(),
      Math.abs(l1 - l2) + 0.0001,
      l1 + l2 - 0.0001,
    );
    const direction = target.clone().normalize(),

      bend = new T.Vector3(1, 0, 0).addScaledVector(direction, -direction.x).normalize();

    const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance);
    const joint = direction
      .clone()
      .multiplyScalar(along)
      .addScaledVector(bend, Math.sqrt(Math.max(0, l1 * l1 - along * along)));

    const end = direction.clone().multiplyScalar(distance);

    leg.quaternion.setFromUnitVectors(upper.clone().normalize(), joint.clone().normalize());

    const knee = leg.children.find((o) => o.userData.articulation?.part === 'shrimpKnee');

    const lowerRotation = new T.Quaternion().setFromUnitVectors(
      lower.clone().normalize(),
      end.sub(joint).normalize(),
    );
    knee.quaternion.copy(leg.quaternion).invert().multiply(lowerRotation);
    
    leg.updateMatrixWorld(true);
  }
}
