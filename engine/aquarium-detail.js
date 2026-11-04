import * as T from './vendor/three.module.js';
import { containDecoration } from './decoration-bounds.js';

export function rockMaterial(random, theme) {
  const palettes = {
    reef: ['#929eae', '#a69b88', '#717b82', '#878c80'],
    abyss: ['#748099', '#606b85', '#82928f'],
    garden: ['#928d9f', '#929f9c', '#aaa19a'],
  };

  const palette = palettes[theme] || palettes.reef;
  return new T.MeshToonMaterial({ color: palette[Math.floor(random() * palette.length)] });
}

// Aquatic stems with leaves attached at alternating nodes, rather than radial fans.
export function plantClusterGeometry(random, height, kind = 'kelp') {
  const positions = [],
    indices = [],
    colors = [];

  function vertex(x, y, z, tint) {
    positions.push(x, y, z);
    colors.push(tint, tint, tint);
  }

  function blade(origin, angle, length, rise, width) {
    const start = positions.length / 3,
      dx = Math.cos(angle),
      dz = Math.sin(angle),
      wx = -dz,
      wz = dx;

    for (let j = 0; j <= 6; j++) {
      const f = j / 6,
        w = Math.pow(Math.max(0, Math.sin(Math.PI * f)), 0.85) * width,
        x = origin.x + dx * length * f,
        z = origin.z + dz * length * f,
        y = origin.y + rise * Math.sin(f * Math.PI * 0.65);
      vertex(x - wx * w, y, z - wz * w, 0.94);
      vertex(x, y + Math.sin(f * Math.PI) * 0.004, z, 1);
      vertex(x + wx * w, y, z + wz * w, 0.97);

      if (j) {
        const p = start + (j - 1) * 3,
          n = start + j * 3;
        indices.push(p, p + 1, n, n, p + 1, n + 1, p + 1, p + 2, n + 1, n + 1, p + 2, n + 2);
      }
    }
  }

  function stalk(from, to, radius = 0.01) {
    const start = positions.length / 3,
      direction = to.clone().sub(from).normalize(),
      side = new T.Vector3(1, 0, 0);

    if (Math.abs(direction.x) > 0.9) side.set(0, 0, 1);
    side.cross(direction).normalize();
    const across = new T.Vector3().crossVectors(direction, side).normalize();

    for (let row = 0; row < 2; row++)
      for (let j = 0; j < 5; j++) {
        const theta = (j / 5) * Math.PI * 2,
          p = (row ? to : from)
            .clone()
            .addScaledVector(side, Math.cos(theta) * radius)
            .addScaledVector(across, Math.sin(theta) * radius);
        vertex(p.x, p.y, p.z, 0.76);
      }

    for (let j = 0; j < 5; j++) {
      const a = start + j,
        b = start + ((j + 1) % 5),
        c = start + 5 + j,
        d = start + 5 + ((j + 1) % 5);
      indices.push(a, b, c, c, b, d);
    }
  }

  if (kind === 'ribbon') {

    for (let leaf = 0; leaf < 4; leaf++) {
      const angle = leaf * 2.4 + random() * 0.5,
        dx = Math.cos(angle),
        dz = Math.sin(angle),
        width = 0.055 + random() * 0.045,
        h = height * (0.7 + random() * 0.3),
        offset = (leaf - 1.5) * 0.035,
        start = positions.length / 3;

      for (let j = 0; j <= 16; j++) {
        const f = j / 16,
          bend = Math.sin(f * 2.2) * 0.24 + Math.sin(f * 7 + leaf) * 0.04 * f,
          w = width * Math.sin(Math.PI * Math.pow(f, 0.6));

        const x = offset + dx * bend,
          z = dz * bend;
        vertex(x - dz * w, h * f, z + dx * w, 0.95);
        vertex(x + dz * w, h * f, z - dx * w, 1);
        if (j) {
          const a = start + (j - 1) * 2,
            b = start + j * 2;
          indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    }

  } else if (kind === 'broadleaf') {
    for (let leaf = 0; leaf < 6; leaf++) {
      const angle = leaf * 2.4 + random() * 0.5,
        h = height * (0.35 + random() * 0.55),
        tip = new T.Vector3(Math.cos(angle) * 0.1, h, Math.sin(angle) * 0.1);

      stalk(new T.Vector3(), tip, 0.012);
      blade(tip, angle, 0.32 + random() * 0.22, 0.04 + random() * 0.08, 0.11 + random() * 0.04);
    }

  } else if (kind === 'bush' || kind === 'moss') {
    const branches = kind === 'moss' ? 12 : 7;

    for (let branch = 0; branch < branches; branch++) {
      const angle = branch * 2.4 + random() * 0.5,
        reach = kind === 'moss' ? 0.12 + random() * 0.15 : 0.2 + random() * 0.18,
        h = height * (0.5 + random() * 0.5),
        fork = new T.Vector3(
          Math.cos(angle) * reach * 0.35,
          h * 0.4,
          Math.sin(angle) * reach * 0.35,
        ),

        tip = new T.Vector3(Math.cos(angle) * reach, h, Math.sin(angle) * reach);

      stalk(new T.Vector3(), fork, kind === 'moss' ? 0.006 : 0.009);
      stalk(fork, tip, kind === 'moss' ? 0.004 : 0.006);

      for (let node = 0; node < 4; node++) {
        const f = (node + 1) / 5,
          p = fork.clone().lerp(tip, f);

        for (let side = 0; side < 2; side++) {
          const turn = angle + side * Math.PI + node * 0.7;
          blade(
            p,
            turn,
            kind === 'moss' ? 0.055 : 0.1 + random() * 0.06,
            0.025,
            kind === 'moss' ? 0.012 : 0.022,
          );
        }
      }
    }

  } else if (kind === 'grass') {
    for (let i = 0; i < 6; i++) {
      const angle = random() * Math.PI * 2;
      blade(new T.Vector3(), angle, 0.06 + random() * 0.17, height * (0.65 + random() * 0.35), 0.012 + random() * 0.012);
    }
  } else {
    const stems = kind === 'rosette' ? 3 : 2;

    for (let stem = 0; stem < stems; stem++) {
      const angle = random() * Math.PI * 2,
        lean = 0.1 + random() * 0.18,
        baseX = (random() - 0.5) * 0.1,
        baseZ = (random() - 0.5) * 0.1,
        h = height * (0.7 + random() * 0.3),
        baseAngle = random() * Math.PI * 2;

      const point = (f) =>
        new T.Vector3(
          baseX + Math.cos(angle) * lean * f * f,
          h * f,
          baseZ + Math.sin(angle) * lean * f * f,
        );

      const start = positions.length / 3;

      for (let j = 0; j <= 10; j++) {
        const f = j / 10,
          p = point(f),
          radius = 0.012 * (1 - f * 0.55);
        for (let side = 0; side < 5; side++) {

          const theta = (side / 5) * Math.PI * 2;
          vertex(p.x + Math.cos(theta) * radius, p.y, p.z + Math.sin(theta) * radius, 0.76);
        }

        if (j)
          for (let side = 0; side < 5; side++) {

            const a = start + (j - 1) * 5 + side,
              b = start + (j - 1) * 5 + ((side + 1) % 5),
              c = start + j * 5 + side,
              d = start + j * 5 + ((side + 1) % 5);
            indices.push(a, b, c, c, b, d);
          }
      }

      const nodes = kind === 'rosette' ? 5 : 8;

      for (let node = 0; node < nodes; node++) {
        const f = 0.16 + (node / nodes) * 0.78,
          p = point(f),
          turn = baseAngle + node * 2.4;
        for (let side = 0; side < 2; side++) {
          const length = (kind === 'rosette' ? 0.23 : 0.18) + random() * 0.17;
          blade(
            p,
            turn + side * Math.PI + (random() - 0.5) * 0.3,
            length,
            0.07 + random() * 0.12,
            kind === 'rosette' ? 0.055 : 0.035,
          );
        }
      }
    }
  }

  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

export function addFloorLife(group, random, theme, decoration) {
  if (decoration === 'none') return;
  const shellPalette =
    theme === 'abyss' ? ['#71849a', '#8b87a0'] : ['#c6b49c', '#c0a8b9', '#a9bdb8'];
  
  for (let i = 0; i < 6; i++) {
    const cluster = new T.Group(),
      geometry = new T.SphereGeometry(0.1 + random() * 0.04, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    const p = geometry.attributes.position;
    
    for (let j = 0; j < p.count; j++) {
      const x = p.getX(j),
        z = p.getZ(j),
        ribs = 1 + 0.07 * Math.cos(Math.atan2(z, x) * 10);
      p.setXYZ(j, x * ribs, p.getY(j), z * ribs);
    }

    geometry.computeVertexNormals();

    const shell = new T.Mesh(
      geometry,
      new T.MeshToonMaterial({ color: shellPalette[i % shellPalette.length] }),
    );

    shell.scale.set(1.2, 0.45, 0.85);
    shell.rotation.y = random() * Math.PI;
    cluster.add(shell);
    cluster.position.set((random() - 0.5) * 6.2, 0, (random() - 0.5) * 3.6);
    
    containDecoration(cluster);
    group.add(cluster);

  }
  
  for (let i = 0; i < 4; i++) {
    const cluster = new T.Group(),
      palette =
        theme === 'abyss'
          ? ['#687799', '#7688a1']
          : theme === 'garden'
            ? ['#b18aaf', '#87afb0']
            : ['#b89b82', '#a98ba5', '#91aaa1'];
            
    const material = new T.MeshToonMaterial({
      color: palette[i % palette.length],
      side: T.DoubleSide,
    });

    for (let j = 0; j < 3; j++) {
      const height = 0.15 + random() * 0.28,
        radius = 0.055 + random() * 0.035,
        x = (random() - 0.5) * 0.25,
        z = (random() - 0.5) * 0.25;

      const tube = new T.Mesh(
        new T.CylinderGeometry(radius, radius * 1.25, height, 7, 1, true),
        material,
      );
      tube.position.set(x, height / 2, z);
      cluster.add(tube);

      const hole = new T.Mesh(
        new T.CircleGeometry(radius * 0.85, 7),
        new T.MeshBasicMaterial({ color: '#252d3b' }),
      );

      hole.rotation.x = -Math.PI / 2;
      hole.position.set(x, height - 0.025, z);
      cluster.add(hole);
    }

    cluster.position.set((random() - 0.5) * 5.8, 0, (random() - 0.5) * 3.4);
    
    containDecoration(cluster);
    group.add(cluster);
  }
}
