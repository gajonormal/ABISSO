import * as T from './vendor/three.module.js';
import { buildShrimp } from './shrimp.js';
import { buildSnailShell } from './shells.js';

export function buildInvertebrate({ gene, dimensions, add, material, white, black }) {
  const { species } = gene;

  if (!['shrimp', 'snail', 'crab'].includes(species)) return false;
  const [x, y, z] = dimensions;
  const antennaLength = gene.antennaLength ?? 1,
    clawSize = gene.clawSize ?? 1;

  const pivot = (meshes, position, part, index = 0) => {
    const group = new T.Group(),
      parent = meshes[0].parent;
    group.position.set(...position);
    group.userData.articulation = { part, index };
    parent.add(group);

    for (const mesh of meshes) {
      mesh.position.sub(group.position);
      group.add(mesh);
    }

    return group;
  };

  const tube = (points, radius = 0.009) =>
    add(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        8,
        radius,
        4,
        false,
      ),
    );

  const eye = (position) => [
    add(new T.SphereGeometry(0.032 * (gene.eyeSize || 1), 8, 6), white, position),
    add(new T.SphereGeometry(0.018 * (gene.eyeSize || 1), 8, 6), black, [
      position[0] + 0.025,
      position[1],
      position[2],
    ]),
  ];

  if (species === 'crab') {
    add(new T.SphereGeometry(1, 14, 8), material, [0, 0, 0], [x, y, z]);

    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const leg = tube(
          [
            [-x * 0.5 + i * x * 0.3, 0, side * z * 0.7],
            [-x * 0.7 + i * x * 0.35, -y * 0.3, side * z * 1.6],
            [-x * 0.8 + i * x * 0.4, -y * 1.2, side * z * 1.85],
          ],
          0.012,
        );
        pivot([leg], [-x * 0.5 + i * x * 0.3, 0, side * z * 0.7], 'leg', i + (side === 1 ? 4 : 0));
      }

      const arm = tube(
        [
          [x * 0.65, 0, side * z * 0.6],
          [x * 1.3, y * 0.35, side * z * 1.3],
          [x * 1.5, y * 0.4, side * z * 1.1],
        ],
        0.022,
      );

      const jaws = [];

      for (const jaw of [-1, 1]) {
        const mesh = add(
          new T.ConeGeometry(0.043 * clawSize, 0.12 * clawSize, 6),
          material,
          [x * 1.55, y * 0.6 + jaw * 0.035, side * z * 1.15],
          [1, 1, 0.7],
        );
        mesh.rotation.z = -Math.PI * 0.5 + jaw * 0.3;
        const hinge = pivot([mesh], [x * 1.4, y * 0.6, side * z * 1.15], 'jaw', jaw);
        jaws.push(hinge);
      }

      pivot([arm, ...jaws], [x * 0.65, 0, side * z * 0.6], 'claw', side);
      const stalk = tube(
        [
          [x * 0.6, y * 0.5, side * z * 0.3],
          [x * 0.75, y * 1.4, side * z * 0.35],
        ],
        0.009,
      );
      pivot(
        [stalk, ...eye([x * 0.75, y * 1.5, side * z * 0.35])],
        [x * 0.6, y * 0.5, side * z * 0.3],
        'stalk',
        side,
      );
    }
  } else if (species === 'shrimp') {
    buildShrimp({ gene, dimensions, add, material, white, black });
  } else {
    const footGeometry = new T.SphereGeometry(1, 32, 16),
      vertices = footGeometry.attributes.position;

    for (let i = 0; i < vertices.count; i++) vertices.setY(i, Math.max(-0.65, vertices.getY(i)));

    footGeometry.computeVertexNormals();

    const footMaterial = material.clone();
    footMaterial.uniforms = { ...material.uniforms, uMutation: { value: 0 } };
    
    const foot = add(footGeometry, footMaterial, [0, -y * 0.55, 0], [x * 1.35, y * 0.45, z * 0.85]);
    foot.userData.footRest = foot.geometry.attributes.position.array.slice();

    const contact = add(
      new T.CircleGeometry(1, 24),
      new T.MeshBasicMaterial({
        color: '#273139',
        transparent: true,
        opacity: 0.13,
        depthWrite: false,
      }),
      [0, -y * 0.8425 + 0.001, 0],
      [x * 1.25, z * 0.75, 1],
    );

    contact.rotation.x = -Math.PI / 2;
    contact.userData.snailContactShadow = true;
    const mantle = add(
      new T.SphereGeometry(1, 24, 14),
      footMaterial,
      [-x * 0.24, -y * 0.34, 0],
      [x * 0.92, y * 0.42, z * 0.92],
    );

    mantle.userData.snailMantle = true;

    buildSnailShell({ gene, dimensions, add, material });
    const headPieces = [
      add(
        new T.SphereGeometry(1, 20, 12),
        footMaterial,
        [x * 0.85, -y * 0.32, 0],
        [x * 0.46, y * 0.3, z * 0.6],
      ),
    ];

    for (const side of [-1, 1]) {
      const tip = [
        x * (0.7 + 0.55 * antennaLength),
        y * (-0.25 + 0.9 * antennaLength),
        side * z * 0.5,
      ];
      const stalk = tube([[x * 0.7, -y * 0.25, side * z * 0.4], tip], 0.011);
      headPieces.push(
        pivot([stalk, ...eye(tip)], [x * 0.7, -y * 0.25, side * z * 0.4], 'stalk', side),
      );

      const feeler = tube(
        [
          [x * 1.05, -y * 0.45, side * z * 0.4],
          [x * 1.45, -y * 0.35, side * z * 0.7],
        ],
        0.006,
      );

      headPieces.push(pivot([feeler], [x * 1.05, -y * 0.45, side * z * 0.4], 'snailFeeler', side));
    }

    const head = pivot(headPieces, [x * 0.65, -y * 0.32, 0], 'snailHead');
    head.userData.restPosition = head.position.clone();
  }

  return true;

}

export function animateInvertebrate(fish, time, dt) {

  if (!['crab', 'shrimp', 'snail'].includes(fish.gene.species)) return;

  const m = fish.motion,
    speed = Math.hypot(m.velocity.x, m.velocity.z);
  const pace = fish.gene.species === 'snail' ? 0.12 : fish.gene.species === 'shrimp' ? 0.8 : 1;
  const moving = Math.min(1, speed / Math.max(0.01, fish.gene.speed * pace));
  const stride = ((fish.walkStride ?? 0.13) * fish.root.scale.x) / fish.adultScale.x;

  m.gaitPhase =
    (m.gaitPhase ?? m.phase) +
    dt *
      speed *
      (fish.gene.species === 'crab'
        ? 32
        : fish.gene.species === 'shrimp'
          ? (Math.PI * 2) / stride
          : 78);
  const swim = m.swimBlend ?? 0,
    stroke = m.swimStroke ?? 0,
    escape = m.escapeUntil > time;

  const flow = time * 4.8 + m.phase,
    smooth = dt > 0 && fish.poseInitialized ? 1 - Math.exp(-dt * 12) : 1;
  fish.poseInitialized = true;

  const angle = (child, axis, target) =>
    (child.rotation[axis] += (target - child.rotation[axis]) * smooth);
  fish.root.traverse((child) => {
    const joint = child.userData.articulation;

    if (joint) {
      const { part, index } = joint;
      const rest = joint.restAngle ?? 0;

      if (part === 'shrimpBody') {
        angle(
          child,
          'z',
          Math.sin(flow - 0.45) * 0.065 * swim +
            Math.sin(m.gaitPhase) * 0.022 * moving * (1 - swim),
        );
        angle(child, 'y', Math.sin(flow * 0.5) * 0.045 * swim);
        angle(child, 'x', Math.sin(flow * 0.7) * 0.045 * swim);
        child.position.y = Math.sin(flow - 0.6) * 0.018 * swim;

      } else if (part === 'shrimpAbdomen') {
        const walking =
          0.008 + index * 0.001 + Math.sin(m.gaitPhase - index * 0.3) * 0.004 * moving;
        angle(
          child,
          'z',
          walking * (1 - swim) +
            swim *
              (rest * 0.35 +
                0.045 * Math.sin(flow - index * 0.48) +
                stroke * (escape ? 0.16 : 0.095)),
        );
        angle(
          child,
          'y',
          Math.sin(flow - index * 0.45) * 0.024 * swim +
            Math.sin(m.gaitPhase - index * 0.3) * 0.006 * moving * (1 - swim),
        );

      } else if (part === 'shrimpLeg') {
        if (swim < 0.02) return;
        const step = m.gaitPhase + index * 0.95;
        angle(
          child,
          'z',
          Math.sin(step) * 0.26 * moving * (1 - swim) -
            swim * 0.22 +
            swim * Math.sin(flow + index * 0.7) * 0.08,
        );
        angle(
          child,
          'x',
          (index < 5 ? 1 : -1) * (0.5 - 0.5 * Math.cos(step)) * 0.15 * moving * (1 - swim),
        );

      } else if (part === 'shrimpKnee') {

        if (swim >= 0.02)
          child.rotation.z =
            -0.35 * swim -
            Math.max(0, Math.sin(m.gaitPhase + index * 0.95)) * 0.28 * moving * (1 - swim);
      } else if (part === 'shrimpSwimmer') {
        angle(
          child,
          'z',
          rest + Math.sin(time * 8 + m.phase - (index % 4) * 0.8) * (swim * 0.6 + 0.1 * moving),
        );
        angle(
          child,
          'x',
          Math.cos(time * 8 + m.phase - (index % 4) * 0.8) * swim * 0.15 * (index < 4 ? -1 : 1),
        );

      } else if (part === 'shrimpFan') {
        angle(child, 'z', swim * (stroke * -0.46 + Math.sin(flow) * 0.12));
        child.scale.z = 1 - swim * stroke * 0.25;
      } else if (part === 'shrimpAntenna') {
        angle(child, 'y', Math.sin(time * 1.3 + m.phase + index) * 0.12);
        angle(child, 'z', Math.cos(time * 1.1 + m.phase + index) * 0.09 - swim * 0.04);
      } else if (part === 'shrimpEyes') {
        angle(child, 'y', Math.sin(time * 1.1 + m.phase + index) * 0.13);
        angle(child, 'z', Math.cos(time * 0.9 + m.phase + index) * 0.07);
      } else if (part === 'shrimpFeeler') {
        angle(child, 'z', Math.sin(time * 6 + m.phase + index) * 0.24);
      } else if (part === 'snailHead') {
        child.position.copy(child.userData.restPosition);
        child.position.x += Math.sin(m.gaitPhase - 0.6) * 0.028 * moving;
        angle(child, 'y', Math.sin(time * 0.9 + m.phase) * 0.08);
        child.scale.x = 1 + Math.sin(m.gaitPhase) * 0.08 * moving;
      } else if (part === 'snailFeeler') {
        angle(child, 'y', Math.sin(time * 1.4 + m.phase + index) * 0.22);
      } else if (part === 'leg') {
        const step = m.gaitPhase + index * Math.PI * 0.75;
        child.rotation.x = (index < 4 ? 1 : -1) * Math.max(0, Math.sin(step)) * 0.32 * moving;
        child.rotation.y = Math.cos(step) * 0.22 * moving;
      } else if (part === 'claw') {
        child.rotation.y = Math.sin(time * 1.7 + m.phase + index) * 0.16;
        child.rotation.z = Math.sin(time * 2.1 + m.phase) * 0.13;
      } else if (part === 'jaw')
        child.rotation.z = Math.sin(time * (fish.targetFood ? 8 : 2) + m.phase) * 0.18 * index;
      else if (part === 'antenna' || part === 'stalk') {
        const snail = fish.gene.species === 'snail';
        angle(
          child,
          'y',
          Math.sin(time * (snail ? 0.9 : 1.8) + m.phase + index) * (snail ? 0.23 : 0.22),
        );
        angle(
          child,
          'z',
          Math.cos(time * (snail ? 0.7 : 1.3) + m.phase + index) * (snail ? 0.13 : 0.13),
        );
      } else if (part === 'tail') child.rotation.y = Math.sin(m.gaitPhase) * 0.32 * moving;
    }
    if (child.userData.segment !== undefined) {

      const i = child.userData.segment;
      child.position.copy(child.userData.restPosition);
      child.position.z += Math.sin(m.gaitPhase - i * 0.65) * 0.009 * i * moving;
      child.rotation.y = Math.cos(m.gaitPhase - i * 0.65) * 0.045 * i * moving;
    }
    if (child.userData.footRest) {

      const rest = child.userData.footRest,
        a = child.geometry.attributes.position;

      for (let i = 0; i < a.array.length; i += 3) {
        const contact = rest[i + 1] <= -0.649;
        const weight = T.MathUtils.clamp((rest[i + 1] + 0.65) * 1.5, 0, 1);
        const wave = Math.sin(rest[i] * 8 - m.gaitPhase);
        a.array[i] = rest[i] + (contact ? 0 : wave * 0.095 * moving * weight);
        a.array[i + 1] = rest[i + 1] + wave * 0.18 * moving * weight;
        a.array[i + 2] = rest[i + 2] * (1 + wave * 0.055 * moving * weight);
      }
      a.needsUpdate = true;
      child.geometry.computeVertexNormals();
    }
    if (child.userData.snailShell) {

      const weight = child.userData.shellType === 'stone' ? 0.4 : 1;
      angle(child, 'z', Math.sin(m.gaitPhase - 0.6) * 0.045 * moving * weight);
      angle(child, 'x', Math.sin(m.gaitPhase * 0.5) * 0.025 * moving * weight);
    }
    if (child.userData.shrimpCarapace) {

      child.scale.y = child.userData.restScale.y * (1 + Math.sin(flow) * 0.026 * swim);
      child.scale.z = child.userData.restScale.z * (1 + Math.cos(flow) * 0.024 * swim);
    }
    if (child.userData.flexRest) {

      const a = child.geometry.attributes.position,
        rest = child.userData.flexRest;
        
      for (let i = 0; i < a.count; i++) {
        const weight = Math.min(1, Math.abs(rest[i * 3]) / child.userData.flexLength);
        a.setY(
          i,
          rest[i * 3 + 1] +
            Math.sin(flow * 1.2 - weight * 2 + child.userData.flexPhase) *
              weight *
              weight *
              0.016 *
              (0.3 + 0.7 * swim),
        );
        a.setZ(
          i,
          rest[i * 3 + 2] +
            Math.sin(flow * 0.8 - weight * 2 + child.userData.flexPhase) * weight * weight * 0.009,
        );
      }
      a.needsUpdate = true;
      child.geometry.computeVertexNormals();
      child.geometry.computeBoundingBox();
    }
  });
}
