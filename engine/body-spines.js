import * as T from './vendor/three.module.js';

export function buildBodySpines({ root, gene, dimensions, add, material }) {
  const giant = [gene.mutation, gene.mutation2].includes('giantSpines');
  
  if (!giant && ![gene.mutation, gene.mutation2].includes('spines')) return;
  let body;
  root.traverse((mesh) => {
    if (mesh.userData.openHead || mesh.userData.shrimpCarapace) body = mesh;
  });
  
  if (!body)
    root.traverse((group) => {
      if (group.userData.snailShell)
        group.traverse((mesh) => {
          if (!body && mesh.isMesh) body = mesh;
        });
    });

  body ||= root.children.find((mesh) => mesh.isMesh && mesh.material === material);

  if (!body) return;

  root.updateMatrixWorld(true);
  const [x, y, z] = dimensions,
    count = giant ? 18 : 14,
    size = gene.mutationSize ?? 1;

  const box = new T.Box3().setFromObject(body),
    center = box.getCenter(new T.Vector3());

  const ray = new T.Raycaster(),
    normalMatrix = new T.Matrix3().getNormalMatrix(body.matrixWorld);

  for (let i = 0; i < count; i++) {
    const ring = i % 3,
      a = 0.19 + (Math.floor(i / 3) * Math.PI * 2) / Math.ceil(count / 3) + ring * 0.43;
    const px = body.userData.openHead
      ? x * (-0.65 + ring * 0.38)
      : T.MathUtils.lerp(box.min.x, box.max.x, 0.22 + ring * 0.25);
    const direction = new T.Vector3(0, Math.cos(a), Math.sin(a));

    if (['shrimp', 'snail', 'crab'].includes(gene.species) && direction.y < 0.05) continue;

    const origin = new T.Vector3(px, center.y, center.z).addScaledVector(
      direction,
      Math.max(y, z) * 4 + 1,
    );

    ray.set(origin, direction.clone().negate());
    const hit = ray.intersectObject(body, false)[0];

    if (!hit) continue;

    const normal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();

    if (normal.dot(direction) < 0) normal.negate();
    const length = T.MathUtils.clamp(
      (giant ? 0.06 + Math.min(y, z) : 0.035 + Math.min(y, z) * 0.35) *
        size *
        (0.85 + 0.15 * Math.sin(i * 1.7 + gene.phase)),
      0.035,
      giant ? 0.3 : 0.14,
    );

    const radius = Math.min(giant ? 0.03 : 0.018, length * 0.2),
      burial = radius * 0.65;
    const geometry = new T.ConeGeometry(radius, length, 7, 5);
    const positions = geometry.attributes.position;

    for (let j = 0; j < positions.count; j++) {
      const t = (positions.getY(j) + length * 0.5) / length;
      positions.setX(j, positions.getX(j) - length * 0.12 * t * t);
    }

    geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), normal));
    geometry.translate(
      ...hit.point
        .clone()
        .addScaledVector(normal, length * 0.5 - burial)
        .toArray(),
    );
    
    if (body.parent !== root) {

      geometry.applyMatrix4(body.parent.matrixWorld.clone().invert());
    }
    geometry.computeVertexNormals();
    const spine = add(geometry);

    if (body.parent !== root) body.parent.add(spine);
    
    spine.userData.bodySpine = { anchor: hit.point.clone(), normal, length, burial };
    spine.userData.mutationTag = 'spines';

    if (giant) spine.userData.giantSpine = true;
  }
}
