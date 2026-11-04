import { Box3, Vector3, IcosahedronGeometry } from './vendor/three.module.js';

export const DECORATION_LIMITS = { x: 3.43, z: 2.08, floor: 0.185, top: 3.6 };

export function containDecoration(object, geometry = object.geometry) {
  object.updateMatrixWorld(true);
  const bounds = geometry
    ? (geometry.computeBoundingBox(), geometry.boundingBox.clone().applyMatrix4(object.matrix))
    : new Box3().setFromObject(object);
  const { x, z, floor, top } = DECORATION_LIMITS,
    size = bounds.getSize(new Vector3());
  const fit = Math.min(
    1,
    (2 * x) / Math.max(size.x, 0.001),
    (2 * z) / Math.max(size.z, 0.001),
    (top - floor) / Math.max(size.y, 0.001),
  );

  if (fit < 1) {
    object.scale.multiplyScalar(fit * 0.999);
    return containDecoration(object, geometry);
  }

  object.position.x +=
    bounds.min.x < -x ? -x - bounds.min.x : bounds.max.x > x ? x - bounds.max.x : 0;
  object.position.z +=
    bounds.min.z < -z ? -z - bounds.min.z : bounds.max.z > z ? z - bounds.max.z : 0;
  object.position.y += floor - bounds.min.y;
  object.updateMatrixWorld(true);

  return object;
}

function plantAnchor(random, height, reach = 0.75) {

  const marginX = reach + 0.16 + 0.065 * height * height + 0.075 * (height + reach + 0.2),
    marginZ = reach + 0.18;

  return new Vector3(
    (random() * 2 - 1) * (DECORATION_LIMITS.x - marginX),
    0.2,
    (random() * 2 - 1) * (DECORATION_LIMITS.z - marginZ),
  );

}


export function buriedRockGeometry(radius, random, index) {
  const kind = index === undefined ? Math.floor(random() * 3) : index % 3,
    phase = random() * Math.PI * 2;
  const geometry = new IcosahedronGeometry(radius, 3),
    positions = geometry.attributes.position;
  geometry.userData.reliefKind = ['weathered', 'craggy', 'ridged'][kind];

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) / radius,
      y = positions.getY(i) / radius,
      z = positions.getZ(i) / radius;
    const broad = Math.sin(x * 4.7 + phase) * Math.cos(z * 4.1 - phase) * Math.sin(y * 3.3 + phase);
    const fine = Math.sin(x * 15.7 + z * 9.1 + phase) * Math.cos(y * 13.3 - z * 7.3);
    const ridge = Math.abs(Math.sin(x * 7 + y * 4 + z * 5 + phase));
    let relief = 1 + broad * 0.28 + fine * (kind === 0 ? 0.035 : 0.1);

    if (kind === 1) relief = Math.round(relief * 9) / 9;
    if (kind === 2) relief += ridge * 0.16 - 0.08;

    positions.setXYZ(
      i,
      radius * x * relief,
      radius * Math.max(0, y * relief + 0.22),
      radius * z * relief,
    );
  }

  positions.needsUpdate = true;

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return geometry;
}

function plantSwayBounds(mesh) {
  mesh.geometry.computeBoundingBox();
  const bounds = mesh.geometry.boundingBox.clone(),
    radius = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x));
  const height = Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y));

  bounds.expandByVector(
    new Vector3(
      0.065 * height * height + 0.075 * height,
      0.075 * (radius + 0.065 * height * height),
      0,
    ),
  );

  bounds.min.multiply(mesh.scale);
  bounds.max.multiply(mesh.scale);

  return bounds.translate(mesh.position);
}

export function placePlant(mesh, random, height, solids, reach = 0.75) {
  for (let attempt = 0; attempt < 100; attempt++) {
    mesh.scale.setScalar(Math.pow(0.8, Math.floor(attempt / 25)));
    mesh.position.copy(plantAnchor(random, height * mesh.scale.x, reach * mesh.scale.x));
    const bounds = plantSwayBounds(mesh);

    if (!solids.some((solid) => solid.intersectsBox(bounds))) return true;
  }
  
  return false;
}
