import * as T from './vendor/three.module.js';

export function bindMutations({ root, gene, material, mats, geo }) {

  root.updateMatrixWorld(true);
  const all = [];
  root.traverse((p) => all.push(p));
  const mutations = all.filter((p) => p.isMesh && (p.userData.mutationTag || p.userData.bodySpine));
  const surfaces = all.filter(
    (p) =>
      p.isMesh &&
      !mutations.includes(p) &&
      p.geometry &&
      !p.userData.mouthCavity &&
      !p.userData.mouthTooth,
  );

  const primary =
    surfaces.find((p) => p.userData.openHead) ||
    surfaces.find((p) => p.userData.seahorseBody) ||
    surfaces.find((p) => p.userData.jellyBell) ||
    surfaces.find((p) => p.userData.shrimpCarapace) ||
    surfaces.find((p) => p.material === material);
  const groups = new Map(),
    rootInverse = root.matrixWorld.clone().invert();

  for (const mesh of mutations) {
    const data = mesh.userData.mutationAttachment;
    const key = data?.key || mesh.uuid;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mesh);
  }

  for (const meshes of groups.values()) {
    const first = meshes[0],
      data = first.userData.mutationAttachment;
    const originalMatrix = new T.Matrix4().multiplyMatrices(rootInverse, first.matrixWorld);
    const center =
      first.geometry.boundingBox ||
      (() => {
        first.geometry.computeBoundingBox();

        return first.geometry.boundingBox;
      })();
    let desired = data
      ? new T.Vector3(...data.anchor)
      : center.getCenter(new T.Vector3()).applyMatrix4(originalMatrix);

    if (first.userData.bodySpine) {
      const a = first.geometry.attributes.position,
        sides = first.geometry.parameters.radialSegments,
        steps = first.geometry.parameters.heightSegments;

      if (sides && steps) {
        desired = new T.Vector3();

        for (let i = 0; i < sides; i++)
          desired.add(new T.Vector3().fromBufferAttribute(a, steps * (sides + 1) + i));
        desired.divideScalar(sides).applyMatrix4(originalMatrix);
      }
    }

    const radius = data?.radius ?? 0.012;
    let target = primary;

    if (gene.species === 'snail') {
      let shell = first.parent;

      while (shell && shell !== root && !shell.userData.snailShell) shell = shell.parent;

      if (first.userData.mutationTag === 'extraEyes')
        target = surfaces.find((p) => p.userData.snailMantle);
      else if (['tendrils', 'frill', 'antenna', 'eyeStalks'].includes(first.userData.mutationTag)) {
        const head = all.find((p) => p.userData.articulation?.part === 'snailHead');
        target =
          head?.children.find((p) => p.isMesh) || surfaces.find((p) => p.userData.snailMantle);

      } else {

        if (!shell || shell === root) {
          const shells = all.filter((p) => p.userData.snailShell);
          shell = shells.sort(
            (a, b) => Math.abs(a.position.z - desired.z) - Math.abs(b.position.z - desired.z),
          )[0];
        }
        target =
          surfaces.find((p) => p.parent === shell) || surfaces.find((p) => p.userData.snailMantle);
      }
    }

    if (data?.target) target = surfaces.find((p) => p.uuid === data.target) || target;

    if (!target) continue;

    target.geometry.computeBoundingBox();
    const box = target.geometry.boundingBox.clone().applyMatrix4(target.matrixWorld),
      middle = box.getCenter(new T.Vector3()),
      worldDesired = desired.clone().applyMatrix4(root.matrixWorld);
    const direction = worldDesired.clone().sub(middle);

    if (direction.lengthSq() < 1e-8) direction.set(0, 1, 0);
    direction.normalize();
    const distance = box.getSize(new T.Vector3()).length() + 1;
    const ray = new T.Raycaster(
      middle.clone().addScaledVector(direction, distance),
      direction.clone().negate(),
    );

    let hit = ray.intersectObject(target, false)[0];

    if (!hit) {
      const a = target.geometry.attributes.position,
        index = target.geometry.index,
        triangle = new T.Triangle(),
        closest = new T.Vector3();
      let best = Infinity;

      for (let i = 0; i < (index?.count ?? a.count); i += 3) {
        triangle.a
          .fromBufferAttribute(a, index ? index.getX(i) : i)
          .applyMatrix4(target.matrixWorld);
        triangle.b
          .fromBufferAttribute(a, index ? index.getX(i + 1) : i + 1)
          .applyMatrix4(target.matrixWorld);
        triangle.c
          .fromBufferAttribute(a, index ? index.getX(i + 2) : i + 2)
          .applyMatrix4(target.matrixWorld);
        triangle.closestPointToPoint(worldDesired, closest);
        const distance = closest.distanceToSquared(worldDesired);

        if (distance < best) {
          best = distance;
          hit = { point: closest.clone(), worldNormal: triangle.getNormal(new T.Vector3()) };
        }
      }
    }

    if (!hit) continue;
    const normal =
      hit.worldNormal ||
      hit.face.normal
        .clone()
        .applyMatrix3(new T.Matrix3().getNormalMatrix(target.matrixWorld))
        .normalize();

    if (normal.dot(direction) < 0) normal.negate();
    const attachment = hit.point
        .clone()
        .addScaledVector(normal, -radius * 0.45)
        .applyMatrix4(rootInverse),
      offset = attachment.clone().sub(desired);
    const inverse = target.matrixWorld.clone().invert(),
      toLocal = new T.Matrix4().multiplyMatrices(inverse, root.matrixWorld);
    const frame = target.material?.uniforms ? target.material : material;

    for (const mesh of meshes) {
      const transform = new T.Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld);

      mesh.geometry = mesh.geometry.clone();
      mesh.geometry.applyMatrix4(transform);
      mesh.geometry.translate(...offset.toArray());

      const rootPositions = mesh.geometry.attributes.position,
        weights = [];
        
      for (let i = 0; i < rootPositions.count; i++)
        weights.push(
          T.MathUtils.smoothstep(
            new T.Vector3().fromBufferAttribute(rootPositions, i).distanceTo(attachment),
            0.035,
            0.3,
          ),
        );

      mesh.geometry.applyMatrix4(toLocal);
      geo.push(mesh.geometry);
      mesh.position.set(0, 0, 0);
      mesh.rotation.set(0, 0, 0);
      mesh.scale.set(1, 1, 1);
      target.add(mesh);

      if (mesh.userData.rest) mesh.userData.rest.set(0, 0, 0);
      const original = mesh.material,
        mat = material.clone();
      mat.uniforms = { ...material.uniforms, uGill: { value: 0 } };
      
      for (const name of [
        'uTime',
        'uPhase',
        'uBend',
        'uSwimPace',
        'uSwimType',
        'uLength',
        'uHeight',
        'uMutation',
      ])
        if (frame.uniforms[name]) mat.uniforms[name] = frame.uniforms[name];

      if (original.isShaderMaterial) {
        
        for (const name of [
          'uColor',
          'uAccent',
          'uPattern',
          'uPatternScale',
          'uFinish',
          'uEffect',
          'uOpacity',
        ])

          if (original.uniforms[name]) mat.uniforms[name] = original.uniforms[name];

      } else {
        const color = original.color?.clone() || new T.Color('#ffffff');
        Object.assign(mat.uniforms, {
          uColor: { value: color },
          uAccent: { value: color.clone() },
          uPattern: { value: 0 },
          uVariant: { value: 0 },
          uFinish: { value: mesh.userData.monsterGlow ? 1 : 0 },
          uEffect: { value: 0 },
          uOpacity: { value: original.opacity ?? 1 },
        });
      }

      mat.transparent = original.transparent;
      mat.depthWrite = original.depthWrite;
      mesh.material = mat;
      mats.push(mat);

      const a = mesh.geometry.attributes.position;
      const directions = new T.Matrix3().setFromMatrix4(toLocal);

      mesh.userData.mutationBind = {
        target: target.uuid,
        anchor: attachment.toArray(),
        localAnchor: attachment.clone().applyMatrix4(toLocal).toArray(),
        rest: a.array.slice(),
        weights,
        axisY: new T.Vector3(0, 1, 0).applyMatrix3(directions).toArray(),
        axisZ: new T.Vector3(0, 0, 1).applyMatrix3(directions).toArray(),
        flex: data?.flex ?? 0,
        phase: data?.phase ?? 0,
      };

      delete mesh.userData.monsterFlex;

      mesh.geometry.computeBoundingBox();
      mesh.geometry.boundingBox.expandByScalar(0.06);
      mesh.geometry.boundingSphere = mesh.geometry.boundingBox.getBoundingSphere(new T.Sphere());

      if (gene.species === 'blobfish') mesh.userData.pupil = false;
    }
  }
}

export function animateMutation(mesh, fish, time) {
  const bind = mesh.userData.mutationBind;

  if (!bind || !bind.flex) return;
  const a = mesh.geometry.attributes.position,
    rest = bind.rest,
    base = bind.localAnchor;

  for (let i = 0; i < a.count; i++) {
    const x = rest[i * 3],
      y = rest[i * 3 + 1],
      z = rest[i * 3 + 2],
      distance = Math.hypot(x - base[0], y - base[1], z - base[2]);
    const weight = bind.weights[i],
      wave = time * 2.8 - distance * 7 + bind.phase,
      dy = Math.sin(wave) * weight * bind.flex,
      dz = Math.cos(wave * 0.85) * weight * bind.flex;
    a.setXYZ(
      i,
      x + dy * bind.axisY[0] + dz * bind.axisZ[0],
      y + dy * bind.axisY[1] + dz * bind.axisZ[1],
      z + dy * bind.axisY[2] + dz * bind.axisZ[2],
    );
  }
  
  a.needsUpdate = true;
}
