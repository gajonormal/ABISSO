import * as T from './vendor/three.module.js';
import { finEdge } from './morphology.js';

// Dense ribbons follow the same longitudinal spine wave as the body.
// Their flexible edge has a separate weight, which is zero at the buried root.
export function buildAngelFins({ gene, dimensions, finSize, add, material }) {

  const [x, y] = dimensions,
    steps = 32,
    rows = 8;
  const finMaterial = material.clone();

  for (const name of Object.keys(material.uniforms))
    finMaterial.uniforms[name] = material.uniforms[name];
  // Compile the extra vertex attribute only for these two meshes.
  finMaterial.defines = { ...material.defines, ANGEL_FIN: 1 };
  // At the seam, let the skin win the depth test instead of alternating pixels.
  finMaterial.polygonOffset = true;
  finMaterial.polygonOffsetFactor = 1;
  finMaterial.polygonOffsetUnits = 1;
  const style = gene.finStyle || 'native';
  const betta = gene.species === 'betta';

  for (const side of [-1, 1]) {
    const positions = [],
      flex = [],
      indices = [];

    for (let i = 0; i <= steps; i++) {
      const u = i / steps,

        start = betta ? (side > 0 ? 1.02 : 0.82) : 0.65,
        theta = start + (2.58 - start) * u;

      const px = x * Math.cos(theta);
      const bodyY = y * Math.sin(theta) * (1 + Math.max(0, Math.cos(theta)) * 0.12);
      const envelope = Math.pow(
        Math.max(0, Math.sin(Math.PI * Math.pow(u, betta ? 1.4 : 2.4))),
        style === 'rounded' ? 1.1 : 0.8,
      );

      const height =
        (betta ? (side > 0 ? 0.3 : 0.42) : 0.27) * finSize * envelope * finEdge(style, u);

      for (let j = 0; j <= rows; j++) {
        const v = j / rows;

        const trailing = betta ? (side > 0 ? 0.27 : 0.32) * finSize * envelope * v * v : 0;
        positions.push(px - trailing, side * (bodyY - 0.008 + height * v), 0);
        flex.push(v * v);
      }
    }

    for (let i = 0; i < steps; i++)

      for (let j = 0; j < rows; j++) {
        const a = i * (rows + 1) + j,
          b = a + rows + 1;
        // The ends taper to one point: omit the collapsed triangles there.
        if (i > 0) indices.push(a, b, a + 1);
        if (i < steps - 1) indices.push(b, b + 1, a + 1);
      }

    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aFinFlex', new T.Float32BufferAttribute(flex, 1));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const fin = add(geometry, finMaterial);
    fin.userData[betta ? 'anchoredBettaFin' : 'anchoredAngelFin'] = { side, steps, rows };
  }
}

export function buildBettaTail({ gene, dimensions, finSize, add, material }) {

  const x = -dimensions[0] * 0.82,
    radial = 10,
    steps = 32;
  const mat = material.clone();

  for (const key of Object.keys(material.uniforms)) mat.uniforms[key] = material.uniforms[key];
  mat.defines = { ...material.defines, ANGEL_FIN: 1 };
  const positions = [],
    flex = [],
    indices = [];

  for (let i = 0; i <= radial; i++)
    for (let j = 0; j <= steps; j++) {
      const v = i / radial,
        u = j / steps,
        angle = -1.15 + u * 2.3;

      const shape = gene.tail === 'fork' ? 0.65 + 0.35 * Math.abs(Math.sin(angle)) : gene.tail === 'round' ? 0.78 : 1;

      const edge = finEdge(gene.finStyle || 'native', u) * (gene.tail === 'feather' ? 0.9 + 0.1 * Math.cos(u * Math.PI * 16) : 1);
      positions.push(
        x - Math.cos(angle) * 0.56 * finSize * (gene.tailLength ?? 1) * v * shape * edge,
        Math.sin(angle) * 0.42 * finSize * v * edge,
        0,
      );
      flex.push(v * v);
    }

  for (let i = 0; i < radial; i++)
    for (let j = 0; j < steps; j++) {

      const a = i * (steps + 1) + j,
        b = a + steps + 1;
      if (i > 0) indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }

  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aFinFlex', new T.Float32BufferAttribute(flex, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  add(geometry, mat).userData.bettaTail = { steps, radial };
}

export function buildBettaPectorals({ dimensions, add, material }) {
  const rows = 8,
    steps = 6;

  for (const side of [-1, 1]) {
    const mat = material.clone();
    for (const key of Object.keys(material.uniforms)) mat.uniforms[key] = material.uniforms[key];
    mat.defines = { ...material.defines, ANGEL_FIN: 1, BETTA_PECTORAL: 1 };
    const points = [],
      flex = [],
      indices = [];

    for (let i = 0; i <= rows; i++)
      for (let j = 0; j <= steps; j++) {
        const v = i / rows,
          u = j / steps;
        points.push(
          -v * (0.14 + 0.04 * u),
          -0.035 + v * (-0.13 + 0.14 * u),
          side * (dimensions[2] * 0.7 + v * (0.22 - 0.02 * u)),
        );
        flex.push(v * v);
      }

    for (let i = 0; i < rows; i++)

      for (let j = 0; j < steps; j++) {
        const a = i * (steps + 1) + j,
          b = a + steps + 1;

        if (i > 0) indices.push(a, b, a + 1);
        indices.push(b, b + 1, a + 1);
      }

    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
    geometry.setAttribute('aFinFlex', new T.Float32BufferAttribute(flex, 1));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    add(geometry, mat).userData.bettaPectoral = { side, rows, steps };
  }
}
