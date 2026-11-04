import * as T from './vendor/three.module.js';
import { hash } from './genes.js';
import { finEdge } from './morphology.js';

export function buildBlobTails({ gene, dimensions, add, material }) {
  const [x, y, z] = dimensions,
    f = gene.finSize ?? 1,
    split = [gene.mutation, gene.mutation2].includes('splitTail'),
    count = split ? 2 : 1;

  for (let tail = 0; tail < count; tail++) {
    const side = split ? (tail === 0 ? -1 : 1) : 0,
      length = x * (0.48 + 0.2 * (gene.tailLength ?? 1)),
      height = y * f * (gene.tail === 'round' ? 0.34 : 0.43);
    const points = [],
      indices = [],
      rings = 24,
      sides = 16;
    const sections = [
      [0, 0.27, 0.26],
      [0.32, 0.13, 0.13],
      [0.48, 0.1, 0.055],
      [0.78, height / y, 0.03],
      [1, 0.018, 0.008],
    ];

    for (let i = 0; i <= rings; i++) {
      const u = i / rings,
        k = Math.min(
          sections.length - 2,
          sections.findIndex((s, j) => j < sections.length - 1 && u <= sections[j + 1][0]),
        );
      const a = sections[Math.max(0, k)],
        b = sections[Math.max(0, k) + 1],
        t = T.MathUtils.smoothstep(u, a[0], b[0]);
      const ry = y * T.MathUtils.lerp(a[1], b[1], t),
        rz = z * T.MathUtils.lerp(a[2], b[2], t),
        spread = T.MathUtils.smoothstep(u, 0, 0.55);

      for (let j = 0; j <= sides; j++) {
        const angle = (j / sides) * Math.PI * 2,
          ruffle = gene.tail === 'feather' ? 1 + 0.1 * Math.sin(angle * 8) * spread : 1;
        points.push(
          -x * 0.7 - u * length,
          -y * 0.08 + Math.cos(angle) * ry * ruffle,
          side * z * (0.18 + 0.38 * spread) + Math.sin(angle) * rz,
        );
      }
    }

    for (let i = 0; i < rings; i++)
      for (let j = 0; j < sides; j++) {
        const a = i * (sides + 1) + j,
          b = a + sides + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const geometry = new T.BufferGeometry();

    geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const mesh = add(geometry, material);

    mesh.userData.blobTail = true;
    mesh.userData.tailIndex = tail;
    mesh.userData.tailRootCount = sides + 1;
    mesh.userData.tailSocket = new T.Vector3(-x * 0.7, -y * 0.08, side * z * 0.18);
  }
}

export function buildUnusualFish({ gene, dimensions, add, material, polygon }) {
  const [x, y, z] = dimensions,
    f = gene.finSize ?? 1;

  if (gene.species === 'blobfish') {
    const nose = add(
      new T.SphereGeometry(1, 20, 14),
      material,
      [x * 0.94, y * 0.08, 0],
      [x * 0.3, y * 0.42, z * 0.33],
    );
    nose.rotation.z = -0.22;
    nose.userData.blobNose = true;
    const skin = nose.parent.children.find((mesh) => mesh.userData.openHead);
    const a = skin.geometry.attributes.position,
      indices = skin.geometry.index;
    const va = new T.Vector3(),
      vb = new T.Vector3(),
      vc = new T.Vector3(),
      hit = new T.Vector3();

    for (const side of [-1, 1]) {
      const ray = new T.Ray(new T.Vector3(-x * 0.15, -y * 0.27, 0), new T.Vector3(0, 0, side));
      let distance = Infinity;
      const anchor = ray.origin.clone();

      for (let i = 0; i < indices.count; i += 3) {
        va.fromBufferAttribute(a, indices.getX(i));
        vb.fromBufferAttribute(a, indices.getX(i + 1));
        vc.fromBufferAttribute(a, indices.getX(i + 2));

        if (ray.intersectTriangle(va, vb, vc, false, hit)) {
          const d = hit.distanceTo(ray.origin);

          if (d < distance) {
            distance = d;
            anchor.copy(hit);
          }
        }
      }

      const fin = add(
        new T.SphereGeometry(1, 16, 10),
        material,
        [anchor.x - x * 0.05, anchor.y - y * 0.05, anchor.z + side * z * 0.23],
        [x * 0.23, y * 0.14, z * 0.29],
      );
      fin.userData.blobFin = true;
      fin.userData.finAttachment = anchor.clone();
      fin.userData.finSide = side;
    }
  }

  if (gene.species === 'flyingfish') {

    for (const side of [-1, 1]) {
      const hinge = new T.Vector3(x * 0.24, y * 0.08, side * z * 0.9);

      const point = (r, t) => {
        // t from 0 (wingtip) to 1 (trailing edge base at flank)
        const tipX = -x * 0.05,
          tipY = y * 0.06;
        const baseEndX = -x * 0.72,
          baseEndY = -y * 0.06;
        const end = new T.Vector3(
          T.MathUtils.lerp(tipX, baseEndX, t),
          T.MathUtils.lerp(tipY, baseEndY, t),
          side * (z * 0.9 + 0.48 * f * Math.cos(t * Math.PI * 0.5) ** 0.85),
        );

        const p = hinge.clone().lerp(end, r);
        p.sub(hinge).multiplyScalar(finEdge(gene.finStyle, t)).add(hinge);
        p.y += 0.016 * Math.sin(Math.PI * r) * (1 - t * 0.5);

        return p;
      };

      const points = [],
        indices = [],
        radial = 6,
        angles = 12;

      for (let i = 0; i <= radial; i++)
        for (let j = 0; j <= angles; j++) points.push(...point(i / radial, j / angles).toArray());
      for (let i = 0; i < radial; i++)
        for (let j = 0; j < angles; j++) {
          const a = i * (angles + 1) + j,
            b = a + angles + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }

      const geometry = new T.BufferGeometry();

      geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      const bind = (mesh) => {
        mesh.userData.flyingWing = side;
        mesh.userData.wingHinge = hinge.clone();
        mesh.userData.wingRest = mesh.geometry.attributes.position.array.slice();
        mesh.geometry.attributes.position.setUsage(T.DynamicDrawUsage);
      };

      const wing = add(geometry);

      bind(wing);
      wing.userData.wingMembrane = true;

      for (let i = 1; i < angles; i += 2) {
        const curve = new T.CatmullRomCurve3(
          Array.from({ length: 7 }, (_, j) => point(j / 6, i / angles)),
        );
        const ray = add(new T.TubeGeometry(curve, 12, 0.0025, 4, false));
        bind(ray);
        ray.userData.wingRay = true;
      }

      const pWing = add(
        polygon([
          [-x * 0.28, -y * 0.32, side * z * 0.65],
          [-x * 0.58, -y * 0.25, side * (z * 0.65 + 0.22 * f)],
          [-x * 0.66, -y * 0.32, side * z * 0.55],
        ]),
      );
      pWing.userData.pelvicWing = true;
    }
    add(
      polygon([
        [-x * 0.88, 0, 0],
        [-x * 1.58, -y * 1.7, 0],
        [-x * 1.3, -y * 0.16, 0],
      ]),
    );
  }
}

export function advanceFlyingFish(fish, time, dt, bounds, low, high) {
  const m = fish.motion,
    p = m.position,
    v = m.velocity;
  m.nextLeap ??= time + 90 + (hash('leap:' + fish.gene.id + ':' + m.phase) % 91);

  if (!m.flight && time >= m.nextLeap && !fish.targetFood && (fish.gene.growth ?? 1) > 0.7) {
    const direction = new T.Vector3(Math.cos(m.currentYaw), 0, -Math.sin(m.currentYaw));
    const middle = p.clone();
    middle.x = T.MathUtils.clamp(
      middle.x,
      -Math.max(0, bounds.x - 0.55),
      Math.max(0, bounds.x - 0.55),
    );
    middle.z = T.MathUtils.clamp(
      middle.z,
      -Math.max(0, bounds.z - 0.55),
      Math.max(0, bounds.z - 0.55),
    );
    const distance = Math.min(0.85, Math.max(0.1, Math.min(bounds.x, bounds.z) * 0.6));
    const launch = middle.clone().addScaledVector(direction, -distance * 0.5);
    const surface = (fish.tankBounds?.top ?? 3.6) + 0.1;
    launch.y = surface - 0.1;
    m.flight = { start: time, origin: p.clone(), launch, direction, distance, surface };
    m.nextLeap = time + 100 + (hash('leap:' + fish.gene.id + ':' + Math.floor(time)) % 81);
  }

  if (!m.flight) {
    m.wingSpread = 0.84 + 0.08 * Math.sin(time * 3.5 + m.phase);

    return;
  }
  const flight = m.flight,
    t = time - flight.start;
  const previous = p.clone();

  if (t < 4) {

    const u = T.MathUtils.clamp(t / 4, 0, 1),
      ease = u * u * (3 - 2 * u);
    p.lerpVectors(flight.origin, flight.launch, ease);
    m.wingSpread = 0.86;
    m.flightPitch = 0.25 * Math.sin(u * Math.PI);
    m.action = 'Preparing to jump';

  } else if (t < 6.6) {

    const u = (t - 4) / 2.6;
    p.copy(flight.launch).addScaledVector(flight.direction, flight.distance * u);
    p.y =
      flight.launch.y +
      (0.62 + Math.min(0.18, fish.clearance.vertical * 0.15)) * Math.sin(Math.PI * u);
    m.wingSpread = 0.94 + 0.1 * Math.sin(Math.PI * u) ** 0.4;
    m.flightPitch =
      Math.atan2((0.72 * Math.PI * Math.cos(Math.PI * u)) / 2.6, flight.distance / 2.6) * 0.55;
    m.action = p.y > flight.surface ? 'Gliding above the water' : 'Crossing the surface';

  } else if (t < 8.4) {

    const u = (t - 6.6) / 1.8,
      ease = u * u * (3 - 2 * u);
    p.copy(flight.launch).addScaledVector(flight.direction, flight.distance);
    p.y = T.MathUtils.lerp(flight.launch.y, Math.max(low, high - 0.12), ease);
    m.wingSpread = 0.88 - 0.04 * ease;
    m.flightPitch = -0.25 * Math.sin(Math.PI * u);
    m.action = 'Returning to the water';

  } else {

    m.flight = null;
    m.flightPitch = 0;
    m.wingSpread = 0.84;
    p.y = Math.min(p.y, high);
    v.copy(flight.direction).multiplyScalar(fish.gene.speed);

    return;
  }
  p.x = T.MathUtils.clamp(p.x, -bounds.x, bounds.x);
  p.z = T.MathUtils.clamp(p.z, -bounds.z, bounds.z);
  if (dt > 0) v.copy(p).sub(previous).divideScalar(dt);
  m.currentYaw = -Math.atan2(flight.direction.z, flight.direction.x);
}

export function bindBlobFish(root) {
  root.traverse((mesh) => {

    if (!mesh.geometry) return;

    mesh.updateMatrix();
    mesh.geometry.applyMatrix4(mesh.matrix);
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    mesh.userData.softRest = mesh.geometry.attributes.position.array.slice();
    mesh.geometry.attributes.position.setUsage(T.DynamicDrawUsage);
    mesh.userData.pupil = false;
    mesh.userData.fin = false;
    mesh.geometry.computeBoundingBox();
    mesh.geometry.boundingBox.expandByScalar(0.1);
    mesh.geometry.boundingSphere = mesh.geometry.boundingBox.getBoundingSphere(new T.Sphere());
  });
}

export function softBlobPoint(px, py, pz, time, phase, out = []) {
  const wave = Math.sin(time * 2.4 - px * 7 + phase) * 0.15;
  const sag = 0.5 + 0.5 * Math.sin(time * 1.1 - pz * 5 + phase);
  const trailing = 0.5 + 0.5 * T.MathUtils.smoothstep(-px, -0.1, 0.3);
  out[0] = px * (1 - wave * 0.25) + Math.sin(time * 1.7 + py * 5 + phase) * 0.018;
  out[1] =
    py * (1 + wave) -
    0.035 * sag * (0.6 + Math.max(0, -py)) +
    Math.sin(time * 2.4 - px * 7 + phase) * 0.025 * trailing;
  out[2] = pz / Math.sqrt(1 + wave) + Math.sin(time * 2.4 - px * 7 + phase) * 0.042 * trailing;
  return out;

}

export function animateUnusualFish(child, fish, time) {

  if (child.userData.flyingWing) {

    const a = child.geometry.attributes.position,
      rest = child.userData.wingRest,
      hinge = child.userData.wingHinge;

    const spread = fish.motion.wingSpread ?? 0.85;

    for (let i = 0; i < a.count; i++) {
      const dx = rest[i * 3] - hinge.x,
        dz = rest[i * 3 + 2] - hinge.z;
      const flex = fish.motion.flight
        ? 0.012 * Math.sin(time * 10 + dx * 4)
        : Math.sin(time * 4.5 + dx * 5 + fish.gene.phase) * Math.abs(dz) * 0.08;
      a.setXYZ(i, rest[i * 3], rest[i * 3 + 1] + flex, hinge.z + dz * spread);
    }

    a.needsUpdate = true;
  }

  if (child.userData.softRest) {

    const a = child.geometry.attributes.position,
      rest = child.userData.softRest,
      point = [];

    for (let i = 0; i < a.count; i++) {
      const animated = child.userData.integratedMouth || child.userData.mutationBind?.flex;
      const px = animated ? a.getX(i) : rest[i * 3];
      const py = animated ? a.getY(i) : rest[i * 3 + 1];
      const pz = animated ? a.getZ(i) : rest[i * 3 + 2];
      softBlobPoint(px, py, pz, time, fish.gene.phase, point);

      if (child.userData.blobFin) {
        const anchor = child.userData.finAttachment,
          side = child.userData.finSide;
        const flex = T.MathUtils.clamp((side * (pz - anchor.z)) / 0.09, 0, 1);
        point[1] += Math.sin(time * 5.5 + fish.gene.phase + side * 0.7) * 0.025 * flex * flex;
      }
      a.setXYZ(i, point[0], point[1], point[2]);
    }
    a.needsUpdate = true;
  }
}
