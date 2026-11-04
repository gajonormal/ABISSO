import * as T from './vendor/three.module.js';
import { mouthProportions } from './morphology.js';

export function buildFishHead({ gene, dimensions, add, material }) {

  const [x, y, z] = dimensions;

  if (gene.species === 'gar') return buildGarHead({ gene, dimensions, add, material });

  const toothed =
    ['angler', 'monkfish'].includes(gene.species) ||
    [gene.mutation, gene.mutation2].includes('fangs');
  const size = gene.mouthSize ?? 1;
  const blob = gene.species === 'blobfish';
  const [mh, mw] = mouthProportions(gene.mouthStyle);
  const monk = gene.species === 'monkfish';
  const h = Math.min(
      y * (monk ? 0.5 : 0.7),
      y * (monk ? 0.3 : toothed ? 0.47 : blob ? 0.105 : 0.1) * size * mh,
    ),
    w = Math.min(z * 0.8, z * (toothed ? 0.57 : blob ? 0.32 : 0.15) * size * mw);
    
  const center = -y * (blob ? 0.35 : monk ? 0.08 : toothed ? 0.18 : 0.08),
    front = x * (blob ? 0.82 : toothed ? 0.91 : 0.995);

  const segments = 24,
    rings = blob ? 40 : 20;
  const breathingBounds = (geometry) => {
    geometry.computeBoundingBox();
    geometry.boundingBox.min.y -= h * 0.4;
    geometry.boundingBox.min.x -= h * 0.08;
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new T.Sphere());
  };

  const meshOf = (points, rows, mat) => {
    const indices = [];

    for (let i = 0; i < rows - 1; i++)
      for (let j = 0; j < segments; j++) {
        const a = i * (segments + 1) + j,
          b = a + segments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }

    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    breathingBounds(geometry);
    const mesh = add(geometry, mat);
    mesh.userData.integratedMouth = {
      rest: geometry.attributes.position.array.slice(),
      x,
      center,
      h,
    };

    mesh.userData.monsterMouth = true;

    return mesh;
  };

  const joinTheta = Math.max(
    0.65,
    Math.asin(Math.min(0.95, Math.max((Math.abs(center) + h) / y, w / z) / 1.1)) + 0.18,
  );

  const joinWidth = 1 + Math.max(0, Math.cos(joinTheta)) * 0.12;

  const rim = (a) => {
    const ry = center + h * Math.cos(a),
      rz = w * Math.sin(a);
    const radius = (ry / (y * 1.1)) ** 2 + (rz / (z * 1.1)) ** 2;
    return [front * Math.sqrt(Math.max(0.06, 1 - radius)), ry, rz];
  };

  const skin = [];

  for (let i = 0; i <= rings; i++)
    for (let j = 0; j <= segments; j++) {
      const a = (j / segments) * Math.PI * 2,
        theta = (i / rings) * Math.PI;
      const width = 1 + Math.max(0, Math.cos(theta)) * 0.12;
      let point = [
        x * Math.cos(theta),
        y * Math.sin(theta) * width * Math.cos(a),
        z * Math.sin(theta) * width * Math.sin(a),
      ];
      
      if (theta < joinTheta) {
        const t = theta / joinTheta,
          r = rim(a),
          target = [
            x * Math.cos(joinTheta),
            y * Math.sin(joinTheta) * joinWidth * Math.cos(a),
            z * Math.sin(joinTheta) * joinWidth * Math.sin(a),
          ];
        point = r.map((value, k) => value * (1 - t) + target[k] * t);
        point[0] += x * (blob ? 0.18 : 0.025) * Math.sin(t * Math.PI);

        if (gene.mouthStyle === 'sucker') {
          const fold = Math.sin(Math.PI * Math.min(1, t * 4)) * Math.max(0, 1 - t * 4) * 0.08;
          point[1] += (r[1] - center) * fold;
          point[2] += r[2] * fold;
        }
      }
      
      if (blob) {
        const weight = T.MathUtils.smoothstep(theta, 0.65, 1.1) * Math.sin(theta) ** 2;
        point[1] -= y * 0.24 * weight;
        point[2] *= 1 + weight * (0.18 + 0.11 * Math.sin(a * 3 + 0.5));
        point[0] += x * 0.07 * Math.sin(a * 2 + 0.8) * weight;
      }

      if (gene.species === 'monkfish') {
        const broad = T.MathUtils.lerp(
          1,
          0.38 + 0.72 * T.MathUtils.smoothstep(Math.cos(theta), -0.8, 0.4),
          T.MathUtils.smoothstep(theta, 0.2, 0.8),
        );
        point[2] *= broad;
        point[1] = Math.max(-y * 0.62, point[1]);
      }

      skin.push(...point);
    }
    
  const body = meshOf(skin, rings + 1, material);
  body.userData.openHead = true;

  const solid = (color) => {
    const m = material.clone();

    for (const name of ['uTime', 'uPhase', 'uBend', 'uNight', 'uGrowth', 'uMutation'])
      m.uniforms[name] = material.uniforms[name];
    m.uniforms.uColor.value.set(color);
    m.uniforms.uAccent.value.set(color);

    for (const name of ['uPattern', 'uEffect', 'uFinish'])
      if (m.uniforms[name]) m.uniforms[name].value = 0;
    m.uniforms.uOpacity.value = 1;
    m.transparent = false;
    m.depthWrite = true;
    m.side = T.DoubleSide;
    return m;
  };

  const cavity = [];
  const cavityBack =
    Math.min(...Array.from({ length: segments }, (_, j) => rim((j / segments) * Math.PI * 2)[0])) -
    x * (toothed ? 0.3 : 0.18);

  for (let i = 0; i <= 6; i++)
    for (let j = 0; j <= segments; j++) {
      const t = i / 6,
        a = (j / segments) * Math.PI * 2,
        r = 1 - t;
      const boundary = rim(a);
      cavity.push(
        boundary[0] * (1 - t) + cavityBack * t,
        center + h * Math.cos(a) * r,
        w * Math.sin(a) * r,
      );
    }

  const throat = meshOf(cavity, 7, solid('#221725'));
  throat.userData.mouthCavity = true;
  
  if (toothed) {
    const enamel = solid('#eee6cf');

    for (const side of [-1, 1])
      for (let i = 0; i < 5; i++) {
        const fraction = (i - 2) * 0.31,
          baseY = center + side * h * Math.sqrt(1 - fraction * fraction);
        const length = h * (0.52 + 0.12 * (1 - Math.abs(fraction))),
          radius = Math.min(w * 0.085, 0.012 * (gene.mutationSize ?? 1));
        const geometry = new T.ConeGeometry(radius, length, 7);

        if (side > 0) geometry.rotateZ(Math.PI);
        geometry.rotateY(0.2);
        const toothX = rim(Math.atan2(fraction, side * Math.sqrt(1 - fraction * fraction)))[0];
        geometry.translate(toothX - 0.008, baseY - side * length * 0.48, w * fraction);
        breathingBounds(geometry);
        const tooth = add(geometry, enamel);
        tooth.userData.monsterMouth = true;
        tooth.userData.integratedMouth = {
          rest: geometry.attributes.position.array.slice(),
          x,
          center,
          h,
          side,
          lower: Math.sqrt(1 - fraction * fraction),
        };
        tooth.userData.mouthTooth = true;
      }
  }
}

function buildGarHead({ gene, dimensions, add, material }) {
  const [x, y, z] = dimensions;
  const size = gene.mouthSize ?? 1;
  const center = -y * 0.08;
  const h =
    y * 0.25 * size * (gene.mouthStyle === 'round' ? 1.25 : gene.mouthStyle === 'wide' ? 0.8 : 1);

  const solid = (color) => {
    const m = material.clone();

    for (const name of [
      'uTime',
      'uPhase',
      'uBend',
      'uSwimPace',
      'uSwimType',
      'uLength',
      'uHeight',
      'uNight',
      'uGrowth',
      'uMutation',
    ])
      m.uniforms[name] = material.uniforms[name];
    m.uniforms.uColor.value.set(color);
    m.uniforms.uAccent.value.set(color);

    for (const name of ['uPattern', 'uEffect', 'uFinish'])

      if (m.uniforms[name]) m.uniforms[name].value = 0;
    m.side = T.DoubleSide;

    return m;
  };

  const gap = y * Math.min(0.12, 0.055 * size);
  const profile = (s) => {
    const cap = Math.sqrt(Math.max(0, 1 - ((s - 1.72) / 0.18) ** 2));
    const tip = s > 1.72 ? cap : 1;
    const rear = s <= 0.1 ? Math.sqrt(Math.max(0, 1 - s * s)) : null;

    return {
      width:
        z *
        (rear ?? T.MathUtils.lerp(Math.sqrt(0.99), 0.4, T.MathUtils.smoothstep(s, 0.1, 1.55))) *
        tip,
      height:
        y *
        (rear ?? T.MathUtils.lerp(Math.sqrt(0.99), 0.18, T.MathUtils.smoothstep(s, 0.1, 1.2))) *
        tip,
      cleft: T.MathUtils.smoothstep(s, 0.22, 0.86),
    };

  };

  const surface = (lower) => {
    const rows = lower ? 44 : 88,
      segments = 32,
      points = [],
      indices = [];

    for (let i = 0; i <= rows; i++) {
      const s = T.MathUtils.lerp(lower ? 0.16 : -1, 1.9, i / rows);
      const { width, height, cleft } = profile(s);
      const jawBlend = T.MathUtils.smoothstep(s, 0.16, 0.65);

      for (let j = 0; j <= segments; j++) {
        const a = (j / segments) * Math.PI * 2,
          c = Math.cos(a),
          sn = Math.sin(a);
        let py, pz;

        if (lower) {
          py = center - gap * cleft + Math.min(0, c) * height * (0.72 + 0.16 * cleft) * jawBlend;
          pz = width * sn * (0.65 + 0.33 * jawBlend);
        } else {
          py =
            center + Math.max(0, c) * height + Math.min(0, c) * height * (1 - cleft) + gap * cleft;
          pz = width * sn;
        }
        points.push(s * x, py, pz);
      }
    }

    for (let i = 0; i < rows; i++)
      for (let j = 0; j < segments; j++) {
        const a = i * (segments + 1) + j,
          b = a + segments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = add(geometry, material);
    mesh.userData.monsterMouth = true;
    mesh.userData.integratedMouth = {
      rest: geometry.attributes.position.array.slice(),
      x,
      center,
      h,
      side: lower ? -1 : 1,
      lower: lower ? 1 : 0,
    };
    mesh.userData.garSurface = { rows, segments, lower };

    return mesh;
  };

  const body = surface(false);
  body.userData.openHead = true;

  surface(true);

  const cavityPts = [],
    cavityIdx = [];
  const cRows = 6,
    cSegs = 18;

  for (let i = 0; i <= cRows; i++) {
    const t = i / cRows;
    const cx = T.MathUtils.lerp(x * 0.48, x * 0.26, t);
    const cw = z * 0.75 * (1 - t * 0.7);
    const ch = y * 0.18 * (1 - t * 0.6);

    for (let j = 0; j <= cSegs; j++) {
      const a = (j / cSegs) * Math.PI * 2;
      cavityPts.push(cx, center + ch * Math.cos(a), cw * Math.sin(a));
    }
  }

  for (let i = 0; i < cRows; i++) {
    for (let j = 0; j < cSegs; j++) {
      const a = i * (cSegs + 1) + j,
        b = a + cSegs + 1;
      cavityIdx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  const cavityGeo = new T.BufferGeometry();

  cavityGeo.setAttribute('position', new T.Float32BufferAttribute(cavityPts, 3));
  cavityGeo.setIndex(cavityIdx);
  cavityGeo.computeVertexNormals();

  const throat = add(cavityGeo, solid('#33222a'));

  throat.userData.mouthCavity = true;

  const enamel = solid('#fffaea');
  const toothCount = 14;

  for (const side of [-1, 1]) {
    for (let k = 0; k < toothCount; k++) {
      const frac = k / (toothCount - 1);
      const tx = T.MathUtils.lerp(x * 0.68, x * 1.72, frac);
      const jawW = profile(tx / x).width;
      const innerW = jawW * 0.86;
      const isFang = k === 3 || k === 10;
      const toothLen = gap * (0.72 + 0.25 * Math.sin(frac * Math.PI) + (isFang ? 0.15 : 0));
      const toothRadius = Math.min(0.0022 * size, toothLen * 0.22);

      const upGeo = new T.ConeGeometry(toothRadius, toothLen, 5);
      upGeo.rotateZ(Math.PI);
      upGeo.translate(0, -toothLen / 2, 0);
      upGeo.rotateX(side * 0.08);
      upGeo.translate(tx, center + gap * profile(tx / x).cleft, side * innerW);

      const upTooth = add(upGeo, enamel);
      upTooth.userData.monsterMouth = true;
      upTooth.userData.integratedMouth = {
        rest: upGeo.attributes.position.array.slice(),
        x,
        center,
        h,
        side: 1,
        lower: 0,
      };
      upTooth.userData.mouthTooth = true;

      const lowLen = toothLen * 0.95;
      const lowGeo = new T.ConeGeometry(toothRadius * 0.95, lowLen, 5);
    
      lowGeo.translate(0, lowLen / 2, 0);
      lowGeo.rotateX(-side * 0.08);
      lowGeo.translate(tx, center - gap * profile(tx / x).cleft, side * (innerW * 0.96));

      const lowTooth = add(lowGeo, enamel);
      lowTooth.userData.monsterMouth = true;
      lowTooth.userData.integratedMouth = {
        rest: lowGeo.attributes.position.array.slice(),
        x,
        center,
        h,
        side: -1,
        lower: 1,
      };
      lowTooth.userData.mouthTooth = true;
    }
  }

  return body;

}

export function animateFishMouth(mesh, fish, time) {
  const data = mesh.userData.integratedMouth;

  if (!data) return;
  const a = mesh.geometry.attributes.position,
    { rest, x, center, h, side } = data;
  const opening =
    (0.5 + 0.5 * Math.sin(time * (fish.targetFood ? 6 : 2.2) + fish.gene.phase)) *
    h *
    (fish.targetFood ? 0.4 : 0.22);

  for (let i = 0; i < a.count; i++) {
    const px = rest[i * 3],
      py = rest[i * 3 + 1],
      pz = rest[i * 3 + 2];
    const head = T.MathUtils.smoothstep(px / x, 0.48, 0.88);
    const lower =
      side === 1 ? 0 : side === -1 ? data.lower : T.MathUtils.clamp((center - py) / h, 0, 1);
    a.setXYZ(i, px - opening * head * lower * 0.2, py - opening * head * lower, pz);
  }

  a.needsUpdate = true;

  if (mesh.material !== fish.material)
    
    for (const key of ['uTime', 'uBend', 'uNight']) {
      if (mesh.material.uniforms[key])
        mesh.material.uniforms[key].value = fish.material.uniforms[key].value;
    }
}
