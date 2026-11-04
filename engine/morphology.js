import * as T from './vendor/three.module.js';

export function mouthProportions(style = 'native') {
  return (
    {
      native: [1, 1],
      round: [1.8, 1.15],
      wide: [0.65, 1.9],
      vertical: [2.3, 0.65],
      sucker: [1.9, 1.7],
    }[style] || [1, 1]
  );
}

export function finOutline(points, style = 'native') {

  if (style === 'native') return points;
  const vectors = points.map((p) => new T.Vector3(...p)),
    anchor = vectors[0];

  if (style === 'veil')
    return vectors.map((p) =>
      anchor
        .clone()
        .add(
          p
            .clone()
            .sub(anchor)
            .multiply(new T.Vector3(1.15, 1.2, 1.2)),
        )
        .toArray(),
    );

  const center = vectors
    .reduce((sum, p) => sum.add(p), new T.Vector3())
    .divideScalar(vectors.length);
  const out = [points[0]];

  for (let i = 1; i < vectors.length; i++) {
    const previous = vectors[i - 1],
      p = vectors[i],
      next = vectors[(i + 1) % vectors.length];

    if (style === 'rounded') {
      const before = p.clone().lerp(previous, 0.2),
        after = p.clone().lerp(next, 0.2);

      for (let j = 0; j <= 4; j++) {
        const t = j / 4;
        out.push(
          before
            .clone()
            .multiplyScalar((1 - t) ** 2)
            .addScaledVector(p, 2 * t * (1 - t))
            .addScaledVector(after, t * t)
            .toArray(),
        );
      }

    } else {

      for (let j = 1; j <= 4; j++) {
        const t = j / 4,
          q = previous.clone().lerp(p, t),
          direction = q.clone().sub(center);
        const amplitude =
          style === 'spiky'
            ? Math.max(0, 1 - Math.abs(t - 0.5) * 2) * 0.22
            : Math.sin(t * Math.PI * 3) * 0.12;
        out.push(q.addScaledVector(direction, amplitude).toArray());
      }
    }
  }

  return out;
}

export function finEdge(style, t) {

  if (style === 'scalloped') return 0.9 + 0.1 * Math.cos(t * Math.PI * 10);
  if (style === 'spiky') return 0.78 + 0.22 * Math.abs(Math.cos(t * Math.PI * 8));
  if (style === 'veil') return 1.18;

  return 1;
}

export function applyEyeStyles({ root, gene, add, white, black, shine, material }) {

  root.updateMatrixWorld(true);
  const eyes = [],
    pupils = [],
    highlights = [];
  root.traverse((p) => {

    if (
      p.material === white &&
      p.geometry?.type === 'SphereGeometry' &&
      (p.geometry.parameters.radius ?? 1) < 0.09 &&
      (p.geometry.parameters.radius ?? 0) > 0.009
    )
      eyes.push(p);

    if (p.material === black && !p.userData.monsterMouth) pupils.push(p);
    if (p.material === shine) highlights.push(p);

  });
  const style = gene.eyeStyle || 'round',
    stalk = [gene.mutation, gene.mutation2].includes('eyeStalks') && gene.species !== 'jellyfish';

  for (const eye of eyes) {
    const r = eye.geometry.parameters.radius,
      side = eye.position.z < 0 ? -1 : 1;

    const addEye = (...args) => {
      const mesh = add(...args);
      eye.parent.add(mesh);

      if (eye.userData.neonEye) {
        mesh.userData.neonEye = true;
        mesh.userData.neonEyeAnchor = eye.userData.neonEyeAnchor;
      }
      if (eye.userData.mutationTag) {
        mesh.userData.mutationTag = eye.userData.mutationTag;
        mesh.userData.mutationAttachment = eye.userData.mutationAttachment;
      }

      return mesh;
    };

    const normal =
      gene.species === 'ray'
        ? new T.Vector3(0, 1, 0)
        : ['snail', 'crab'].includes(gene.species)
          ? new T.Vector3(1, 0, 0)
          : new T.Vector3(0.15, 0, side).normalize();

    const pupil = pupils
      .filter((p) => p.parent === eye.parent && p.position.distanceTo(eye.position) < r * 1.6)
      .sort((a, b) => a.position.distanceTo(eye.position) - b.position.distanceTo(eye.position))[0];
    eye.userData.eyeStyle = style;
    if (stalk) {
      const base = eye.position.clone(),
        offset = normal.clone().multiplyScalar(0.06 * (gene.mutationSize ?? 1));
      if (!eye.userData.mutationTag) {
        const support = eye.parent.children.find(
          (p) => p.isMesh && p.material === material && p !== eye,
        );

        const anchor = root.worldToLocal(eye.parent.localToWorld(base.clone())).toArray();
        const binding = {
          key: 'eye-stalk:' + eye.uuid,
          anchor,
          radius: 0.008,
          flex: 0.008,
          target: support?.uuid,
        };

        for (const part of [
          eye,
          pupil,
          ...highlights.filter(
            (p) => p.parent === eye.parent && p.position.distanceTo(base) < r * 1.8,
          ),
        ].filter(Boolean)) {
          part.userData.mutationTag = 'eyeStalks';
          part.userData.mutationAttachment = binding;
        }
      }

      eye.position.add(offset);

      if (pupil) pupil.position.add(offset);

      for (const highlight of highlights)

        if (highlight.parent === eye.parent && highlight.position.distanceTo(base) < r * 1.8)
          highlight.position.add(offset);
      addEye(
        new T.TubeGeometry(new T.LineCurve3(base, eye.position.clone()), 4, 0.008, 5, false),
        material,
      ).userData.eyeStalk = true;
    }

    const vertical = gene.species === 'ray' ? 'z' : 'y';

    if (style === 'oval') {
      eye.scale[vertical] *= 0.58;

      if (pupil) pupil.scale[vertical] *= 0.55;
    }

    if (style === 'slit' && pupil) {
      pupil.scale.x *= 0.28;
      pupil.scale[vertical] *= 1.15;
    }

    if (style === 'ring' && pupil) {
      addEye(
        new T.SphereGeometry(r * 0.3, 10, 8),
        white,
        pupil.position
          .clone()
          .addScaledVector(normal, r * 0.28)
          .toArray(),
      );
    }

    if (style === 'cross' && pupil) {
      pupil.visible = false;
      for (const angle of [0, Math.PI / 2]) {
        const geo = new T.CapsuleGeometry(r * 0.13, r * 0.6, 3, 6);
        geo.rotateZ(angle);
        geo.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), normal));
        addEye(geo, black, pupil.position.toArray()).userData.crossPupil = true;
      }
    }

    if (style === 'compound') {
      eye.visible = false;

      if (pupil) pupil.visible = false;
      const tint = new T.MeshBasicMaterial({
        color: new T.Color(gene.eyeColor || '#59b7bf').lerp(new T.Color(gene.accent), 0.3),
      });

      if (gene.variant === 'luminousEyes') tint.color.set(gene.accent).multiplyScalar(2.5);
      const facets = new T.MeshBasicMaterial({
        color: new T.Color(gene.eyeColor || '#59b7bf').multiplyScalar(0.22),
      });
      addEye(new T.IcosahedronGeometry(r, 1), tint, eye.position.toArray()).userData.compoundLens =
        true;
      const reference = Math.abs(normal.y) > 0.9 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0);
      const tangent = new T.Vector3().crossVectors(reference, normal).normalize(),
        up = new T.Vector3().crossVectors(normal, tangent).normalize();
        
      for (let i = 0; i < 7; i++) {
        const a = (i / 6) * Math.PI * 2,
          ring = i === 6 ? 0 : r * 0.62;
        const p = eye.position
          .clone()
          .addScaledVector(normal, Math.sqrt(r * r - ring * ring))
          .addScaledVector(tangent, ring * Math.cos(a))
          .addScaledVector(up, ring * Math.sin(a));
        addEye(new T.IcosahedronGeometry(r * 0.19, 0), facets, p.toArray()).userData.eyeFacet =
          true;
      }
    }
  }
}
